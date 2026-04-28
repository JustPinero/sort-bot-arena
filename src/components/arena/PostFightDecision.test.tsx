import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { championBot, veteranBot } from '@/test/msw/fixtures';

import { PostFightDecision } from './PostFightDecision';

const ts = '2026-04-28T18:30:00Z';

describe('<PostFightDecision />', () => {
  it('shows KNOCKOUT for ko outcome', () => {
    render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'ko',
          a_rounds_won: 5,
          b_rounds_won: 0,
          ts,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: /knockout/i })).toBeInTheDocument();
  });

  it('shows DECISION VICTORY for narrow finishes', () => {
    render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'decision',
          a_rounds_won: 3,
          b_rounds_won: 2,
          ts,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: /decision/i })).toBeInTheDocument();
  });

  it('shows the New Champion belt when rankChange is set', () => {
    render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'ko',
          a_rounds_won: 5,
          b_rounds_won: 0,
          ts,
        }}
        rankChange={{
          previous_champion_bot_id: veteranBot.id,
          new_champion_bot_id: championBot.id,
        }}
      />,
    );
    expect(screen.getByText(/new champion/i)).toBeInTheDocument();
  });

  it('renders winner name in scorecard', () => {
    render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'decision',
          a_rounds_won: 3,
          b_rounds_won: 2,
          ts,
        }}
      />,
    );
    expect(screen.getByText(/winner:/i)).toHaveTextContent(/the algorithm/i);
  });

  it('fires onReplay and onNextFight', async () => {
    const onReplay = vi.fn();
    const onNextFight = vi.fn();
    render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'ko',
          a_rounds_won: 5,
          b_rounds_won: 0,
          ts,
        }}
        onReplay={onReplay}
        onNextFight={onNextFight}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /replay/i }));
    await userEvent.click(screen.getByRole('button', { name: /next fight/i }));
    expect(onReplay).toHaveBeenCalled();
    expect(onNextFight).toHaveBeenCalled();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <PostFightDecision
        fighterA={championBot}
        fighterB={veteranBot}
        finalEvent={{
          type: 'fight_end',
          winner_bot_id: championBot.id,
          outcome: 'ko',
          a_rounds_won: 5,
          b_rounds_won: 0,
          ts,
        }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
