import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { FilterChips } from './FilterChips';

describe('<FilterChips />', () => {
  it('marks the active option with aria-pressed', () => {
    render(
      <FilterChips
        weight="lightweight"
        activity="all"
        sort="rank"
        onWeightChange={() => {}}
        onActivityChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    const light = screen.getByRole('button', { name: /^light$/i });
    expect(light).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires onWeightChange', async () => {
    const onWeightChange = vi.fn();
    render(
      <FilterChips
        weight="all"
        activity="all"
        sort="rank"
        onWeightChange={onWeightChange}
        onActivityChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /heavy/i }));
    expect(onWeightChange).toHaveBeenCalledWith('heavyweight');
  });

  it('shows the Filtered badge when any filter is non-default', () => {
    render(
      <FilterChips
        weight="lightweight"
        activity="all"
        sort="rank"
        onWeightChange={() => {}}
        onActivityChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    expect(screen.getByText(/filtered/i)).toBeInTheDocument();
  });

  it('hides the Filtered badge on defaults', () => {
    render(
      <FilterChips
        weight="all"
        activity="all"
        sort="rank"
        onWeightChange={() => {}}
        onActivityChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    expect(screen.queryByText(/filtered/i)).not.toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <FilterChips
        weight="lightweight"
        activity="month"
        sort="ko"
        onWeightChange={() => {}}
        onActivityChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
