import { randomBytes } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { getUser, requireAuth } from '../auth/middleware.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import {
  claimPair,
  markFailed,
  markRunning,
  pairKey,
  reassignBattleId,
} from '../store/recent-battles.js';

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

  // List endpoint placeholder. sort-bot-api has no list endpoint today;
  // when we add a battles index in our DB this will paginate from there.
  r.get('/', (c) => c.json({ items: [], next_cursor: null }));

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

    // Atomic claim: runs Rule 1 + Rule 2 + INSERT pending under a per-pair
    // in-process lock so concurrent POSTs for the same pair serialize and
    // exactly one reaches upstream. See store/recent-battles.ts for the
    // why-not-libsql-transactions writeup.
    // weight_class is null for now (slice 5 will compute it).
    const claim = await claimPair(
      deps.db,
      {
        battle_id: placeholderId,
        bot_a_id: body.bot_a,
        bot_b_id: body.bot_b,
        pair_key: pair,
        initiator_user_id: me.id,
        weight_class: null,
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
