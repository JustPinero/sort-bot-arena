import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useEligibleFighters } from './eligible-fighters';

import type { LeaderboardEntry } from './types';

vi.mock('./queries', () => ({
  useLeaderboard: vi.fn(),
}));

import { useLeaderboard } from './queries';

const mockedUseLeaderboard = vi.mocked(useLeaderboard);

function makeEntry(overrides: { bot_id: string; retired?: boolean; rank?: number }): LeaderboardEntry {
  return {
    bot_id: overrides.bot_id,
    rank: overrides.rank ?? 1,
    trend: 'steady',
    display_name: overrides.bot_id,
    nickname: null,
    language: 'python',
    portrait_url: null,
    record: { wins: 0, losses: 0, draws: 0 },
    ko_percentage: 0,
    signature_input: null,
    last_fight_at: null,
    retired: overrides.retired ?? false,
  } as LeaderboardEntry;
}

function mockQuery(state: {
  items?: LeaderboardEntry[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  // Cast through unknown — we only consume a tiny surface of UseQueryResult.
  mockedUseLeaderboard.mockReturnValue({
    data: state.items ? { items: state.items, next_cursor: null } : undefined,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  } as unknown as ReturnType<typeof useLeaderboard>);
}

describe('useEligibleFighters', () => {
  it('filters out retired bots', () => {
    mockQuery({
      items: [
        makeEntry({ bot_id: 'a' }),
        makeEntry({ bot_id: 'b', retired: true }),
        makeEntry({ bot_id: 'c' }),
      ],
    });
    const { result } = renderHook(() => useEligibleFighters());
    expect(result.current.fighters).toHaveLength(2);
    expect(result.current.fighters.map((f) => f.bot_id)).toEqual(['a', 'c']);
  });

  it('hasEnough returns true at the threshold and false above it', () => {
    mockQuery({
      items: [
        makeEntry({ bot_id: '1' }),
        makeEntry({ bot_id: '2' }),
        makeEntry({ bot_id: '3' }),
        makeEntry({ bot_id: '4' }),
        makeEntry({ bot_id: '5' }),
      ],
    });
    const { result } = renderHook(() => useEligibleFighters());
    expect(result.current.fighters).toHaveLength(5);
    expect(result.current.hasEnough(5)).toBe(true);
    expect(result.current.hasEnough(6)).toBe(false);
  });

  it('reports isLoading with empty fighters and hasEnough false for any positive n', () => {
    mockQuery({ isLoading: true });
    const { result } = renderHook(() => useEligibleFighters());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.fighters).toEqual([]);
    expect(result.current.hasEnough(1)).toBe(false);
    expect(result.current.hasEnough(8)).toBe(false);
  });

  it('reports isError with empty fighters', () => {
    mockQuery({ isError: true });
    const { result } = renderHook(() => useEligibleFighters());
    expect(result.current.isError).toBe(true);
    expect(result.current.fighters).toEqual([]);
  });
});
