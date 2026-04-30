// bcryptjs ships as CJS without proper named ESM exports — must use default import.
// eslint-disable-next-line import/no-named-as-default-member, import/default
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  // eslint-disable-next-line import/no-named-as-default-member
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  // eslint-disable-next-line import/no-named-as-default-member
  return bcrypt.compare(plain, passwordHash);
}
