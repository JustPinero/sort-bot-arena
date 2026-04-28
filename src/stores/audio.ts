import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioState {
  enabled: boolean;
  masterVolume: number;
  walkoutCuesEnabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setWalkoutCues: (enabled: boolean) => void;
}

const defaultEnabled = import.meta.env.VITE_ENABLE_AUDIO_BY_DEFAULT === 'true';

const initial = {
  enabled: defaultEnabled,
  masterVolume: 0.6,
  walkoutCuesEnabled: true,
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      ...initial,
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ masterVolume: Math.max(0, Math.min(1, volume)) }),
      setWalkoutCues: (enabled) => set({ walkoutCuesEnabled: enabled }),
    }),
    { name: 'sort-arena.audio' },
  ),
);
