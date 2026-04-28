import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { championSnapshots } from '@/test/msw/fixtures';

import { RankHistoryChart } from './RankHistoryChart';

describe('<RankHistoryChart />', () => {
  it('renders the chart container with an aria-label', () => {
    render(<RankHistoryChart snapshots={championSnapshots} />);
    expect(screen.getByRole('img', { name: /rank history/i })).toBeInTheDocument();
  });

  it('shows empty state when snapshots are empty', () => {
    render(<RankHistoryChart snapshots={[]} />);
    expect(screen.getByText(/no rank history yet/i)).toBeInTheDocument();
  });
});
