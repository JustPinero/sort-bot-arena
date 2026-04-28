import { cn } from '@/lib/cn';
import { fmtRecord } from '@/lib/format';

interface RecordChipProps {
  wins: number;
  losses: number;
  draws?: number;
  variant?: 'default' | 'rookie';
  className?: string;
}

export function RecordChip({
  wins,
  losses,
  draws = 0,
  variant = 'default',
  className,
}: RecordChipProps) {
  const isRookie = variant === 'rookie' || (wins === 0 && losses === 0 && draws === 0);
  const label = isRookie ? `Rookie` : `Record ${wins}-${losses}-${draws}`;
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex h-6 items-center rounded-sm bg-surface-2 px-2 font-mono text-xs font-bold uppercase tracking-wide tabular-nums',
        isRookie ? 'text-hazard' : 'text-text-primary',
        className,
      )}
    >
      {isRookie ? 'ROOKIE' : fmtRecord(wins, losses, draws)}
    </span>
  );
}
