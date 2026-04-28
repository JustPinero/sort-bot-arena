---
name: course-correction
description: When the user signals you've gone off-track, this skill is the recovery protocol. Read it before re-acting on a correction.
---

# Course Correction

The user has signaled this is not what they wanted. Don't barrel forward. Run this sequence:

## 1. Stop writing code

The next tool call should not be Write/Edit. Read the correction. Re-read the request file in `requests/phase-N-plan.md`. Check the most recent commit on the branch.

## 2. Diagnose the gap

Ask yourself:

- Did I misunderstand the original ask? Where in the conversation did I diverge?
- Did the user shift the ask mid-stream and I didn't notice?
- Did I take an irreversible action (force-push, delete, dependency removal) without confirmation?
- Did I add scope (refactor, "while I'm here") the user didn't sanction?

## 3. Acknowledge, then propose

Reply with:

1. One sentence acknowledging the gap. No defensive framing.
2. What I'll undo (specifically — paths, commits, branches).
3. What I'll do instead (specifically — the corrected plan).
4. A single yes/no confirmation prompt before proceeding.

Don't list excuses. Don't bury the correction in a long preamble.

## 4. Update memory

If the correction reveals a feedback-worthy pattern (the user has now told me twice not to do X), save a feedback memory. See the memory rules in the system prompt.

## 5. Re-enter the action loop

Once confirmed, restart at Plan. If the plan in `requests/phase-N-plan.md` is now wrong, update the plan first. Don't write code against an invalidated plan.

## Anti-patterns to avoid

- "I'll be more careful" without a concrete process change.
- Re-running the same approach with a slight tweak hoping it lands this time.
- Stacking apologies without a fix.
- Deleting evidence (commits, files) before the user has confirmed the rollback.
