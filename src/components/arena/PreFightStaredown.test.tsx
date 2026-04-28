import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { championBot, veteranBot } from '@/test/msw/fixtures';

import { PreFightStaredown } from './PreFightStaredown';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('<PreFightStaredown />', () => {
  it('renders both fighters in active TalesOfTheTape', () => {
    render(withRouter(<PreFightStaredown fighterA={championBot} fighterB={veteranBot} />));
    expect(screen.getByRole('heading', { level: 3, name: /the algorithm/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /the pivot/i })).toBeInTheDocument();
  });

  it('shows countdown', () => {
    render(
      withRouter(
        <PreFightStaredown fighterA={championBot} fighterB={veteranBot} countdownSeconds={3} />,
      ),
    );
    expect(screen.getByRole('timer')).toHaveTextContent('3');
  });

  it('renders trash-talk for fighters who have it', () => {
    render(withRouter(<PreFightStaredown fighterA={championBot} fighterB={veteranBot} />));
    expect(screen.getByText(/i don't lose to amateurs/i)).toBeInTheDocument();
  });

  it('falls back to a generic taunt when trash_talk is null', () => {
    render(
      withRouter(
        <PreFightStaredown fighterA={{ ...championBot, trash_talk: null }} fighterB={veteranBot} />,
      ),
    );
    // generic taunts are short italic strings; look for the speaker line at least
    expect(screen.getByText(/— the algorithm/i)).toBeInTheDocument();
  });

  it('fires onEnterArena when the button is clicked', async () => {
    const onEnter = vi.fn();
    render(
      withRouter(
        <PreFightStaredown fighterA={championBot} fighterB={veteranBot} onEnterArena={onEnter} />,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /enter arena/i }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      withRouter(
        <PreFightStaredown fighterA={championBot} fighterB={veteranBot} onEnterArena={() => {}} />,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
