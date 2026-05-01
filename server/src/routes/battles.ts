import { Hono } from 'hono';

import { nicknameFor } from '../persona/nicknames.js';

import { SortBotApiError } from '../clients/sort-bot-api/index.js';

import type { AppContext } from '../auth/middleware.js';
import type {
  ApiBot,
  BattleResponse,
  BattleRun,
  SortBotApiClient,
} from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';

type Corner = 'red' | 'blue';
type BattleStatus = 'pre_fight' | 'live' | 'completed';
type BattleOutcome = 'ko' | 'tko' | 'decision' | 'draw' | 'no_contest';

interface BattleFighter {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
  corner: Corner;
  rank: number | null;
  trash_talk?: string | null;
}

interface Battle {
  id: string;
  status: BattleStatus;
  fighter_a: BattleFighter;
  fighter_b: BattleFighter;
  rounds_total: number;
  current_round: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  winner_bot_id: string | null;
  outcome: BattleOutcome | null;
}

function buildFighter(
  bot: ApiBot,
  persona: BotPersonaRow | null,
  corner: Corner,
): BattleFighter {
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

function mapStatus(upstream: BattleResponse['battle']['status']): BattleStatus {
  if (upstream === 'pending') return 'pre_fight';
  if (upstream === 'running') return 'live';
  return 'completed';
}

function deriveOutcome(
  battle: BattleResponse['battle'],
  runs: BattleRun[],
): BattleOutcome | null {
  if (battle.status !== 'complete' && battle.status !== 'failed') return null;
  if (battle.winner_bot_id === null) return 'draw';
  const allKo = runs.length > 0 && runs.every((run) => {
    return run.bot_a_status !== 'success' || run.bot_b_status !== 'success';
  });
  if (allKo) return 'ko';
  return 'decision';
}

function countCompletedRuns(runs: BattleRun[]): number {
  return runs.filter((r) => r.winner_bot_id !== null || r.completed_at).length;
}

export function battlesRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // List endpoint placeholder. sort-bot-api has no list endpoint today;
  // when we add a battles index in our DB this will paginate from there.
  r.get('/', (c) => c.json({ items: [], next_cursor: null }));

  r.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const { battle, runs } = await deps.sortBotApi.getBattle(id);
      const [botA, botB, personaA, personaB] = await Promise.all([
        deps.sortBotApi.getBot(battle.bot_a_id),
        deps.sortBotApi.getBot(battle.bot_b_id),
        deps.persona.get(battle.bot_a_id).catch(() => null),
        deps.persona.get(battle.bot_b_id).catch(() => null),
      ]);

      const status = mapStatus(battle.status);
      const roundsTotal = runs.length;
      const currentRound =
        battle.status === 'complete' || battle.status === 'failed'
          ? runs.length
          : countCompletedRuns(runs);

      const payload: Battle = {
        id: battle.id,
        status,
        fighter_a: buildFighter(botA, personaA, 'red'),
        fighter_b: buildFighter(botB, personaB, 'blue'),
        rounds_total: roundsTotal,
        current_round: currentRound,
        scheduled_at: battle.created_at,
        started_at: battle.status === 'pending' ? null : battle.created_at,
        completed_at: battle.completed_at,
        winner_bot_id: battle.winner_bot_id,
        outcome: deriveOutcome(battle, runs),
      };
      return c.json(payload);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        if (err.status === 404) return c.json({ error: 'not_found' }, 404);
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }
  });

  return r;
}
