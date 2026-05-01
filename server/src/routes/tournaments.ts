import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { getUser, requireAuth } from '../auth/middleware.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import {
  listRecent as listRecentTournaments,
  recordTournament,
} from '../store/recent-tournaments.js';

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

function buildParticipant(bot: ApiBot, persona: BotPersonaRow | null): TournamentParticipant {
  return {
    bot_id: bot.id,
    nickname: persona?.nickname ?? nicknameFor(bot.id),
    display_name: bot.display_name,
    language: bot.language,
    portrait_url: persona?.portrait_url ?? null,
  };
}

// Slice 9.5 — body shape for POST /api/v1/tournaments.
//
// `bracket_size` is locked to the four bracket sizes from decisions row
// 6 (`references/bracket-math-and-tournament-flow.md`). `input_mode`
// captures whether the user picked flat random vs round-thematic
// escalation; sort-bot-api can't yet honor escalation per-match (see
// decisions row 3), so we persist the user's intent for analytics and
// only forward the upstream-supported subset (`participant_bot_ids`,
// `count`) to `POST /v1/tournaments`.
const startTournamentSchema = z
  .object({
    participant_bot_ids: z.array(z.string().min(1)),
    count: z.number().int().positive(),
    bracket_size: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]),
    input_mode: z.enum(['flat_random', 'escalation']),
  })
  .superRefine((val, ctx) => {
    if (val.participant_bot_ids.length !== val.bracket_size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participant_bot_ids'],
        message: `participant_bot_ids length (${val.participant_bot_ids.length}) must equal bracket_size (${val.bracket_size})`,
      });
    }
    if (new Set(val.participant_bot_ids).size !== val.participant_bot_ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participant_bot_ids'],
        message: 'participant_bot_ids must be distinct',
      });
    }
  });

export function tournamentsRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
  sessionSecret: string;
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

  // Slice 9.5 — create a tournament. Validates the slice 9 body shape
  // (bracket_size/input_mode), forwards the upstream-supported subset
  // to sort-bot-api, then mirrors a row into recent_tournaments so the
  // history list (slice 7) and analytics columns are populated. The
  // upstream response is returned verbatim so the frontend can redirect
  // on `tournament_id`.
  r.post('/', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const parsed = startTournamentSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'bad_field', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;
    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);
    try {
      const upstream = await deps.sortBotApi.startTournament(apiKey, {
        participant_bot_ids: body.participant_bot_ids,
        count: body.count,
      });
      await recordTournament(deps.db, {
        tournament_id: upstream.tournament_id,
        initiator_user_id: me.id,
        participant_count: body.participant_bot_ids.length,
        bracket_size: body.bracket_size,
        input_mode: body.input_mode,
        status: 'running',
      });
      return c.json(upstream);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        const status = err.status >= 500 ? 502 : err.status;
        return c.json(
          { error: 'upstream_failure', upstream_status: err.status, code: err.code },
          status as 502 | 400,
        );
      }
      throw err;
    }
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
