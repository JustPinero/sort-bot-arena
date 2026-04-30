import { describe, expect, it } from 'vitest';

import {
  deriveKoPercentage,
  deriveRecentForm,
  deriveRecord,
  toBattleForBot,
  translateBackendEvent,
  type BattleForBot,
} from '../src/synthesize/index.js';

import type { BattleResponse } from '../src/clients/sort-bot-api/index.js';

function makeBattle(
  overrides: Partial<BattleResponse['battle']>,
  runs: BattleResponse['runs'] = [],
): BattleResponse {
  const battle: BattleResponse['battle'] = {
    id: 'bat_1',
    bot_a_id: 'a',
    bot_b_id: 'b',
    initiator_id: 'u',
    status: 'complete',
    winner_bot_id: 'a',
    bot_a_wins: 1,
    bot_b_wins: 0,
    ties: 0,
    created_at: '2026-04-01T00:00:00Z',
    completed_at: '2026-04-01T00:01:00Z',
    ...overrides,
  };
  return { battle, runs };
}

function bb(overrides: Partial<BattleForBot>): BattleForBot {
  return {
    battle_id: 'bat',
    bot_was: 'a',
    outcome: 'win',
    is_ko: false,
    completed_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('toBattleForBot', () => {
  it('marks a win, opponent crashed → KO', () => {
    const b = makeBattle({ winner_bot_id: 'a' }, [
      {
        id: 1,
        battle_id: 'bat_1',
        input_id: 1,
        bot_a_duration_ms: 10,
        bot_b_duration_ms: null,
        bot_a_status: 'success',
        bot_b_status: 'crash',
        winner_bot_id: 'a',
        completed_at: 'T',
      },
    ]);
    expect(toBattleForBot('a', b)).toMatchObject({ outcome: 'win', is_ko: true });
  });

  it('decision win (opponent succeeded every run, just slower) is NOT a KO', () => {
    const b = makeBattle({ winner_bot_id: 'a' }, [
      {
        id: 1,
        battle_id: 'bat_1',
        input_id: 1,
        bot_a_duration_ms: 9,
        bot_b_duration_ms: 10,
        bot_a_status: 'success',
        bot_b_status: 'success',
        winner_bot_id: 'a',
        completed_at: 'T',
      },
    ]);
    expect(toBattleForBot('a', b)).toMatchObject({ outcome: 'win', is_ko: false });
  });

  it('marks a loss as outcome=loss with is_ko=false', () => {
    const b = makeBattle({ winner_bot_id: 'b' });
    expect(toBattleForBot('a', b)).toMatchObject({ outcome: 'loss', is_ko: false });
  });

  it('marks a draw (winner_bot_id null) as outcome=draw', () => {
    const b = makeBattle({ winner_bot_id: null });
    expect(toBattleForBot('a', b)).toMatchObject({ outcome: 'draw', is_ko: false });
  });

  it('uses created_at when completed_at is null', () => {
    const b = makeBattle({ completed_at: null, created_at: '2026-04-02T00:00:00Z' });
    expect(toBattleForBot('a', b).completed_at).toBe('2026-04-02T00:00:00Z');
  });
});

describe('deriveRecord', () => {
  it('counts wins/losses/draws', () => {
    const h = [
      bb({ outcome: 'win' }),
      bb({ outcome: 'win' }),
      bb({ outcome: 'loss' }),
      bb({ outcome: 'draw' }),
    ];
    expect(deriveRecord(h)).toEqual({ wins: 2, losses: 1, draws: 1 });
  });

  it('returns 0/0/0 for empty history', () => {
    expect(deriveRecord([])).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});

describe('deriveKoPercentage', () => {
  it('returns 0 when no wins', () => {
    expect(deriveKoPercentage([bb({ outcome: 'loss' }), bb({ outcome: 'draw' })])).toBe(0);
  });

  it('rounds to 1 decimal', () => {
    const h = [
      bb({ outcome: 'win', is_ko: true }),
      bb({ outcome: 'win', is_ko: false }),
      bb({ outcome: 'win', is_ko: false }),
    ];
    expect(deriveKoPercentage(h)).toBe(33.3);
  });

  it('100% when every win was a KO', () => {
    const h = [bb({ outcome: 'win', is_ko: true }), bb({ outcome: 'win', is_ko: true })];
    expect(deriveKoPercentage(h)).toBe(100);
  });
});

describe('deriveRecentForm', () => {
  it('most recent first, capped at N', () => {
    const h = [
      bb({ outcome: 'win', completed_at: '2026-04-01T00:00:00Z' }),
      bb({ outcome: 'loss', completed_at: '2026-04-02T00:00:00Z' }),
      bb({ outcome: 'win', completed_at: '2026-04-03T00:00:00Z' }),
      bb({ outcome: 'draw', completed_at: '2026-04-04T00:00:00Z' }),
    ];
    expect(deriveRecentForm(h, 3)).toEqual(['D', 'W', 'L']);
  });
});

describe('translateBackendEvent', () => {
  const startCtx = { inputs: [], bot_a: 'a', bot_b: 'b', ts: 'T' };

  it('battle_start emits two walkouts + fight_start and stashes inputs/bot ids', () => {
    const r = translateBackendEvent(
      {
        type: 'battle_start',
        data: { battle_id: 'bat', bot_a: 'a', bot_b: 'b', inputs: [10, 20, 30] },
      },
      startCtx,
    );
    expect(r.events).toEqual([
      { type: 'walkout', bot_id: 'a', ts: 'T' },
      { type: 'walkout', bot_id: 'b', ts: 'T' },
      { type: 'fight_start', ts: 'T' },
    ]);
    expect(r.next.inputs).toEqual([10, 20, 30]);
  });

  it('run_start derives round number from input position', () => {
    const ctx = { inputs: [10, 20, 30], bot_a: 'a', bot_b: 'b', ts: 'T' };
    const r = translateBackendEvent(
      { type: 'run_start', data: { battle_id: 'bat', input_id: 20 } },
      ctx,
    );
    expect(r.events).toEqual([
      { type: 'round_start', round: 2, input_id: '20', input_name: 'Input #20', ts: 'T' },
    ]);
  });

  it('run_complete emits fighter_downed when a side has a non-success status', () => {
    const ctx = { inputs: [10], bot_a: 'a', bot_b: 'b', ts: 'T' };
    const r = translateBackendEvent(
      {
        type: 'run_complete',
        data: {
          battle_id: 'bat',
          input_id: 10,
          bot_a_status: 'success',
          bot_b_status: 'crash',
          bot_a_duration_ms: 27,
          bot_b_duration_ms: null,
          winner_bot_id: 'a',
        },
      },
      ctx,
    );
    const types = r.events.map((e) => e.type);
    expect(types).toContain('fighter_downed');
    const downed = r.events.find((e) => e.type === 'fighter_downed')! as Extract<
      (typeof r.events)[number],
      { type: 'fighter_downed' }
    >;
    expect(downed.bot_id).toBe('b');
    expect(downed.reason).toBe('crash');
    const roundEnd = r.events.find((e) => e.type === 'round_end')! as Extract<
      (typeof r.events)[number],
      { type: 'round_end' }
    >;
    expect(roundEnd.round).toBe(1);
    expect(roundEnd.a_time_seconds).toBe(0.027);
    expect(roundEnd.b_time_seconds).toBe(0);
    expect(roundEnd.winner_bot_id).toBe('a');
  });

  it('battle_complete maps shutout to KO outcome', () => {
    const ctx = { inputs: [10, 20], bot_a: 'a', bot_b: 'b', ts: 'T' };
    const r = translateBackendEvent(
      {
        type: 'battle_complete',
        data: {
          battle_id: 'bat',
          winner_bot_id: 'a',
          bot_a_wins: 2,
          bot_b_wins: 0,
          ties: 0,
        },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({
      type: 'fight_end',
      winner_bot_id: 'a',
      outcome: 'a_ko',
      a_rounds_won: 2,
      b_rounds_won: 0,
    });
  });

  it('battle_complete maps mixed-rounds win to decision', () => {
    const ctx = { inputs: [10, 20, 30], bot_a: 'a', bot_b: 'b', ts: 'T' };
    const r = translateBackendEvent(
      {
        type: 'battle_complete',
        data: {
          battle_id: 'bat',
          winner_bot_id: 'b',
          bot_a_wins: 1,
          bot_b_wins: 2,
          ties: 0,
        },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({ outcome: 'b_decision' });
  });

  it('battle_complete maps no winner to draw', () => {
    const ctx = { inputs: [10, 20], bot_a: 'a', bot_b: 'b', ts: 'T' };
    const r = translateBackendEvent(
      {
        type: 'battle_complete',
        data: {
          battle_id: 'bat',
          winner_bot_id: '',
          bot_a_wins: 0,
          bot_b_wins: 0,
          ties: 2,
        },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({ outcome: 'draw', winner_bot_id: null });
  });
});
