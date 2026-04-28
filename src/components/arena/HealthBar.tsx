import { cn } from '@/lib/cn';

interface HealthBarProps {
  value: number;
  maxValue?: number;
  cornerColor?: string;
  label?: string;
  className?: string;
}

const SEGMENTS = 10;

export function HealthBar({
  value,
  maxValue = 100,
  cornerColor,
  label,
  className,
}: HealthBarProps) {
  const pct = Math.max(0, Math.min(1, value / maxValue));
  const litSegments = Math.round(pct * SEGMENTS);
  const color = cornerColor ?? 'var(--hazard-yellow)';

  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Health'}
      className={cn('flex items-center gap-1', className)}
    >
      <div className="flex flex-1 gap-[2px] bg-surface-inset p-1">
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const lit = i < litSegments;
          const danger = i < 3 && lit;
          return (
            <span
              key={i}
              aria-hidden="true"
              style={{
                backgroundColor: lit ? (danger ? 'var(--combat-red)' : color) : 'var(--surface-3)',
              }}
              className="h-3 flex-1 transition-colors duration-snap"
            />
          );
        })}
      </div>
      <span className="font-mono text-[10px] font-bold tabular-nums text-text-secondary">
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}
