import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoundCounter } from './RoundCounter';

describe('<RoundCounter />', () => {
  it('renders current/total', () => {
    render(<RoundCounter current={3} total={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('exposes role=status with descriptive label', () => {
    render(<RoundCounter current={7} total={9} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Round 7 of 9');
  });
});
