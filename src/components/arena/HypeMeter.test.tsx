import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { HypeMeter } from './HypeMeter';

describe('<HypeMeter />', () => {
  it('exposes role=meter', () => {
    render(<HypeMeter level={0.4} />);
    expect(screen.getByRole('meter', { name: /hype/i })).toHaveAttribute('aria-valuenow', '40');
  });

  it('shows the PEAK callout at full', () => {
    render(<HypeMeter level={1} />);
    expect(screen.getByText(/peak/i)).toBeInTheDocument();
  });

  it('hides the peak callout below 95%', () => {
    render(<HypeMeter level={0.9} />);
    expect(screen.queryByText(/peak/i)).not.toBeInTheDocument();
  });

  it('clamps to [0,100]', () => {
    render(<HypeMeter level={5} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<HypeMeter level={0.6} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
