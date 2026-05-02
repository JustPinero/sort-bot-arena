import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { createQueryClient } from '@/api/queryClient';
import { useAuthStore } from '@/stores/auth';
import { server } from '@/test/msw/server';

import { SignUpDialog } from './SignUpDialog';

import type { ReactNode } from 'react';

const BASE = 'http://api.test';

function renderDialog() {
  const client = createQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<SignUpDialog />, { wrapper: Wrapper });
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('signup-cta'));
  await screen.findByRole('heading', { name: /step into the cage/i });
}

afterEach(() => {
  useAuthStore.getState().clear();
});

describe('<SignUpDialog />', () => {
  it('successful signup calls mutation, updates auth store, closes modal', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText(/fighter \/ display name/i), 'Knockout Kid');
    await user.type(screen.getByLabelText(/^email/i), 'knockout@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().user).toMatchObject({
        id: 'usr_test_1',
        email: 'knockout@example.com',
      });
    });
    expect(useAuthStore.getState().sessionLoaded).toBe(true);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /step into the cage/i })).not.toBeInTheDocument();
    });
  });

  it('renders inline error on signup 409 conflict and keeps modal open', async () => {
    server.use(
      http.post(`${BASE}/api/v1/auth/signup`, () =>
        HttpResponse.json({ error: 'email taken', code: 'conflict' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText(/fighter \/ display name/i), 'Dupe');
    await user.type(screen.getByLabelText(/^email/i), 'dupe@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already registered/i);
    expect(screen.getByRole('heading', { name: /step into the cage/i })).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('renders inline error on login 401 unauthorized', async () => {
    server.use(
      http.post(`${BASE}/api/v1/auth/login`, () =>
        HttpResponse.json({ error: 'invalid credentials', code: 'unauthorized' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: /have an account\? sign in/i }));

    await user.type(screen.getByLabelText(/^email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'badpassword');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email and password do not match/i);
  });

  it('disables submit button and shows spinner while mutation is pending', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${BASE}/api/v1/auth/signup`, async () => {
        await blocked;
        return HttpResponse.json(
          { id: 'usr_test_1', display_name: 'Slow', email: 'slow@example.com' },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText(/fighter \/ display name/i), 'Slow');
    await user.type(screen.getByLabelText(/^email/i), 'slow@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    const submitButton = await screen.findByRole('button', { name: /signing/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();

    release?.();
    await waitFor(() => {
      expect(useAuthStore.getState().user).not.toBeNull();
    });
  });

  it('clears the inline error when toggling between signup and login modes', async () => {
    server.use(
      http.post(`${BASE}/api/v1/auth/signup`, () =>
        HttpResponse.json({ error: 'email taken', code: 'conflict' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText(/fighter \/ display name/i), 'Dupe');
    await user.type(screen.getByLabelText(/^email/i), 'dupe@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /have an account\? sign in/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('<SignUpDialog /> a11y', () => {
  it('signup mode has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderDialog();
    await openDialog(user);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('login mode has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderDialog();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: /have an account\? sign in/i }));
    await screen.findByRole('heading', { name: /sign in/i });
    expect(await axe(container)).toHaveNoViolations();
  });
});
