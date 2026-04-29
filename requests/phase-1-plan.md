# Phase 1 — Foundation & Design System

**Branch:** `phase-1-foundation`

## Scope

Stand up the Vite + React + TS skeleton, the design system primitives, the API client + auth bootstrap, the theme + routing shell, and the v3.5 process infrastructure (CLAUDE.md, references/, .claude/, validate.sh, CI). At the end of Phase 1 `pnpm dev` boots a themed app with every Phase 2-6 route reachable as a placeholder, the dev-only `<DesignSystemPage />` renders every primitive, and `pnpm validate` is green locally and in CI.

Phase 1 ships **no business logic** beyond what the kickoff names: theme management, API auth bootstrap, guest auto-provisioning, and the design-system primitives. Profile, leaderboard, arena, submit, tournaments, etc. are placeholder routes only — they ship in Phases 2-6.

## Exit criteria (verbatim from kickoff §4 Phase 1)

- `pnpm dev` starts a themed application that renders the layout shell with all routes scaffolded as placeholder pages.
- Theme toggle works (system / light / dark; per-route forced theme honored).
- Guest auto-provisioning succeeds against a running backend OR a documented MSW mock when the backend is unavailable.
- Lighthouse Accessibility 100 and Best Practices 100 on the layout shell.
- `<DesignSystemPage />` (dev-only at `/dev/design-system`) renders every color, font size, button variant, badge variant, and animation primitive for visual verification.

Plus v3.5 process gates:

- `pnpm validate` (lint + typecheck + unit + build) is green locally.
- CI pipeline (`.github/workflows/ci.yml`) replicates `validate.sh` and is green on the phase branch.
- `references/architecture.md`, `references/design-system.md`, `references/routing.md`, `references/state-management.md`, `references/env-vars.md`, `references/deployment-landmines.md`, `references/security-landmines.md` exist and are accurate. `references/component-catalog.md` and `references/api-contracts.md` are seeded and grow phase by phase.
- `CLAUDE.md` is a thin brain (~50-60 lines) that points to references/, names the action loop, and lists invariants.

## File layout to land in this phase

```
sort-bot-arena/
├── .claude/
│   ├── agents/                         # audit-runner, code-reviewer, debugger
│   ├── commands/                       # run-audits, individual audits, handoff,
│   │                                   # course-correct, pre-deploy, phase-complete,
│   │                                   # ci-update, defer, activate
│   ├── hooks/
│   │   ├── post-compact-recovery.sh
│   │   ├── post-tool-use-prettier.sh
│   │   ├── post-tool-use-a11y.sh       # jsx-a11y on .tsx writes
│   │   ├── pre-tool-use-secrets.sh
│   │   └── user-prompt-working-state.sh
│   ├── skills/                         # bughunt, coding-standards, course-correction,
│   │                                   # drift-audit, optimize, pre-deploy,
│   │                                   # session-handoff, test-audit
│   └── settings.json
├── .github/workflows/
│   └── ci.yml
├── audits/                             # empty; populated by /run-audits
├── public/
│   └── favicon.svg
├── references/
│   ├── architecture.md                 # load-bearing senior doc
│   ├── api-contracts.md                # mirror of backend OpenAPI (seeded)
│   ├── component-catalog.md            # seeded; primitives + planned components
│   ├── design-system.md                # tokens + axioms (see Open Questions §1)
│   ├── deployment-landmines.md         # Vercel + Vite + SPA + SSE
│   ├── env-vars.md
│   ├── routing.md                      # route table + theme + auth policy
│   ├── security-landmines.md           # SPA-consuming-external-API stakes
│   └── state-management.md             # Zustand + TanStack Query + SSE
├── requests/
│   └── phase-1-plan.md                 # this file
├── scripts/
│   ├── validate.sh                     # local-CI parity
│   └── generate-api-types.sh           # openapi-typescript runner
├── src/
│   ├── api/
│   │   ├── client.ts                   # fetch wrapper + auth + timeouts
│   │   ├── client.test.ts
│   │   ├── guest.ts                    # guest auto-provisioning
│   │   ├── guest.test.ts
│   │   ├── queries.ts                  # TanStack Query hooks (Phase 1: ping only)
│   │   ├── sse.ts                      # EventSource hook (Phase 1: scaffold only)
│   │   └── types.ts                    # generated; gitignored when backend live,
│   │                                   # checked in as a stub for Phase 1
│   ├── components/
│   │   ├── design-system/
│   │   │   ├── HazardStripes.tsx + .test.tsx
│   │   │   ├── LEDDisplay.tsx + .test.tsx
│   │   │   ├── RecordChip.tsx + .test.tsx
│   │   │   ├── WeightClassChip.tsx + .test.tsx
│   │   │   ├── CornerColorBadge.tsx + .test.tsx
│   │   │   └── ChampionBelt.tsx + .test.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx + .test.tsx
│   │   │   ├── TopNav.tsx + .test.tsx
│   │   │   └── ThemeProvider.tsx + .test.tsx
│   │   └── ui/                         # shadcn primitives, themed
│   │       ├── button.tsx              # combat / combat-secondary / champion variants
│   │       ├── card.tsx                # fighter / featured variants
│   │       ├── badge.tsx               # hazard / combat / champion / rookie / record
│   │       ├── dialog.tsx
│   │       ├── tabs.tsx
│   │       ├── tooltip.tsx
│   │       └── toast.tsx
│   ├── copy/
│   │   └── strings.ts                  # static UI strings (placeholder)
│   ├── hooks/
│   │   └── .gitkeep                    # populated Phase 4+
│   ├── lib/
│   │   ├── cornerColor.ts + .test.ts   # deterministic hash bot ID → color
│   │   ├── format.ts + .test.ts        # record formatting, time formatting
│   │   ├── motion.ts                   # Framer Motion variants (stubbed)
│   │   ├── theme.ts + .test.ts         # theme resolution helpers
│   │   └── weightClass.ts + .test.ts   # language → weight class mapping
│   ├── pages/                          # all scaffolded as placeholders this phase
│   │   ├── HomePage.tsx
│   │   ├── ArenaIndexPage.tsx
│   │   ├── BattlePage.tsx
│   │   ├── LeaderboardPage.tsx
│   │   ├── PerInputLeaderboardPage.tsx
│   │   ├── BotProfilePage.tsx
│   │   ├── HeadToHeadPage.tsx
│   │   ├── TournamentsListPage.tsx
│   │   ├── TournamentBracketPage.tsx
│   │   ├── SubmitPage.tsx
│   │   ├── MyFightersPage.tsx
│   │   ├── HallOfFamePage.tsx
│   │   ├── AchievementsPage.tsx
│   │   ├── EventsFeedPage.tsx
│   │   ├── DesignSystemPage.tsx        # dev-only; gated by VITE_ENABLE_VISUAL_REGRESSION
│   │   └── NotFoundPage.tsx
│   ├── stores/
│   │   ├── auth.ts + .test.ts
│   │   ├── theme.ts + .test.ts
│   │   ├── audio.ts + .test.ts         # scaffold; lazy-loaded Howler in Phase 4
│   │   └── battle.ts + .test.ts        # scaffold; populated in Phase 4
│   ├── styles/
│   │   ├── animations.css
│   │   ├── fonts.css
│   │   ├── globals.css
│   │   ├── patterns.css                # hazard stripes etc.
│   │   └── tokens.css
│   ├── test/
│   │   ├── setup.ts                    # vitest + RTL + jest-dom + jsdom
│   │   └── msw/                        # MSW handlers for Phase 1 (auth bootstrap)
│   │       ├── handlers.ts
│   │       └── server.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.example
├── .eslintrc.cjs                       # ts + jsx-a11y + react-hooks + import order
├── .gitignore
├── .nvmrc                              # 20.x to match local + CI
├── .prettierrc
├── CLAUDE.md
├── README.md
├── index.html
├── package.json
├── playwright.config.ts                # E2E scaffold; tagged tests added Phase 2+
├── pnpm-lock.yaml                      # committed
├── postcss.config.cjs
├── tailwind.config.ts
├── tsconfig.json                       # strict; @/ alias
├── tsconfig.node.json
├── vercel.json                         # SPA rewrite + CSP + outputDirectory
├── vite.config.ts                      # plugin-react, alias, vitest, MSW dev mode
└── vitest.config.ts                    # or merged into vite.config.ts
```

## RED → GREEN slices

Each slice ends with `pnpm validate` green. Order chosen so each slice composes onto the previous; a slice that lands no business logic uses the kickoff §8 escape hatch (presentational primitives, static layout) and ships without a RED test.

### Slice 0 — process spine (no app code)

- `package.json`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `.gitignore`, `.nvmrc`, `vite.config.ts`, `vitest.config.ts`, `postcss.config.cjs`, `tailwind.config.ts` (token wiring deferred to Slice 3), `vercel.json`, `index.html`, `src/main.tsx`, `src/App.tsx` skeleton (renders `<h1>` only).
- `scripts/validate.sh` (lint + typecheck + unit + build).
- `.github/workflows/ci.yml` mirroring validate.sh.
- `CLAUDE.md` thin brain.
- All v3.5 references/ docs seeded — full content for the load-bearing ones (architecture, design-system, routing, state-management, security-landmines, deployment-landmines, env-vars), stubs that name the gaps for the iterative ones (component-catalog, api-contracts).
- `.claude/` dir — agents, commands, hooks, skills, settings.json. Ported from sort-bot-api with frontend-stack adaptations (gofumpt → prettier, golangci-lint → eslint, go test → vitest).
- README with quickstart.
- Exit: `pnpm install && pnpm validate` green; `pnpm dev` opens a blank app; CI green on a draft PR.

### Slice 1 — env, API client, auth bootstrap (RED first)

- `src/api/client.ts` — fetch wrapper. Validates `import.meta.env.VITE_API_BASE_URL` at module load (throws on missing). Attaches `Authorization: Bearer <key>` from `useAuthStore`. AbortController timeout (15s default, 60s passed for SSE). Normalizes errors into a `ApiError` class with `status`, `code`, `message`, `requestId`, `fields?`.
- `src/api/guest.ts` — generates a friendly name (animal + 4-digit suffix), POSTs to `/v1/users`, stores returned key.
- `src/stores/auth.ts` — Zustand store with persist middleware (localStorage). Fields: `apiKey | null`, `userId | null`, `displayName | null`, `guestProvisioned: boolean`, `claimed: boolean`. Actions: `setKey`, `clear`, `markClaimed`.
- `src/test/msw/` — handlers for `POST /v1/users` (returns `{id, display_name, api_key}`), `GET /v1/users/me`. MSW server boots in Vitest setup; documented dev-mode toggle for browser via `VITE_USE_MOCKS=true`.
- RED tests (in this order):
  1. `client.test.ts` — `apiBaseUrl missing → throws`.
  2. `client.test.ts` — `attaches Authorization: Bearer <key> when authStore has key`.
  3. `client.test.ts` — `omits Authorization when key is null`.
  4. `client.test.ts` — `times out after 15s` (uses fake timers + AbortError).
  5. `client.test.ts` — `4xx → typed ApiError with fields`.
  6. `client.test.ts` — `5xx → ApiError with retry hint`.
  7. `guest.test.ts` — `provisions guest on first call when no key in store`.
  8. `guest.test.ts` — `does not re-provision when key already exists`.
  9. `auth.test.ts` — `setKey + persist roundtrip survives store rebuild`.
- Exit: all RED tests pass; `pnpm validate` green.

### Slice 2 — TanStack Query + Zustand provider wiring

- `src/api/queries.ts` — Phase 1 only ships `usePing()` (GET `/healthz`) to prove the wiring. More hooks land Phase 2+.
- `src/main.tsx` — wraps app in `<QueryClientProvider>` with sane defaults (5min stale, 1 retry, retryDelay exponential).
- `src/stores/audio.ts`, `src/stores/battle.ts` — scaffolded with empty initial state and minimal actions; smoke tests assert defaults.
- Exit: `usePing()` round-trips through MSW in tests; `pnpm validate` green.

### Slice 3 — design tokens, fonts, Tailwind

- `src/styles/tokens.css` — CSS variables for: 5 combat colors (hazard yellow, combat red, tech cyan, champion gold, victory green), 8 corner colors, surface/text/border palette, 8-step spacing scale, 6 radii (combat sharp + data soft), z-index scale, shadow/glow primitives.
- `src/styles/fonts.css` — `@font-face` (or fontsource imports) for Bebas Neue, Inter (with cv11/ss01/ss03), JetBrains Mono (with tnum); `font-display: swap`.
- `src/styles/patterns.css` — hazard stripe gradient, scan-line overlay.
- `src/styles/animations.css` — `glow-cycle`, `slam-in`, `ken-burns` keyframes.
- `src/styles/globals.css` — resets, base typography, accessibility focus rings.
- `tailwind.config.ts` — extends with token-driven colors (`hazard`, `combat`, `tech`, `champion`, `victory`, `surface`, `corner-{0..7}`), `fontFamily` (display, body, mono), `borderRadius` (sharp/soft tiers), keyframes mirroring `animations.css`, `screens` (mobile/tablet/desktop), container queries plugin.
- Exit: visible tokens render; no logic to test (presentational only).

### Slice 4 — ThemeProvider (RED first)

- `src/components/layout/ThemeProvider.tsx` — context provider. Reads system preference via `matchMedia('(prefers-color-scheme: dark)')`. Supports `forceTheme?: 'dark' | 'light'` prop on a per-route layout. Persists user choice in `useThemeStore`. Toggles `data-theme` and `data-force-theme` on `<html>`.
- `src/stores/theme.ts` — Zustand: `mode: 'system' | 'light' | 'dark'`, persisted.
- `src/lib/theme.ts` — `resolveTheme(mode, systemPref, forceTheme)` pure function.
- RED tests:
  1. `theme.test.ts` (lib) — `resolveTheme` truth table.
  2. `ThemeProvider.test.tsx` — `applies data-theme=dark when mode=system + system=dark`.
  3. `ThemeProvider.test.tsx` — `forceTheme overrides mode`.
  4. `ThemeProvider.test.tsx` — `responds to system change when mode=system`.
  5. `theme.test.ts` (store) — persist roundtrip.
- Exit: theme toggle in storybook-less manual test confirms class flip; tests green.

### Slice 5 — design system primitives (presentational; smoke tests only)

Per kickoff §8 RED escape hatch: pure presentational primitives skip the full RED cycle and ship with a smoke test (renders + a11y).

- `<HazardStripes orientation thickness />` — CSS gradient div.
- `<LEDDisplay value format glow />` — JetBrains Mono digits with glow ring.
- `<RecordChip wins losses draws />` — W-L-D in mono.
- `<WeightClassChip language />` — chip mapped from language.
- `<CornerColorBadge botId />` — color square from `cornerColor.ts` hash.
- `<ChampionBelt active />` — SVG belt icon, `glow-cycle` animation when active.
- `src/lib/cornerColor.ts` — RED first: `cornerColor.test.ts` proves determinism + 8-bucket distribution.
- `src/lib/weightClass.ts` — RED first: `weightClass.test.ts` proves language → weight class mapping (heavyweight/cruiserweight/middleweight/lightweight + unknown fallback).
- `src/lib/format.ts` — RED first: record formatting (`fmtRecord(2,1,0) === '2-1-0'`), time formatting (`fmtTime(0.041) === '0.041s'`, `fmtTime(2.5) === '2.500s'`).
- Each component gets a `.test.tsx` that mounts it and runs `axe` via `vitest-axe` to enforce a11y; that's the smoke test.
- Exit: every primitive renders; axe reports 0 violations.

### Slice 6 — shadcn/ui themed + variants

- `pnpm dlx shadcn@latest init` with our token CSS as the source of truth (no separate shadcn theme; `globals.css` already defines `--background`, `--foreground`, etc.).
- Add `Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Tooltip`, `Toast`.
- Layer custom variants via `cva`:
  - `Button`: `combat` (hazard yellow primary), `combat-secondary` (combat red outline), `champion` (gold gradient + glow).
  - `Card`: `fighter` (sharp radius, dark surface), `featured` (sharp + champion glow).
  - `Badge`: `hazard`, `combat`, `champion`, `rookie`, `record`.
- Each variant has a smoke test (mounts + axe).
- Exit: variants render with the right tokens; theme toggle changes appearance correctly.

### Slice 7 — layout shell + routing

- `src/components/layout/TopNav.tsx` — logo, primary nav links (Arena, Rankings, Tournaments, Submit), user menu (current display_name + claim CTA), theme toggle. Keyboard navigable; semantic landmarks; jsx-a11y clean.
- `src/components/layout/AppShell.tsx` — layout wrapper, accepts `forceTheme` prop, renders `<TopNav />` + `<main>` + skip-link.
- `src/App.tsx` — React Router v6 route table per `references/routing.md`. Each page lazy-loaded via `React.lazy` + `<Suspense>`. Route-level error boundaries. 404.
- All page components are stubs: `<h1>{name}</h1>` + a "Phase X coming soon" note keyed off the kickoff §4 phase that owns it.
- Exit: every kickoff route reachable in dev; nav clicks update URL + visible page; 404 for unknown.

### Slice 8 — DesignSystemPage + visual regression scaffold

- `src/pages/DesignSystemPage.tsx` — sections: Colors, Typography, Spacing, Radii, Shadows/Glows, Buttons (every variant + state), Badges (every variant), Cards (every variant), Design Primitives (every component above), Animations (each keyframe in a labeled tile).
- Gated by `VITE_ENABLE_VISUAL_REGRESSION` so it doesn't ship to prod.
- `playwright.config.ts` configured; one Playwright test asserts the page renders (visual snapshots populate when Phase 2+ ships TotT).
- Exit: visiting `/dev/design-system` in dev surfaces every primitive in one place.

### Slice 9 — README, .env.example, polish, phase complete

- `README.md` — quickstart, scripts, env vars, link to references/.
- `.env.example` — `VITE_API_BASE_URL` (required), `VITE_GUEST_NAME_PREFIX`, `VITE_ENABLE_AUDIO_BY_DEFAULT`, `VITE_ENABLE_VISUAL_REGRESSION`, `VITE_USE_MOCKS`.
- Run `/phase-complete` (or its equivalent — the command is part of the v3.5 ports).
- Lighthouse manual check on `/` (data route) and `/arena` (combat route, even though it's a stub) → a11y 100, BP 100.
- Open PR `phase-1-foundation → main`. Merge after review.

## Dependencies to add (and why)

| Package                                                                                                                                                                                                   | Why                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `react`, `react-dom`                                                                                                                                                                                      | Framework.                                                   |
| `react-router-dom`                                                                                                                                                                                        | Routing.                                                     |
| `@tanstack/react-query`                                                                                                                                                                                   | Server state.                                                |
| `@tanstack/react-query-devtools`                                                                                                                                                                          | Dev only.                                                    |
| `zustand`                                                                                                                                                                                                 | Client state.                                                |
| `zod`                                                                                                                                                                                                     | Schema validation for API responses + SSE events + forms.    |
| `react-hook-form`, `@hookform/resolvers`                                                                                                                                                                  | Forms (Phase 5; installed Phase 1).                          |
| `framer-motion`                                                                                                                                                                                           | Animations (used Phase 2+; installed Phase 1 for tokens.ts). |
| `lucide-react`                                                                                                                                                                                            | Icons.                                                       |
| `class-variance-authority`, `clsx`, `tailwind-merge`                                                                                                                                                      | shadcn-style variant composition.                            |
| `@radix-ui/react-*`                                                                                                                                                                                       | shadcn primitives (only the ones we use).                    |
| `@fontsource/bebas-neue`, `@fontsource/inter`, `@fontsource/jetbrains-mono`                                                                                                                               | Self-hosted fonts.                                           |
| `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/container-queries`                                                                                                                                | Styling.                                                     |
| `openapi-typescript` (devDep)                                                                                                                                                                             | Generate `src/api/types.ts` from backend OpenAPI.            |
| `vite`, `@vitejs/plugin-react`                                                                                                                                                                            | Bundler.                                                     |
| `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`                                                                            | Unit + component tests.                                      |
| `vitest-axe`, `axe-core`                                                                                                                                                                                  | a11y enforcement in tests.                                   |
| `msw`                                                                                                                                                                                                     | Mock Service Worker for API contracts in tests + dev.        |
| `@playwright/test`                                                                                                                                                                                        | E2E (config land Phase 1; suites land Phase 2+).             |
| `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `eslint-config-prettier` | Lint + a11y enforcement in CI.                               |
| `prettier`                                                                                                                                                                                                | Formatter.                                                   |
| `typescript`                                                                                                                                                                                              | Strict mode.                                                 |

Deliberately deferred: `@monaco-editor/react` (Phase 5), `recharts` (Phase 2), `howler` (Phase 4, lazy-loaded).

## Coding standards (frontend addendum to v3.5)

Will be codified in `.claude/skills/coding-standards/SKILL.md`:

- **TypeScript:** strict mode. No `any` without an explicit `// reason: …` comment.
- **API access:** every fetch goes through `src/api/client.ts`. Direct `fetch()` calls outside that module are an eslint error.
- **State:** server state via TanStack Query, client state via Zustand, component state via `useState`. No mixing.
- **Forms:** `react-hook-form` + `zod` resolver. No raw `onChange` on inputs except for trivial UI-only state.
- **Animations:** Framer Motion `<motion.*>` for anything beyond a simple Tailwind transition. No raw CSS keyframes for state-driven animation; tokenized keyframes in `animations.css` for purely decorative effects (glow-cycle, scan-lines).
- **Styling:** Tailwind utilities first. CSS modules only when a component exceeds ~30 lines of styling.
- **a11y:** every interactive element has a role, label, and keyboard handler. `eslint-plugin-jsx-a11y` violations break CI.
- **Imports:** ordered (1) external, (2) `@/` absolute, (3) relative. Enforced by `eslint-plugin-import`.
- **Components:** PascalCase named exports, one top-level component per file, colocated `<Name>.test.tsx`.
- **No `console.log`** in committed code. `console.warn`/`error` allowed with context.
- **No `dangerouslySetInnerHTML`** anywhere — including for AI-generated trash talk and analysis (rendered as text per `references/security-landmines.md`).
- **No image src from arbitrary API URLs** — validate against the backend allowlist before rendering (defense-in-depth even though backend should be trusted).

## Invariants (do not violate)

- **API base URL is required.** `src/api/client.ts` throws at module load if `VITE_API_BASE_URL` is missing.
- **API key never logged.** Sentry/error-tracker integrations (when added) must filter localStorage.
- **No frontend secrets.** Anthropic + Leonardo keys live exclusively on the backend; CSP blocks third-party origins.
- **SSE events are validated.** Every event runs through a `zod` schema before touching state.
- **Page weight budgets:** layout shell + home <200KB gzip; profile <250KB; arena <400KB. Tracked via `pnpm build && pnpm bundle-report` (script lands Slice 9).

## Open questions (need user answers before Slice 3)

1. **Design tokens source.** The kickoff references `sort-arena-web-design-tokens.md` as the authoritative source for color values, exact font sizes, spacing scale, animation timings, and shadow/glow primitives. I do **not** have that document. Two paths:
   - (a) You drop `sort-arena-web-design-tokens.md` into the repo (or paste it); I transcribe it verbatim into `references/design-system.md` and `src/styles/tokens.css`.
   - (b) I synthesize a set of tokens from the descriptive cues already in the kickoff (5 combat colors named but no hex; "Bebas Neue 48px" etc.) and you review/adjust. This is faster but the values won't match anything pre-existing.
   - Recommendation: (a) if the doc exists; (b) if it doesn't and you want me to draft.
2. **Backend availability for Phase 1 testing.** sort-bot-api is mid-Phase-1 itself; the `POST /v1/users` and `GET /healthz` endpoints may not yet be wired. Two paths:
   - (a) MSW mocks handle the auth bootstrap in Phase 1; we point at the live backend in Phase 2 once `POST /v1/users` exists.
   - (b) Block Phase 1 until backend Phase 4 (auth) lands.
   - Recommendation: (a). The frontend doesn't need a live backend to prove the layout shell, design system, or theming. We get parity in Phase 2 once both repos converge.
3. **OpenAPI consumption.** Plan: `scripts/generate-api-types.sh` reads from `../sort-bot-api/references/openapi.yaml` (relative path) when `BACKEND_REPO` env is unset, otherwise from `$BACKEND_REPO/references/openapi.yaml`. CI will skip generation and rely on a checked-in `src/api/types.ts` stub until backend OpenAPI stabilizes.
4. **shadcn/ui CLI.** It scaffolds files into our `src/components/ui/` and edits `tailwind.config.ts`. I'll run it once and commit the result; future component additions go through the same CLI to stay in sync. Confirm OK with that workflow.
5. **PR workflow.** Backend uses phase branches merged to `main` after `/phase-complete`. Same for frontend? Or do you want all phases on one long-lived branch until project completion?

## Out of scope (Phase 2+)

- Tale of the Tape and any fighter-specific component (Phase 2).
- Leaderboard rendering, podium, filter chips (Phase 3).
- Arena (Phase 4); arena page is a placeholder this phase.
- Submission, Monaco editor, tournaments (Phase 5).
- Homepage broadcast feed, hall of fame, audio integration, embeddable badges (Phase 6).
- Real backend AI feature consumption — the components built this phase are framework only.

## Risks

- **Token doc gap (Q1).** Without the design-tokens doc, Slice 3 stalls. Resolve before Slice 3 starts.
- **Backend OpenAPI churn (Q3).** Generated types may break the frontend on every backend phase merge. Mitigate by checking in a stub and treating regeneration as an explicit step.
- **shadcn migration cost.** If shadcn updates break our themed primitives, we eat the migration. Mitigate by pinning versions in `package.json` and batching updates.
- **Lighthouse a11y 100.** Achievable on the layout shell, harder on `<DesignSystemPage />` (high contrast variants need careful pairing). Mitigate by gating the dev page behind `VITE_ENABLE_VISUAL_REGRESSION`.

## Validate gate (what `pnpm validate` runs)

```
1. eslint . --max-warnings=0
2. tsc --noEmit
3. vitest run --coverage
4. vite build
5. (optional) playwright test --grep @phase-1
```

Any failure is non-zero exit. CI mirrors the same script.

## What I'm waiting on from you

- Answers to the five Open Questions, especially Q1 (design-tokens doc) and Q5 (PR workflow).
- Green light to start Slice 0 once Q1/Q5 are resolved.
