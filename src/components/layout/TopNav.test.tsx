import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '@/stores/theme';

import { TopNav } from './TopNav';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<TopNav />', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('system');
  });

  it('exposes a Primary navigation landmark', () => {
    render(withRouter(<TopNav />));
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });

  it('renders the four primary links', () => {
    render(withRouter(<TopNav />));
    for (const label of ['Arena', 'Rankings', 'Tournaments', 'Submit']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('cycles theme on toggle click', async () => {
    render(withRouter(<TopNav />));
    const button = screen.getByRole('button', { name: /theme/i });
    await userEvent.click(button);
    expect(useThemeStore.getState().mode).toBe('light');
    await userEvent.click(button);
    expect(useThemeStore.getState().mode).toBe('dark');
    await userEvent.click(button);
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('disables the theme toggle when forceThemeLocked', () => {
    render(withRouter(<TopNav forceThemeLocked />));
    expect(screen.getByRole('button', { name: /theme/i })).toBeDisabled();
  });

  it('shows "guest" when no display name in auth store', () => {
    render(withRouter(<TopNav />));
    expect(screen.getByTestId('user-display-name')).toHaveTextContent('guest');
  });
});
