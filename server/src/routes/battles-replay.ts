import { Hono } from 'hono';

import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';

import type { AppContext } from '../auth/middleware.js';

interface ReplayRound {
  round: number;
  input_id: string;
  input_name: string;
  a_time_seconds: number;
  b_time_seconds: number;
  delta_seconds: number;
  winner_bot_id: string | null;
}

interface ReplayPayload {
  battle_id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  bot_a_id: string;
  bot_b_id: string;
  winner_bot_id: string | null;
  outcome: 'a_ko' | 'b_ko' | 'a_decision' | 'b_decision' | 'draw' | null;
  a_rounds_won: number;
  b_rounds_won: number;
  rounds: ReplayRound[];
  completed_at: string | null;
}

export function battlesReplayRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/:id/replay', async (c) => {
    const id = c.req.param('id');
    try {
      const { battle, runs } = await deps.sortBotApi.getBattle(id);

      const rounds: ReplayRound[] = runs.map((run, i) => {
        const a = run.bot_a_duration_ms ?? 0;
        const b = run.bot_b_duration_ms ?? 0;
        return {
          round: i + 1,
          input_id: String(run.input_id),
          input_name: `Input #${run.input_id}`,
          a_time_seconds: a / 1000,
          b_time_seconds: b / 1000,
          delta_seconds: Math.abs(a - b) / 1000,
          winner_bot_id: run.winner_bot_id,
        };
      });

      const winner = battle.winner_bot_id;
      let outcome: ReplayPayload['outcome'];
      if (battle.status !== 'complete') {
        outcome = null;
      } else if (winner === battle.bot_a_id) {
        outcome = battle.bot_b_wins === 0 ? 'a_ko' : 'a_decision';
      } else if (winner === battle.bot_b_id) {
        outcome = battle.bot_a_wins === 0 ? 'b_ko' : 'b_decision';
      } else {
        outcome = 'draw';
      }

      const payload: ReplayPayload = {
        battle_id: battle.id,
        status: battle.status,
        bot_a_id: battle.bot_a_id,
        bot_b_id: battle.bot_b_id,
        winner_bot_id: winner,
        outcome,
        a_rounds_won: battle.bot_a_wins,
        b_rounds_won: battle.bot_b_wins,
        rounds,
        completed_at: battle.completed_at,
      };
      return c.json(payload);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        if (err.status === 404) return c.json({ error: 'not_found' }, 404);
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }
  });

  return r;
}
