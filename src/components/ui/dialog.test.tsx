import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogTriggerButton } from './dialog';
import { TooltipProvider } from './tooltip';

function withProviders(ui: React.ReactNode) {
  return (
    <TooltipProvider delayDuration={0}>
      <Dialog>{ui}</Dialog>
    </TooltipProvider>
  );
}

describe('<DialogTriggerButton />', () => {
  it('renders the button without a tooltip when none is supplied', () => {
    render(withProviders(<DialogTriggerButton>Open</DialogTriggerButton>));
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the tooltip on hover when supplied', async () => {
    render(
      withProviders(<DialogTriggerButton tooltip="explainer">Open</DialogTriggerButton>),
    );
    const wrapper = screen.getByRole('button', { name: /open/i }).parentElement as HTMLElement;
    fireEvent.pointerMove(wrapper);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /explainer/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  it('still fires the tooltip when the underlying button is disabled (span wrapper)', async () => {
    render(
      withProviders(
        <DialogTriggerButton tooltip="why disabled" disabled>
          Open
        </DialogTriggerButton>,
      ),
    );
    const button = screen.getByRole('button', { name: /open/i });
    expect(button).toBeDisabled();
    const wrapper = button.parentElement as HTMLElement;
    fireEvent.pointerMove(wrapper);
    await waitFor(async () => {
      const tips = await screen.findAllByRole('tooltip');
      expect(tips.some((t) => /why disabled/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  it('forwards ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(withProviders(<DialogTriggerButton ref={ref}>Open</DialogTriggerButton>));
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe('Open');
  });

  it('applies the requested variant class', () => {
    render(withProviders(<DialogTriggerButton variant="combat">Fight</DialogTriggerButton>));
    expect(screen.getByRole('button', { name: /fight/i })).toHaveClass('rounded-combat');
  });

  it('passes testId through as data-testid', () => {
    render(
      withProviders(
        <DialogTriggerButton testId="my-test-id">Open</DialogTriggerButton>,
      ),
    );
    expect(screen.getByTestId('my-test-id')).toBeInTheDocument();
  });
});
