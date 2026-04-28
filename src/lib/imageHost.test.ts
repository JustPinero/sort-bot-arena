import { describe, expect, it } from 'vitest';

import { isAllowedImageUrl } from './imageHost';

describe('isAllowedImageUrl', () => {
  it('accepts the configured backend host', () => {
    expect(isAllowedImageUrl('http://api.test/portraits/x.png')).toBe(true);
  });

  it('accepts the leonardo cdn', () => {
    expect(isAllowedImageUrl('https://cdn.leonardo.ai/123.png')).toBe(true);
  });

  it('rejects arbitrary hosts', () => {
    expect(isAllowedImageUrl('https://evil.example.com/x.png')).toBe(false);
  });

  it('rejects null and malformed urls', () => {
    expect(isAllowedImageUrl(null)).toBe(false);
    expect(isAllowedImageUrl(undefined)).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
    expect(isAllowedImageUrl('not a url')).toBe(false);
  });
});
