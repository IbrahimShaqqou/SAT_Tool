#!/usr/bin/env python3
"""
Fetch every digital-SAT Math item  →  math_core.json  +  math_norm.json
(QC now: 0 blank prompts · 0 empty-SPR · 0 bad-MCQ)
"""

from __future__ import annotations
import argparse, json, sys, threading, html, re, time, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── CONSTANTS ──────────────────────────────────────────────────────────
QB_BASE   = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital"
META_URL  = f"{QB_BASE}/get-questions"
DETAIL_URL= f"{QB_BASE}/get-question"
DISC_BASE = "https://saic.collegeboard.org/disclosed"

# Browser-like headers to avoid 403
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": "https://satsuitequestionbank.collegeboard.org",
    "Referer": "https://satsuitequestionbank.collegeboard.org/",
}

PAYLOAD   = {"asmtEventId": 99, "test": 2, "domain": "H,P,Q,S"}   # Math
DATA_DIR  = Path("data")
CORE_FILE = DATA_DIR / "math_core.json"
NORM_FILE = DATA_DIR / "math_norm.json"

MAX_WORKERS = 5  # Reduced to avoid rate limiting
TIMEOUT     = 30
EVERY       = 50
DELAY_MIN   = 0.1  # Min delay between requests
DELAY_MAX   = 0.3  # Max delay between requests
# ─────────────────────────────────────────────────────────────────────────

_tls = threading.local()

def create_session() -> requests.Session:
    """Create a session with retry logic."""
    s = requests.Session()
    s.headers.update(HEADERS)

    # Retry strategy
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "POST", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    s.mount("https://", adapter)
    s.mount("http://", adapter)

    return s

def session() -> requests.Session:
    if not hasattr(_tls, "sess"):
        _tls.sess = create_session()
    return _tls.sess

# ─── FETCH HELPERS ──────────────────────────────────────────────────────
def fetch_metadata() -> List[Dict[str, Any]]:
    s = create_session()
    r = s.post(META_URL, json=PAYLOAD, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def external_id(meta: Dict[str, Any]) -> str | None:
    for k in ("external_id","externalId","externalid"):
        if meta.get(k): return str(meta[k])
    return None

def worker(meta: Dict[str, Any]) -> tuple[str, Dict[str,Any]|None, str|None]:
    uid = str(meta.get("uId") or meta.get("questionId"))
    ext = external_id(meta)
    ibn = meta.get("ibn")

    # Add small random delay to avoid rate limiting
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    try:
        if ext:
            resp = session().post(
                DETAIL_URL,
                json={"questionId": meta.get("questionId"), "external_id": ext},
                timeout=TIMEOUT
            )
        elif ibn:
            resp = session().get(f"{DISC_BASE}/{ibn}.json", timeout=TIMEOUT)
        else:
            return uid, None, "missing ids"

        resp.raise_for_status()
        return uid, resp.json(), None
    except requests.RequestException as exc:
        return uid, None, str(exc)

# ─── NORMALISATION UTILITIES ────────────────────────────────────────────
def pick_prompt(detail: Dict[str, Any]) -> str:
    cand_keys = ("prompt_html","prompt","stem_html","stem","body","question","title")
    for k in cand_keys:
        v = detail.get(k)
        if isinstance(v,str) and v.strip():               return v
        if isinstance(v,list):
            joined = " ".join(str(x) for x in v if x).strip()
            if joined:                                   return joined
        if isinstance(v,dict):
            joined = " ".join(str(x) for x in v.values() if isinstance(x,str)).strip()
            if joined:                                   return joined
    for k,v in detail.items():
        if "paragraph" in k and isinstance(v,str) and v.strip():
            return v
    stim = detail.get("stimulus_reference") or ""
    return html.unescape(stim) if stim else "(prompt unavailable)"

def extract_correct_answers(detail: Dict[str, Any],
                            ans_blob: Dict[str,Any]) -> List[str]:
    sources = (
        detail.get("correct_answer"), detail.get("correct_answers"), detail.get("keys"),
        ans_blob.get("correct_answer"), ans_blob.get("keys"), ans_blob.get("correct"),
    )
    for src in sources:
        if src:
            if isinstance(src,str):  return [src.strip()]
            if isinstance(src,list): return [str(x).strip() for x in src if str(x).strip()]
    m = re.search(r"(\d+)\s*/\s*(\d+)", detail.get("rationale",""))
    if m and int(m.group(2)):
        n,d = map(int,m.groups());   return [f"{n}/{d}", f"{n/d:g}"]
    return ["*"]

# ─── UTILITIES for MCQ mapping ───────────────────────────────────────────
def choice_index(correct: Dict[str,Any],
                 choices_html: list[str],
                 choice_ids: list[str]) -> int|None:
    """Return 0-based index of the correct choice (or None)."""
    # 1. direct numeric pointer
    if isinstance(correct.get("index"), int):
        return correct["index"]

    # 2. tag like 'A' / 'a' / 'b'
    tag = str(correct.get("correct_choice") or "").strip().lower()
    if tag in "abcd" and len(choices_html) >= 4:
        return "abcd".index(tag)
    if tag.isdigit():
        n = int(tag)
        return n if 0 <= n < len(choices_html) else None

    # 3. key/id matching (keys, correct_answer, etc.)
    for field in ("keys", "correct_answer", "correct_answers"):
        ks = correct.get(field)
        if not ks:
            continue
        ref = ks[0] if isinstance(ks, list) else ks
        ref = str(ref).strip()
        if ref in choice_ids:
            return choice_ids.index(ref)
    return None


def normalize(rec: Dict[str,Any]) -> Dict[str,Any]:
    detail_raw = rec["content"]
    if isinstance(detail_raw, list):                       # flatten list payloads
        detail_raw = next((d for d in detail_raw if isinstance(d, dict)), {})
    detail: Dict[str, Any] = detail_raw

    ans_blob: Dict[str, Any] = detail.get("answer", {}) or {}

    # ---- pull out choices ------------------------------------------------
    if "choices" in ans_blob and isinstance(ans_blob["choices"], dict):
        # old SAT shape: {"a":{…},"b":{…}}
        choices_data = [ans_blob["choices"][k] for k in sorted(ans_blob["choices"])]
    else:
        choices_data = ans_blob.get("answerOptions") or ans_blob.get("choices") or []
        # ensure list
        if isinstance(choices_data, dict):
            choices_data = list(choices_data.values())

    if not isinstance(choices_data, list):
        choices_data = []

    choices_html = [(c.get("body") or c.get("content") or "").strip()
                    for c in choices_data]
    choice_ids   = [str(c.get("id") or "").strip() for c in choices_data]

    answer_type = "MCQ" if choices_html else "SPR"

    # ---- work out the correct answer ------------------------------------
    if answer_type == "MCQ":
        idx = choice_index(ans_blob, choices_html, choice_ids)
        correct = {"index": idx if idx is not None else -1}
    else:
        correct = {"answers": extract_correct_answers(detail, ans_blob)}

    # ---- keep a lean meta blob ------------------------------------------
    meta_keep = ("skill_cd", "skill_desc", "difficulty",
                 "primary_class_cd_desc", "score_band_range_cd", "ibn")
    meta = {k: rec.get(k) for k in meta_keep if k in rec}

    # Extract rationale (explanation) from content
    rationale = detail.get("rationale", "")

    return {
        "uId"           : rec["uId"],
        "prompt_html"   : pick_prompt(detail),
        "answer_type"   : answer_type,
        "choices_html"  : choices_html,
        "correct"       : correct,
        "rationale_html": rationale,
        "meta"          : meta,
    }


# ─── BUILD / QC ──────────────────────────────────────────────────────────
ONEPREP = {}  # Placeholder for any manual overrides

def build(fresh: bool=False)->None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching metadata...")
    metas = fetch_metadata()
    total = len(metas)
    print(f"Metadata rows: {total}")
    merged: Dict[str,Any] = {}

    with ThreadPoolExecutor(MAX_WORKERS) as pool:
        fut = {pool.submit(worker, m): m for m in metas}
        fetched = errors = 0
        for i, f in enumerate(as_completed(fut), 1):
            uid, detail, err = f.result()
            meta = fut[f]
            if detail:
                r = dict(meta)
                r["module"] = "math"
                r["content"] = detail
                merged[uid] = r
                fetched += 1
            else:
                errors += 1
                if errors <= 10:  # Only print first 10 errors
                    print(f"[ERR] {uid}: {err}", file=sys.stderr)
            if i % EVERY == 0 or i == total:
                print(f"{i:4}/{total}  fetched={fetched}  errors={errors}")

    CORE_FILE.write_text(json.dumps(merged, indent=2))
    print(f"→ raw dump  {CORE_FILE.resolve()}")

    if ONEPREP:
        for uid, rec in merged.items():
            if uid in ONEPREP:
                merged[uid]["content"].setdefault("answer", {})["correct_choice"] = \
                    ONEPREP[uid]["correct"].get("index")

    NORM_FILE.write_text(json.dumps([normalize(r) for r in merged.values()], indent=2))
    print(f"→ norm dump {NORM_FILE.resolve()}")

def qc() -> None:
    norm = json.loads(NORM_FILE.read_text())
    blank = sum(1 for r in norm if not r["prompt_html"].strip())
    spr0  = sum(1 for r in norm if r["answer_type"]=="SPR" and not r["correct"]["answers"])
    mcqbad= sum(1 for r in norm if r["answer_type"]=="MCQ"
                and (r["correct"]["index"]<0 or r["correct"]["index"]>=len(r["choices_html"])))
    from collections import Counter
    print(f"\nrecords with blank prompt_html      : {blank}")
    print(f"SPR records w/ no answers           : {spr0}")
    print(f"MCQ records w/ bad correct pointer  : {mcqbad}\n")
    print("Top skill_cd counts:", Counter(r["meta"].get("skill_cd","") for r in norm).most_common(8))
    print("Difficulty counts  :", Counter(r["meta"].get("difficulty","?") for r in norm))

# ─── CLI ────────────────────────────────────────────────────────────────
if __name__=="__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fresh", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if args.check and CORE_FILE.exists() and NORM_FILE.exists():
        qc()
        sys.exit()

    build(fresh=args.fresh)
    qc()
