// Slice D1 — pure helpers for tournament orchestration.
//
// Covers:
//   - buildInitialBracket: 4/6/8/12 layouts. Bye placement is top-N
//     seeds by participant order; bye matches carry the seed as
//     winner_bot_id.
//   - pickRoundInputs: flat_random shuffles, escalation walks
//     small→medium→large per round and gracefully degrades.
//   - 0010_tournament_matches migration shape.

import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildInitialBracket,
  type BracketSize,
  type InitialMatch,
} from '../src/synthesize/bracket.js';
import { runMigrations } from '../src/db/migrate.js';
import { pickRoundInputs } from '../src/synthesize/tournament-inputs.js';

import type { ApiInput } from '../src/clients/sort-bot-api/types.js';

function makeBots(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `bot_${i + 1}`);
}

describe('buildInitialBracket', () => {
  it('4 bots → 2 round-1 matches, 0 byes', () => {
    const bots = makeBots(4);
    const rows = buildInitialBracket(bots, 4);
    const byes = rows.filter((r) => r.status === 'bye');
    const matches = rows.filter((r) => r.status === 'pending');
    expect(byes).toHaveLength(0);
    expect(matches).toHaveLength(2);
    for (const m of matches) {
      expect(m.bot_a_id).not.toBeNull();
      expect(m.bot_b_id).not.toBeNull();
      expect(m.winner_bot_id).toBeNull();
      expect(m.round).toBe(1);
    }
  });

  it('6 bots → 2 round-1 matches + 2 byes, top-2 seeds get the byes', () => {
    const bots = makeBots(6);
    const rows = buildInitialBracket(bots, 6);
    const byes = rows.filter((r) => r.status === 'bye');
    const matches = rows.filter((r) => r.status === 'pending');
    expect(byes).toHaveLength(2);
    expect(matches).toHaveLength(2);

    // Top-2 seeds (by participant order) get the byes.
    const byeSeeds = byes.map((b) => b.bot_a_id);
    expect(byeSeeds).toEqual(['bot_1', 'bot_2']);
    for (const b of byes) {
      expect(b.bot_b_id).toBeNull();
      expect(b.winner_bot_id).toBe(b.bot_a_id);
      expect(b.round).toBe(1);
    }

    // Remaining 4 in 2 matches with both slots filled.
    const remainingIds = new Set<string>();
    for (const m of matches) {
      expect(m.bot_a_id).not.toBeNull();
      expect(m.bot_b_id).not.toBeNull();
      remainingIds.add(m.bot_a_id!);
      remainingIds.add(m.bot_b_id!);
    }
    expect(remainingIds).toEqual(new Set(['bot_3', 'bot_4', 'bot_5', 'bot_6']));
  });

  it('8 bots → 4 round-1 matches, 0 byes', () => {
    const bots = makeBots(8);
    const rows = buildInitialBracket(bots, 8);
    const byes = rows.filter((r) => r.status === 'bye');
    const matches = rows.filter((r) => r.status === 'pending');
    expect(byes).toHaveLength(0);
    expect(matches).toHaveLength(4);
    for (const m of matches) {
      expect(m.bot_a_id).not.toBeNull();
      expect(m.bot_b_id).not.toBeNull();
    }
  });

  it('12 bots → 4 round-1 matches + 4 byes, top-4 seeds get the byes', () => {
    const bots = makeBots(12);
    const rows = buildInitialBracket(bots, 12);
    const byes = rows.filter((r) => r.status === 'bye');
    const matches = rows.filter((r) => r.status === 'pending');
    expect(byes).toHaveLength(4);
    expect(matches).toHaveLength(4);

    const byeSeeds = byes.map((b) => b.bot_a_id);
    expect(byeSeeds).toEqual(['bot_1', 'bot_2', 'bot_3', 'bot_4']);
    for (const b of byes) {
      expect(b.winner_bot_id).toBe(b.bot_a_id);
    }
  });

  it.each<BracketSize>([4, 6, 8, 12])(
    'property: bye-count + 2 * match-count = bracket_size (size=%d)',
    (size) => {
      const rows = buildInitialBracket(makeBots(size), size);
      const byes = rows.filter((r) => r.status === 'bye').length;
      const matches = rows.filter((r) => r.status === 'pending').length;
      expect(byes + 2 * matches).toBe(size);
    },
  );

  it('match_id is unique across the returned rows for every layout', () => {
    for (const size of [4, 6, 8, 12] as const) {
      const rows: InitialMatch[] = buildInitialBracket(makeBots(size), size);
      const ids = rows.map((r) => r.match_id);
      expect(new Set(ids).size, `duplicate match_id at size ${size}`).toBe(ids.length);
    }
  });
});

// Helper: deterministic LCG so flat_random tests are reproducible.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeInput(id: number, size_class: ApiInput['size_class']): ApiInput {
  return {
    id,
    size_class,
    case_index: 0,
    array_len: 100,
    is_custom: false,
    uploader_id: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('pickRoundInputs', () => {
  it('flat_random returns count random ids from the full pool', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'small'),
      makeInput(3, 'medium'),
      makeInput(4, 'medium'),
      makeInput(5, 'large'),
      makeInput(6, 'large'),
    ];
    const rng = makeRng(42);
    const picked = pickRoundInputs(inputs, 1, 'flat_random', 3, rng);
    expect(picked).toHaveLength(3);
    // All from the pool, no dupes.
    for (const id of picked) {
      expect([1, 2, 3, 4, 5, 6]).toContain(id);
    }
    expect(new Set(picked).size).toBe(3);

    // Determinism: same seed → same picks.
    const picked2 = pickRoundInputs(inputs, 1, 'flat_random', 3, makeRng(42));
    expect(picked2).toEqual(picked);
  });

  it('escalation round 1 → only small inputs', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'small'),
      makeInput(3, 'small'),
      makeInput(4, 'medium'),
      makeInput(5, 'large'),
    ];
    const picked = pickRoundInputs(inputs, 1, 'escalation', 3, makeRng(7));
    expect(picked).toHaveLength(3);
    for (const id of picked) {
      expect([1, 2, 3]).toContain(id);
    }
  });

  it('escalation round 2 → only medium', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'medium'),
      makeInput(3, 'medium'),
      makeInput(4, 'medium'),
      makeInput(5, 'large'),
    ];
    const picked = pickRoundInputs(inputs, 2, 'escalation', 3, makeRng(7));
    expect(picked).toHaveLength(3);
    for (const id of picked) {
      expect([2, 3, 4]).toContain(id);
    }
  });

  it('escalation round 3 → only large', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'medium'),
      makeInput(3, 'large'),
      makeInput(4, 'large'),
      makeInput(5, 'large'),
    ];
    const picked = pickRoundInputs(inputs, 3, 'escalation', 3, makeRng(7));
    expect(picked).toHaveLength(3);
    for (const id of picked) {
      expect([3, 4, 5]).toContain(id);
    }
  });

  it('escalation round 5+ → still large (clamped)', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'medium'),
      makeInput(3, 'large'),
      makeInput(4, 'large'),
      makeInput(5, 'large'),
    ];
    const picked = pickRoundInputs(inputs, 5, 'escalation', 3, makeRng(7));
    expect(picked).toHaveLength(3);
    for (const id of picked) {
      expect([3, 4, 5]).toContain(id);
    }
  });

  it('graceful degrade: 1 small input but count=3 round 1 → falls through to medium', () => {
    const inputs: ApiInput[] = [
      makeInput(1, 'small'),
      makeInput(2, 'medium'),
      makeInput(3, 'medium'),
      makeInput(4, 'medium'),
    ];
    const picked = pickRoundInputs(inputs, 1, 'escalation', 3, makeRng(7));
    expect(picked).toHaveLength(3);
    // Falls through entirely to medium (does not mix classes — the
    // class with enough inputs is medium).
    for (const id of picked) {
      expect([2, 3, 4]).toContain(id);
    }
  });

  it('count > pool size: returns the whole pool (no error)', () => {
    const inputs: ApiInput[] = [makeInput(1, 'small'), makeInput(2, 'small')];
    const picked = pickRoundInputs(inputs, 1, 'flat_random', 5, makeRng(1));
    expect(picked).toHaveLength(2);
    expect(new Set(picked)).toEqual(new Set([1, 2]));
  });
});

describe('0010_tournament_matches migration', () => {
  let db: Client;
  beforeEach(async () => {
    db = createClient({ url: ':memory:' });
    await runMigrations(db);
  });

  it('produces tournament_matches table with all expected columns', async () => {
    const res = await db.execute('PRAGMA table_info(tournament_matches)');
    const cols = res.rows.map((r) => (r as unknown as Record<string, string>)['name']);
    for (const c of [
      'match_id',
      'tournament_id',
      'round',
      'bracket_position',
      'bot_a_id',
      'bot_b_id',
      'battle_id',
      'status',
      'winner_bot_id',
      'scheduled_at',
      'completed_at',
    ]) {
      expect(cols, `missing column: ${c}`).toContain(c);
    }
  });

  it('creates the two expected indexes', async () => {
    const idx = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tournament_matches'",
    );
    const names = idx.rows.map((r) => (r as unknown as Record<string, string>)['name']);
    expect(names).toEqual(
      expect.arrayContaining(['idx_tm_tournament_round', 'idx_tm_status_scheduled']),
    );
  });

  it('records 0010_tournament_matches in schema_migrations', async () => {
    const res = await db.execute('SELECT id FROM schema_migrations ORDER BY id');
    const ids = res.rows.map((r) => (r as unknown as Record<string, string>)['id']);
    expect(ids).toContain('0010_tournament_matches');
  });
});
