---
description: Record a piece of debt. Adds an entry to debt.md so it isn't lost.
argument-hint: <short description of the debt>
---

Append a debt entry to `debt.md` (create the file if it doesn't exist) with:

- An auto-incrementing ID (D-<n>).
- The date.
- The current branch and last commit.
- The user's description from the args.
- A short note on why it's debt (what would change if it were addressed).

Don't address the debt now. Don't add a TODO in the code. Tracking belongs in `debt.md` only.

Example entry:

```
## D-3 (2026-04-28) — main / 1a2b3c4

Bundle visualizer not wired into CI. Manual `pnpm build` + eyeball is the only check.
Worth wiring when bundle gets close to a budget gate.
```

Reply with the new ID and the debt.md path.
