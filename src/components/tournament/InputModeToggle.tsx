import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

export type TournamentInputMode = 'flat_random' | 'escalation';

const FLAT_RANDOM_TIP = 'Every match draws 3 random inputs from the full pool of 57.';

const ESCALATION_TIP =
  'Round-by-round size scaling — coming once sort-bot-api supports per-match input selection. For now both modes use 3 random inputs from the full pool.';

interface InputModeToggleProps {
  value: TournamentInputMode;
  onChange: (mode: TournamentInputMode) => void;
  className?: string;
}

export function InputModeToggle({ value, onChange, className }: InputModeToggleProps) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="font-mono text-xs uppercase tracking-wide text-text-secondary">
        Input mode
      </legend>
      <div role="radiogroup" aria-label="Input mode" className="flex flex-col gap-2">
        <Option
          value="flat_random"
          label="Flat random"
          description="Default. 3 random inputs per match."
          tooltip={FLAT_RANDOM_TIP}
          checked={value === 'flat_random'}
          onSelect={() => onChange('flat_random')}
        />
        <Option
          value="escalation"
          label="Escalation"
          description="Round-by-round size scaling (preview)."
          tooltip={ESCALATION_TIP}
          checked={value === 'escalation'}
          onSelect={() => onChange('escalation')}
        />
      </div>
    </fieldset>
  );
}

interface OptionProps {
  value: TournamentInputMode;
  label: string;
  description: string;
  tooltip: string;
  checked: boolean;
  onSelect: () => void;
}

function Option({ value, label, description, tooltip, checked, onSelect }: OptionProps) {
  const id = `tournament-input-mode-${value}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          htmlFor={id}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2 text-sm transition-colors',
            checked
              ? 'border-hazard bg-surface-2'
              : 'border-transparent bg-surface-2 hover:border-text-tertiary',
          )}
        >
          <input
            id={id}
            type="radio"
            name="tournament-input-mode"
            value={value}
            checked={checked}
            onChange={onSelect}
            className="mt-1"
            aria-label={label}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wide">{label}</span>
            <span className="text-xs text-text-secondary">{description}</span>
            <span
              data-testid={`input-mode-tooltip-${value}`}
              className="text-[11px] text-text-tertiary"
            >
              {tooltip}
            </span>
          </span>
        </label>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
