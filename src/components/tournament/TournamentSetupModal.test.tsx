import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';
import type { LeaderboardEntry } from '@/api/types';
import { server } from '@/test/msw/server';

import { BotTilePicker } from './BotTilePicker';
import { pickRandomBots } from './bracket';
import { TournamentSetupModal } from './TournamentSetupModal';

import type { ReactNode } from 'react';

const BASE = 'http://api.test';

function makeBots(count: number): LeaderboardEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    bot_id: `bot_${i + 1}`,
    rank: i + 1,
    trend: 'steady' as const,
    display_name: `Fighter ${i + 1}`,
    nickname: `Nick ${i + 1}`,
    language: 'go',
    portrait_url: null,
    record: { wins: 1, losses: 0, draws: 0 },
    ko_percentage: 50,
    signature_input: null,
    last_fight_at: null,
    retired: false,
  }));
}

function useLeaderboardHandler(bots: LeaderboardEntry[]) {
  server.use(
    http.get(`${BASE}/api/v1/leaderboard`, () =>
      HttpResponse.json({ items: bots, next_cursor: null }),
    ),
  );
}

interface RenderOpts {
  defaultOpen?: boolean;
  onLocation?: (path: string) => void;
}

function renderModal({ defaultOpen = true, onLocation }: RenderOpts = {}) {
  const client = createQueryClient();
  function LocationCapture() {
    const loc = useLocation();
    if (onLocation) onLocation(loc.pathname);
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/arena']}>
          <LocationCapture />
          <Routes>
            <Route path="/arena" element={children} />
            <Route path="/tournaments/:id" element={<div>Tournament Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<TournamentSetupModal defaultOpen={defaultOpen} />, { wrapper: Wrapper });
}

describe('pickRandomBots', () => {
  it('returns N distinct ids', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
    const picks = pickRandomBots(pool, 4);
    expect(picks).toHaveLength(4);
    expect(new Set(picks).size).toBe(4);
    picks.forEach((id) => expect(pool).toContain(id));
  });

  it('throws when pool is smaller than n', () => {
    expect(() => pickRandomBots(['a', 'b'], 3)).toThrow();
  });
});

describe('<TournamentSetupModal />', () => {
  it('renders bracket size dropdown with 4 / 6 / 8 / 12 (default 8)', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();
    const select = (await screen.findByLabelText(/bracket size/i)) as HTMLSelectElement;
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(['4', '6', '8', '12']);
    expect(select.value).toBe('8');
  });

  it('disables Random when leaderboard pool < bracket_size and shows tooltip', async () => {
    useLeaderboardHandler(makeBots(5));
    renderModal();
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).toBeDisabled());
    expect(random).toHaveAttribute('title', expect.stringMatching(/Need ≥8/));
    expect(screen.getByText(/Need ≥8 evaluated bots/i)).toBeInTheDocument();
  });

  it('Random with 12 bots + bracket 8 fills 8 distinct slots; submit posts 8 ids', async () => {
    useLeaderboardHandler(makeBots(12));

    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/tournaments`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          {
            id: 'trn_done_1',
            name: 'New',
            status: 'upcoming',
            participant_count: 8,
            weight_class_filter: null,
            prize_description: null,
            scheduled_at: '2026-04-29T20:00:00Z',
            rounds_total: 3,
            current_round: 0,
            champion_bot_id: null,
            participants: [],
            matches: [],
          },
          { status: 201 },
        );
      }),
    );

    renderModal();
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    await userEvent.click(random);

    await waitFor(() => expect(screen.getByTestId('selected-count')).toHaveTextContent('8'));

    const start = screen.getByRole('button', { name: /start tournament/i });
    expect(start).not.toBeDisabled();
    await userEvent.click(start);

    await waitFor(() => {
      const c = captured as { participant_bot_ids?: string[] } | null;
      expect(c?.participant_bot_ids?.length).toBe(8);
      expect(new Set(c!.participant_bot_ids).size).toBe(8);
    });
  });

  it('clicking a tile toggles aria-pressed and updates the selected count', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();
    const tiles = await screen.findAllByRole('button', { name: /select fighter/i });
    const first = tiles[0]!;
    expect(first).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');

    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('Start tournament is disabled until selected.length === bracket_size', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();
    const start = await screen.findByRole('button', { name: /start tournament/i });
    expect(start).toBeDisabled();

    const tiles = await screen.findAllByRole('button', { name: /select fighter/i });
    // bracket_size default is 8 — pick 7 first
    for (let i = 0; i < 7; i++) await userEvent.click(tiles[i]!);
    expect(start).toBeDisabled();
    await userEvent.click(tiles[7]!);
    await waitFor(() => expect(start).not.toBeDisabled());
  });

  it('Cancel button closes the modal and clears selection on re-open', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal({ defaultOpen: false });
    // Open modal
    await userEvent.click(screen.getByTestId('setup-tournament-cta'));
    const tiles = await screen.findAllByRole('button', { name: /select fighter/i });
    await userEvent.click(tiles[0]!);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // dialog title gone
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /setup a tournament/i }),
      ).not.toBeInTheDocument(),
    );

    // Re-open — selection should be cleared
    await userEvent.click(screen.getByTestId('setup-tournament-cta'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /setup a tournament/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('Esc key closes the modal and clears selection per spec', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal({ defaultOpen: false });
    await userEvent.click(screen.getByTestId('setup-tournament-cta'));
    const tiles = await screen.findAllByRole('button', { name: /select fighter/i });
    await userEvent.click(tiles[0]!);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /setup a tournament/i }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId('setup-tournament-cta'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /setup a tournament/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('search filter narrows the tile grid by display_name', async () => {
    const bots = makeBots(12);
    bots[0]!.display_name = 'Alpha Sorter';
    bots[1]!.display_name = 'Beta Sorter';
    useLeaderboardHandler(bots);

    renderModal();
    await screen.findAllByRole('button', { name: /select fighter/i });
    await userEvent.type(screen.getByLabelText(/search bots/i), 'Alpha');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select alpha sorter/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /select beta sorter/i })).not.toBeInTheDocument();
    });
  });

  it('paginates a 60-bot leaderboard at 50 per page with a Next button', async () => {
    useLeaderboardHandler(makeBots(60));
    renderModal();
    const tiles = await screen.findAllByRole('button', { name: /select fighter/i });
    expect(tiles).toHaveLength(50);

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    expect(nextBtn).not.toBeDisabled();
    await userEvent.click(nextBtn);

    await waitFor(() => {
      const all = screen.getAllByRole('button', { name: /select fighter/i });
      expect(all).toHaveLength(10);
    });
  });

  it('flat_random is default; submit body has input_mode=flat_random', async () => {
    useLeaderboardHandler(makeBots(12));

    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/tournaments`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          {
            id: 'trn_done_2',
            name: 'New',
            status: 'upcoming',
            participant_count: 8,
            weight_class_filter: null,
            prize_description: null,
            scheduled_at: '2026-04-29T20:00:00Z',
            rounds_total: 3,
            current_round: 0,
            champion_bot_id: null,
            participants: [],
            matches: [],
          },
          { status: 201 },
        );
      }),
    );

    renderModal();
    const flatRadio = (await screen.findByRole('radio', {
      name: /flat random/i,
    })) as HTMLInputElement;
    expect(flatRadio.checked).toBe(true);

    const random = screen.getByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    await userEvent.click(random);

    await userEvent.click(screen.getByRole('button', { name: /start tournament/i }));
    await waitFor(() => {
      const c = captured as { input_mode?: string; bracket_size?: number; count?: number } | null;
      expect(c?.input_mode).toBe('flat_random');
      expect(c?.bracket_size).toBe(8);
      expect(c?.count).toBe(3);
    });
  });

  it('switching to escalation surfaces tooltip and submit body has input_mode=escalation', async () => {
    useLeaderboardHandler(makeBots(12));

    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/tournaments`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          {
            id: 'trn_done_3',
            name: 'New',
            status: 'upcoming',
            participant_count: 8,
            weight_class_filter: null,
            prize_description: null,
            scheduled_at: '2026-04-29T20:00:00Z',
            rounds_total: 3,
            current_round: 0,
            champion_bot_id: null,
            participants: [],
            matches: [],
          },
          { status: 201 },
        );
      }),
    );

    renderModal();
    const escRadio = (await screen.findByRole('radio', {
      name: /escalation/i,
    })) as HTMLInputElement;
    await userEvent.click(escRadio);
    expect(escRadio.checked).toBe(true);
    expect(screen.getByTestId('input-mode-tooltip-escalation')).toHaveTextContent(
      /round 1 draws from small/i,
    );

    const random = screen.getByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    await userEvent.click(random);
    await userEvent.click(screen.getByRole('button', { name: /start tournament/i }));
    await waitFor(() => {
      const c = captured as { input_mode?: string } | null;
      expect(c?.input_mode).toBe('escalation');
    });
  });

  it('successful submit redirects to /tournaments/<id>', async () => {
    useLeaderboardHandler(makeBots(12));
    // Slice D4 — server returns the clean `{tournament_id, status}`
    // envelope (CreateTournamentResponseSchema). The frontend redirects
    // to /tournaments/:id and the bracket page fetches the rich
    // Tournament shape via `useTournament(id)`.
    server.use(
      http.post(`${BASE}/api/v1/tournaments`, () =>
        HttpResponse.json({ tournament_id: 'trn_yay', status: 'pending' }, { status: 201 }),
      ),
    );

    let lastPath = '/arena';
    renderModal({
      onLocation: (p) => {
        lastPath = p;
      },
    });
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    await userEvent.click(random);
    await userEvent.click(screen.getByRole('button', { name: /start tournament/i }));
    await waitFor(() => expect(lastPath).toBe('/tournaments/trn_yay'));
  });
});

describe('<TournamentSetupModal /> tooltips', () => {
  it('exposes tooltips on the major form controls (bracket size, search, Start)', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();

    // Radix Tooltip opens on pointerMove. Fire pointer events directly to avoid
    // jsdom + Radix DismissableLayer pointer-events:none friction.
    const bracket = (await screen.findByLabelText(/bracket size/i)) as HTMLSelectElement;
    fireEvent.pointerMove(bracket);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /byes|number of bots/i.test(t.textContent ?? ''))).toBe(true);
    });

    const search = await screen.findByLabelText(/search bots/i);
    fireEvent.pointerMove(search);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /display name|nickname/i.test(t.textContent ?? ''))).toBe(true);
    });

    const start = await screen.findByRole('button', { name: /start tournament/i });
    fireEvent.pointerMove(start);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /bracket page|tournaments/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  it('Random button tooltip explains the disabled-pool state when bots are insufficient', async () => {
    useLeaderboardHandler(makeBots(5));
    renderModal();
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).toBeDisabled());

    // The button is disabled, but its wrapping span is the tooltip trigger.
    const wrapper = random.parentElement as HTMLElement;
    fireEvent.pointerMove(wrapper);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /need ≥8/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  it('Random button tooltip when enabled explains the random-fill behavior', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    fireEvent.pointerMove(random);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /fills the bracket with random/i.test(t.textContent ?? ''))).toBe(
        true,
      );
    });
  });

  it('Cancel button has a tooltip explaining the discard behavior', async () => {
    useLeaderboardHandler(makeBots(12));
    renderModal();
    const cancel = await screen.findByRole('button', { name: /cancel/i });
    fireEvent.pointerMove(cancel);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /discard|close/i.test(t.textContent ?? ''))).toBe(true);
    });
  });
});

describe('<TournamentSetupModal /> a11y', () => {
  it('initial render (manual fill state) has no axe violations', async () => {
    useLeaderboardHandler(makeBots(12));
    const { container } = renderModal({ defaultOpen: true });
    await screen.findByRole('dialog');
    // Wait for tiles to render so the picker is fully painted
    await screen.findAllByRole('button', { name: /select fighter/i });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('after Random fill (selected tiles state) has no axe violations', async () => {
    useLeaderboardHandler(makeBots(12));
    const { container } = renderModal({ defaultOpen: true });
    await screen.findByRole('dialog');
    const random = await screen.findByRole('button', { name: /random fill/i });
    await waitFor(() => expect(random).not.toBeDisabled());
    await userEvent.click(random);
    await waitFor(() => expect(screen.getByTestId('selected-count')).toHaveTextContent('8'));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<BotTilePicker /> standalone', () => {
  it('renders selected count vs bracket size', () => {
    const bots = makeBots(4);
    render(
      <BotTilePicker
        bots={bots}
        selected={['bot_1', 'bot_2']}
        bracketSize={4}
        onToggle={() => {}}
      />,
    );
    const counter = screen.getByTestId('selected-count').parentElement;
    expect(counter).not.toBeNull();
    expect(counter!.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 / 4 selected');
  });

  it('renders bots passed in (presentational; parent owns retired filter)', () => {
    // The picker is now presentational — its parent (TournamentSetupModal) uses
    // useEligibleFighters to filter retired bots before passing them in. The
    // picker itself shows whatever it receives.
    const bots = makeBots(3);
    bots[0]!.retired = true;
    render(<BotTilePicker bots={bots} selected={[]} bracketSize={3} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /select fighter 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select fighter 2/i })).toBeInTheDocument();
  });
});
