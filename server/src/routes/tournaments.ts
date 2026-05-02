import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { getUser, requireAuth } from '../auth/middleware.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { log } from '../lib/log.js';
import { nicknameFor } from '../persona/nicknames.js';
import {
  getById as getRecentTournamentById,
  listRecent as listRecentTournaments,
  recordTournament,
  type RecentTournamentRow,
} from '../store/recent-tournaments.js';
import {
  insertInitialMatches,
  listAllForTournament,
  type TournamentMatchRow,
} from '../store/tournament-matches.js';
import { buildInitialBracket, type BracketSize } from '../synthesize/bracket.js';

import type { AppContext } from '../auth/middleware.js';
import type {
  ApiBot,
  SortBotApiClient,
  TournamentSummary,
} from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';
import type { Client } from '@libsql/client';

// Slice D4 — Structural type for the orchestrator handle the route
// holds. Lets tests pass a spy/stub without standing up the full
// orchestrator core. `advanceMatch` is exposed so the test-only
// `/api/test/advance-match` endpoint (slice D5/G6) can drive the
// listener path without spinning up the actual SSE listener.
export interface OrchestratorHandle {
  schedule(tournamentId: string): Promise<void>;
  advanceMatch(matchRow: {
    match_id: string;
    tournament_id: string;
    round: number;
    bracket_position: number;
    bot_a_id: string | null;
    bot_b_id: string | null;
    battle_id: string | null;
    status: 'pending' | 'in_flight' | 'complete' | 'failed' | 'bye';
    winner_bot_id: string | null;
    scheduled_at: string | null;
    completed_at: string | null;
  }): Promise<void>;
}

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

// Slice D5 — tournament_matches uses a richer 5-state machine
// (pending/in_flight/complete/failed/bye) while the FE Tournament
// schema's match status is the 4-state {pending, live, completed, bye}.
// Mapping rules:
//   - 'in_flight' → 'live' (battle running upstream)
//   - 'complete'  → 'completed' (winner_bot_id populated)
//   - 'failed'    → 'completed' with no winner; the FE doesn't render
//                   a separate "failed" indicator and the bracket-level
//                   status='failed' on recent_tournaments tells the user
//                   the tournament itself didn't finish.
//   - 'bye' / 'pending' pass through verbatim.
function mapMatchStatus(status: TournamentMatchRow['status']): MatchStatus {
  if (status === 'in_flight') return 'live';
  if (status === 'complete' || status === 'failed') return 'completed';
  return status;
}

// Total rounds is fixed by bracket_size, not by how many rows have been
// materialized in tournament_matches yet. round 1 alone is seeded by
// `buildInitialBracket`; round 2+ rows are created lazily as winners
// advance. Computing from bracket_size keeps `rounds_total` stable on
// the bracket page from the moment a tournament is created.
function roundsTotalFor(bracketSize: number): number {
  if (bracketSize <= 1) return 0;
  return Math.ceil(Math.log2(bracketSize));
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

// Slice D5 — assembles the rich `Tournament` payload from our DB rows.
// Maps recent_tournaments + tournament_matches into the FE shape, fans
// out per-bot getBot+persona calls in parallel, and computes total/
// current round from bracket_size and the materialized match rows.
async function buildTournamentPayload(
  deps: { db: Client; sortBotApi: SortBotApiClient; persona: PersonaService },
  id: string,
  recent: RecentTournamentRow,
  matches: TournamentMatchRow[],
): Promise<Tournament> {
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

  const mappedMatches: TournamentMatch[] = matches.map((m) => ({
    id: m.match_id,
    round: m.round,
    position: m.bracket_position,
    fighter_a_bot_id: m.bot_a_id,
    fighter_b_bot_id: m.bot_b_id,
    winner_bot_id: m.winner_bot_id,
    status: mapMatchStatus(m.status),
    battle_id: m.battle_id,
  }));

  // Active round = highest round that already has at least one
  // non-pending match. A 4-bracket with both R1 matches in_flight =>
  // current_round=1; once both R1s complete and R2 is materialized
  // pending => still 1 until the final fires.
  const currentRound = matches.reduce((max, m) => {
    if (m.status === 'pending') return max;
    return Math.max(max, m.round);
  }, 0);

  const tournamentStatus: TournamentStatus =
    recent.status === 'pending'
      ? 'upcoming'
      : recent.status === 'running'
        ? 'active'
        : 'completed';

  return {
    id,
    name: `Tournament ${id.slice(0, 8)}`,
    status: tournamentStatus,
    participant_count: recent.participant_count,
    weight_class_filter: null,
    prize_description: null,
    scheduled_at: recent.created_at,
    rounds_total: roundsTotalFor(recent.bracket_size),
    current_round: currentRound,
    champion_bot_id: recent.winner_bot_id,
    matches: mappedMatches,
    participants,
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
  // Slice D4 — when present, the POST handler invokes
  // `orchestrator.schedule(tournamentId)` fire-and-forget after
  // recording the tournament + initial matches. Optional so existing
  // tests that don't care about scheduling can omit it.
  orchestrator?: OrchestratorHandle;
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

  // Slice 9.5 + Slice D4 — create a tournament. Validates the slice 9
  // body shape (bracket_size/input_mode), forwards the upstream-supported
  // subset to sort-bot-api, mirrors a row into `recent_tournaments`,
  // seeds the initial `tournament_matches` rows via `buildInitialBracket`,
  // and fire-and-forget invokes `orchestrator.schedule(...)` so the
  // bracket starts walking. Returns the clean envelope
  // `{tournament_id, status: 'pending'}` (Slice D4 contract — frontend
  // redirects to /tournaments/:id and pulls the rich shape from the
  // detail endpoint).
  //
  // Why fire-and-forget on `schedule`: the first round can fan out N
  // upstream battles + an `getInputs` call. Awaiting that here would
  // block the POST response on N round-trips and risk request timeouts
  // for a 12-bracket. The schedule loop runs in-process and completes
  // independently; if any single match fails, the orchestrator marks
  // the match + tournament `failed` (visible on the detail page).
  r.post(
    '/',
    requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }),
    async (c) => {
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

        // Seed initial bracket rows. `buildInitialBracket` is pure (no
        // db dependency) and validated upstream that the participant
        // count matches `bracket_size`.
        const initialMatches = buildInitialBracket(
          body.participant_bot_ids,
          body.bracket_size as BracketSize,
        );
        await insertInitialMatches(deps.db, upstream.tournament_id, initialMatches);

        // Fire-and-forget the first orchestrator tick. We catch + log
        // here so an unhandled rejection from the loop doesn't crash
        // the process; the tournament's `status='failed'` surface is
        // the user-facing signal of trouble.
        if (deps.orchestrator) {
          const tournamentId = upstream.tournament_id;
          deps.orchestrator.schedule(tournamentId).catch((err) => {
            log.warn(
              {
                tournament_id: tournamentId,
                err: err instanceof Error ? err.message : String(err),
              },
              'tournaments POST: orchestrator.schedule rejected',
            );
          });
        }

        return c.json({ tournament_id: upstream.tournament_id, status: 'pending' });
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
    },
  );

  // Slice D5 — read-side flips from upstream-driven to our-DB-driven.
  // The orchestrator (D3 + D4) is now the source of truth for bracket
  // state; reading from `tournament_matches` is what makes the bracket
  // page reflect orchestrator advancement (in_flight → completed →
  // next-round materialization). Upstream's `getTournament` is only
  // used as a fallback for legacy tournaments that have no row in our
  // `recent_tournaments` table.
  r.get('/:id', async (c) => {
    const id = c.req.param('id');

    const recent = await getRecentTournamentById(deps.db, id);
    if (recent) {
      const matches = await listAllForTournament(deps.db, id);
      return c.json(await buildTournamentPayload(deps, id, recent, matches));
    }

    // Legacy fallback — pre-D4 tournaments live only upstream.
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

      const mappedMatches: TournamentMatch[] = matches.map((m) => {
        const hasA = m.bot_a_id !== null;
        const hasB = m.bot_b_id !== null;
        const status: MatchStatus =
          m.winner_bot_id !== null
            ? 'completed'
            : hasA && hasB
              ? 'live'
              : hasA !== hasB
                ? 'bye'
                : 'pending';
        return {
          id: String(m.id),
          round: m.round,
          position: m.bracket_position,
          fighter_a_bot_id: m.bot_a_id,
          fighter_b_bot_id: m.bot_b_id,
          winner_bot_id: m.winner_bot_id,
          status,
          battle_id: m.battle_id,
        };
      });

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
