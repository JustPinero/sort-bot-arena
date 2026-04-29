// Shared shapes for synthesis layer. Inputs are post-unwrap canonical
// shapes from src/clients/sort-bot-api/types.ts.

export interface BattleForBot {
  battle_id: string;
  bot_was: 'a' | 'b';
  outcome: 'win' | 'loss' | 'draw';
  is_ko: boolean;
  completed_at: string;
}

export type RecentFormEntry = 'W' | 'L' | 'D';

export interface Record {
  wins: number;
  losses: number;
  draws: number;
}
