import { defineConfig, devices } from '@playwright/test';

// Phase 10 / slice G1 — two Playwright projects:
//
//  1. `mocked` — the legacy posture (Vite + MSW intercepts). Keeps the
//     outage-stale-cache spec, which relies on intentionally killing the
//     network mid-test (hard to reproduce against the real server).
//
//  2. `real-server` — boots the Hono server (in-memory libsql) +
//     stubbed sort-bot-api + Vite (VITE_USE_MOCKS=false). New flows
//     (signup → submit, login → battle, etc.) live here.
//
// `webServer` accepts an array; Playwright boots all entries before
// any test runs and tears them down at the end. Each project picks up
// the relevant URL via `use.baseURL`.

const REAL_SERVER_PORT = 3055;
const STUB_PORT = 8081;
const VITE_REAL_PORT = 5174;
const VITE_MOCKED_PORT = 5173;

const SESSION_SECRET = 'test_secret_at_least_32_chars_for_jose_xx';

export default defineConfig({
  fullyParallel: false,
  // Real-server specs share a single in-memory libsql + Hono process,
  // so clean() in one spec's beforeEach can wipe the DB out from
  // under a sibling spec running in a parallel worker. Cap at 1
  // worker to serialize the whole run. (The mocked project has a
  // single spec; this costs us nothing there.)
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mocked',
      testDir: './tests/e2e/mocked',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${VITE_MOCKED_PORT}`,
      },
    },
    {
      name: 'real-server',
      testDir: './tests/e2e/real-server',
      testIgnore: ['**/fixtures/**'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${VITE_REAL_PORT}`,
      },
    },
  ],
  webServer: [
    // mocked-project Vite (legacy MSW-in-browser stack).
    {
      command: 'pnpm dev',
      port: VITE_MOCKED_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_BASE_URL: 'http://localhost:8080',
        VITE_ENABLE_VISUAL_REGRESSION: 'true',
        VITE_USE_MOCKS: 'true',
      },
    },
    // sort-bot-api stub — the arena server fans out to this. We invoke
    // it via the server workspace's `tsx` (the only place it lives).
    {
      command:
        'pnpm --filter @sort-bot-arena/server exec tsx ../tests/e2e/real-server/fixtures/sort-bot-api-stub.ts',
      port: STUB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { STUB_PORT: String(STUB_PORT) },
    },
    // Real Hono arena server, in-memory libsql, test-reset gate enabled.
    {
      command: 'pnpm --filter @sort-bot-arena/server dev',
      port: REAL_SERVER_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(REAL_SERVER_PORT),
        SORT_BOT_API_URL: `http://127.0.0.1:${STUB_PORT}`,
        DATABASE_URL: ':memory:',
        SESSION_SECRET,
        ALLOWED_ORIGINS: `http://localhost:${VITE_REAL_PORT}`,
        ENABLE_TEST_RESET: 'true',
        RUN_LISTENER: 'false',
        NODE_ENV: 'test',
      },
    },
    // real-server-project Vite — points at the real arena server.
    {
      command: `pnpm dev:real --port ${VITE_REAL_PORT}`,
      port: VITE_REAL_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_BASE_URL: `http://localhost:${REAL_SERVER_PORT}`,
        VITE_USE_MOCKS: 'false',
      },
    },
  ],
});
