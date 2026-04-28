import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface HealthResponse {
  status: string;
}

export function usePing() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/healthz', { skipAuth: true }),
    staleTime: 30 * 1000,
  });
}
