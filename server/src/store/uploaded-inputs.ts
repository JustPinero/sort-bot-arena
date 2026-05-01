import type { Client } from '@libsql/client';

export interface UploadedInputRow {
  sort_bot_api_input_id: number;
  uploader_user_id: string;
  display_name: string | null;
  size_class: string;
  array_len: number;
  created_at: string;
}

export interface RecordUploadInput {
  sort_bot_api_input_id: number;
  uploader_user_id: string;
  display_name?: string | null;
  size_class: string;
  array_len: number;
}

export async function recordUpload(db: Client, input: RecordUploadInput): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO uploaded_inputs
            (sort_bot_api_input_id, uploader_user_id, display_name, size_class, array_len)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      input.sort_bot_api_input_id,
      input.uploader_user_id,
      input.display_name ?? null,
      input.size_class,
      input.array_len,
    ],
  });
}

export async function listForUser(db: Client, userId: string): Promise<UploadedInputRow[]> {
  const res = await db.execute({
    sql: `SELECT sort_bot_api_input_id, uploader_user_id, display_name, size_class, array_len, created_at
            FROM uploaded_inputs
           WHERE uploader_user_id = ?
        ORDER BY created_at DESC`,
    args: [userId],
  });
  return res.rows.map((r) => {
    const o = r as unknown as Record<string, unknown>;
    return {
      sort_bot_api_input_id: Number(o['sort_bot_api_input_id']),
      uploader_user_id: String(o['uploader_user_id']),
      display_name: o['display_name'] === null ? null : String(o['display_name']),
      size_class: String(o['size_class']),
      array_len: Number(o['array_len']),
      created_at: String(o['created_at']),
    };
  });
}
