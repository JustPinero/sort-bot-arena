import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { championBot, veteranBot } from '@/test/msw/fixtures';

import { TaleOfTheTape } from './TaleOfTheTape';

describe('<TaleOfTheTape />', () => {
  it('renders both fighters and a VS badge in two-fighter mode', () => {
    render(<TaleOfTheTape fighterA={championBot} fighterB={veteranBot} />);
    expect(screen.getByText(/the algorithm/i)).toBeInTheDocument();
    expect(screen.getByText(/the pivot/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/versus/i).length).toBeGreaterThan(0);
  });

  it('omits the VS badge when showVS is false', () => {
    render(<TaleOfTheTape fighterA={championBot} fighterB={veteranBot} showVS={false} />);
    expect(screen.queryAllByLabelText(/versus/i)).toHaveLength(0);
  });

  it('renders single-fighter mode when fighterB is null', () => {
    render(<TaleOfTheTape fighterA={championBot} fighterB={null} />);
    expect(screen.getByText(/the algorithm/i)).toBeInTheDocument();
    expect(screen.queryByText(/the pivot/i)).not.toBeInTheDocument();
  });

  it('mode="pre-fight" makes cards interactive', () => {
    const onClick = vi.fn();
    render(
      <TaleOfTheTape
        fighterA={championBot}
        fighterB={veteranBot}
        mode="pre-fight"
        onFighterClick={onClick}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('mode="active" disables onFighterClick (no buttons rendered)', () => {
    const onClick = vi.fn();
    render(
      <TaleOfTheTape
        fighterA={championBot}
        fighterB={veteranBot}
        mode="active"
        onFighterClick={onClick}
      />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('clicking a card in pre-fight mode calls onFighterClick with the bot id', async () => {
    const onClick = vi.fn();
    render(
      <TaleOfTheTape
        fighterA={championBot}
        fighterB={veteranBot}
        mode="pre-fight"
        onFighterClick={onClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /the algorithm/i }));
    expect(onClick).toHaveBeenCalledWith(championBot.id);
  });

  it('emphasizeBot applies emphasized state to the named fighter', () => {
    const { container } = render(
      <TaleOfTheTape fighterA={championBot} fighterB={veteranBot} emphasizeBot={veteranBot.id} />,
    );
    const emphasized = container.querySelectorAll('[data-emphasized="true"]');
    expect(emphasized).toHaveLength(1);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <TaleOfTheTape fighterA={championBot} fighterB={veteranBot} mode="pre-fight" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
