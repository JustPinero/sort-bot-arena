// Stubbed sort-bot-api for the Playwright `real-server` project.
//
// Why a stub instead of the real upstream:
//  - Determinism. The real evaluator runs bots in subprocesses; we'd
//    inherit subprocess timing flake.
//  - Speed. Real evaluations cover 57 inputs in seconds; the stub
//    returns instantly.
//  - Isolation. CI doesn't depend on the deployed Railway service.
//
// G1 keeps this file MINIMAL — just enough endpoints to satisfy the
// smoke spec (homepage hits `GET /v1/leaderboard?limit=3` via the
// arena server's `/api/v1/feed/snapshot`). Slices G2-G6 will extend.
//
// Default port: 8081. Override with `STUB_PORT`.
//
// Run as a standalone process with `tsx`:
//   tsx tests/e2e/real-server/fixtures/sort-bot-api-stub.ts

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env['STUB_PORT'] ?? 8081);

interface StubRoute {
  method: string;
  match: (path: string) => boolean;
  handler: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> | void;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function notFound(res: ServerResponse, path: string): void {
  json(res, 404, { error: 'not_found', path });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.length === 0) return resolve(null);
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
    req.on('error', reject);
  });
}

// Shape matches `ApiBot` in
// server/src/clients/sort-bot-api/types.ts — the upstream contract
// the arena server consumes and re-synthesizes for the frontend.
function fixtureBot(
  id: string,
  displayName: string,
  language: 'python' | 'node' | 'binary' = 'python',
): Record<string, unknown> {
  return {
    id,
    user_id: 'user_stub',
    display_name: displayName,
    language,
    source_size_bytes: 256,
    source_sha256: '0'.repeat(64),
    status: 'evaluated',
    submitted_at: '2026-04-29T00:00:00.000Z',
    evaluation_completed_at: '2026-04-29T00:00:01.000Z',
  };
}

// Minimal but complete BotProfileResponse — synthesizeBot reads
// rank, best_input, worst_input, per_input, rank_history.
function fixtureProfile(id: string, displayName: string): Record<string, unknown> {
  return {
    bot: fixtureBot(id, displayName),
    rank: 1,
    score: 0,
    incomplete: false,
    inputs_covered: 0,
    total_inputs: 0,
    best_input: { input_id: 1, median_ms: 12.5 },
    worst_input: { input_id: 2, median_ms: 50.0 },
    per_input: [],
    rank_history: [],
  };
}

// In-process map so freshly submitted bots are retrievable by id —
// otherwise GET /v1/bots/:id returns a fixture with the wrong
// display_name, which breaks the BotProfilePage assertion.
const submittedBots = new Map<string, { display_name: string; language: string }>();

// Pre-seeded fighters used by the login-battle-fight-end spec (G3) and
// the tournament-escalation spec (G6). The first two satisfy a 2-slot
// BotSlotPicker; the full 8 satisfy a default (bracket_size=8) tournament
// without any further submissions.
const PRESEEDED_BOTS: Array<{
  bot_id: string;
  display_name: string;
  language: 'python' | 'node' | 'binary';
}> = [
  { bot_id: 'bot_e2e_red', display_name: 'Red Mauler', language: 'python' },
  { bot_id: 'bot_e2e_blue', display_name: 'Blue Crusher', language: 'node' },
  { bot_id: 'bot_e2e_3', display_name: 'Cobra Strike', language: 'python' },
  { bot_id: 'bot_e2e_4', display_name: 'Dragonfly', language: 'node' },
  { bot_id: 'bot_e2e_5', display_name: 'Eclipse Hawk', language: 'python' },
  { bot_id: 'bot_e2e_6', display_name: 'Fury Sentinel', language: 'node' },
  { bot_id: 'bot_e2e_7', display_name: 'Gale Reaper', language: 'python' },
  { bot_id: 'bot_e2e_8', display_name: 'Hailstorm', language: 'node' },
];
for (const b of PRESEEDED_BOTS) {
  submittedBots.set(b.bot_id, { display_name: b.display_name, language: b.language });
}

// In-memory state for the most recent /v1/battles POST so the
// follow-up GET /v1/battles/:id (driven by the BattlePage's
// useBattle query) can hand back a coherent BattleResponse without
// us needing to bolt on a real persistence layer.
interface StubBattleState {
  battle_id: string;
  bot_a: string;
  bot_b: string;
  created_at: string;
}
let lastBattle: StubBattleState | null = null;

// In-memory list of uploaded inputs so the arena server's GET
// /v1/inputs (called from `useInputs` to populate the Manual tab in
// the MatchSetupModal) can return whatever the upload form just
// minted. Shape matches `ApiInput` in
// server/src/clients/sort-bot-api/types.ts — the arena server
// normalizes these into `InputSummary` items keyed by stringified id.
interface StubInputState {
  id: number;
  size_class: 'small' | 'medium' | 'large';
  case_index: number;
  array_len: number;
  is_custom: boolean;
  uploader_id: string | null;
  created_at: string;
}
const uploadedInputs: StubInputState[] = [];
let nextInputId = 1_000_000;

const routes: StubRoute[] = [
  // Health probes (the arena server's /api/readyz pings upstream /healthz).
  {
    method: 'GET',
    match: (p) => p === '/healthz',
    handler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    },
  },
  // Leaderboard returns the pre-seeded fighters so the BotSlotPicker
  // (and useEligibleFighters) has at least 2 options. The smoke spec
  // doesn't care about the contents — only that the homepage renders.
  // The shape matches `LeaderboardResponse` in
  // server/src/clients/sort-bot-api/types.ts.
  {
    method: 'GET',
    match: (p) => p === '/v1/leaderboard',
    handler: (_req, res) => {
      json(res, 200, {
        filter: {},
        total_inputs: 0,
        bots: PRESEEDED_BOTS.map((b, i) => ({
          bot_id: b.bot_id,
          display_name: b.display_name,
          language: b.language,
          score: 100 - i,
          inputs_covered: 0,
          total_inputs: 0,
          incomplete: false,
          rank: i + 1,
        })),
      });
    },
  },
  // Per-input leaderboards aren't called by the smoke spec but kept
  // here so unrelated background queries don't 404 noisily.
  {
    method: 'GET',
    match: (p) => /^\/v1\/leaderboard\/inputs\/\d+$/.test(p),
    handler: (_req, res) => {
      json(res, 200, { bots: [], total: 0 });
    },
  },
  {
    method: 'GET',
    match: (p) => p === '/v1/inputs',
    handler: (_req, res) => {
      json(res, 200, { inputs: uploadedInputs, total: uploadedInputs.length });
    },
  },
  {
    method: 'GET',
    match: (p) => p === '/v1/stats',
    handler: (_req, res) => {
      json(res, 200, { total_bots: 0, total_battles: 0, total_runs: 0 });
    },
  },
  // Account creation — used by `signupViaApi` in slices G2+.
  {
    method: 'POST',
    match: (p) => p === '/v1/users',
    handler: async (req, res) => {
      const body = (await readBody(req)) as { display_name?: string; email?: string };
      const id = `user_${Date.now().toString(36)}`;
      json(res, 201, {
        user_id: id,
        display_name: body?.display_name ?? 'Stub User',
        email: body?.email ?? 'stub@example.com',
        api_key: `sk_live_${id}`,
      });
    },
  },
  {
    method: 'GET',
    match: (p) => p === '/v1/users/me',
    handler: (_req, res) => {
      json(res, 200, {
        user_id: 'user_stub',
        display_name: 'Stub User',
        email: 'stub@example.com',
      });
    },
  },
  // Bot submission. The arena server forwards a multipart/form-data
  // body (display_name, language, source). We don't parse it — the
  // wire-format invariants are covered by the contract-drift test.
  // We just drain the body, mint a unique bot id, and remember it so
  // the immediately-following GET /v1/bots/:id returns the same name.
  {
    method: 'POST',
    match: (p) => p === '/v1/bots',
    handler: async (req, res) => {
      const ct = (req.headers['content-type'] ?? '').toString();
      const buffers: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: Buffer) => buffers.push(c));
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      const raw = Buffer.concat(buffers).toString('utf8');
      let displayName = 'Stub Bot';
      let language: 'python' | 'node' | 'binary' = 'python';
      if (ct.startsWith('multipart/form-data')) {
        const dn = raw.match(/name="display_name"\r?\n\r?\n([\s\S]*?)\r?\n--/);
        const lg = raw.match(/name="language"\r?\n\r?\n([\s\S]*?)\r?\n--/);
        if (dn?.[1]) displayName = dn[1];
        if (lg?.[1]) {
          const v = lg[1];
          if (v === 'python' || v === 'node' || v === 'binary') language = v;
        }
      }
      const id = `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      submittedBots.set(id, { display_name: displayName, language });
      json(res, 201, fixtureBot(id, displayName, language));
    },
  },
  // Custom-input upload. The arena server forwards a multipart/form-data
  // body (file = serialized values, optional name) to /v1/inputs. We
  // drain the body without parsing the multipart payload — the wire
  // format is covered by contract-drift tests — and mint a fresh
  // `ApiInput`-shaped record. The new id is appended to the in-memory
  // `uploadedInputs` list so the next GET /v1/inputs returns it (which
  // is what populates the Manual tab in the MatchSetupModal after the
  // FE invalidates the inputs query on upload success).
  {
    method: 'POST',
    match: (p) => p === '/v1/inputs',
    handler: async (req, res) => {
      const buffers: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: Buffer) => buffers.push(c));
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      const id = nextInputId++;
      const minted: StubInputState = {
        id,
        size_class: 'small',
        case_index: uploadedInputs.length,
        array_len: 5,
        is_custom: true,
        uploader_id: 'user_stub',
        created_at: new Date().toISOString(),
      };
      uploadedInputs.push(minted);
      json(res, 201, minted);
    },
  },
  // Per-bot profile, analysis, rank-history. Order matters — these
  // must precede the generic /v1/bots/:id catch-all below.
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+\/profile$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/')[3] ?? 'bot_stub';
      const remembered = submittedBots.get(id);
      json(res, 200, fixtureProfile(id, remembered?.display_name ?? 'Stub Bot'));
    },
  },
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+\/analysis$/.test(p),
    handler: (_req, res) => {
      // The arena server wraps this in formatAnalysis() before sending
      // to the frontend — any structurally-valid analysis works.
      json(res, 200, {
        algorithm: 'quicksort',
        time_complexity_estimate: 'O(n log n)',
        space_complexity_estimate: 'O(log n)',
        strengths: ['simple', 'in-place'],
        weaknesses: ['adversarial inputs'],
        suggested_use_cases: ['general purpose'],
        anti_patterns: ['nearly-sorted data'],
        reasoning: 'A standard quicksort with median-of-three pivot.',
      });
    },
  },
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+\/rank-history$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/')[3] ?? 'bot_stub';
      json(res, 200, { bot_id: id, count: 0, history: [] });
    },
  },
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+\/runs$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/')[3] ?? 'bot_stub';
      json(res, 200, { bot_id: id, runs: [], total: 0 });
    },
  },
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+\/badge\.svg$/.test(p),
    handler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      res.end('<svg xmlns="http://www.w3.org/2000/svg"/>');
    },
  },
  // Catch-all for /v1/bots/:id — must run last among the bot routes
  // so the more-specific paths above win.
  {
    method: 'GET',
    match: (p) => /^\/v1\/bots\/[^/]+$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/').pop() ?? 'bot_stub';
      const remembered = submittedBots.get(id);
      json(
        res,
        200,
        fixtureBot(
          id,
          remembered?.display_name ?? 'Stub Bot',
          (remembered?.language as 'python' | 'node' | 'binary') ?? 'python',
        ),
      );
    },
  },
  // Tournament creation — returns a `CreateTournamentResponse` shape
  // per server/src/clients/sort-bot-api/types.ts. The arena server's
  // POST /api/v1/tournaments forwards a small participant_bot_ids+count
  // body here and uses the returned `tournament_id` to seed
  // recent_tournaments + tournament_matches and to redirect the FE.
  // Slice G6 added this so the orchestrator can walk a real bracket
  // end-to-end against the stub.
  {
    method: 'POST',
    match: (p) => p === '/v1/tournaments',
    handler: async (_req, res) => {
      const tournament_id = `tour_e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      json(res, 201, {
        tournament_id,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    },
  },
  // Battle creation — returns a `CreateBattleResponse` shape per
  // server/src/clients/sort-bot-api/types.ts. The arena server
  // forwards POST /api/v1/battles into this endpoint, then reassigns
  // its placeholder primary key to the upstream `battle_id`.
  {
    method: 'POST',
    match: (p) => p === '/v1/battles',
    handler: async (req, res) => {
      const body = (await readBody(req)) as {
        bot_a?: string;
        bot_b?: string;
        input_ids?: number[];
        count?: number;
      } | null;
      const battle_id = `bat_e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const created_at = new Date().toISOString();
      lastBattle = {
        battle_id,
        bot_a: body?.bot_a ?? PRESEEDED_BOTS[0]!.bot_id,
        bot_b: body?.bot_b ?? PRESEEDED_BOTS[1]!.bot_id,
        created_at,
      };
      json(res, 201, {
        battle_id,
        bot_a: lastBattle.bot_a,
        bot_b: lastBattle.bot_b,
        input_ids: body?.input_ids ?? [],
        status: 'running',
        created_at,
      });
    },
  },
  // Per-battle SSE feed. The arena server proxies this stream back
  // to the browser via /api/v1/battles/:id/events. We emit the four
  // canonical phases — battle_start, run_start, run_complete,
  // battle_complete — with small write+timeout chains so the
  // BattleViewer sees them arrive in order. Today's BattlePage
  // synthesizes events client-side via playMockBattle and never
  // subscribes here, but the endpoint exists so future SSE-driven
  // viewers (and the arena server's polling fallback) have something
  // to talk to instead of 404'ing.
  {
    method: 'GET',
    match: (p) => /^\/v1\/battles\/[^/]+\/events$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/')[3] ?? 'bat_stub';
      const a = lastBattle?.bot_a ?? PRESEEDED_BOTS[0]!.bot_id;
      const b = lastBattle?.bot_b ?? PRESEEDED_BOTS[1]!.bot_id;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const send = (event: string, data: unknown) => {
        if (res.writableEnded) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      send('battle_start', { battle_id: id, bot_a: a, bot_b: b });
      const t1 = setTimeout(() => {
        send('run_start', { battle_id: id, run_id: 1, input_id: 1 });
      }, 80);
      const t2 = setTimeout(() => {
        send('run_complete', {
          battle_id: id,
          run_id: 1,
          input_id: 1,
          winner_bot_id: a,
          bot_a_duration_ms: 12,
          bot_b_duration_ms: 28,
        });
      }, 200);
      const t3 = setTimeout(() => {
        send('battle_complete', {
          battle_id: id,
          winner_bot_id: a,
          bot_a_wins: 1,
          bot_b_wins: 0,
        });
      }, 320);
      const t4 = setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 400);
      // Stop emitting if the client hangs up early.
      const cleanup = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
      res.on('close', cleanup);
    },
  },
  // Per-battle materialized state. Drives the BattlePage's useBattle
  // query (and the arena server's polling fallback when SSE drops).
  // We hand back a coherent BattleResponse keyed off the most recent
  // POST so the FE sees its own newly-created battle.
  {
    method: 'GET',
    match: (p) => /^\/v1\/battles\/[^/]+$/.test(p),
    handler: (_req, res, url) => {
      const id = url.pathname.split('/').pop() ?? 'bat_stub';
      const a = lastBattle?.bot_a ?? PRESEEDED_BOTS[0]!.bot_id;
      const b = lastBattle?.bot_b ?? PRESEEDED_BOTS[1]!.bot_id;
      const created_at = lastBattle?.created_at ?? new Date().toISOString();
      json(res, 200, {
        battle: {
          id,
          bot_a_id: a,
          bot_b_id: b,
          initiator_id: 'user_stub',
          status: 'running',
          winner_bot_id: null,
          bot_a_wins: 0,
          bot_b_wins: 0,
          ties: 0,
          created_at,
          completed_at: null,
        },
        runs: [],
      });
    },
  },
];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const method = (req.method ?? 'GET').toUpperCase();
  const route = routes.find((r) => r.method === method && r.match(url.pathname));
  if (!route) return notFound(res, url.pathname);
  Promise.resolve(route.handler(req, res, url)).catch((err) => {
    json(res, 500, { error: 'stub_handler_failed', message: (err as Error).message });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[sort-bot-api-stub] listening on http://127.0.0.1:${PORT}`);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
