#!/usr/bin/env bash
# PreToolUse hook: reject Write/Edit attempts that contain obvious secret patterns.
# Reads the tool input as JSON on stdin; exits non-zero with a message to abort the call.

set -euo pipefail

input="$(cat)"

# Try jq, fall back to grep on the raw blob if jq isn't installed.
if command -v jq >/dev/null 2>&1; then
    payload="$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""' 2>/dev/null || true)"
else
    payload="$input"
fi

# Patterns that should never appear in committed source.
patterns=(
    'sk_live_[a-f0-9]{32,}'
    'sk-ant-[A-Za-z0-9_-]{10,}'
    'AKIA[0-9A-Z]{16}'
    'AIza[0-9A-Za-z_-]{35}'
    '-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----'
    'xox[baprs]-[A-Za-z0-9-]{10,}'
    'leonardo_api_key="[A-Za-z0-9_-]{20,}"'
)

for pat in "${patterns[@]}"; do
    if printf '%s' "$payload" | grep -qE "$pat"; then
        echo "BLOCKED: write contains a pattern matching a secret (${pat})." >&2
        echo "If this is a placeholder or example, redact it before writing." >&2
        exit 2
    fi
done

exit 0
