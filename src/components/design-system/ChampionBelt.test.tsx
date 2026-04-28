import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ChampionBelt } from './ChampionBelt';

describe('<ChampionBelt />', () => {
  it('renders with active glow when active', () => {
    const { container } = render(<ChampionBelt active />);
    const node = container.querySelector('span[role="img"]');
    expect(node?.className).toMatch(/animate-glow-cycle/);
  });

  it('exposes a label for screen readers', () => {
    render(<ChampionBelt active />);
    expect(screen.getByRole('img', { name: /champion/i })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ChampionBelt active />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
