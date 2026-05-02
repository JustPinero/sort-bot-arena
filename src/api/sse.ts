import { useEffect, useMemo, useState } from 'react';

import { deriveBattleState } from '@/lib/battleReducer';

import { battleEventSchema } from './battleSchema';
import { apiClient } from './client';
import { config } from './config';

import type { BattleEvent, BattleOutcome } from './types';

export type SseStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'polling' | 'failed';

const RECONNECT_BACKOFFS_MS = [500, 1000, 2000] as const;
const MAX_SSE_FAILURES = RECONNECT_BACKOFFS_MS.length;
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_DURATION_MS = 5 * 60_000;
const REPLAY_GAP_MS = 500;

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

interface UseBattleEventsResult {
  events: BattleEvent[];
  derived: ReturnType<typeof deriveBattleState>;
  connected: boolean;
  status: SseStatus;
  error: Error | null;
}

interface UseBattleEventsOptions {
  fighterAId: string | undefined;
  fighterBId: string | undefined;
  enabled?: boolean;
}

export function useBattleEvents(
  battleId: string | undefined,
  opts: UseBattleEventsOptions,
): UseBattleEventsResult {
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [status, setStatus] = useState<SseStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const enabled = opts.enabled !== false && Boolean(battleId);

  useEffect(() => {
    if (!enabled || !battleId) return;

    setEvents([]);
    setError(null);

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let replayTimer: ReturnType<typeof setTimeout> | null = null;
    let pollAbort: AbortController | null = null;
    let pollStartedAt = 0;
    let attempts = 0;
    let cancelled = false;

    const replay = (payload: ReplayPayload) => {
      const ts = () => new Date().toISOString();
      let i = 0;

      const flushNext = () => {
        if (cancelled) return;
        if (i >= payload.rounds.length) {
          const fightEnd: BattleEvent = {
            type: 'fight_end',
            winner_bot_id: payload.winner_bot_id,
            outcome: mapOutcome(payload.outcome),
            a_rounds_won: payload.a_rounds_won,
            b_rounds_won: payload.b_rounds_won,
            ts: payload.completed_at ?? ts(),
          };
          setEvents((prev) =>
            prev.some((e) => e.type === 'fight_end') ? prev : [...prev, fightEnd],
          );
          setStatus('open');
          return;
        }
        const round = payload.rounds[i]!;
        i += 1;
        const startEvent: BattleEvent = {
          type: 'round_start',
          round: round.round,
          input_id: round.input_id,
          input_name: round.input_name,
          ts: ts(),
        };
        const endEvents: BattleEvent[] = round.winner_bot_id
          ? [
              {
                type: 'round_end',
                round: round.round,
                winner_bot_id: round.winner_bot_id,
                a_time_seconds: round.a_time_seconds,
                b_time_seconds: round.b_time_seconds,
                delta_seconds: round.delta_seconds,
                ts: ts(),
              },
            ]
          : [];
        setEvents((prev) => [...prev, startEvent, ...endEvents]);
        replayTimer = setTimeout(flushNext, REPLAY_GAP_MS);
      };

      flushNext();
    };

    const startPolling = () => {
      if (cancelled) return;
      if (es) {
        es.close();
        es = null;
      }
      setStatus('polling');
      pollStartedAt = Date.now();
      pollAbort = new AbortController();

      const tick = async () => {
        if (cancelled) return;
        try {
          const replayPayload = await apiClient.get<ReplayPayload>(
            `/api/v1/battles/${battleId}/replay`,
            { signal: pollAbort?.signal },
          );
          if (replayPayload.status === 'complete' || replayPayload.status === 'failed') {
            replay(replayPayload);
            return;
          }
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err : new Error('poll failed'));
        }
        if (Date.now() - pollStartedAt > POLL_MAX_DURATION_MS) {
          setStatus('failed');
          return;
        }
        pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
      };

      void tick();
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const base = RECONNECT_BACKOFFS_MS[attempts - 1] ?? 2000;
      const jitter = base * (0.8 + Math.random() * 0.4);
      setStatus('reconnecting');
      reconnectTimer = setTimeout(() => {
        if (!cancelled) connect();
      }, jitter);
    };

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      const url = `${config.apiBaseUrl}/api/v1/battles/${battleId}/events`;
      es = new EventSource(url);

      es.onopen = () => {
        attempts = 0;
        setStatus('open');
      };
      es.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data);
          const parsed = battleEventSchema.safeParse(raw);
          if (!parsed.success) {
            console.warn('dropping malformed battle event', parsed.error.issues);
            return;
          }
          setEvents((prev) => [...prev, parsed.data]);
        } catch {
          // ignore malformed JSON
        }
      };
      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        es = null;
        attempts += 1;
        setError(new Error('SSE connection failed'));
        if (attempts >= MAX_SSE_FAILURES) {
          startPolling();
        } else {
          scheduleReconnect();
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearTimeout(pollTimer);
      if (replayTimer) clearTimeout(replayTimer);
      if (pollAbort) pollAbort.abort();
      setStatus('idle');
    };
  }, [battleId, enabled]);

  const derived = useMemo(
    () => deriveBattleState(events, opts.fighterAId ?? '', opts.fighterBId ?? ''),
    [events, opts.fighterAId, opts.fighterBId],
  );

  return {
    events,
    derived,
    connected: status === 'open',
    status,
    error,
  };
}

function mapOutcome(outcome: ReplayPayload['outcome']): BattleOutcome {
  switch (outcome) {
    case 'a_ko':
    case 'b_ko':
      return 'ko';
    case 'a_decision':
    case 'b_decision':
      return 'decision';
    case 'draw':
      return 'draw';
    default:
      return 'no_contest';
  }
}
