// Slice D1 — pure helper for picking which inputs power a tournament
// round. Two modes:
//
//   flat_random — uniform shuffle of the entire pool, take `count`.
//   escalation  — pick by size_class per round
//                   round 1 → small
//                   round 2 → medium
//                   round 3+ → large
//                 If a class has fewer than `count` entries, fall
//                 through to the next class up. Doesn't mix classes —
//                 the goal is thematic consistency within a round.
//
// `rng` is injected so tests can be deterministic; defaults to
// `Math.random` in production. Returns the picked input ids in the
// shuffled order; truncated when the pool is smaller than `count`.

import type { ApiInput } from '../clients/sort-bot-api/types.js';

export type TournamentInputMode = 'flat_random' | 'escalation';

const DEFAULT_COUNT = 3;

function shuffle<T>(arr: ReadonlyArray<T>, rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function classesForRound(round: number): ReadonlyArray<ApiInput['size_class']> {
  // Round 1 starts at small, then walks up. Once at large we stay
  // there. The fall-through chain lets a thin pool degrade gracefully.
  if (round <= 1) return ['small', 'medium', 'large'];
  if (round === 2) return ['medium', 'large'];
  return ['large'];
}

export function pickRoundInputs(
  inputs: ReadonlyArray<ApiInput>,
  round: number,
  mode: TournamentInputMode,
  count: number = DEFAULT_COUNT,
  rng: () => number = Math.random,
): number[] {
  const take = Math.max(0, count);

  if (mode === 'flat_random') {
    const shuffled = shuffle(inputs, rng);
    return shuffled.slice(0, take).map((i) => i.id);
  }

  // escalation: walk the class chain for this round, returning the
  // first class that has at least `take` inputs. If none do, return
  // the deepest pool we found (best-effort for very thin pools).
  const chain = classesForRound(round);
  let bestPool: ApiInput[] = [];
  for (const cls of chain) {
    const pool = inputs.filter((i) => i.size_class === cls);
    if (pool.length >= take) {
      return shuffle(pool, rng)
        .slice(0, take)
        .map((i) => i.id);
    }
    if (pool.length > bestPool.length) bestPool = pool;
  }
  return shuffle(bestPool, rng)
    .slice(0, take)
    .map((i) => i.id);
}
