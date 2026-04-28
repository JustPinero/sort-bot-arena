---
name: session-handoff
description: Write a session handoff doc that lets the next agent (or me, tomorrow) pick up cold. Run via /handoff.
---

# Session Handoff

Goal: someone (or future me) opens this repo without context, reads one file, and knows what to do next.

## Output

`audits/handoff-<timestamp>.md` with these sections:

1. **State of the world.** Current branch, last commit hash, current phase, which slices in the active phase plan are done vs. pending.
2. **What I just finished.** Tight summary of the last 1-3 commits. Reference file paths.
3. **What I was about to do.** The next step from `requests/phase-N-plan.md` or the active TaskList. Why it matters.
4. **Known landmines.** Anything I noticed that's not yet a bug but will be one. Include severity and where to look.
5. **Open questions.** Anything I'd ask the user if they were here.
6. **How to verify state.** Exact commands: `git log --oneline -5`, `pnpm validate`, `pnpm test`, etc.

## Formatting rules

- Each section ≤ 6 bullets. If it doesn't fit, the section is too vague.
- Reference paths as `src/foo/bar.ts:42` so they're clickable in editors.
- No "I'll come back to this" hand-waves. Either it's tracked in TaskList, deferred via `/defer`, or it doesn't exist.

## When to write one

- End of a long session.
- Before a context compact you can predict.
- Whenever the user says "let's pick this up tomorrow."
- After `/phase-complete` when handing off to the next phase.
