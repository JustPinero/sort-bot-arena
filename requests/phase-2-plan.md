# Phase 2 — Tale of the Tape & Bot Profile Pages

**Branch:** `phase-2-fighter-profile` (stacked on `phase-1-foundation` until that merges to `main`)

## Scope

Build the foundational visual component (`<TaleOfTheTape />`) that proves the kickoff's broadcast aesthetic, plus a complete bot profile page composed from it. Land the supporting data viz (per-input heatmap, rank-history line chart, achievement gallery) and the head-to-head comparison route.

## Exit criteria (verbatim from kickoff §4 Phase 2)

- Any valid bot ID from the API renders a complete profile page with all tabs functional.
- Tale of the Tape is pixel-perfect on desktop, tablet, and mobile.
- Hovering a fighter card produces the expected glow and scale transition.
- Champion belt only appears on the actual current #1.
- Profile loads in under 1.5 seconds on a fast connection (TanStack Query caches the bot data, parallel fetch of secondary tabs).
- Visual regression test snapshots committed for: TotT pre-fight, TotT champion variant, TotT rookie variant, TotT mobile layout, full profile page.

Plus v3.5 process gates:

- `pnpm validate` green locally and in CI on the phase branch.
- `references/component-catalog.md` updated with every new component's API + spec.
- `references/api-contracts.md` updated with the endpoints consumed.
- `CLAUDE.md` phase table updated.
- `/phase-complete` runs clean.

## File layout to land in this phase

```
src/
├── api/
│   ├── types.ts                       # hand-written Bot/BotRun/Snapshot/Achievement/InputPerf
│   │                                  # (will be replaced by openapi-typescript output)
│   ├── queries.ts                     # extends with useBot, useBotRuns,
│   │                                  # useBotSnapshots, useBotAnalysis,
│   │                                  # useBotInputPerformance, useLeaderboardRank
│   └── queries.test.tsx               # extends with happy-path coverage per hook
├── components/
│   ├── fighter/
│   │   ├── FighterCard.tsx + .test.tsx        # the unit of TotT; handles all variants
│   │   ├── TaleOfTheTape.tsx + .test.tsx      # one or two FighterCards + VSBadge
│   │   ├── VSBadge.tsx + .test.tsx
│   │   ├── PortraitFallback.tsx + .test.tsx   # procedural silhouette by language
│   │   ├── AchievementIconStrip.tsx + .test.tsx
│   │   ├── PerformanceHeatmap.tsx + .test.tsx
│   │   ├── RankHistoryChart.tsx + .test.tsx
│   │   ├── ProfileTabs.tsx + .test.tsx        # tab container for the four tabs
│   │   ├── FightHistoryTable.tsx + .test.tsx
│   │   └── ScoutingReport.tsx + .test.tsx
├── pages/
│   ├── BotProfilePage.tsx              # replaces placeholder; full implementation
│   ├── BotProfilePage.test.tsx
│   ├── HeadToHeadPage.tsx              # replaces placeholder; full implementation
│   └── HeadToHeadPage.test.tsx
├── test/
│   └── msw/
│       ├── fixtures.ts                 # canonical Bot fixtures (rookie, champion, retired,
│       │                               # full-stats, no-portrait, no-analysis)
│       └── handlers.ts                 # extends with /v1/bots/:id, runs, snapshots,
│                                       # analysis, inputs; /v1/leaderboard for rank lookups
└── tests/e2e/
    └── tale-of-the-tape.spec.ts        # Playwright visual regression on TotT variants

```

## Data shapes (`src/api/types.ts`)

Hand-written stub that mirrors what backend Phase 7 will produce. When the backend OpenAPI stabilizes, `pnpm generate:api-types` regenerates and we accept any shifts via type errors at compile time.

```ts
export interface Bot {
  id: string;
  display_name: string;
  nickname: string | null;
  language: 'python' | 'node' | 'go' | 'binary' | string;
  algorithm: string | null;
  portrait_url: string | null;
  rank: number | null;
  record: { wins: number; losses: number; draws: number };
  ko_percentage: number; // 0-100
  signature_input: BotInputResult | null;
  achilles_heel: BotInputResult | null;
  recent_form: ReadonlyArray<'W' | 'L' | 'D'>;
  achievements: Achievement[];
  trash_talk: string | null;
  analysis_url: string | null;
  retired: boolean;
}

export interface BotInputResult {
  input_id: string;
  input_name: string;
  time_seconds: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string; // lucide icon name OR emoji
  description: string;
  unlocked_at: string; // ISO
  rarity_pct: number; // 0-100, lower = rarer
}

export interface BotRun {
  id: string;
  battle_id: string;
  opponent_id: string;
  opponent_nickname: string | null;
  opponent_portrait_url: string | null;
  outcome: 'win' | 'loss' | 'draw' | 'no_contest';
  ko: boolean;
  date: string; // ISO
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface BotSnapshot {
  date: string; // ISO
  rank: number;
}

export interface InputPerformance {
  input_id: string;
  input_name: string;
  size: number;
  time_seconds: number;
  rank_in_field: number;
  total_in_field: number;
}
```

When the script regenerates `src/api/types.ts` from the backend OpenAPI, these names may collide. The strategy: keep a `src/api/types.local.ts` for any frontend-only conveniences, re-export the merged set from `src/api/types.ts` (or accept the regen and update the few consumers). Decision deferred until backend ships.

## RED → GREEN slices

Each slice ends with `pnpm validate` green. Component tests are RED-first for state-bearing components (ProfileTabs, FighterCard hover states, FightHistoryTable pagination); presentational primitives (VSBadge, AchievementIconStrip, PortraitFallback) ship with smoke + axe per the kickoff §8 escape hatch.

### Slice 1 — types, MSW fixtures, query hooks (RED first)

- `src/api/types.ts` shapes above.
- `src/test/msw/fixtures.ts`: a curated set of bot personas — `rookieBot` (0-0-0, no portrait, no analysis), `championBot` (rank=1, full stats), `retiredBot`, `noAnalysisBot`, `noPortraitBot`. Hand-tuned to exercise all `<FighterCard />` variants.
- `src/test/msw/handlers.ts`: `/v1/bots/:id` returns the matching fixture; `/v1/bots/:id/runs` returns paginated `BotRun[]`; `/v1/bots/:id/snapshots`; `/v1/bots/:id/inputs`; `/v1/bots/:id/analysis` returns `{ analysis: string }` with retry-eligible 503 for the no-analysis fixture.
- `src/api/queries.ts`: `useBot(id)`, `useBotRuns(id, opts?)`, `useBotSnapshots(id)`, `useBotAnalysis(id)`, `useBotInputPerformance(id)`. Stable query keys, 5-min stale, retry per defaults.
- `src/api/queries.test.tsx`: one happy-path + one error-path per hook. Reuses the existing `wrapper` pattern from Phase 1.
- Exit: 5 hooks each round-trip through MSW; tests green.

### Slice 2 — design primitives the FighterCard needs (presentational)

- `<VSBadge />`: 96px circular with diagonal hazard accent + the word "VS" in Bebas Neue. Reduced size + horizontal stripe for mobile.
- `<PortraitFallback language>`: procedural silhouette per language. SVG, 1:1 aspect, shows a stylized icon (binary → terminal, go → gopher silhouette, node → leaf, python → snake). Uses corner color via inline style.
- `<AchievementIconStrip achievements maxVisible>`: lucide icons in a row; "+N more" tooltip when overflow.
- Smoke + axe per primitive.

### Slice 3 — `<FighterCard />` (the unit of TotT)

- Single-bot card. Layout (top to bottom): hazard-stripe header, portrait area (corner-color border, fallback to procedural), nickname (Bebas Neue 48 desktop / 32 mobile), display_name + algorithm subtitle, weight class chip + record chip, stat grid (signature move, Achilles heel, KO%, recent form W/L symbols), achievement strip, optional champion belt overlay.
- Variants handled internally based on bot prop:
  - rookie (0-0-0): replaces W-L-D with `<RecordChip variant="rookie" />`; hides recent form.
  - champion (rank===1): adds `<ChampionBelt active />` overlay + glow-cycle on the corner-color border.
  - retired: full card greyscale + RETIRED chip overlay.
- Container queries: when narrower than 800px, internal layout switches to vertical-friendly with reduced type sizes.
- Hover (when interactive prop is true and not in active battle): scale 1.02 + corner-color glow shadow; 100ms snap transition.
- A11y: `<article>` landmark with `aria-labelledby` on the nickname; achievement strip has `<ul role="list">`.
- Tests:
  - mounts each fixture variant + axe per variant.
  - champion belt only appears when rank===1.
  - retired card has `data-retired` attribute + RETIRED chip.
  - hover applies the expected classes when interactive (use `userEvent.hover`).
  - keyboard focus surfaces the same hover state.

### Slice 4 — `<TaleOfTheTape />`

- API per the kickoff supplemental:
  ```tsx
  <TaleOfTheTape
    fighterA={bot}
    fighterB={bot | null}
    mode="pre-fight" | "active" | "post-fight" | "static"
    emphasizeBot?={botId}
    showVS?={boolean}
    onFighterClick?={(botId) => void}
  />
  ```
- Layout: two `<FighterCard />`s separated by `<VSBadge />`. Container query switches to vertical stack with horizontal VS strip when <800px.
- `mode="active"` disables `onFighterClick` (no nav during a fight).
- `emphasizeBot` adds an extra glow ring to the named fighter for the "currently attacking" emphasis (Phase 4 will drive this dynamically).
- Single-fighter mode: `fighterB` null → renders one card centered, full-width.
- Tests cover all four modes + single-fighter + mobile container query.

### Slice 5 — Profile sub-components

- `<FightHistoryTable runs cursor onLoadMore>`: paginated table with opponent thumbnail, outcome chip, KO/DEC indicator, date. Click row → navigate to battle replay (Phase 4 placeholder).
- `<PerformanceHeatmap data>`: 19 columns × 3 rows. Color-coded by relative time vs field — `combat-red` for "exposed here", `tech-cyan` for "finishing move", neutral for middle of field. Tooltip per cell shows input + time + rank.
- `<RankHistoryChart snapshots>`: Recharts `<LineChart>`, theme-aware colors, gold accent on the current rank. Year markers as fight-card tape labels.
- `<ScoutingReport analysis>`: renders the AI analysis as a fight-promo "BREAKDOWN" card. Strict text rendering — no `dangerouslySetInnerHTML`. Newlines preserved via `white-space: pre-wrap`. "ANALYSIS NOT AVAILABLE" empty state when null.
- `<ProfileTabs />`: shadcn `Tabs` themed; URL-driven via `?tab=performance` query param.
- Tests: each gets a smoke + axe; FightHistoryTable + ProfileTabs go through RED for behavior (pagination request, tab persistence in URL).

### Slice 6 — `<BotProfilePage />`

- Replaces the Phase 1 placeholder.
- Hero: `<TaleOfTheTape />` in single-fighter mode.
- Below: `<ProfileTabs>` with four tabs (Fight History, Performance, Scouting Report, Achievements).
- Parallel data fetching: `useBot` (eager), `useBotRuns` / `useBotSnapshots` / `useBotInputPerformance` / `useBotAnalysis` (each lazy-loaded by tab activation, prefetched on hover of the corresponding tab trigger).
- Loading state: skeleton TotT + tab placeholders. No spinners over empty pages.
- 404 state: when API returns 404, redirect to a themed "FIGHTER NOT IN THE DATABASE" panel.
- Tests: full integration via MSW — render the page, verify TotT, switch tabs, assert each tab's data renders.

### Slice 7 — `<HeadToHeadPage />`

- Replaces the Phase 1 placeholder.
- Hero: `<TaleOfTheTape />` two-fighter mode.
- Below the hero: shared-input performance comparison table (inputs both bots have run, side-by-side time + delta). `combat-red` highlight when the current bot loses badly; `victory-green` when wins decisively.
- Tests: render with two fixtures, verify both names render, verify shared-input rows.

### Slice 8 — Visual regression baseline

- `tests/e2e/tale-of-the-tape.spec.ts`: Playwright loads the dev-only `/dev/design-system` route in tot-test mode (a local sandbox route added behind `VITE_ENABLE_VISUAL_REGRESSION` that renders specific TotT variants in isolation). Snapshots: pre-fight, champion, rookie, mobile (Chromium 375px viewport), full profile.
- Snapshots committed under `tests/e2e/__screenshots__/`.
- CI runs Playwright on PR — gated on visual-regression workflow that we can keep optional in Phase 2 and tighten in Phase 6.

### Slice 9 — Close-out

- Update `references/component-catalog.md` with every new component (FighterCard, TaleOfTheTape, VSBadge, PortraitFallback, AchievementIconStrip, PerformanceHeatmap, RankHistoryChart, ProfileTabs, FightHistoryTable, ScoutingReport, BotProfilePage, HeadToHeadPage).
- Update `references/api-contracts.md` Phase 2 section with the actual endpoints consumed.
- Update `CLAUDE.md` phase table.
- `/phase-complete` checklist.
- PR ready.

## Coding-standards reminders for this phase

- **No `dangerouslySetInnerHTML`** even on the AI analysis. Render as text.
- **Validate `portrait_url` against the backend allow-list** before passing to `<img src>`. Helper in `src/lib/imageHost.ts` (lands Slice 2).
- **Forms via react-hook-form + zod** — only the search box on the future leaderboard hover preview will need forms; profile pages are read-only.
- **Server state via TanStack Query**; per-tab queries enabled by tab activation.
- **No raw `Date` math** — keep date helpers in `src/lib/format.ts`. Add `fmtDate(iso)` and `fmtRelativeDate(iso)`.

## Dependencies to add

- `recharts` (~33KB gzip). Used for `<RankHistoryChart />`. Lazy-loaded only on the Profile page's Performance tab so it stays out of the main bundle.
- `date-fns` (subset import for `formatDistanceToNow`). ~5KB gzip.

## Open questions

1. **`/v1/bots/:id/inputs`** — does the backend group by input or by run? Plan: assume grouped-by-input (best result per input per bot). Adjust when backend ships the endpoint.
2. **Heatmap rendering** — kickoff says "19 columns × 3 rows for sizes". Map to 19 inputs × 3 size buckets (small / medium / large) or 57 unique inputs grouped by size? Plan: 19 inputs × 3 sizes = 57 cells (grouped). If backend exposes a different grouping, adjust.
3. **Profile tabs URL state** — query param (`?tab=`) or hash? Plan: query param for shareable links; helper utility in `src/lib/urlState.ts`.
4. **HeadToHead route** — what input set qualifies as "shared"? Plan: intersection of inputs both bots have run on; sort by absolute time delta.

## Risks

- **Backend Phase 7 not shipped.** Frontend assumes nickname, portrait_url, achievements, analysis. MSW mocks cover all of it; once backend ships, the openapi-typescript regeneration may force renames. Mitigation: the hand-written `src/api/types.ts` is the only place the names exist; update there and the rest follows.
- **Recharts bundle weight.** Tab-lazy-loading is the mitigation; the Profile page's initial JS bundle stays under the 250KB budget without recharts loaded.
- **TotT mobile layout regressions.** Visual regression Playwright snapshots in Slice 8 are the safety net; broken mobile layout fails CI.
- **Animation perf on the heatmap.** 57 cells with Tailwind transitions can paint a lot. Mitigation: use `transform: scale` on hover, not `box-shadow`; static cells.

## Out of scope (defer to later phases)

- Battle replay click-through from `<FightHistoryTable />` rows — clicks navigate to `/arena/:battleId`, which is still a placeholder until Phase 4.
- Live-updating profile data — the profile is a snapshot. Phase 4's SSE feed will refresh leaderboard / record cards in real time.
- "Claim guest" UI — Phase 5 (submit page) has the form.
- Embeddable badge component — Phase 6.
- Audio — Phase 4.

## Validate gate (unchanged from Phase 1)

```
1. eslint . --max-warnings=0
2. prettier --check .
3. tsc --noEmit
4. vitest run --coverage
5. vite build
6. (optional, gated) playwright test --grep @phase-2
```
