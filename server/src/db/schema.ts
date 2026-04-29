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
  {
    id: '0002_user_bots',
    sql: `
      CREATE TABLE IF NOT EXISTS user_bots (
        user_id TEXT NOT NULL,
        sort_bot_api_bot_id TEXT NOT NULL,
        submitted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        retired_at TEXT,
        PRIMARY KEY (user_id, sort_bot_api_bot_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_bots_bot ON user_bots(sort_bot_api_bot_id);
    `,
  },
  {
    id: '0003_bot_personas',
    sql: `
      CREATE TABLE IF NOT EXISTS bot_personas (
        bot_id TEXT PRIMARY KEY,
        nickname TEXT,
        portrait_url TEXT,
        trash_talk TEXT,
        leonardo_generation_id TEXT,
        portrait_status TEXT NOT NULL DEFAULT 'pending',
        trash_talk_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `,
  },
];
