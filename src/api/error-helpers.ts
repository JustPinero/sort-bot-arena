import { ApiError } from './client';

export function apiErrorStatus(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}

export function retryNon4xx(failureCount: number, err: unknown): boolean {
  const status = apiErrorStatus(err);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}
