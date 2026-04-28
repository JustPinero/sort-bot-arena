---
description: Run the test-audit skill alone. Writes to audits/test-audit-<timestamp>.md.
---

Invoke the `test-audit` skill. Walk the suite, run `pnpm test:coverage`, and write a report covering: state-bearing components without tests, RED-first violations, coverage gaps, a11y blind spots, flaky markers, and MSW handler drift. Surface findings by priority.
