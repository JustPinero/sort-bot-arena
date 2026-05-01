export type BracketSize = 4 | 6 | 8 | 12;

export const BRACKET_SIZES: BracketSize[] = [4, 6, 8, 12];

// Fisher-Yates shuffle, returns the first n. Throws when pool < n.
export function pickRandomBots(pool: ReadonlyArray<string>, n: number): string[] {
  if (n > pool.length) {
    throw new Error(`pickRandomBots: pool size ${pool.length} < n ${n}`);
  }
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as string;
    arr[i] = arr[j] as string;
    arr[j] = tmp;
  }
  return arr.slice(0, n);
}
