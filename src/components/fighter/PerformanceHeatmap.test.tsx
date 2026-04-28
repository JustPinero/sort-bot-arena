import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { championInputs } from '@/test/msw/fixtures';

import { PerformanceHeatmap } from './PerformanceHeatmap';

describe('<PerformanceHeatmap />', () => {
  it('renders a list with one cell per input', () => {
    render(<PerformanceHeatmap data={championInputs} />);
    expect(screen.getByRole('list', { name: /per-input performance/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(championInputs.length);
  });

  it('shows the empty state when data is empty', () => {
    render(<PerformanceHeatmap data={[]} />);
    expect(screen.getByText(/no input data yet/i)).toBeInTheDocument();
  });

  it('exposes per-cell aria-label with input name and rank', () => {
    render(<PerformanceHeatmap data={championInputs} />);
    expect(screen.getByLabelText(/Adversarial Quicksort Killer/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<PerformanceHeatmap data={championInputs} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
