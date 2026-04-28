import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS, useLeaderboardFilters } from './useLeaderboardFilters';

function makeWrapper(initialEntry = '/') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useLeaderboardFilters', () => {
  it('returns defaults when no query params are set', () => {
    const { result } = renderHook(() => useLeaderboardFilters(), { wrapper: makeWrapper('/') });
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('parses weight, activity, sort, language from the URL', () => {
    const { result } = renderHook(() => useLeaderboardFilters(), {
      wrapper: makeWrapper('/?weight=lightweight&activity=week&sort=ko&language=python'),
    });
    expect(result.current.filters).toEqual({
      weight: 'lightweight',
      activity: 'week',
      sort: 'ko',
      language: 'python',
    });
  });

  it('falls back to defaults for unknown values', () => {
    const { result } = renderHook(() => useLeaderboardFilters(), {
      wrapper: makeWrapper('/?weight=junk&sort=garbage'),
    });
    expect(result.current.filters.weight).toBe('all');
    expect(result.current.filters.sort).toBe('rank');
  });

  it('setWeight updates the URL via setParams', () => {
    function Probe() {
      const filters = useLeaderboardFilters();
      const loc = useLocation();
      return (
        <button
          type="button"
          data-testid="set-weight"
          data-search={loc.search}
          onClick={() => filters.setWeight('heavyweight')}
        >
          go
        </button>
      );
    }
    const Wrapper = makeWrapper('/');
    const { result } = renderHook(() => useLeaderboardFilters(), { wrapper: Wrapper });
    act(() => result.current.setWeight('heavyweight'));
    expect(result.current.filters.weight).toBe('heavyweight');
    void Probe;
  });

  it('clearing back to "all" removes the param from the URL', () => {
    const { result } = renderHook(() => useLeaderboardFilters(), {
      wrapper: makeWrapper('/?weight=lightweight'),
    });
    act(() => result.current.setWeight('all'));
    expect(result.current.filters.weight).toBe('all');
  });
});
