import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import DesignSystemPage from './DesignSystemPage';

describe('<DesignSystemPage />', () => {
  it('renders every section header', () => {
    render(
      <MemoryRouter>
        <DesignSystemPage />
      </MemoryRouter>,
    );

    for (const title of [
      'Surface tiers',
      'Accent colors',
      'Bot corner palette',
      'Type scale',
      'Buttons',
      'Badges',
      'Cards',
      'LED & chips',
      'Animations',
      'Patterns',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('has no critical a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <DesignSystemPage />
      </MemoryRouter>,
    );
    const results = await axe(container);
    const critical = (results.violations ?? []).filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  describe('a11y', () => {
    it('renders without axe violations', async () => {
      const { container } = render(
        <MemoryRouter>
          <DesignSystemPage />
        </MemoryRouter>,
      );
      expect(screen.getByText('Surface tiers')).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
