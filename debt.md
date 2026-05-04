# Debt Log

Entries from `/defer`. Resurface via `/activate <id>`.

## D-9 (2026-05-01) — phase-9-promoter / per-match input picking deferred

`POST /api/v1/tournaments` records `bracket_size` + `input_mode` (`flat_random` | `escalation`) on `recent_tournaments` for analytics, but only forwards `{participant_bot_ids, count}` to sort-bot-api. The "escalation" mode (round 1 small / round 2 medium / round 3+ large) is conceptual until sort-bot-api accepts per-match `input_ids`. Until then both modes pass `count: 3` upstream. The TournamentSetupModal's escalation tooltip cites this caveat.

When activated: either (a) sort-bot-api adds per-match input arrays to its tournament create, or (b) we orchestrate match-by-match by POSTing `/v1/battles` for each tournament match server-side. (a) is cheaper.

Resolved by: phase 10 slices D1-D5 (2026-05-04). Took option (b): self-orchestration. `server/src/synthesize/bracket.ts` builds initial brackets (4/6/8/12 with bye placement), `server/src/synthesize/tournament-inputs.ts` picks small/medium/large per round in escalation mode, `server/src/store/tournament-matches.ts` persists the per-match state machine, and `server/src/orchestrator/tournament.ts` walks the bracket round-by-round with a per-tournament mutex. `POST /api/v1/tournaments` inserts initial matches + fire-and-forget schedules; `GET /api/v1/tournaments/:id` now reads from our DB. InputModeToggle copy updated to describe real behavior.

## D-10 (2026-05-01) — phase-9-promoter / battle status reconciliation

`recent_battles.status` transitions from `pending → running` happen on POST, but `running → complete` only happens lazily when our server proxies a battle GET (the user landing on the BattlePage). For battles that finish without a viewer, the status stays `running` indefinitely. Cooldown rule 1 (no simultaneous) gracefully handles this — a stale `running` row blocks new battles for that pair, but `Retry-After` will look weird (computes elapsed since created_at).

When activated: ship the global SSE listener (D-8), which already would observe `battle_complete` events; pipe them through to update `recent_battles`. Or add a 60s background sweep that fetches upstream status for any `running` row older than 60s and updates accordingly.

Resolved by: phase 10 slice C3 (2026-05-04). Both options shipped. `server/src/listener/battle-sweep.ts` runs a 60s background timer that finds `recent_battles.status='running'` rows older than 60s and reconciles via upstream `getBattle` (marks complete or failed). Idempotent re-runs covered by tests; bootstrapped from `server/src/index.ts`. The global listener (D-8) provides the reactive path on top of this sweep's safety net.

## D-8 (2026-04-29) — api-reconciliation / slice 7 deferred

Global SSE listener — subscribes to sort-bot-api's `/v1/events/stream` and persists `battle_complete` events into a local `recent_battles` table so per-bot record / KO% / recent_form derive from real history instead of returning zeros.

Why deferred: at demo scale (a handful of bots, no automated traffic) the records that the listener populates would still be near-zero. The synthesis layer + DB schema are ready (`src/synthesize/record.ts`, `BattleForBot`, `recent_battles` table is the only addition); the listener itself is the only missing piece. Frontend renders 0-0-0 records cleanly.

When activated: add `0004_recent_battles` migration, write `src/listener/global-stream.ts` (consume upstream SSE, write each `battle_complete` row), boot it from `src/index.ts` when `RUN_LISTENER=true`. Wire `getBattleHistoryFor(botId)` from the new table into `synthesizeBot`'s `history` arg in routes/bots.ts and routes/users.ts.

Resolved by: phase 10 slice C4 (2026-05-04). `server/src/listener/global-listener.ts` consumes upstream `/v1/events/stream` when `RUN_LISTENER=true`, parses lines via a new `SseLineParser` helper, updates `recent_battles` on `battle_complete` (with INSERT OR IGNORE for unknown battles via a one-shot upstream fetch), and reconnects with jittered exponential backoff [1s, 2s, 5s, 10s, 30s]. Slice D4 wired the listener into the orchestrator so a `battle_complete` on a tournament-bound match calls `orchestrator.advanceMatch`. `/api/readyz` (slice C5) exposes listener health (`running`, `last_event_at`, `events_processed`).

## D-1 (2026-04-28) — phase-2-fighter-profile / 40a38da

Visual regression Playwright snapshots for Tale of the Tape variants and the full BotProfilePage are out of Phase 2's shipped scope.

The kickoff §4 Phase 2 exit criteria asked for: "Visual regression test snapshots committed for: TotT pre-fight, TotT champion variant, TotT rookie variant, TotT mobile layout, full profile page."

The Playwright config + `tests/e2e/` scaffold are in place from Phase 1 Slice 8. What's missing:

1. A `tests/e2e/tale-of-the-tape.spec.ts` that loads `/dev/design-system` (or a dedicated fixture route) and screenshots each TotT variant at desktop + mobile widths.
2. A `tests/e2e/bot-profile.spec.ts` for the full profile page in the champion + rookie variants.
3. A CI job that runs `pnpm exec playwright test --grep @phase-2` and uploads diffs as artifacts.

Why deferred: shipping the snapshots requires booting the dev server in CI (with MSW enabled), which in turn requires adding a Playwright workflow and tuning the `webServer` config so the CI run isn't flaky. Worth doing, but the visual contract is otherwise enforced by axe-clean smoke tests + the design tokens being consumed via CSS variables (no inline hex). The app is shippable without it.

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

## D-6 (2026-04-28) — phase-5-submit-tournaments / 6cf8e27

Real multipart submit + backend SSE deferred. Frontend currently sends JSON to `POST /v1/bots` and uses `playMockEvaluation()` for the debut feed. The API client already detects FormData bodies and switches the wire format automatically — no client changes needed when backend ships.

When activated:

1. Update `useSubmitBot()` in `src/api/queries.ts` to build a FormData body (the original code is in git history).
2. Replace `playMockEvaluation()` in `<SubmitPage />` with a `useDebutEvents(botId)` SSE hook (mirror `useBattleEvents()`).
3. Add `evaluationEventSchema` (zod) for runtime validation per event.
4. Same for tournaments: add `useTournamentEvents(id)` SSE for live round advancement.

## D-7 (2026-04-28) — phase-5-submit-tournaments / 6cf8e27

Polish items deferred to Phase 6:

- PPV promo card generator at `/tournaments/:id/promo/:matchId` (auto-generated SVG poster for top-5 vs top-5 matchups).
- Auto-generated fight-poster image export from `<PostFightDecision />`.
- Native share sheet integration with copy-link fallback.
- `<BotBadge />` embeddable shield component.
- Champion-crowning ticker-tape effect on tournament finale.

## D-11 (2026-05-04) — phase-10-tightening / G1 follow-up

`tests/e2e/real-server/outage-stale-cache.spec.ts` is broken under the new real-server Playwright project. MSW intercepts requests before `page.route` overrides can simulate an upstream outage, so the spec can't drive the stale-cache path it was written for. Flagged in slice G1's commit message as the only failing real-server spec.

When activated: disable MSW in that one spec (the rest of the real-server project relies on the stub sort-bot-api on :8081, not MSW), or refactor the outage simulation to drive the stub's failure mode directly rather than via `page.route`. The stale-cache layer itself is covered by server unit tests; this is purely E2E coverage of the user-visible path.

## D-12 (2026-05-04) — phase-10-tightening / listener reconnect replay catch-up

`server/src/listener/global-listener.ts` reconnects with jittered exponential backoff but does not replay events that arrived during the disconnect window. Sort-bot-api's `/v1/events/stream` is fire-and-forget; missed `battle_complete` events are recovered indirectly by the 60s `battle-sweep` (D-10 fallback) and by the lazy upstream fetch on battle GET. At demo scale this is fine, but a long disconnect could let `tournament_matches` advancement stall until the next sweep tick (or user visit).

When activated: design depends on whether sort-bot-api adds an `?since=<event_id>` cursor or a replay buffer. Open question logged in `references/global-listener.md`. Tracked as phase 11+ in the phase 10 plan's "what this phase does NOT include" list.

## D-13 (2026-05-04) — phase-10-tightening / tournament match retry on transient failure

`TournamentOrchestrator.advanceMatch` marks a `tournament_matches` row `failed` on any non-recoverable upstream error and short-circuits further advancement. There is no transient-vs-terminal classifier and no automatic retry — a one-off network blip on a battle POST can fail the whole bracket. Tracked as out-of-scope in the phase 10 plan.

When activated: distinguish transient (5xx, network, circuit-open) from terminal (4xx other than 429) errors in `server/src/orchestrator/tournament.ts`. Retry transients with bounded backoff before marking failed; surface failure reason on the match row for FE rendering.

## D-14 (2026-05-04) — phase-10-tightening / cross-replica leader election for the listener

`GlobalEventListener` and `BattleSweeper` assume a single server replica. Running multiple Railway instances with `RUN_LISTENER=true` would double-process every `battle_complete` event and run duplicate sweep ticks. Today we enforce single-replica deploy out-of-band; there is no in-process guard. Tracked as out-of-scope in the phase 10 plan.

When activated: add a Turso-backed leader lease (row in a `listener_leader` table with a TTL the holder refreshes). Non-leader replicas skip listener + sweeper boot. Alternative: gate on a `LEADER=true` env per-replica via Railway service config, simpler but ops-driven.
