import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import MyFightersPage from './MyFightersPage';

import type { ReactNode } from 'react';

function renderPage() {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<MyFightersPage />, { wrapper: Wrapper });
}

describe('<MyFightersPage />', () => {
  it("lists the user's bots with quick stats", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/the algorithm/i)).toBeInTheDocument());
  });

  it('exposes a Retire button for active bots', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/the algorithm/i)).toBeInTheDocument());
    const retire = screen.getByRole('button', { name: /retire/i });
    expect(retire).toBeInTheDocument();
    await userEvent.click(retire);
    // Action fires (button shows "Retiring…" briefly, then completes).
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /retiring/i })).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      await waitFor(() => expect(screen.getByText(/the algorithm/i)).toBeInTheDocument());
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
