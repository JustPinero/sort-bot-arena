import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import PerInputLeaderboardPage from './PerInputLeaderboardPage';

import type { ReactNode } from 'react';

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/leaderboard/inputs/:inputId" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<PerInputLeaderboardPage />, { wrapper: Wrapper });
}

describe('<PerInputLeaderboardPage />', () => {
  it('renders the input header and ranked entries', async () => {
    renderAt('/leaderboard/inputs/in_killer_quicksort');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /adversarial quicksort killer/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('shows the not-found panel for unknown input', async () => {
    renderAt('/leaderboard/inputs/in_does_not_exist');
    await waitFor(() => expect(screen.getByText(/input not found/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderAt('/leaderboard/inputs/in_killer_quicksort');
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 1, name: /adversarial quicksort killer/i }),
        ).toBeInTheDocument(),
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
