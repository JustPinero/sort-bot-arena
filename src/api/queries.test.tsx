import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { championBot, noAnalysisBot, rookieBot } from '@/test/msw/fixtures';
import { server } from '@/test/msw/server';

import {
  useBattles,
  useBot,
  useBotAnalysis,
  useBotInputPerformance,
  useBotRuns,
  useBotSnapshots,
  useInputs,
  useLeaderboard,
  usePerInputLeaderboard,
  usePing,
  useStartBattle,
} from './queries';
import { createQueryClient } from './queryClient';

import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePing', () => {
  it('round-trips /healthz through the API client', async () => {
    const { result } = renderHook(() => usePing(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('ok');
  });

  it('surfaces ApiError on backend failure', async () => {
    server.use(
      http.get('http://api.test/api/healthz', () =>
        HttpResponse.json({ error: 'down', code: 'unavailable' }, { status: 503 }),
      ),
    );
    const { result } = renderHook(() => usePing(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toMatchObject({ name: 'ApiError', status: 503 });
  });

  // Contract guard: the deployed server returns `text/plain "ok"` for the
  // healthz route. The default MSW handler must mirror that shape so
  // frontend tests don't pass against a fictional JSON envelope.
  it('default MSW handler returns text/plain "ok" (matches deployed server)', async () => {
    const res = await fetch('http://api.test/api/healthz');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(await res.text()).toBe('ok');
  });
});

describe('useBot', () => {
  it('returns the bot fixture by id', async () => {
    const { result } = renderHook(() => useBot(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.nickname).toBe('The Algorithm');
    expect(result.current.data?.rank).toBe(1);
  });

  it('returns 404 for unknown bot', async () => {
    const { result } = renderHook(() => useBot('bot_does_not_exist'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toMatchObject({ status: 404 });
  });

  it('is disabled when botId is undefined', () => {
    const { result } = renderHook(() => useBot(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  // End-to-end wiring guard: schema validation runs at the apiClient layer
  // and surfaces as an ApiError to TanStack Query consumers. A malformed
  // response (here, an empty object that fails BotSchema) must produce
  // {code: 'malformed_response'} — never a render crash downstream.
  it('surfaces ApiError({code: "malformed_response"}) when the response fails BotSchema', async () => {
    server.use(
      http.get(`http://api.test/api/v1/bots/${championBot.id}`, () => HttpResponse.json({})),
    );
    const { result } = renderHook(() => useBot(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toMatchObject({
      name: 'ApiError',
      code: 'malformed_response',
      status: 0,
    });
  });
});

describe('useBotRuns', () => {
  it('returns paginated runs for a bot', async () => {
    const { result } = renderHook(() => useBotRuns(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(3);
    expect(result.current.data?.next_cursor).toBeNull();
  });
});

describe('useBotSnapshots', () => {
  it('returns rank snapshots over time', async () => {
    const { result } = renderHook(() => useBotSnapshots(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(4);
    expect(result.current.data?.at(-1)?.rank).toBe(1);
  });
});

describe('useBotInputPerformance', () => {
  it('returns per-input performance entries', async () => {
    const { result } = renderHook(() => useBotInputPerformance(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.input_id).toBe('in_killer_quicksort');
  });
});

describe('useBotAnalysis', () => {
  it('returns the AI analysis for a bot with analysis_url', async () => {
    const { result } = renderHook(() => useBotAnalysis(championBot.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.analysis).toMatch(/introsort/i);
  });

  it('surfaces 503 when analysis is unavailable', async () => {
    const { result } = renderHook(() => useBotAnalysis(noAnalysisBot.id), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toMatchObject({ status: 503, code: 'analysis_unavailable' });
  });

  it('respects enabled=false', () => {
    const { result } = renderHook(() => useBotAnalysis(rookieBot.id, { enabled: false }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useLeaderboard', () => {
  it('returns the unfiltered leaderboard', async () => {
    const { result } = renderHook(
      () => useLeaderboard({ weight: 'all', activity: 'all', language: null, sort: 'rank' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items[0]?.rank).toBe(1);
  });

  it('applies weight class filter', async () => {
    const { result } = renderHook(
      () =>
        useLeaderboard({
          weight: 'lightweight',
          activity: 'all',
          language: null,
          sort: 'rank',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data?.items ?? [];
    for (const item of items) {
      expect(item.language).toBe('python');
    }
  });
});

describe('usePerInputLeaderboard', () => {
  it('returns ranked entries for an input', async () => {
    const { result } = renderHook(() => usePerInputLeaderboard('in_killer_quicksort'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.input.id).toBe('in_killer_quicksort');
    expect(result.current.data?.items[0]?.rank_in_field).toBe(1);
  });

  it('404s for unknown input', async () => {
    const { result } = renderHook(() => usePerInputLeaderboard('in_does_not_exist'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.error).toMatchObject({ status: 404 });
  });
});

describe('useInputs', () => {
  it('returns the list of inputs', async () => {
    const { result } = renderHook(() => useInputs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
  });
});

describe('useStartBattle', () => {
  it("invalidates ['battles'] on success so RecentBattlesList refreshes", async () => {
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function sharedWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => ({ battles: useBattles(), start: useStartBattle() }), {
      wrapper: sharedWrapper,
    });

    await waitFor(() => expect(result.current.battles.isSuccess).toBe(true));

    result.current.start.mutate({ bot_a: championBot.id, bot_b: rookieBot.id });

    await waitFor(() => expect(result.current.start.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['battles'] });
  });
});
