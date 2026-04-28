#!/usr/bin/env bash
# Regenerate src/api/types.ts from the sort-bot-api OpenAPI spec.
# Default: read from ../sort-bot-api/references/openapi.yaml.
# Override: BACKEND_REPO=/path/to/sort-bot-api ./scripts/generate-api-types.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_REPO="${BACKEND_REPO:-$ROOT_DIR/../sort-bot-api}"
SPEC="$BACKEND_REPO/references/openapi.yaml"
OUT="src/api/types.ts"

if [ ! -f "$SPEC" ]; then
    echo "openapi spec not found at $SPEC" >&2
    echo "set BACKEND_REPO to override, or check out sort-bot-api as a sibling repo." >&2
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not installed." >&2
    exit 1
fi

mkdir -p "$(dirname "$OUT")"

echo "Generating $OUT from $SPEC ..."
pnpm exec openapi-typescript "$SPEC" -o "$OUT"

echo "Done."
