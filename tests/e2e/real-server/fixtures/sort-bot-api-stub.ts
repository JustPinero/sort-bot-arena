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

function fixtureBot(id: string, displayName: string): Record<string, unknown> {
  return {
    bot_id: id,
    user_id: 'user_stub',
    display_name: displayName,
    language: 'python',
    submitted_at: '2026-04-29T00:00:00.000Z',
    rank: 1,
    score: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    eligible: true,
    retired: false,
  };
}

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
  // Empty leaderboard for the smoke spec — homepage shows the empty
  // champion-corner state.
  {
    method: 'GET',
    match: (p) => p === '/v1/leaderboard',
    handler: (_req, res) => {
      json(res, 200, { bots: [], total: 0 });
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
      json(res, 200, { inputs: [], total: 0 });
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
  // Catch-alls so missing endpoints in later slices fail loudly with
  // a 501 instead of a confusing CORS error from a 404 HTML response.
  {
    method: 'GET',
    match: (p) => p.startsWith('/v1/bots/'),
    handler: (_req, res, url) => {
      json(res, 200, fixtureBot(url.pathname.split('/').pop() ?? 'bot_stub', 'Stub Bot'));
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
