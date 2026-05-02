import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import TournamentBracketPage from './TournamentBracketPage';

import type { ReactNode } from 'react';

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/tournaments/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<TournamentBracketPage />, { wrapper: Wrapper });
}

describe('<TournamentBracketPage />', () => {
  it('renders the active tournament with rounds and a live match', async () => {
    renderAt('/tournaments/trn_active');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /rumble in the stack/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    expect(screen.getByText(/final/i)).toBeInTheDocument();
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it('shows the champion callout for completed tournaments', async () => {
    renderAt('/tournaments/trn_completed');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /killer pattern cup/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/champion/i).length).toBeGreaterThan(0);
  });

  it('still renders both fighters for normal (non-bye) matches', async () => {
    renderAt('/tournaments/trn_active');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /rumble in the stack/i }),
      ).toBeInTheDocument(),
    );
    // The trn_active completed match (m_a) pits The Algorithm vs The Pivot.
    expect(screen.getAllByText(/the algorithm/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the pivot/i).length).toBeGreaterThan(0);
    // No bye text appears on this fixture.
    expect(screen.queryByText(/advances on bye/i)).not.toBeInTheDocument();
  });

  it('shows BYE matches as a single fighter advancing on bye', async () => {
    renderAt('/tournaments/trn_completed');
    await waitFor(() => expect(screen.getByText(/advances on bye/i)).toBeInTheDocument());
    // The participant who got the bye must still be named on the card.
    const byeCopy = screen.getByText(/advances on bye/i);
    const card = byeCopy.closest('article');
    expect(card).not.toBeNull();
    // veteranBot ("The Pivot") is the bye fighter in the trn_completed fixture (m_q2).
    expect(card?.textContent ?? '').toMatch(/the pivot/i);
  });

  it('renders the not-found panel for unknown id', async () => {
    renderAt('/tournaments/trn_does_not_exist');
    await waitFor(
      () => expect(screen.getByText(/tournament not on the card/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderAt('/tournaments/trn_active');
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 1, name: /rumble in the stack/i }),
        ).toBeInTheDocument(),
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
