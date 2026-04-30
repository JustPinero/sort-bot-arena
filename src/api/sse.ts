import { useEffect, useMemo, useState } from 'react';

import { deriveBattleState } from '@/lib/battleReducer';

import { battleEventSchema } from './battleSchema';
import { config } from './config';

import type { BattleEvent } from './types';

interface UseBattleEventsResult {
  events: BattleEvent[];
  derived: ReturnType<typeof deriveBattleState>;
  connected: boolean;
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
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = opts.enabled !== false && Boolean(battleId);

  useEffect(() => {
    if (!enabled || !battleId) return;

    setEvents([]);
    setError(null);

    const url = `${config.apiBaseUrl}/api/v1/battles/${battleId}/events`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
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
      setConnected(false);
      setError(new Error('SSE connection failed'));
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [battleId, enabled]);

  const derived = useMemo(
    () => deriveBattleState(events, opts.fighterAId ?? '', opts.fighterBId ?? ''),
    [events, opts.fighterAId, opts.fighterBId],
  );

  return { events, derived, connected, error };
}
