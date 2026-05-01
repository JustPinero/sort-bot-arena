# CI gates

## Today

`.github/workflows/ci.yml` runs:
1. `pnpm run lint`
2. `pnpm run format:check`
3. `pnpm run typecheck` (frontend)
4. `pnpm run test` — **frontend only** (`vitest.config.ts` excludes `server/**`)
5. `pnpm run build`

Server tests (182 of them), Playwright (1 spec), and coverage thresholds are not in CI. The phase 8 contract drift bug shipped past this gate.

## Phase 10 target

```yaml
jobs:
  validate:
    name: validate
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-pnpm + node + cache
      - install
      - lint
      - format-check
      - typecheck (frontend)
      - typecheck (server)                 # NEW
      - test (frontend) with coverage      # NEW: --coverage flag
      - test (server) with coverage        # NEW
      - build (frontend)
      - build (server)                     # NEW
      - bundle-size-summary

  e2e-mocked:
    needs: validate
    steps:
      - install playwright deps
      - playwright test --project=mocked

  e2e-real-server:
    needs: validate
    steps:
      - install playwright deps
      - playwright test --project=real-server

  contract-drift:
    needs: validate
    steps:
      - run pnpm test:contract-drift  # the cross-checking test
```

## Coverage thresholds

`vitest.config.ts` (frontend) and `server/vitest.config.ts` both gain:

```ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
}
```

Drop below threshold → CI fails. Coverage HTML uploaded as artifact for inspection.

## Pre-commit hook

`husky` + `lint-staged` lands at the repo root:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{md,json,yml}": ["prettier --write"]
}
```

`.husky/pre-commit`:
```sh
pnpm exec lint-staged
```

`.husky/pre-push`:
```sh
pnpm typecheck
```

`pre-push` runs typecheck (slower) only when actually pushing — fast iteration on local commits, hard gate on push.

## Branch protection (configure in GitHub UI, document here)

Required checks on `main`:
- `validate / validate`
- `e2e-mocked / e2e-mocked`
- `e2e-real-server / e2e-real-server`
- `contract-drift / contract-drift`

Require linear history. Require PRs (no direct commits to main).

## What this catches

| Failure mode                                          | Caught by                          |
|-------------------------------------------------------|------------------------------------|
| Server route returns wrong shape                      | server tests + contract-drift      |
| Frontend MSW handler drifts from server               | contract-drift                     |
| Cookie cross-origin regression (SameSite, etc.)       | e2e-real-server                    |
| Type drift in `src/api/types.ts`                      | typecheck (server depends on it)   |
| New endpoint without test                             | coverage threshold                 |
| Broken bundle (tree-shake gone wrong)                 | build (frontend + server)          |
| Style drift / lint regression                         | pre-commit + CI lint               |

## Migration order

1. Add server test step to existing `validate` job (single line).
2. Add server typecheck + build steps.
3. Add coverage thresholds (initially loose: 70%, ratchet up after we see actual coverage).
4. Add `e2e-mocked` job (existing spec).
5. Add `e2e-real-server` job (new specs landing slice-by-slice).
6. Add `contract-drift` job once the test exists.
7. Husky + lint-staged.
8. Configure branch protection (UI step, document in `references/deployment-landmines.md`).

## Local equivalent

`scripts/validate.sh` updates to mirror CI exactly. Today it already runs lint + format + typecheck + test + build. Phase 10 adds:

```sh
pnpm --filter @sort-bot-arena/server typecheck
pnpm --filter @sort-bot-arena/server test
pnpm --filter @sort-bot-arena/server build
pnpm exec playwright test --project=mocked
```

`real-server` E2E doesn't run in `validate.sh` by default (slow), but a `pnpm validate:full` runs it.
