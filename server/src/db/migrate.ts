import { migrations } from './schema.js';

import type { Client } from '@libsql/client';

export async function runMigrations(db: Client): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  );
  const applied = await db.execute('SELECT id FROM schema_migrations');
  const seen = new Set(applied.rows.map((r) => r['id'] as string));

  for (const m of migrations) {
    if (seen.has(m.id)) continue;
    await db.executeMultiple(m.sql);
    await db.execute({
      sql: 'INSERT INTO schema_migrations (id) VALUES (?)',
      args: [m.id],
    });
  }
}
