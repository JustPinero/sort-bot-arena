# Phase 5 — Submit / Playground & Tournaments

**Branch:** `phase-5-submit-tournaments` (stacked on `phase-4-arena`)

## Scope

Two flows. **Submit**: register a fighter via a Monaco-editor-driven form; watch live evaluation feedback in a debut view; auto-redirect to the new bot's profile. **Tournaments**: list of fight nights as broadcast event posters, plus a single tournament's bracket (compressed Tale-of-the-Tape rows for matchups).

## Exit criteria (verbatim from kickoff §4 Phase 5)

- Full submit-to-debut-to-profile flow works end-to-end.
- Monaco editor renders Python and Node templates correctly.
- Submission errors (invalid file size, sandbox-rejected source) display useful inline messages.
- Tournament bracket renders correctly for power-of-2 and non-power-of-2 participant counts (byes shown explicitly).
- Live tournament events drive bracket state updates correctly.

## Decisions (locked, given the project shape)

- **Monaco lazy-loaded.** `@monaco-editor/react` only on `/submit`. The bundle is ~600KB minified; we do not want it in the main shell.
- **MSW-mocked submit + tournament endpoints.** Backend Phase 5+ doesn't ship the submission pipeline yet; debut evaluation is driven by the same `playMockBattle`-style scripted streamer ("playMockEvaluation").
- **Forms via react-hook-form + zod** — the kickoff convention. Field-level validation in zod; submission errors surfaced via `setError`.
- **Bracket rendering**: vertical layout with rounds as columns, matchups as rows; bye rounds explicitly shown as "BYE — auto-advance" rows. Single-elimination only (the kickoff scope).
- **`<TournamentBracketPage />`** uses an SSE-driven update path for live tournaments (mirrors the battle viewer pattern). Completed tournaments are static.
- **My Fighters** route — added to scope. Lists user's bots with quick stats + a RETIRE action (PATCH `/v1/bots/:id`).
- **Champion-crowning moment** on tournament conclusion: belt + glow-cycle when the final match's winner is crowned. Deferred unless time permits in this phase.

## Endpoints (extends MSW)

- `POST /v1/bots` (multipart) → 202 with `{ bot_id }`. SSE: `GET /v1/bots/:id/debut/events` streams `EvaluationEvent[]` while the bot runs against the input set.
- `GET /v1/users/me/bots` → `Bot[]` for `/me/fighters`.
- `PATCH /v1/bots/:id` → display_name update, retire flag.
- `GET /v1/tournaments` → list (active / upcoming / completed).
- `GET /v1/tournaments/:id` → bracket detail.
- `GET /v1/tournaments/:id/events` (SSE) → tournament live events.

## Slices

1. **Types + MSW + queries** for `Bot` mutations, `Tournament`, `EvaluationEvent`. New: `useSubmitBot`, `useDebutEvents`, `useMyBots`, `useRetireBot`, `useTournaments`, `useTournament`, `useTournamentEvents`. RED-first.
2. **`<MonacoEditor />`** wrapper — themed dark UI, lazy-loaded, language switching, starter templates per language.
3. **`<SubmitPage />`** — react-hook-form + zod, file-upload-or-editor toggle, multipart POST, navigates to debut view on 202.
4. **`<DebutEvaluation />`** view — live SSE feed, progress bar (X of N), running placement estimate, full-screen "FIGHTER DEBUT COMPLETE" graphic on completion.
5. **`<MyFightersPage />`** — list user's bots, quick stats, retire action.
6. **`<TournamentsListPage />`** — broadcast event posters per tournament (active / upcoming / completed badges).
7. **`<TournamentBracketPage />`** — compressed-TotT bracket. Champion-crowning callout on completion.
8. **Close-out** — catalog + contracts + CLAUDE + PR.

## Out of scope (defer to Phase 6 polish)

- **PPV promo card generator** at `/tournaments/:id/promo/:matchId`.
- **Auto-generated fight poster image** export.
- **Social-share native API integration**.
- **Embeddable badges** (`<BotBadge />`).
- **Champion-crowning ticker-tape effect** on tournament finale.

## Risks

- **Monaco bundle weight.** Lazy-load is mandatory. Submit page chunk should stay under 700KB gzip even with Monaco.
- **Multipart upload edge cases.** File size + extension validation client-side AND server-side; surface inline errors.
- **Bracket layout.** Non-power-of-2 participants need byes; rendering must match a UFC fight-card poster aesthetic without breaking on weird counts.
- **Live tournament SSE.** Same shape concerns as `useBattleEvents` — zod-validate every event before applying.
