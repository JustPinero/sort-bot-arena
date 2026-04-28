import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { leaderboardEntries } from '@/test/msw/fixtures';

import { RankingsTable } from './RankingsTable';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<RankingsTable />', () => {
  it('renders one row per entry with rank and trend', () => {
    render(withRouter(<RankingsTable entries={leaderboardEntries} />));
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/rank up/i).length).toBeGreaterThan(0);
  });

  it('filters by startRank when provided', () => {
    render(withRouter(<RankingsTable entries={leaderboardEntries} startRank={4} />));
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('shows the empty-results panel when no entries', () => {
    render(withRouter(<RankingsTable entries={[]} />));
    expect(screen.getByText(/no fighters match/i)).toBeInTheDocument();
  });

  it('renders a profile link per fighter', () => {
    render(withRouter(<RankingsTable entries={leaderboardEntries} />));
    expect(screen.getByRole('link', { name: /open profile: the algorithm/i })).toHaveAttribute(
      'href',
      '/bots/bot_champ',
    );
  });

  it('has no a11y violations', async () => {
    const { container } = render(withRouter(<RankingsTable entries={leaderboardEntries} />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
