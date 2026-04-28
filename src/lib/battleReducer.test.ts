import { describe, expect, it } from 'vitest';

import type { BattleEvent } from '@/api/types';

import { deriveBattleState, INITIAL_BATTLE_STATE } from './battleReducer';

const ts = (s: number) => `2026-04-28T18:00:${String(s).padStart(2, '0')}Z`;
const A = 'bot_a';
const B = 'bot_b';

describe('deriveBattleState', () => {
  it('returns the initial state for an empty event log', () => {
    expect(deriveBattleState([], A, B)).toEqual(INITIAL_BATTLE_STATE);
  });

  it('marks status=live on fight_start', () => {
    const events: BattleEvent[] = [{ type: 'fight_start', ts: ts(0) }];
    expect(deriveBattleState(events, A, B).status).toBe('live');
  });

  it('tracks current round on round_start', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      { type: 'round_start', round: 1, input_id: 'i1', input_name: 'in 1', ts: ts(1) },
      { type: 'round_start', round: 2, input_id: 'i2', input_name: 'in 2', ts: ts(2) },
    ];
    const s = deriveBattleState(events, A, B);
    expect(s.currentRound).toBe(2);
    expect(s.currentInputName).toBe('in 2');
  });

  it('decrements loser health and increments winner rounds on round_end', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      {
        type: 'round_end',
        round: 1,
        winner_bot_id: A,
        a_time_seconds: 0.04,
        b_time_seconds: 0.12,
        delta_seconds: -0.08,
        ts: ts(2),
      },
    ];
    const s = deriveBattleState(events, A, B);
    expect(s.aRoundsWon).toBe(1);
    expect(s.bRoundsWon).toBe(0);
    expect(s.aHealth).toBe(100);
    expect(s.bHealth).toBeLessThan(100);
  });

  it('clamps health to 0', () => {
    const events: BattleEvent[] = Array.from({ length: 12 }, (_, i) => ({
      type: 'round_end' as const,
      round: i + 1,
      winner_bot_id: A,
      a_time_seconds: 0.04,
      b_time_seconds: 0.12,
      delta_seconds: -0.08,
      ts: ts(i + 1),
    }));
    expect(deriveBattleState(events, A, B).bHealth).toBe(0);
  });

  it('marks status=completed on fight_end', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      {
        type: 'fight_end',
        winner_bot_id: A,
        outcome: 'ko',
        a_rounds_won: 5,
        b_rounds_won: 0,
        ts: ts(60),
      },
    ];
    const s = deriveBattleState(events, A, B);
    expect(s.status).toBe('completed');
    expect(s.outcome).toBe('ko');
    expect(s.winnerBotId).toBe(A);
  });

  it('hype rises on dramatic events and decays', () => {
    const dramaticEvents: BattleEvent[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'round_end' as const,
      round: i + 1,
      winner_bot_id: A,
      a_time_seconds: 0.04,
      b_time_seconds: 0.12,
      delta_seconds: -0.08,
      ts: ts(i + 1),
    }));
    const hypeRising = deriveBattleState(dramaticEvents, A, B).hypeLevel;
    expect(hypeRising).toBeGreaterThan(0.4);

    // adding many quiet events should drop hype
    const quietEvents: BattleEvent[] = Array.from({ length: 20 }, (_, i) => ({
      type: 'round_progress' as const,
      round: 5,
      bot_id: A,
      progress_pct: i * 5,
      ts: ts(i + 6),
    }));
    const hypeAfterQuiet = deriveBattleState([...dramaticEvents, ...quietEvents], A, B).hypeLevel;
    expect(hypeAfterQuiet).toBeLessThan(hypeRising);
  });

  it('records fighter_downed with reason', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      { type: 'fighter_downed', bot_id: B, reason: 'timeout', ts: ts(3) },
    ];
    const s = deriveBattleState(events, A, B);
    expect(s.downed).toEqual({ bot_id: B, reason: 'timeout' });
  });

  it('animation cue queues round_end events with details', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      {
        type: 'round_end',
        round: 7,
        winner_bot_id: A,
        a_time_seconds: 0.041,
        b_time_seconds: 0.132,
        delta_seconds: -0.091,
        ts: ts(7),
      },
    ];
    const s = deriveBattleState(events, A, B);
    expect(s.lastEvent).toMatchObject({ type: 'round_end', winner_bot_id: A });
  });
});
