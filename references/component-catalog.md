# Component Catalog — sort-arena-web

Every reusable component, its API, and its visual spec. **Stub seeded in Phase 1.** Each phase's components get added when they're built. The catalog is the place a future contributor (or future me) goes to ask "do we have a thing for this?" before writing a one-off.

---

## Phase 1 — design-system primitives

### `<HazardStripes />`

Diagonal hazard-tape pattern. Used as section divider, warning border, decorative accent.

```tsx
<HazardStripes orientation="horizontal" thickness="thick" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Stripe direction. |
| `thickness` | `'thin' \| 'thick'` | `'thick'` | Period: 16px (thin) or 32px (thick). |
| `className` | `string` | — | passthrough. |

Pure CSS; no logic. See `src/styles/patterns.css` for the gradient. A11y: `role="presentation"` (decorative only).

### `<LEDDisplay />`

JetBrains Mono digit cluster with glow. Used for timers, scoreboards, round counters.

```tsx
<LEDDisplay value="0:42" format="time" glow="hazard" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `string \| number` | required | Stringified before render. |
| `format` | `'time' \| 'score' \| 'count'` | `'count'` | Affects width / padding hints. |
| `glow` | `'hazard' \| 'tech' \| 'champion'` | `'hazard'` | Text-shadow color. |

A11y: wrapped in `<span role="status" aria-live="polite">` so screen readers announce updates.

### `<RecordChip />`

W-L-D in tabular-numeral mono.

```tsx
<RecordChip wins={12} losses={3} draws={1} />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `wins` | `number` | required | Non-negative integer. |
| `losses` | `number` | required | Non-negative integer. |
| `draws` | `number` | `0` | Non-negative integer. |
| `variant` | `'default' \| 'rookie'` | `'default'` | Rookie shows `ROOKIE` instead of digits. |

### `<WeightClassChip />`

Maps language → weight class name.

```tsx
<WeightClassChip language="python" />
// renders: LIGHTWEIGHT
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `language` | `'python' \| 'node' \| 'go' \| 'binary' \| string` | required | Unknown language → `UNRANKED`. |

Mapping (per kickoff): heavyweight (binary), cruiserweight (go), middleweight (node), lightweight (python). Adjustable by editing `src/lib/weightClass.ts`.

### `<CornerColorBadge />`

Square in the bot's deterministic corner color (hash on `botId`).

```tsx
<CornerColorBadge botId="bot_abc123" />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `botId` | `string` | required | Hashed via `cornerColor(botId)` from `src/lib/cornerColor.ts`. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 12 / 16 / 24px. |

A11y: `aria-hidden="true"` (purely visual; the bot's name is announced separately).

### `<ChampionBelt />`

SVG belt icon. Glows + cycles when `active` is true. Used on the #1 ranked bot.

```tsx
<ChampionBelt active />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `active` | `boolean` | `false` | Adds `glow-cycle` animation when true. |

A11y: `role="img" aria-label="Champion"`.

---

## Phase 1 — layout

### `<AppShell />`

Top-level layout wrapper. Renders `<TopNav />`, optional `<ScanLines />` overlay, and the route's `<main>`.

```tsx
<AppShell forceTheme="dark" scanLines>
  <Outlet />
</AppShell>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `forceTheme` | `'dark' \| 'light' \| undefined` | `undefined` | Overrides user preference for this route. |
| `scanLines` | `boolean` | `false` | Adds the broadcast scan-lines overlay (arena routes only). |
| `children` | `ReactNode` | required | Route content. |

### `<TopNav />`

Logo, primary nav, user menu, theme toggle.

| Element | Notes |
|---|---|
| Logo | Links to `/`. |
| Primary nav | Arena, Rankings, Tournaments, Submit. Highlights active route. |
| User menu | Display name + claim CTA + sign-out (Phase 5+). Phase 1: shows guest name only. |
| Theme toggle | Cycles system → light → dark. Disabled on routes where `forceTheme` is set. |

A11y: `<header><nav role="navigation" aria-label="Primary">…</nav></header>`. Skip-link to `<main>` provided in `<AppShell />`.

### `<ThemeProvider />`

Reads `useThemeStore` + system preference, applies `data-theme` to `<html>`. Accepts a `forceTheme` prop that overrides for the wrapped subtree.

---

## Phase 2 — fighter components

### `<FighterCard />`

The unit of Tale of the Tape. Single-bot card.

```tsx
<FighterCard
  bot={bot}
  interactive?       // boolean — enables hover scale + glow + click-through
  emphasized?        // boolean — adds glow ring (drives "currently attacking")
  onFighterClick?    // (botId) => void — only fires when interactive
  className?
/>
```

Renders top-to-bottom: hazard-stripe header, portrait area (real `<img>` if `portrait_url` is on the allow-list, `<PortraitFallback />` otherwise), nickname (Bebas Neue 3xl), display_name + algorithm subtitle, weight class chip + record chip + rank badge, stat grid (signature move, Achilles heel, KO%, recent form 5×), achievement strip. Champion belt overlay when `rank === 1 && !retired`. RETIRED chip overlay when `retired`. Greyscale + low opacity when retired. `glow-cycle` animation on the corner-color border when champion. Wraps as `<button>` when interactive (full keyboard nav); `<div>` otherwise.

Variants handled internally based on the bot prop:
- rookie (record 0-0-0): replaces W-L-D with ROOKIE chip; recent-form section shows "—".
- champion (`rank === 1 && !retired`): champion belt + glow-cycle on corner border.
- retired: full card greyscaled + RETIRED chip overlay.

A11y: `<article>` landmark with `aria-labelledby` on the nickname. `data-retired` / `data-emphasized` / `data-interactive` for downstream styling and tests.

### `<TaleOfTheTape />`

Two `<FighterCard />` separated by `<VSBadge />`, or one card centered when `fighterB` is null.

```tsx
<TaleOfTheTape
  fighterA={bot}
  fighterB={bot | null}            // null = single-fighter mode
  mode="pre-fight" | "active" | "post-fight" | "static"  // default 'static'
  emphasizeBot?={botId}            // applies emphasis to one card
  showVS?={boolean}                // default true; hides the VS badge when false
  onFighterClick?={(botId) => void}
  className?
/>
```

Container queries (`@container`): vertical stack with horizontal VS strip below 800px, side-by-side with circular VS badge above. `mode="active"` disables `onFighterClick` (no nav during a fight).

### `<VSBadge />`

```tsx
<VSBadge orientation="horizontal" | "vertical" size="sm" | "md" | "lg" />
```

Vertical (default): 80px ring with hazard glow + Bebas "VS". Horizontal: full-width with hazard stripes flanking the "VS" word. Vertical is `role="img"` with `aria-label="versus"`; horizontal is decorative `role="presentation"`.

### `<PortraitFallback />`

Procedural silhouette by language. Lucide icon (Wand2 for python, Leaf for node, Code2 for go, Binary for binary; Code2 fallback for unknown). Corner-color border + matching foreground.

```tsx
<PortraitFallback botId={string} language={string} className?={string} />
```

### `<AchievementIconStrip />`

Lucide icon row with title-tooltip per achievement; "+N more" overflow indicator when more than `maxVisible`. Empty state: "No achievements yet".

```tsx
<AchievementIconStrip achievements={Achievement[]} maxVisible?={6} className?={string} />
```

### `<PerformanceHeatmap />`

Per-input performance, color-coded by rank-in-field percentile. Top 20% = `tech-cyan` (finishing move), top 40% = `victory-green` (strong), middle = neutral, bottom 30% = `combat-red` (exposed). Per-cell `aria-label` with input name, time, rank. Legend below.

```tsx
<PerformanceHeatmap data={InputPerformance[]} className?={string} />
```

### `<RankHistoryChart />`

Recharts `LineChart` with reversed Y-axis (so #1 is at top). Champion-gold line. Empty state for no snapshots. Themed via the design tokens.

```tsx
<RankHistoryChart snapshots={BotSnapshot[]} className?={string} />
```

### `<ScoutingReport />`

AI analysis as a fight-promo "BREAKDOWN" card. Plain text rendering — never `dangerouslySetInnerHTML`. Skeleton during loading; "ANALYSIS NOT AVAILABLE" empty state when null or error.

```tsx
<ScoutingReport
  analysis={string | null}
  isLoading?={boolean}
  isError?={boolean}
  className?={string}
/>
```

### `<FightHistoryTable />`

Paginated table: opponent (link to `/bots/:id`), result chip, KO/DEC indicator, relative date. "Load more" button when `hasMore`. Empty state.

```tsx
<FightHistoryTable
  runs={BotRun[]}
  isLoading?={boolean}
  hasMore?={boolean}
  onLoadMore?={() => void}
  className?={string}
/>
```

### `<ProfileTabs />`

URL-driven tab container. Default tab when no query param; falls back to default for unknown values. Writes the current tab to `?tab=<key>` via `useSearchParams` (replace mode, doesn't pollute history).

```tsx
<ProfileTabs
  tabs={Array<{ key: ProfileTabKey; label: string; content: ReactNode }>}
  defaultTab?={ProfileTabKey}
  paramName?={string}              // default 'tab'
  className?={string}
/>
```

### `<BotProfilePage />`

Route at `/bots/:botId`. TotT hero (single-fighter mode) + ProfileTabs with Fight History / Performance / Scouting Report / Achievements. Per-tab queries activate on tab change (Scouting only fetches when its tab is active). 404 panel for unknown bot id.

### `<HeadToHeadPage />`

Route at `/bots/:a/vs/:b`. TotT two-fighter mode + shared-input comparison table. Sort by absolute delta descending. Decisive deltas (>30% margin) colored victory/combat; neutral otherwise.

## Phase 3 — leaderboard components

### `<PodiumTop3 />`

Top-3 podium. Three larger cards: silver (#2), champion (#1, taller, with belt + glow-cycle), bronze (#3). Hover scale + glow on each. Each card links to its bot's profile.

```tsx
<PodiumTop3 entries={LeaderboardEntry[]} className?={string} />
```

### `<FilterChips />`

Three chip groups: weight class (All / Heavy / Cruiser / Middle / Light), activity (All Time / This Month / This Week), sort (Rank / Wins / KO% / Recent / A-Z). Active chip uses hazard yellow + dark text. `aria-pressed` for screen readers. Filtered badge surfaces when any filter is non-default.

```tsx
<FilterChips
  weight activity sort
  onWeightChange onActivityChange onSortChange
/>
```

### `<RankingsTable />`

The table proper. Columns: rank (with up/down/steady/new/returning trend arrow), fighter (corner badge + nickname + display_name + profile link), record, weight class, KO%, signature input + time, last fight date. Empty-results panel: "NO FIGHTERS MATCH THESE WEIGHT CLASSES — TRY EXPANDING YOUR SEARCH".

```tsx
<RankingsTable entries={LeaderboardEntry[]} isLoading? startRank? className? />
```

`startRank` lets pages render rows from rank N onward (so the podium owns ranks 1-3 and the table starts at #4).

### `<LeaderboardPage />`

Route at `/leaderboard`. Composes `<FilterChips />` + `<PodiumTop3 />` + `<RankingsTable />`. Filter state via `useLeaderboardFilters()` hook (URL search params). Hides podium when filtered results have no top-3.

### `<PerInputLeaderboardPage />`

Route at `/leaderboard/inputs/:inputId`. Input header with size badge + description, then a ranked table by time. 404 panel for unknown input id.

### `useLeaderboardFilters()`

Hook in `src/hooks/`. Reads/writes leaderboard filter state via `useSearchParams`. Type-safe: invalid values fall back to defaults. Default values (all, rank) are removed from the URL on write so shareable links stay minimal.

## Phase 4 — arena components

### `<HealthBar />`

10-segment health bar, role=meter, danger-red on the lowest 3 segments when lit.

```tsx
<HealthBar value={number} maxValue?={100} cornerColor?={string} label?={string} />
```

### `<RoundCounter />`

LED-display "current/total" with hazard glow.

```tsx
<RoundCounter current={number} total={number} />
```

### `<HypeMeter />`

Top-of-screen meter that fills with hype level. PEAK callout (animated) at 95%+.

```tsx
<HypeMeter level={number /* 0..1 */} />
```

### `<TrashTalkBubble />`

Quote bubble with deterministic generic-taunt fallback when `text` is null (same speaker always falls back to the same taunt).

```tsx
<TrashTalkBubble speaker={string} text={string | null} side="left" | "right" />
```

### `<CountdownTimer />`

aria-live timer ticking 1Hz to zero, then fires `onComplete`.

```tsx
<CountdownTimer seconds={number} onComplete?={() => void} />
```

### `<PreFightStaredown />`

Three-part hero: countdown overhead, `<TaleOfTheTape mode="active" />`, two `<TrashTalkBubble />`s flanking, and an "Enter Arena" CTA. The CTA is the user-gesture moment that lets audio + animations begin without violating autoplay policy.

### `<FighterPortraitFrame />`

Per-side portrait with corner-color border + glow. Damage filters auto-apply at 50% / 25% / 10% health (progressive desaturation + scan-line glitch overlay). `attacking` prop translates the portrait toward the opponent; `shaken` triggers the shake keyframe.

### `<CommentaryFeed />`

Event log → broadcast-ticker lines. `aria-live="polite"`, smooth-scroll-on-update (jsdom-safe).

### `<StatSlamIn />`

Pointer-events-none overlay that slams in via the `slam-in` keyframe, holds `durationMs`, then clears.

### `<LiveBattle />`

The bout. Composes HypeMeter + two FighterPortraitFrames flanking a center spine (RoundCounter + current input + score line + last-round delta + brief beam) + CommentaryFeed + StatSlamIn. Animation cues fire from the **latest** event only — replay-safe; revisiting an old event log doesn't re-trigger animations.

### `<PostFightDecision />`

KNOCKOUT title for ko/tko, DECISION VICTORY for narrow finishes, DECISIVE VICTORY for blowouts (≥80% rounds). Fight-poster portraits: winner with champion glow, loser dimmed + desaturated. `<ChampionBelt active />` overlay with "New Champion" callout when `rankChange` is set. Replay + Next Fight buttons.

### `<ArenaIndexPage />`

Lists battles with status badges (Live / Upcoming / Completed). Each card links to `/arena/<id>`.

### `<BattlePage />`

Drives the three-phase flow (PreFight → Live → PostFight) based on local `phase` state and the SSE-derived view model. Uses `playMockBattle()` until backend SSE ships.

### `useBattleEvents(battleId, { fighterAId, fighterBId, enabled? })`

SSE hook in `src/api/sse.ts`. Returns `{ events, derived, connected, error }`. Validates every event with `battleEventSchema` before adding to state.

### `deriveBattleState(events, fighterAId, fighterBId)`

Pure reducer in `src/lib/battleReducer.ts`. Folds `BattleEvent[]` into `BattleDerivedState` (status, currentRound, healths, rounds won, hype level, downed state, outcome, winner). Tested against every event type.

### `playMockBattle({ fighterAId, fighterBId, rounds, speedMs, onEvent })`

Browser-side helper in `src/lib/playMockBattle.ts` that emits a scripted bout (walkout pair → fight_start → N rounds with progress + result + commentary → fight_end). Configurable speed and blowout winner. Used by `<BattlePage />` until backend SSE ships.

## Phase 5 — submit + tournament components (planned)

`<MonacoEditor />`, `<DebutEvaluation />`, `<BracketDisplay />`, `<MatchCard />`. Specs land when Phase 5 starts.

## Phase 6 — homepage + polish components (planned)

`<BroadcastTicker />`, `<FeaturedFightCard />`, `<RookieOfTheDayCard />`, `<BiggestUpsetCard />`, `<BotBadge />`. Specs land when Phase 6 starts.

---

## Conventions

- **PascalCase named exports.** One top-level component per file.
- **Colocated tests.** `<Name>.tsx` ships with `<Name>.test.tsx`.
- **Smoke tests for primitives.** Mount + `axe` check; that's the floor.
- **Stateful components go through RED.** No state-bearing component lands without a failing test first.
- **Variants via `cva`.** Stack-consistent with shadcn-themed primitives in `src/components/ui/`.
- **`className` always passthrough.** Components forward `className` so callers can extend with Tailwind utilities. Use `cn(...)` from `@/lib/cn` to merge.
