import { describe, expect, it } from 'vitest';

import { ApiError } from './client';
import { apiErrorStatus, retryNon4xx } from './error-helpers';

function makeApiError(status: number): ApiError {
  return new ApiError({
    status,
    code: `http_${status}`,
    message: `status ${status}`,
    retryable: status >= 500,
  });
}

describe('apiErrorStatus', () => {
  it.each<[string, unknown, number | undefined]>([
    ['ApiError 404', makeApiError(404), 404],
    ['plain Error', new Error('plain'), undefined],
    ['null', null, undefined],
    // Critical regression guard: a duck-typed object with a `status` field
    // must NOT be treated as an ApiError. Prior code used `(err as { status?: number })?.status`
    // which would incorrectly pick this up.
    ['duck-typed { status: 500 }', { status: 500 }, undefined],
  ])('returns the right status for %s', (_label, input, expected) => {
    expect(apiErrorStatus(input)).toBe(expected);
  });
});

describe('retryNon4xx', () => {
  it.each<[string, number, unknown, boolean]>([
    ['ApiError 400 → never retry', 0, makeApiError(400), false],
    ['ApiError 503 first attempt → retry', 0, makeApiError(503), true],
    ['ApiError 503 second attempt → stop', 1, makeApiError(503), false],
    ['plain Error first attempt → retry', 0, new Error('boom'), true],
  ])('%s', (_label, failureCount, err, expected) => {
    expect(retryNon4xx(failureCount, err)).toBe(expected);
  });
});
