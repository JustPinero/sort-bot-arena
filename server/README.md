# @sort-bot-arena/server

Our backend service. Hono + TypeScript on Node 20, Turso (libSQL) for storage. Deployed alongside the frontend on Railway. The frontend talks to this; this talks to the third-party `sort-bot-api`.

See [`references/server-architecture.md`](../references/server-architecture.md) for the full design and [`requests/api-reconciliation-plan.md`](../requests/api-reconciliation-plan.md) for the slice plan.

## Local dev

```sh
# from repo root
pnpm install
cp server/.env.example server/.env   # fill in DATABASE_URL, SESSION_SECRET, etc.
pnpm --filter @sort-bot-arena/server dev
curl http://localhost:3000/api/healthz   # → ok
```

## Scripts

- `pnpm --filter @sort-bot-arena/server dev` — tsx watch
- `pnpm --filter @sort-bot-arena/server test` — vitest
- `pnpm --filter @sort-bot-arena/server typecheck` — tsc --noEmit
- `pnpm --filter @sort-bot-arena/server build` — emit dist/
