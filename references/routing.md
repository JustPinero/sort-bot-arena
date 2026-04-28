# Routing — sort-arena-web

React Router v6, `<BrowserRouter>` + lazy-loaded route elements per page. Each top-level page is wrapped in an `<AppShell>` layout that accepts a `forceTheme` prop where applicable.

## Route table

| Path | Page component | Layout | Theme | Auth | Phase |
|---|---|---|---|---|---|
| `/` | `HomePage` | `AppShell` | force dark | none | 6 |
| `/arena` | `ArenaIndexPage` | `AppShell` | force dark + scan-lines | none | 4 |
| `/arena/:battleId` | `BattlePage` | `AppShell` | force dark + scan-lines | none | 4 |
| `/leaderboard` | `LeaderboardPage` | `AppShell` | respect | none | 3 |
| `/leaderboard/inputs/:inputId` | `PerInputLeaderboardPage` | `AppShell` | respect | none | 3 |
| `/bots/:botId` | `BotProfilePage` | `AppShell` | respect | none | 2 |
| `/bots/:a/vs/:b` | `HeadToHeadPage` | `AppShell` | respect | none | 2 |
| `/tournaments` | `TournamentsListPage` | `AppShell` | respect | none | 5 |
| `/tournaments/:id` | `TournamentBracketPage` | `AppShell` | respect (dark when live) | none | 5 |
| `/submit` | `SubmitPage` | `AppShell` | force dark | required | 5 |
| `/me/fighters` | `MyFightersPage` | `AppShell` | respect | required | 5 |
| `/halloffame` | `HallOfFamePage` | `AppShell` | respect | none | 6 |
| `/achievements` | `AchievementsPage` | `AppShell` | respect | none | 6 |
| `/events` | `EventsFeedPage` | `AppShell` | respect | none | 6 |
| `/dev/design-system` | `DesignSystemPage` | `AppShell` | respect | none | 1 |
| `*` | `NotFoundPage` | `AppShell` | respect | none | 1 |

In Phase 1 every page above ships as a placeholder stub. Real implementations land in the phases listed.

## Auth model

- "Required" auth is satisfied by the auto-provisioned guest user. The frontend ensures a key exists in `useAuthStore` before mounting routes that submit data.
- A future "claim" flow (Phase 5+) lets a guest set a real display name. There is no separate sign-in page; the API key never expires unless explicitly rotated.

## Theme rules

- `respect` = `<ThemeProvider>` resolves from `useThemeStore.mode` ∈ {system, light, dark}.
- `force dark` = `AppShell` passes `forceTheme="dark"` to `<ThemeProvider>`, which overrides the user preference for that route only.
- Scan-lines are applied via a `<ScanLines />` overlay component on `/arena*` only — not as a global style — so other forced-dark pages don't pick them up.

## Code-splitting plan

```tsx
const HomePage = lazy(() => import('@/pages/HomePage'));
const ArenaIndexPage = lazy(() => import('@/pages/ArenaIndexPage'));
// …
```

Each `<Route element={...}>` wraps the lazy component in a `<Suspense fallback={<RouteSkeleton />}>` and a route-level `<ErrorBoundary>`. The fallback is a minimal layout-shell skeleton — never a spinner over an empty page.

## Dev-only routes

`/dev/design-system` is rendered only when `import.meta.env.VITE_ENABLE_VISUAL_REGRESSION === 'true'`. In production builds (without that flag), the route returns the `NotFoundPage`. Playwright visual-regression suites set the flag at run time.

## URL state for filters

- `/leaderboard?weight=heavyweight&activity=month&sort=ko` — filter state encoded as query params for shareable links.
- `/bots/:botId?tab=performance` — profile tabs encoded so deep-links land on the correct tab.
- Internal helper `useUrlState<T>(schema)` (Phase 3+) wraps `useSearchParams` with zod parsing and writeback.

## Navigation flow notes

- Top nav has four primary entries: Arena, Rankings, Tournaments, Submit. The user menu (display name + claim CTA) lives top-right.
- `<TopNav>` lives in the layout, never re-mounts on route changes.
- 404 returns the layout shell with a themed "FIGHTER NOT IN THE DATABASE" message and a back-to-leaderboard CTA.
