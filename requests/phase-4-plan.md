# Phase 4 — The Arena (centerpiece)

**Branch:** `phase-4-arena` (stacked on `phase-3-leaderboard`)

## Scope

The showpiece. Live battle viewing with SSE event stream, animated split-screen bout, KO graphics, and a finale-quality decision moment. Three sequential phases on the same screen — pre-fight, bout, decision — with portrait reactions, particle attacks, hype meter, slam-in stat overlays, and optional walkout audio.

## Exit criteria (verbatim from kickoff §4 Phase 4)

- Full battle viewed end-to-end with real backend SSE events.
- Animations fire correctly per event type.
- KO and decision graphics trigger on appropriate conditions.
- Stat slam-ins feel snappy and don't block the underlying UI.
- Replay mode works at variable speed.
- Shareable highlight image generates correctly.
- Visual regression on KO graphic, decision graphic, mid-bout state.
- Audio toggle works correctly (no autoplay on mute).
- Battle page works on tablet (mobile is best-effort — accepted limitation).

## Backend dependency posture

Backend Phase 5 (battles + SSE) isn't shipped yet. Like Phases 2-3, frontend Phase 4 builds against MSW-mocked SSE streams. The shape of `BattleEvent` is hand-written here and will be regenerated from OpenAPI once backend ships. A `playMockBattle()` helper drives MSW SSE streams in dev so you can experience the full bout without a backend.

## Data shapes (extends `src/api/types.ts`)

```ts
export interface Battle {
  id: string;
  status: 'pre_fight' | 'live' | 'completed';
  fighter_a: BattleFighter;
  fighter_b: BattleFighter;
  rounds_total: number;
  current_round: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  winner_bot_id: string | null;
  outcome: 'ko' | 'tko' | 'decision' | 'draw' | 'no_contest' | null;
  rank_change?: { previous_champion_bot_id: string; new_champion_bot_id: string };
}

export interface BattleFighter {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
  corner: 'red' | 'blue';
  rank: number | null;
}

// SSE event union (validated via zod before applying state)
export type BattleEvent =
  | { type: 'walkout'; bot_id: string; ts: string }
  | { type: 'fight_start'; ts: string }
  | { type: 'round_start'; round: number; input_id: string; input_name: string; ts: string }
  | { type: 'round_progress'; round: number; bot_id: string; progress_pct: number; ts: string }
  | {
      type: 'round_end';
      round: number;
      winner_bot_id: string;
      a_time_seconds: number;
      b_time_seconds: number;
      delta_seconds: number;
      ts: string;
    }
  | { type: 'fighter_downed'; bot_id: string; reason: 'timeout' | 'crash' | 'oom'; ts: string }
  | { type: 'commentary'; text: string; ts: string }
  | {
      type: 'fight_end';
      winner_bot_id: string | null;
      outcome: Battle['outcome'];
      a_rounds_won: number;
      b_rounds_won: number;
      rank_change?: Battle['rank_change'];
      ts: string;
    };
```

## Slices

### Slice 1 — types + MSW SSE mock + `useBattleEvents` hook (RED first)

- `Battle`, `BattleFighter`, `BattleEvent` types in `src/api/types.ts`.
- `src/api/sse.ts` — `useBattleEvents(battleId)` hook. Opens `EventSource`, validates events via zod, returns `{ events, derived, connected, error }`. `derived` is the live view-model: `{ status, currentRound, aHealth, bHealth, aRoundsWon, bRoundsWon, hypeLevel, lastEvent, animationCue }`.
- `src/lib/battleReducer.ts` — pure reducer that folds `BattleEvent[]` into `BattleDerivedState`. Trivially unit-testable.
- `src/test/msw/battleStream.ts` — MSW handler that replies with a streaming `text/event-stream` body. Driven by a `playMockBattle()` helper that emits a scripted sequence with realistic timing (configurable speed).
- Tests: pure reducer covers every event type; SSE hook integration test (using MSW + `EventSource` polyfill in jsdom).

### Slice 2 — `<HealthBar />` + `<RoundCounter />` + `<HypeMeter />`

- `<HealthBar value maxValue cornerColor>` — segment-display style bar; ticks down on round losses.
- `<RoundCounter current total>` — LED-display format.
- `<HypeMeter level>` — top-bar that fills on dramatic moments. When full, triggers slight zoom + saturation bump on the parent container ("crowd going wild"). Driven by a class on `<body>` so the effect is global.

### Slice 3 — `<PreFightStaredown />`

- Two `<TaleOfTheTape />` cards (active mode) with Ken Burns slow zoom on each portrait.
- Trash-talk quote bubbles below each portrait (read from `bot.trash_talk`; generic taunt fallback).
- Countdown timer in Bebas Neue 96px overhead.
- "ENTER ARENA" combat button at bottom that transitions to bout phase.
- Optional walkout audio cues per language (Howler.js, lazy-loaded only when audio toggle is on).

### Slice 4 — `<LiveBattle />`

- Split-screen layout. Left = bot A (red corner), right = bot B (blue corner), thin VS spine in the middle.
- Each side: portrait (full-color, animated), `<HealthBar />` below, corner-color glow around the portrait, `<LEDDisplay />` for current-round timer.
- Center spine: current input visualized (small bars for arrays under 100, abstracted heatmap otherwise), `<RoundCounter />`, last-round-result callout fading in/out.
- Right side panel (collapsible): scrolling commentary feed showing SSE events as broadcast-ticker lines.
- Slam-in stat overlays on `round_end` events: "ROUND 7: BOT A WINS BY 0.041s — 3.2× FASTER" — appears via Framer Motion `slam-in` variant, holds 2s, slides out.
- Damage reaction on `round_end` for the loser: brief shake + red flash.
- `fighter_downed` event: bigger shake, "DOWNED!" callout, opponent gets a small free attack animation.
- Digimon-style attack visualization: on `round_end`, winner's portrait does a forward lunge, particle beam fires across the screen toward the loser (CSS keyframes, beam color = winner's corner), loser's portrait does the damage reaction.
- Damage filter states on portraits: slight red tint at 50% health, scan-line glitch at 25%, heavy damage filter at 10%.
- Special move callouts on dramatic round wins: "MERGESORT — DIVIDE AND CONQUER" in Bebas Neue 1.5s.
- Crowd silhouettes along the bottom (animated SVG, hands up on KOs).
- Stoppage referee overlay on `fighter_downed`: "TECHNICAL KNOCKOUT — REFEREE WAVES IT OFF AT 0:14".
- Implementation: the entire bout phase is driven by `useBattleEvents(battleId)` + a local "animation cue queue" derived from the events, popped one at a time so animations don't trample.

### Slice 5 — `<PostFightDecision />`

- Triggers on `fight_end` event.
- Final scorecard prominent: rounds won by each, total time differential, winner.
- KO graphic if blowout (≥80% rounds to one fighter): full-screen Bebas Neue 96px "KNOCKOUT" with combat-red glow, loser portrait with heavy damage filter, winner portrait with championship glow.
- Decision graphic if narrow: "DECISION VICTORY" with per-round scorecard tabulated.
- Champion's belt overlay with glow-cycle if `rank_change` is set (winner just dethroned previous #1).
- Shareable highlight: auto-generated SVG "FIGHT POSTER" with both portraits, result, date. Social-share button uses native share sheet API; falls back to copy-link.
- Replay button: re-renders the battle from the event log at 4× speed for highlights.
- "Next Fight" button: navigates to another active or recent battle.
- Post-fight interview: AI-generated victor quote (cached per-battle on the backend) shown as a quote bubble after the decision graphic for top-10 wins or upsets.

### Slice 6 — pages: `<ArenaIndexPage />` + `<BattlePage />`

- `<ArenaIndexPage />` at `/arena`: lists current/recent/upcoming battles. Active one featured prominently with a "live" indicator. Auto-redirect option to live view (opt-in via toggle, off by default).
- `<BattlePage />` at `/arena/:battleId`: the main event. Three sequential views (PreFightStaredown → LiveBattle → PostFightDecision) transitioning into each other based on `battle.status` + the SSE-derived state.
- Replace Phase 1 placeholders.

### Slice 7 — audio integration

- `src/lib/audio.ts` — Howler.js wrapper, lazy-loaded only when `useAudioStore.enabled === true`. Audio assets (royalty-free):
  - 4 walkout cues, one per language (~30KB each, MP3 64kbps).
  - 1 ambient crowd loop (~80KB).
  - "ding" round start, "thud" round loss, "fanfare" KO (~10KB each).
- All assets in `public/audio/`. Total ~250KB but only loaded when audio toggle is on.
- Hooks: `useFightAudio()` reads battle events and triggers cues. No autoplay on mute (browser policy compliance).

### Slice 8 — visual regression baseline (deferred from Phases 2-3)

- Activate D-1 from `debt.md`: Playwright workflow + spec for KO graphic, decision graphic, mid-bout state.
- This is the natural moment to land it because Phase 4's visuals are the most regression-prone.

### Slice 9 — close-out

- Update `references/component-catalog.md`, `references/api-contracts.md`, `references/state-management.md` (SSE patterns get a real example).
- Update `CLAUDE.md` phase table.
- PR ready, `/phase-complete`.

## Dependencies to add

- `howler` (~30KB gzip; lazy-loaded only when audio is enabled).
- No other new deps — Framer Motion + Tailwind animations cover the visuals.

## Risks

- **Animation perf.** Multiple simultaneous Framer Motion animations + CSS keyframes + filter state changes on portraits can drop frames on slow hardware. Mitigation: respect `prefers-reduced-motion` (already wired in `animations.css`); profile on the lowest-spec device we expect (assume MacBook Air M1 baseline); fall back to instant transitions when reduced motion is set.
- **SSE flakiness.** EventSource auto-reconnects but doesn't replay missed events. Mitigation: backend should support `Last-Event-ID` for resume; frontend hook reconnects and shows a "RECONNECTING..." overlay during the gap; on reconnect, re-fetches the battle's full event log via REST and reconciles.
- **Animation queue starvation.** If events arrive faster than animations play, the queue grows unbounded. Mitigation: collapse compatible events (e.g., multiple `round_progress` updates), drop redundant ones, cap queue size.
- **Audio autoplay policy.** Browsers block audio without a user gesture. Mitigation: audio only plays when the user has explicitly enabled it via the toggle (which counts as a gesture).
- **Bundle bloat.** Howler + audio file imports could push the arena chunk over budget. Mitigation: dynamic `import('howler')` only when `enabled === true`; audio files served as static assets, not bundled.

## Out of scope (defer)

- **Real-time-only backend integration.** Phase 4 ships against MSW; live backend integration goes once sort-bot-api Phase 5 ships SSE.
- **Replay mode timing accuracy.** 4× speed is approximate; precise timing requires backend-supplied event timestamps with sub-millisecond precision (will tune later).
- **Mobile arena experience.** Best-effort. The kickoff explicitly accepts this.

## Decisions (locked)

- **Audio**: deferred entirely. The audio store + lazy-load wrapper exist from Phase 1, so plugging in cues later is straightforward. Sourcing royalty-free walkout audio is a content problem, not a code problem; Slice 7 moves to `debt.md` (D-4).
- **Particle beam**: CSS keyframes only. Cheaper than SVG/canvas, GPU-accelerated, and the demo doesn't need physics-grade particles.
- **Hype meter**: frontend-computed. Derived state in the battle reducer — `hype = clamp(recent_dramatic_events_count / 5, 0, 1)` over the last 10 events. Backend doesn't need a special event for this.
- **LiveBattle scope** trimmed. Polish items the kickoff explicitly tags as "extras" move to debt:
  - Special move callouts on dramatic round wins (D-5)
  - Crowd silhouettes along the bottom (D-5)
  - Stoppage referee overlay on `fighter_downed` (D-5)
  - Post-fight victor interview quote (D-5)
  - Damage filter scan-line glitch at 25% (kept; just a CSS filter)
- **Visual regression**: still deferred. Phase 4 is the natural moment but it's a separate workflow concern (Playwright in CI). D-1 stays open.

## Slices (revised)

1. Types + MSW SSE mock + `useBattleEvents` hook + `battleReducer` (RED first)
2. `<HealthBar />` + `<RoundCounter />` + `<HypeMeter />` primitives
3. `<PreFightStaredown />`
4. `<LiveBattle />` — split-screen, slam-in overlays, Digimon attack, damage filter states, commentary feed
5. `<PostFightDecision />` — KO graphic, decision graphic, fight-poster export
6. `<ArenaIndexPage />` + `<BattlePage />` composition + 3-phase transition
7. ~~Audio~~ → deferred (D-4)
8. ~~Visual regression~~ → deferred (D-1)
9. Close-out: catalog + contracts + state-management + CLAUDE + PR

## Validate gate (unchanged)

```
1. eslint . --max-warnings=0
2. prettier --check .
3. tsc --noEmit
4. vitest run
5. vite build
```

CI passes. Manual smoke: load `/arena/<id>` with `playMockBattle()` running, watch the full bout end-to-end, confirm KO graphic on a blowout result, confirm decision graphic on a narrow result.
