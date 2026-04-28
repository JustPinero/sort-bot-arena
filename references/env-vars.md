# Environment Variables — sort-arena-web

All Vite-exposed env vars are prefixed `VITE_*` and baked into the bundle at build time. **No secrets** belong in the frontend.

## Required

| Var | Type | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | string (URL) | sort-bot-api base. `src/api/client.ts` throws at module load if unset. |

## Optional

| Var | Default | Notes |
|---|---|---|
| `VITE_GUEST_NAME_PREFIX` | `anonymous-` | Prefix for auto-generated guest names like `anonymous-otter-4729`. |
| `VITE_ENABLE_AUDIO_BY_DEFAULT` | `false` | If `true`, audio toggle starts on. Mostly for dev. |
| `VITE_ENABLE_VISUAL_REGRESSION` | `false` | Enables `/dev/design-system` route + Playwright visual-regression mode. |
| `VITE_USE_MOCKS` | `false` | Enables MSW handlers in the browser (dev only). Tests always use MSW. |

## How to set them

- **Dev:** copy `.env.example` to `.env.local` and edit. `.env.local` is gitignored.
- **Vercel:** set in Project Settings → Environment Variables → for **all three** environments (Production, Preview, Development). Missing one is a common landmine; see `references/deployment-landmines.md`.
- **CI:** set in `.github/workflows/ci.yml` env block when relevant. Type-checking and unit tests do not need a real `VITE_API_BASE_URL` — the client module is only imported under test from `client.test.ts`, which sets `import.meta.env.VITE_API_BASE_URL` in the test setup.

## Forbidden

- Anthropic API key (lives on backend only).
- Leonardo.ai API key (lives on backend only).
- Database credentials (frontend has no database).
- Any value the user must not see when they View Source. **`VITE_*` vars are public.**

## Validation

`src/api/client.ts` runs a zod check at module load. The schema is intentionally narrow: a missing or non-URL `VITE_API_BASE_URL` halts the app with a clear error rather than failing at the first network call. This is the only place env vars are validated; downstream modules consume the validated config from a shared module.
