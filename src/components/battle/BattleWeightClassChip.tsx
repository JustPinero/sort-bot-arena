import { cn } from '@/lib/cn';

import type { BattleWeightClass } from '@/api/types';

interface BattleWeightClassChipProps {
  weightClass: BattleWeightClass | null | undefined;
  className?: string;
}

const VARIANT_LABEL: Record<BattleWeightClass, string> = {
  sparring: 'Sparring',
  exhibition: 'Exhibition',
  title_fight: 'Title Fight',
};

const VARIANT_CLASSES: Record<BattleWeightClass, string> = {
  sparring: 'bg-surface-2 text-text-secondary border-border',
  exhibition: 'bg-tech-bg text-tech border-tech',
  title_fight: 'bg-hazard-bg text-hazard border-hazard shadow-glow-hazard',
};

export function BattleWeightClassChip({ weightClass, className }: BattleWeightClassChipProps) {
  if (!weightClass) return null;
  const label = VARIANT_LABEL[weightClass];
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex h-6 items-center rounded-sm border px-2 font-mono text-xs font-bold uppercase tracking-wider',
        VARIANT_CLASSES[weightClass],
        className,
      )}
    >
      {label}
    </span>
  );
}
