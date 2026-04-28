import { describe, expect, it } from 'vitest';

import { weightClass } from './weightClass';

describe('weightClass', () => {
  it('maps known languages to their class', () => {
    expect(weightClass('python')).toBe('LIGHTWEIGHT');
    expect(weightClass('node')).toBe('MIDDLEWEIGHT');
    expect(weightClass('go')).toBe('CRUISERWEIGHT');
    expect(weightClass('binary')).toBe('HEAVYWEIGHT');
  });

  it('is case-insensitive', () => {
    expect(weightClass('Python')).toBe('LIGHTWEIGHT');
    expect(weightClass('GO')).toBe('CRUISERWEIGHT');
  });

  it('falls back to UNRANKED for unknown languages', () => {
    expect(weightClass('cobol')).toBe('UNRANKED');
    expect(weightClass('')).toBe('UNRANKED');
  });
});
