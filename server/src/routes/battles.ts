import { randomBytes } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { getUser, requireAuth } from '../auth/middleware.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import {
  claimPair,
  getWeightClassByBattleId,
  listRecent,
  markFailed,
  markRunning,
  pairKey,
  reassignBattleId,
} from '../store/recent-battles.js';
import { weightClassFor, type SizeClass } from '../synthesize/battle-class.js';
import { synthesizeBattleFromRow } from '../synthesize/battle.js';

import type { AppContext } from '../auth/middleware.js';
import type {
  ApiBot,
  BattleResponse,
  BattleRun,
  SortBotApiClient,
} from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';
import type { Client } from '@libsql/client';

type Corner = 'red' | 'blue';
type BattleStatus = 'pre_fight' | 'live' | 'completed';
type BattleOutcome = 'ko' | 'tko' | 'decision' | 'draw' | 'no_contest';
type WeightClass = 'sparring' | 'exhibition' | 'title_fight';

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
  weight_class: WeightClass | null;
}

function buildFighter(bot: ApiBot, persona: BotPersonaRow | null, corner: Corner): BattleFighter {
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

function deriveOutcome(battle: BattleResponse['battle'], runs: BattleRun[]): BattleOutcome | null {
  if (battle.status !== 'complete' && battle.status !== 'failed') return null;
  if (battle.winner_bot_id === null) return 'draw';
  const allKo =
    runs.length > 0 &&
    runs.every((run) => {
      return run.bot_a_status !== 'success' || run.bot_b_status !== 'success';
    });
  if (allKo) return 'ko';
  return 'decision';
}

function countCompletedRuns(runs: BattleRun[]): number {
  return runs.filter((r) => r.winner_bot_id !== null || r.completed_at).length;
}

const startBattleSchema = z.object({
  bot_a: z.string().min(1),
  bot_b: z.string().min(1),
  input_ids: z.array(z.number().int()).optional(),
  count: z.number().int().positive().optional(),
});

function placeholderBattleId(): string {
  return 'pend_' + randomBytes(16).toString('hex');
}

export function battlesRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
  sessionSecret: string;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // Slice 7: cursor-paginated history page backed by recent_battles.
  // - default page size 20, ?limit=N to override (capped at 100)
  // - ?before=<created_at ISO> for the next page (plain stateless cursor)
  // - ?initiator_user_id=<id> to scope to a single user; absent → public list
  // - order: created_at DESC
  // For each row we fan out to upstream getBot + persona.get to hydrate
  // fighter_a/fighter_b. Per-page worst case: 2*limit upstream getBot calls.
  // We do *not* call sort-bot-api getBattle per row — see
  // synthesize/battle.ts:synthesizeBattleFromRow for what we trade for that
  // (rounds_total/current_round default to 0, outcome defaults to
  // 'decision' for completed battles).
  r.get('/', async (c) => {
    const url = new URL(c.req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? '20');
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20));
    const before = url.searchParams.get('before') ?? undefined;
    const initiatorUserId = url.searchParams.get('initiator_user_id') ?? undefined;

    const rows = await listRecent(deps.db, {
      limit: limit + 1,
      ...(before !== undefined ? { before } : {}),
      ...(initiatorUserId !== undefined ? { initiatorUserId } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;

    const items = await Promise.all(
      page.map(async (row) => {
        const [botA, botB, personaA, personaB] = await Promise.all([
          deps.sortBotApi.getBot(row.bot_a_id).catch(() => null),
          deps.sortBotApi.getBot(row.bot_b_id).catch(() => null),
          deps.persona.get(row.bot_a_id).catch(() => null),
          deps.persona.get(row.bot_b_id).catch(() => null),
        ]);
        // If upstream getBot fails for a fighter, fall back to a stub
        // ApiBot so the row still renders rather than 502'ing the whole
        // page over a single missing bot.
        const fallbackBot = (id: string): ApiBot => ({
          id,
          user_id: '',
          display_name: id,
          language: 'python',
          source_size_bytes: 0,
          source_sha256: '',
          status: 'evaluated',
          submitted_at: row.created_at,
        });
        return synthesizeBattleFromRow({
          row,
          fighters: { a: botA ?? fallbackBot(row.bot_a_id), b: botB ?? fallbackBot(row.bot_b_id) },
          personas: { a: personaA, b: personaB },
        });
      }),
    );

    return c.json({ items, next_cursor: nextCursor });
  });

  r.post('/', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const parsed = startBattleSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'bad_field', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;
    const pair = pairKey(body.bot_a, body.bot_b);
    const now = new Date();
    const oneHourAgoISO = new Date(now.getTime() - 60 * 60_000).toISOString();
    const placeholderId = placeholderBattleId();

    // Slice 5: derive the weight_class label from the input size_classes
    // when input_ids is supplied explicitly. In `count` mode the upstream
    // API picks the inputs after we've POSTed, so we can't know which
    // size_classes will be selected — persist null in that case.
    let weightClass: WeightClass | null = null;
    if (body.input_ids && body.input_ids.length > 0) {
      try {
        const inputs = await deps.sortBotApi.getInputs({ limit: 1000 });
        const byId = new Map<number, SizeClass>(
          inputs.inputs.map((i) => [i.id, i.size_class as SizeClass]),
        );
        const sizeClasses = body.input_ids
          .map((id) => byId.get(id))
          .filter((sc): sc is SizeClass => sc !== undefined);
        weightClass = weightClassFor(sizeClasses);
      } catch {
        // If we can't resolve size_classes (upstream blip / breaker open),
        // fall back to null rather than failing the battle creation.
        weightClass = null;
      }
    }

    // Atomic claim: runs Rule 1 + Rule 2 + INSERT pending under a per-pair
    // in-process lock so concurrent POSTs for the same pair serialize and
    // exactly one reaches upstream. See store/recent-battles.ts for the
    // why-not-libsql-transactions writeup.
    const claim = await claimPair(
      deps.db,
      {
        battle_id: placeholderId,
        bot_a_id: body.bot_a,
        bot_b_id: body.bot_b,
        pair_key: pair,
        initiator_user_id: me.id,
        weight_class: weightClass,
      },
      oneHourAgoISO,
      3,
    );
    if (claim.kind === 'busy') {
      const created = new Date(claim.created_at);
      const elapsed = Math.floor((now.getTime() - created.getTime()) / 1000);
      const retryAfter = Math.max(1, 60 - elapsed);
      return c.json(
        { error: 'pair_busy', detail: 'A battle for this pair is already running' },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }
    if (claim.kind === 'cooldown') {
      const oldest = new Date(claim.oldest_created_at);
      const oldestElapsed = Math.floor((now.getTime() - oldest.getTime()) / 1000);
      const retryAfter = Math.max(1, 3600 - oldestElapsed);
      return c.json(
        { error: 'pair_cooldown', detail: '3 battles per hour per matchup limit reached' },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }

    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);
    const startArgs: { bot_a: string; bot_b: string; input_ids?: number[]; count?: number } = {
      bot_a: body.bot_a,
      bot_b: body.bot_b,
    };
    if (body.input_ids !== undefined) startArgs.input_ids = body.input_ids;
    if (body.count !== undefined) startArgs.count = body.count;
    try {
      const upstream = await deps.sortBotApi.startBattle(apiKey, startArgs);
      // sort-bot-api generates its own battle_id — reassign our PK to the
      // upstream id so subsequent GET /api/v1/battles/:id queries find the
      // row we just inserted. SQLite/libsql allows updating the PK as long
      // as no FK references it (none in this schema).
      await reassignBattleId(deps.db, placeholderId, upstream.battle_id);
      await markRunning(deps.db, upstream.battle_id);
      return c.json(upstream);
    } catch (err) {
      await markFailed(deps.db, placeholderId).catch(() => {
        // best-effort: failure to mark failed shouldn't override the
        // upstream-error response we owe the caller.
      });
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
      const { battle, runs } = await deps.sortBotApi.getBattle(id);
      const [botA, botB, personaA, personaB, weightClassRaw] = await Promise.all([
        deps.sortBotApi.getBot(battle.bot_a_id),
        deps.sortBotApi.getBot(battle.bot_b_id),
        deps.persona.get(battle.bot_a_id).catch(() => null),
        deps.persona.get(battle.bot_b_id).catch(() => null),
        getWeightClassByBattleId(deps.db, battle.id).catch(() => null),
      ]);

      const status = mapStatus(battle.status);
      const roundsTotal = runs.length;
      const currentRound =
        battle.status === 'complete' || battle.status === 'failed'
          ? runs.length
          : countCompletedRuns(runs);

      // Validate the persisted column against the WeightClass union — if
      // a stale row holds an unexpected string, prefer null over leaking
      // an invalid label to the frontend.
      const weightClass: WeightClass | null =
        weightClassRaw === 'sparring' ||
        weightClassRaw === 'exhibition' ||
        weightClassRaw === 'title_fight'
          ? weightClassRaw
          : null;

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
        weight_class: weightClass,
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
