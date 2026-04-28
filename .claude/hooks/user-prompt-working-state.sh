#!/usr/bin/env bash
# UserPromptSubmit hook: append a short working-state summary to the agent context
# so each prompt starts with grounded awareness of the repo state.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
status="$(git status --short 2>/dev/null | head -10 || true)"
last_commit="$(git log -1 --pretty='%h %s' 2>/dev/null || echo none)"

cat <<EOF
[working-state]
branch:       $branch
last commit:  $last_commit
EOF

if [ -n "$status" ]; then
    echo "uncommitted:"
    echo "$status" | sed 's/^/  /'
fi

exit 0
