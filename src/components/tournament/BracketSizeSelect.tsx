import { cn } from '@/lib/cn';

import { BRACKET_SIZES, type BracketSize } from './bracket';

const BYE_HINT: Record<BracketSize, string | null> = {
  4: null,
  6: '6 bots: round 1 has 2 byes (4 fights, 2 bots advance directly).',
  8: null,
  12: '12 bots: round 1 has 4 byes (8 fights, 4 bots advance directly).',
};

interface BracketSizeSelectProps {
  value: BracketSize;
  onChange: (size: BracketSize) => void;
  className?: string;
}

export function BracketSizeSelect({ value, onChange, className }: BracketSizeSelectProps) {
  const hint = BYE_HINT[value];
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
          Bracket size
        </span>
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as BracketSize)}
          className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
          aria-label="Bracket size"
          title="Pick how many bots compete. 6 and 12 use byes in round 1."
        >
          {BRACKET_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {hint ? (
        <p role="note" className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
