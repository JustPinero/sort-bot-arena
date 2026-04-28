import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

interface StatSlamInProps {
  text: string | null;
  durationMs?: number;
  onComplete?: () => void;
  className?: string;
}

export function StatSlamIn({ text, durationMs = 2000, onComplete, className }: StatSlamInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) return;
    setVisible(true);
    const id = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [text, durationMs, onComplete]);

  if (!text || !visible) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center',
        className,
      )}
    >
      <p
        className={cn(
          'animate-slam-in border-4 border-hazard bg-surface-0/90 px-6 py-4 font-display text-3xl uppercase tracking-wider text-hazard',
          'shadow-glow-hazard',
        )}
      >
        {text}
      </p>
    </div>
  );
}
