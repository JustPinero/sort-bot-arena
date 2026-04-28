#!/usr/bin/env bash
# PostToolUse hook: run prettier --write on supported files after Write/Edit.
# Silent on success; logs a one-line note if prettier isn't available.

set -euo pipefail

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
    file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')"
else
    file_path=""
fi

# Only format files prettier knows how to handle.
case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.html|*.css|*.scss|*.yaml|*.yml) ;;
    *) exit 0 ;;
esac

# Skip files outside the repo or in ignored paths.
case "$file_path" in
    */node_modules/*|*/dist/*|*/coverage/*|*/.vite/*|*/.vercel/*|*/pnpm-lock.yaml) exit 0 ;;
esac

# Prefer the repo-local prettier; fall back to a globally available one.
if command -v pnpm >/dev/null 2>&1 && [ -f "$(git rev-parse --show-toplevel 2>/dev/null)/package.json" ]; then
    pnpm exec prettier --write --log-level silent "$file_path" 2>/dev/null || true
elif command -v prettier >/dev/null 2>&1; then
    prettier --write --log-level silent "$file_path" 2>/dev/null || true
else
    echo "prettier not installed; skipping format on $file_path (run: pnpm install)" >&2
fi

exit 0
