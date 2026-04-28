#!/usr/bin/env bash
# PostToolUse hook: run eslint with jsx-a11y on .tsx writes; warn on violations.
# Non-blocking — surfaces issues early without halting the agent loop.

set -euo pipefail

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
    file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')"
else
    file_path=""
fi

case "$file_path" in
    *.tsx) ;;
    *) exit 0 ;;
esac

case "$file_path" in
    */node_modules/*|*/dist/*|*/coverage/*) exit 0 ;;
esac

if ! command -v pnpm >/dev/null 2>&1; then
    exit 0
fi

# Only run if eslint is installed in the project.
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ ! -f "$repo_root/node_modules/.bin/eslint" ]; then
    exit 0
fi

output="$(pnpm exec eslint --rulesdir <(true) --no-eslintrc --config .eslintrc.cjs --rule '{"jsx-a11y/recommended": "error"}' "$file_path" 2>&1 || true)"
# Above is best-effort; eslint with overlapping configs is fragile.
# Simpler path: just run the project's eslint config and surface jsx-a11y messages.
output="$(pnpm exec eslint "$file_path" 2>&1 || true)"

if printf '%s' "$output" | grep -qiE 'jsx-a11y|axe'; then
    echo "[a11y] eslint flagged jsx-a11y issues in $file_path:" >&2
    printf '%s\n' "$output" | grep -iE 'jsx-a11y|axe' | head -10 >&2
fi

exit 0
