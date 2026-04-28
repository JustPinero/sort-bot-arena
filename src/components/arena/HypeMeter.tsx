import { cn } from '@/lib/cn';

interface HypeMeterProps {
  level: number;
  className?: string;
}

export function HypeMeter({ level, className }: HypeMeterProps) {
  const pct = Math.max(0, Math.min(1, level));
  const isPeak = pct >= 0.95;
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Hype meter"
      className={cn('flex items-center gap-2', className)}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
        Hype
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-surface-2">
        <div
          aria-hidden="true"
          style={{ width: `${pct * 100}%` }}
          className={cn(
            'h-full transition-all duration-quick ease-out',
            isPeak ? 'bg-hazard shadow-glow-hazard' : 'bg-tech',
          )}
        />
      </div>
      {isPeak ? (
        <span className="font-display text-sm uppercase tracking-wider text-hazard animate-pulse-broadcast">
          PEAK
        </span>
      ) : null}
    </div>
  );
}
