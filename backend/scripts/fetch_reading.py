#!/usr/bin/env python3
"""
Fast fetch + full normalisation of SAT-Reading data
   → data/reading_core.json   (raw)
   → data/reading_norm.json   (clean, ML-ready)

The normaliser populates:
    prompt_html, choices_html, answer_type, correct

answer_type:
    "MCQ"  -> correct = {"index": int}
    "SPR"  -> correct = {"answers": [str, …]}

If you only want to refresh the raw file, use --raw
"""

from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Tuple
import argparse, json, sys, threading, time, random
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ── ENDPOINTS ──────────────────────────────────────────────────────────
BASE        = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital"
META_URL    = f"{BASE}/get-questions"
DETAIL_URL  = f"{BASE}/get-question"

# ── CONSTANTS ──────────────────────────────────────────────────────────
PAYLOAD_META = {"asmtEventId": 99, "test": 1, "domain": "INI,CAS,EOI,SEC"}

# Browser-like headers to avoid 403
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": "https://satsuitequestionbank.collegeboard.org",
    "Referer": "https://satsuitequestionbank.collegeboard.org/",
}

DATA_DIR     = Path("data")
CORE_FILE    = DATA_DIR / "reading_core.json"
NORM_FILE    = DATA_DIR / "reading_norm.json"

MAX_WORKERS      = 5   # Reduced to avoid rate limiting
TIMEOUT          = 30
PROGRESS_EVERY   = 50
DELAY_MIN        = 0.1  # Min delay between requests
DELAY_MAX        = 0.3  # Max delay between requests
# ───────────────────────────────────────────────────────────────────────

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

# ───────────────────────────────────────────────────────────────────────
# helpers ----------------------------------------------------------------

def external_id(meta: Dict[str,Any]) -> str|None:
    for k in ("external_id","externalId","externalid"):
        v = meta.get(k)
        if v: return str(v)
    return None

def letter_to_index(letter: str) -> int|None:
    letter = letter.strip().upper()
    if len(letter)==1 and "A" <= letter <= "Z":
        return ord(letter) - ord("A")
    return None

# ───────────────────────────────────────────────────────────────────────
# fetch phase -----------------------------------------------------------

def fetch_metadata() -> List[Dict[str,Any]]:
    s = create_session()
    r = s.post(META_URL, json=PAYLOAD_META, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def fetch_detail(meta: Dict[str,Any]) -> Tuple[str|None,Dict[str,Any]|None,str|None]:
    uid = meta.get("uId") or meta.get("questionId")
    ext = external_id(meta)

    # Add small random delay to avoid rate limiting
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    if not ext:
        return (uid, None, "missing external_id")
    try:
        r = session().post(DETAIL_URL, json={"external_id": ext}, timeout=TIMEOUT)
        r.raise_for_status()
        return (uid, r.json(), None)
    except requests.RequestException as exc:
        code = getattr(exc.response, "status_code", "??") if hasattr(exc, 'response') else "??"
        return (uid, None, f"{code} {exc}")

# ───────────────────────────────────────────────────────────────────────
# normalisation ---------------------------------------------------------

def extract_mcq_correct(detail: Dict[str,Any]) -> Dict[str,Any]:
    """
    Return {'index': int} or raise ValueError
    """
    opts : List[Dict[str,Any]] = detail.get("answerOptions") or []
    # 1) by letter in 'correct_answer'
    letters = detail.get("correct_answer") or detail.get("correctChoice")
    if isinstance(letters,list) and letters:
        idx = letter_to_index(str(letters[0]))
        if idx is not None:
            return {"index": idx}

    # 2) by UUID in 'keys'
    keys = detail.get("keys") or detail.get("key") or []
    if isinstance(keys,list) and keys:
        key0 = keys[0]
        for i,opt in enumerate(opts):
            if opt.get("id")==key0:
                return {"index": i}

    raise ValueError("MCQ correct answer not found")

def extract_spr_correct(detail: Dict[str,Any]) -> Dict[str,Any]:
    for k in ("correct_answer","keys","answers"):
        v = detail.get(k)
        if v:
            # flatten and stringify
            answers = [str(x).strip() for x in (v if isinstance(v,list) else [v])]
            return {"answers": answers}
    raise ValueError("SPR answers missing")

def normalize(rec: Dict[str,Any]) -> Dict[str,Any]:
    out : Dict[str,Any] = {
        "uId"  : rec["uId"],
        "meta" : {k:v for k,v in rec.items() if k not in ("content","module")},
        "prompt_html" : None,
        "answer_type" : None,
        "choices_html": [],
        "correct"     : {}
    }
    detail = rec["content"]
    # prompt
    out["prompt_html"] = detail.get("stem") or detail.get("prompt") or detail.get("question") or ""
    # choices & answer
    if detail.get("type","").lower() == "mcq":
        out["answer_type"] = "MCQ"
        out["choices_html"] = [c.get("content","") for c in (detail.get("answerOptions") or [])]
        out["correct"] = extract_mcq_correct(detail)
    else:
        # treat everything else (table fill-ins, two-part etc.) as SPR
        out["answer_type"] = "SPR"
        out["correct"] = extract_spr_correct(detail)
    return out

# ───────────────────────────────────────────────────────────────────────
# main ------------------------------------------------------------------

def build(fresh: bool, raw_only: bool) -> None:
    DATA_DIR.mkdir(exist_ok=True)

    if fresh or not CORE_FILE.exists():
        print("Fetching metadata...")
        metas = fetch_metadata()
        total = len(metas)
        print(f"Metadata rows: {total}")
        merged : Dict[str,Dict[str,Any]] = {}
        fetched = skipped = errors = 0
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            fut_to_meta = {pool.submit(fetch_detail, m): m for m in metas}
            for i, fut in enumerate(as_completed(fut_to_meta), 1):
                uid, detail, err = fut.result()
                meta = fut_to_meta[fut]
                if detail:
                    rec = dict(meta)
                    rec["module"] = "reading"
                    rec["content"] = detail
                    merged[str(uid)] = rec
                    fetched += 1
                elif err == "missing external_id":
                    skipped += 1
                else:
                    errors += 1
                    if errors <= 10:  # Only print first 10 errors
                        print(f"[ERROR] {uid}: {err}", file=sys.stderr)
                if i % PROGRESS_EVERY == 0 or i == total:
                    print(f"{i}/{total}  fetched={fetched}  errors={errors}")
        CORE_FILE.write_text(json.dumps(merged, indent=2))
        print(f"→ raw dump  {CORE_FILE}")
    else:
        merged = json.loads(CORE_FILE.read_text())

    if raw_only:
        return

    # ---- normalise -----------------------------------------------------
    norm : List[Dict[str,Any]] = []
    bad_pointer = 0
    for rec in merged.values():
        try:
            norm.append(normalize(rec))
        except Exception as exc:
            bad_pointer += 1
            if bad_pointer <= 10:
                print(f"[WARN] {rec['uId']} normalise failed: {exc}", file=sys.stderr)
    NORM_FILE.write_text(json.dumps(norm, indent=2))
    print(f"→ norm dump {NORM_FILE}")

    # quick stats
    blank_prompt = sum(1 for r in norm if not r["prompt_html"])
    spr_no_ans   = sum(1 for r in norm if r["answer_type"]=="SPR" and not r["correct"].get("answers"))
    mcq_bad      = bad_pointer
    print(f"\nrecords with blank prompt_html      : {blank_prompt}")
    print(f"SPR records w/ no answers           : {spr_no_ans}")
    print(f"MCQ records w/ bad correct pointer  : {mcq_bad}")

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fresh", action="store_true", help="re-download everything")
    ap.add_argument("--raw",   action="store_true", help="only build reading_core.json")
    args = ap.parse_args()
    build(fresh=args.fresh, raw_only=args.raw)

if __name__ == "__main__":
    main()
