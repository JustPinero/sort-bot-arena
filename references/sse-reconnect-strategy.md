# SSE reconnect strategy (fix for `src/api/sse.ts`)

## The bug today

`useBattleEvents` in `src/api/sse.ts` looks like it has reconnect logic — `setStatus('reconnecting')` runs on `onerror` when failure count is below `MAX_SSE_FAILURES`. But **nothing actually reconnects.** The `EventSource` is dead from the upstream's perspective; the browser's built-in retry only handles transient network errors, not server-side 5xx. The hook sits in `'reconnecting'` indefinitely until a third `onerror` fires (which won't happen if the server is dead), or until the user navigates away.

In practice we accidentally fall through to the polling loop only because `onerror` fires multiple times during a real outage (the browser tries native retries, each failing, each surfacing as `onerror`). So the system ~works, but the intent doesn't match the code, and the UX is misleading.

## Strategy

Replace the silent `'reconnecting'` flag with **explicit exponential backoff reconnects**, then fall through to polling after the configured failure cap:

```
SSE.onerror → (failures < MAX_SSE_FAILURES) → close ES → schedule setTimeout(connect, backoff)
            → (failures >= MAX_SSE_FAILURES) → close ES → startPolling()
```

Backoff: 500ms, 1s, 2s (jittered ±20%). Cap at MAX_SSE_FAILURES = 3 attempts before polling fallback.

## Implementation sketch

```ts
const RECONNECT_BACKOFFS_MS = [500, 1000, 2000];
const MAX_SSE_FAILURES = RECONNECT_BACKOFFS_MS.length;
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_DURATION_MS = 5 * 60_000;

useEffect(() => {
  if (!enabled || !battleId) return;

  let cancelled = false;
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollAbort: AbortController | null = null;
  let attempts = 0;
  let pollStartedAt = 0;

  const cleanup = () => {
    cancelled = true;
    es?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pollTimer) clearTimeout(pollTimer);
    pollAbort?.abort();
  };

  const scheduleReconnect = () => {
    if (cancelled) return;
    const base = RECONNECT_BACKOFFS_MS[attempts] ?? 2000;
    const jitter = base * (0.8 + Math.random() * 0.4); // ±20%
    setStatus('reconnecting');
    reconnectTimer = setTimeout(() => {
      if (!cancelled) connect();
    }, jitter);
  };

  const connect = () => {
    if (cancelled) return;
    setStatus('connecting');
    es = new EventSource(`${config.apiBaseUrl}/api/v1/battles/${battleId}/events`);
    es.onopen = () => {
      attempts = 0;
      setStatus('open');
    };
    es.onmessage = (e) => { /* …existing parse… */ };
    es.onerror = () => {
      es?.close();
      es = null;
      attempts += 1;
      if (attempts >= MAX_SSE_FAILURES) {
        startPolling();
      } else {
        scheduleReconnect();
      }
    };
  };

  const startPolling = () => { /* …existing… */ };

  connect();
  return cleanup;
}, [battleId, enabled]);
```

Key correctness invariants:
1. `attempts` resets on `onopen` so a successful reconnection clears the failure budget.
2. `cancelled` is checked at every async entry point. Tests must verify this with a simulated unmount mid-reconnect.
3. Old `EventSource` is `close()`ed before scheduling reconnect to avoid the browser's built-in retry layering on top.
4. Backoff is jittered to prevent thundering-herd on a flaky upstream.

## Test plan

Add to `src/api/sse.test.tsx`:
1. **One `onerror` then recovery** — assert the hook re-creates the EventSource after backoff and `attempts` resets to 0 on next `onopen`.
2. **Two errors then recovery** — same, but re-tries twice.
3. **Three errors → polling** — confirms the ceiling.
4. **Unmount during reconnect window** — set up the timer, unmount the component, assert no reconnect happens (no new EventSource constructed).
5. **`onopen` resets attempts** — connect → 1 error → reconnect → onopen → another error far later → assert it counts as attempt 1, not attempt 2.
6. **Polling timeout** — already covered, keep.
7. **Replay events not duplicated** — already covered, keep.

The current `MockEventSource` in the test file supports `triggerError()` and `triggerOpen()` — extend with timer awareness via `vi.useFakeTimers()` so we don't introduce real timeouts in the suite.

## Status taxonomy (clarify the contract)

```
type SseStatus =
  | 'idle'         // before mount, or after cancel
  | 'connecting'   // EventSource just constructed, no open/error yet
  | 'open'         // last event was onopen, healthy
  | 'reconnecting' // backoff timer is pending
  | 'polling'      // gave up SSE, polling /replay every 3s
  | 'failed';      // poll timed out at 5min
```

`reconnecting` now genuinely means "we're going to try again" rather than "we have given up but didn't say so." Surface this in the BattleViewer header — a small badge with the current status helps debugging in the wild.

## Side effect for other consumers

`useBattleEvents` is the only consumer of EventSource today. When the listener slice (D-8) lands, it'll consume sort-bot-api's `/v1/events/stream` from inside the server. Same reconnect pattern but server-side; a sister doc `references/global-listener.md` covers that.
