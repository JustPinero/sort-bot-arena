import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';
import { championBot, veteranBot } from '@/test/msw/fixtures';

import HeadToHeadPage from './HeadToHeadPage';

import type { ReactNode } from 'react';

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/bots/:a/vs/:b" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<HeadToHeadPage />, { wrapper: Wrapper });
}

describe('<HeadToHeadPage />', () => {
  it('renders both fighters in the Tale of the Tape', async () => {
    renderAt(`/bots/${championBot.id}/vs/${veteranBot.id}`);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: /the algorithm/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: /the pivot/i })).toBeInTheDocument();
  });

  it('renders the shared-input comparison table', async () => {
    renderAt(`/bots/${championBot.id}/vs/${veteranBot.id}`);
    await waitFor(() => expect(screen.getByText(/shared inputs/i)).toBeInTheDocument());
  });

  it('shows matchup-not-available when one bot is unknown', async () => {
    renderAt(`/bots/${championBot.id}/vs/bot_does_not_exist`);
    await waitFor(() => expect(screen.getByText(/matchup not available/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderAt(`/bots/${championBot.id}/vs/${veteranBot.id}`);
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 2, name: /the algorithm/i }),
        ).toBeInTheDocument(),
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
