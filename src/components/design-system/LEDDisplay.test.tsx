import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { LEDDisplay } from './LEDDisplay';

describe('<LEDDisplay />', () => {
  it('renders the value as text', () => {
    render(<LEDDisplay value="0:42" format="time" label="round timer" />);
    expect(screen.getByText('0:42')).toBeInTheDocument();
  });

  it('exposes status role with aria-label', () => {
    render(<LEDDisplay value={7} label="round" />);
    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('aria-label', 'round');
    expect(node).toHaveAttribute('aria-live', 'polite');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<LEDDisplay value="0:42" format="time" label="timer" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
