# Tournament orchestrator (closing D-9)

## Why we're orchestrating ourselves

sort-bot-api's `POST /v1/tournaments` accepts only a `count` (uniform input count across the bracket) and seeds its own bracket. To ship round-thematic input escalation (small → medium → large by round), we'd need either:

- **a.** sort-bot-api adds per-match input arrays — out of our control, blocked indefinitely.
- **b.** We orchestrate the bracket ourselves: fire `POST /v1/battles` per match with the right input pool, track winners, advance rounds, persist intermediate state.

Phase 10 ships **(b)**. The frontend's `input_mode` toggle (flat_random / escalation) becomes a real switch, not a label.

## Architecture

```
POST /api/v1/tournaments
  ├── validate body, decrypt user's sort-bot-api key
  ├── INSERT recent_tournaments (status='pending', input_mode, bracket_size)
  ├── compute initial seeding from participant_bot_ids[]
  ├── INSERT tournament_matches rows for round 1
  ├── enqueue ScheduleMatchJob(tournament_id) on the orchestrator
  └── return { tournament_id, status: 'pending' }
```

The orchestrator runs **in-process** as an async worker (no Bull, no Redis at this scale). It's a single async loop that wakes when a match finishes and decides what to do next.

```
class TournamentOrchestrator {
  schedule(tournamentId)  // call after creating + after a match completes
  start()                 // boot loop
}
```

State machine per tournament:
```
pending → running → complete | failed
```

State machine per match:
```
pending → in_flight → complete | failed
```

## Schema additions (one new table, one new column)

`tournament_matches` table — replaces relying on sort-bot-api for match state because we need richer state (which battle we kicked off, which round, who advances).

```sql
CREATE TABLE IF NOT EXISTS tournament_matches (
  match_id              TEXT    PRIMARY KEY,
  tournament_id         TEXT    NOT NULL,
  round                 INTEGER NOT NULL,
  bracket_position      INTEGER NOT NULL,
  bot_a_id              TEXT,
  bot_b_id              TEXT,
  battle_id             TEXT,                       -- our recent_battles id once kicked off
  status                TEXT    NOT NULL,           -- pending|in_flight|complete|bye|failed
  winner_bot_id         TEXT,
  scheduled_at          TEXT,
  completed_at          TEXT,
  FOREIGN KEY (tournament_id) REFERENCES recent_tournaments(tournament_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tm_tournament_round
  ON tournament_matches(tournament_id, round, bracket_position);
CREATE INDEX IF NOT EXISTS idx_tm_status_scheduled
  ON tournament_matches(status, scheduled_at);
```

`recent_tournaments` gains nothing new — `bracket_size`, `input_mode`, `participant_count`, `status`, `winner_bot_id`, `completed_at` already cover it.

## Bracket seeding

Standard single-elimination, byes for non-power-of-2:

| Size | R1 matches | R1 byes |
|------|------------|---------|
| 4    | 2          | 0       |
| 6    | 2          | 2       |
| 8    | 4          | 0       |
| 12   | 4          | 4       |

Seeding rule for byes: top-N seeds get the byes (where N = `2 × ceil(log2(bracket_size)) - bracket_size`). A bye match has `status='bye'`, `bot_a_id=seedN`, `bot_b_id=null`, `winner_bot_id=seedN`. Pure helper at `server/src/synthesize/bracket.ts:buildInitialBracket(participantBotIds, bracketSize)`.

## Input policy

`server/src/synthesize/tournament-inputs.ts` (extends existing helper):

```ts
function pickRoundInputs(
  inputs: ApiInput[],
  round: number,
  mode: 'flat_random' | 'escalation',
  count: number = 3,
): number[]
```

For `flat_random`: shuffle full pool, take first `count`.
For `escalation`:
- round 1 → only `size_class === 'small'`
- round 2 → only `size_class === 'medium'`
- round 3+ → only `size_class === 'large'`
- if a class has fewer than `count` inputs, fall through to next class (graceful degrade, log warn).

Tests cover all three round transitions plus the degrade case.

## Orchestrator loop

```
schedule(tournamentId):
  1. find any tournament_matches.status='pending' for this tournament
     where bot_a_id and bot_b_id are both set (not pending on a prior round result)
  2. for each: pickRoundInputs, POST /v1/battles upstream
     update match status='in_flight', battle_id=<our_battle_id>
  3. if no pending matches, check if all rounds complete:
     - yes → mark tournament status='complete', winner = final match winner
     - no → likely waiting on in_flight matches to finish; do nothing
```

Match completion is detected by:
1. The global SSE listener (slice C3) hearing `battle_complete` on a battle_id we own → mark match complete, advance the bracket, schedule next round.
2. Backup: 60s sweep over `tournament_matches.status='in_flight'`, fetch upstream, reconcile.

## Bracket advancement

When a match transitions `in_flight → complete`:

```
advanceMatch(match):
  1. determine next round + bracket_position:
     next_round = match.round + 1
     next_position = floor(match.bracket_position / 2)
  2. find or create the next-round match row at (next_round, next_position)
  3. set the appropriate slot (a or b) to match.winner_bot_id based on parity
  4. if both slots are now filled, schedule(tournamentId) to fire it
  5. if this was the final match, mark tournament complete
```

## Frontend impact

`<TournamentBracketPage />` currently consumes `useTournament(id)` and renders the `matches[]` array from sort-bot-api's tournament. Phase 10 changes that data source — the `Tournament.matches` array now reflects our `tournament_matches` rows, not sort-bot-api's. The `synthesizeTournament` helper changes; component is unchanged.

`<TournamentSetupModal />` removes the "escalation tooltip caveat" copy (currently says "coming once sort-bot-api supports per-match"). Replace with a short description of how each mode picks inputs.

## Failure modes & recovery

- **Orchestrator process dies mid-round** — on restart, scan for `tournament_matches.status='in_flight'` and reconcile via 60s sweep. No work lost; matches resume.
- **Single match fails** — set match `status='failed'`, mark tournament `status='failed'`. Future enhancement: retry the match. Out of scope for phase 10.
- **Concurrent schedule() calls** — guard with an in-process per-tournament-id mutex (same `withPairLock` pattern from phase 9).
- **Battle cooldown collision** — if a tournament fires `POST /v1/battles` for a pair that's already cooling, treat as terminal failure for that match. (User configured the bracket; if they put two heavyweight rivals in adjacent slots and one was just fought, that's a UX wart we accept for v1.)

## Test plan

Pure helpers (`server/src/synthesize/bracket.ts`, `tournament-inputs.ts`):
- buildInitialBracket: 4/6/8/12 layouts, byes correct, pure.
- pickRoundInputs: each mode + each round, fall-through behavior.

Integration (`server/tests/tournament-orchestrator.test.ts`):
- POST /api/v1/tournaments creates the row + initial matches table + schedules.
- Mock sort-bot-api battles to complete instantly (MSW returns CreateBattleResponse + the listener test simulates a `battle_complete` event).
- Walk a 4-bracket through to completion: assert each round fires the right matches, advancement is correct, final winner persisted.
- Walk a 6-bracket: same, with byes auto-advancing.
- Failure mode: a match's POST /v1/battles 5xxs → match `failed` → tournament `failed`.

## Reference for the listener

The global SSE listener (next slice C3) consumes sort-bot-api's `/v1/events/stream` and routes `battle_complete` events into:
1. Update `recent_battles.status='complete'`, populate `winner_bot_id`, `completed_at`.
2. If the battle's `id` matches a `tournament_matches.battle_id`, call `advanceMatch`.

That's the wiring that makes the orchestrator reactive instead of polled. Polling stays as the safety net.
