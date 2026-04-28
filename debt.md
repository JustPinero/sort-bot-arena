# Debt Log

Entries from `/defer`. Resurface via `/activate <id>`.

## D-1 (2026-04-28) — phase-2-fighter-profile / 40a38da

Visual regression Playwright snapshots for Tale of the Tape variants and the full BotProfilePage are out of Phase 2's shipped scope.

The kickoff §4 Phase 2 exit criteria asked for: "Visual regression test snapshots committed for: TotT pre-fight, TotT champion variant, TotT rookie variant, TotT mobile layout, full profile page."

The Playwright config + `tests/e2e/` scaffold are in place from Phase 1 Slice 8. What's missing:

1. A `tests/e2e/tale-of-the-tape.spec.ts` that loads `/dev/design-system` (or a dedicated fixture route) and screenshots each TotT variant at desktop + mobile widths.
2. A `tests/e2e/bot-profile.spec.ts` for the full profile page in the champion + rookie variants.
3. A CI job that runs `pnpm exec playwright test --grep @phase-2` and uploads diffs as artifacts.

Why deferred: shipping the snapshots requires booting the dev server in CI (with MSW enabled), which in turn requires adding a Playwright workflow and tuning the `webServer` config so the CI run isn't flaky. Worth doing, but the visual contract is otherwise enforced by axe-clean smoke tests + the design tokens being consumed via CSS variables (no inline hex). The take-home is shippable without it.

When activated: branch `phase-2-visual-regression` from main, add the two specs, gate them on `VITE_ENABLE_VISUAL_REGRESSION=true`, wire a Playwright job into `.github/workflows/ci.yml` that runs only on PR (not main) so a flaky snapshot doesn't block deploys.

## D-2 (2026-04-28) — phase-3-leaderboard / c6a5d2a

`<HoverPreviewPanel />` not built. Kickoff §4 Phase 3 said: "Hover any row: preview-loads that fighter's TotT card in a side panel (300ms hover-intent debounce, prevents thrashing)."

Why deferred: the kickoff treats it as a polish nicety; rows are already click-through to the full profile page. Hover preview adds: a portal-managed side panel, a 300ms hover-intent debounce hook, prefetch on hover via `queryClient.prefetchQuery` for the bot record, and careful re-render avoidance to keep panel transitions smooth. None of that is on the critical path for "see the rankings."

When activated: add `useHoverIntent(delay)` to `src/hooks/`, add `<HoverPreviewPanel />` to `src/components/leaderboard/`, prefetch the bot record on hover, and integrate into `<RankingsTable />` rows. Mobile keeps click-through (no hover concept).

## D-4 (2026-04-28) — phase-4-arena (planned)

Audio deferred from Phase 4. The audio store and lazy-load shape are in place from Phase 1; what's missing is asset sourcing and the `useFightAudio()` hook that wires SSE events to Howler triggers.

When activated:

1. Source 4 royalty-free walkout cues (one per language), 1 ambient crowd loop, 1 round-start ding, 1 round-loss thud, 1 KO fanfare. Total budget ~250KB.
2. Drop into `public/audio/`.
3. Implement `src/lib/audio.ts` (Howler wrapper, dynamic-imported only when `useAudioStore.enabled === true`).
4. Implement `src/hooks/useFightAudio()` — subscribes to battle events, plays cues. No autoplay on mute. Reads `useAudioStore` for current enable + volume.
5. Wire `<PreFightStaredown />` to play walkout cues on `walkout` events.
6. Wire `<LiveBattle />` to play round-end thud + KO fanfare.

## D-5 (2026-04-28) — phase-4-arena (planned)

LiveBattle "extras" deferred. Kickoff explicitly tags these as polish:

- Special move callouts (algorithm name slam on dramatic round wins).
- Crowd silhouettes along the bottom (animated SVG, hands up on KOs).
- Stoppage referee overlay on `fighter_downed` events.
- Post-fight victor interview quote bubble for top-10 wins or upsets.

When activated: each is a 1-2 hour add. None are on the critical path; the bout already feels alive without them. Worth landing during Phase 6 polish if there's bandwidth.

## D-3 (2026-04-28) — phase-3-leaderboard / c6a5d2a

Pagination on `<RankingsTable />` not built. The MSW handler returns all entries in one page; the API will need cursor-based paging once real data lands. The `useBotRuns` hook already shows the pattern (load-more button); apply the same here when activating.

When activated: add `cursor` state to `<LeaderboardPage />`, thread into `useLeaderboard`, render a "Load more" button at the table's foot when `next_cursor` is non-null. Optionally upgrade to infinite-scroll with `IntersectionObserver`.
