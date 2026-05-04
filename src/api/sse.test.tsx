import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

import { useBattleEvents } from './sse';

interface MockEventSourceInstance {
  url: string;
  close: () => void;
  closed: boolean;
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  triggerError: () => void;
  triggerOpen: () => void;
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

  triggerOpen(): void {
    this.onopen?.(new Event('open'));
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
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useBattleEvents('bat_y', { fighterAId: 'a', fighterBId: 'b' }),
        );
        await vi.waitFor(() => expect(mockInstances.length).toBe(1));
        act(() => mockInstances[0]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
      } finally {
        vi.useRealTimers();
      }
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
      // Three errors, separated by their backoff windows so the hook
      // actually re-creates the EventSource between them.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        act(() => mockInstances[mockInstances.length - 1]!.triggerError());
        if (attempt < 3) {
          await waitFor(() => expect(mockInstances.length).toBe(attempt + 1), { timeout: 5_000 });
        }
      }
      await waitFor(
        () => expect(result.current.events.some((e) => e.type === 'round_start')).toBe(true),
        { timeout: 8_000 },
      );
      await waitFor(
        () => expect(result.current.events.some((e) => e.type === 'fight_end')).toBe(true),
        { timeout: 8_000 },
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
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        act(() => mockInstances[mockInstances.length - 1]!.triggerError());
        if (attempt < 3) {
          await waitFor(() => expect(mockInstances.length).toBe(attempt + 1), { timeout: 5_000 });
        }
      }
      await waitFor(
        () => expect(result.current.events.filter((e) => e.type === 'fight_end')).toHaveLength(1),
        { timeout: 8_000 },
      );
    });

    it('reconnects after one error then resets attempts on onopen', async () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useBattleEvents('bat_recover_1', { fighterAId: 'a', fighterBId: 'b' }),
        );
        await vi.waitFor(() => expect(mockInstances.length).toBe(1));

        // Open initial connection.
        act(() => mockInstances[0]!.triggerOpen());
        expect(result.current.status).toBe('open');

        // First error → reconnecting.
        act(() => mockInstances[0]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
        expect(mockInstances[0]!.closed).toBe(true);

        // Advance past the first backoff (500ms + max jitter 600ms).
        await act(async () => {
          await vi.advanceTimersByTimeAsync(700);
        });
        expect(mockInstances.length).toBe(2);
        expect(result.current.status).toBe('connecting');

        // New connection opens → attempts reset.
        act(() => mockInstances[1]!.triggerOpen());
        expect(result.current.status).toBe('open');

        // Another error far later — should count as attempt 1, not 2.
        act(() => mockInstances[1]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(700);
        });
        expect(mockInstances.length).toBe(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reconnects after two errors then recovers', async () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useBattleEvents('bat_recover_2', { fighterAId: 'a', fighterBId: 'b' }),
        );
        await vi.waitFor(() => expect(mockInstances.length).toBe(1));

        // First error → reconnect after ~500ms.
        act(() => mockInstances[0]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(700);
        });
        expect(mockInstances.length).toBe(2);

        // Second error → reconnect after ~1000ms.
        act(() => mockInstances[1]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1300);
        });
        expect(mockInstances.length).toBe(3);

        // Recovery on third connection.
        act(() => mockInstances[2]!.triggerOpen());
        expect(result.current.status).toBe('open');
      } finally {
        vi.useRealTimers();
      }
    });

    it('falls back to polling on the third error and sets status=polling', async () => {
      vi.useFakeTimers();
      server.use(
        http.get('http://api.test/api/v1/battles/bat_3err/replay', () =>
          HttpResponse.json(replayPayload('pending')),
        ),
      );
      try {
        const { result } = renderHook(() =>
          useBattleEvents('bat_3err', { fighterAId: 'a', fighterBId: 'b' }),
        );
        await vi.waitFor(() => expect(mockInstances.length).toBe(1));

        // Error 1
        act(() => mockInstances[0]!.triggerError());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(700);
        });
        expect(mockInstances.length).toBe(2);

        // Error 2
        act(() => mockInstances[1]!.triggerError());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1300);
        });
        expect(mockInstances.length).toBe(3);

        // Error 3 — should NOT spawn a 4th EventSource; should switch to polling.
        act(() => mockInstances[2]!.triggerError());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });
        expect(mockInstances.length).toBe(3);
        expect(result.current.status).toBe('polling');
        expect(mockInstances[2]!.closed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('surfaces a poll error when /replay returns a shape ReplayPayloadSchema rejects', async () => {
      // Malformed shape: `outcome` is a non-union string the schema rejects.
      server.use(
        http.get('http://api.test/api/v1/battles/bat_malformed/replay', () =>
          HttpResponse.json({
            battle_id: 'bat_malformed',
            status: 'complete',
            bot_a_id: 'a',
            bot_b_id: 'b',
            winner_bot_id: 'a',
            outcome: 'totally_invalid',
            a_rounds_won: 1,
            b_rounds_won: 0,
            rounds: [],
            completed_at: '2026-04-30T00:00:00Z',
          }),
        ),
      );

      const { result } = renderHook(() =>
        useBattleEvents('bat_malformed', { fighterAId: 'a', fighterBId: 'b' }),
      );
      await waitFor(() => expect(mockInstances.length).toBe(1));
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        act(() => mockInstances[mockInstances.length - 1]!.triggerError());
        if (attempt < 3) {
          await waitFor(() => expect(mockInstances.length).toBe(attempt + 1), { timeout: 5_000 });
        }
      }
      await waitFor(() => expect(result.current.error).toMatchObject({ name: 'ApiError' }), {
        timeout: 8_000,
      });
      // The malformed shape never produces a fight_end — replay() is gated on
      // schema validation passing.
      expect(result.current.events.some((e) => e.type === 'fight_end')).toBe(false);
    });

    it('does not reconnect when unmounted during the reconnect window', async () => {
      vi.useFakeTimers();
      try {
        const { result, unmount } = renderHook(() =>
          useBattleEvents('bat_unmount', { fighterAId: 'a', fighterBId: 'b' }),
        );
        await vi.waitFor(() => expect(mockInstances.length).toBe(1));

        act(() => mockInstances[0]!.triggerError());
        expect(result.current.status).toBe('reconnecting');
        expect(mockInstances.length).toBe(1);

        // Unmount before the timer fires.
        unmount();

        // Advance well past the first backoff.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        // No new EventSource was constructed.
        expect(mockInstances.length).toBe(1);
        expect(mockInstances[0]!.closed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
