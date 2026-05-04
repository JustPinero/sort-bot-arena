import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';
import type { Tournament } from '@/api/types';
import { server } from '@/test/msw/server';

import { RecentTournamentsList } from './RecentTournamentsList';

import type { ReactNode } from 'react';

const BASE = 'http://api.test';

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'trn_test',
    name: 'Tournament 357ebddb',
    status: 'completed',
    participant_count: 8,
    weight_class_filter: null,
    prize_description: null,
    scheduled_at: '2026-04-29T18:00:00Z',
    rounds_total: 3,
    current_round: 3,
    champion_bot_id: null,
    matches: [],
    participants: [],
    ...overrides,
  };
}

function renderList() {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<RecentTournamentsList />, { wrapper: Wrapper });
}

describe('<RecentTournamentsList />', () => {
  it('exposes the section with data-testid and aria-labelledby', async () => {
    server.use(
      http.get(`${BASE}/api/v1/tournaments`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderList();
    const section = await screen.findByTestId('recent-tournaments');
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveAttribute('aria-labelledby', 'recent-tournaments-heading');
    const heading = screen.getByRole('heading', { name: /recent tournaments/i });
    expect(heading).toHaveAttribute('id', 'recent-tournaments-heading');
  });

  it('renders the loading skeleton while fetching', () => {
    server.use(
      http.get(`${BASE}/api/v1/tournaments`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    renderList();
    expect(screen.getByTestId('recent-tournaments-loading')).toBeInTheDocument();
  });

  it('renders the empty state when there are no tournaments', async () => {
    server.use(
      http.get(`${BASE}/api/v1/tournaments`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderList();
    await waitFor(() => expect(screen.getByText(/no recent tournaments yet/i)).toBeInTheDocument());
  });

  it('renders cards for each recent tournament with name, participants, status and link', async () => {
    server.use(
      http.get(`${BASE}/api/v1/tournaments`, () =>
        HttpResponse.json({
          items: [
            makeTournament({
              id: 'trn_alpha',
              name: 'Tournament alpha-1',
              participant_count: 8,
              status: 'completed',
            }),
            makeTournament({
              id: 'trn_beta',
              name: 'Tournament beta-2',
              participant_count: 6,
              status: 'active',
            }),
          ],
          next_cursor: null,
        }),
      ),
    );
    renderList();

    await waitFor(() => expect(screen.getByText(/tournament alpha-1/i)).toBeInTheDocument());
    expect(screen.getByText(/tournament beta-2/i)).toBeInTheDocument();
    expect(screen.getByText(/8 fighters/i)).toBeInTheDocument();
    expect(screen.getByText(/6 fighters/i)).toBeInTheDocument();

    // Each card links to its tournament page.
    const alphaLink = screen.getByRole('link', { name: /tournament alpha-1/i });
    expect(alphaLink).toHaveAttribute('href', '/tournaments/trn_alpha');
    const betaLink = screen.getByRole('link', { name: /tournament beta-2/i });
    expect(betaLink).toHaveAttribute('href', '/tournaments/trn_beta');
  });
});
