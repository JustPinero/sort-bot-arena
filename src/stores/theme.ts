import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ThemeMode } from '@/lib/theme';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'sort-arena.theme' },
  ),
);
