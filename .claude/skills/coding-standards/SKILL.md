---
name: coding-standards
description: TypeScript/React conventions for sort-arena-web. Apply to every code change. Covers types, state, API access, forms, animations, styling, a11y, imports, and formatting.
---

# Coding Standards

Project conventions. Apply on every code change.

## TypeScript

- **Strict mode.** No `any` without an explicit `// reason: …` comment justifying it.
- `import type` for type-only imports. Enforced by `@typescript-eslint/consistent-type-imports`.
- Prefer `unknown` + zod parsing over `any` at boundaries.
- `interface` for object shapes that may be extended; `type` for unions, intersections, and aliases.
- No non-null assertions (`x!`) in business logic. Acceptable in tests when narrowed by setup.

## API access

- All HTTP through `src/api/client.ts`. Direct `fetch()` outside that module is an eslint error.
- Use the typed client (`apiClient.get<T>`, `apiClient.post<TBody, TResp>`, etc.). Never manually JSON-parse.
- Server state via TanStack Query hooks in `src/api/queries.ts`, organized by resource. Stable query keys mirror API resource paths.
- SSE via `src/api/sse.ts`. Validate every event with zod before applying state.
- Mutations invalidate the right query keys; never call `invalidateQueries({ queryKey: [] })` (nuclear).

## State

- **Server state** → TanStack Query. Stale time, retry, optimistic update rules per `references/state-management.md`.
- **Client state** crossing components or persisting → Zustand. One store per concern. Persist via `zustand/middleware/persist`.
- **Component-only state** → `useState`. If two components need the same value, lift or move to a Zustand store.
- Never mirror server state in Zustand. Never put toggles in a Query. Never use `useState` for cross-route state.

## Forms

- `react-hook-form` + zod resolver. Schema + form type co-located with the form component.
- No raw `onChange` on `<input>`s except for trivial UI-only state (e.g., a search box that only filters a client list).
- Surface validation errors inline; never via toast for field-level failures.

## Animations

- Framer Motion `<motion.*>` for state-driven animation. Variants live in `src/lib/motion.ts` when reusable.
- Decorative-only loops (glow-cycle, scan-line jitter) live in `src/styles/animations.css` and use Tailwind `animate-*` utilities.
- Respect `prefers-reduced-motion`. Use the `useReducedMotion` hook from Framer Motion at the top of any animation-heavy component.

## Styling

- Tailwind utilities first. Token classes (`bg-surface-1`, `text-hazard`, `rounded-combat`) over raw colors.
- Combine classes via `cn(...)` from `@/lib/cn` (`clsx + tailwind-merge`).
- CSS modules only when a component has truly complex styles (>~30 lines of styling).
- Never use raw pixel values for spacing — use the token scale (`var(--space-N)` or `gap-N`).
- Combat surfaces sharp (`rounded-combat`), data surfaces soft (`rounded-md`/`rounded-lg`/`rounded-xl`). See `references/design-system.md`.

## a11y

- Every interactive element has a role, label, and keyboard handler. `eslint-plugin-jsx-a11y` violations break CI.
- Visible focus rings. Skip-link in `<AppShell />` jumps to `<main>`.
- `aria-live="polite"` on streaming content (commentary feed, scoreboards).
- Decorative-only elements: `aria-hidden="true"` or `role="presentation"`.

## Components

- PascalCase named exports. One top-level component per file.
- Colocated tests: `<Name>.test.tsx` next to `<Name>.tsx`.
- Props interfaces named `<Name>Props`; export when components are reused externally.
- `className` always passthrough; merge via `cn(...)`.
- Ref forwarding (`forwardRef`) when the component renders a single underlying element a parent might need access to.
- Variants via `cva` (class-variance-authority), consistent with shadcn-themed primitives in `src/components/ui/`.

## Imports

- Ordered groups, separated by blank lines:
  1. external packages
  2. internal absolute imports via `@/` alias
  3. parent/sibling relative imports
- Within each group, alphabetical, case-insensitive.
- Type-only imports as `import type`.
- Enforced by `eslint-plugin-import` + `import/order`.

## Logging

- No `console.log` in committed code. Use `console.warn` / `console.error` only for genuine warnings/errors with context.
- Never log the API key or any localStorage value. Sentry/error-tracker integrations (when added) must filter `useAuthStore` state.

## Formatting

- Prettier on save. The `.claude/hooks/post-tool-use-prettier.sh` hook runs `prettier --write` automatically on supported writes.
- Don't bikeshed Prettier output; let the formatter decide.

## Tests

- Vitest + React Testing Library. `userEvent` for interactions; never raw `fireEvent` unless RTL has no equivalent.
- Smoke tests on every primitive: mount + `axe` (via `vitest-axe`).
- State-bearing components go through RED-first. Pure presentational components can ship with smoke tests only.
- Test files end in `.test.ts(x)`. Coverage exclusions live in `vitest.config.ts`.
- Never mock the API client wholesale — mock at the network boundary via MSW. The client itself is unit-tested directly.

## Security

- No `dangerouslySetInnerHTML` anywhere. Including AI-generated text.
- No `eval`, `new Function`, or any equivalent dynamic-code path.
- Validate image URLs against the backend allow-list before rendering. See `references/security-landmines.md`.
- Validate all SSE events with zod schemas before applying state.

## Comments

- Default to writing none.
- Add a comment only when the WHY is non-obvious: hidden constraint, subtle invariant, workaround for a specific bug, behavior that would surprise a reader.
- Never explain WHAT the code does — well-named identifiers do that. Don't reference the current task or PR — that belongs in the commit message.
