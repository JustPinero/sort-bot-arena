# sort-arena-web

Frontend for the [sort-bot-api](https://github.com/JustPinero/sort-bot-api) take-home — a BattleBots × UFC broadcast experience for sorting algorithms. Vite + React 18 + TypeScript strict, deployed as a static SPA on Vercel.

See [`sort-bot-arena-kickoff.md`](./sort-bot-arena-kickoff.md) for the full project kickoff and [`CLAUDE.md`](./CLAUDE.md) for the agent brain.

## Quickstart

```sh
# Requirements: Node 20.x, pnpm 9.x
nvm use            # picks up .nvmrc
corepack enable && corepack prepare pnpm@9.15.9 --activate

cp .env.example .env.local
# edit .env.local — at minimum, set VITE_API_BASE_URL

pnpm install
pnpm dev           # http://localhost:5173
```

## Scripts

| Script                    | What it does                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                | Vite dev server on port 5173                                       |
| `pnpm build`              | TypeScript build + Vite production bundle to `dist/`               |
| `pnpm preview`            | Serve the production build locally                                 |
| `pnpm lint`               | ESLint with `--max-warnings=0`                                     |
| `pnpm format`             | Prettier write across the repo                                     |
| `pnpm typecheck`          | `tsc --noEmit`                                                     |
| `pnpm test`               | Vitest run once                                                    |
| `pnpm test:watch`         | Vitest watch mode                                                  |
| `pnpm test:coverage`      | Vitest with coverage                                               |
| `pnpm validate`           | The full local-CI check (lint + format + typecheck + test + build) |
| `pnpm generate:api-types` | Regenerate `src/api/types.ts` from the sort-bot-api OpenAPI spec   |

## Project structure

```
src/
├── api/              # fetch wrapper, TanStack Query hooks, SSE hooks, generated types
├── components/       # design-system primitives, fighter, arena, leaderboard, layout, ui
├── pages/            # one per route, lazy-loaded
├── stores/           # Zustand stores
├── lib/              # pure helpers
├── styles/           # tokens.css, fonts.css, globals, patterns, animations
└── test/             # MSW handlers, vitest setup
references/           # load-bearing docs
.claude/              # skills, commands, hooks, agents
requests/             # phase plans
audits/               # audit output (gitignored except summaries)
scripts/              # validate.sh, generate-api-types.sh
```

## Process

`Prime → Plan → RED → GREEN → Validate.` See [`CLAUDE.md`](./CLAUDE.md) for the full action loop and invariants.

Phase plans live in `requests/phase-N-plan.md`. Phases merge to `main` via `/phase-complete`. Local validation must pass before commit.

## Companion

- [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api) — backend; this repo's API contract source.

## License

Take-home submission. No license declared.
