import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { championRuns } from '@/test/msw/fixtures';

import { FightHistoryTable } from './FightHistoryTable';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<FightHistoryTable />', () => {
  it('renders one row per run', () => {
    render(withRouter(<FightHistoryTable runs={championRuns} />));
    expect(screen.getAllByText('WIN')).toHaveLength(2);
    expect(screen.getByText('LOSS')).toBeInTheDocument();
  });

  it('shows KO indicator for KO runs', () => {
    render(withRouter(<FightHistoryTable runs={championRuns} />));
    expect(screen.getByText('KO')).toBeInTheDocument();
  });

  it('shows empty state when runs is empty', () => {
    render(withRouter(<FightHistoryTable runs={[]} />));
    expect(screen.getByText(/no fights yet/i)).toBeInTheDocument();
  });

  it('calls onLoadMore when the button is clicked', async () => {
    const onLoadMore = vi.fn();
    render(withRouter(<FightHistoryTable runs={championRuns} hasMore onLoadMore={onLoadMore} />));
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('has no a11y violations', async () => {
    const { container } = render(withRouter(<FightHistoryTable runs={championRuns} />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
