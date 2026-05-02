import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { InputSummary } from '@/api/types';
import { TooltipProvider } from '@/components/ui/tooltip';

import { InputPickerTabs } from './InputPickerTabs';

const inputs: InputSummary[] = [
  { id: 'in_alpha', name: 'almost-sorted-1k', size: 1000 },
  { id: 'in_beta', name: 'reversed-256', size: 256 },
];

function noop() {}

describe('<InputPickerTabs />', () => {
  it('exposes each checkbox by its visible label name (not aria-label)', () => {
    render(
      <TooltipProvider>
        <InputPickerTabs
          inputs={inputs}
          preset="sparring"
          onChangePreset={noop}
          selectedInputIds={new Set()}
          onToggleInput={noop}
          activeTab="manual"
          onChangeTab={noop}
          onInputUploaded={noop}
        />
      </TooltipProvider>,
    );

    const alpha = screen.getByRole('checkbox', { name: /almost-sorted-1k/i });
    expect(alpha).toBeInTheDocument();
    expect(alpha).not.toHaveAttribute('aria-label');

    const beta = screen.getByRole('checkbox', { name: /reversed-256/i });
    expect(beta).toBeInTheDocument();
    expect(beta).not.toHaveAttribute('aria-label');
  });
});
