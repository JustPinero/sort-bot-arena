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
  {
    id: '0004_upstream_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS upstream_cache (
        cache_key TEXT PRIMARY KEY,
        body_json TEXT NOT NULL,
        stored_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `,
  },
  {
    id: '0005_upstream_cache_expiry',
    sql: `
      ALTER TABLE upstream_cache ADD COLUMN expires_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_upstream_cache_expires ON upstream_cache(expires_at);
    `,
  },
  {
    id: '0006_bot_personas_style',
    sql: `
      ALTER TABLE bot_personas ADD COLUMN style TEXT;
    `,
  },
  {
    id: '0007_recent_battles',
    sql: `
      CREATE TABLE IF NOT EXISTS recent_battles (
        battle_id            TEXT    PRIMARY KEY,
        bot_a_id             TEXT    NOT NULL,
        bot_b_id             TEXT    NOT NULL,
        pair_key             TEXT    NOT NULL,
        initiator_user_id    TEXT,
        weight_class         TEXT,
        status               TEXT    NOT NULL,
        winner_bot_id        TEXT,
        created_at           TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        completed_at         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_recent_battles_pair_created
        ON recent_battles (pair_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recent_battles_created
        ON recent_battles (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recent_battles_initiator
        ON recent_battles (initiator_user_id, created_at DESC);
    `,
  },
  {
    id: '0008_recent_tournaments',
    sql: `
      CREATE TABLE IF NOT EXISTS recent_tournaments (
        tournament_id        TEXT    PRIMARY KEY,
        initiator_user_id    TEXT,
        participant_count    INTEGER NOT NULL,
        bracket_size         INTEGER NOT NULL,
        input_mode           TEXT    NOT NULL,
        status               TEXT    NOT NULL,
        winner_bot_id        TEXT,
        created_at           TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        completed_at         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_recent_tournaments_created
        ON recent_tournaments (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recent_tournaments_initiator
        ON recent_tournaments (initiator_user_id, created_at DESC);
    `,
  },
  {
    id: '0009_uploaded_inputs',
    sql: `
      CREATE TABLE IF NOT EXISTS uploaded_inputs (
        sort_bot_api_input_id INTEGER PRIMARY KEY,
        uploader_user_id      TEXT    NOT NULL,
        display_name          TEXT,
        size_class            TEXT    NOT NULL,
        array_len             INTEGER NOT NULL,
        created_at            TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_uploaded_inputs_uploader
        ON uploaded_inputs (uploader_user_id, created_at DESC);
    `,
  },
  {
    id: '0010_tournament_matches',
    sql: `
      CREATE TABLE IF NOT EXISTS tournament_matches (
        match_id              TEXT    PRIMARY KEY,
        tournament_id         TEXT    NOT NULL,
        round                 INTEGER NOT NULL,
        bracket_position      INTEGER NOT NULL,
        bot_a_id              TEXT,
        bot_b_id              TEXT,
        battle_id             TEXT,
        status                TEXT    NOT NULL,
        winner_bot_id         TEXT,
        scheduled_at          TEXT,
        completed_at          TEXT,
        FOREIGN KEY (tournament_id) REFERENCES recent_tournaments(tournament_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tm_tournament_round ON tournament_matches(tournament_id, round, bracket_position);
      CREATE INDEX IF NOT EXISTS idx_tm_status_scheduled ON tournament_matches(status, scheduled_at);
    `,
  },
];
