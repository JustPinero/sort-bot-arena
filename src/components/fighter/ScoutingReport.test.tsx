import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ScoutingReport } from './ScoutingReport';

describe('<ScoutingReport />', () => {
  it('renders the analysis text', () => {
    render(<ScoutingReport analysis="An introsort that knows when to switch." />);
    expect(screen.getByText(/introsort/i)).toBeInTheDocument();
  });

  it('shows the unavailable empty state when null', () => {
    render(<ScoutingReport analysis={null} />);
    expect(screen.getByText(/analysis not available/i)).toBeInTheDocument();
  });

  it('shows the unavailable empty state when isError', () => {
    render(<ScoutingReport analysis={null} isError />);
    expect(screen.getByText(/analysis not available/i)).toBeInTheDocument();
  });

  it('shows skeleton during loading', () => {
    const { container } = render(<ScoutingReport analysis={null} isLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('escapes HTML — never uses dangerouslySetInnerHTML', () => {
    render(<ScoutingReport analysis="<script>alert('xss')</script>danger" />);
    expect(screen.queryByText('danger')).not.toBeInTheDocument();
    expect(screen.getByText(/script/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ScoutingReport analysis="A solid analysis." />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
