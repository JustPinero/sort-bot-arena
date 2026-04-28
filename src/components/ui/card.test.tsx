import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './card';

describe('<Card />', () => {
  it.each([
    ['default', 'rounded-lg'],
    ['fighter', 'rounded-combat'],
    ['featured', 'border-champion'],
  ] as const)('applies %s variant', (variant, expectedClass) => {
    const { container } = render(<Card variant={variant}>x</Card>);
    expect(container.firstChild).toHaveClass(expectedClass);
  });

  it('composes header / title / content / footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>content</CardContent>
        <CardFooter>foot</CardFooter>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('has no a11y violations on the featured variant', async () => {
    const { container } = render(
      <Card variant="featured">
        <CardHeader>
          <CardTitle>Champion</CardTitle>
        </CardHeader>
        <CardContent>content</CardContent>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
