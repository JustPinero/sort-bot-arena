---
name: drift-audit
description: Detect drift between code and references/. Files that exist but aren't documented, references/ docs that describe code that no longer exists, design tokens used outside the system. Run via /drift-audit.
---

# Drift Audit

The references/ docs are load-bearing. When they drift from reality, the project rots from the inside.

## What to check

1. **Component drift.** Every reusable component in `src/components/` should appear in `references/component-catalog.md`. Components in the catalog that no longer exist must be removed.
2. **Route drift.** Every route in `src/App.tsx` should appear in `references/routing.md`. Theme/auth claims in routing.md should match the actual `<AppShell>` props.
3. **Token drift.** Hex colors hard-coded in components instead of using token classes. Pixel values for spacing instead of `var(--space-N)`. Keyframes outside `src/styles/animations.css`.
4. **API contract drift.** Endpoints used in `src/api/queries.ts` or `src/api/sse.ts` that aren't listed in `references/api-contracts.md`. The backend's OpenAPI is the upstream truth; check the latest types in `src/api/types.ts` against what we consume.
5. **Env var drift.** New `import.meta.env.VITE_*` references in code that aren't in `references/env-vars.md` or `.env.example`.
6. **Architecture invariants drift.** Code patterns that violate the invariants listed in `CLAUDE.md`: direct `fetch()` outside `src/api/`, `dangerouslySetInnerHTML`, `console.log` of auth state, missing AbortController.

## How to run

`/drift-audit` triggers this audit. Output: `audits/drift-audit-<timestamp>.md` with the diff between docs and code.

## Fix posture

Drift is a process bug, not a feature bug. Fix in the same PR that introduced it; don't merge a PR that knowingly leaves docs behind.
