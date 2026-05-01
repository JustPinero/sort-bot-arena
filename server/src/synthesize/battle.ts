// Slice 7 — shared mapper from upstream sort-bot-api battle data
// (BattleSummary + runs) plus our hydrated fighters into the rich
// frontend `Battle` shape (`src/api/types.ts:149-162`).
//
// Extracted from routes/battles.ts so both GET /:id and the new GET /
// list handler can call the same logic without drift. Slice 5 will plug
// the persisted `weight_class` label through `weightClass` once it
// extends the rich shape; for now we accept it as an optional argument
// and pass it through unchanged.

import { nicknameFor } from '../persona/nicknames.js';

import type {
  ApiBot,
  BattleResponse,
  BattleRun,
} from '../clients/sort-bot-api/index.js';
import type { BotPersonaRow } from '../persona/store.js';

export type Corner = 'red' | 'blue';
export type RichBattleStatus = 'pre_fight' | 'live' | 'completed';
export type RichBattleOutcome = 'ko' | 'tko' | 'decision' | 'draw' | 'no_contest';

export interface RichBattleFighter {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
  corner: Corner;
  rank: number | null;
  trash_talk?: string | null;
}

export interface RichBattle {
  id: string;
  status: RichBattleStatus;
  fighter_a: RichBattleFighter;
  fighter_b: RichBattleFighter;
  rounds_total: number;
  current_round: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  winner_bot_id: string | null;
  outcome: RichBattleOutcome | null;
  weight_class: string | null;
}

export function buildFighter(
  bot: ApiBot,
  persona: BotPersonaRow | null,
  corner: Corner,
): RichBattleFighter {
  return {
    bot_id: bot.id,
    nickname: persona?.nickname ?? nicknameFor(bot.id),
    display_name: bot.display_name,
    language: bot.language,
    portrait_url: persona?.portrait_url ?? null,
    corner,
    rank: null,
    trash_talk: persona?.trash_talk ?? null,
  };
}

export function mapStatus(upstream: BattleResponse['battle']['status']): RichBattleStatus {
  if (upstream === 'pending') return 'pre_fight';
  if (upstream === 'running') return 'live';
  return 'completed';
}

export function deriveOutcome(
  battle: BattleResponse['battle'],
  runs: BattleRun[],
): RichBattleOutcome | null {
  if (battle.status !== 'complete' && battle.status !== 'failed') return null;
  if (battle.winner_bot_id === null) return 'draw';
  const allKo = runs.length > 0 && runs.every((run) => {
    return run.bot_a_status !== 'success' || run.bot_b_status !== 'success';
  });
  if (allKo) return 'ko';
  return 'decision';
}

export function countCompletedRuns(runs: BattleRun[]): number {
  return runs.filter((r) => r.winner_bot_id !== null || r.completed_at).length;
}

export interface SynthesizeBattleArgs {
  upstream: BattleResponse;
  fighters: { a: ApiBot; b: ApiBot };
  personas: { a: BotPersonaRow | null; b: BotPersonaRow | null };
  weightClass?: string | null;
}

export function synthesizeBattle(args: SynthesizeBattleArgs): RichBattle {
  const { upstream, fighters, personas } = args;
  const { battle, runs } = upstream;
  const status = mapStatus(battle.status);
  const roundsTotal = runs.length;
  const currentRound =
    battle.status === 'complete' || battle.status === 'failed'
      ? runs.length
      : countCompletedRuns(runs);
  return {
    id: battle.id,
    status,
    fighter_a: buildFighter(fighters.a, personas.a, 'red'),
    fighter_b: buildFighter(fighters.b, personas.b, 'blue'),
    rounds_total: roundsTotal,
    current_round: currentRound,
    scheduled_at: battle.created_at,
    started_at: battle.status === 'pending' ? null : battle.created_at,
    completed_at: battle.completed_at,
    winner_bot_id: battle.winner_bot_id,
    outcome: deriveOutcome(battle, runs),
    weight_class: args.weightClass ?? null,
  };
}

// List-mode synthesis: builds a rich Battle from a recent_battles row
// plus hydrated fighters, *without* calling sort-bot-api getBattle for
// each row. Rounds and outcome data live on the upstream battle/runs
// (we don't mirror them locally) so the list shape sets:
//   - rounds_total / current_round → 0 (frontend list cards don't render
//     mid-fight scoring)
//   - outcome → 'decision' if status is 'complete' with a winner, 'draw'
//     if 'complete' without one, otherwise null. We don't know KO vs
//     decision without runs, so we default the milder 'decision' label.
// Detail page (`GET /:id`) still calls `synthesizeBattle` with full
// upstream data for accurate per-round + KO classification.
export type RecentBattleStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface RecentBattleRowLike {
  battle_id: string;
  status: RecentBattleStatus;
  winner_bot_id: string | null;
  weight_class: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SynthesizeBattleFromRowArgs {
  row: RecentBattleRowLike;
  fighters: { a: ApiBot; b: ApiBot };
  personas: { a: BotPersonaRow | null; b: BotPersonaRow | null };
}

function mapRowStatus(status: RecentBattleStatus): RichBattleStatus {
  if (status === 'pending') return 'pre_fight';
  if (status === 'running') return 'live';
  return 'completed';
}

export function synthesizeBattleFromRow(args: SynthesizeBattleFromRowArgs): RichBattle {
  const { row, fighters, personas } = args;
  const status = mapRowStatus(row.status);
  let outcome: RichBattleOutcome | null = null;
  if (row.status === 'complete' || row.status === 'failed') {
    outcome = row.winner_bot_id === null ? 'draw' : 'decision';
  }
  return {
    id: row.battle_id,
    status,
    fighter_a: buildFighter(fighters.a, personas.a, 'red'),
    fighter_b: buildFighter(fighters.b, personas.b, 'blue'),
    rounds_total: 0,
    current_round: 0,
    scheduled_at: row.created_at,
    started_at: row.status === 'pending' ? null : row.created_at,
    completed_at: row.completed_at,
    winner_bot_id: row.winner_bot_id,
    outcome,
    weight_class: row.weight_class,
  };
}
