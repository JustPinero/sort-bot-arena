import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { BattleWeightClassChip } from './BattleWeightClassChip';

describe('<BattleWeightClassChip />', () => {
  it('renders "Title Fight" with hazard treatment', () => {
    render(<BattleWeightClassChip weightClass="title_fight" />);
    const chip = screen.getByRole('status', { name: /title fight/i });
    expect(chip).toHaveTextContent(/title fight/i);
    expect(chip.className).toMatch(/hazard/);
  });

  it('renders "Exhibition" with tech treatment', () => {
    render(<BattleWeightClassChip weightClass="exhibition" />);
    const chip = screen.getByRole('status', { name: /exhibition/i });
    expect(chip).toHaveTextContent(/exhibition/i);
    expect(chip.className).toMatch(/tech/);
  });

  it('renders "Sparring" with muted surface treatment', () => {
    render(<BattleWeightClassChip weightClass="sparring" />);
    const chip = screen.getByRole('status', { name: /sparring/i });
    expect(chip).toHaveTextContent(/sparring/i);
    expect(chip.className).toMatch(/surface-2/);
  });

  it('renders nothing when weightClass is null', () => {
    const { container } = render(<BattleWeightClassChip weightClass={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<BattleWeightClassChip weightClass="title_fight" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
