import { useMemo } from 'react';

import { useLeaderboard } from './queries';

import type { LeaderboardEntry } from './types';

export interface UseEligibleFightersResult {
  fighters: LeaderboardEntry[];
  isLoading: boolean;
  isError: boolean;
  hasEnough: (n: number) => boolean;
}

/**
 * Shared "all evaluated, non-retired bots" pool used by every match/tournament
 * setup surface. Centralizes the filter so eligibility rules can evolve in one
 * place instead of being duplicated across modals.
 */
export function useEligibleFighters(): UseEligibleFightersResult {
  const query = useLeaderboard({
    weight: 'all',
    activity: 'all',
    language: null,
    sort: 'rank',
  });

  const fighters = useMemo(
    () => (query.data?.items ?? []).filter((entry) => !entry.retired),
    [query.data?.items],
  );

  return {
    fighters,
    isLoading: query.isLoading,
    isError: query.isError,
    hasEnough: (n: number) => fighters.length >= n,
  };
}
