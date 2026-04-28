---
name: optimize
description: Performance audit — bundle size, Lighthouse scores, render perf, network waterfall. Run via /optimize.
---

# Optimize

Frontend perf gates per the kickoff:

- Layout shell + home: <200KB gzip JS.
- Profile, leaderboard: <250KB gzip JS.
- Arena: <400KB gzip JS.
- Lighthouse Performance ≥ 85 on data routes; Accessibility = 100; Best Practices ≥ 95.

## What to look at

1. **Bundle composition.** `pnpm build` then inspect `dist/assets/*.js` sizes. Use `rollup-plugin-visualizer` (Phase 6) for a tree map. Heavy imports (Monaco, Howler) MUST be lazy-loaded.
2. **Per-route code splitting.** Every route in `src/App.tsx` should be `React.lazy()`-wrapped. A static import of a route component into another route is a regression.
3. **Render perf.** React DevTools Profiler on the live battle page. Any component re-rendering on every SSE event when its props haven't changed needs `React.memo` + stable references.
4. **Network waterfall.** Critical-path request count to first paint. Parallelize independent queries via `useQueries`. Prefetch on link hover for likely navigations.
5. **Image sizes.** Backend serves portraits at multiple resolutions; frontend selects via `srcset` based on container size.
6. **Font loading.** `font-display: swap`. Subset Bebas Neue to A-Z 0-9 + basic punctuation (Phase 6).
7. **Animation perf.** Avoid `box-shadow` animations on large surfaces — they paint every frame. Use `transform` + `opacity` where possible.
8. **TanStack Query waste.** `staleTime: 0` on a hot resource burns network. `refetchOnWindowFocus: true` on a snapshot is overkill.

## How to run

`/optimize` triggers the audit. Output: `audits/optimize-<timestamp>.md` with a table of findings (current value, budget, delta, fix).

## Phase-by-phase budget gates

| Phase | Routes that must hit budget            |
| ----- | -------------------------------------- |
| 1     | Layout shell, design system page       |
| 2     | Profile, head-to-head                  |
| 3     | Leaderboard, per-input leaderboard     |
| 4     | Arena (initial + during fight)         |
| 5     | Submit, tournaments                    |
| 6     | Home, hall of fame, all polish targets |
