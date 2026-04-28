import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { championBot, retiredBot, rookieBot, veteranBot } from '@/test/msw/fixtures';

import { FighterCard } from './FighterCard';

describe('<FighterCard />', () => {
  it('renders the nickname when present', () => {
    render(<FighterCard bot={championBot} />);
    expect(screen.getByText(/the algorithm/i)).toBeInTheDocument();
  });

  it('falls back to display_name when nickname is null', () => {
    render(<FighterCard bot={rookieBot} />);
    expect(screen.getByText(/anonymous otter 4729/i)).toBeInTheDocument();
  });

  it('shows the champion belt only when rank === 1', () => {
    const { rerender } = render(<FighterCard bot={championBot} />);
    expect(screen.getByRole('img', { name: /champion/i })).toBeInTheDocument();

    rerender(<FighterCard bot={veteranBot} />);
    expect(screen.queryByRole('img', { name: /^champion$/i })).not.toBeInTheDocument();
  });

  it('marks retired bots via data attribute and chip', () => {
    const { container } = render(<FighterCard bot={retiredBot} />);
    expect(container.querySelector('[data-retired="true"]')).toBeTruthy();
    expect(screen.getByText(/retired/i)).toBeInTheDocument();
  });

  it('shows the rookie chip for an empty record', () => {
    render(<FighterCard bot={rookieBot} />);
    expect(screen.getByText(/rookie/i)).toBeInTheDocument();
  });

  it('falls back to PortraitFallback when portrait_url is null', () => {
    render(<FighterCard bot={rookieBot} />);
    expect(screen.getByRole('img', { name: /python fighter silhouette/i })).toBeInTheDocument();
  });

  it('uses an <img> when portrait_url is present and on the allow-list', () => {
    render(<FighterCard bot={championBot} />);
    expect(screen.getByRole('img', { name: /the algorithm/i })).toHaveAttribute(
      'src',
      championBot.portrait_url!,
    );
  });

  it('rejects portrait_url when not on the allow-list', () => {
    render(
      <FighterCard bot={{ ...championBot, portrait_url: 'https://evil.example.com/x.png' }} />,
    );
    // Should fall back to procedural silhouette
    expect(screen.getByRole('img', { name: /go fighter silhouette/i })).toBeInTheDocument();
  });

  it('fires onFighterClick when interactive and clicked', async () => {
    const onClick = vi.fn();
    render(<FighterCard bot={veteranBot} interactive onFighterClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /the pivot/i }));
    expect(onClick).toHaveBeenCalledWith(veteranBot.id);
  });

  it('does not fire onFighterClick when interactive=false', async () => {
    const onClick = vi.fn();
    render(<FighterCard bot={veteranBot} interactive={false} onFighterClick={onClick} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('emphasized prop applies emphasis class', () => {
    const { container } = render(<FighterCard bot={veteranBot} emphasized />);
    expect(container.querySelector('[data-emphasized="true"]')).toBeTruthy();
  });

  it('has no a11y violations across variants', async () => {
    const { container } = render(
      <>
        <FighterCard bot={championBot} />
        <FighterCard bot={rookieBot} />
        <FighterCard bot={retiredBot} />
        <FighterCard bot={veteranBot} interactive />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
