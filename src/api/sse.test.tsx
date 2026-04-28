import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBattleEvents } from './sse';

describe('useBattleEvents', () => {
  it('returns idle initial state when disabled', () => {
    const { result } = renderHook(() =>
      useBattleEvents('bat_x', { fighterAId: 'a', fighterBId: 'b', enabled: false }),
    );
    expect(result.current.events).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.derived.status).toBe('pre_fight');
  });

  it('returns idle initial state when battleId is undefined', () => {
    const { result } = renderHook(() =>
      useBattleEvents(undefined, { fighterAId: 'a', fighterBId: 'b' }),
    );
    expect(result.current.events).toEqual([]);
    expect(result.current.connected).toBe(false);
  });
});
