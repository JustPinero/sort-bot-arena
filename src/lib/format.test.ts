import { describe, expect, it } from 'vitest';

import { fmtRecord, fmtTime } from './format';

describe('fmtRecord', () => {
  it('formats W-L-D with no draws when zero', () => {
    expect(fmtRecord(2, 1, 0)).toBe('2-1-0');
  });

  it('formats with draws', () => {
    expect(fmtRecord(10, 4, 2)).toBe('10-4-2');
  });

  it('handles all zeros', () => {
    expect(fmtRecord(0, 0, 0)).toBe('0-0-0');
  });
});

describe('fmtTime', () => {
  it('shows three-decimal seconds for sub-minute durations', () => {
    expect(fmtTime(0.041)).toBe('0.041s');
    expect(fmtTime(2.5)).toBe('2.500s');
    expect(fmtTime(59.999)).toBe('59.999s');
  });

  it('switches to m:ss.mmm for ≥ 60 seconds', () => {
    expect(fmtTime(60)).toBe('1:00.000');
    expect(fmtTime(125.4)).toBe('2:05.400');
  });

  it('returns "—" for non-positive', () => {
    expect(fmtTime(0)).toBe('—');
    expect(fmtTime(-1)).toBe('—');
  });
});
