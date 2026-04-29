import type { Client } from '@libsql/client';

export interface UserBotRow {
  user_id: string;
  sort_bot_api_bot_id: string;
  submitted_at: string;
  retired_at: string | null;
}

export async function recordUserBot(
  db: Client,
  userId: string,
  botId: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_bots (user_id, sort_bot_api_bot_id) VALUES (?, ?)`,
    args: [userId, botId],
  });
}

export async function listUserBotIds(db: Client, userId: string): Promise<string[]> {
  const res = await db.execute({
    sql: `SELECT sort_bot_api_bot_id
            FROM user_bots
           WHERE user_id = ? AND retired_at IS NULL
        ORDER BY submitted_at DESC`,
    args: [userId],
  });
  return res.rows.map((r) => (r as unknown as Record<string, string>)['sort_bot_api_bot_id']!);
}

export async function isUserOwnerOf(
  db: Client,
  userId: string,
  botId: string,
): Promise<boolean> {
  const res = await db.execute({
    sql: `SELECT 1 FROM user_bots WHERE user_id = ? AND sort_bot_api_bot_id = ? LIMIT 1`,
    args: [userId, botId],
  });
  return res.rows.length > 0;
}

export async function markRetired(
  db: Client,
  userId: string,
  botId: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE user_bots SET retired_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND sort_bot_api_bot_id = ?`,
    args: [userId, botId],
  });
}
