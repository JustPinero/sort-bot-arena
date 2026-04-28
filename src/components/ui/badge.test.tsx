import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Badge } from './badge';

describe('<Badge />', () => {
  it('renders children', () => {
    render(<Badge>HEAVYWEIGHT</Badge>);
    expect(screen.getByText('HEAVYWEIGHT')).toBeInTheDocument();
  });

  it.each([
    ['hazard', 'bg-hazard-bg'],
    ['combat', 'bg-combat-bg'],
    ['champion', 'bg-champion-bg'],
    ['rookie', 'bg-hazard-bg'],
    ['record', 'bg-surface-2'],
  ] as const)('applies %s variant classes', (variant, expectedClass) => {
    render(<Badge variant={variant}>x</Badge>);
    expect(screen.getByText('x')).toHaveClass(expectedClass);
  });

  it('has no a11y violations across variants', async () => {
    const { container } = render(
      <>
        <Badge variant="hazard">live</Badge>
        <Badge variant="combat">ko</Badge>
        <Badge variant="champion">#1</Badge>
        <Badge variant="rookie">rookie</Badge>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
