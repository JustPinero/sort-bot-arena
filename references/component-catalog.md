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

## Phase 2 — fighter components (planned)

`<FighterCard />`, `<TaleOfTheTape />`, `<VSBadge />`, `<AchievementIconStrip />`, `<PerformanceHeatmap />`, `<RankHistoryChart />`. Specs land when Phase 2 starts.

## Phase 3 — leaderboard components (planned)

`<PodiumTop3 />`, `<RankingsTable />`, `<FilterChips />`, `<HoverPreviewPanel />`. Specs land when Phase 3 starts.

## Phase 4 — arena components (planned)

`<PreFightStaredown />`, `<LiveBattle />`, `<DigimonAttackVisualization />`, `<HealthBar />`, `<RoundCounter />`, `<StatSlamIn />`, `<CommentaryFeed />`, `<KOGraphic />`, `<DecisionGraphic />`, `<ScanLines />`. Specs land when Phase 4 starts.

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
