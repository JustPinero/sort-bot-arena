import { Hono } from 'hono';

import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import { listRecent as listRecentTournaments } from '../store/recent-tournaments.js';

import type { AppContext } from '../auth/middleware.js';
import type {
  ApiBot,
  SortBotApiClient,
  TournamentMatch as UpstreamMatch,
  TournamentSummary,
} from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';
import type { Client } from '@libsql/client';

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
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // Slice 7: cursor-paginated history page backed by recent_tournaments.
  // - default page size 20, ?limit=N to override (capped at 100)
  // - ?before=<created_at ISO> for the next page (plain stateless cursor)
  // - ?initiator_user_id=<id> to scope to a single user
  // - order: created_at DESC
  //
  // Trim decision: list rows return `participants: []` and `matches: []`
  // to skip the per-row upstream fan-out (a single tournament's detail
  // call hits sort-bot-api getBot up to 12 times — N rows on a list
  // page would be N*12 fan-out, unacceptable for a history page). The
  // detail endpoint GET /:id below still hydrates fully. The frontend
  // type `Tournament` (src/api/types.ts:210-223) declares both fields
  // as arrays, so empty arrays are type-compatible.
  r.get('/', async (c) => {
    const url = new URL(c.req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? '20');
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20));
    const before = url.searchParams.get('before') ?? undefined;
    const initiatorUserId = url.searchParams.get('initiator_user_id') ?? undefined;

    const rows = await listRecentTournaments(deps.db, {
      limit: limit + 1,
      ...(before !== undefined ? { before } : {}),
      ...(initiatorUserId !== undefined ? { initiatorUserId } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;

    const items: Tournament[] = page.map((row) => ({
      id: row.tournament_id,
      name: `Tournament ${row.tournament_id.slice(0, 8)}`,
      status: mapStatus(row.status),
      participant_count: row.participant_count,
      weight_class_filter: null,
      prize_description: null,
      scheduled_at: row.created_at,
      rounds_total: 0,
      current_round: 0,
      champion_bot_id: row.winner_bot_id,
      // Trim per the decision above — detail page hydrates these.
      matches: [],
      participants: [],
    }));

    return c.json({ items, next_cursor: nextCursor });
  });

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
