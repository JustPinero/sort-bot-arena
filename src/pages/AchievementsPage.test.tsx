import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';

import AchievementsPage from './AchievementsPage';

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
  return render(<AchievementsPage />, { wrapper: Wrapper });
}

describe('<AchievementsPage />', () => {
  it('lists achievements with rarity tier label', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/perfect debut/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/giant killer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0\.4%/i)).toBeInTheDocument();
    expect(screen.getAllByText(/mythic/i).length).toBeGreaterThan(0);
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      await waitFor(() => expect(screen.getAllByText(/perfect debut/i).length).toBeGreaterThan(0));
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
