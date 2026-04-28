import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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

  it('shows BYE for matches with auto-advance', async () => {
    renderAt('/tournaments/trn_completed');
    await waitFor(() => expect(screen.getByText(/auto-advance/i)).toBeInTheDocument());
  });

  it('renders the not-found panel for unknown id', async () => {
    renderAt('/tournaments/trn_does_not_exist');
    await waitFor(
      () => expect(screen.getByText(/tournament not on the card/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
