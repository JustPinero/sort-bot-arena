import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import NotFoundPage from './NotFoundPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe('<NotFoundPage />', () => {
  it('renders the 404 hero copy and a link back to rankings', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /fighter not in the database/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to rankings/i })).toHaveAttribute(
      'href',
      '/leaderboard',
    );
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = renderPage();
      expect(
        screen.getByRole('heading', { level: 1, name: /fighter not in the database/i }),
      ).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
