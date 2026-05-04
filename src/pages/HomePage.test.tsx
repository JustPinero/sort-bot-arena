import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import HomePage from './HomePage';

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
  return render(<HomePage />, { wrapper: Wrapper });
}

describe('<HomePage />', () => {
  it('renders the broadcast ticker, champion corner, and rookie of the day', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/broadcast ticker/i)).toBeInTheDocument());
    expect(screen.getByText(/champion.s corner/i)).toBeInTheDocument();
    expect(screen.getByText(/rookie of the day/i)).toBeInTheDocument();
    expect(screen.getByText(/biggest upset/i)).toBeInTheDocument();
    expect(screen.getByText(/featured fight/i)).toBeInTheDocument();
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      await waitFor(() => expect(screen.getByLabelText(/broadcast ticker/i)).toBeInTheDocument());
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
