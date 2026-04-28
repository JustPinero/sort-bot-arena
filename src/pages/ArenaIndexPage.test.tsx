import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';

import ArenaIndexPage from './ArenaIndexPage';

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
  return render(<ArenaIndexPage />, { wrapper: Wrapper });
}

describe('<ArenaIndexPage />', () => {
  it('lists active battles with status badge and an Enter Arena CTA', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/the algorithm/i)).toBeInTheDocument());
    expect(screen.getByText(/the pivot/i)).toBeInTheDocument();
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /enter arena/i })).toHaveAttribute(
      'href',
      '/arena/bat_demo_1',
    );
  });
});
