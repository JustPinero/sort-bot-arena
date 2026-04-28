import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Button } from './button';

describe('<Button />', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it.each([
    ['combat', 'rounded-combat'],
    ['combat-secondary', 'border-combat'],
    ['champion', 'border-champion'],
    ['destructive', 'border-combat'],
    ['ghost', 'text-text-secondary'],
  ] as const)('applies %s variant classes', (variant, expectedClass) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no a11y violations across primary variants', async () => {
    const { container } = render(
      <>
        <Button variant="combat">Fight</Button>
        <Button variant="combat-secondary">Decline</Button>
        <Button variant="champion">View Champion</Button>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
