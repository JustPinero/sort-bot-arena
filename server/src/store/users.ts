import type { Client } from '@libsql/client';
import { randomBytes } from 'node:crypto';

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  sort_bot_api_user_id: string;
  sort_bot_api_key_encrypted: Uint8Array;
  created_at: string;
}

export interface CreateUserInput {
  email: string;
  display_name: string;
  password_hash: string;
  sort_bot_api_user_id: string;
  sort_bot_api_key_encrypted: Uint8Array;
}

function newUserId(): string {
  return 'usr_' + randomBytes(12).toString('hex');
}

function rowToUser(row: Record<string, unknown>): UserRow {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    display_name: row['display_name'] as string,
    password_hash: row['password_hash'] as string,
    sort_bot_api_user_id: row['sort_bot_api_user_id'] as string,
    sort_bot_api_key_encrypted: row['sort_bot_api_key_encrypted'] as Uint8Array,
    created_at: row['created_at'] as string,
  };
}

export async function createUser(db: Client, input: CreateUserInput): Promise<UserRow> {
  const id = newUserId();
  await db.execute({
    sql: `INSERT INTO users
            (id, email, display_name, password_hash, sort_bot_api_user_id, sort_bot_api_key_encrypted)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.email.toLowerCase(),
      input.display_name,
      input.password_hash,
      input.sort_bot_api_user_id,
      input.sort_bot_api_key_encrypted,
    ],
  });
  const fetched = await getUserById(db, id);
  if (!fetched) throw new Error('createUser: insert succeeded but row not found');
  return fetched;
}

export async function getUserByEmail(db: Client, email: string): Promise<UserRow | null> {
  const res = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    args: [email.toLowerCase()],
  });
  const row = res.rows[0];
  return row ? rowToUser(row as unknown as Record<string, unknown>) : null;
}

export async function getUserById(db: Client, id: string): Promise<UserRow | null> {
  const res = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
    args: [id],
  });
  const row = res.rows[0];
  return row ? rowToUser(row as unknown as Record<string, unknown>) : null;
}
