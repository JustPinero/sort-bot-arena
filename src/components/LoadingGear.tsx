import { Cog } from 'lucide-react';

import { cn } from '@/lib/cn';

interface LoadingGearProps {
  /** Tailwind size class — defaults to a hero-sized gear. */
  size?: string;
  /** Optional caption beneath the gear (e.g., "Loading rankings…"). */
  label?: string;
  /** Container className override. */
  className?: string;
}

export function LoadingGear({ size = 'h-24 w-24', label, className }: LoadingGearProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Cog
        className={cn(size, 'animate-spin text-hazard motion-reduce:animate-none')}
        style={{ animationDuration: '2.5s' }}
        aria-hidden="true"
      />
      {label ? (
        <span className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          {label}
        </span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}
