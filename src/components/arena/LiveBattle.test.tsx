import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BattleEvent } from '@/api/types';
import { deriveBattleState } from '@/lib/battleReducer';
import { championBot, veteranBot } from '@/test/msw/fixtures';

import { LiveBattle } from './LiveBattle';

const ts = (s: number) => `2026-04-28T18:00:${String(s).padStart(2, '0')}Z`;

function renderWithEvents(events: BattleEvent[]) {
  return render(
    <LiveBattle
      fighterA={championBot}
      fighterB={veteranBot}
      events={events}
      derived={deriveBattleState(events, championBot.id, veteranBot.id)}
      roundsTotal={5}
    />,
  );
}

describe('<LiveBattle />', () => {
  it('renders both fighter portraits and the round counter', () => {
    renderWithEvents([{ type: 'fight_start', ts: ts(0) }]);
    expect(screen.getByText(/the algorithm/i)).toBeInTheDocument();
    expect(screen.getByText(/the pivot/i)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /round 0 of 5/i })).toBeInTheDocument();
  });

  it('shows the slam-in overlay on the latest round_end event', async () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      {
        type: 'round_end',
        round: 1,
        winner_bot_id: championBot.id,
        a_time_seconds: 0.04,
        b_time_seconds: 0.12,
        delta_seconds: -0.08,
        ts: ts(2),
      },
    ];
    renderWithEvents(events);
    // slam-in overlay text is unique to the assertive status node
    await waitFor(() => expect(screen.getByRole('status', { name: '' })).toBeInTheDocument());
    expect(screen.getAllByText(/by 0\.080s/i).length).toBeGreaterThan(0);
  });

  it('reflects rounds won in the score line', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      {
        type: 'round_end',
        round: 1,
        winner_bot_id: championBot.id,
        a_time_seconds: 0.04,
        b_time_seconds: 0.12,
        delta_seconds: -0.08,
        ts: ts(2),
      },
      {
        type: 'round_end',
        round: 2,
        winner_bot_id: championBot.id,
        a_time_seconds: 0.05,
        b_time_seconds: 0.15,
        delta_seconds: -0.1,
        ts: ts(4),
      },
    ];
    renderWithEvents(events);
    // bot A should have 2 rounds; bot B 0
    const aWon = screen.getAllByText('2');
    expect(aWon.length).toBeGreaterThan(0);
  });

  it('renders the commentary feed with each event line', () => {
    const events: BattleEvent[] = [
      { type: 'fight_start', ts: ts(0) },
      { type: 'round_start', round: 1, input_id: 'i1', input_name: 'Random 10k', ts: ts(1) },
      { type: 'commentary', text: 'WHAT A MOVE', ts: ts(2) },
    ];
    renderWithEvents(events);
    expect(screen.getAllByText(/random 10k/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/what a move/i)).toBeInTheDocument();
  });
});
