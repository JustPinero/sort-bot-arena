import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

import { useBattleEvents } from './sse';

interface MockEventSourceInstance {
  url: string;
  close: () => void;
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  triggerError: () => void;
}

let mockInstances: MockEventSourceInstance[] = [];

class MockEventSource implements MockEventSourceInstance {
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  triggerError(): void {
    this.onerror?.(new Event('error'));
  }
}

const replayPayload = (status: 'pending' | 'complete' = 'complete') => ({
  battle_id: 'bat_z',
  status,
  bot_a_id: 'a',
  bot_b_id: 'b',
  winner_bot_id: status === 'complete' ? 'a' : null,
  outcome: status === 'complete' ? 'a_ko' : null,
  a_rounds_won: 2,
  b_rounds_won: 0,
  rounds:
    status === 'complete'
      ? [
          {
            round: 1,
            input_id: '5',
            input_name: 'Input #5',
            a_time_seconds: 0.1,
            b_time_seconds: 0.15,
            delta_seconds: 0.05,
            winner_bot_id: 'a',
          },
          {
            round: 2,
            input_id: '6',
            input_name: 'Input #6',
            a_time_seconds: 0.12,
            b_time_seconds: 0.16,
            delta_seconds: 0.04,
            winner_bot_id: 'a',
          },
        ]
      : [],
  completed_at: status === 'complete' ? '2026-04-30T00:00:00Z' : null,
});

describe('useBattleEvents', () => {
  it('returns idle initial state when disabled', () => {
    const { result } = renderHook(() =>
      useBattleEvents('bat_x', { fighterAId: 'a', fighterBId: 'b', enabled: false }),
    );
    expect(result.current.events).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.derived.status).toBe('pre_fight');
  });

  it('returns idle initial state when battleId is undefined', () => {
    const { result } = renderHook(() =>
      useBattleEvents(undefined, { fighterAId: 'a', fighterBId: 'b' }),
    );
    expect(result.current.events).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  describe('with EventSource', () => {
    beforeEach(() => {
      mockInstances = [];
      vi.stubGlobal('EventSource', MockEventSource);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('reports reconnecting after a single SSE error', async () => {
      const { result } = renderHook(() =>
        useBattleEvents('bat_y', { fighterAId: 'a', fighterBId: 'b' }),
      );
      await waitFor(() => expect(mockInstances.length).toBe(1));
      act(() => mockInstances[0]!.triggerError());
      expect(result.current.status).toBe('reconnecting');
    });

    it('falls back to polling after MAX_SSE_FAILURES errors and replays rounds', async () => {
      server.use(
        http.get('http://api.test/api/v1/battles/bat_z/replay', () =>
          HttpResponse.json(replayPayload('complete')),
        ),
      );

      const { result } = renderHook(() =>
        useBattleEvents('bat_z', { fighterAId: 'a', fighterBId: 'b' }),
      );
      await waitFor(() => expect(mockInstances.length).toBe(1));
      act(() => {
        mockInstances[0]!.triggerError();
        mockInstances[0]!.triggerError();
        mockInstances[0]!.triggerError();
      });
      await waitFor(
        () => expect(result.current.events.some((e) => e.type === 'round_start')).toBe(true),
        { timeout: 3_000 },
      );
      await waitFor(
        () => expect(result.current.events.some((e) => e.type === 'fight_end')).toBe(true),
        { timeout: 5_000 },
      );
      const types = result.current.events.map((e) => e.type);
      expect(types.filter((t) => t === 'fight_end')).toHaveLength(1);
    });

    it('does not duplicate fight_end across multiple polls', async () => {
      server.use(
        http.get('http://api.test/api/v1/battles/bat_dup/replay', () =>
          HttpResponse.json(replayPayload('complete')),
        ),
      );
      const { result } = renderHook(() =>
        useBattleEvents('bat_dup', { fighterAId: 'a', fighterBId: 'b' }),
      );
      await waitFor(() => expect(mockInstances.length).toBe(1));
      act(() => {
        mockInstances[0]!.triggerError();
        mockInstances[0]!.triggerError();
        mockInstances[0]!.triggerError();
      });
      await waitFor(
        () => expect(result.current.events.filter((e) => e.type === 'fight_end')).toHaveLength(1),
        { timeout: 5_000 },
      );
    });
  });
});
