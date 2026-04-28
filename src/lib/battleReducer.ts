import type { BattleEvent, BattleOutcome, BattleStatus } from '@/api/types';

export interface BattleDerivedState {
  status: BattleStatus;
  currentRound: number;
  currentInputId: string | null;
  currentInputName: string | null;
  aHealth: number;
  bHealth: number;
  aRoundsWon: number;
  bRoundsWon: number;
  hypeLevel: number;
  downed: { bot_id: string; reason: 'timeout' | 'crash' | 'oom' } | null;
  outcome: BattleOutcome | null;
  winnerBotId: string | null;
  lastEvent: BattleEvent | null;
  commentary: string[];
}

export const INITIAL_BATTLE_STATE: BattleDerivedState = {
  status: 'pre_fight',
  currentRound: 0,
  currentInputId: null,
  currentInputName: null,
  aHealth: 100,
  bHealth: 100,
  aRoundsWon: 0,
  bRoundsWon: 0,
  hypeLevel: 0,
  downed: null,
  outcome: null,
  winnerBotId: null,
  lastEvent: null,
  commentary: [],
};

const HEALTH_PER_ROUND_LOSS = 12;
const HYPE_WINDOW = 10;
const DRAMATIC_TYPES = new Set<BattleEvent['type']>(['round_end', 'fighter_downed', 'fight_end']);

function isDramatic(e: BattleEvent): boolean {
  return DRAMATIC_TYPES.has(e.type);
}

export function deriveBattleState(
  events: BattleEvent[],
  fighterAId: string,
  fighterBId: string,
): BattleDerivedState {
  const state: BattleDerivedState = { ...INITIAL_BATTLE_STATE, commentary: [] };

  for (const event of events) {
    state.lastEvent = event;

    switch (event.type) {
      case 'walkout':
        // no-op for derived state; consumed by audio + pre-fight visuals
        break;
      case 'fight_start':
        state.status = 'live';
        break;
      case 'round_start':
        state.currentRound = event.round;
        state.currentInputId = event.input_id;
        state.currentInputName = event.input_name;
        break;
      case 'round_progress':
        // visual only
        break;
      case 'round_end':
        if (event.winner_bot_id === fighterAId) {
          state.aRoundsWon += 1;
          state.bHealth = Math.max(0, state.bHealth - HEALTH_PER_ROUND_LOSS);
        } else if (event.winner_bot_id === fighterBId) {
          state.bRoundsWon += 1;
          state.aHealth = Math.max(0, state.aHealth - HEALTH_PER_ROUND_LOSS);
        }
        break;
      case 'fighter_downed':
        state.downed = { bot_id: event.bot_id, reason: event.reason };
        if (event.bot_id === fighterAId) state.aHealth = 0;
        else if (event.bot_id === fighterBId) state.bHealth = 0;
        break;
      case 'commentary':
        state.commentary = [...state.commentary, event.text].slice(-50);
        break;
      case 'fight_end':
        state.status = 'completed';
        state.outcome = event.outcome;
        state.winnerBotId = event.winner_bot_id;
        break;
    }
  }

  // hype is the recent share of dramatic events
  const recent = events.slice(-HYPE_WINDOW);
  const dramatic = recent.filter(isDramatic).length;
  state.hypeLevel = recent.length === 0 ? 0 : Math.min(1, dramatic / 5);

  return state;
}
