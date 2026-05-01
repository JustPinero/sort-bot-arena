import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

import type {
  AchievementDefinition,
  AnalysisResponse,
  Battle,
  Bot,
  BotRun,
  BotSnapshot,
  CursorPage,
  HealthResponse,
  HomeSnapshot,
  InputPerformance,
  InputSummary,
  LeaderboardEntry,
  LeaderboardFilters,
  PerInputLeaderboardEntry,
  SubmitBotResponse,
  Tournament,
} from './types';

export function usePing() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/api/healthz', { skipAuth: true }),
    staleTime: 30 * 1000,
  });
}

export function useBot(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId],
    queryFn: () => apiClient.get<Bot>(`/api/v1/bots/${botId}`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      const status = (err as { status?: number } | null)?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
  });
}

interface UseBotRunsOptions {
  cursor?: string;
  limit?: number;
}

export function useBotRuns(botId: string | undefined, opts?: UseBotRunsOptions) {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const suffix = params.toString();
  const path = `/api/v1/bots/${botId}/runs${suffix ? `?${suffix}` : ''}`;

  return useQuery({
    queryKey: ['bots', botId, 'runs', opts?.cursor ?? null, opts?.limit ?? null],
    queryFn: () => apiClient.get<CursorPage<BotRun>>(path),
    enabled: Boolean(botId),
    staleTime: 60 * 1000,
  });
}

export function useBotSnapshots(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId, 'snapshots'],
    queryFn: () => apiClient.get<BotSnapshot[]>(`/api/v1/bots/${botId}/snapshots`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotInputPerformance(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId, 'inputs'],
    queryFn: () => apiClient.get<InputPerformance[]>(`/api/v1/bots/${botId}/inputs`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotAnalysis(botId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bots', botId, 'analysis'],
    queryFn: () => apiClient.get<AnalysisResponse>(`/api/v1/bots/${botId}/analysis`),
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

export function useLeaderboard(filters: LeaderboardFilters) {
  return useQuery({
    queryKey: ['leaderboard', filters],
    queryFn: () => apiClient.get<LeaderboardResponse>(leaderboardPath(filters)),
    staleTime: 60 * 1000,
  });
}

export interface PerInputLeaderboardResponse {
  input: InputSummary;
  items: PerInputLeaderboardEntry[];
  next_cursor: string | null;
}

export function usePerInputLeaderboard(inputId: string | undefined) {
  return useQuery({
    queryKey: ['leaderboard', 'inputs', inputId],
    queryFn: () =>
      apiClient.get<PerInputLeaderboardResponse>(`/api/v1/leaderboard/inputs/${inputId}`),
    enabled: Boolean(inputId),
    staleTime: 60 * 1000,
    retry: (failureCount, err) => {
      const status = (err as { status?: number } | null)?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
  });
}

export function useInputs() {
  return useQuery({
    queryKey: ['inputs'],
    queryFn: () => apiClient.get<CursorPage<InputSummary>>('/api/v1/inputs'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBattles() {
  return useQuery({
    queryKey: ['battles'],
    queryFn: () => apiClient.get<CursorPage<Battle>>('/api/v1/battles'),
    staleTime: 30 * 1000,
  });
}

export function useBattle(battleId: string | undefined) {
  return useQuery({
    queryKey: ['battles', battleId],
    queryFn: () => apiClient.get<Battle>(`/api/v1/battles/${battleId}`),
    enabled: Boolean(battleId),
    staleTime: 30 * 1000,
    retry: (failureCount, err) => {
      const status = (err as { status?: number } | null)?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
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
      return apiClient.post<SubmitBotResponse>('/api/v1/bots', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'bots'] });
    },
  });
}

export function useMyBots() {
  return useQuery({
    queryKey: ['users', 'me', 'bots'],
    queryFn: () => apiClient.get<Bot[]>('/api/v1/users/me/bots'),
    staleTime: 60 * 1000,
  });
}

export function useRetireBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) => apiClient.patch<Bot>(`/api/v1/bots/${botId}`, { retired: true }),
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

export function useStartBattle() {
  return useMutation({
    mutationFn: (input: StartBattleInput) =>
      apiClient.post<StartBattleResponse>('/api/v1/battles', input),
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
    mutationFn: (input: UploadInputInput) => apiClient.post<InputSummary>('/api/v1/inputs', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inputs'] });
    },
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: () => apiClient.get<CursorPage<Tournament>>('/api/v1/tournaments'),
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
    mutationFn: (input: StartTournamentInput) =>
      apiClient.post<Tournament>('/api/v1/tournaments', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: ['tournaments', id],
    queryFn: () => apiClient.get<Tournament>(`/api/v1/tournaments/${id}`),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
    retry: (failureCount, err) => {
      const status = (err as { status?: number } | null)?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
  });
}

export function useHomeSnapshot() {
  return useQuery({
    queryKey: ['feed', 'snapshot'],
    queryFn: () => apiClient.get<HomeSnapshot>('/api/v1/feed/snapshot'),
    staleTime: 30 * 1000,
  });
}

export function useHallOfFame() {
  return useQuery({
    queryKey: ['halloffame'],
    queryFn: () => apiClient.get<Bot[]>('/api/v1/halloffame'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAchievementsCatalog() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: () => apiClient.get<AchievementDefinition[]>('/api/v1/achievements'),
    staleTime: 5 * 60 * 1000,
  });
}
