#!/usr/bin/env bash
# dev-stack.sh — boot the full local stack from the arena side:
#   sort-bot-api (:8080)  →  arena server (:3000)  →  vite SPA (:5173)
#
# If the api build or health check fails, falls back to "mocks mode":
# the SPA boots with VITE_USE_MOCKS=true and MSW intercepts every API call.
# Useful when the api repo isn't checked out, go isn't installed, or the
# api build is broken — you still get a working SPA to demo.
#
# Usage:  ./scripts/dev-stack.sh   (or `pnpm dev:stack`)

set -uo pipefail

# ---- ANSI helpers ----
cyan()   { printf "\033[1;36m%s\033[0m\n" "$*"; }
red()    { printf "\033[1;31m%s\033[0m\n" "$*" >&2; }
green()  { printf "\033[1;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[1;33m%s\033[0m\n" "$*"; }

banner() {
  local color="$1"; shift
  local msg="$*"
  local pad
  pad=$(printf '%*s' "${#msg}" '' | tr ' ' '─')
  printf "\033[1;${color}m┌─${pad}─┐\n│ %s │\n└─${pad}─┘\033[0m\n" "$msg"
}

# ---- Paths ----
ARENA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$(cd "$ARENA_DIR/.." && pwd)/sort-bot-api"

# ---- Pre-flight ----
if ! command -v pnpm >/dev/null 2>&1; then
  red "pnpm not installed. Run: corepack enable && corepack prepare pnpm@9.15.9 --activate"
  exit 1
fi

# ---- Mocks-mode decision ----
MOCKS_MODE=false
MOCKS_REASON=""

mark_mocks() {
  MOCKS_MODE=true
  MOCKS_REASON="$1"
}

if [ ! -d "$API_DIR" ]; then
  mark_mocks "sort-bot-api/ not found at $API_DIR"
elif ! command -v go >/dev/null 2>&1; then
  mark_mocks "go is not installed"
fi

# ---- Port checks ----
port_busy() { lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1; }

if [ "$MOCKS_MODE" = false ] && port_busy 8080; then
  if curl -fsS http://localhost:8080/healthz >/dev/null 2>&1; then
    yellow "[stack] :8080 already serving — reusing the running api"
    SKIP_API_BOOT=true
  else
    mark_mocks "port 8080 is busy with a non-api process"
  fi
else
  SKIP_API_BOOT=false
fi

if [ "$MOCKS_MODE" = false ] && port_busy 3000; then
  red "[stack] port 3000 (arena server) is already in use; stop the existing process and retry"
  exit 1
fi

if port_busy 5173; then
  red "[stack] port 5173 (vite) is already in use; stop the existing process and retry"
  exit 1
fi

# ---- Arena env bootstrap ----
if [ ! -f "$ARENA_DIR/.env.local" ]; then
  cp "$ARENA_DIR/.env.example" "$ARENA_DIR/.env.local"
  cyan "[stack] created $ARENA_DIR/.env.local"
fi

if [ ! -f "$ARENA_DIR/server/.env" ]; then
  SECRET=$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 64)
  cat >"$ARENA_DIR/server/.env" <<EOF
PORT=3000
SORT_BOT_API_URL=http://localhost:8080
DATABASE_URL=file:./local.db
SESSION_SECRET=$SECRET
ALLOWED_ORIGINS=http://localhost:5173
LOG_LEVEL=info
EOF
  cyan "[stack] created $ARENA_DIR/server/.env with local defaults"
fi

# ---- Arena deps (one-time) ----
if [ ! -d "$ARENA_DIR/node_modules" ]; then
  cyan "[stack] installing arena deps (one-time)…"
  ( cd "$ARENA_DIR" && pnpm install )
fi

# ---- Track all child PIDs for cleanup ----
PIDS=()
CLEANED_UP=false
cleanup() {
  if [ "$CLEANED_UP" = true ]; then return; fi
  CLEANED_UP=true
  echo
  cyan "[stack] shutting down…"
  # Kill the entire process group so all spawned children die cleanly.
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---- Build + start api (if not in mocks mode) ----
if [ "$MOCKS_MODE" = false ] && [ "$SKIP_API_BOOT" = false ]; then
  cyan "[stack] building api binary…"
  if ! ( cd "$API_DIR" && go build -o ./bin/sort-bot-api ./cmd/sort-bot-api ) 2>&1 | sed -u $'s/^/\033[0;34m[api-build]\033[0m /'; then
    mark_mocks "api build failed"
  fi
fi

if [ "$MOCKS_MODE" = false ] && [ "$SKIP_API_BOOT" = false ]; then
  cyan "[stack] starting api on :8080"
  (
    cd "$API_DIR"
    DATABASE_PATH=./sortbot.db PORT=8080 LOG_LEVEL=info ./bin/sort-bot-api 2>&1 \
      | sed -u $'s/^/\033[0;34m[api]\033[0m /'
  ) &
  API_PID=$!
  PIDS+=("$API_PID")

  # Wait for /healthz, but bail to mocks mode if it doesn't come up.
  printf "\033[1;36m[stack] waiting for api"
  HEALTHY=false
  for _ in $(seq 1 30); do
    if curl -fsS http://localhost:8080/healthz >/dev/null 2>&1; then
      HEALTHY=true
      break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      break
    fi
    printf "."
    sleep 1
  done
  printf "\033[0m\n"

  if [ "$HEALTHY" = false ]; then
    red "[stack] api did not become healthy in 30s"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    mark_mocks "api failed health check"
  else
    green "[stack] api up at http://localhost:8080"
  fi
fi

# ---- Mocks-mode banner ----
if [ "$MOCKS_MODE" = true ]; then
  echo
  banner 33 "⚠  API UNAVAILABLE — falling back to mocks mode"
  yellow "    reason: $MOCKS_REASON"
  yellow "    the SPA will boot with VITE_USE_MOCKS=true; MSW intercepts every API call."
  yellow "    no arena server, no real database — full UI demo only."
  echo
fi

# ---- Start arena server (only in full-stack mode) ----
if [ "$MOCKS_MODE" = false ]; then
  cyan "[stack] starting arena server on :3000"
  (
    cd "$ARENA_DIR"
    PORT=3000 SORT_BOT_API_URL=http://localhost:8080 ALLOWED_ORIGINS=http://localhost:5173 \
      pnpm --filter @sort-bot-arena/server dev 2>&1 \
      | sed -u $'s/^/\033[0;32m[srv]\033[0m /'
  ) &
  SRV_PID=$!
  PIDS+=("$SRV_PID")

  printf "\033[1;36m[stack] waiting for arena server"
  for _ in $(seq 1 20); do
    if curl -fsS http://localhost:3000/api/healthz >/dev/null 2>&1; then
      printf " ✓\033[0m\n"
      green "[stack] arena server up at http://localhost:3000"
      break
    fi
    if ! kill -0 "$SRV_PID" 2>/dev/null; then
      printf "\033[0m\n"
      red "[stack] arena server died before becoming healthy"
      exit 1
    fi
    printf "."
    sleep 1
  done
fi

# ---- Start Vite ----
echo
green "[stack] starting Vite SPA on http://localhost:5173"
echo

(
  cd "$ARENA_DIR"
  if [ "$MOCKS_MODE" = true ]; then
    VITE_USE_MOCKS=true VITE_API_BASE_URL=http://localhost:3000 pnpm dev 2>&1 \
      | sed -u $'s/^/\033[0;35m[web]\033[0m /'
  else
    pnpm dev 2>&1 \
      | sed -u $'s/^/\033[0;35m[web]\033[0m /'
  fi
)
