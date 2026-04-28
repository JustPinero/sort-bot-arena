import { cn } from '@/lib/cn';

interface ChampionBeltProps {
  active?: boolean;
  className?: string;
}

export function ChampionBelt({ active = false, className }: ChampionBeltProps) {
  return (
    <span
      role="img"
      aria-label={active ? 'Champion' : 'Champion belt (inactive)'}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md border-2 border-champion bg-surface-1 px-3 font-display text-sm uppercase tracking-wider text-champion',
        active && 'animate-glow-cycle shadow-glow-champion',
        className,
      )}
    >
      <svg viewBox="0 0 32 16" className="mr-2 h-4 w-8" aria-hidden="true">
        <rect x="0" y="3" width="32" height="10" fill="currentColor" />
        <circle cx="16" cy="8" r="3" fill="var(--surface-0)" />
      </svg>
      Champion
    </span>
  );
}
