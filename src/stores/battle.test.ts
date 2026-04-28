import { beforeEach, describe, expect, it } from 'vitest';

import { useBattleStore } from './battle';

describe('useBattleStore', () => {
  beforeEach(() => {
    useBattleStore.getState().reset();
  });

  it('starts unsubscribed with no events', () => {
    const s = useBattleStore.getState();
    expect(s.subscribedBattleId).toBeNull();
    expect(s.events).toEqual([]);
  });

  it('subscribe sets the battle id and clears prior events', () => {
    useBattleStore.getState().pushEvent({ type: 'stale' });
    useBattleStore.getState().subscribe('bat_xyz');
    const s = useBattleStore.getState();
    expect(s.subscribedBattleId).toBe('bat_xyz');
    expect(s.events).toEqual([]);
  });

  it('pushEvent appends to the log', () => {
    useBattleStore.getState().subscribe('bat_xyz');
    useBattleStore.getState().pushEvent({ type: 'round_start', round: 1 });
    useBattleStore.getState().pushEvent({ type: 'round_end', round: 1, winner: 'a' });
    expect(useBattleStore.getState().events).toHaveLength(2);
  });
});
