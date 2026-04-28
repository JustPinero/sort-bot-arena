import { describe, expect, it } from 'vitest';

import { cornerColor } from './cornerColor';

describe('cornerColor', () => {
  it('returns a CSS variable from the corner palette', () => {
    expect(cornerColor('bot_abc')).toMatch(/^var\(--corner-[1-8]\)$/);
  });

  it('is deterministic for the same input', () => {
    expect(cornerColor('bot_xyz')).toBe(cornerColor('bot_xyz'));
  });

  it('distributes across all 8 buckets across many ids', () => {
    const buckets = new Set<string>();
    for (let i = 0; i < 200; i++) {
      buckets.add(cornerColor(`bot_${i}_${i * 7}`));
    }
    expect(buckets.size).toBe(8);
  });
});
