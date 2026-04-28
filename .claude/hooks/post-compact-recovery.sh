#!/usr/bin/env bash
# PostCompact hook: surface the agent state most likely to be lost in compaction.
# Echoes a short prompt-augmenting block; the harness includes this as context
# in the next turn after compaction.

set -euo pipefail

cat <<'EOF'
[post-compact recovery]

Quick re-orientation:

- Repo: sort-arena-web (Vite + React + TS frontend; companion to sort-bot-api).
- Read CLAUDE.md and references/architecture.md if you don't have recent context.
- Current phase: check git branch (phase-N-*) and the TaskList.
- Action loop: Prime → Plan → RED → GREEN → Validate.
- Local-CI parity: pnpm validate (= scripts/validate.sh) must pass before commit.
- Phase plans live in requests/phase-N-plan.md.
EOF

exit 0
