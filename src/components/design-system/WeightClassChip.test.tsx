import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { WeightClassChip } from './WeightClassChip';

describe('<WeightClassChip />', () => {
  it('renders the mapped weight class', () => {
    render(<WeightClassChip language="python" />);
    expect(screen.getByText('LIGHTWEIGHT')).toBeInTheDocument();
  });

  it('shows UNRANKED for unknown languages', () => {
    render(<WeightClassChip language="cobol" />);
    expect(screen.getByText('UNRANKED')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<WeightClassChip language="go" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
