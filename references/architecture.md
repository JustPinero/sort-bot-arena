# Architecture — sort-arena-web

This is the load-bearing senior doc. Every other reference defers to this one. Update it when a major design choice changes; do not let it rot.

---

## Mission

Turn sort-bot-api's API responses into a BattleBots × UFC broadcast experience. The site exists to make the API legible and entertaining, demonstrate end-to-end product thinking alongside the backend, and expose every backend endpoint behind a UI that feels designed rather than scaffolded.

---

## Stack — at a glance

- **Build:** Vite + React 18 + TypeScript strict, pnpm.
- **Routing:** React Router v6, lazy-loaded routes.
- **Server state:** TanStack Query, 5-minute default stale, SSE bypasses cache.
- **Client state:** Zustand stores with `persist` for survivability across refreshes.
- **Forms:** react-hook-form + zod resolver.
- **Styling:** Tailwind utilities + design-token CSS variables. shadcn/ui themed via the same vars.
- **Animation:** Framer Motion (state-driven), tokenized keyframes (decorative).
- **Editor:** Monaco (Phase 5).
- **Audio:** Howler.js, lazy-loaded only when audio toggle is on (Phase 4+).
- **Tests:** Vitest + React Testing Library + vitest-axe + Playwright. MSW for API contracts.
- **Hosting:** Vercel SPA. CSP allows backend origin only.

---

## Why pure SPA, no SSR

The content is dynamic and authenticated; SEO is not a goal. SSR adds a runtime to maintain and a cache layer to debug for zero user-visible benefit. Vite + React Router gives us route-level lazy loading and per-route code splitting, which covers the perf wins SSR is usually justified by.

## Why split-repo (frontend + backend)

End-to-end type safety via `openapi-typescript` against the backend's OpenAPI spec. Breaking changes in the backend become frontend type errors; the frontend cannot drift silently. The cost is an extra repo and a regeneration step (`scripts/generate-api-types.sh`); the benefit is contract enforcement at compile time.

## Why TanStack Query + Zustand + useState

Three categories of state, three tools:

| Category | Lifecycle | Tool | Example |
|---|---|---|---|
| Server | Server-owned, has invalidation rules | TanStack Query | Leaderboard, bot profile, battle history |
| Client | Cross-component, persistent | Zustand | API key, theme preference, audio toggle, active battle subscription |
| Component | Stays in component | `useState` | Open/closed flags, form input draft state |

Real-time data (active battles, tournaments, global event feed) bypasses Query — uses dedicated SSE hooks that derive state from the event log. Components consume the derived view; debug tools can consume the raw event log.

## Theme strategy

- Dark mode default. Light mode supported on data routes only.
- Combat routes (`/`, `/arena`, `/arena/:battleId`, `/submit`) force dark via a `forceTheme="dark"` prop on the page-level layout.
- Implementation: `<ThemeProvider>` reads `useThemeStore` (mode: system/light/dark) + `matchMedia('(prefers-color-scheme: dark)')`. A page-level layout component overrides via `forceTheme`.
- The `data-theme` attribute on `<html>` drives all token cascades; `tailwind.config.ts` `darkMode` is wired to `[data-theme="dark"]`.

## API consumption pattern

All requests go through `src/api/client.ts`:

1. Validates `VITE_API_BASE_URL` at module load (throws on missing).
2. Loads API key from `useAuthStore` (which `persist`s to localStorage).
3. Auto-provisions a guest user on first authenticated call when no key exists (POST `/v1/users` with a generated friendly name; stashes returned key).
4. Sets `Authorization: Bearer <key>` on every authenticated request.
5. Wraps `fetch` with AbortController (15s default timeout, 60s for SSE handshake).
6. Normalizes errors:
   - 4xx → `ApiError` with `status`, `code`, `message`, `requestId`, `fields?` (validation field paths).
   - 5xx → `ApiError` flagged retryable; UI surfaces as toast + retry CTA.
7. Returns typed responses via `openapi-typescript`-generated types in `src/api/types.ts`.

Every TanStack Query hook lives in `src/api/queries.ts`, organized by resource. Stable query keys mirror API resource paths: `['bots', botId]`, `['leaderboard', filters]`, `['battles', battleId]`. Write hooks invalidate the affected keys.

SSE hooks live in `src/api/sse.ts` and follow this shape:

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

## Auth model

Bearer-token API key obtained from sort-bot-api. Frontend auto-provisions a guest user on first visit (POST `/v1/users` with a generated friendly name like "anonymous-otter-4729"), stashes the returned key in localStorage via `useAuthStore`, and includes it in every authenticated API call.

Users can later "claim" the guest profile by setting a real display name and optional email; the backend supports this without any new auth flow. Magic-link recovery is documented as future work in the backend; not required for this frontend.

## Routing & theming policy

| Route pattern | Theme | Auth | Notes |
|---|---|---|---|
| `/` | force dark | none | Broadcast feed homepage |
| `/arena` | force dark + scan-lines | none | Battle index |
| `/arena/:battleId` | force dark + scan-lines | none | Live battle viewer (SSE) |
| `/submit` | force dark | required | Bot submission with Monaco editor |
| `/me/fighters` | respect | required | Current user's bots |
| `/leaderboard`, `/leaderboard/inputs/:id` | respect | none | P4P rankings |
| `/bots/:id`, `/bots/:a/vs/:b` | respect | none | Profile + head-to-head |
| `/tournaments`, `/tournaments/:id` | respect (dark when bracket live) | none | |
| `/halloffame`, `/achievements`, `/events` | respect | none | |
| `/dev/design-system` | respect | none | Dev-only, gated by `VITE_ENABLE_VISUAL_REGRESSION` |

"Required" auth is satisfied by the auto-provisioned guest, so there is no gating UI in Phase 1. Real "claimed" accounts arrive in Phase 5 (submit page).

## Page weight budgets

- Layout shell + home: <200KB gzip JS.
- Profile, leaderboard: <250KB gzip JS.
- Arena: <400KB gzip JS (Framer Motion + animation-heavy).
- Lighthouse Performance ≥85 on data routes; Accessibility = 100 on every route; Best Practices ≥95.

Code splitting per route via `React.lazy` + `<Suspense>`. Howler is lazy-loaded only when the audio toggle is enabled. Monaco loads only on `/submit`.

## Security posture

See `references/security-landmines.md` for the full list. The hits:

- API key in localStorage is XSS-vulnerable. Mitigations: strict CSP, no `dangerouslySetInnerHTML`, no `eval`/`Function`, no `console.log` of auth state, dependency audit.
- AI-generated content (trash talk, analysis) is rendered as text via React's default escaping. Never `dangerouslySetInnerHTML`.
- Image `src` for portraits validated against the configured backend allowlist before rendering — defense in depth.
- Every fetch has an AbortController timeout. No unbounded requests.
- Every SSE event runs through a zod schema before touching state.
- No frontend keys for Anthropic/Leonardo. CSP blocks third-party API origins.

## Why this directory layout

- `src/api/` — every server interaction in one place. Easier to enforce the "no direct fetch" rule when there is one canonical location.
- `src/components/{design-system,fighter,arena,leaderboard,tournaments,submit,layout,ui}/` — domain-grouped. Each folder has a clear purpose; cross-folder imports are rare.
- `src/pages/` — route-level components only. Each page composes from `src/components/*`.
- `src/stores/` — Zustand stores. One file per concern.
- `src/lib/` — pure helpers (no React). Easy to unit-test.
- `src/styles/` — token CSS variables and decorative keyframes. Tailwind utilities consume the tokens.

## Future amendments (out of Phase 1 scope)

- **Real auth flow.** Backend Phase 4 lands magic-link recovery; frontend can integrate after.
- **Real-time tournament bracket.** Backend Phase 5 ships SSE for tournament events; frontend Phase 5 consumes.
- **Audio assets.** Phase 4 brings royalty-free walkout cues, crowd loop, KO fanfare. Lazy-loaded.
- **Embeddable badges.** Phase 6 wires `<BotBadge />` to the backend `GET /v1/bots/:id/badge.svg` endpoint.

## Decisions deferred

- Bundle analyzer (`rollup-plugin-visualizer`?) — install in Phase 6 polish.
- E2E test coverage breadth — Playwright config lands Phase 1; suites populate Phase 2+.
- i18n — out of scope. English only.
- Analytics — backend logs the relevant events; no frontend SDK.
