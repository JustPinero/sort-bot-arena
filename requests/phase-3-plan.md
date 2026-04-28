# Phase 3 — Leaderboard (P4P Rankings)

**Branch:** `phase-3-leaderboard` (stacked on `phase-2-fighter-profile` until that merges)

## Scope

Build the P4P rankings page: top-3 podium, filterable rankings table, hover-preview side panel, per-input leaderboard route. URL state for filters so the leaderboard is deep-linkable.

## Exit criteria (verbatim from kickoff §4 Phase 3)

- Leaderboard loads in under 1 second.
- Filters apply instantly (server-side filtering via API query params).
- Hover preview works without layout shift.
- Per-input leaderboards render correctly for all 57 built-in inputs and any custom inputs the user has access to.
- URL deep-links to filtered states work.
- Visual regression on the podium top-3 layout.

Plus v3.5 process gates: `pnpm validate` green, references/api-contracts.md and component-catalog.md updated, CLAUDE.md phase table.

## Endpoints (extends MSW handlers)

- `GET /v1/leaderboard?weight=&activity=&sort=&cursor=&limit=` → `LeaderboardPage` (rank, fighter summary, record, weight class, KO%, signature input + time, last fight date, trend).
- `GET /v1/leaderboard/inputs/:inputId?cursor=&limit=` → input-specific ranking + the input's pattern preview.
- `GET /v1/inputs?cursor=&limit=` → list of inputs (for the per-input leaderboard picker, future use).

## Slices

1. **Types + MSW + queries** — `LeaderboardEntry`, `LeaderboardPage`, `Input`. Hooks: `useLeaderboard(filters)`, `usePerInputLeaderboard(inputId, filters)`. Filter parsing via zod.
2. **`<PodiumTop3 />`** — three larger cards (#1 #2 #3) with gold/silver/bronze accents. #1 has the champion belt + glow-cycle.
3. **`<RankingsTable />`** — the table proper. Rank trend (↑/↓/—), fighter (avatar + nickname + display_name), record, weight class, KO%, signature input + time, last fight date, action menu.
4. **`<FilterChips />`** — weight class, activity, language, sort. Driven via `useSearchParams`.
5. **`<HoverPreviewPanel />`** — side panel that renders a TotT-lite preview of the row under cursor. 300ms hover-intent debounce.
6. **`<LeaderboardPage />` + `<PerInputLeaderboardPage />`** — replace placeholders, compose the above.
7. **Close-out** — catalog + contracts + CLAUDE + PR.

## Out of scope (defer)

- Hover preview is desktop-only; mobile gets click-through.
- Custom-input leaderboards (Phase 5+ when user inputs exist).
- Saved comparison dashboards (kickoff stretch, Phase 6).

## Open questions

1. **Trend arrows** — does the API return rank delta from last week's snapshot, or do we compute it client-side from `useBotSnapshots`? Plan: assume API returns `trend: 'up' | 'down' | 'steady' | 'new' | 'returning'` on each entry; degrade gracefully if missing.
2. **Filter persistence** — query params (shareable) or localStorage (sticky)? Plan: query params per kickoff explicitly says "URL state for filters."

## Risks

- **Hover preview perf.** TotT preview on every row hover could cause layout thrash. Mitigation: 300ms debounce + render once into a portal-managed side panel; never re-render the panel on rapid hover changes.
- **Empty filter result.** Themed message per kickoff: "NO FIGHTERS MATCH THESE WEIGHT CLASSES — TRY EXPANDING YOUR SEARCH".
