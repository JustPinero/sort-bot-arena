# Phase 6 — Polish, Homepage, & Stretch Features

**Branch:** `phase-6-polish` (stacked on `phase-5-submit-tournaments`)

## Scope

The take-home's last-mile polish. Replace the four remaining placeholder routes (`/`, `/halloffame`, `/achievements`, `/events`) with real implementations. Land the embeddable badge. Run the perf pass and tighten the budgets.

## Exit criteria (from kickoff §4 Phase 6)

- All routes ship and feel polished.
- Lighthouse Performance ≥ 85, Accessibility = 100, Best Practices ≥ 95 on the leaderboard, profile, and arena pages.
- All visual regression tests pass. (D-1 still open — explicitly accepted as out of scope.)
- Mobile responsive on profile and leaderboard pages.
- Production deployment to Vercel with SPA rewrite, CSP headers, custom domain optional.

## Decisions (locked, given session shape)

- **Audio** stays deferred (D-4). The take-home demo doesn't need audio; the store + lazy-load shape is already in place.
- **`<HoverPreviewPanel />`** stays deferred (D-2). Click-through to profiles already works.
- **Visual regression** stays deferred (D-1). Snapshot infrastructure is ready in Playwright config + scaffold.
- **PPV promo card generator** stays deferred (D-7).

## Slices (revised, scope-disciplined)

1. **HomePage** — broadcast-feed landing: scrolling ticker (CSS-driven), featured fight card, rookie-of-the-day spotlight, biggest-upset spotlight, champion's corner.
2. **HallOfFamePage** — retired bots list with final career stats and inducted-on date.
3. **AchievementsPage** — gallery of all defined achievements with rarity stats.
4. **EventsFeedPage** — placeholder polish: themed empty/coming-soon state since the global SSE feed endpoint isn't shipped yet (mocked for the demo).
5. **`<BotBadge />`** — SVG embeddable shield from `GET /v1/bots/:id/badge.svg` with copy-paste embed code on the bot profile page.
6. **Perf pass** — Lighthouse audit, font-display: swap verification, route prefetch on link hover.
7. **Close-out** — catalog + contracts + CLAUDE + final PR.

## Out of scope (carried forward as documented debt)

Items previously deferred (D-1 through D-7) remain deferred. None are on the critical path for "the take-home is shippable."

## Risks

- **Bundle creep on `/`.** The homepage adds ticker + featured fight + rookie + upset + champion's corner. Need to keep total load under the 200KB shell budget. Mitigation: most cards reuse existing components (RecordChip, CornerColorBadge, fmtRelativeDate); no new heavy deps.
- **Performance pass scope.** Real Lighthouse runs need a deployed build. Skip locally; document the Vercel deployment as an open verification step.

## Validate gate (unchanged)

```
1. eslint . --max-warnings=0
2. prettier --check .
3. tsc --noEmit
4. vitest run
5. vite build
```
