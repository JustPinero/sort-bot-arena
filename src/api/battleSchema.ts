import { z } from 'zod';

const baseTs = z.object({ ts: z.string() });

export const battleEventSchema = z.discriminatedUnion('type', [
  baseTs.extend({ type: z.literal('walkout'), bot_id: z.string() }),
  baseTs.extend({ type: z.literal('fight_start') }),
  baseTs.extend({
    type: z.literal('round_start'),
    round: z.number().int().min(1),
    input_id: z.string(),
    input_name: z.string(),
  }),
  baseTs.extend({
    type: z.literal('round_progress'),
    round: z.number().int().min(1),
    bot_id: z.string(),
    progress_pct: z.number().min(0).max(100),
  }),
  baseTs.extend({
    type: z.literal('round_end'),
    round: z.number().int().min(1),
    winner_bot_id: z.string(),
    a_time_seconds: z.number().nonnegative(),
    b_time_seconds: z.number().nonnegative(),
    delta_seconds: z.number(),
  }),
  baseTs.extend({
    type: z.literal('fighter_downed'),
    bot_id: z.string(),
    reason: z.enum(['timeout', 'crash', 'oom']),
  }),
  baseTs.extend({ type: z.literal('commentary'), text: z.string() }),
  baseTs.extend({
    type: z.literal('fight_end'),
    winner_bot_id: z.string().nullable(),
    outcome: z.enum(['ko', 'tko', 'decision', 'draw', 'no_contest']),
    a_rounds_won: z.number().int().nonnegative(),
    b_rounds_won: z.number().int().nonnegative(),
    rank_change: z
      .object({
        previous_champion_bot_id: z.string(),
        new_champion_bot_id: z.string(),
      })
      .optional(),
  }),
]);
