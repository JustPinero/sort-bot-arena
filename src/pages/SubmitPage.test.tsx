import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/queryClient';

import SubmitPage from './SubmitPage';

import type { ReactNode } from 'react';

vi.mock('@/components/submit/MonacoEditor', () => ({
  MonacoEditor: ({
    value,
    onChange,
  }: {
    value: string;
    language: string;
    onChange: (v: string) => void;
  }) => (
    <textarea data-testid="mock-monaco" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('@/lib/playMockEvaluation', () => ({
  playMockEvaluation: () => ({ cancel: () => {}, promise: Promise.resolve() }),
}));

function renderPage() {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<SubmitPage />, { wrapper: Wrapper });
}

describe('<SubmitPage />', () => {
  it('renders the form with default Python template', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /register your fighter/i }),
    ).toBeInTheDocument();
    const editor = screen.getByTestId('mock-monaco') as HTMLTextAreaElement;
    expect(editor.value).toMatch(/def main\(/);
  });

  it('switches templates when language changes', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /cruiser/i }));
    const editor = screen.getByTestId('mock-monaco') as HTMLTextAreaElement;
    expect(editor.value).toMatch(/package main/);
  });

  it('shows a validation error when display_name is empty', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /test sparring/i }));
    await waitFor(() => expect(screen.getByText(/pick a fighter name/i)).toBeInTheDocument());
  });

  it('submits and transitions to the debut view', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/fighter name/i), 'The Algorithm');
    await userEvent.click(screen.getByRole('button', { name: /test sparring/i }));
    await waitFor(
      () =>
        expect(
          screen.getByRole('heading', { level: 1, name: /running the gauntlet/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
