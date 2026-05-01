// Asserts every phase-9 migration produced the expected table shape.
// One test per added migration — fails loudly if a column gets dropped
// or renamed by a future change.

import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';

let db: Client;
beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  await runMigrations(db);
});

async function columns(table: string): Promise<string[]> {
  const res = await db.execute(`PRAGMA table_info(${table})`);
  return res.rows.map((r) => (r as unknown as Record<string, string>)['name']!);
}

describe('phase 9 schema migrations', () => {
  it('0006: bot_personas has a `style` column', async () => {
    const cols = await columns('bot_personas');
    expect(cols).toContain('style');
  });

  it('0007: recent_battles has all expected columns + indexes', async () => {
    const cols = await columns('recent_battles');
    for (const c of [
      'battle_id',
      'bot_a_id',
      'bot_b_id',
      'pair_key',
      'initiator_user_id',
      'weight_class',
      'status',
      'winner_bot_id',
      'created_at',
      'completed_at',
    ]) {
      expect(cols, `missing column: ${c}`).toContain(c);
    }
    const idx = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'recent_battles'",
    );
    const idxNames = idx.rows.map((r) => (r as unknown as Record<string, string>)['name']);
    expect(idxNames).toEqual(
      expect.arrayContaining([
        'idx_recent_battles_pair_created',
        'idx_recent_battles_created',
        'idx_recent_battles_initiator',
      ]),
    );
  });

  it('0008: recent_tournaments has all expected columns', async () => {
    const cols = await columns('recent_tournaments');
    for (const c of [
      'tournament_id',
      'initiator_user_id',
      'participant_count',
      'bracket_size',
      'input_mode',
      'status',
      'winner_bot_id',
      'created_at',
      'completed_at',
    ]) {
      expect(cols, `missing column: ${c}`).toContain(c);
    }
  });

  it('0009: uploaded_inputs has all expected columns', async () => {
    const cols = await columns('uploaded_inputs');
    for (const c of [
      'sort_bot_api_input_id',
      'uploader_user_id',
      'display_name',
      'size_class',
      'array_len',
      'created_at',
    ]) {
      expect(cols, `missing column: ${c}`).toContain(c);
    }
  });

  it('schema_migrations records every applied migration', async () => {
    const res = await db.execute('SELECT id FROM schema_migrations ORDER BY id');
    const ids = res.rows.map((r) => (r as unknown as Record<string, string>)['id']);
    expect(ids).toEqual([
      '0001_users',
      '0002_user_bots',
      '0003_bot_personas',
      '0004_upstream_cache',
      '0005_upstream_cache_expiry',
      '0006_bot_personas_style',
      '0007_recent_battles',
      '0008_recent_tournaments',
      '0009_uploaded_inputs',
    ]);
  });

  it('migrations are idempotent (running twice does not error)', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });
});
