# sort-bot-arena

A BattleBots × UFC broadcast experience for sorting algorithms. Full-stack companion to the third-party [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api) benchmarking service.

- **Frontend** — Vite + React 18 + TypeScript strict, deployed as a static SPA on Vercel: <https://sort-bot-arena.vercel.app>
- **Backend** (`server/`) — Hono + TypeScript on Node 20 with libSQL/SQLite, deployed on Railway: <https://sort-bot-arena-server-production.up.railway.app>

We deploy `sort-bot-api` as a contained service and consume it as a client. We never modify it.

## Architecture at a glance

```
browser ──cookie session──▶ our backend (server/) ──Bearer sk_live_*──▶ sort-bot-api
                              │
                              ├─ libSQL / SQLite   (users, user_bots, bot_personas, upstream_cache, schema_migrations)
                              ├─ Leonardo.ai       (bot portrait generation)
                              ├─ Anthropic Claude  (trash-talk one-liners)
                              └─ Sentry            (errors + breadcrumbs, optional)
```

- **Cookie-only sessions.** Browser holds an HttpOnly session cookie. The user's `sort-bot-api` API key is provisioned server-side at signup and stored AES-256-GCM-encrypted in our DB. Frontend never sees an API key.
- **Single API surface.** All frontend calls go through `src/api/client.ts` to our `/api/v1/*` paths. The frontend never talks to `sort-bot-api` directly.
- **Lazy personas.** Nickname, portrait (Leonardo), trash-talk (Anthropic) are generated per-bot the first time it's requested and cached in `bot_personas`. Generation is fully async; missing personas degrade to deterministic fallbacks.
- **Upstream resilience.** Every call from `server/` to sort-bot-api passes through a per-endpoint circuit breaker + retry. Listing endpoints (leaderboard, stats, inputs, feed, halloffame, achievements, h2h, per-input-leaderboard) write through a TTL'd `upstream_cache` table. When sort-bot-api is unreachable, those endpoints serve stale data with `X-Stale: true` headers instead of 502ing. The frontend has a top-level `<ErrorBoundary>`, and the live-battle SSE hook auto-falls-back to polling a synthesized `/replay` endpoint after 3 connection failures. Operational status is exposed at `GET /api/readyz`.

See [`references/server-architecture.md`](references/server-architecture.md) for the deployed-server design, [`references/sort-bot-api-overview.md`](references/sort-bot-api-overview.md) for the third-party service it wraps, [`requests/api-reconciliation-plan.md`](requests/api-reconciliation-plan.md) for the slice-by-slice ship log, and [`CLAUDE.md`](./CLAUDE.md) for the agent brain.

## Quickstart

```sh
# Requirements: Node 20.x, pnpm 9.x
nvm use            # picks up .nvmrc
corepack enable && corepack prepare pnpm@9.15.9 --activate

# Frontend env
cp .env.example .env.local
# edit .env.local — at minimum, set VITE_API_BASE_URL (default: http://localhost:3000)

# Backend env
cp server/.env.example server/.env
# edit server/.env — set DATABASE_URL, SESSION_SECRET, LEONARDO_API_KEY, ANTHROPIC_API_KEY

pnpm install
pnpm --filter @sort-bot-arena/server dev   # backend on :3000
pnpm dev                                    # frontend on :5173
```

Or boot the full local stack (sort-bot-api + arena server + vite) in one command:

```sh
./scripts/dev-stack.sh        # falls back to MSW mocks if sort-bot-api isn't usable
```

## Scripts

### Frontend (root)

| Script                    | What it does                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                | Vite dev server on port 5173                                       |
| `pnpm build`              | TypeScript build + Vite production bundle to `dist/`               |
| `pnpm preview`            | Serve the production build locally                                 |
| `pnpm lint`               | ESLint with `--max-warnings=0`                                     |
| `pnpm format`             | Prettier write across the repo                                     |
| `pnpm typecheck`          | `tsc --noEmit`                                                     |
| `pnpm test`               | Vitest run once (260 cases; frontend only — `server/` excluded)    |
| `pnpm test:watch`         | Vitest watch mode                                                  |
| `pnpm test:coverage`      | Vitest with coverage                                               |
| `pnpm validate`           | The full local-CI check (lint + format + typecheck + test + build) |
| `pnpm generate:api-types` | Regenerate `src/api/types.ts` from the sort-bot-api OpenAPI spec   |

### Backend (`server/`)

| Script                                           | What it does                              |
| ------------------------------------------------ | ----------------------------------------- |
| `pnpm --filter @sort-bot-arena/server dev`       | tsx watch on `src/index.ts`, loads `.env` |
| `pnpm --filter @sort-bot-arena/server build`     | tsc → `dist/`                             |
| `pnpm --filter @sort-bot-arena/server test`      | Vitest (66 cases — auth + sort-bot-api client + synthesis + read/write routes + upstream resilience) |
| `pnpm --filter @sort-bot-arena/server typecheck` | tsc --noEmit                              |

## Project structure

```
src/                  # frontend (Vite SPA)
├── api/              #   fetch wrapper, auth helpers, TanStack Query hooks, SSE+polling hooks
├── components/       #   design-system primitives, fighter, arena, leaderboard, auth, layout, ui
│   └── ErrorBoundary.tsx       # top-level fallback for uncaught render errors
├── pages/            #   one per route, lazy-loaded
├── stores/           #   Zustand stores (cookie-aware auth store; theme; etc.)
├── lib/              #   pure helpers + Sentry init (DSN-gated)
├── styles/           #   tokens.css, fonts.css, globals, patterns, animations
└── test/             #   MSW handlers (test fixtures), vitest setup

server/               # backend (Hono + libSQL, deployed to Railway)
├── src/
│   ├── auth/         #   bcrypt + jose JWT + AES-GCM key encryption + middleware
│   ├── clients/      #   typed sort-bot-api client + per-endpoint circuit breaker + retry
│   ├── db/           #   libSQL client + tracked migrations (schema_migrations table)
│   ├── persona/      #   Leonardo + Anthropic clients + orchestrator + nickname pool
│   ├── routes/       #   /auth, /bots, /users, /leaderboard, /feed, /halloffame, /battles/:id/{events,replay}, etc.
│   ├── store/        #   users, user_bots, upstream_cache queries
│   ├── synthesize/   #   pure helpers (record, KO%, recent_form, battle-event translator)
│   ├── lib/          #   log, sentry, cache-ttl, upstream-fallback (stale-while-error)
│   ├── app.ts        #   Hono app composition + CORS + /api/healthz + /api/readyz
│   └── index.ts      #   bootstrap (loadEnv, runMigrations, serve, cache prune timer)
└── tests/            #   vitest + MSW for upstream (incl. circuit-breaker + stale-fallback coverage)

tests/e2e/            # Playwright (incl. outage-stale-cache scenario)
references/           # load-bearing docs (architecture, schema, deployment, etc.)
requests/             # phase plans + the api-reconciliation slice plan
.claude/              # skills, commands, hooks, agents
audits/               # audit output (gitignored except summaries)
scripts/              # validate.sh, generate-api-types.sh, dev-stack.sh
railway.json          # build config: server/Dockerfile from repo root context
vercel.json           # SPA rewrite + security headers
```

## Process

`Prime → Plan → RED → GREEN → Validate.` See [`CLAUDE.md`](./CLAUDE.md) for the full action loop and invariants.

Phase plans live in `requests/phase-N-plan.md`. Phases merge to `main` via `/phase-complete`. Local validation must pass before commit.

| Phase | Theme                                                            | Status  |
| ----- | ---------------------------------------------------------------- | ------- |
| 1–6   | Frontend phases — foundation through homepage polish              | shipped |
| 7     | API reconciliation — drop MSW, ship our own backend, cookie auth | shipped |
| 8     | Cross-service resilience — breaker + stale cache + Sentry        | shipped |

## Companion

- [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api) — third-party benchmarking + battle service. We deploy it on Railway and consume it from `server/`.

## License

No license declared.
