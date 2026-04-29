// Combines a sort-bot-api ApiBot + BotProfileResponse + our persona +
// our battle history into the rich frontend shape.

import type {
  ApiBot,
  BotProfileResponse,
} from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import { deriveKoPercentage, deriveRecentForm, deriveRecord } from './record.js';
import type { BattleForBot } from './types.js';

export interface SynthesizedBotInputResult {
  input_id: string;
  input_name: string;
  time_seconds: number;
}

export interface SynthesizedBot {
  id: string;
  display_name: string;
  nickname: string | null;
  language: string;
  algorithm: string | null;
  portrait_url: string | null;
  rank: number | null;
  record: { wins: number; losses: number; draws: number };
  ko_percentage: number;
  signature_input: SynthesizedBotInputResult | null;
  achilles_heel: SynthesizedBotInputResult | null;
  recent_form: ReadonlyArray<'W' | 'L' | 'D'>;
  achievements: never[];
  trash_talk: string | null;
  analysis_url: string | null;
  retired: boolean;
}

interface SynthesizeArgs {
  bot: ApiBot;
  profile?: BotProfileResponse | undefined;
  algorithm?: string | null | undefined;
  history?: ReadonlyArray<BattleForBot> | undefined;
  retired?: boolean | undefined;
}

export function synthesizeBot(args: SynthesizeArgs): SynthesizedBot {
  const { bot, profile, history = [], algorithm = null, retired = false } = args;
  const record = deriveRecord(history);
  return {
    id: bot.id,
    display_name: bot.display_name,
    nickname: nicknameFor(bot.id),
    language: bot.language,
    algorithm,
    portrait_url: null,
    rank: profile?.rank ?? null,
    record,
    ko_percentage: deriveKoPercentage(history),
    signature_input: profile
      ? {
          input_id: String(profile.best_input.input_id),
          input_name: `Input #${profile.best_input.input_id}`,
          time_seconds: profile.best_input.median_ms / 1000,
        }
      : null,
    achilles_heel: profile
      ? {
          input_id: String(profile.worst_input.input_id),
          input_name: `Input #${profile.worst_input.input_id}`,
          time_seconds: profile.worst_input.median_ms / 1000,
        }
      : null,
    recent_form: deriveRecentForm(history, 5),
    achievements: [],
    trash_talk: null,
    analysis_url: `/api/v1/bots/${bot.id}/analysis`,
    retired,
  };
}
