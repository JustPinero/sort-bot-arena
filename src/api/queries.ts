import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

import type {
  AnalysisResponse,
  Bot,
  BotRun,
  BotSnapshot,
  CursorPage,
  HealthResponse,
  InputPerformance,
} from './types';

export function usePing() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/healthz', { skipAuth: true }),
    staleTime: 30 * 1000,
  });
}

export function useBot(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId],
    queryFn: () => apiClient.get<Bot>(`/v1/bots/${botId}`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
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
  const path = `/v1/bots/${botId}/runs${suffix ? `?${suffix}` : ''}`;

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
    queryFn: () => apiClient.get<BotSnapshot[]>(`/v1/bots/${botId}/snapshots`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotInputPerformance(botId: string | undefined) {
  return useQuery({
    queryKey: ['bots', botId, 'inputs'],
    queryFn: () => apiClient.get<InputPerformance[]>(`/v1/bots/${botId}/inputs`),
    enabled: Boolean(botId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotAnalysis(botId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bots', botId, 'analysis'],
    queryFn: () => apiClient.get<AnalysisResponse>(`/v1/bots/${botId}/analysis`),
    enabled: Boolean(botId) && (opts?.enabled ?? true),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
