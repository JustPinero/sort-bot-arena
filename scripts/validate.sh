#!/usr/bin/env bash
# Local-CI parity. Runs the same checks CI runs, in the same order.
# Failure of any stage exits non-zero with a clear marker.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }

if ! command -v pnpm >/dev/null 2>&1; then
    fail "pnpm not installed. Install via: npm install -g pnpm@9.15.9"
fi

# 1. eslint
step "eslint"
pnpm run lint
ok "eslint passed"

# 2. prettier check
step "prettier --check"
pnpm run format:check
ok "prettier passed"

# 3. typecheck (frontend + server)
step "tsc --noEmit (frontend)"
pnpm run typecheck
ok "typecheck (frontend) passed"

step "tsc --noEmit (server)"
pnpm --filter @sort-bot-arena/server typecheck
ok "typecheck (server) passed"

# 4. unit tests with coverage (frontend + server) — A2 enforces thresholds
step "vitest run --coverage (frontend)"
pnpm run test:coverage
ok "unit tests + coverage (frontend) passed"

step "vitest run --coverage (server)"
pnpm --filter @sort-bot-arena/server exec vitest run --coverage --passWithNoTests
ok "unit tests + coverage (server) passed"

# 5. build (frontend + server)
step "vite build"
pnpm run build
ok "build (frontend) passed"

step "tsc -p tsconfig.build.json (server)"
pnpm --filter @sort-bot-arena/server build
ok "build (server) passed"

printf "\n\033[1;32m✓ all checks passed\033[0m\n"
