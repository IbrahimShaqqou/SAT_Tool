#!/usr/bin/env python3
"""
ai_audit_cache.py

Uses Claude to audit all alt-text → LaTeX translations in math_alt_cache.json.
Identifies incorrect translations and generates corrected LaTeX.

Steps:
  1. Load cache (2914 entries)
  2. Filter to non-trivial translations (alt != latex, len > threshold)
  3. Submit to Claude via Batches API for validation
  4. Poll until complete
  5. For flagged bad translations, submit correction batch
  6. Update math_alt_cache.json with corrections
  7. Run --repatch to apply DB corrections

Usage:
    cd backend/
    python -m scripts.ai_audit_cache                    # Full audit
    python -m scripts.ai_audit_cache --dry-run          # Show what would be sent
    python -m scripts.ai_audit_cache --poll <batch_id>  # Poll existing batch
    python -m scripts.ai_audit_cache --apply <json>     # Apply corrections file
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import anthropic

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "math_alt_cache.json"
CORRECTIONS_FILE = DATA_DIR / "ai_audit_corrections.json"

MODEL = "claude-haiku-4-5-20251001"  # Cheapest, fast, good at math validation

SYSTEM_PROMPT = """You are a math LaTeX validator. You will be given College Board SAT math alt-text descriptions (English descriptions of math expressions that appear in SAT questions) paired with their automated LaTeX translations.

Your job is to determine if the LaTeX translation is CORRECT or INCORRECT.

Rules:
- The alt text uses College Board's verbal description format (e.g., "x to the second power" = x², "the fraction 3 over 4" = 3/4)
- The LaTeX should faithfully represent the math expression described
- Minor formatting differences are OK (e.g., \\times vs ·, spaces)
- \\ percent (\\%) is correct for "percent"
- Chained inequalities like "0 < a < b" are correct for "0 is less than a, which is less than b"
- Text descriptions that are full sentences (not just math) may produce text-like LaTeX output — that's acceptable

Respond with ONLY a JSON object:
{"correct": true}  or  {"correct": false, "corrected": "THE_CORRECT_LATEX_HERE"}

When providing corrected LaTeX:
- Use standard LaTeX math syntax
- Do NOT wrap in \\( \\) delimiters
- Use \\frac{}{}, \\sqrt{}, ^{}, _{}, \\times, \\leq, \\geq, \\neq, \\approx, \\%, etc.
- Keep it minimal — just the math expression"""


def load_cache() -> dict[str, str]:
    return json.loads(CACHE_FILE.read_text())


def save_cache(cache: dict[str, str]) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def interesting_entries(cache: dict[str, str]) -> list[tuple[str, str]]:
    """Filter to non-trivial translations worth auditing."""
    results = []
    for alt, latex in cache.items():
        # Skip trivial identity translations (single tokens, numbers, simple vars)
        if alt == latex:
            continue
        if len(alt) < 15:
            continue
        # Skip pure text descriptions (sentences with no math operators)
        if not re.search(r"[=+\-*/^]|\\frac|\\sqrt|\\times|\\leq|\\geq|\\neq|\\approx|\^{|_{|\\%", latex):
            # Might still be interesting if alt mentions math words
            if not re.search(r"\b(fraction|power|squared|cubed|root|equals|plus|minus|times|over)\b", alt, re.I):
                continue
        results.append((alt, latex))
    return results


def make_validation_request(custom_id: str, alt: str, latex: str) -> dict[str, Any]:
    """Create a single batch request for validating one translation."""
    return {
        "custom_id": custom_id,
        "params": {
            "model": MODEL,
            "max_tokens": 200,
            "system": SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": f"Alt text: {alt}\nLaTeX: {latex}"
                }
            ]
        }
    }


def make_correction_request(custom_id: str, alt: str, bad_latex: str) -> dict[str, Any]:
    """Create a batch request to get correct LaTeX for a bad translation."""
    return {
        "custom_id": custom_id,
        "params": {
            "model": MODEL,
            "max_tokens": 300,
            "system": SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": f"Alt text: {alt}\nLaTeX: {bad_latex}"
                },
                {
                    "role": "assistant",
                    "content": '{"correct": false, "corrected": "'
                }
            ]
        }
    }


def make_forced_correction_request(custom_id: str, alt: str, bad_latex: str) -> dict[str, Any]:
    """More explicit correction request for stubborn entries that didn't respond to the first pass."""
    return {
        "custom_id": custom_id,
        "params": {
            "model": "claude-sonnet-4-5-20251001",  # Upgrade to Sonnet for hard cases
            "max_tokens": 400,
            "system": SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"The following LaTeX translation is INCORRECT and must be fixed.\n\n"
                        f"Alt text: {alt}\n"
                        f"Bad LaTeX: {bad_latex}\n\n"
                        f"Provide ONLY the corrected LaTeX string (no delimiters, no explanation). "
                        f"Respond with valid JSON: {{\"correct\": false, \"corrected\": \"LATEX_HERE\"}}"
                    )
                }
            ]
        }
    }


def submit_batch(client: anthropic.Anthropic, requests: list[dict]) -> str:
    """Submit a batch and return its ID."""
    batch = client.messages.batches.create(requests=requests)
    return batch.id


def poll_batch(client: anthropic.Anthropic, batch_id: str, interval: int = 30) -> list[dict]:
    """Poll until batch completes, return results."""
    print(f"Polling batch {batch_id}...")
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        status = batch.processing_status
        counts = batch.request_counts
        print(f"  Status: {status} | "
              f"Processing: {counts.processing} | "
              f"Succeeded: {counts.succeeded} | "
              f"Errored: {counts.errored}")

        if status == "ended":
            break
        time.sleep(interval)

    # Collect results
    results = []
    for result in client.messages.batches.results(batch_id):
        results.append(result)
    return results


def poll_batches_parallel(client: anthropic.Anthropic, batch_ids: list[str], interval: int = 30) -> dict[str, list]:
    """Poll multiple batches in parallel until all complete. Returns {batch_id: [results]}."""
    pending = set(batch_ids)
    done: dict[str, list] = {}

    while pending:
        time.sleep(interval)
        still_pending = set()
        for batch_id in pending:
            try:
                batch = client.messages.batches.retrieve(batch_id)
            except Exception as e:
                print(f"  [{batch_id[-8:]}] retrieve error ({e}), will retry...")
                still_pending.add(batch_id)
                continue
            counts = batch.request_counts
            print(f"  [{batch_id[-8:]}] {batch.processing_status} | "
                  f"Processing: {counts.processing} | "
                  f"Succeeded: {counts.succeeded} | "
                  f"Errored: {counts.errored}")
            if batch.processing_status == "ended":
                for attempt in range(3):
                    try:
                        results = [r for r in client.messages.batches.results(batch_id)]
                        done[batch_id] = results
                        break
                    except Exception as e:
                        if attempt < 2:
                            print(f"  [{batch_id[-8:]}] results fetch error ({e}), retrying ({attempt+1}/3)...")
                            time.sleep(5)
                        else:
                            print(f"  [{batch_id[-8:]}] results fetch failed after 3 attempts, skipping.")
                            done[batch_id] = []
            else:
                still_pending.add(batch_id)
        pending = still_pending
        if pending:
            print(f"  ({len(done)}/{len(batch_ids)} batches done, waiting on {len(pending)} more...)")

    print(f"  All {len(batch_ids)} batches complete.")
    return done


def parse_validation_result(result: Any) -> tuple[bool, str | None]:
    """Parse a validation batch result. Returns (is_correct, corrected_latex)."""
    if result.result.type != "succeeded":
        return True, None  # Treat errors as OK to avoid false positives

    content = result.result.message.content
    if not content:
        return True, None

    text = content[0].text if hasattr(content[0], "text") else str(content[0])
    return parse_response_text(text)


def parse_response_text(text: str) -> tuple[bool, str | None]:
    """Parse a raw text response from the model. Returns (is_correct, corrected_latex)."""
    try:
        text = text.strip()
        if not text.startswith("{"):
            text = '{"correct": false, "corrected": "' + text
        if not text.endswith("}"):
            if '"corrected"' in text and not text.endswith('"}'):
                text = text.rstrip('",') + '"}'
        data = json.loads(text)
        is_correct = data.get("correct", True)
        corrected = data.get("corrected")
        return is_correct, corrected
    except json.JSONDecodeError:
        m = re.search(r'"correct"\s*:\s*(true|false)', text, re.I)
        if m and m.group(1).lower() == "false":
            corr_m = re.search(r'"corrected"\s*:\s*"(.+?)"(?:\s*})?$', text)
            corrected = corr_m.group(1) if corr_m else None
            return False, corrected
        return True, None


def call_api(client: anthropic.Anthropic, model: str, system: str,
             messages: list[dict], max_tokens: int = 200,
             retries: int = 3) -> str | None:
    """Call the API directly with retry/backoff. Returns response text or None."""
    for attempt in range(retries):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            return resp.content[0].text if resp.content else None
        except anthropic.RateLimitError:
            wait = 2 ** attempt
            time.sleep(wait)
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                return None
    return None


class Progress:
    """Thread-safe progress tracker with live display."""

    def __init__(self, total: int, label: str):
        self.total = total
        self.label = label
        self._done = 0
        self._bad = 0
        self._corrected = 0
        self._lock = threading.Lock()
        self._start = time.time()
        self._last_print = 0.0

    def update(self, bad: bool = False, corrected: bool = False) -> None:
        with self._lock:
            self._done += 1
            if bad:
                self._bad += 1
            if corrected:
                self._corrected += 1
            now = time.time()
            if now - self._last_print >= 2.0 or self._done == self.total:
                elapsed = now - self._start
                rate = self._done / elapsed if elapsed > 0 else 0
                eta = (self.total - self._done) / rate if rate > 0 else 0
                print(
                    f"\r  {self.label}: {self._done}/{self.total} "
                    f"| bad: {self._bad} | corrected: {self._corrected} "
                    f"| {rate:.1f}/s | ETA: {eta:.0f}s   ",
                    end="", flush=True
                )
                self._last_print = now

    def done(self) -> None:
        elapsed = time.time() - self._start
        print(
            f"\r  {self.label}: {self._done}/{self.total} done "
            f"| bad: {self._bad} | corrected: {self._corrected} "
            f"| {elapsed:.1f}s total              "
        )


def cmd_audit_parallel(client: anthropic.Anthropic, cache: dict, workers: int = 50) -> None:
    """Audit using direct parallel API calls — no batches, immediate results."""
    entries = interesting_entries(cache)
    print(f"Auditing {len(entries)} entries with {workers} parallel workers...")

    all_bad: dict[str, tuple[str, str]] = {}   # alt → (alt, bad_latex)
    all_corrections: dict[str, str] = {}        # alt → corrected_latex
    lock = threading.Lock()

    # --- Phase 1: Validate all entries in parallel ---
    print(f"\nPhase 1: Validating {len(entries)} entries...")
    prog = Progress(len(entries), "Validating")

    def validate(alt: str, latex: str) -> tuple[str, str, bool, str | None]:
        text = call_api(client, MODEL, SYSTEM_PROMPT, [
            {"role": "user", "content": f"Alt text: {alt}\nLaTeX: {latex}"}
        ], max_tokens=200)
        if text is None:
            return alt, latex, True, None
        is_correct, corrected = parse_response_text(text)
        return alt, latex, is_correct, corrected

    needs_correction: list[tuple[str, str]] = []  # (alt, bad_latex) without inline correction

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(validate, alt, latex): (alt, latex) for alt, latex in entries}
        for fut in as_completed(futures):
            alt, latex, is_correct, corrected = fut.result()
            bad = not is_correct
            got_correction = bad and corrected is not None
            prog.update(bad=bad, corrected=got_correction)
            if bad:
                with lock:
                    all_bad[alt] = (alt, latex)
                    if corrected:
                        all_corrections[alt] = corrected
                    else:
                        needs_correction.append((alt, latex))

    prog.done()
    print(f"  Found {len(all_bad)} bad translations "
          f"({len(all_corrections)} with inline corrections, "
          f"{len(needs_correction)} need correction pass)")

    # --- Phase 2: Get corrections for ones that need it ---
    if needs_correction:
        print(f"\nPhase 2: Correcting {len(needs_correction)} entries (Haiku)...")
        prog2 = Progress(len(needs_correction), "Correcting")
        still_no_correction: list[tuple[str, str]] = []

        def correct_haiku(alt: str, bad_latex: str) -> tuple[str, str | None]:
            text = call_api(client, MODEL, SYSTEM_PROMPT, [
                {"role": "user",  "content": f"Alt text: {alt}\nLaTeX: {bad_latex}"},
                {"role": "assistant", "content": '{"correct": false, "corrected": "'},
            ], max_tokens=300)
            if text is None:
                return alt, None
            _, corrected = parse_response_text('{"correct": false, "corrected": "' + text)
            return alt, corrected

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures2 = {ex.submit(correct_haiku, alt, bad): (alt, bad)
                        for alt, bad in needs_correction}
            for fut in as_completed(futures2):
                alt, corrected = fut.result()
                got = corrected is not None
                prog2.update(corrected=got)
                with lock:
                    if corrected:
                        all_corrections[alt] = corrected
                    else:
                        bad_latex = all_bad[alt][1]
                        still_no_correction.append((alt, bad_latex))

        prog2.done()

        # --- Phase 2b: Sonnet for stubborn ones ---
        if still_no_correction:
            print(f"\nPhase 2b: Forcing corrections for {len(still_no_correction)} stubborn entries (Sonnet)...")
            prog3 = Progress(len(still_no_correction), "Forced")
            SONNET = "claude-sonnet-4-5-20251001"

            def correct_sonnet(alt: str, bad_latex: str) -> tuple[str, str | None]:
                text = call_api(client, SONNET, SYSTEM_PROMPT, [
                    {"role": "user", "content": (
                        f"The following LaTeX translation is INCORRECT and must be fixed.\n\n"
                        f"Alt text: {alt}\nBad LaTeX: {bad_latex}\n\n"
                        f"Respond with valid JSON: "
                        f'{{\"correct\": false, \"corrected\": \"LATEX_HERE\"}}'
                    )}
                ], max_tokens=400)
                if text is None:
                    return alt, None
                _, corrected = parse_response_text(text)
                return alt, corrected

            with ThreadPoolExecutor(max_workers=min(workers, 20)) as ex:
                futures3 = {ex.submit(correct_sonnet, alt, bad): alt
                            for alt, bad in still_no_correction}
                for fut in as_completed(futures3):
                    alt, corrected = fut.result()
                    prog3.update(corrected=corrected is not None)
                    with lock:
                        if corrected:
                            all_corrections[alt] = corrected

            prog3.done()

    # --- Save & apply ---
    print(f"\n{'='*60}")
    print(f"Total bad: {len(all_bad)} | Corrections: {len(all_corrections)}")

    if all_corrections:
        CORRECTIONS_FILE.write_text(json.dumps(all_corrections, ensure_ascii=False, indent=2))
        print(f"Corrections saved to {CORRECTIONS_FILE}")

        applied = 0
        for alt, corrected in all_corrections.items():
            if alt in cache and cache[alt] != corrected:
                old = cache[alt]
                cache[alt] = corrected
                print(f"  FIXED: {alt[:50]!r}")
                print(f"    OLD: {old!r}")
                print(f"    NEW: {corrected!r}")
                applied += 1

        save_cache(cache)
        print(f"\nCache updated with {applied} corrections.")
        print("Run: python -m scripts.normalize_questions --repatch")
    else:
        print("No corrections needed — cache looks good!")


def cmd_dry_run(cache: dict) -> None:
    entries = interesting_entries(cache)
    print(f"Would audit {len(entries)} / {len(cache)} entries")
    print("\nSample entries to be audited:")
    for alt, latex in entries[:10]:
        print(f"  ALT: {alt[:70]!r}")
        print(f"  LAT: {latex[:70]!r}")
        print()


def cmd_audit(client: anthropic.Anthropic, cache: dict, batch_size: int = 100) -> None:
    entries = interesting_entries(cache)
    print(f"Auditing {len(entries)} entries in batches of {batch_size}...")

    all_bad: dict[str, tuple[str, str]] = {}  # custom_id → (alt, bad_latex)
    all_corrections: dict[str, str] = {}       # alt → corrected_latex

    # Build all chunks
    chunks: list[tuple[int, list[tuple[str, str]]]] = []
    for chunk_start in range(0, len(entries), batch_size):
        chunks.append((chunk_start, entries[chunk_start:chunk_start + batch_size]))

    # --- Phase 1: Submit ALL validation batches upfront, then poll in parallel ---
    print(f"\nSubmitting {len(chunks)} validation batches in parallel...")
    chunk_by_batch: dict[str, tuple[int, list]] = {}  # batch_id → (chunk_start, chunk)
    for chunk_start, chunk in chunks:
        requests = [
            make_validation_request(f"v_{chunk_start + i}", alt, latex)
            for i, (alt, latex) in enumerate(chunk)
        ]
        batch_id = submit_batch(client, requests)
        chunk_by_batch[batch_id] = (chunk_start, chunk)
        print(f"  Submitted batch {chunk_start}–{chunk_start + len(chunk) - 1}: {batch_id}")

    print(f"\nPolling {len(chunk_by_batch)} validation batches...")
    val_results_by_batch = poll_batches_parallel(client, list(chunk_by_batch.keys()))

    # Process validation results
    needs_correction: list[tuple[str, str, str]] = []  # (cid, alt, bad_latex)
    for batch_id, results in val_results_by_batch.items():
        chunk_start, chunk = chunk_by_batch[batch_id]
        for result in results:
            idx = int(result.custom_id.split("_")[1]) - chunk_start
            if idx < 0 or idx >= len(chunk):
                continue
            alt, bad_latex = chunk[idx]
            is_correct, corrected = parse_validation_result(result)
            if not is_correct:
                cid = result.custom_id
                all_bad[cid] = (alt, bad_latex)
                if corrected:
                    all_corrections[alt] = corrected
                else:
                    needs_correction.append((cid, alt, bad_latex))

    print(f"\nValidation complete: {len(all_bad)} bad translations found "
          f"({len(all_corrections)} already have corrections, "
          f"{len(needs_correction)} need a correction pass)")

    # --- Phase 2: Submit ALL correction batches upfront, then poll in parallel ---
    if needs_correction:
        print(f"\nSubmitting correction batches for {len(needs_correction)} entries...")
        corr_chunk_by_batch: dict[str, list[tuple[str, str, str]]] = {}
        for corr_chunk_start in range(0, len(needs_correction), batch_size):
            corr_chunk = needs_correction[corr_chunk_start:corr_chunk_start + batch_size]
            corr_requests = [
                make_correction_request(cid, alt, bad_latex)
                for cid, alt, bad_latex in corr_chunk
            ]
            corr_batch_id = submit_batch(client, corr_requests)
            corr_chunk_by_batch[corr_batch_id] = corr_chunk
            print(f"  Submitted correction batch {corr_chunk_start}–{corr_chunk_start + len(corr_chunk) - 1}: {corr_batch_id}")

        print(f"\nPolling {len(corr_chunk_by_batch)} correction batches...")
        corr_results_by_batch = poll_batches_parallel(client, list(corr_chunk_by_batch.keys()))

        still_no_correction: list[tuple[str, str, str]] = []
        for corr_batch_id, corr_results in corr_results_by_batch.items():
            for result in corr_results:
                cid = result.custom_id
                if cid not in all_bad:
                    continue
                alt, bad_latex = all_bad[cid]
                _, corrected = parse_validation_result(result)
                if corrected:
                    all_corrections[alt] = corrected
                else:
                    still_no_correction.append((cid, alt, bad_latex))

        # --- Phase 2b: Retry stubborn entries with a stronger prompt (Sonnet) ---
        if still_no_correction:
            print(f"\n  {len(still_no_correction)} entries had no correction — retrying with stronger prompt (Sonnet)...")
            forced_chunk_by_batch: dict[str, list[tuple[str, str, str]]] = {}
            for fc_start in range(0, len(still_no_correction), batch_size):
                fc_chunk = still_no_correction[fc_start:fc_start + batch_size]
                fc_requests = [
                    make_forced_correction_request(cid, alt, bad_latex)
                    for cid, alt, bad_latex in fc_chunk
                ]
                fc_batch_id = submit_batch(client, fc_requests)
                forced_chunk_by_batch[fc_batch_id] = fc_chunk
                print(f"  Submitted forced correction batch {fc_start}–{fc_start + len(fc_chunk) - 1}: {fc_batch_id}")

            print(f"\nPolling {len(forced_chunk_by_batch)} forced correction batches...")
            forced_results_by_batch = poll_batches_parallel(client, list(forced_chunk_by_batch.keys()))

            recovered = 0
            for fc_batch_id, fc_results in forced_results_by_batch.items():
                for result in fc_results:
                    cid = result.custom_id
                    if cid not in all_bad:
                        continue
                    alt, _ = all_bad[cid]
                    _, corrected = parse_validation_result(result)
                    if corrected:
                        all_corrections[alt] = corrected
                        recovered += 1
            print(f"  Recovered {recovered} additional corrections via forced retry.")

    print(f"\n{'='*60}")
    print(f"Total bad translations found: {len(all_bad)}")
    print(f"Corrections obtained: {len(all_corrections)}")

    if all_corrections:
        # Save corrections
        CORRECTIONS_FILE.write_text(
            json.dumps(all_corrections, ensure_ascii=False, indent=2)
        )
        print(f"Corrections saved to {CORRECTIONS_FILE}")

        # Apply to cache
        for alt, corrected in all_corrections.items():
            if alt in cache:
                old = cache[alt]
                cache[alt] = corrected
                print(f"  FIXED: {alt[:50]!r}")
                print(f"    OLD: {old!r}")
                print(f"    NEW: {corrected!r}")

        save_cache(cache)
        print(f"\nCache updated with {len(all_corrections)} corrections.")
        print("Run: python -m scripts.normalize_questions --repatch")
    else:
        print("No corrections needed — cache looks good!")


def cmd_poll(client: anthropic.Anthropic, batch_id: str) -> None:
    """Poll an existing batch and show results."""
    results = poll_batch(client, batch_id, interval=10)
    bad = []
    for result in results:
        is_correct, corrected = parse_validation_result(result)
        if not is_correct:
            bad.append((result.custom_id, corrected))

    print(f"\nResults: {len(results)} total, {len(bad)} flagged as incorrect")
    for cid, corrected in bad[:20]:
        print(f"  {cid}: corrected → {corrected!r}")


def cmd_apply(cache: dict, corrections_file: str) -> None:
    """Apply a previously generated corrections JSON to the cache."""
    corrections = json.loads(Path(corrections_file).read_text())
    applied = 0
    for alt, corrected in corrections.items():
        if alt in cache and cache[alt] != corrected:
            old = cache[alt]
            cache[alt] = corrected
            print(f"  {alt[:50]!r}")
            print(f"    {old!r} → {corrected!r}")
            applied += 1

    save_cache(cache)
    print(f"\nApplied {applied} corrections to cache.")
    print("Run: python -m scripts.normalize_questions --repatch")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI audit of math alt-text → LaTeX cache")
    parser.add_argument("--dry-run",    action="store_true", help="Show what would be audited")
    parser.add_argument("--poll",       metavar="BATCH_ID",  help="Poll existing batch")
    parser.add_argument("--apply",      metavar="JSON_FILE", help="Apply corrections file")
    parser.add_argument("--batch-size", type=int, default=100, help="Entries per API batch (legacy)")
    parser.add_argument("--workers",    type=int, default=50,  help="Parallel workers for direct API mode")
    parser.add_argument("--use-batches", action="store_true", help="Use Batches API instead of direct parallel calls")
    args = parser.parse_args()

    cache = load_cache()

    if args.dry_run:
        cmd_dry_run(cache)
        return

    if args.apply:
        cmd_apply(cache, args.apply)
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    if args.poll:
        cmd_poll(client, args.poll)
        return

    if args.use_batches:
        cmd_audit(client, cache, batch_size=args.batch_size)
    else:
        cmd_audit_parallel(client, cache, workers=args.workers)


if __name__ == "__main__":
    main()
