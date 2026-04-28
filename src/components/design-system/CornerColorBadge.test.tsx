import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { CornerColorBadge } from './CornerColorBadge';

describe('<CornerColorBadge />', () => {
  it('uses a corner-N CSS variable for background', () => {
    const { container } = render(<CornerColorBadge botId="bot_x" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('style')).toMatch(/var\(--corner-[1-8]\)/);
  });

  it('is aria-hidden (decorative)', () => {
    const { container } = render(<CornerColorBadge botId="bot_y" />);
    expect(container.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<CornerColorBadge botId="bot_z" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
