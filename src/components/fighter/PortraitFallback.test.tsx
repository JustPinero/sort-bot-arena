import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PortraitFallback } from './PortraitFallback';

describe('<PortraitFallback />', () => {
  it('renders an aria-labelled img landmark', () => {
    render(<PortraitFallback botId="bot_x" language="python" />);
    expect(screen.getByRole('img', { name: /python fighter silhouette/i })).toBeInTheDocument();
  });

  it('uses the corner color for border', () => {
    const { container } = render(<PortraitFallback botId="bot_y" language="go" />);
    const node = container.querySelector('[role="img"]');
    expect(node?.getAttribute('style')).toMatch(/var\(--corner-[1-8]\)/);
  });

  it('falls back to a default icon for unknown languages', () => {
    render(<PortraitFallback botId="bot_z" language="cobol" />);
    expect(screen.getByRole('img', { name: /cobol fighter silhouette/i })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<PortraitFallback botId="bot_a" language="python" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
