---
description: Final gate before pushing to Vercel production. Runs the pre-deploy checklist.
---

Invoke the `pre-deploy` skill. Walk the checklist: validate green, env vars set across all three Vercel envs, CSP origins correct, Lighthouse on a preview deploy, critical paths exercised in a real browser, no `console.log` / `dangerouslySetInnerHTML`, bundle budgets met, SSE works against prod backend.
