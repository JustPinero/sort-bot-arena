// Helpers for unwrapping sort-bot-api's Go-flavored sql.NullInt64 /
// sql.NullString JSON shapes into plain nullable primitives.

interface NullInt64 {
  Int64: number;
  Valid: boolean;
}
interface NullString {
  String: string;
  Valid: boolean;
}

export function nullInt(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'Int64' in v && 'Valid' in v) {
    const n = v as NullInt64;
    return n.Valid ? n.Int64 : null;
  }
  return null;
}

export function nullStr(v: unknown): string | null {
  if (typeof v === 'string') return v.length > 0 ? v : null;
  if (v && typeof v === 'object' && 'String' in v && 'Valid' in v) {
    const s = v as NullString;
    return s.Valid ? s.String : null;
  }
  return null;
}
