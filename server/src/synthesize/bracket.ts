// Slice D1 — initial bracket layout for a tournament.
//
// Pure helper. Returns round-1 rows for `tournament_matches`. Later
// rounds are inserted by the orchestrator (slice D3) as winners
// advance, so this only handles the seeding step.
//
// Bye placement: pad the bracket to the next power of two and give the
// top-N seeds (by participant order) round-1 byes, where
// N = nextPow2(size) - size. A bye row carries the seed in `bot_a_id`,
// `null` in `bot_b_id`, `status='bye'`, and the seed pre-filled as
// `winner_bot_id` so the orchestrator can advance it without firing a
// battle. Play-in matches pair the remaining seeds in fold order
// (highest remaining seed vs lowest, etc.) which is the standard
// single-elimination shape.

export type BracketSize = 4 | 6 | 8 | 12;

export interface InitialMatch {
  match_id: string;
  round: number;
  bracket_position: number;
  bot_a_id: string | null;
  bot_b_id: string | null;
  status: 'pending' | 'bye';
  winner_bot_id: string | null;
}

function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(n));
}

export function buildInitialBracket(
  participantBotIds: ReadonlyArray<string>,
  size: BracketSize,
): InitialMatch[] {
  if (participantBotIds.length !== size) {
    throw new Error(
      `buildInitialBracket: expected ${size} participants, got ${participantBotIds.length}`,
    );
  }

  const padded = nextPow2(size);
  const byeCount = padded - size;
  const rows: InitialMatch[] = [];

  // Bye rows: top-N seeds (participants[0..byeCount-1]).
  for (let i = 0; i < byeCount; i++) {
    const seed = participantBotIds[i]!;
    rows.push({
      match_id: `m_r1_p${i}`,
      round: 1,
      bracket_position: i,
      bot_a_id: seed,
      bot_b_id: null,
      status: 'bye',
      winner_bot_id: seed,
    });
  }

  // Play-in matches: pair remaining seeds in fold order. With seeds
  // [byeCount .. size-1], pair the next-highest vs the lowest:
  //   match0: seed[byeCount]    vs seed[size-1]
  //   match1: seed[byeCount+1]  vs seed[size-2]
  //   ...
  const playInCount = (size - byeCount) / 2;
  for (let i = 0; i < playInCount; i++) {
    const a = participantBotIds[byeCount + i]!;
    const b = participantBotIds[size - 1 - i]!;
    rows.push({
      match_id: `m_r1_p${byeCount + i}`,
      round: 1,
      bracket_position: byeCount + i,
      bot_a_id: a,
      bot_b_id: b,
      status: 'pending',
      winner_bot_id: null,
    });
  }

  return rows;
}
