---
name: bughunt
description: Hunt for bugs in the current phase's surface area — race conditions, stale state, missing error handling, broken keyboard nav. Run via /bughunt.
---

# Bug Hunt

Hunt the bugs reviewers and Lighthouse won't catch.

## Categories

1. **Stale state.** TanStack Query cache invalidations missing or wrong. Optimistic updates that don't roll back on failure. Zustand stores hydrated with stale localStorage values.
2. **Race conditions.** SSE events out of order or arriving after unmount. Concurrent mutations without optimistic locking. `useEffect` cleanup missing on rapid route changes.
3. **Missing error handling.** API 4xx/5xx surfaced as "loading forever." Network timeouts that show neither a toast nor a retry. Form submissions that swallow validation errors.
4. **Broken keyboard nav.** Tab order skips elements. Focus trapped in modals without an escape path. Focus lost after route change.
5. **a11y regressions.** Live regions silent on update. Color contrast violations from theme toggle. Decorative animations triggering for `prefers-reduced-motion` users.
6. **Bundle bloat.** Lazy-loaded routes that drag a heavy lib (Monaco, Howler) into the main bundle via static import.
7. **Memory leaks.** SSE connections not closed on unmount. Event listeners not removed. Big derived data structures recreated on every render.
8. **Theme bleed.** `forceTheme` on a route leaking into nested portals (modals, tooltips render in `<body>`). data-theme propagation incomplete.
9. **Security drift.** New `dangerouslySetInnerHTML`. New `console.log` of auth state. New image src without allowlist validation.

## How to use

Trigger via `/bughunt`. The `bughunter` agent (or this skill invoked manually) walks the categories and produces a punch list at `audits/bughunt-<timestamp>.md`.

## Severity

- **P0** — security or data loss.
- **P1** — broken core flow (submit, leaderboard load, battle viewer).
- **P2** — broken edge case or polish issue.
- **P3** — code smell with no user-visible effect.
