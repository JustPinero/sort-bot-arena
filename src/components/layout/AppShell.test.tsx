import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AppShell } from './AppShell';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<AppShell />', () => {
  it('renders the children inside main', () => {
    render(
      withRouter(
        <AppShell>
          <p>hello content</p>
        </AppShell>,
      ),
    );
    expect(screen.getByRole('main')).toContainElement(screen.getByText('hello content'));
  });

  it('applies forceTheme via ThemeProvider (data-theme on <html>)', () => {
    render(
      withRouter(
        <AppShell forceTheme="dark">
          <p>x</p>
        </AppShell>,
      ),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('adds scan-lines class to <main> when scanLines is true', () => {
    render(
      withRouter(
        <AppShell scanLines>
          <p>x</p>
        </AppShell>,
      ),
    );
    expect(screen.getByRole('main').className).toMatch(/scan-lines/);
  });

  it('exposes a skip-link as the first focusable element', () => {
    render(
      withRouter(
        <AppShell>
          <p>x</p>
        </AppShell>,
      ),
    );
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      withRouter(
        <AppShell>
          <h2>Inside</h2>
          <p>body</p>
        </AppShell>,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
