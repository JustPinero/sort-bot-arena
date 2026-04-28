import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { RecordChip } from './RecordChip';

describe('<RecordChip />', () => {
  it('renders W-L-D', () => {
    render(<RecordChip wins={12} losses={3} draws={1} />);
    expect(screen.getByText('12-3-1')).toBeInTheDocument();
  });

  it('shows ROOKIE when record is all zeros', () => {
    render(<RecordChip wins={0} losses={0} draws={0} />);
    expect(screen.getByText('ROOKIE')).toBeInTheDocument();
  });

  it('forces ROOKIE via variant', () => {
    render(<RecordChip wins={5} losses={1} variant="rookie" />);
    expect(screen.getByText('ROOKIE')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<RecordChip wins={2} losses={0} draws={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
