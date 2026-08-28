#!/usr/bin/env bash
# Copies the exported dossier from a career-ops checkout into
# aws-bot/server/app/data/, where dossier.py reads it from.
#
# Usage: ./sync-dossier.sh /path/to/career-ops
#
# Assumes career-ops' dossier/ has already been regenerated:
#   cd /path/to/career-ops && node export-dossier.mjs --payload <payload.json>

set -euo pipefail

CAREER_OPS_DIR="${1:?Usage: sync-dossier.sh /path/to/career-ops}"
SRC="$CAREER_OPS_DIR/dossier"
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/../server/app/data" && pwd -P 2>/dev/null || true)"
DEST="$(dirname "${BASH_SOURCE[0]}")/../server/app/data"

if [ ! -d "$SRC" ]; then
  echo "No dossier/ found at $SRC — run export-dossier.mjs in career-ops first." >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$SRC/facts.json" "$SRC/summary.txt" "$SRC/style.txt" "$SRC/dossier.md" "$DEST/"

echo "Synced dossier from $SRC to $DEST"
