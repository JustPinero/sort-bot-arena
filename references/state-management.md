# State Management — sort-arena-web

Three categories of state, three tools. Choose by lifecycle.

## TanStack Query — server state

Anything the backend owns. Query keys mirror API resource paths.

```ts
// src/api/queries.ts
export function useBot(botId: string) {
  return useQuery({
    queryKey: ['bots', botId],
    queryFn: () => apiClient.get<Bot>(`/v1/bots/${botId}`),
    staleTime: 5 * 60 * 1000,
  });
}
```

Defaults (set on the `QueryClient` in `src/main.tsx`):

- `staleTime: 5 * 60 * 1000` — 5 min before background refetch.
- `gcTime: 30 * 60 * 1000` — 30 min cache retention.
- `retry: 1` — single retry on transient errors.
- `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000)` — exponential.
- `refetchOnWindowFocus: true` for live data routes; opt-out per query for snapshots.

Mutations invalidate the affected keys:

```ts
const { mutate } = useMutation({
  mutationFn: submitBot,
  onSuccess: (newBot) => {
    queryClient.setQueryData(['bots', newBot.id], newBot);
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  },
});
```

Optimistic updates allowed for write-heavy paths (e.g., bot submission shows the bot in the user's list immediately, rolled back on failure).

## Zustand — client state

Cross-component, persistent. One store per concern.

### `useAuthStore`

```ts
interface AuthState {
  apiKey: string | null;
  userId: string | null;
  displayName: string | null;
  guestProvisioned: boolean;
  claimed: boolean;
  setKey: (apiKey: string, userId: string, displayName: string) => void;
  markClaimed: (displayName: string) => void;
  clear: () => void;
}
```

Persisted via `zustand/middleware/persist` to localStorage under key `sort-arena.auth`.

### `useThemeStore`

```ts
interface ThemeState {
  mode: 'system' | 'light' | 'dark';
  setMode: (mode: ThemeState['mode']) => void;
}
```

Persisted under `sort-arena.theme`.

### `useAudioStore`

```ts
interface AudioState {
  enabled: boolean;
  masterVolume: number; // 0..1
  walkoutCuesEnabled: boolean;
  toggle: () => void;
  setVolume: (v: number) => void;
}
```

Persisted under `sort-arena.audio`. Howler is lazy-loaded only when `enabled === true`.

### `useBattleStore`

```ts
interface BattleState {
  subscribedBattleId: string | null;
  events: BattleEvent[];
  derived: BattleDerivedState;
  animationQueue: AnimationCue[];
  subscribe: (battleId: string) => void;
  unsubscribe: () => void;
  pushEvent: (e: BattleEvent) => void;
}
```

Not persisted — battle state is ephemeral. Hydrated by `useBattleEvents(battleId)` SSE hook (Phase 4).

## `useState` — component state

Open/closed flags, form input draft state, single-component-only ephemera. If two components need the same value, promote it (lift state in React, or move to a Zustand store if it crosses the route boundary).

## SSE — real-time, not in cache

Active battles, tournaments, global event feed bypass TanStack Query. They use dedicated hooks in `src/api/sse.ts` that maintain their own derived state.

The hook pattern:

```ts
function useBattleEvents(battleId: string) {
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/v1/battles/${battleId}/events`);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const event = battleEventSchema.parse(JSON.parse(e.data));
        setEvents((prev) => [...prev, event]);
      } catch {
        // log, ignore malformed event
      }
    };
    es.onerror = () => {
      setError(new Error('SSE connection failed'));
      setConnected(false);
    };
    return () => es.close();
  }, [battleId]);

  const derived = useMemo(() => deriveBattleState(events), [events]);
  return { events, derived, connected, error };
}
```

`deriveBattleState` is a pure reducer that translates the event log into the view model the UI consumes. Components consume `derived`; debug tools (Phase 6) consume the raw `events` log.

**Validation invariant.** Every event runs through a zod schema (`battleEventSchema`) before touching state. A compromised backend or man-in-the-middle could inject malformed events; treat all incoming events as untrusted.

## What goes where — quick decision tree

1. **Does the backend own it?** → TanStack Query.
2. **Does it cross routes or survive refresh?** → Zustand.
3. **Is it open/closed, hover, draft?** → `useState`.
4. **Is it a stream of events?** → SSE hook with derived state.

Never use Zustand to mirror server state. Never use TanStack Query for purely-client toggles. Never push component-only ephemera into a global store.

## Forms — react-hook-form + zod

```ts
const schema = z.object({
  nickname: z.string().min(1).max(40),
  language: z.enum(['python', 'node', 'go', 'binary']),
});

const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```

No raw `onChange` on `<input>`s except for trivial UI-only state (e.g., a search box that only filters a client-side list). `react-hook-form` is the entry point for any field that maps to API input.
