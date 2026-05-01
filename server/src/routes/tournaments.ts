import { Hono } from 'hono';

import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';

import type { AppContext } from '../auth/middleware.js';
import type {
  ApiBot,
  SortBotApiClient,
  TournamentMatch as UpstreamMatch,
  TournamentSummary,
} from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';

type TournamentStatus = 'upcoming' | 'active' | 'completed';
type MatchStatus = 'pending' | 'live' | 'completed' | 'bye';

interface TournamentParticipant {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
}

interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  fighter_a_bot_id: string | null;
  fighter_b_bot_id: string | null;
  winner_bot_id: string | null;
  status: MatchStatus;
  battle_id: string | null;
}

interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  participant_count: number;
  weight_class_filter: string | null;
  prize_description: string | null;
  scheduled_at: string;
  rounds_total: number;
  current_round: number;
  champion_bot_id: string | null;
  matches: TournamentMatch[];
  participants: TournamentParticipant[];
}

function mapStatus(upstream: TournamentSummary['status']): TournamentStatus {
  if (upstream === 'pending') return 'upcoming';
  if (upstream === 'running') return 'active';
  return 'completed';
}

function deriveMatchStatus(m: UpstreamMatch): MatchStatus {
  if (m.winner_bot_id !== null) return 'completed';
  const hasA = m.bot_a_id !== null;
  const hasB = m.bot_b_id !== null;
  if (hasA && hasB) return 'live';
  if (hasA !== hasB) return 'bye';
  return 'pending';
}

function buildParticipant(
  bot: ApiBot,
  persona: BotPersonaRow | null,
): TournamentParticipant {
  return {
    bot_id: bot.id,
    nickname: persona?.nickname ?? nicknameFor(bot.id),
    display_name: bot.display_name,
    language: bot.language,
    portrait_url: persona?.portrait_url ?? null,
  };
}

export function tournamentsRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // List endpoint placeholder. sort-bot-api has no list endpoint today;
  // when we add a tournaments index in our DB this will paginate from there.
  r.get('/', (c) => c.json({ items: [], next_cursor: null }));

  r.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const { tournament, matches } = await deps.sortBotApi.getTournament(id);

      const participantIds = Array.from(
        new Set(
          matches.flatMap((m) =>
            [m.bot_a_id, m.bot_b_id].filter((x): x is string => typeof x === 'string'),
          ),
        ),
      );

      const participants = await Promise.all(
        participantIds.map(async (botId) => {
          const [bot, persona] = await Promise.all([
            deps.sortBotApi.getBot(botId),
            deps.persona.get(botId).catch(() => null),
          ]);
          return buildParticipant(bot, persona);
        }),
      );

      const roundsTotal = matches.reduce((max, m) => Math.max(max, m.round), 0);
      const currentRound = matches.reduce(
        (max, m) => (m.winner_bot_id !== null ? Math.max(max, m.round) : max),
        0,
      );

      const mappedMatches: TournamentMatch[] = matches.map((m) => ({
        id: String(m.id),
        round: m.round,
        position: m.bracket_position,
        fighter_a_bot_id: m.bot_a_id,
        fighter_b_bot_id: m.bot_b_id,
        winner_bot_id: m.winner_bot_id,
        status: deriveMatchStatus(m),
        battle_id: m.battle_id,
      }));

      const payload: Tournament = {
        id: tournament.id,
        name: `Tournament ${id.slice(0, 8)}`,
        status: mapStatus(tournament.status),
        participant_count: tournament.participant_count,
        weight_class_filter: null,
        prize_description: null,
        scheduled_at: tournament.created_at,
        rounds_total: roundsTotal,
        current_round: currentRound,
        champion_bot_id: tournament.winner_bot_id,
        matches: mappedMatches,
        participants,
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
