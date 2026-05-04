import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import HallOfFamePage from './HallOfFamePage';

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
  return render(<HallOfFamePage />, { wrapper: Wrapper });
}

describe('<HallOfFamePage />', () => {
  it('lists retired bots with the Retired chip', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/the veteran/i)).toBeInTheDocument());
    expect(screen.getAllByText(/retired/i).length).toBeGreaterThan(0);
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      await waitFor(() => expect(screen.getByText(/the veteran/i)).toBeInTheDocument());
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
