import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';
import { sampleBattle } from '@/test/msw/fixtures';
import { server } from '@/test/msw/server';

import BattlePage from './BattlePage';

import type { ReactNode } from 'react';

function renderAt(path: string) {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/arena/:battleId" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<BattlePage />, { wrapper: Wrapper });
}

describe('<BattlePage />', () => {
  it('renders the pre-fight staredown initially with both fighters', async () => {
    renderAt('/arena/bat_demo_1');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: /the algorithm/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /enter arena/i })).toBeInTheDocument();
  });

  it('shows the not-found panel for an unknown battle', async () => {
    renderAt('/arena/bat_does_not_exist');
    await waitFor(() => expect(screen.getByText(/battle not on the card/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('clicking ENTER ARENA transitions out of pre-fight staredown', async () => {
    renderAt('/arena/bat_demo_1');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enter arena/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /enter arena/i }));
    // After click, pre-fight staredown is gone (no more "Pre-fight staredown" label)
    await waitFor(() => expect(screen.queryByText(/pre-fight staredown/i)).not.toBeInTheDocument());
  });

  it('renders the BattleWeightClassChip when battle.weight_class is set', async () => {
    server.use(
      http.get('http://api.test/api/v1/battles/:battleId', () =>
        HttpResponse.json({ ...sampleBattle, weight_class: 'exhibition' }),
      ),
    );
    renderAt('/arena/bat_demo_1');
    await waitFor(() =>
      expect(screen.getByRole('status', { name: /exhibition/i })).toBeInTheDocument(),
    );
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderAt('/arena/bat_demo_1');
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 3, name: /the algorithm/i }),
        ).toBeInTheDocument(),
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
