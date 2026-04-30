# sort-bot-arena

A BattleBots × UFC broadcast experience for sorting algorithms. Two-package monorepo:

- **Frontend** — Vite + React 18 + TypeScript strict, deployed as a static SPA on Vercel: <https://sort-bot-arena.vercel.app>
- **Backend** (`server/`) — Hono + TypeScript on Node 20 with libSQL/SQLite, deployed on Railway: <https://sort-bot-arena-server-production.up.railway.app>

The third-party [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api) is the underlying benchmarking + battle service; we deploy it as a contained service and consume it as a client. We never modify it.

## Architecture at a glance

```
browser ──cookie session──▶ our backend (server/) ──Bearer sk_live_*──▶ sort-bot-api
                              │
                              ├─ Turso/SQLite      (users, sessions, user_bots, bot_personas)
                              ├─ Leonardo.ai       (bot portrait generation)
                              └─ Anthropic Claude  (trash-talk one-liners)
```

- The browser only ever holds an HttpOnly session cookie. The user's `sort-bot-api` API key is provisioned server-side at signup and stored AES-256-GCM-encrypted in our DB.
- All frontend calls go through `src/api/client.ts` to our `/api/v1/*` paths. The frontend never talks to `sort-bot-api` directly.
- Persona data (nickname, portrait, trash-talk) is generated lazily and cached per-bot in `bot_personas`.

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
| `pnpm test`               | Vitest run once (frontend only — `server/` excluded)               |
| `pnpm test:watch`         | Vitest watch mode                                                  |
| `pnpm test:coverage`      | Vitest with coverage                                               |
| `pnpm validate`           | The full local-CI check (lint + format + typecheck + test + build) |
| `pnpm generate:api-types` | Regenerate `src/api/types.ts` from the sort-bot-api OpenAPI spec   |

### Backend (`server/`)

| Script                                           | What it does                              |
| ------------------------------------------------ | ----------------------------------------- |
| `pnpm --filter @sort-bot-arena/server dev`       | tsx watch on `src/index.ts`, loads `.env` |
| `pnpm --filter @sort-bot-arena/server build`     | tsc → `dist/`                             |
| `pnpm --filter @sort-bot-arena/server test`      | Vitest (43 cases at last count)           |
| `pnpm --filter @sort-bot-arena/server typecheck` | tsc --noEmit                              |

## Project structure

```
src/                  # frontend (Vite SPA)
├── api/              #   fetch wrapper, auth helpers, TanStack Query hooks, SSE hooks
├── components/       #   design-system primitives, fighter, arena, leaderboard, auth, layout, ui
├── pages/            #   one per route, lazy-loaded
├── stores/           #   Zustand stores (cookie-aware auth store; theme; etc.)
├── lib/              #   pure helpers
├── styles/           #   tokens.css, fonts.css, globals, patterns, animations
└── test/             #   MSW handlers (test fixtures), vitest setup

server/               # backend (Hono + Turso, deployed to Railway)
├── src/
│   ├── auth/         #   bcrypt + jose JWT + AES-GCM key encryption + middleware
│   ├── clients/      #   typed sort-bot-api client (unwraps Go sql.Null* shapes)
│   ├── db/           #   libSQL client + migrations
│   ├── persona/      #   Leonardo + Anthropic clients + orchestrator + nickname pool
│   ├── routes/       #   /auth, /bots, /users, /leaderboard, /feed, /halloffame, etc.
│   ├── store/        #   users, user_bots queries
│   ├── synthesize/   #   pure helpers (record, KO%, recent_form, battle-event translator)
│   ├── app.ts        #   Hono app composition + CORS
│   └── index.ts      #   bootstrap (loadEnv, runMigrations, serve)
└── tests/            #   vitest + MSW for upstream

references/           # load-bearing docs (architecture, schema, deployment, etc.)
requests/             # phase plans + the api-reconciliation slice plan
.claude/              # skills, commands, hooks, agents
audits/               # audit output (gitignored except summaries)
scripts/              # validate.sh, generate-api-types.sh
railway.json          # build config: server/Dockerfile from repo root context
vercel.json           # SPA rewrite + security headers
```

## Process

`Prime → Plan → RED → GREEN → Validate.` See [`CLAUDE.md`](./CLAUDE.md) for the full action loop and invariants.

Phase plans live in `requests/phase-N-plan.md`. Phases merge to `main` via `/phase-complete`. Local validation must pass before commit.

## Companion

- [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api) — third-party benchmarking + battle service. We deploy it on Railway and consume it from `server/`.

## License

No license declared.
