import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { ApiError, apiClient } from './client';
import { config } from './config';
import { retryNon4xx } from './error-helpers';
import {
  AchievementDefinitionSchema,
  AnalysisResponseSchema,
  BattleSchema,
  BotRunSchema,
  BotSchema,
  BotSnapshotSchema,
  CreateTournamentResponseSchema,
  CursorPageSchema,
  HomeSnapshotSchema,
  InputPerformanceSchema,
  InputSummarySchema,
  LeaderboardEntrySchema,
  PerInputLeaderboardEntrySchema,
  SessionUserSchema,
  SubmitBotResponseSchema,
  TournamentSchema,
} from './schemas';

import type { HealthResponseSchema } from './schemas';
import type {
  CursorPage,
  InputSummary,
  LeaderboardEntry,
  LeaderboardFilters,
  PerInputLeaderboardEntry,
} from './types';

// `/api/healthz` returns `text/plain "ok"` on the deployed server, not JSON.
// We synthesize the historical `{status: 'ok'}` shape from a 200 response so
// callers (and `HealthResponseSchema`) keep working unchanged.
async function pingHealth(): Promise<z.infer<typeof HealthResponseSchema>> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/api/healthz`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (err) {
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: err instanceof Error ? err.message : 'unknown network error',
      retryable: true,
    });
  }
  if (!response.ok) {
    let errorMessage = response.statusText || 'request failed';
    let code = `http_${response.status}`;
    try {
      const envelope = (await response.json()) as { error?: string; code?: string };
      if (envelope.code) code = envelope.code;
      else if (envelope.error) code = envelope.error;
      if (envelope.error) errorMessage = envelope.error;
    } catch {
      // body may not be JSON; fall through with statusText
    }
    throw new ApiError({
      status: response.status,
      code,
      message: errorMessage,
      requestId: response.headers.get('X-Request-Id') ?? undefined,
      retryable: response.status >= 500,
    });
  }
  return { status: 'ok' };
}

export function usePing() {
  return useQuery({
    queryKey: ['health'],
    queryFn: pingHealth,
    staleTime: 30 * 1000,
  });
}

export function useBot(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId],
    queryFn: () => apiClient.get(`/api/v1/bots/${botId}`, { schema: BotSchema }),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
    retry: retryNon4xx,
  });
}

interface UseBotRunsOptions {
  cursor?: string;
  limit?: number;
}

const BotRunsPageSchema = CursorPageSchema(BotRunSchema);

export function useBotRuns(botId: string | undefined, opts?: UseBotRunsOptions) {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const suffix = params.toString();
  const path = `/api/v1/bots/${botId}/runs${suffix ? `?${suffix}` : ''}`;

  return useQuery({
    queryKey: ['bots', botId, 'runs', opts?.cursor ?? null, opts?.limit ?? null],
    queryFn: () => apiClient.get(path, { schema: BotRunsPageSchema }),
    enabled: Boolean(botId),
    staleTime: 60 * 1000,
  });
}

const BotSnapshotsSchema = z.array(BotSnapshotSchema);

export function useBotSnapshots(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId, 'snapshots'],
    queryFn: () => apiClient.get(`/api/v1/bots/${botId}/snapshots`, { schema: BotSnapshotsSchema }),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

const InputPerformanceListSchema = z.array(InputPerformanceSchema);

export function useBotInputPerformance(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId, 'inputs'],
    queryFn: () =>
      apiClient.get(`/api/v1/bots/${botId}/inputs`, { schema: InputPerformanceListSchema }),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotAnalysis(botId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bots', botId, 'analysis'],
    queryFn: () =>
      apiClient.get(`/api/v1/bots/${botId}/analysis`, { schema: AnalysisResponseSchema }),
    enabled: Boolean(botId) && (opts?.enabled ?? true),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

function leaderboardPath(filters: LeaderboardFilters): string {
  const params = new URLSearchParams();
  if (filters.weight !== 'all') params.set('weight', filters.weight);
  if (filters.activity !== 'all') params.set('activity', filters.activity);
  if (filters.language) params.set('language', filters.language);
  if (filters.sort !== 'rank') params.set('sort', filters.sort);
  const suffix = params.toString();
  return `/api/v1/leaderboard${suffix ? `?${suffix}` : ''}`;
}

export interface LeaderboardResponse extends CursorPage<LeaderboardEntry> {
  stale?: boolean;
  stale_age_ms?: number;
}

const LeaderboardResponseSchema = CursorPageSchema(LeaderboardEntrySchema).extend({
  stale: z.boolean().optional(),
  stale_age_ms: z.number().optional(),
});

export function useLeaderboard(filters: LeaderboardFilters) {
  return useQuery({
    queryKey: ['leaderboard', filters],
    queryFn: () => apiClient.get(leaderboardPath(filters), { schema: LeaderboardResponseSchema }),
    staleTime: 60 * 1000,
  });
}

export interface PerInputLeaderboardResponse {
  input: InputSummary;
  items: PerInputLeaderboardEntry[];
  next_cursor: string | null;
}

const PerInputLeaderboardResponseSchema = z
  .object({
    input: InputSummarySchema,
    items: z.array(PerInputLeaderboardEntrySchema),
    next_cursor: z.string().nullable(),
  })
  .passthrough();

export function usePerInputLeaderboard(inputId: string | undefined) {
  return useQuery({
    queryKey: ['leaderboard', 'inputs', inputId],
    queryFn: () =>
      apiClient.get(`/api/v1/leaderboard/inputs/${inputId}`, {
        schema: PerInputLeaderboardResponseSchema,
      }),
    enabled: Boolean(inputId),
    staleTime: 60 * 1000,
    retry: retryNon4xx,
  });
}

const InputsPageSchema = CursorPageSchema(InputSummarySchema);

export function useInputs() {
  return useQuery({
    queryKey: ['inputs'],
    queryFn: () => apiClient.get('/api/v1/inputs', { schema: InputsPageSchema }),
    staleTime: 5 * 60 * 1000,
  });
}

const BattlesPageSchema = CursorPageSchema(BattleSchema);

export function useBattles() {
  return useQuery({
    queryKey: ['battles'],
    queryFn: () => apiClient.get('/api/v1/battles', { schema: BattlesPageSchema }),
    staleTime: 30 * 1000,
  });
}

export function useBattle(battleId: string | undefined) {
  return useQuery({
    queryKey: ['battles', battleId],
    queryFn: () => apiClient.get(`/api/v1/battles/${battleId}`, { schema: BattleSchema }),
    enabled: Boolean(battleId),
    staleTime: 30 * 1000,
    retry: retryNon4xx,
  });
}

export interface SubmitBotInput {
  display_name: string;
  language: string;
  source: string;
  filename: string;
}

export function useSubmitBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitBotInput) => {
      // Backend Phase 5 will accept multipart; JSON works for now (sort-bot-api's
      // OpenAPI will dictate the wire format once it ships).
      return apiClient.post('/api/v1/bots', input, { schema: SubmitBotResponseSchema });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'bots'] });
    },
  });
}

const BotListSchema = z.array(BotSchema);

export function useMyBots() {
  return useQuery({
    queryKey: ['users', 'me', 'bots'],
    queryFn: () => apiClient.get('/api/v1/users/me/bots', { schema: BotListSchema }),
    staleTime: 60 * 1000,
  });
}

export function useRetireBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) =>
      apiClient.patch(`/api/v1/bots/${botId}`, { retired: true }, { schema: BotSchema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'bots'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export interface StartBattleInput {
  bot_a: string;
  bot_b: string;
  input_ids?: string[];
  count?: number;
}

export interface StartBattleResponse {
  battle_id: string;
}

const StartBattleResponseSchema = z.object({ battle_id: z.string() }).passthrough();

export function useStartBattle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartBattleInput) =>
      apiClient.post('/api/v1/battles', input, { schema: StartBattleResponseSchema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battles'] });
    },
  });
}

export interface UploadInputInput {
  values: number[];
  format: 'comma' | 'space' | 'newline';
  display_name?: string;
}

export function useUploadInput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadInputInput) =>
      apiClient.post('/api/v1/inputs', input, { schema: InputSummarySchema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inputs'] });
    },
  });
}

const TournamentsPageSchema = CursorPageSchema(TournamentSchema);

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: () => apiClient.get('/api/v1/tournaments', { schema: TournamentsPageSchema }),
    staleTime: 60 * 1000,
  });
}

export interface StartTournamentInput {
  participant_bot_ids: string[];
  count: number;
  // Slice 9 frontend records these client-side; server-side persistence
  // of bracket_size + input_mode on `recent_tournaments` is a follow-up
  // (sort-bot-api doesn't surface them today). Fields are still POSTed
  // so the server slice can pick them up without another contract change.
  bracket_size: number;
  input_mode: 'flat_random' | 'escalation';
}

export function useStartTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    // Slice D4 — server now returns the clean `{tournament_id, status}`
    // envelope (CreateTournamentResponseSchema). The rich `Tournament`
    // shape is fetched by `useTournament(id)` on the bracket page after
    // the redirect; this resolves the B6-flagged contract drift.
    mutationFn: (input: StartTournamentInput) =>
      apiClient.post('/api/v1/tournaments', input, { schema: CreateTournamentResponseSchema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: ['tournaments', id],
    queryFn: () => apiClient.get(`/api/v1/tournaments/${id}`, { schema: TournamentSchema }),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
    retry: retryNon4xx,
  });
}

export function useHomeSnapshot() {
  return useQuery({
    queryKey: ['feed', 'snapshot'],
    queryFn: () => apiClient.get('/api/v1/feed/snapshot', { schema: HomeSnapshotSchema }),
    staleTime: 30 * 1000,
  });
}

export function useHallOfFame() {
  return useQuery({
    queryKey: ['halloffame'],
    queryFn: () => apiClient.get('/api/v1/halloffame', { schema: BotListSchema }),
    staleTime: 5 * 60 * 1000,
  });
}

export interface SignupInput {
  display_name: string;
  email: string;
  password: string;
}

export function useSignup() {
  return useMutation({
    mutationFn: (input: SignupInput) =>
      apiClient.post('/api/v1/auth/signup', input, { schema: SessionUserSchema }),
  });
}

export interface LoginInput {
  email: string;
  password: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiClient.post('/api/v1/auth/login', input, { schema: SessionUserSchema }),
  });
}

const AchievementDefinitionListSchema = z.array(AchievementDefinitionSchema);

export function useAchievementsCatalog() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: () =>
      apiClient.get('/api/v1/achievements', { schema: AchievementDefinitionListSchema }),
    staleTime: 5 * 60 * 1000,
  });
}
