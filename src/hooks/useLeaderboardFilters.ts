import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type {
  ActivityFilter,
  LeaderboardFilters,
  LeaderboardSort,
  WeightClassFilter,
} from '@/api/types';

const WEIGHT_VALUES: WeightClassFilter[] = [
  'all',
  'heavyweight',
  'cruiserweight',
  'middleweight',
  'lightweight',
];
const ACTIVITY_VALUES: ActivityFilter[] = ['all', 'week', 'month'];
const SORT_VALUES: LeaderboardSort[] = ['rank', 'wins', 'ko', 'recent', 'alphabetical'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export const DEFAULT_FILTERS: LeaderboardFilters = {
  weight: 'all',
  activity: 'all',
  language: null,
  sort: 'rank',
};

export function useLeaderboardFilters(): {
  filters: LeaderboardFilters;
  setWeight: (w: WeightClassFilter) => void;
  setActivity: (a: ActivityFilter) => void;
  setSort: (s: LeaderboardSort) => void;
  setLanguage: (l: string | null) => void;
  resetFilters: () => void;
} {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<LeaderboardFilters>(() => {
    return {
      weight: pick(params.get('weight'), WEIGHT_VALUES, 'all'),
      activity: pick(params.get('activity'), ACTIVITY_VALUES, 'all'),
      sort: pick(params.get('sort'), SORT_VALUES, 'rank'),
      language: params.get('language'),
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<Record<keyof LeaderboardFilters, string | null>>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '' || value === 'all') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      // Don't set sort=rank explicitly; default stays clean.
      if (next.get('sort') === 'rank') next.delete('sort');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return {
    filters,
    setWeight: (w) => update({ weight: w }),
    setActivity: (a) => update({ activity: a }),
    setSort: (s) => update({ sort: s }),
    setLanguage: (l) => update({ language: l }),
    resetFilters: () => setParams(new URLSearchParams(), { replace: true }),
  };
}
