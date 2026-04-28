---
name: pre-deploy
description: Final checks before pushing to Vercel production. Run via /pre-deploy.
---

# Pre-Deploy

Last gate before the public-facing build. Don't skip steps to ship faster; failures here are visible to portfolio reviewers.

## Checks

1. **`pnpm validate` is green** locally and in CI on the branch being deployed.
2. **Env vars set in all three Vercel environments** (Production, Preview, Development). Missing one = preview deploys broken.
3. **CSP allows the right origins.** Verify the deployed `vercel.json` has `connect-src` for the production backend URL.
4. **Lighthouse on a preview deploy** (not localhost): Performance ≥ 85 on `/leaderboard` (or whatever the latest data route is); Accessibility = 100 on every shipped route.
5. **Critical paths exercised in a real browser.** Submit-and-watch-evaluate (Phase 5+), view-leaderboard-click-into-profile (Phase 3+), start-battle-watch-completion (Phase 4+). Type checks and unit tests don't catch real-browser bugs.
6. **No `console.log`** in committed code. Grep: `git grep 'console.log' src/`.
7. **No `dangerouslySetInnerHTML`.** Grep: `git grep dangerouslySetInnerHTML src/`.
8. **Bundle size budgets met.** `pnpm build && du -h dist/assets/*.js | sort -h`.
9. **The CSP doesn't break the page.** Open the deployed URL, check console for blocked resources. A misconfigured CSP looks identical to a working page until you click something.
10. **SSE works against the production backend.** Open a battle page, watch DevTools Network → EventStream. Connection should hold for ≥ 60s.

## Rollback plan

If the deploy ships a regression:

1. Vercel dashboard → previous deployment → "Promote to Production."
2. Open a hotfix branch named `hotfix-<short-desc>`.
3. Document in `audits/incident-<timestamp>.md` what broke and why local validation didn't catch it.
4. Update `pre-deploy` checks if the gap was missed by this list.
