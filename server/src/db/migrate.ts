import type { Client } from '@libsql/client';
import { migrations } from './schema.js';

export async function runMigrations(db: Client): Promise<void> {
  for (const m of migrations) {
    // libsql executeMultiple accepts a single SQL string with multiple statements.
    await db.executeMultiple(m.sql);
  }
}
