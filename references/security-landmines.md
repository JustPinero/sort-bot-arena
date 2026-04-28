# Security Landmines — sort-arena-web

Stakes: a SPA consuming an external API, with a bearer-token API key in localStorage and AI-generated content rendered to the page. The threat model is XSS first, then over-trusted server responses, then resource exhaustion. Everything below is enforced or about to be.

## Bot source code is opaque

User-submitted source code (Phase 5) goes from the Monaco editor straight to the API as a multipart file upload. The frontend does **not** sanitize, parse, or evaluate. The backend sandbox is the security boundary. Treating user code as opaque keeps the frontend off the critical path for sandbox correctness.

Implications:

- Never `eval` Monaco's value. Even for "preview" or "syntax check" use cases. The TypeScript-side syntax check is built into Monaco's language services — not run via `eval`.
- Treat the editor's value as untrusted input even though it came from the current user, because keystroke logging or shared-machine attacks can poison it.

## User-generated content rendering

Bot nicknames, custom-input names, AI-generated trash talk, AI-generated scouting reports — all server-returned strings. Render them with React's default escaping; **never** `dangerouslySetInnerHTML`. The eslint rule `react/no-danger` is set to `error`.

This includes:

- Trash talk in `<PreFightStaredown />` (Phase 4).
- AI analysis in the scouting report tab (Phase 2).
- Bot nicknames in every list and card.
- Tournament names ("RUMBLE IN THE STACK").
- Commentary feed entries during live battles.

If a future feature needs rich text (bold/italic), use a markdown-to-React parser (e.g., `react-markdown`) configured with a strict allow-list of node types. Never roll a custom HTML sink.

## localStorage is XSS-vulnerable

The API key lives in localStorage via Zustand `persist`. Any XSS gets it. Mitigations stack:

1. **Strict CSP.** No `script-src 'unsafe-inline'`. No third-party script origins beyond what we explicitly allow.
2. **No `dangerouslySetInnerHTML`** anywhere.
3. **No `eval`, `new Function`,** or any equivalent dynamic-code path. The lint rule `no-eval` is `error`.
4. **Dependency audit.** `pnpm audit` runs in CI; high-severity advisories fail the build. We avoid known-malicious or recently-compromised packages.
5. **Never log the API key.** Sentry/error-tracker integration (when added) must filter localStorage values from breadcrumbs and from the user/auth context.
6. **Don't include the key in error toasts.** Even "for debugging." If you need to debug, hash it and log the hash.

If the threat model tightens (e.g., this becomes a paid product), we move the key to an httpOnly cookie and add a CSRF token on writes. That's a Phase 7+ migration.

## Image src for portraits

Portrait URLs come from the backend (`bot.portrait_url`). Even though they originate server-side, validate against an allow-list before rendering:

```ts
const ALLOWED_IMAGE_HOSTS = [
  new URL(import.meta.env.VITE_API_BASE_URL).host,
  'cdn.leonardo.ai',
];

function isAllowedImageUrl(url: string): boolean {
  try {
    return ALLOWED_IMAGE_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}
```

Defense in depth: a compromised backend or a rogue MitM can't redirect `<img src>` to an arbitrary tracking pixel.

## Every fetch has a timeout

`AbortController` wired into the fetch wrapper. Default 15s; SSE handshake 60s. No unbounded requests. A misconfigured backend or a hostile network shouldn't lock the UI.

## SSE event validation

Every event runs through a zod schema before applying state changes. A compromised backend or a man-in-the-middle could inject malformed events; treat all incoming events as untrusted. Schema mismatch logs a warning and drops the event — never crashes, never partially-applies state.

## PATCH/PUT validation

Doubled validation: the frontend zod schema mirrors the backend's. UX wins from instant feedback (errors before the network round-trip); security wins from belt-and-braces. The frontend schema is allowed to be more restrictive than the backend's (e.g., trim whitespace, normalize casing) but never less restrictive.

## What we deliberately do not do

- **WebAuthn / 2FA.** Out of scope for the takehome.
- **httpOnly cookies for auth.** Bearer-in-localStorage is the contract; document its limits and move on.
- **Server-side rendering.** Keeping all logic client-side simplifies the threat model — there's no SSR cache poisoning surface.
- **Custom HTML sanitizer.** Better to render plain text or use a vetted library than to write our own.

## Hooks-level guardrails

`.claude/hooks/pre-tool-use-secrets.sh` blocks commits containing patterns that look like API keys (`sk_…`, `ANTHROPIC_API_KEY=…`, etc.). Don't disable.

## A short list to grep when reviewing

- `dangerouslySetInnerHTML` — must be zero hits.
- `eval(`, `new Function(` — must be zero hits.
- `console.log` — must be zero hits in committed code.
- Direct `fetch(` outside `src/api/` — eslint catches it; if a test bypasses, the test is wrong.
- Any localStorage write outside `useAuthStore` / `useThemeStore` / `useAudioStore` persistence — should not exist.
