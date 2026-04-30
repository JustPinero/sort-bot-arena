import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('kaboom');
}

describe('<ErrorBoundary />', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something broke/i)).toBeInTheDocument();
  });

  it('renders a custom fallback when supplied', () => {
    render(
      <ErrorBoundary fallback={(_reset, err) => <p data-testid="custom">custom: {err.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom')).toHaveTextContent('custom: kaboom');
  });

  it('resets when the user clicks Try again', async () => {
    let shouldThrow = true;
    function Toggling(): JSX.Element {
      if (shouldThrow) throw new Error('boom');
      return <p>recovered</p>;
    }

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Toggling />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something broke/i)).toBeInTheDocument();
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
