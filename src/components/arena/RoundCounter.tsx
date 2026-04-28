import { LEDDisplay } from '@/components/design-system/LEDDisplay';
import { cn } from '@/lib/cn';

interface RoundCounterProps {
  current: number;
  total: number;
  className?: string;
}

export function RoundCounter({ current, total, className }: RoundCounterProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">Round</p>
      <LEDDisplay
        value={`${current}/${total}`}
        format="count"
        glow="hazard"
        label={`Round ${current} of ${total}`}
      />
    </div>
  );
}
