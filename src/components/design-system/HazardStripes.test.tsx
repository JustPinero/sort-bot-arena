import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { HazardStripes } from './HazardStripes';

describe('<HazardStripes />', () => {
  it('renders with the thick pattern by default', () => {
    const { container } = render(<HazardStripes />);
    expect(container.querySelector('.hazard-stripes')).toBeTruthy();
  });

  it('switches to thin variant', () => {
    const { container } = render(<HazardStripes thickness="thin" />);
    expect(container.querySelector('.hazard-stripes-thin')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<HazardStripes />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
