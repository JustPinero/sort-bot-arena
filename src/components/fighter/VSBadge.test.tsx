import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { VSBadge } from './VSBadge';

describe('<VSBadge />', () => {
  it('renders the VS label in vertical mode (default)', () => {
    render(<VSBadge />);
    expect(screen.getByRole('img', { name: /versus/i })).toBeInTheDocument();
  });

  it('renders horizontal stripe layout', () => {
    const { container } = render(<VSBadge orientation="horizontal" />);
    expect(container.querySelectorAll('.hazard-stripes-thin')).toHaveLength(2);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <>
        <VSBadge />
        <VSBadge orientation="horizontal" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
