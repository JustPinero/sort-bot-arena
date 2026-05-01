import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/queryClient';
import { server } from '@/test/msw/server';

import { MatchSetupModal } from './MatchSetupModal';
import { QuickFightButton } from './QuickFightButton';

import type { ReactNode } from 'react';

const BASE = 'http://api.test';

interface RenderOpts {
  initialOpen?: boolean;
  onLocation?: (path: string) => void;
}

function renderModal({ initialOpen = true, onLocation }: RenderOpts = {}) {
  const client = createQueryClient();
  function LocationCapture() {
    const loc = useLocation();
    if (onLocation) onLocation(loc.pathname);
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/arena']}>
          <LocationCapture />
          <Routes>
            <Route path="/arena" element={children} />
            <Route path="/arena/:battleId" element={<div>Battle Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<MatchSetupModal defaultOpen={initialOpen} />, { wrapper: Wrapper });
}

function renderQuickFight({ onLocation }: { onLocation?: (path: string) => void } = {}) {
  const client = createQueryClient();
  function LocationCapture() {
    const loc = useLocation();
    if (onLocation) onLocation(loc.pathname);
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/arena']}>
          <LocationCapture />
          <Routes>
            <Route path="/arena" element={children} />
            <Route path="/arena/:battleId" element={<div>Battle Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<QuickFightButton />, { wrapper: Wrapper });
}

describe('<MatchSetupModal />', () => {
  it('renders three tabs with Preset selected by default', async () => {
    renderModal();
    expect(await screen.findByRole('tab', { name: /preset/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByRole('tab', { name: /manual/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument();
  });

  it('Preset → Sparring posts {bot_a, bot_b, count: 3}', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/battles`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ battle_id: 'bat_started_1' }, { status: 200 });
      }),
    );

    renderModal();
    // wait for leaderboard
    await screen.findByRole('tab', { name: /preset/i });
    await selectBots('Champion Coder', 'Sandy Reeves');

    // Preset is default; pick Sparring
    const presetSelect = await screen.findByLabelText(/preset bundle/i);
    await userEvent.selectOptions(presetSelect, 'sparring');

    await userEvent.click(screen.getByRole('button', { name: /start match/i }));
    await waitFor(() =>
      expect(captured).toMatchObject({ bot_a: 'bot_champ', bot_b: 'bot_vet', count: 3 }),
    );
  });

  it('Manual → multi-select posts input_ids', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/battles`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ battle_id: 'bat_started_2' }, { status: 200 });
      }),
    );

    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    await selectBots('Champion Coder', 'Sandy Reeves');

    await userEvent.click(screen.getByRole('tab', { name: /manual/i }));
    const checkboxes = await screen.findAllByRole('checkbox');
    // Pick first 2 input checkboxes
    await userEvent.click(checkboxes[0]!);
    await userEvent.click(checkboxes[1]!);

    await userEvent.click(screen.getByRole('button', { name: /start match/i }));
    await waitFor(() => {
      const c = captured as { input_ids?: string[] } | null;
      expect(c?.input_ids).toBeDefined();
      expect(c!.input_ids!.length).toBe(2);
    });
  });

  it('Upload → submit input adds it to Manual tab pre-checked', async () => {
    server.use(
      http.post(`${BASE}/api/v1/inputs`, async () => {
        return HttpResponse.json(
          { id: 'in_uploaded_1', name: 'My Custom Input', size: 5 },
          { status: 201 },
        );
      }),
    );

    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    await userEvent.click(screen.getByRole('tab', { name: /upload/i }));
    await userEvent.type(screen.getByLabelText(/values/i), '1, 2, 3, 4, 5');
    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // Switch to Manual — the new input should be there + checked
    await userEvent.click(screen.getByRole('tab', { name: /manual/i }));
    const cb = await screen.findByRole('checkbox', { name: /My Custom Input/i });
    expect(cb).toBeChecked();
  });

  it('Upload validation: non-integer entry shows an error', async () => {
    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    await userEvent.click(screen.getByRole('tab', { name: /upload/i }));
    await userEvent.type(screen.getByLabelText(/values/i), '1, two, 3');
    await userEvent.click(screen.getByRole('button', { name: /add input/i }));
    await waitFor(() =>
      expect(screen.getByText(/must be integers/i)).toBeInTheDocument(),
    );
  });

  it('Bot pickers must be distinct to enable Start match', async () => {
    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    // Pick same bot in both slots
    await selectBots('Champion Coder', 'Champion Coder');
    expect(screen.getByRole('button', { name: /start match/i })).toBeDisabled();
  });

  it('429 pair_busy → inline retry-soon alert', async () => {
    server.use(
      http.post(`${BASE}/api/v1/battles`, () =>
        HttpResponse.json(
          { error: 'pair_busy', detail: 'busy' },
          { status: 429, headers: { 'Retry-After': '30' } },
        ),
      ),
    );
    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    await selectBots('Champion Coder', 'Sandy Reeves');
    const presetSelect = await screen.findByLabelText(/preset bundle/i);
    await userEvent.selectOptions(presetSelect, 'sparring');
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));
    await waitFor(() =>
      expect(screen.getByText(/already running/i)).toBeInTheDocument(),
    );
  });

  it('429 pair_cooldown → inline alert with formatted retry-after', async () => {
    server.use(
      http.post(`${BASE}/api/v1/battles`, () =>
        HttpResponse.json(
          { error: 'pair_cooldown', detail: 'limit' },
          { status: 429, headers: { 'Retry-After': '600' } },
        ),
      ),
    );
    renderModal();
    await screen.findByRole('tab', { name: /preset/i });
    await selectBots('Champion Coder', 'Sandy Reeves');
    const presetSelect = await screen.findByLabelText(/preset bundle/i);
    await userEvent.selectOptions(presetSelect, 'sparring');
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));
    await waitFor(() =>
      expect(screen.getByText(/per-hour limit/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/10 min/i)).toBeInTheDocument();
  });

  it('successful submit redirects to /arena/<battle_id>', async () => {
    server.use(
      http.post(`${BASE}/api/v1/battles`, () =>
        HttpResponse.json({ battle_id: 'bat_yay' }, { status: 200 }),
      ),
    );
    let lastPath = '/arena';
    renderModal({
      onLocation: (p) => {
        lastPath = p;
      },
    });
    await screen.findByRole('tab', { name: /preset/i });
    await selectBots('Champion Coder', 'Sandy Reeves');
    const presetSelect = await screen.findByLabelText(/preset bundle/i);
    await userEvent.selectOptions(presetSelect, 'sparring');
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));
    await waitFor(() => expect(lastPath).toBe('/arena/bat_yay'));
  });
});

describe('<QuickFightButton />', () => {
  it('with leaderboard loaded, click POSTs once and redirects on 200', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/api/v1/battles`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ battle_id: 'bat_quick_1' }, { status: 200 });
      }),
    );
    let lastPath = '/arena';
    renderQuickFight({
      onLocation: (p) => {
        lastPath = p;
      },
    });
    const btn = await screen.findByRole('button', { name: /quick fight/i });
    await waitFor(() => expect(btn).not.toBeDisabled());
    await userEvent.click(btn);
    await waitFor(() => expect(lastPath).toBe('/arena/bat_quick_1'));
    const c = captured as { count?: number; bot_a?: string; bot_b?: string };
    expect(c.count).toBe(3);
    expect(c.bot_a).not.toBe(c.bot_b);
  });
});

const NAME_TO_ID: Record<string, string> = {
  'Champion Coder': 'bot_champ',
  'Sandy Reeves': 'bot_vet',
  'Marina Cole': 'bot_silver',
  'Theo Park': 'bot_bronze',
  'Anonymous Otter 4729': 'bot_rookie',
};

async function selectBots(redName: string, blueName: string) {
  const red = (await screen.findByLabelText(/red corner/i)) as HTMLSelectElement;
  const blue = (await screen.findByLabelText(/blue corner/i)) as HTMLSelectElement;
  const redId = NAME_TO_ID[redName] ?? redName;
  const blueId = NAME_TO_ID[blueName] ?? blueName;
  // Wait for options to populate
  await waitFor(() => expect(red.options.length).toBeGreaterThan(1));
  await userEvent.selectOptions(red, redId);
  await userEvent.selectOptions(blue, blueId);
}
