import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { Achievement } from '@/api/types';

import { AchievementIconStrip } from './AchievementIconStrip';

const make = (n: number): Achievement[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `ach_${i}`,
    name: `Ach ${i}`,
    icon: 'star',
    description: `desc ${i}`,
    unlocked_at: '2026-01-01T00:00:00Z',
    rarity_pct: 10,
  }));

describe('<AchievementIconStrip />', () => {
  it('shows "no achievements" when empty', () => {
    render(<AchievementIconStrip achievements={[]} />);
    expect(screen.getByText(/no achievements yet/i)).toBeInTheDocument();
  });

  it('renders one li per achievement up to maxVisible', () => {
    render(<AchievementIconStrip achievements={make(4)} maxVisible={3} />);
    const items = screen.getAllByRole('listitem');
    // 3 visible + 1 overflow indicator
    expect(items).toHaveLength(4);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('does not show overflow when count fits', () => {
    render(<AchievementIconStrip achievements={make(3)} maxVisible={6} />);
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<AchievementIconStrip achievements={make(3)} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
