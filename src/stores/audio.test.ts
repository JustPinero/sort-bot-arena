import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useAudioStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts disabled with sane defaults', async () => {
    const { useAudioStore } = await import('./audio');
    const s = useAudioStore.getState();
    expect(s.enabled).toBe(false);
    expect(s.masterVolume).toBeGreaterThan(0);
    expect(s.masterVolume).toBeLessThanOrEqual(1);
    expect(s.walkoutCuesEnabled).toBe(true);
  });

  it('toggle flips enabled', async () => {
    const { useAudioStore } = await import('./audio');
    useAudioStore.getState().toggle();
    expect(useAudioStore.getState().enabled).toBe(true);
    useAudioStore.getState().toggle();
    expect(useAudioStore.getState().enabled).toBe(false);
  });

  it('setVolume clamps to [0, 1]', async () => {
    const { useAudioStore } = await import('./audio');
    useAudioStore.getState().setVolume(2);
    expect(useAudioStore.getState().masterVolume).toBe(1);
    useAudioStore.getState().setVolume(-0.5);
    expect(useAudioStore.getState().masterVolume).toBe(0);
  });
});
