---
description: Run the full audit suite (test-audit, bughunt, optimize, drift-audit) via the audit-runner agent. Writes reports to audits/.
---

Spawn the `audit-runner` agent. Have it execute the four audit skills and write per-skill reports plus a consolidated summary to `audits/`. Return the summary path and the top 5 cross-audit findings.
