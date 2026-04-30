export const CACHE_TTL_MS = {
  leaderboard: 5 * 60_000,
  stats: 5 * 60_000,
  inputs: 60 * 60_000,
} as const;

export const CACHE_PRUNE_INTERVAL_MS = 6 * 60 * 60_000;
