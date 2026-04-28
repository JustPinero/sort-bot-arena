---
description: Verify the current phase's exit criteria are met and prepare to merge to main.
---

Run the phase-complete protocol:

1. Read `requests/phase-N-plan.md` for the current branch's phase.
2. Verify each exit criterion in §"Exit criteria" is satisfied. Map evidence to each item (test file paths, screenshot paths, command output).
3. Run `pnpm validate` — must be green.
4. Run `/run-audits`. Address any P0/P1 findings before merging.
5. Update `references/component-catalog.md` and `references/api-contracts.md` with anything added this phase.
6. Update `CLAUDE.md` phase table (mark current phase done, next phase in progress).
7. Open a PR `phase-N-* → main` if not already open. Title: `phase-N: <short summary>`.
8. After merge, branch `phase-(N+1)-*` from main, copy the phase-(N+1) entry from the kickoff into `requests/phase-(N+1)-plan.md` as a starting outline.
