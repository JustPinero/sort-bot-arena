import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { log } from '../lib/log.js';
import {
  translateBackendEvent,
  type BackendBattleEvent,
  type FrontendBattleEvent,
  type TranslateContext,
} from '../synthesize/battle-events.js';

import type { AppContext } from '../auth/middleware.js';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';

// GET /api/v1/battles/:id/events
// Subscribes to sort-bot-api's per-battle SSE feed, runs each event through
// the BattleViewer-shaped translator, and forwards as a fresh SSE stream
// for the browser. If the upstream battle has already completed (no more
// events to come), the upstream connection closes immediately and we fall
// back to one synthetic fight_end event derived from the materialized
// /v1/battles/:id state so the frontend BattleViewer doesn't hang.

export function battlesSseRoutes(deps: {
  sortBotApi: SortBotApiClient;
  upstreamBaseUrl: string;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/:id/events', (c) => {
    const battleId = c.req.param('id');

    return streamSSE(c, async (stream) => {
      const ctx: TranslateContext = { inputs: [], bot_a: '', bot_b: '' };
      const upstreamUrl = `${deps.upstreamBaseUrl}/v1/battles/${battleId}/events`;

      let receivedAny = false;
      try {
        await proxyUpstream(upstreamUrl, async (rawEvent) => {
          receivedAny = true;
          const translated = translateBackendEvent(rawEvent, {
            ...ctx,
            ts: new Date().toISOString(),
          });
          ctx.inputs = translated.next.inputs;
          ctx.bot_a = translated.next.bot_a;
          ctx.bot_b = translated.next.bot_b;
          for (const fe of translated.events) {
            await sendEvent(stream, fe);
          }
        });
      } catch (err) {
        log.warn(
          { battle_id: battleId, err: err instanceof Error ? err.message : String(err) },
          'battle SSE upstream error',
        );
      }

      // Fallback: upstream returned no events (battle already ended). Reconstruct
      // a single fight_end from the materialized state so the BattleViewer
      // resolves instead of spinning.
      if (!receivedAny) {
        try {
          const battle = await deps.sortBotApi.getBattle(battleId);
          const winner = battle.battle.winner_bot_id;
          const a = battle.battle.bot_a_id;
          const b = battle.battle.bot_b_id;
          const aWins = battle.battle.bot_a_wins;
          const bWins = battle.battle.bot_b_wins;
          let outcome: 'a_decision' | 'b_decision' | 'a_ko' | 'b_ko' | 'draw';
          if (winner === a) outcome = bWins === 0 ? 'a_ko' : 'a_decision';
          else if (winner === b) outcome = aWins === 0 ? 'b_ko' : 'b_decision';
          else outcome = 'draw';
          await sendEvent(stream, {
            type: 'fight_end',
            winner_bot_id: winner,
            outcome,
            a_rounds_won: aWins,
            b_rounds_won: bWins,
            ts: new Date().toISOString(),
          });
        } catch (err) {
          log.warn(
            { battle_id: battleId, err: err instanceof Error ? err.message : String(err) },
            'battle SSE fallback reconstruction failed',
          );
        }
      }
    });
  });

  return r;
}

async function sendEvent(
  stream: { writeSSE: (event: { event?: string; data: string }) => Promise<void> },
  event: FrontendBattleEvent,
): Promise<void> {
  await stream.writeSSE({ data: JSON.stringify(event) });
}

// Minimal SSE consumer over fetch — node has no built-in EventSource. We
// stream the response body, parse `event:`/`data:` lines, and yield each
// payload back to the caller as a structured BackendBattleEvent.
async function proxyUpstream(
  url: string,
  onEvent: (e: BackendBattleEvent) => Promise<void>,
): Promise<void> {
  const res = await fetch(url, { headers: { accept: 'text/event-stream' } });
  if (!res.ok || !res.body) {
    throw new Error(`upstream battle SSE ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let pendingType: BackendBattleEvent['type'] | '' = '';
  let pendingData = '';

  let streamDone = false;
  while (!streamDone) {
    const { value, done } = await reader.read();
    if (done) {
      streamDone = true;
      break;
    }
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line === '') {
        if (pendingType && pendingData) {
          try {
            const data = JSON.parse(pendingData);
            await onEvent({ type: pendingType, data } as BackendBattleEvent);
          } catch {
            // skip malformed event
          }
        }
        pendingType = '';
        pendingData = '';
      } else if (line.startsWith('event:')) {
        pendingType = line.slice(6).trim() as BackendBattleEvent['type'];
      } else if (line.startsWith('data:')) {
        pendingData = (pendingData ? pendingData + '\n' : '') + line.slice(5).trim();
      }
    }
  }
}
