import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { leaderboardEntries } from '@/test/msw/fixtures';

import { PodiumTop3 } from './PodiumTop3';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<PodiumTop3 />', () => {
  it('renders the top three by rank with rank badges', () => {
    render(withRouter(<PodiumTop3 entries={leaderboardEntries} />));
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('puts the champion belt only on rank 1', () => {
    render(withRouter(<PodiumTop3 entries={leaderboardEntries} />));
    const beltLabels = screen.getAllByRole('img', { name: /champion/i });
    expect(beltLabels.length).toBe(1);
  });

  it('returns null when no top-3 entries are present', () => {
    const { container } = render(withRouter(<PodiumTop3 entries={[]} />));
    expect(container.firstChild).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(withRouter(<PodiumTop3 entries={leaderboardEntries} />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
