# API Reconciliation — `sort-bot-arena` ↔ `sort-bot-api`

**Branch:** `api-reconciliation` (frontend) + a parallel branch on backend if needed.

## Why this exists

The frontend was built against MSW mocks I authored from the kickoff prompt's narrative (BattleBots × UFC vibe). Those mocks invented a *richer* bot/battle shape than `sort-bot-api` actually exposes. We've now finished the demo end-to-end against fictional data — this plan reconciles that fiction with reality so the deployed app talks to the real backend.

The user's directive: "build our own backend to fill in any blind spots." I'll call that layer the **BFF** (backend-for-frontend) — Vercel functions in the same repo, no new infrastructure.

---

## The diff

### Endpoints that line up cleanly (no work)

| Frontend wants | Backend has | Notes |
|---|---|---|
| `POST /v1/users` → `{ id, display_name, api_key }` | `POST /v1/users` → `{ user_id, display_name, api_key }` | Field rename: `id` ↔ `user_id`. Trivial. |
| `GET /v1/users/me` | `GET /v1/users/me` | ✅ |
| `GET /v1/leaderboard` | `GET /v1/leaderboard` | Shape differs; see below. |
| `GET /v1/leaderboard/inputs/{id}` | `GET /v1/leaderboard/inputs/{input_id}` | Backend uses **integer** input id; frontend uses string. Convertible. |
| `GET /v1/bots/{id}` | `GET /v1/bots/{id}` | Bot schema differs significantly; see below. |
| `PATCH /v1/bots/{id}` | `PATCH /v1/bots/{id}` | Backend only allows `display_name` mutation. No `retired` flag. |
| `POST /v1/bots` | `POST /v1/bots` | Backend wants multipart with `python|node|binary`; frontend currently sends JSON with `python|node|go|binary`. Need to: (a) drop `go`, (b) restore multipart upload (already coded once; was reverted in P5 to work around jsdom). |
| `GET /v1/tournaments` | `GET /v1/tournaments` | Backend response shape unknown; needs spot-check. |
| `GET /v1/tournaments/{id}` | `GET /v1/tournaments/{id}` | Same. |
| `GET /v1/battles` | (not in spec — only `POST`) | **Gap.** Backend has no list-battles endpoint. |
| `GET /v1/battles/{id}` | `GET /v1/battles/{id}` | Backend battle is `{ a_wins, b_wins, ties, status }`; frontend expects `{ rounds_total, fighter_a, fighter_b, status (live/pre_fight) }`. |
| `GET /v1/battles/{id}/events` (SSE) | `GET /v1/battles/{id}/events` (SSE) | Event vocabularies don't match. Backend: `battle_start, run_start, run_complete, battle_complete`. Frontend: `walkout, fight_start, round_start, round_progress, round_end, fighter_downed, commentary, fight_end`. |
| `GET /v1/bots/{id}/badge.svg` | `GET /v1/bots/{id}/badge.svg` | ✅ |

### Endpoints frontend uses that don't exist on backend

| Frontend route | Reality | Strategy |
|---|---|---|
| `GET /v1/bots/{id}/snapshots` | Backend: `/v1/bots/{id}/rank-history` | Path rename. Pure proxy. |
| `GET /v1/bots/{id}/inputs` (per-input perf) | Backend: `/v1/bots/{id}/profile` (composed) + `/v1/bots/{id}/runs` (per-run) | BFF aggregates `/runs` by input or pulls from `/profile`. |
| `GET /v1/bots/{id}/analysis` | Exists on backend but response schema TBD | Spot-check the actual response; adapt frontend. |
| `GET /v1/users/me/bots` | No such endpoint | Backend exposes `/v1/users/me`; BFF queries bots filtered by `user_id`. Or backend adds this endpoint (1-line addition). |
| `GET /v1/feed/snapshot` | Pure invention | BFF synthesizes from `/v1/leaderboard`, `/v1/stats`, `/v1/events/stream`. |
| `GET /v1/feed` | Pure invention | BFF reads global event stream and recent leaderboard changes. |
| `GET /v1/halloffame` | No such concept | BFF computes from `bots WHERE deleted_at IS NOT NULL` (or `status = 'failed'` post-evaluation). |
| `GET /v1/achievements` | No such system | BFF returns a hardcoded achievement catalog with derived "% of bots that have unlocked this" computed from real run / battle data. **Or** drop achievements UI entirely (reduce frontend scope). |
| `GET /v1/bots/{id}/debut/events` (SSE) | No such endpoint | Backend has `/v1/events/stream`; BFF filters for `bot_id` events. **Or** the frontend's mock-driven debut sequence stays as-is, no backend coupling. |
| `GET /v1/tournaments/{id}/events` (SSE) | No such endpoint | Backend has global stream; BFF filters by tournament_id. **Or** poll `/v1/tournaments/{id}` periodically. |

### Bot record — the big one

**Backend `Bot`:**
```
id, user_id, display_name, language (python|node|binary),
status (pending|evaluating|evaluated|failed),
submitted_at, evaluation_completed_at
```

**Frontend `Bot`:**
```
id, display_name, nickname, language, algorithm, portrait_url, rank,
record { wins, losses, draws }, ko_percentage,
signature_input, achilles_heel, recent_form, achievements,
trash_talk, analysis_url, retired
```

Strategy per field:

| Frontend field | Source of truth | How |
|---|---|---|
| `id`, `display_name`, `language` | Backend | passthrough |
| `nickname` | **derived** | Deterministic hash on `bot.id` → entry in a curated nickname pool (e.g. "The Pivot", "Silver Bullet"). LLM-generated optional. |
| `algorithm` | Backend `bot_analyses.algorithm` | passthrough when present, null when not |
| `portrait_url` | **Backend addition needed** | Phase 7 of `sort-bot-api` (already drafted). Adds `bots.portrait_url` + Leonardo client. |
| `rank` | Backend `leaderboard_snapshots` (latest) | BFF queries leaderboard, picks bot's row |
| `record { wins, losses, draws }` | **derived** | BFF aggregates `battles WHERE bot_a_id = X OR bot_b_id = X`, counts wins by `winner_bot_id`. |
| `ko_percentage` | **derived** | Of this bot's wins, what % were "blowouts" (≥80% rounds)? Compute from `battle_runs`. |
| `signature_input` | **derived** | Best median-time input from `runs WHERE bot_id = X`. Pull from backend's `/profile`. |
| `achilles_heel` | **derived** | Worst median-time input. Same source. |
| `recent_form` | **derived** | Last 5 battles' outcomes. From `battles` ordered by `created_at DESC LIMIT 5`. |
| `achievements` | **synthesized** | BFF returns achievements based on real stats: "First Blood" if wins ≥ 1, "KO King" if KOs ≥ 10, etc. No DB needed. |
| `trash_talk` | **synthesized** | Either canned by language hash (cheap) or LLM call cached per bot (rich). Backend's Anthropic client is already wired — could expose a `/v1/bots/{id}/trash-talk` endpoint there. |
| `analysis_url` | derived | URL to `/v1/bots/{id}/analysis` if available |
| `retired` | derived | `bots.deleted_at IS NOT NULL` |

### Battle event vocabulary

**Backend events:** `battle_start`, `run_start`, `run_complete`, `battle_complete`.

**Frontend events:** `walkout`, `fight_start`, `round_start`, `round_progress`, `round_end`, `fighter_downed`, `commentary`, `fight_end`.

**Mapping:**

| Backend event | Frontend translation |
|---|---|
| `battle_start` | Emit `walkout(bot_a)`, `walkout(bot_b)`, `fight_start` (3 events) |
| `run_start` | `round_start { input_name from run.input_id, round = nth run }` |
| `run_complete` | `round_end { winner_bot_id, a_time_seconds, b_time_seconds, delta_seconds }`. If a side timed out → also emit `fighter_downed`. |
| `battle_complete` | `fight_end { outcome derived from a_wins/b_wins ratio: ko if ≥80% wins, decision otherwise }` |

The translation layer is a stateless transformer in the BFF's SSE proxy.

### Languages

Backend: `python | node | binary`. Frontend: `python | node | go | binary`.

**Decision**: drop `go` from the frontend. Three places to update:
- `src/lib/weightClass.ts` — remove `go` mapping, keep as fallback to `UNRANKED`
- `src/components/submit/templates.ts` — remove the `go` template (or keep but disabled)
- Bot fixtures that use `go` (championBot, etc.) — switch to `node` or `binary`

---

## Architecture decisions (locked)

1. **BFF lives in the frontend repo** at `api/` (Vercel Functions). Same deployment, no new auth path, no new CI.
2. **Backend gets minimum changes**: `bots.nickname`, `bots.portrait_url`, `bots.trash_talk` columns + Phase 7 Leonardo wiring + a `POST /v1/bots/{id}/trash-talk` endpoint that LLM-generates and caches. Anything that can be derived stays derived. *Why these three columns:* they're identity (the *fighter*), not aggregate stats — so they can't be synthesized.
3. **Synthesized fields have stable seeds.** Nickname / trash-talk / achievement assignments are deterministic on `bot.id`, so the same bot always shows the same fiction.
4. **Backend stays the source of truth for everything verifiable.** Records, leaderboard, runs, battles, tournaments all proxy through.
5. **The BFF caches.** In-memory LRU per Vercel function (cold start = empty cache). For production we'd add Redis or a CDN; for the take-home, in-process is fine.
6. **The MSW handlers stay** for tests. They become the contract for what the BFF *returns* (synthesized shape). Tests don't change.
7. **`.env.production` flips** to point at the deployed backend instead of `http://api.test`. `VITE_USE_MOCKS=true` stays as a fallback for dev / CI / when the backend is down. The BFF base URL is the same origin (`/api/v1/...` vs `https://backend/v1/...`).

---

## Implementation slices

### Slice 1 — sanity check the live backend

**Goal**: confirm what `sort-bot-api` actually returns vs what the OpenAPI spec says.

```sh
cd /Users/justinpinero/Desktop/TakeHomeProjects/Layer/sort-bot-api
docker-compose up -d
# create a user
curl -s -X POST http://localhost:8080/v1/users -H 'Content-Type: application/json' \
    -d '{"display_name":"recon","email":null}' | tee /tmp/me.json
# submit a python bot via testdata
KEY=$(jq -r .api_key /tmp/me.json)
curl -s -X POST http://localhost:8080/v1/bots \
    -H "Authorization: Bearer $KEY" \
    -F "display_name=Recon Bot" -F "language=python" \
    -F "source=@./testdata/bots/python/correct.py" | jq .
# wait, then dump every endpoint of interest
sleep 30
for path in /v1/leaderboard /v1/bots /v1/stats /v1/inputs ; do
    echo "=== $path ==="
    curl -s "http://localhost:8080$path" | jq . | head -30
done
```

Capture each response's actual shape into `requests/api-reconciliation-shapes.md`. This is the ground truth we adapt against.

### Slice 2 — backend additions to `sort-bot-api`

Three columns + Leonardo + trash-talk. The Phase 7 plan I wrote already covers the migration + Leonardo wiring; extend it:

- Migration `0002_bot_persona.sql`:
  ```sql
  ALTER TABLE bots ADD COLUMN nickname TEXT;
  ALTER TABLE bots ADD COLUMN portrait_url TEXT;
  ALTER TABLE bots ADD COLUMN portrait_generated_at INTEGER;
  ALTER TABLE bots ADD COLUMN trash_talk TEXT;
  ALTER TABLE bots ADD COLUMN trash_talk_generated_at INTEGER;
  ```
- `internal/leonardo/` (per Phase 7 plan).
- `internal/persona/nickname.go`: deterministic nickname from `(bot.id, language)` over a 100-name pool.
- `internal/persona/trashtalk.go`: lazy LLM call cached on `bots.trash_talk`. Endpoint: `POST /v1/bots/{id}/trash-talk` (idempotent — returns cached if present, generates + stores otherwise).
- Worker hook: on bot evaluation completion, compute nickname (immediate), spawn portrait generation goroutine.
- Update `Bot` schema in OpenAPI to include the three new fields.

### Slice 3 — BFF scaffolding in the frontend repo

```
sort-bot-arena/
├── api/
│   ├── _lib/
│   │   ├── backend.ts           # backend client (auth, retry, error mapping)
│   │   ├── synthesize.ts        # pure functions: record from battles, recent_form, etc.
│   │   ├── achievements.ts      # achievement catalog + derivation rules
│   │   ├── nickname.ts          # fallback nickname when backend doesn't yet have one
│   │   └── trashtalk.ts         # canned taunts by language hash
│   ├── v1/
│   │   ├── bots/[id].ts         # GET / PATCH augmented bot
│   │   ├── bots/[id]/snapshots.ts → maps to /rank-history
│   │   ├── bots/[id]/inputs.ts  → aggregates /runs
│   │   ├── leaderboard.ts       # augments rows with synthesized fields
│   │   ├── leaderboard/inputs/[id].ts
│   │   ├── feed/snapshot.ts     # NEW: synthesizes home page payload
│   │   ├── feed.ts              # NEW: synthesizes ticker
│   │   ├── halloffame.ts        # NEW: filters bots WHERE deleted_at NOT NULL
│   │   ├── achievements.ts      # NEW: returns the curated catalog
│   │   ├── tournaments.ts
│   │   ├── tournaments/[id].ts
│   │   ├── tournaments/[id]/events.ts  # SSE proxy with event translation (Phase 7-stretch)
│   │   ├── battles.ts           # NEW: list battles (since backend lacks GET /v1/battles)
│   │   ├── battles/[id].ts      # augments with frontend "battle" shape
│   │   └── battles/[id]/events.ts  # SSE proxy + event translation
│   └── healthz.ts                # BFF liveness
├── vercel.json                   # add functions config
```

`vercel.json` updates:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },  
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": { "runtime": "nodejs20.x", "memory": 512 }
  }
}
```

`VITE_API_BASE_URL` becomes `https://sort-bot-arena.vercel.app/api` (i.e., self) and the BFF proxies to `BACKEND_URL` (a server-only env var).

### Slice 4 — synthesize helpers (RED-first)

Pure TS functions in `api/_lib/synthesize.ts` that transform real backend shapes into frontend shapes. Each gets a unit test (`api/_lib/synthesize.test.ts`) using captured real-shape fixtures.

- `synthesizeBot(real, runs, profile, battles): FrontendBot`
- `synthesizeLeaderboardRow(realRow, deriveData): FrontendLeaderboardEntry`
- `deriveRecord(battles, botId): { wins, losses, draws }`
- `deriveRecentForm(battles, botId): ('W'|'L'|'D')[]`
- `deriveSignatureInput(profile): BotInputResult | null`
- `deriveAchillesHeel(profile): BotInputResult | null`
- `deriveKoPercentage(battles, botId): number`
- `synthesizeAchievements(real, runs, battles): Achievement[]`

### Slice 5 — `/api/v1/bots/{id}` BFF handler

Wires the synthesize helpers into a Vercel function. Calls real backend in parallel for `bot`, `profile`, `runs?limit=5`, `battles?bot=<id>` (this last one needs backend support — see Slice 2 — or list via BFF aggregation). Returns the augmented shape.

### Slice 6 — `/api/v1/leaderboard` BFF handler

Calls real backend, augments each row.

### Slice 7 — synthesized invented endpoints

`/api/v1/feed/snapshot`, `/api/v1/halloffame`, `/api/v1/achievements`. Each composes from real data + the catalog.

### Slice 8 — battle SSE event translator

`api/v1/battles/[id]/events.ts` — proxies the backend SSE stream and translates each backend event into 1-N frontend events. Stateless per connection. Test against canned event sequences.

### Slice 9 — frontend `.env.production` flip + final integration smoke

Switch `VITE_API_BASE_URL` to `/api`, set `BACKEND_URL` in Vercel as an env var, deploy. Hit every page on the live site, verify the data flows from real backend → BFF → frontend.

### Slice 10 — keep MSW for tests + dev-without-backend

`VITE_USE_MOCKS=true` stays available. The MSW handlers' shapes were already set up to match the *frontend* shape (the augmented one), so they keep working as the BFF's contract for tests.

### Slice 11 — close-out

PR for the frontend (BFF + .env flip), separate PR for backend (3-column migration + Leonardo + persona). Update `references/architecture.md` on both sides.

---

## Tests

### Frontend / BFF
- **Unit (synthesize helpers)**: every derive function has table-driven tests against captured real backend fixtures.
- **BFF handlers**: integration tests that mount the handler, mock `BACKEND_URL` via MSW (yes, MSW in the BFF too), assert response shape matches frontend's existing expectations.
- **Existing component tests**: should pass unchanged because the frontend shape doesn't change.
- **One smoke test per route via Playwright** (D-1 from `debt.md` finally pays off): hit /, /leaderboard, /bots/<seed>, /arena/<seed> against the deployed BFF + backend, screenshot.

### Backend
- **Migration tests**: nickname / portrait / trash-talk fields read back correctly.
- **Persona unit tests**: nickname is deterministic, trash-talk caches correctly, Leonardo client polls correctly.
- **Endpoint tests**: `POST /v1/bots/{id}/trash-talk` returns same string on second call.

---

## Risks

- **Real backend stability**. If `sort-bot-api` is flaky during reconciliation, BFF tests will be flaky too. Mitigation: BFF is testable in isolation via MSW-against-itself.
- **Augmented response latency**. The `/api/v1/bots/{id}` handler fans out to 4 backend endpoints. Cold-start could be 500ms+. Mitigation: parallel `Promise.all`, per-edge in-memory cache for hot bots, precompute the augmentation in a worker (Phase 8).
- **SSE proxy buffering**. Vercel's response buffering on functions defaults to off for streaming, but specific edge cases bite. Mitigation: test the SSE translator under real load before relying on it.
- **Tournament event mismatch**. Backend doesn't have a tournament event stream at all. Cleanest path: BFF polls the backend every 2s and emits derived events. Slightly worse UX but simple.

## Open questions

1. **Does the backend already have a deployment?** If yes, we point `BACKEND_URL` at it. If not, we deploy `sort-bot-api` to Railway/Fly first. Need to confirm.
2. **Achievements scope**. Five canned achievements covering the common milestones (first win, first KO, top-10, perfect debut, giant killer) is enough. Confirm before I synthesize.
3. **Custom domain on Vercel?** `sort-bot-arena.vercel.app` is fine for take-home. Custom domain would be a nice-to-have but not required.

---

## Deliverables

1. This plan committed (you're reading it).
2. After approval:
   - 1 PR on `sort-bot-arena` adding the BFF (`api/`), updating `.env.production`, updating MSW where it diverges from BFF.
   - 1 PR on `sort-bot-api` adding the 3 columns + Leonardo + persona endpoint.
3. Both deployed. Frontend's live demo flips from "MSW-mocked everything" to "real backend, BFF-augmented." Visual experience identical.

## What I need from you to start

- ✅ Leonardo API key — already in 1Password, fetched.
- ❓ Confirm: green-light the BFF approach (Vercel Functions in `sort-bot-arena/api/`) over alternatives (extend backend more aggressively, or a separate microservice)?
- ❓ Confirm: drop `go` from the frontend's language enum?
- ❓ Confirm: backend deployment target. Is there an existing `sort-bot-api` deploy somewhere, or do we need to ship it to Railway/Fly first?
- ❓ Confirm: achievement scope (5 canned ones, derived from real stats)?

Once you answer those four, I run Slice 1 (sanity check the live backend) and report back with the captured shapes before any code changes.
