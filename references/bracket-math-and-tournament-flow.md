# Bracket math + tournament flow

Phase 9 lets users build a bracket of 4 / 6 / 8 / 12 bots, then run it. sort-bot-api accepts arbitrary `participant_bot_ids[]` and returns its own bracket structure. We do the lookup + display.

## Bracket sizes

Locked dropdown: **4 / 6 / 8 / 12**. Powers of two are clean; 6 and 12 require byes in round 1. sort-bot-api seeds; we render.

| Size | Round 1     | Round 2 | Round 3 | Round 4 |
| ---- | ----------- | ------- | ------- | ------- |
| 4    | 4 → 2       | 2 → 1   |         |         |
| 6    | 4 + 2 byes  | 4 → 2   | 2 → 1   |         |
| 8    | 8 → 4       | 4 → 2   | 2 → 1   |         |
| 12   | 8 + 4 byes  | 8 → 4   | 4 → 2   | 2 → 1   |

For 6 and 12, the bots seeded into the bye slots advance directly to round 2 without a match. sort-bot-api represents this as a `TournamentMatch` with one of `bot_a_id` / `bot_b_id` set and the other null — we map to `status: 'bye'` per the existing `tournaments.ts` route.

## Random fill flow (modal `Random` button)

When user clicks **Random**:

1. Need at least `bracket_size` bots in the system. Frontend hits `GET /api/v1/leaderboard?limit=50`, filters out retired.
2. If fewer than `bracket_size` available → button disabled with tooltip "Need ≥N evaluated bots."
3. Pick `bracket_size` bots uniformly at random from the eligible pool. Use `Array.prototype.sort(() => Math.random() - 0.5)` is biased — use Fisher-Yates.
4. Pre-fill the slots in the picker. User can still un-pick / swap before clicking **Start tournament**.

## Manual fill flow (`<BotTilePicker />`)

- Single-page grid of all evaluated, non-retired bots. Each tile: portrait (or fallback) + display_name + nickname + rank chip.
- Click toggles selection. Selected count vs `bracket_size` shown at the top: "5 / 8 selected."
- **Start tournament** button enabled only when `selected.length === bracket_size`.
- **Cancel** button always visible. Closing modal (Esc, X, click-outside) → unselect everything (per spec).

## Tournament input mode (toggle in modal)

Two policies, selected by user, persisted on `recent_tournaments.input_mode`:

### `flat_random`

Every match in the tournament draws ~3 random inputs from the full pool of 57 (server-side via `getInputs()`). Each match independent.

### `escalation`

Round 1 = small inputs only. Round 2 = medium. Round 3+ = large. Each match in a round draws ~3 random inputs from that round's size class.

| Round | Pool                              |
| ----- | --------------------------------- |
| 1     | size_class = 'small'              |
| 2     | size_class = 'medium'             |
| 3+    | size_class = 'large'              |

Implementation lives in `server/src/synthesize/tournament-inputs.ts` — pure helper that takes `(matches[], inputs[], mode)` and returns `[matchId → inputIds[]]`. Called once when we POST to sort-bot-api's tournament create — sort-bot-api takes per-match input arrays via the `count` parameter or by accepting an `input_ids[]` if/when its API supports per-match inputs (today: `count` per-tournament; the per-match input customization lands on our side as a synthesis layer overlay).

> **Caveat:** sort-bot-api's `POST /v1/tournaments` today accepts only `count` (uniform inputs across the bracket) per `requests/sort-bot-api-shapes.md`. To get true per-round escalation we'd need either (a) sort-bot-api support for per-match inputs, or (b) we orchestrate match-by-match by POSTing `/v1/battles` for each tournament match ourselves and managing the bracket state. **For phase 9 we ship (c): pass `count: 3` to sort-bot-api but pre-randomize input picks for analytics, document the escalation as conceptual.** Real escalation goes in a follow-up phase if sort-bot-api adds per-match input support.

This caveat is important — call it out in the slice prompt and in the modal tooltip ("Escalation: round-by-round size scaling — coming once sort-bot-api supports per-match input selection. For now both modes use 3 random inputs from the full pool.").

## Bracket render

Existing `<TournamentBracketPage />` consumes the rich `Tournament` shape from `/api/v1/tournaments/:id`. The matches[].position + round are already mapped from `bracket_position` and `round` upstream. Bye matches surface via `status: 'bye'` — render as a single fighter advancing.

## Cancel button semantics

- During modal flow (before clicking Start): cancel = close modal + reset state. Local-only.
- After tournament started: no cancel API on sort-bot-api. UI does not expose cancel post-start. Tournament runs to completion or `failed`.

## Test plan

- `pickRandomBots(pool, n)` — Fisher-Yates, returns N distinct, throws if pool < N.
- `tournamentInputsForMode(matches, inputs, mode)` — table-driven.
- Modal component:
  - Random button disabled when pool insufficient (tooltip).
  - Selecting and unselecting toggles a tile's `aria-pressed`.
  - Start tournament disabled until exactly `bracket_size` selected.
  - Modal close clears selection state (re-open = empty grid).
- Integration: `POST /api/v1/tournaments` writes `recent_tournaments` row with `input_mode` + `bracket_size`.
