import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';
import { championBot, noAnalysisBot, rookieBot } from '@/test/msw/fixtures';

import BotProfilePage from './BotProfilePage';

import type { ReactNode } from 'react';

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/bots/:botId" element={children} />
            <Route path="*" element={<p>404</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<BotProfilePage />, { wrapper: Wrapper });
}

describe('<BotProfilePage />', () => {
  it('renders the champion fighter as the hero with the belt overlay', async () => {
    renderAt(`/bots/${championBot.id}`);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /the algorithm/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('img', { name: /champion/i }).length).toBeGreaterThan(0);
  });

  it('shows fight history by default', async () => {
    renderAt(`/bots/${championBot.id}`);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /the algorithm/i })).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByText('LOSS')).toBeInTheDocument());
  });

  it('switches to performance tab and shows rank history', async () => {
    renderAt(`/bots/${championBot.id}`);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /the algorithm/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('tab', { name: /performance/i }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /rank history/i })).toBeInTheDocument(),
    );
  });

  it('switches to scouting and shows the analysis', async () => {
    renderAt(`/bots/${championBot.id}?tab=scouting`);
    await waitFor(
      () => expect(screen.getByRole('heading', { name: /breakdown/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByText(/an introsort that knows when to switch/i)).toBeInTheDocument();
  });

  it('shows ANALYSIS NOT AVAILABLE for a bot without analysis_url', async () => {
    renderAt(`/bots/${noAnalysisBot.id}?tab=scouting`);
    await waitFor(() => expect(screen.getByText(/analysis not available/i)).toBeInTheDocument());
  });

  it('renders a rookie profile (no achievements yet)', async () => {
    renderAt(`/bots/${rookieBot.id}?tab=achievements`);
    await waitFor(() =>
      expect(screen.getByText(/no achievements unlocked yet/i)).toBeInTheDocument(),
    );
  });

  it('renders the 404 panel for an unknown bot', async () => {
    renderAt('/bots/bot_does_not_exist');
    await waitFor(() =>
      expect(screen.getByText(/fighter not in the database/i)).toBeInTheDocument(),
    );
  });
});
