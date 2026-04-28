import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  apiKey: string | null;
  userId: string | null;
  displayName: string | null;
  guestProvisioned: boolean;
  claimed: boolean;
  setKey: (apiKey: string, userId: string, displayName: string) => void;
  markClaimed: (displayName: string) => void;
  clear: () => void;
}

const initial = {
  apiKey: null,
  userId: null,
  displayName: null,
  guestProvisioned: false,
  claimed: false,
} as const;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initial,
      setKey: (apiKey, userId, displayName) =>
        set({ apiKey, userId, displayName, guestProvisioned: true }),
      markClaimed: (displayName) => set({ displayName, claimed: true }),
      clear: () => set({ ...initial }),
    }),
    {
      name: 'sort-arena.auth',
      partialize: (state) => ({
        apiKey: state.apiKey,
        userId: state.userId,
        displayName: state.displayName,
        guestProvisioned: state.guestProvisioned,
        claimed: state.claimed,
      }),
    },
  ),
);
