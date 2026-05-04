# Phase 11 — Tightening follow-up

**Branch:** `phase-11-tightening-followup`. Goal: close the small loose ends from the post-phase-10 FE/QA reviews + investigate the production listener flakiness + fix D-11. Not a feature phase. Out-of-scope items listed at the bottom; do not let scope creep.

## Slices

### Theme T1 — FE hygiene from the FE code review

**T1.1. Schema-gate `apiClient.get<>` callsites that skipped the overload.**
Two known sites:

- `src/api/sse.ts:144` — `apiClient.get<ReplayPayload>(...)` for `/api/v1/battles/:id/replay`. Define `ReplayPayloadSchema` in `src/api/schemas.ts` and pass it.
- `src/api/auth.ts:40` — `apiClient.get<SessionUser>('/api/v1/auth/me')`. Use `SessionUserSchema`.

After both, `grep -nE "apiClient\.get<" src/` should return zero matches outside of the `{schema}` overload — every call gates through Zod.

**T1.2. Delete dead `signup` / `login` exports from `src/api/auth.ts`.**
The UI uses `useSignup` / `useLogin` from `queries.ts:387-403` (`useMutation` wrappers). The bare `signup` / `login` exports are unreferenced. Delete them. Keep `getMe`, `logout`, `ensureSessionLoaded` (those are still consumed by `main.tsx` and `TopNav.tsx`).

**T1.3. Replace `LeaderboardResponse` and `PerInputLeaderboardResponse` interfaces with `z.infer`.**
In `src/api/queries.ts:159-189`. Both interfaces duplicate the corresponding `*Schema` shape. Replace with `export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;` etc. Drops ~40 lines of redundant type laundering.

### Theme T2 — Production reliability

**T2.1. Listener stream-error investigation.**
Railway logs show repeated `[INFO] global listener stream error err="fetch failed"` (every ~5 min) and an occasional `err="terminated"`. Reconnect with backoff is firing, so it's not a hang — it's the upstream SSE stream cutting out. Pull a wider log window, identify whether the cut-out cadence matches a known timeout (Railway proxy idle, sort-bot-api keep-alive, etc.), document the finding in `references/global-listener.md` under a new "Production observations" section. If our reconnect cadence amplifies the problem, fix it. If the cause is upstream, document and move on.

**T2.2. Records stuck at 0-0-0 investigation.**
Every baseline bot on the production leaderboard shows `record: { wins: 0, losses: 0, draws: 0 }` despite battles completing in the user's smoke tests. Three places this could break:

1. Listener processes `battle_complete` but `recent_battles.markComplete` writes the wrong shape.
2. The synthesis layer's `getBattleHistoryFor(botId)` doesn't read what the listener wrote.
3. Battles aren't actually emitting `battle_complete` events upstream (or they're emitting under a different event name).

Find which one. Production-safe diagnostic only — no schema changes; if it's a real bug, write the fix in a follow-up slice.

**T2.3. D-11 — fix `tests/e2e/mocked/outage-stale-cache.spec.ts` under the real-server harness.**
Currently `test.skip`'d. Per the debt note, MSW intercepts the leaderboard fetch before Playwright's `page.route` override can simulate an outage. Two options: (a) disable MSW for this one spec, (b) refactor the outage simulation to drive the stub's failure mode directly. Pick whichever produces a passing spec without touching the rest of the harness. Drop the `test.skip` comment + restore the test name.

### Theme T4 — Upstream-error contract tests

**T4.1. Upstream-error envelopes get strict-schema parse coverage.**
The existing `server/tests/contract-drift.test.ts` walks every endpoint's happy path. Extend with cases that simulate upstream 502 / 503 / breaker-open and assert the error response parses against the `ApiErrorEnvelopeSchema` (or whatever exists; create a strict schema if missing — `{ error: string, upstream_status?: number, code?: string }` is the de-facto shape). One case per write endpoint that touches upstream + one case per read endpoint that uses `withStaleFallback`. The `withStaleFallback` cache hit path also needs assertion: 502 from upstream + populated cache → 200 with `{stale: true, stale_age_ms}` headers.

## Wave plan

```
Wave 1 (parallel, agents):  T1.1, T1.2, T1.3
Wave 2 (sequential, me):    T2.1, T2.2 (investigation; coupled)
Wave 3 (sequential, me):    T2.3 (D-11)
Wave 4 (parallel, agent):   T4.1
Wave 5 (sequential, me):    Validate → PR → CI → squash-merge → railway up
```

## Exit criteria

- `pnpm validate` green.
- All Playwright projects green (no `test.skip` survivors from D-11).
- `grep -nE "apiClient\.get<" src/` returns 0 matches.
- `references/global-listener.md` has a "Production observations" section documenting the listener stream-error pattern.
- If records-stuck investigation finds a real bug → fix shipped in this PR; if it's upstream-side or known limitation → documented in `references/global-listener.md` or `debt.md`.
- New upstream-error contract tests passing.

## Out of scope (do not let creep in)

- D-1 visual regression (needs baseline approval workflow).
- D-2 hover preview / D-4 audio / D-5 LiveBattle extras / D-7 PPV promo (real features with UX decisions; not fixes).
- D-3 leaderboard pagination (premature — current bot count fits one page).
- D-12 listener replay catch-up (depends on sort-bot-api shipping a `?since=` cursor; out of our control).
- D-13 tournament match retry on transient failure (real feature; defer).
- D-14 cross-replica leader election (single-replica enforced; no code to write).
- Mutation testing infrastructure (Stryker; phase 12+).
- "The Bots" carousel (explicitly skipped by user).
- Anything in `sort-bot-api/` repo (third-party, never modified).
