import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';

import TournamentsListPage from './TournamentsListPage';

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
  return render(<TournamentsListPage />, { wrapper: Wrapper });
}

describe('<TournamentsListPage />', () => {
  it('renders active, upcoming, and completed tournaments with status badges', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/rumble in the stack/i)).toBeInTheDocument());
    expect(screen.getByText(/sort-fest 8/i)).toBeInTheDocument();
    expect(screen.getByText(/killer pattern cup/i)).toBeInTheDocument();
    expect(screen.getByText(/live tonight/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });
});
