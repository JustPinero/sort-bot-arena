import { SortBotApiError, type SortBotApiErrorBody } from './error.js';
import { nullInt, nullStr } from './unwrap.js';
import type {
  ApiBot,
  ApiUser,
  BattleResponse,
  BattleRun,
  BattleSummary,
  BotProfileResponse,
  BotRunsResponse,
  CreateBattleResponse,
  CreateUserResponse,
  HeadToHeadResponse,
  InputsResponse,
  LeaderboardResponse,
  PerInputLeaderboardResponse,
  StatsResponse,
  TournamentMatch,
  TournamentResponse,
  TournamentSummary,
} from './types.js';

interface ClientOptions {
  baseUrl: string;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type Query = Record<string, string | number | undefined> | undefined;

interface RequestOptions {
  method?: string;
  path: string;
  query?: Query;
  body?: unknown;
  apiKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  formData?: FormData;
}

export class SortBotApiClient {
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 15_000;
    // Resolve fetch lazily so test runners (MSW) that patch globalThis.fetch
    // after this client is instantiated still get intercepted.
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  private async request<T>(opts: RequestOptions): Promise<T> {
    const url = new URL(this.baseUrl + opts.path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {};
    if (opts.apiKey) headers['authorization'] = `Bearer ${opts.apiKey}`;

    let body: string | FormData | null = null;
    if (opts.formData) {
      body = opts.formData;
    } else if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('upstream timeout')),
      opts.timeoutMs ?? this.defaultTimeoutMs,
    );
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => controller.abort(opts.signal?.reason));
    }

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: opts.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      throw new SortBotApiError({
        status: 0,
        message: `network error calling ${opts.path}: ${(err as Error).message}`,
      });
    } finally {
      clearTimeout(timeout);
    }

    const requestId = res.headers.get('x-request-id') ?? undefined;
    const text = await res.text();

    if (!res.ok) {
      let parsed: SortBotApiErrorBody | string = text;
      try {
        parsed = JSON.parse(text) as SortBotApiErrorBody;
      } catch {
        // leave as text
      }
      const code = typeof parsed === 'object' ? parsed.code : undefined;
      const message =
        typeof parsed === 'object' && parsed.error
          ? parsed.error
          : `sort-bot-api ${res.status} on ${opts.path}`;
      throw new SortBotApiError({
        status: res.status,
        message,
        ...(code !== undefined && { code }),
        body: parsed,
        ...(requestId !== undefined && { requestId }),
      });
    }

    if (text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ---------- public unauthenticated ----------

  async createUser(body: { display_name: string; email: string }): Promise<CreateUserResponse> {
    return this.request<CreateUserResponse>({
      method: 'POST',
      path: '/v1/users',
      body,
    });
  }

  async getInputs(query?: { limit?: number; offset?: number }): Promise<InputsResponse> {
    return this.request<InputsResponse>({ path: '/v1/inputs', query });
  }

  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>({ path: '/v1/stats' });
  }

  async getLeaderboard(query?: {
    limit?: number;
    offset?: number;
    language?: string;
    incomplete?: 'include' | 'exclude';
  }): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>({ path: '/v1/leaderboard', query });
  }

  async getPerInputLeaderboard(inputId: number): Promise<PerInputLeaderboardResponse> {
    return this.request<PerInputLeaderboardResponse>({
      path: `/v1/leaderboard/inputs/${inputId}`,
    });
  }

  async getBot(id: string): Promise<ApiBot> {
    return this.request<ApiBot>({ path: `/v1/bots/${id}` });
  }

  async getBotProfile(id: string): Promise<BotProfileResponse> {
    return this.request<BotProfileResponse>({ path: `/v1/bots/${id}/profile` });
  }

  async getBotRuns(id: string, query?: { limit?: number; offset?: number }): Promise<BotRunsResponse> {
    const raw = await this.request<{
      bot_id: string;
      runs: Array<Record<string, unknown>>;
      total: number;
    }>({ path: `/v1/bots/${id}/runs`, query });
    return {
      bot_id: raw.bot_id,
      total: raw.total,
      runs: raw.runs.map((r) => ({
        id: r['id'] as number,
        bot_id: r['bot_id'] as string,
        input_id: r['input_id'] as number,
        run_number: r['run_number'] as number,
        status: r['status'] as string,
        duration_ms: nullInt(r['duration_ms']),
        cpu_ms: nullInt(r['cpu_ms']),
        error_msg: nullStr(r['error_msg']),
        started_at: r['started_at'] as string,
        completed_at: r['completed_at'] as string,
      })),
    };
  }

  async getBotRankHistory(id: string): Promise<{
    bot_id: string;
    count: number;
    history: Array<{
      bot_id: string;
      rank: number;
      score: number;
      snapshot_at: string;
      triggering_bot_id: string;
    }>;
  }> {
    return this.request({ path: `/v1/bots/${id}/rank-history` });
  }

  async getBotAnalysis(id: string): Promise<unknown> {
    return this.request({ path: `/v1/bots/${id}/analysis` });
  }

  async getBotBadgeSvg(id: string): Promise<string> {
    const url = `${this.baseUrl}/v1/bots/${id}/badge.svg`;
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      throw new SortBotApiError({
        status: res.status,
        message: `badge fetch ${res.status}`,
      });
    }
    return await res.text();
  }

  async getHeadToHead(a: string, b: string): Promise<HeadToHeadResponse> {
    return this.request<HeadToHeadResponse>({ path: `/v1/bots/${a}/vs/${b}` });
  }

  // ---------- authenticated ----------

  async getMe(apiKey: string): Promise<ApiUser> {
    return this.request<ApiUser>({ path: '/v1/users/me', apiKey });
  }

  async submitBot(
    apiKey: string,
    payload: { display_name: string; language: string; source: Blob | File },
  ): Promise<ApiBot> {
    const fd = new FormData();
    fd.append('display_name', payload.display_name);
    fd.append('language', payload.language);
    fd.append('source', payload.source as Blob);
    return this.request<ApiBot>({
      method: 'POST',
      path: '/v1/bots',
      apiKey,
      formData: fd,
    });
  }

  async patchBot(apiKey: string, id: string, body: { display_name: string }): Promise<ApiBot> {
    return this.request<ApiBot>({
      method: 'PATCH',
      path: `/v1/bots/${id}`,
      apiKey,
      body,
    });
  }

  async deleteBot(apiKey: string, id: string): Promise<void> {
    await this.request<void>({
      method: 'DELETE',
      path: `/v1/bots/${id}`,
      apiKey,
    });
  }

  async startBattle(
    apiKey: string,
    body: { bot_a: string; bot_b: string; input_ids?: number[]; count?: number },
  ): Promise<CreateBattleResponse> {
    return this.request<CreateBattleResponse>({
      method: 'POST',
      path: '/v1/battles',
      apiKey,
      body,
    });
  }

  async getBattle(id: string): Promise<BattleResponse> {
    const raw = await this.request<{
      battle: Record<string, unknown>;
      runs: Array<Record<string, unknown>>;
    }>({ path: `/v1/battles/${id}` });
    const battle: BattleSummary = {
      id: raw.battle['id'] as string,
      bot_a_id: raw.battle['bot_a_id'] as string,
      bot_b_id: raw.battle['bot_b_id'] as string,
      initiator_id: raw.battle['initiator_id'] as string,
      status: raw.battle['status'] as BattleSummary['status'],
      winner_bot_id: nullStr(raw.battle['winner_bot_id']),
      bot_a_wins: raw.battle['bot_a_wins'] as number,
      bot_b_wins: raw.battle['bot_b_wins'] as number,
      ties: raw.battle['ties'] as number,
      created_at: raw.battle['created_at'] as string,
      completed_at: nullStr(raw.battle['completed_at']),
    };
    const runs: BattleRun[] = raw.runs.map((r) => ({
      id: r['id'] as number,
      battle_id: r['battle_id'] as string,
      input_id: r['input_id'] as number,
      bot_a_duration_ms: nullInt(r['bot_a_duration_ms']),
      bot_b_duration_ms: nullInt(r['bot_b_duration_ms']),
      bot_a_status: r['bot_a_status'] as string,
      bot_b_status: r['bot_b_status'] as string,
      winner_bot_id: nullStr(r['winner_bot_id']),
      completed_at: r['completed_at'] as string,
    }));
    return { battle, runs };
  }

  async startTournament(
    apiKey: string,
    body: { participant_bot_ids?: string[]; top_n?: number; count?: number },
  ): Promise<{
    tournament_id: string;
    participant_count: number;
    status: string;
    created_at: string;
    bracket: unknown;
  }> {
    return this.request({
      method: 'POST',
      path: '/v1/tournaments',
      apiKey,
      body,
    });
  }

  async getTournament(id: string): Promise<TournamentResponse> {
    const raw = await this.request<{
      tournament: Record<string, unknown>;
      matches: Array<Record<string, unknown>>;
    }>({ path: `/v1/tournaments/${id}` });
    const tournament: TournamentSummary = {
      id: raw.tournament['id'] as string,
      initiator_id: raw.tournament['initiator_id'] as string,
      status: raw.tournament['status'] as TournamentSummary['status'],
      participant_count: raw.tournament['participant_count'] as number,
      winner_bot_id: nullStr(raw.tournament['winner_bot_id']),
      created_at: raw.tournament['created_at'] as string,
      completed_at: nullStr(raw.tournament['completed_at']),
    };
    const matches: TournamentMatch[] = raw.matches.map((m) => ({
      id: m['id'] as number,
      tournament_id: m['tournament_id'] as string,
      round: m['round'] as number,
      bracket_position: m['bracket_position'] as number,
      bot_a_id: nullStr(m['bot_a_id']),
      bot_b_id: nullStr(m['bot_b_id']),
      winner_bot_id: nullStr(m['winner_bot_id']),
      battle_id: nullStr(m['battle_id']),
      completed_at: nullStr(m['completed_at']),
    }));
    return { tournament, matches };
  }
}
