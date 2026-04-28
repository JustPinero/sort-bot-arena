# SORT ARENA WEB — PROJECT KICKOFF (v3.5 template)

# ============================================================

# Generated from universal-v3.5 kickoff template.

# All [ASK ME] fields resolved during pre-build planning.

# Companion to sort-bot-api-kickoff.md (the backend repo).

# [CLAUDE WILL HANDLE] sections will populate during initialization.

# ============================================================

# ============================================================

# SECTION 1: PROJECT IDENTITY

# ============================================================

**App Name:** sort-arena-web

**Tagline:** A BattleBots × UFC broadcast experience for sorting algorithms.

**Problem:** The sort-bot-api backend exposes a sophisticated benchmarking and battle system, but raw API responses don't tell stories. Without a frontend, the bots are just rows in a table — no fighters, no rivalries, no spectacle. This frontend turns API data into narrative: bots become fighters with records and signature moves, evaluations become bouts, the leaderboard becomes the P4P rankings, and tournaments become fight nights. The site exists to make the API legible and entertaining to non-engineers, and to demonstrate end-to-end product thinking alongside the backend takehome.

**The experience:** A user lands on a dark, broadcast-style homepage with a live ticker of recent submissions, a featured battle in progress, and the night's biggest upset. They click into the leaderboard and see top fighters arranged on a podium with their records, weight classes, and signature moves. They navigate to a fighter's profile — full Tale of the Tape with AI-generated portrait, scouting report, fight history, and per-input performance heatmap. They start a battle: pre-fight stare-down, walkout animation, two portraits face off in a Digimon-style bout with beam attacks and damage reactions, real-time SSE-driven scorecard, and a dramatic KO graphic when one bot wins decisively. They submit their own bot via an in-browser code editor with live evaluation feedback, and watch their fighter make their pro debut.

**Team:** Solo. Companion project to sort-bot-api. Audience is portfolio reviewers, fellow engineers, and anyone the developer wants to show off the system to.

# ============================================================

# SECTION 2: STACK DEFINITION

# ============================================================

## Frontend framework

**Frontend:** Vite + React 18 + TypeScript. Pure SPA, no SSR — content is dynamic and authenticated, SEO is not a goal, and Vite's dev experience is unmatched for this kind of project.

## Backend / API layer

**Backend:** N/A — this frontend consumes sort-bot-api (separate repo). All persistence, auth, AI integration, and business logic live in the backend. The frontend is a pure presentation layer.

## Primary language

**Language:** TypeScript, strict mode. Backend API contract types are auto-generated from sort-bot-api's OpenAPI spec via `openapi-typescript`, so frontend imports types directly. When backend contracts change, frontend won't compile until updated. End-to-end type safety across repos is the architectural payoff for going split-repo.

## Database

**Database:** N/A — server state lives in sort-bot-api. Frontend persistence is limited to: API key in localStorage, theme preference in localStorage, audio toggle in localStorage, dismissed-tooltips set in localStorage. Server state cached via TanStack Query (5-minute default stale time).

## Auth

**Auth:** Bearer-token API key obtained from sort-bot-api. Frontend auto-provisions a guest user on first visit (POST /v1/users with a generated friendly name like "anonymous-otter-4729"), stashes the returned key in localStorage, and includes it in every authenticated API call via `Authorization: Bearer <key>` header. User can later "claim" the guest profile by setting a real display name and optional email — backend supports this without any new auth flow. Magic-link recovery is documented as future work in the backend; not required for this frontend.

## Hosting / deployment target

**Hosting:** Vercel. Static SPA deployment with `vercel.json` SPA-rewrite for client-side routing. Preview deployments per PR. CSP configured to allow the backend API origin and the necessary CDNs (fonts, Leonardo-served portraits if proxied through backend). No server-side runtime needed — all dynamic data comes from the API.

## Testing framework

**Testing:** Vitest for unit tests + React Testing Library for component tests + Playwright for E2E flows on critical paths (submit-and-watch-evaluate, view-leaderboard-click-into-profile, start-battle-watch-completion). Visual regression testing via Playwright screenshots on the Tale of the Tape and KO graphic — these are visually critical components and a regression there would be embarrassing.

## Key third-party integrations

**Integrations (all consumed via backend, no direct frontend keys):**

- **sort-bot-api** — every page reads from this. OpenAPI-generated TypeScript client.
- **Leonardo.ai bot portraits** — frontend never calls Leonardo directly; backend proxies. Frontend just renders the `portrait_url` returned on the bot record.
- **Anthropic Claude** for trash-talk and AI analysis — proxied through backend, frontend just reads `bot.trash_talk` and `bot.analysis` fields.

**Frontend-only libraries:**

- **TanStack Query** for server state caching and synchronization.
- **Zustand** for client state (current user, theme, audio toggle, active battle subscription).
- **React Router v6** for routing.
- **react-hook-form + zod** for forms (bot submission, profile editing).
- **Framer Motion** for layout animations, page transitions, and the dramatic moments (KO graphics, slam-in overlays, walkout entrances). Non-negotiable for the vibe.
- **Monaco** via `@monaco-editor/react` for the in-browser code editor on the submit page.
- **Recharts** for rank-history line charts and per-input performance heatmaps.
- **Howler.js** for audio (toggleable, off by default — walkout cues, crowd noise).
- **Lucide** for UI icons; custom SVG for combat-specific motifs (hazard stripes, championship belt, KO graphic).
- **shadcn/ui** for base component primitives, heavily themed.
- **openapi-typescript** for type generation from the backend's OpenAPI spec.

# ============================================================

# SECTION 3: CORE DATA MODEL

# ============================================================

**Core data entity:** None — this is a presentation-layer frontend that doesn't own data. The conceptual entities (Bot/Fighter, Battle, Tournament, User) live in sort-bot-api and are consumed via the typed API client.

**Client-side state model (Zustand stores):**

- `useAuthStore` — current user (id, display_name, api_key), guest_provisioned flag, claim status.
- `useThemeStore` — preferred theme (dark | light | system), per-route forced theme overrides.
- `useAudioStore` — audio enabled toggle, master volume, walkout-sounds enabled.
- `useBattleStore` — currently-subscribed battle ID, accumulated event log, derived state (round counts, current scores, animation queue).

**Server-state caching (TanStack Query):**

- Query keys mirror API resource paths: `['bots', botId]`, `['leaderboard', filters]`, `['battles', battleId]`, etc.
- 5-minute default stale time on read-mostly resources (leaderboard, profiles).
- Real-time resources (active battles, live event feed) bypass cache, use SSE subscriptions.
- Optimistic updates on submission (bot appears in user's collection immediately, rolled back on failure).

# ============================================================

# SECTION 4: PHASE BREAKDOWN

# ============================================================

**Phase 1 — Foundation & Design System:**
What gets built: Vite + React + TS project skeleton with strict TypeScript config. Tailwind config with all design tokens from `docs/design-system.md` (drop in tokens.css and tailwind.config.ts content verbatim — they're spec'd in that document). Font loading via `@fontsource/bebas-neue`, `@fontsource/inter` (with `cv11`, `ss01`, `ss03` features), `@fontsource/jetbrains-mono` (with `tnum` feature), optionally DSEG7 for LED segment displays. Theme context (`<ThemeProvider>`) reading system preference and supporting per-route forced theme via a `forceTheme` prop on layout components. OpenAPI-generated TypeScript client (`src/api/types.ts` regenerated via npm script that fetches from local backend or production). Thin fetch wrapper (`src/api/client.ts`) handling: auth header from localStorage, guest auto-provisioning on first call, error normalization, AbortController timeout (15s default, 60s for SSE). TanStack Query setup with default 5-minute stale time. Zustand stores scaffolded. Layout shell: top nav with logo, primary nav (Arena, Rankings, Tournaments, Submit), user menu, theme toggle. React Router routes scaffolded for all planned pages with 404/error boundaries. shadcn/ui installed and themed via the CSS variables — `Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Tooltip`, `Toast` components. Custom shadcn variants: `Button` (`combat`, `combat-secondary`, `champion`), `Card` (`fighter`, `featured`), `Badge` (`hazard`, `combat`, `champion`, `rookie`, `record`). Core utility components: `<HazardStripes />` (thin/thick/horizontal/vertical), `<LEDDisplay />` (timer, scoreboard wrappers), `<RecordChip />` (W-L-D mono format), `<CornerColorBadge />` (deterministic hash from bot ID), `<WeightClassChip />` (language → weight class mapping). a11y baseline: focus-visible rings, keyboard navigation on all interactive elements, semantic landmarks, jsx-a11y lint configured with errors-on-violation.

Exit criteria: `pnpm dev` starts a themed application that renders the layout shell with all routes scaffolded as placeholder pages. Theme toggle works. Guest auto-provisioning succeeds against a running backend (or mock). Lighthouse scores: Accessibility 100, Best Practices 100 on the layout shell. All design tokens render correctly via `<DesignSystemPage />` — a dev-only route that displays every color, font size, button variant, badge variant, and animation primitive for visual verification.

---

**Phase 2 — Tale of the Tape & Bot Profile Pages:**
What gets built: The `<TaleOfTheTape />` component — the foundational design test that proves the visual language works. Two-fighter face-off layout with VS divider, sized 380px × 600px on desktop, stacks vertically with horizontal VS strip on mobile. Each card structure top-to-bottom: hazard-stripe header strip, portrait area (1:1 aspect, corner-color border, fallback procedural silhouette while `portrait_url` is null), nickname display in Bebas Neue 48px (mobile: 32px), real display_name + algorithm subtitle, weight class chip + record chip row, stat grid (signature move, Achilles heel, KO%, recent form as W/L symbols), achievements row (icon strip), champion belt overlay when bot is current #1. Two states: pre-fight (static, hover-eligible, click-through to profile) and battle-active (no click-through, currently-attacking emphasis). All variants implemented: rookie (0-0-0 with ROOKIE chip), unrated portrait fallback, champion glow, retired (greyscale + RETIRED chip). `<BotProfilePage />` route at `/bots/:botId` using `<TaleOfTheTape />` as the hero in single-fighter mode (one card centered, full-width on tablet). Below the hero: tabs for Fight History / Performance / Scouting Report / Achievements. Fight history table with paginated battle results (opponent thumbnail, outcome, date, KO/DEC indicator, click into battle replay). Performance tab: per-input heatmap (19 columns × 3 rows for sizes, color-coded by relative time vs field — combat-red for "gets exposed here," tech-cyan for "finishing move"), rank-history line chart (Recharts, snapshot data over time, year markers like a fighter's career arc). Scouting report tab: AI analysis displayed as a fight-promo "BREAKDOWN" card with structured sections. Achievements tab: full achievement gallery with locked/unlocked states. `<HeadToHeadPage />` at `/bots/:a/vs/:b` showing both fighters in Tale of the Tape format with shared-input performance comparison below.

Exit criteria: any valid bot ID from the API renders a complete profile page with all tabs functional. Tale of the Tape is pixel-perfect on desktop, tablet, and mobile. Hovering a fighter card produces the expected glow and scale transition. Champion belt only appears on the actual current #1. Profile loads in under 1.5 seconds on a fast connection (TanStack Query caches the bot data, parallel fetch of secondary tabs). Visual regression test snapshots committed for: TotT pre-fight, TotT champion variant, TotT rookie variant, TotT mobile layout, full profile page.

---

**Phase 3 — Leaderboard (P4P Rankings):**
What gets built: `<LeaderboardPage />` at `/leaderboard`. Top section: podium for #1, #2, #3 — three larger cards with full TotT-lite styling (nickname, record, signature move, weight class), gold/silver/bronze accents, #1 has the champion belt and `glow-cycle` animation. Below: filterable rankings table starting at rank #4. Columns: rank (with trend arrow up/down/steady from last week's snapshot), fighter (avatar + nickname + display_name), record (W-L-D in mono), weight class chip, KO%, signature input + time, last fight date, action menu (view profile, challenge to battle, share). Filter chips along the top: weight class (all / heavyweight / cruiserweight / middleweight / lightweight), activity (all-time / active this month / active this week), language (subset of weight class). Sort options: rank (default), W-L-D, KO%, recent activity, alphabetical. Hover any row: preview-loads that fighter's TotT card in a side panel (300ms hover-intent debounce, prevents thrashing). Click row: full navigation to profile page. `<PerInputLeaderboard />` at `/leaderboard/inputs/:inputId` — same structure but ranked by performance on a specific input, with that input's pattern visualized at the top (small-array chart for the actual integers, statistical summary for large arrays). Pagination via infinite scroll with prefetch on scroll-velocity-detection. Empty state when filters return zero results: themed "NO FIGHTERS MATCH THESE WEIGHT CLASSES — TRY EXPANDING YOUR SEARCH" message. URL state for filters (shareable links to filtered views).

Exit criteria: leaderboard loads in under 1 second. Filters apply instantly (server-side filtering via API query params). Hover preview works without layout shift. Per-input leaderboards render correctly for all 57 built-in inputs and any custom inputs the user has access to. URL deep-links to filtered states work. Visual regression on the podium top-3 layout.

---

**Phase 4 — The Arena (centerpiece feature):**
What gets built: This is the showstopper. `<ArenaIndexPage />` at `/arena` lists current/recent/upcoming battles with the active one featured prominently (auto-redirect option to live view). `<BattlePage />` at `/arena/:battleId` is the main event. Three sequential phases on the same screen, transitioning into each other:

_Pre-fight phase (`<PreFightStaredown />`)._ Both fighters' Tale of the Tape cards render with a slow Ken Burns animation on each. AI-generated trash talk (from the backend trash-talk endpoint) displays in quote bubbles below each portrait. Countdown timer in giant Bebas Neue 96px overhead. "ENTER ARENA" button at bottom. Optional walkout audio cues triggered for each fighter (Howler.js, off by default unless audio toggle is on).

_Bout phase (`<LiveBattle />`)._ Split-screen layout: left half is bot A, right half is bot B, divided by a thin VS-themed center spine. Each side has: the AI-generated portrait (full-color, animated), a health bar below it (segment-display style, starts at 100, ticks down with each round loss), the corner color glowing around the portrait, the current round timer in LED display style. Center spine: current input being processed (visualized as small bars for arrays under 100 elements, abstracted heatmap for larger), round counter "ROUND 7/19," last-round-result callout that fades in/out. Right side panel (collapsible): scrolling commentary feed showing SSE events as broadcast-ticker lines ("BOT A CRUSHES THE PARTIALLY-SORTED INPUT — MASTERCLASS"), AI-generated commentary on dramatic moments (cached and rate-limited via the backend). Stat slam-in overlays trigger on round completion: "ROUND 7: BOT A WINS BY 0.041s — 3.2x FASTER" — appears via slam-in animation, holds 2 seconds, slides out. When a bot loses a round, their portrait reacts: brief shake, red flash, health bar tick down. When a bot times out or crashes: bigger shake, "DOWNED!" callout, opponent gets a small free attack animation. The Digimon-style attack visualization: when a round result comes in, the winner's portrait does a quick forward lunge (Framer Motion `whileTap`-style transform), a particle beam fires across the screen toward the loser (CSS keyframe animation, color matches winner's corner color), the loser's portrait does the damage reaction. Implementation note: the entire bout phase is driven by a single `useBattleEvents(battleId)` SSE hook that returns the event log, with a derived state machine that translates events into animation cues.

_Decision phase (`<PostFightDecision />`)._ Battle ends when all rounds complete or one bot can't continue. Final scorecard displays prominently: rounds won by each, total time differential, winner determined by SSE stream's terminal event. KO graphic if it was a blowout (≥80% rounds to one fighter): full-screen Bebas Neue 96px "KNOCKOUT" with combat-red glow, fighter loser's portrait with heavy damage filter, winner's portrait with championship glow. Decision graphic if narrow: "DECISION VICTORY" with the per-round scorecard tabulated. Champion's belt overlay with glow-cycle if the winner just dethroned the previous #1 (compares pre-battle and post-battle ranks). Shareable highlight: auto-generated "FIGHT POSTER" image — both portraits, result, date, social-share button (opens native share sheet, falls back to copy-link). Replay button: re-renders the battle from the event log at 4× speed for highlights. "Next Fight" button: pulls another active or recent battle.

Implementation extras: damage states on portraits (CSS filters as health drops — slight red tint at 50%, scan-line glitch at 25%, heavy damage at 10%), special move callouts (when a bot wins a round dramatically: algorithm name in Bebas Neue with subtitle, e.g. "MERGESORT — DIVIDE AND CONQUER," 1.5 seconds), crowd silhouettes (animated SVG along bottom, hands up on KOs), hype meter (top of screen, fills on dramatic moments, when full triggers "crowd going wild" effect — slight zoom + shake + saturation bump for 1 second), stoppage referee (when a bot crashes mid-round: "TECHNICAL KNOCKOUT — REFEREE WAVES IT OFF AT 0:14" referee silhouette overlay), post-fight interview (AI-generated victor's quote for top-10 wins or upsets, rendered as quote bubble after decision graphic).

Exit criteria: full battle viewed end-to-end with real backend SSE events. Animations fire correctly per event type. KO and decision graphics trigger on appropriate conditions. Stat slam-ins feel snappy and don't block the underlying UI. Replay mode works at variable speed. Shareable highlight image generates correctly. Visual regression on KO graphic, decision graphic, mid-bout state. Audio toggle works correctly (no autoplay on mute). Battle page works on tablet (mobile is best-effort — the experience genuinely benefits from screen real estate).

---

**Phase 5 — Submit / Playground & Tournaments:**
What gets built: `<SubmitPage />` at `/submit`. Hero: "REGISTER YOUR FIGHTER" headline in Bebas Neue, hazard-stripe accents. Form (react-hook-form + zod): fighter nickname (auto-suggested via backend on language pick, user-overridable), weight class (radio buttons with language icons — Heavyweight = compiled binary, Cruiserweight = Go, Middleweight = Node, Lightweight = Python), file upload OR Monaco editor (toggle). Monaco editor: starter template per language with the bot-contract structure pre-filled and inline comments explaining stdin/stdout protocol, syntax-highlighted, theme matching the dark UI. "TEST SPARRING" button: submits the bot to the API, transitions screen to `<DebutEvaluation />` view. Debut evaluation view: shows the bot's freshly-generated portrait (Leonardo.ai, may take a few seconds — silhouette while pending), live evaluation feedback ticker streaming SSE events ("FIGHTER 'QUICK' TAKES INPUT 1 IN 0.003s — IMPRESSIVE DEBUT," "FIGHTER 'QUICK' STRUGGLES ON ADVERSARIAL KILLER PATTERN — ROOKIE MISTAKE"), progress bar (X of 171 jobs complete), running placement estimate ("CURRENTLY PROJECTED: RANK #14"). When evaluation completes: full-screen "FIGHTER DEBUT COMPLETE" graphic, redirect to the bot's profile page after a 3-second hold. `<MyFightersPage />` at `/me/fighters` lists the current user's bots with quick stats and a "RETIRE" action (soft-delete via API, moves to Hall of Fame).

`<TournamentsListPage />` at `/tournaments` shows fight night cards (active, upcoming, completed) styled as broadcast event posters. Each tournament card: tournament name (auto-generated like "RUMBLE IN THE STACK," "SORT-FEST 8"), participant count, weight class restrictions, status, prize description. `<TournamentBracketPage />` at `/tournaments/:id` displays the bracket as a UFC fight card poster — main event at top (the championship match), undercard below (the prelims). Each match-up rendered as a compressed Tale of the Tape row: two portraits + nicknames + records, with the result badge (KO/DEC/UD) once complete. Live tournaments have a "HAPPENING NOW" indicator on the active match with a click-through to the live battle page. SSE subscription for tournament events: round advancement, match results, champion crowning. Champion-crowning moment: belt graphic + glow-cycle + ticker-tape effect when tournament concludes.

Exit criteria: full submit-to-debut-to-profile flow works end-to-end. Monaco editor renders Python and Node templates correctly. Submission errors (invalid file size, sandbox-rejected source) display useful inline messages. Tournament bracket renders correctly for power-of-2 and non-power-of-2 participant counts (byes shown explicitly). Live tournament events drive bracket state updates correctly.

---

**Phase 6 — Polish, Homepage, & Stretch Features:**
What gets built: `<HomePage />` at `/` — the broadcast-feed landing page. Hero section: scrolling broadcast ticker across the top with rank changes, submissions, KOs, and tournament announcements (auto-scrolling, pause-on-hover). Featured fight: large card showing the highest-stakes current battle (top-5 vs top-5, or the most-recent close result), click-through to live arena. Rookie of the Day: highlight on the best-performing newly-debuted bot. Biggest Upset: spotlight on the closest finish or biggest rank-jump in the last 24h. Champion's corner: current #1 with profile link and recent record. `<HallOfFamePage />` at `/halloffame` for retired/inactive bots with their final career stats and inducted-on date. `<AchievementsPage />` at `/achievements` browses all defined achievements with rarity stats (% of bots that have unlocked each). `<EventsFeedPage />` at `/events` is a real-time live feed of system activity (uses the global SSE feed endpoint).

Audio integration: optional walkout cues for fighter entrances, optional crowd noise on the arena page. Both opt-in via the audio toggle in user settings (off by default to respect users and autoplay policies). Procedurally selected per bot based on their algorithm + language hash so the same bot always gets the same walkout cue.

PPV promo card generator: when two top-5 bots are scheduled to face each other in a tournament, generate a full-screen poster at `/tournaments/:id/promo/:matchId` — both portraits silhouetted, dramatic copy, dates, shareable. Marketing-material energy.

Embeddable badges: `<BotBadge />` component that renders the SVG badge from the backend `GET /v1/bots/:id/badge.svg` endpoint with copy-paste embed code (markdown, HTML, or BBCode) on the bot profile page. GitHub-shield style. Cheap to implement, viral if anyone uses it.

Performance pass: code splitting per route via React Router lazy loading, image optimization (Leonardo portraits served at appropriate sizes from the backend), font-display: swap on @font-face to avoid FOIT, prefetch on link hover for likely navigations, Lighthouse audit on every key page targeting 90+ on Performance / Accessibility / Best Practices / SEO.

Stretch (do if time permits): animated sort visualization mode in the arena (toggle in battle viewer settings, replaces Digimon-style with actual array-sorting bar animation), keyboard shortcuts for power users (j/k to navigate fighters in lists, "f" to fight a featured bot, "?" for shortcut help), achievement unlock notifications (when a bot you submitted unlocks an achievement, toast notification), saved comparison dashboards (pin 2-4 fighters for at-a-glance comparison).

Exit criteria: all routes ship and feel polished. Lighthouse Performance ≥ 85, Accessibility = 100, Best Practices ≥ 95 on the leaderboard, profile, and arena pages. All visual regression tests pass. Mobile responsive on profile and leaderboard pages (arena is desktop-first, accepted limitation). Production deployment to Vercel with SPA rewrite, CSP headers, custom domain optional.

# ============================================================

# SECTION 5: ENVIRONMENT VARIABLES

# ============================================================

**Required:**

- `VITE_API_BASE_URL`: URL of the sort-bot-api backend (e.g., `https://api.sort-arena.dev` or `http://localhost:8080` in dev)

**Optional:**

- `VITE_GUEST_NAME_PREFIX` (default: `anonymous-`): prefix for auto-generated guest names
- `VITE_ENABLE_AUDIO_BY_DEFAULT` (default: `false`): if true, audio toggle starts on (rare, mostly for dev)
- `VITE_ENABLE_VISUAL_REGRESSION` (default: `false`): enables `/dev/design-system` route and Playwright visual-regression mode

**No frontend secrets.** The Anthropic and Leonardo keys live exclusively on the backend. The frontend never proxies or re-exposes them. CSP headers explicitly block third-party API origins to enforce this — the frontend can only fetch from `VITE_API_BASE_URL` and the configured CDN allowlist.

`.env.example` checked in. `.env.local` gitignored. Vite will fail to start if `VITE_API_BASE_URL` is missing — `src/api/client.ts` validates this at module load.

# ============================================================

# SECTION 6: KNOWN CONSTRAINTS

# ============================================================

**In scope:**

- Full UI for every backend endpoint: leaderboards (overall + per-input + per-size), bot profiles, head-to-head, battles with live SSE, tournaments with live SSE, submission with Monaco editor, custom inputs, achievements, hall of fame, homepage broadcast feed, embeddable badges.
- BattleBots × UFC theming everywhere — vocabulary swap (bots = fighters, weight classes = languages, etc.), broadcast-quality presentation, Tale of the Tape, KO graphics, championship belts.
- Light mode support on data routes; forced dark on combat routes.
- Mobile-responsive on data routes (leaderboard, profile, lists). Desktop-first on arena (acceptable limitation, the experience is the experience).
- a11y baseline: full keyboard nav, focus management, semantic landmarks, screen-reader friendly on data routes (arena is best-effort given the heavy visual emphasis).

**Out of scope:**

- Server-side rendering / SSG. Pure SPA.
- Native mobile apps. Mobile-responsive web is enough.
- Real user authentication beyond the API-key guest flow. No password reset, no OAuth, no email verification — those are documented as future work in sort-bot-api's ARCHITECTURE.md.
- Direct Leonardo.ai or Anthropic integration from the frontend. Those APIs are proxied through sort-bot-api; the frontend never gets keys.
- Internationalization. English only.
- Analytics SDKs (Segment, Mixpanel, etc.). The backend logs the relevant events.
- A CMS for site copy. Static strings live in `src/copy/` and get edited in the codebase.
- Real-money / payments / subscriptions. This is a portfolio piece.

**Hard constraints:**

- The frontend MUST work without backend AI features. If `analysis_url` is null on a bot, the scouting report tab shows a clear "ANALYSIS NOT AVAILABLE" state. If trash talk fails to generate, the pre-fight phase shows generic taunts. Graceful degradation, never broken UI.
- The frontend MUST work without bot portraits. Procedural silhouette per language as fallback. Portrait failures don't block bot profile loading.
- The frontend MUST NOT log API keys or any user-identifying tokens. Sentry / error-tracking integration (if added later) must filter localStorage values.
- Page weight budget: leaderboard initial load < 200KB JS gzip, profile page < 250KB gzip, arena page < 400KB gzip (allows for Framer Motion + animation libs).
- Lighthouse Performance ≥ 85 on data routes. Accessibility = 100 on all routes (the arena's heavy visuals will pull Performance down — we accept that there but enforce a11y everywhere).

# ============================================================

# SECTION 6B: DEPLOYMENT LANDMINES

# ============================================================

# [CLAUDE WILL HANDLE] — generate references/deployment-landmines.md

# during Phase 1 init, scoped to: Vercel + Vite + React + SPA.

#

# Specifically include warnings from these template categories:

# - Vercel: SPA rewrite rule required for client-side routing,

# VITE*/NEXT_PUBLIC* vars baked at build time, secrets never

# in client-prefixed env vars, env vars set for ALL environments

# (Prod + Preview + Dev), CSP must allow the backend API origin

# and font CDNs (fonts.googleapis.com, fonts.gstatic.com,

# cdn.jsdelivr.net for fontsource), CSP must include

# img-src for the backend domain serving Leonardo portraits.

# - Vite specifically: build output goes to dist/, vercel.json

# "outputDirectory": "dist", "rewrites" with source "/(.\*)"

# destination "/index.html". Env vars accessed via import.meta.env.

# Use mode-specific env files (.env.production, .env.preview)

# for environment-specific config.

# - SPA + SSE: EventSource opens a long-lived connection. Vercel's

# default function timeout doesn't apply (frontend is static),

# but the backend's load balancer (e.g., Railway) needs configured

# read timeout to keep SSE connections alive. Document this for

# the deploy story.

# - Generic: validate env vars at module load (throw on missing

# VITE_API_BASE_URL); never use echo to pipe env vars (use printf);

# git secrets check on staged files.

# ============================================================

# SECTION 6C: SECURITY LANDMINES

# ============================================================

# [CLAUDE WILL HANDLE] — generate references/security-landmines.md

# during Phase 1 init, customized to a SPA consuming an external API.

#

# Points to call out:

# - Bot source code submitted via the editor is sent to the API

# AS-IS — no client-side sanitization. The backend sandbox is

# the security boundary. Frontend treats user code as opaque.

# - User-generated content (bot nicknames, custom inputs, trash talk

# from the API) MUST be rendered with React's default escaping —

# never use dangerouslySetInnerHTML on any API response. Even the

# AI-generated trash talk and analysis: render as text, not HTML.

# - localStorage stores the API key. localStorage is XSS-vulnerable;

# ensure: strict CSP, no innerHTML usage, no eval, no Function

# constructor, dependency audit (no known-malicious packages).

# - Monaco editor: never use eval on the contents. The editor is

# a TEXT input with syntax highlighting, the source string goes

# straight to the API as a file upload. Treat the editor's value

# as untrusted user input even if it came from the user.

# - Image src for portraits: only allow URLs from the backend's

# configured domain (not arbitrary URLs from API responses).

# Even if the backend returns a Leonardo CDN URL directly, validate

# against an allowlist before rendering. Defense in depth.

# - Every fetch has AbortController timeout (15s default, 60s for SSE).

# No unbounded requests.

# - PATCH/PUT to API: validate field sets client-side (zod schemas)

# in addition to the backend's validation. UX wins from instant

# feedback; security wins are doubled validation.

# - SSE event handling: validate every event's shape via zod schema

# before applying state changes. A compromised backend or

# man-in-the-middle could inject malformed events; treat all

# incoming events as untrusted until validated.

# ============================================================

# SECTION 7: WHAT GETS GENERATED

# ============================================================

# [TEMPLATE BOILERPLATE — UNCHANGED]

# Generate the full v3.5 infrastructure as specified in the

# template: CLAUDE.md (thin brain, ~50-60 lines), all skills

# (test-audit, bughunt, optimize, drift-audit, course-correction,

# coding-standards, session-handoff, pre-deploy), all subagents

# (audit-runner, code-reviewer, debugger), all commands

# (run-audits, individual audit commands, handoff, course-correct,

# pre-deploy, phase-complete, ci-update, defer, activate), all

# hooks (PostCompact recovery, PreToolUse secret check,

# PostToolUse formatter — `prettier --write` for .ts/.tsx files,

# PostToolUse a11y lint via jsx-a11y for .tsx files,

# UserPromptSubmit working-state check), Git workflow (phase

# branches), CI pipeline (progressive — lint via eslint with

# typescript + jsx-a11y + react-hooks plugins, type check via

# `tsc --noEmit`, unit tests via vitest, E2E via playwright on

# tagged-complete flows), local-CI parity via scripts/validate.sh.

#

# Stack-specific coding standards to add to coding-standards skill:

# - Strict TypeScript. No `any` without an explicit comment justifying.

# - All API calls go through the typed client (src/api/client.ts).

# Never call fetch directly outside of that module.

# - Server state via TanStack Query, client state via Zustand,

# component state via useState. Never the wrong tool for the

# wrong category.

# - Animations via Framer Motion `<motion.div>` components.

# No raw CSS keyframes for complex animations (simple ones via

# the Tailwind animation tokens are fine).

# - Forms via react-hook-form + zod. Never raw onChange on inputs

# except for trivial UI state.

# - Components: PascalCase named exports, one component per file

# for top-level components, colocated test files (`<Name>.test.tsx`).

# - Styling: Tailwind utility classes preferred. CSS modules only

# when a component has truly complex styles (>30 lines of styling).

# - a11y: every interactive element needs proper role, label, and

# keyboard handling. jsx-a11y violations block CI.

# - Imports: ordered (1) external packages, (2) internal absolute

# imports via @/ alias, (3) relative imports. Enforced by eslint.

# - No console.log in committed code. console.warn/error allowed

# for genuine warnings/errors with context.

#

# Reference docs to generate during Phase 1:

# - references/architecture.md (the load-bearing senior doc)

# - references/api-contracts.md (mirror of OpenAPI types from backend)

# - references/component-catalog.md (PROJECT-SPECIFIC: every reusable

# component with its API and visual spec — Tale of the Tape,

# LED Display, Hazard Stripes, Record Chip, etc.)

# - references/design-system.md (drop in the entire content of

# sort-arena-web-design-tokens.md — that doc IS this reference)

# - references/routing.md (PROJECT-SPECIFIC: route table with

# layout, theme policy, auth requirements per route)

# - references/state-management.md (PROJECT-SPECIFIC: Zustand

# stores, TanStack Query patterns, SSE consumption hooks)

# - references/env-vars.md

# - references/deployment-landmines.md (per Section 6B)

# - references/security-landmines.md (per Section 6C)

# ============================================================

# SECTION 8 / 8B / 9: ACTION LOOP, REQUEST FORMAT, DEBT MGMT

# ============================================================

# [TEMPLATE BOILERPLATE — UNCHANGED]

# Use the v3.5 action loop verbatim: Prime → Plan → RED → GREEN

# → Validate. Use the request file format from Section 8B

# verbatim. Use the debt management workflow from Section 9

# verbatim including /defer and /activate commands.

#

# Frontend-specific note on the RED escape hatch: "pure

# presentational components with ZERO business logic" includes

# the design-system primitives (HazardStripes, LEDDisplay, etc.)

# and the static page layouts. State-bearing components (forms,

# editors, battle viewer, SSE consumers) MUST go through RED

# first.

# ============================================================

# DIRECTORY STRUCTURE

# ============================================================

# [TEMPLATE BOILERPLATE — UNCHANGED]

# Generate the standard v3.5 directory structure at project init,

# adapted for Vite + React layout:

#

# src/

# ├── api/

# │ ├── client.ts # fetch wrapper + auth

# │ ├── types.ts # generated from OpenAPI

# │ ├── queries.ts # TanStack Query hooks

# │ └── sse.ts # EventSource hooks

# ├── components/

# │ ├── ui/ # shadcn primitives, themed

# │ ├── design-system/ # HazardStripes, LEDDisplay, RecordChip, etc.

# │ ├── fighter/ # TaleOfTheTape, FighterCard, ProfileTabs

# │ ├── arena/ # PreFightStaredown, LiveBattle, PostFightDecision

# │ ├── leaderboard/ # PodiumTop3, RankingsTable, FilterChips

# │ ├── tournaments/ # BracketDisplay, MatchCard

# │ ├── submit/ # MonacoEditor, DebutEvaluation

# │ └── layout/ # AppShell, TopNav, ThemeProvider

# ├── pages/

# │ ├── HomePage.tsx

# │ ├── ArenaIndexPage.tsx

# │ ├── BattlePage.tsx

# │ ├── LeaderboardPage.tsx

# │ ├── PerInputLeaderboardPage.tsx

# │ ├── BotProfilePage.tsx

# │ ├── HeadToHeadPage.tsx

# │ ├── TournamentsListPage.tsx

# │ ├── TournamentBracketPage.tsx

# │ ├── SubmitPage.tsx

# │ ├── MyFightersPage.tsx

# │ ├── HallOfFamePage.tsx

# │ ├── AchievementsPage.tsx

# │ ├── EventsFeedPage.tsx

# │ └── DesignSystemPage.tsx # dev-only

# ├── stores/ # Zustand stores

# ├── hooks/ # useBattleEvents, useTournamentEvents, etc.

# ├── lib/

# │ ├── cornerColor.ts

# │ ├── motion.ts # Framer Motion variants

# │ ├── theme.ts

# │ └── format.ts # time formatting, record formatting, etc.

# ├── styles/

# │ ├── tokens.css

# │ ├── fonts.css

# │ ├── globals.css

# │ ├── patterns.css

# │ └── animations.css

# ├── copy/ # static UI strings

# ├── App.tsx

# └── main.tsx

#

# Plus standard root-level: tailwind.config.ts, vite.config.ts,

# vercel.json, tsconfig.json, .eslintrc, .prettierrc, package.json,

# pnpm-lock.yaml, .env.example, README.md, CLAUDE.md, .claude/,

# audits/, references/, requests/, scripts/, .github/workflows/.

# ============================================================

# SUPPLEMENTAL: ARCHITECTURE BRIEF

# ============================================================

# Captures key design decisions made during pre-build planning so

# Phase 1 generates accurate references/ without needing to

# re-derive them. Companion section to the equivalent in the

# backend kickoff.

## Visual system

The visual language is fully specified in the companion document `sort-arena-web-design-tokens.md` (also reproduced as `references/design-system.md` after Phase 1). Reference it as the authoritative source for color, type, spacing, motion, and component aesthetics. Key axioms:

- Dark mode is default. Light mode supported on data routes only. Combat routes (`/arena`, `/submit`, `/`) force dark.
- Mixed-radius philosophy: combat surfaces sharp (radius 0), data surfaces soft (8/12/16px).
- Bebas Neue for display, Inter for body, JetBrains Mono for data.
- Five combat colors: hazard yellow (CTA), combat red (KO/loss), tech cyan (live), champion gold (#1 only), victory green (wins).
- Eight bot corner colors hashed from bot ID.
- Glows replace shadows on dark surfaces; reserved for active/featured state.

## Routing & theming policy

Routes by category:

- Home (`/`): forced dark, broadcast feed.
- Arena routes (`/arena`, `/arena/:battleId`): forced dark, scan-lines applied.
- Submit (`/submit`): forced dark.
- Data routes (`/leaderboard`, `/leaderboard/inputs/:id`, `/bots/:id`, `/bots/:a/vs/:b`, `/tournaments`, `/tournaments/:id`, `/halloffame`, `/achievements`, `/stats`, `/events`, `/me/fighters`): theme-respecting.
- Dev-only (`/dev/design-system`): theme-respecting.
- Auth gate: none on read-only routes; submit and my-fighters require an authenticated user (auto-provisioned guest counts).

## State management strategy

Server state via TanStack Query. Client state via Zustand. Component state via useState. Choose by lifecycle: server state has invalidation rules → Query; client state crosses components → Zustand; component state stays in component → useState.

Real-time data (active battles, tournaments, global event feed) bypasses Query — uses SSE hooks that maintain their own derived state. The hook returns both the raw event log and the derived view (round counts, current scores, etc.). Components consume the derived view; debugging tools consume the event log.

## API consumption pattern

All requests go through `src/api/client.ts`. The client:

1. Loads the API key from localStorage on first import.
2. Auto-provisions a guest user if no key found (POST /v1/users with a generated friendly name, stores returned key).
3. Sets `Authorization: Bearer <key>` on every request.
4. Wraps fetch with AbortController (15s timeout, 60s for SSE).
5. Normalizes errors: 4xx → typed validation errors with field paths, 5xx → toast notification + retry option.
6. Returns typed responses via openapi-typescript-generated types.

TanStack Query hooks live in `src/api/queries.ts`, organized by resource (leaderboard, bots, battles, etc.). Each hook is a thin wrapper around `useQuery` with stable query keys and proper cache invalidation rules.

SSE hooks live in `src/api/sse.ts`. Pattern:

```ts
function useBattleEvents(battleId: string) {
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/v1/battles/${battleId}/events`);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const event = battleEventSchema.parse(JSON.parse(e.data));
        setEvents((prev) => [...prev, event]);
      } catch (err) {
        // log, ignore malformed event
      }
    };
    es.onerror = (err) => {
      setError(new Error('SSE connection failed'));
      setConnected(false);
    };
    return () => es.close();
  }, [battleId]);

  const derived = useMemo(() => deriveBattleState(events), [events]);
  return { events, derived, connected, error };
}
```

## Tale of the Tape component spec

The foundational component. Exposed API:

```tsx
<TaleOfTheTape
  fighterA={bot}
  fighterB={bot | null}            // null = single-fighter mode (profile hero)
  mode="pre-fight" | "active" | "post-fight" | "static"
  emphasizeBot?={botId}             // currently-attacking emphasis during battle
  showVS?={boolean}                 // default true in two-fighter mode
  onFighterClick?={(botId) => void} // navigation; disabled during active battles
/>
```

Internal structure: two `<FighterCard>` components separated by `<VSBadge>`. `<FighterCard>` is a self-contained presentational component that handles all variants (rookie, champion, retired) internally based on the bot prop. Layout responds to container width via CSS container queries — when narrower than 800px, switches to vertical stack with horizontal VS strip.

Key visual elements per `<FighterCard>`:

1. Hazard stripe header (16px tall, full width).
2. Portrait area (1:1 aspect, 4px corner-color border, fallback to procedural silhouette if no portrait_url).
3. Champion belt overlay (only when bot.rank === 1).
4. Nickname display (Bebas Neue 48px, line-height 1.1, tracking 0.02em).
5. Real display_name + algorithm classification (Inter 14px, text-secondary).
6. Chip row: weight class chip + record chip (W-L-D in mono).
7. Stat grid: signature move (best input + time), Achilles heel (worst input + time), KO%, recent form (last 5 fights as W/L symbols).
8. Achievements row: icon strip of unlocked achievements (max 6 displayed, "+N more" if exceeded).

States: rookie (replaces W-L-D with "ROOKIE" chip; recent form hidden), retired (full card greyscaled, RETIRED chip overlay), champion (belt overlay + glow-cycle animation on the corner-color border).

## Component catalog (key reusable components)

Will be cataloged in `references/component-catalog.md` after Phase 1, but for planning:

Design system primitives (Phase 1):

- `<HazardStripes orientation="horizontal|vertical" thickness="thin|thick" />`
- `<LEDDisplay value={string|number} format="time|score|count" glow="hazard|tech|champion" />`
- `<RecordChip wins={n} losses={n} draws={n} />`
- `<WeightClassChip language={string} />`
- `<CornerColorBadge botId={string} />`
- `<ChampionBelt active?={boolean} />`

Fighter components (Phase 2):

- `<FighterCard />` (and the wrapping `<TaleOfTheTape />`)
- `<VSBadge />`
- `<AchievementIconStrip />`
- `<PerformanceHeatmap data={runs} />`
- `<RankHistoryChart snapshots={[]} />`

Arena components (Phase 4):

- `<PreFightStaredown />`
- `<LiveBattle />`
- `<DigimonAttackVisualization />`
- `<HealthBar value={n} maxValue={n} cornerColor={color} />`
- `<RoundCounter current={n} total={n} />`
- `<StatSlamIn data={...} onComplete={() => void} />`
- `<CommentaryFeed events={[]} />`
- `<KOGraphic winner={bot} loser={bot} />`
- `<DecisionGraphic scorecard={...} />`

## Audio integration

Howler.js, lazy-loaded only when audio is toggled on (saves ~30KB on initial bundle). Audio assets:

- One walkout cue per language (4 short clips, 2-3 seconds each, royalty-free).
- One ambient crowd loop (used on arena page when audio enabled).
- One "ding" for round start, one "thud" for round loss, one "fanfare" for KO.

All assets <100KB total when MP3 + 64kbps. Hosted as static files in `public/audio/`. `useAudioStore.enabled` gates playback; if false, all audio calls are no-ops.

## Performance budget

- Initial bundle (route-split, lazy-loaded): ~150KB gzip for the layout shell + home page.
- Per-page additional bundle: 50-150KB depending on complexity (arena is heaviest at ~250KB additional).
- LCP target: <2s on a fast 3G connection for data routes; <3.5s for arena.
- Code splitting per route via `React.lazy()` + `<Suspense>`.
- Image optimization: backend serves portraits at multiple resolutions; frontend selects based on container size.
- Font subsetting: Bebas Neue subset to A-Z 0-9 + basic punctuation (it's a display font, only used for short headlines).

## Future amendments (out of this kickoff's scope)

The backend kickoff has a planned Phase 7 amendment for:

- Bot nickname column + auto-generation
- Portrait URL field + Leonardo.ai integration endpoint
- Trash-talk endpoint + caching
- Denormalized W/L/D fields on bots
- Achievements tables and assignment logic
- Featured/recent-form aggregation endpoints

Until that amendment is built, the frontend phases here assume the API supports all these. For Phase 1-3 of the frontend (foundation, profile, leaderboard), the missing endpoints can be mocked (frontend has a `MSW`-based mock layer for the un-shipped endpoints). For Phase 4 (arena) onward, the backend Phase 7 must be complete first OR the trash-talk and achievement features ship in degraded form (generic taunts, no achievements gallery).
