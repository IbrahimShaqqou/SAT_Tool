#!/usr/bin/env bash
# generate_samples.sh
# Generates 1 explanation per SAT skill (29 total) for review.
# Usage: ANTHROPIC_API_KEY=sk-ant-... bash scripts/generate_samples.sh
#
# Run from backend/ directory.

set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set."
  echo "Usage: ANTHROPIC_API_KEY=sk-ant-... bash scripts/generate_samples.sh"
  exit 1
fi

FORCE_FLAG="${1:-}"

run() {
  local type=$1 skill=$2
  echo ">>> Generating: type=$type skill=$skill"
  python3 -m scripts.generate_explanations --type "$type" --skill "$skill" --limit 1 --apply $FORCE_FLAG
}

# ── Math (19 skills) ──────────────────────────────────────────────────────────
run math H.A.
run math H.B.
run math H.C.
run math H.D.
run math H.E.
run math P.A.
run math P.B.
run math P.C.
run math Q.A.
run math Q.B.
run math Q.C.
run math Q.D.
run math Q.E.
run math Q.F.
run math Q.G.
run math S.A.
run math S.B.
run math S.C.
run math S.D.

# ── Reading (8 skills) ────────────────────────────────────────────────────────
run reading CTC
run reading TSP
run reading WIC
run reading SYN
run reading TRA
run reading CID
run reading COE
run reading INF

# ── Grammar (2 skills) ────────────────────────────────────────────────────────
run grammar BOU
run grammar FSS

echo ""
echo "Done! 29 explanations generated (skipping any already in DB)."
