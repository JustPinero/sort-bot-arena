import type { BattleForBot, Record, RecentFormEntry } from './types.js';
import type { BattleResponse } from '../clients/sort-bot-api/index.js';

// A KO is a battle the bot won where the opponent had at least one
// non-success run (crash, timeout, wrong_answer, etc.). Pure timing
// dominance is just a "decision" — we want the opponent to actually
// fail to call it a KO.
export function toBattleForBot(botId: string, b: BattleResponse): BattleForBot {
  const bot_was: 'a' | 'b' = b.battle.bot_a_id === botId ? 'a' : 'b';
  const won = b.battle.winner_bot_id === botId;
  const drawn = b.battle.winner_bot_id === null;
  const outcome: BattleForBot['outcome'] = drawn ? 'draw' : won ? 'win' : 'loss';
  let is_ko = false;
  if (outcome === 'win') {
    is_ko = b.runs.some((r) =>
      bot_was === 'a' ? r.bot_b_status !== 'success' : r.bot_a_status !== 'success',
    );
  }
  return {
    battle_id: b.battle.id,
    bot_was,
    outcome,
    is_ko,
    completed_at: b.battle.completed_at ?? b.battle.created_at,
  };
}

export function deriveRecord(history: ReadonlyArray<BattleForBot>): Record {
  const acc: Record = { wins: 0, losses: 0, draws: 0 };
  for (const h of history) {
    if (h.outcome === 'win') acc.wins++;
    else if (h.outcome === 'loss') acc.losses++;
    else acc.draws++;
  }
  return acc;
}

// Percentage of the bot's wins that ended in a KO. Returns 0 when the
// bot has no wins. Numbers > 0 are rounded to one decimal.
export function deriveKoPercentage(history: ReadonlyArray<BattleForBot>): number {
  const wins = history.filter((h) => h.outcome === 'win');
  if (wins.length === 0) return 0;
  const kos = wins.filter((h) => h.is_ko).length;
  return Math.round((kos / wins.length) * 1000) / 10;
}

// Most-recent-first slice of the bot's last N decisions. Sorted by
// completed_at descending so a fresh fight pushes older fights off the
// tail. Caller chooses N; UI typically wants 5.
export function deriveRecentForm(
  history: ReadonlyArray<BattleForBot>,
  n: number,
): RecentFormEntry[] {
  const sorted = [...history].sort(
    (a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at),
  );
  return sorted.slice(0, n).map(outcomeToLetter);
}

function outcomeToLetter(b: BattleForBot): RecentFormEntry {
  return b.outcome === 'win' ? 'W' : b.outcome === 'loss' ? 'L' : 'D';
}
