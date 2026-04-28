import { create } from 'zustand';

export interface BattleEvent {
  type: string;
  [key: string]: unknown;
}

interface BattleState {
  subscribedBattleId: string | null;
  events: BattleEvent[];
  subscribe: (battleId: string) => void;
  unsubscribe: () => void;
  pushEvent: (event: BattleEvent) => void;
  reset: () => void;
}

const initial = {
  subscribedBattleId: null,
  events: [] as BattleEvent[],
};

export const useBattleStore = create<BattleState>((set) => ({
  ...initial,
  subscribe: (battleId) => set({ subscribedBattleId: battleId, events: [] }),
  unsubscribe: () => set({ subscribedBattleId: null }),
  pushEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  reset: () => set({ ...initial }),
}));
