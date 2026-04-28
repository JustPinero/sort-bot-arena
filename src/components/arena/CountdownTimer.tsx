import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  className?: string;
}

export function CountdownTimer({ seconds, onComplete, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, onComplete]);

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Fight starts in ${remaining}`}
      className={cn(
        'font-display text-5xl uppercase tracking-widest text-hazard',
        '[text-shadow:0_0_24px_rgba(250,204,21,0.6)]',
        className,
      )}
    >
      {remaining}
    </div>
  );
}
