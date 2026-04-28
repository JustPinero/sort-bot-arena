---
description: Resurface a deferred debt entry to active work.
argument-hint: <debt id, e.g. D-3>
---

Read `debt.md`, find the entry matching the given ID, and:

1. Move the entry to a new file `requests/<short-name>-plan.md` (use the description to derive the slug).
2. Mark the debt entry in `debt.md` as `[ACTIVATED → requests/<slug>-plan.md]`.
3. Surface the moved entry to the user and ask whether to start a new branch or fold the work into the current one.

Don't auto-start the work. Activation is just promotion to a real plan; the user decides timing.
