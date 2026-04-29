// Migrations run in order on app boot (and at the start of each integration
// test). Idempotent — every statement uses IF NOT EXISTS so re-applying is
// safe.

export const migrations: ReadonlyArray<{ id: string; sql: string }> = [
  {
    id: '0001_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        sort_bot_api_user_id TEXT NOT NULL,
        sort_bot_api_key_encrypted BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
];
