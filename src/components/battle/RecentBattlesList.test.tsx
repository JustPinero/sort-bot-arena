import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Battle } from '@/api/types';
import type { ReactNode } from 'react';

const useBattlesMock = vi.fn();

vi.mock('@/api/queries', () => ({
  useBattles: () => useBattlesMock(),
}));

import { RecentBattlesList } from './RecentBattlesList';

function wrap(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const baseBattle: Battle = {
  id: 'bat_1',
  status: 'completed',
  fighter_a: {
    bot_id: 'bot_a',
    nickname: 'A-Train',
    display_name: 'Alice',
    language: 'go',
    portrait_url: null,
    corner: 'red',
    rank: 1,
    trash_talk: null,
  },
  fighter_b: {
    bot_id: 'bot_b',
    nickname: null,
    display_name: 'Bob',
    language: 'python',
    portrait_url: null,
    corner: 'blue',
    rank: 2,
    trash_talk: null,
  },
  rounds_total: 3,
  current_round: 3,
  scheduled_at: '2026-04-28T19:00:00Z',
  started_at: '2026-04-28T19:00:00Z',
  completed_at: '2026-04-28T19:30:00Z',
  winner_bot_id: 'bot_a',
  outcome: null,
  weight_class: 'title_fight',
};

function makeBattle(overrides: Partial<Battle> & { id: string }): Battle {
  return { ...baseBattle, ...overrides };
}

describe('<RecentBattlesList />', () => {
  beforeEach(() => {
    useBattlesMock.mockReset();
  });

  it('renders a loading indicator while battles are loading', () => {
    useBattlesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    wrap(<RecentBattlesList />);
    expect(screen.getByRole('heading', { name: /recent battles/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an empty state when no battles are returned', () => {
    useBattlesMock.mockReturnValue({
      data: { items: [], next_cursor: null },
      isLoading: false,
      isError: false,
    });
    wrap(<RecentBattlesList />);
    expect(screen.getByText(/no recent battles yet/i)).toBeInTheDocument();
  });

  it('renders an error message when the query errors', () => {
    useBattlesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    wrap(<RecentBattlesList />);
    expect(screen.getByText(/could not load recent battles/i)).toBeInTheDocument();
  });

  it('renders a card per battle with names, chip, winner, and link', () => {
    const battles: Battle[] = [
      makeBattle({
        id: 'bat_1',
        fighter_a: { ...baseBattle.fighter_a, display_name: 'Alpha' },
        fighter_b: { ...baseBattle.fighter_b, display_name: 'Beta' },
        winner_bot_id: baseBattle.fighter_a.bot_id,
        status: 'completed',
        weight_class: 'title_fight',
      }),
      makeBattle({
        id: 'bat_2',
        fighter_a: { ...baseBattle.fighter_a, display_name: 'Gamma' },
        fighter_b: { ...baseBattle.fighter_b, display_name: 'Delta' },
        status: 'live',
        winner_bot_id: null,
        completed_at: null,
        weight_class: 'exhibition',
      }),
      makeBattle({
        id: 'bat_3',
        fighter_a: { ...baseBattle.fighter_a, display_name: 'Epsilon' },
        fighter_b: { ...baseBattle.fighter_b, display_name: 'Zeta' },
        status: 'pre_fight',
        winner_bot_id: null,
        completed_at: null,
        weight_class: 'sparring',
      }),
    ];

    useBattlesMock.mockReturnValue({
      data: { items: battles, next_cursor: null },
      isLoading: false,
      isError: false,
    });

    wrap(<RecentBattlesList />);
    const cards = screen.getAllByTestId('recent-battle-card');
    expect(cards).toHaveLength(3);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByText('Epsilon')).toBeInTheDocument();
    expect(screen.getByText('Zeta')).toBeInTheDocument();

    expect(screen.getByText(/title fight/i)).toBeInTheDocument();
    expect(screen.getByText(/exhibition/i)).toBeInTheDocument();
    expect(screen.getByText(/sparring/i)).toBeInTheDocument();

    expect(screen.getByText(/winner:\s*alpha/i)).toBeInTheDocument();

    const replayLink = screen.getByRole('link', { name: /replay/i });
    expect(replayLink).toHaveAttribute('href', '/arena/bat_1');
    const enterLinks = screen.getAllByRole('link', { name: /enter arena/i });
    expect(enterLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('caps the rendered list at 8 battles', () => {
    const battles: Battle[] = Array.from({ length: 12 }, (_, i) =>
      makeBattle({ id: `bat_${i}`, status: 'live', winner_bot_id: null, completed_at: null }),
    );
    useBattlesMock.mockReturnValue({
      data: { items: battles, next_cursor: null },
      isLoading: false,
      isError: false,
    });
    wrap(<RecentBattlesList />);
    expect(screen.getAllByTestId('recent-battle-card')).toHaveLength(8);
  });
});
