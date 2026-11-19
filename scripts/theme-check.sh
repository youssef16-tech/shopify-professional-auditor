#!/usr/bin/env bash
# Theme source audit: runs Shopify CLI Theme Check on a LOCAL theme directory (read-only)
# and converts the offenses into audit records (category "technical").
# usage: bash theme-check.sh THEME_DIR OUT [--retest]
set -u
THEME="${1:-}"; OUT="${2:-}"
if [ -z "$THEME" ] || [ -z "$OUT" ]; then echo "usage: bash theme-check.sh THEME_DIR OUT [--retest]" >&2; exit 64; fi
shift 2
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EV="$OUT/evidence/technical"
mkdir -p "$EV" "$OUT/results"

if [ ! -d "$THEME" ]; then
  node "$HERE/lib/theme-check-results.mjs" --out "$OUT" --theme "$THEME" --error "Theme directory not found" "$@"; exit 1
fi
if ! command -v shopify >/dev/null 2>&1; then
  node "$HERE/lib/theme-check-results.mjs" --out "$OUT" --theme "$THEME" --error "Shopify CLI is not installed or not on PATH" "$@"; exit 1
fi

# A non-zero exit is normal when offenses exist; the JSON on stdout is what matters.
SHOPIFY_CLI_NO_ANALYTICS=1 shopify theme check --path "$THEME" --output json > "$EV/theme-check.json" 2> "$EV/theme-check.stderr.txt"
CODE=$?
node "$HERE/lib/theme-check-results.mjs" --out "$OUT" --theme "$THEME" --exit "$CODE" "$@"
