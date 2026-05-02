import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import EventsFeedPage from './EventsFeedPage';

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
  return render(<EventsFeedPage />, { wrapper: Wrapper });
}

describe('<EventsFeedPage />', () => {
  it('renders feed items with kind badges', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /live events/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/ko/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rank change/i).length).toBeGreaterThan(0);
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /live events/i })).toBeInTheDocument(),
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
