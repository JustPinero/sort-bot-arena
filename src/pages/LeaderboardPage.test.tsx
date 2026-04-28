import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';

import LeaderboardPage from './LeaderboardPage';

import type { ReactNode } from 'react';

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          {children}
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<LeaderboardPage />, { wrapper: Wrapper });
}

describe('<LeaderboardPage />', () => {
  it('renders the podium and the rankings table', async () => {
    renderAt('/leaderboard');
    await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('writes a weight filter to the URL when chosen', async () => {
    renderAt('/leaderboard');
    await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^light$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/weight=lightweight/),
    );
  });

  it('shows the empty-results panel when filters return nothing', async () => {
    renderAt('/leaderboard?weight=heavyweight');
    await waitFor(() => expect(screen.getByText(/no fighters match/i)).toBeInTheDocument());
  });
});
