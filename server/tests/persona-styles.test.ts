// Phase 9 / Slice 2 — portrait-style RNG + per-style prompt fragments.
// These tests gate the prompt copy: a future refactor that drops a
// distinctive fragment ("brass-plated", "neon-soaked", etc.) fails loudly
// instead of silently homogenizing portraits.

import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';
import {
  buildPortraitPrompt,
  pickStyle,
  STYLES,
  type LeonardoClient,
  type Style,
} from '../src/persona/leonardo.js';
import { PersonaService } from '../src/persona/service.js';
import { getPersona } from '../src/persona/store.js';

describe('pickStyle', () => {
  it('returns the first style for rng() === 0 and the last for rng() ≈ 0.99', () => {
    expect(pickStyle(() => 0)).toBe('steampunk');
    expect(pickStyle(() => 0.99)).toBe('retro-arcade');
  });

  it('returns one of the 8 known styles when called with default rng', () => {
    const known = new Set<Style>(STYLES);
    for (let i = 0; i < 50; i++) {
      expect(known.has(pickStyle())).toBe(true);
    }
  });

  it('maps RNG output deterministically to style index', () => {
    for (let i = 0; i < STYLES.length; i++) {
      const value = (i + 0.5) / STYLES.length;
      expect(pickStyle(() => value)).toBe(STYLES[i]);
    }
  });
});

describe('buildPortraitPrompt', () => {
  // Distinctive token lifted from references/leonardo-style-prompts.md —
  // one per style. If a copy edit removes any of these the test fires.
  const distinctiveByStyle: Record<Style, string> = {
    steampunk: 'Brass-plated',
    cyberpunk: 'neon-soaked',
    cartoony: 'Saturday-morning-cartoon',
    anime: 'Mecha anime key-frame',
    'classic-battlebot': 'chain-link arena pit',
    kaiju: 'kaiju-scale',
    medieval: 'heraldic banner',
    'retro-arcade': 'pixel-cluster',
  };

  for (const style of STYLES) {
    it(`includes the bot name, style-distinctive token, and scaffold tail for ${style}`, () => {
      const { prompt, style: returnedStyle } = buildPortraitPrompt({
        display_name: 'Test Bot',
        language: 'python',
        style,
      });
      expect(returnedStyle).toBe(style);
      expect(prompt).toContain('Test Bot');
      expect(prompt).toContain(distinctiveByStyle[style]);
      expect(prompt).toContain('no text, no logos, no watermark');
    });
  }

  it('includes the algorithm bit when an algorithm is provided', () => {
    const { prompt } = buildPortraitPrompt({
      display_name: 'X',
      language: 'python',
      algorithm: 'Timsort',
      style: 'cyberpunk',
    });
    expect(prompt).toContain('themed around Timsort');
  });

  it('omits the algorithm bit when algorithm is null', () => {
    const { prompt } = buildPortraitPrompt({
      display_name: 'X',
      language: 'python',
      algorithm: null,
      style: 'cyberpunk',
    });
    expect(prompt).not.toContain('themed');
  });

  it('omits the algorithm bit when algorithm is undefined', () => {
    const { prompt } = buildPortraitPrompt({
      display_name: 'X',
      language: 'python',
      style: 'cyberpunk',
    });
    expect(prompt).not.toContain('themed');
  });

  it('returns one of the 8 known styles when called without an explicit style', () => {
    const known = new Set<Style>(STYLES);
    const { style } = buildPortraitPrompt({
      display_name: 'X',
      language: 'python',
    });
    expect(known.has(style)).toBe(true);
  });
});

describe('PersonaService.generatePortrait writes the chosen style', () => {
  let db: Client;
  beforeEach(async () => {
    db = createClient({ url: ':memory:' });
    await runMigrations(db);
  });

  it('persists a non-null style on the bot_personas row matching one of the 8', async () => {
    const stubLeonardo: LeonardoClient = {
      startGeneration: vi.fn(async () => ({ generation_id: 'gen-1' })),
      getGeneration: vi.fn(async () => ({
        generation_id: 'gen-1',
        status: 'COMPLETE' as const,
        image_url: 'https://leonardo.example/img.png',
      })),
    } as unknown as LeonardoClient;

    const svc = new PersonaService({
      db,
      leonardo: stubLeonardo,
      pollIntervalMs: 1,
      pollMaxAttempts: 3,
    });

    await svc.generate({
      bot_id: 'bot-1',
      display_name: 'Test',
      language: 'python',
      algorithm: 'Quicksort',
    });

    const row = await getPersona(db, 'bot-1');
    expect(row).not.toBeNull();
    expect(row?.portrait_url).toBe('https://leonardo.example/img.png');
    const known = new Set<string>(STYLES);
    expect(row?.style).not.toBeNull();
    expect(known.has(row?.style ?? '')).toBe(true);
  });
});
