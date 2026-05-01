// Slice 7 — GET /api/v1/battles + GET /api/v1/tournaments listing.
//
// These are cursor-paginated history pages backed by the recent_battles
// and recent_tournaments tables (slice 1 migrations 0007 + 0008). The
// list endpoint returns trimmed Tournament rows (participants: [],
// matches: []) to avoid 100x getBot fan-out — see the comment in
// routes/tournaments.ts for the full reasoning. The detail endpoint
// /api/v1/tournaments/:id still hydrates fully.

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

import type { Client } from '@libsql/client';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function botFixture(id: string, displayName = id, language = 'python') {
  return {
    id,
    user_id: 'u1',
    display_name: displayName,
    language,
    source_size_bytes: 100,
    source_sha256: 'sha_' + id,
    status: 'evaluated',
    submitted_at: 'T0',
    evaluation_completed_at: 'T1',
  };
}

function stubBots(ids: string[]) {
  for (const id of ids) {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/${id}`, () => HttpResponse.json(botFixture(id))),
    );
  }
}

interface SeedBattleArgs {
  battle_id: string;
  bot_a_id: string;
  bot_b_id: string;
  pair_key?: string;
  initiator_user_id?: string | null;
  weight_class?: string | null;
  status?: 'pending' | 'running' | 'complete' | 'failed';
  winner_bot_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

async function seedBattle(db: Client, b: SeedBattleArgs): Promise<void> {
  const a = b.bot_a_id;
  const z = b.bot_b_id;
  const pairKey = b.pair_key ?? (a < z ? `${a}:${z}` : `${z}:${a}`);
  await db.execute({
    sql: `INSERT INTO recent_battles
            (battle_id, bot_a_id, bot_b_id, pair_key, initiator_user_id,
             weight_class, status, winner_bot_id, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      b.battle_id,
      b.bot_a_id,
      b.bot_b_id,
      pairKey,
      b.initiator_user_id ?? null,
      b.weight_class ?? null,
      b.status ?? 'complete',
      b.winner_bot_id ?? null,
      b.created_at,
      b.completed_at ?? null,
    ],
  });
}

interface SeedTournamentArgs {
  tournament_id: string;
  initiator_user_id?: string | null;
  participant_count?: number;
  bracket_size?: number;
  input_mode?: string;
  status?: 'pending' | 'running' | 'complete' | 'failed';
  winner_bot_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

async function seedTournament(db: Client, t: SeedTournamentArgs): Promise<void> {
  await db.execute({
    sql: `INSERT INTO recent_tournaments
            (tournament_id, initiator_user_id, participant_count, bracket_size,
             input_mode, status, winner_bot_id, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      t.tournament_id,
      t.initiator_user_id ?? null,
      t.participant_count ?? 4,
      t.bracket_size ?? 4,
      t.input_mode ?? 'flat_random',
      t.status ?? 'complete',
      t.winner_bot_id ?? null,
      t.created_at,
      t.completed_at ?? null,
    ],
  });
}

// ---------------------------------------------------------------------------
// Battles list
// ---------------------------------------------------------------------------

describe('GET /api/v1/battles (list)', () => {
  it('returns an empty cursor page when there are no rows', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], next_cursor: null });
  });

  it('returns rows ordered by created_at DESC with hydrated fighters and required Battle keys', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    stubBots(['bot_a', 'bot_b', 'bot_c']);

    await seedBattle(t.db, {
      battle_id: 'bat_1',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      created_at: '2026-04-29T00:00:00.000Z',
      status: 'complete',
      winner_bot_id: 'bot_a',
      weight_class: 'sparring',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_2',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_c',
      created_at: '2026-04-29T00:01:00.000Z',
      status: 'running',
      weight_class: 'exhibition',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_3',
      bot_a_id: 'bot_b',
      bot_b_id: 'bot_c',
      created_at: '2026-04-29T00:02:00.000Z',
      status: 'pending',
      weight_class: 'title_fight',
    });

    const res = await t.app.request('/api/v1/battles');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>>; next_cursor: string | null };
    expect(body.items).toHaveLength(3);
    expect(body.next_cursor).toBeNull();
    expect(body.items.map((b) => b['id'])).toEqual(['bat_3', 'bat_2', 'bat_1']);

    // Each item matches the Battle shape from src/api/types.ts:149-162.
    const requiredKeys = [
      'id',
      'status',
      'fighter_a',
      'fighter_b',
      'rounds_total',
      'current_round',
      'scheduled_at',
      'started_at',
      'completed_at',
      'winner_bot_id',
      'outcome',
    ];
    for (const item of body.items) {
      for (const key of requiredKeys) {
        expect(item, `expected key ${key}`).toHaveProperty(key);
      }
      expect(item['weight_class']).toBeDefined();
      const fa = item['fighter_a'] as Record<string, unknown>;
      const fb = item['fighter_b'] as Record<string, unknown>;
      expect(fa['corner']).toBe('red');
      expect(fb['corner']).toBe('blue');
      expect(fa['display_name']).toBeTruthy();
      expect(fb['display_name']).toBeTruthy();
    }

    // Status mapping matches the rich Battle shape.
    const byId = Object.fromEntries(body.items.map((i) => [i['id'], i]));
    expect(byId['bat_1']!['status']).toBe('completed');
    expect(byId['bat_2']!['status']).toBe('live');
    expect(byId['bat_3']!['status']).toBe('pre_fight');
    expect(byId['bat_1']!['winner_bot_id']).toBe('bot_a');
    expect(byId['bat_1']!['weight_class']).toBe('sparring');
    expect(byId['bat_2']!['weight_class']).toBe('exhibition');
    expect(byId['bat_3']!['weight_class']).toBe('title_fight');
  });

  it('paginates via ?limit + ?before=<created_at ISO cursor>', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    stubBots(['bot_a', 'bot_b']);

    // Seed 25 battles, oldest first.
    for (let i = 0; i < 25; i += 1) {
      const ts = new Date(Date.UTC(2026, 3, 1, 0, i, 0)).toISOString();
      await seedBattle(t.db, {
        battle_id: `bat_${String(i).padStart(2, '0')}`,
        bot_a_id: 'bot_a',
        bot_b_id: 'bot_b',
        created_at: ts,
        status: 'complete',
        winner_bot_id: 'bot_a',
      });
    }

    const drained: string[] = [];
    let cursor: string | null = null;
    let safety = 0;
    do {
      safety += 1;
      if (safety > 10) throw new Error('pagination did not terminate');
      const url = cursor
        ? `/api/v1/battles?limit=10&before=${encodeURIComponent(cursor)}`
        : '/api/v1/battles?limit=10';
      const res = await t.app.request(url);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<Record<string, unknown>>; next_cursor: string | null };
      for (const item of body.items) drained.push(item['id'] as string);
      cursor = body.next_cursor;
      if (cursor === null) {
        expect(body.items.length).toBeLessThanOrEqual(10);
      } else {
        expect(body.items).toHaveLength(10);
      }
    } while (cursor !== null);

    expect(drained).toHaveLength(25);
    // Should be DESC order across all pages, no dupes.
    expect(new Set(drained).size).toBe(25);
    for (let i = 1; i < drained.length; i += 1) {
      expect(drained[i]! < drained[i - 1]!).toBe(true);
    }
  });

  it('filters by ?initiator_user_id', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    stubBots(['bot_a', 'bot_b']);

    await seedBattle(t.db, {
      battle_id: 'bat_u1_a',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_user_id: 'u_one',
      created_at: '2026-04-29T00:00:00.000Z',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_u1_b',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_user_id: 'u_one',
      created_at: '2026-04-29T00:01:00.000Z',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_u2_a',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_user_id: 'u_two',
      created_at: '2026-04-29T00:02:00.000Z',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_u2_b',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_user_id: 'u_two',
      created_at: '2026-04-29T00:03:00.000Z',
    });
    await seedBattle(t.db, {
      battle_id: 'bat_anon',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_user_id: null,
      created_at: '2026-04-29T00:04:00.000Z',
    });

    const res = await t.app.request('/api/v1/battles?initiator_user_id=u_one');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items.map((i) => i['id']).sort()).toEqual(['bat_u1_a', 'bat_u1_b']);
  });
});

// ---------------------------------------------------------------------------
// Tournaments list
// ---------------------------------------------------------------------------

describe('GET /api/v1/tournaments (list)', () => {
  it('returns an empty cursor page when there are no rows', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/tournaments');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], next_cursor: null });
  });

  it('returns rows ordered DESC with trimmed Tournament shape (no participants/matches fan-out)', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    await seedTournament(t.db, {
      tournament_id: 'tour_1',
      participant_count: 4,
      bracket_size: 4,
      input_mode: 'flat_random',
      status: 'complete',
      winner_bot_id: 'bot_a',
      created_at: '2026-04-29T00:00:00.000Z',
      completed_at: '2026-04-29T00:30:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_2',
      participant_count: 6,
      bracket_size: 8,
      input_mode: 'escalation',
      status: 'running',
      created_at: '2026-04-29T00:05:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_3',
      participant_count: 8,
      bracket_size: 8,
      input_mode: 'flat_random',
      status: 'pending',
      created_at: '2026-04-29T00:10:00.000Z',
    });

    const res = await t.app.request('/api/v1/tournaments');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>>; next_cursor: string | null };
    expect(body.items).toHaveLength(3);
    expect(body.next_cursor).toBeNull();
    expect(body.items.map((i) => i['id'])).toEqual(['tour_3', 'tour_2', 'tour_1']);

    const requiredKeys = [
      'id',
      'name',
      'status',
      'participant_count',
      'weight_class_filter',
      'prize_description',
      'scheduled_at',
      'rounds_total',
      'current_round',
      'champion_bot_id',
      'matches',
      'participants',
    ];
    for (const item of body.items) {
      for (const key of requiredKeys) {
        expect(item, `expected key ${key}`).toHaveProperty(key);
      }
      // Trim decision: list endpoint omits fan-out fields.
      expect(item['matches']).toEqual([]);
      expect(item['participants']).toEqual([]);
    }

    const byId = Object.fromEntries(body.items.map((i) => [i['id'], i]));
    expect(byId['tour_1']!['status']).toBe('completed');
    expect(byId['tour_2']!['status']).toBe('active');
    expect(byId['tour_3']!['status']).toBe('upcoming');
    expect(byId['tour_1']!['champion_bot_id']).toBe('bot_a');
    expect(byId['tour_1']!['participant_count']).toBe(4);
    expect(byId['tour_1']!['scheduled_at']).toBe('2026-04-29T00:00:00.000Z');
  });

  it('paginates via ?limit + ?before=<created_at ISO cursor>', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    for (let i = 0; i < 25; i += 1) {
      const ts = new Date(Date.UTC(2026, 3, 1, 0, i, 0)).toISOString();
      await seedTournament(t.db, {
        tournament_id: `tour_${String(i).padStart(2, '0')}`,
        created_at: ts,
        status: 'complete',
      });
    }

    const drained: string[] = [];
    let cursor: string | null = null;
    let safety = 0;
    do {
      safety += 1;
      if (safety > 10) throw new Error('pagination did not terminate');
      const url = cursor
        ? `/api/v1/tournaments?limit=10&before=${encodeURIComponent(cursor)}`
        : '/api/v1/tournaments?limit=10';
      const res = await t.app.request(url);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<Record<string, unknown>>; next_cursor: string | null };
      for (const item of body.items) drained.push(item['id'] as string);
      cursor = body.next_cursor;
      if (cursor === null) {
        expect(body.items.length).toBeLessThanOrEqual(10);
      } else {
        expect(body.items).toHaveLength(10);
      }
    } while (cursor !== null);

    expect(drained).toHaveLength(25);
    expect(new Set(drained).size).toBe(25);
    for (let i = 1; i < drained.length; i += 1) {
      expect(drained[i]! < drained[i - 1]!).toBe(true);
    }
  });

  it('filters by ?initiator_user_id', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    await seedTournament(t.db, {
      tournament_id: 'tour_u1_a',
      initiator_user_id: 'u_one',
      created_at: '2026-04-29T00:00:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_u1_b',
      initiator_user_id: 'u_one',
      created_at: '2026-04-29T00:01:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_u2_a',
      initiator_user_id: 'u_two',
      created_at: '2026-04-29T00:02:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_u2_b',
      initiator_user_id: 'u_two',
      created_at: '2026-04-29T00:03:00.000Z',
    });
    await seedTournament(t.db, {
      tournament_id: 'tour_anon',
      initiator_user_id: null,
      created_at: '2026-04-29T00:04:00.000Z',
    });

    const res = await t.app.request('/api/v1/tournaments?initiator_user_id=u_one');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items.map((i) => i['id']).sort()).toEqual(['tour_u1_a', 'tour_u1_b']);
  });
});
