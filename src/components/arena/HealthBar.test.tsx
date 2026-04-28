import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { HealthBar } from './HealthBar';

describe('<HealthBar />', () => {
  it('exposes role=meter with valuenow', () => {
    render(<HealthBar value={75} label="Bot A health" />);
    const meter = screen.getByRole('meter', { name: /bot a health/i });
    expect(meter).toHaveAttribute('aria-valuenow', '75');
  });

  it('clamps below 0 and above 100', () => {
    render(<HealthBar value={150} label="x" />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps to zero', () => {
    render(<HealthBar value={-1} label="x" />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders the percent text', () => {
    render(<HealthBar value={42} label="x" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<HealthBar value={75} label="meter" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
