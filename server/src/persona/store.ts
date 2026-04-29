import type { Client } from '@libsql/client';

export type PortraitStatus = 'pending' | 'in_flight' | 'complete' | 'failed';
export type TrashTalkStatus = 'pending' | 'complete' | 'failed';

export interface BotPersonaRow {
  bot_id: string;
  nickname: string | null;
  portrait_url: string | null;
  trash_talk: string | null;
  leonardo_generation_id: string | null;
  portrait_status: PortraitStatus;
  trash_talk_status: TrashTalkStatus;
}

function rowToPersona(row: Record<string, unknown>): BotPersonaRow {
  return {
    bot_id: row['bot_id'] as string,
    nickname: (row['nickname'] as string | null) ?? null,
    portrait_url: (row['portrait_url'] as string | null) ?? null,
    trash_talk: (row['trash_talk'] as string | null) ?? null,
    leonardo_generation_id: (row['leonardo_generation_id'] as string | null) ?? null,
    portrait_status: (row['portrait_status'] as PortraitStatus) ?? 'pending',
    trash_talk_status: (row['trash_talk_status'] as TrashTalkStatus) ?? 'pending',
  };
}

export async function getPersona(db: Client, botId: string): Promise<BotPersonaRow | null> {
  const res = await db.execute({
    sql: 'SELECT * FROM bot_personas WHERE bot_id = ? LIMIT 1',
    args: [botId],
  });
  const row = res.rows[0];
  return row ? rowToPersona(row as unknown as Record<string, unknown>) : null;
}

export async function ensurePersonaRow(db: Client, botId: string): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO bot_personas (bot_id) VALUES (?)`,
    args: [botId],
  });
}

export async function setLeonardoGenerationId(
  db: Client,
  botId: string,
  generationId: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE bot_personas
             SET leonardo_generation_id = ?,
                 portrait_status = 'in_flight',
                 updated_at = CURRENT_TIMESTAMP
           WHERE bot_id = ?`,
    args: [generationId, botId],
  });
}

export async function setPortrait(
  db: Client,
  botId: string,
  url: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE bot_personas
             SET portrait_url = ?,
                 portrait_status = 'complete',
                 updated_at = CURRENT_TIMESTAMP
           WHERE bot_id = ?`,
    args: [url, botId],
  });
}

export async function setPortraitFailed(db: Client, botId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE bot_personas
             SET portrait_status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE bot_id = ?`,
    args: [botId],
  });
}

export async function setTrashTalk(db: Client, botId: string, text: string): Promise<void> {
  await db.execute({
    sql: `UPDATE bot_personas
             SET trash_talk = ?,
                 trash_talk_status = 'complete',
                 updated_at = CURRENT_TIMESTAMP
           WHERE bot_id = ?`,
    args: [text, botId],
  });
}

export async function setTrashTalkFailed(db: Client, botId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE bot_personas
             SET trash_talk_status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE bot_id = ?`,
    args: [botId],
  });
}
