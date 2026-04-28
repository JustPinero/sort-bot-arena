import { cn } from '@/lib/cn';

interface VSBadgeProps {
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-12 w-12 text-xl',
  md: 'h-20 w-20 text-3xl',
  lg: 'h-24 w-24 text-4xl',
};

export function VSBadge({ orientation = 'vertical', size = 'md', className }: VSBadgeProps) {
  if (orientation === 'horizontal') {
    return (
      <div
        role="presentation"
        aria-hidden="true"
        className={cn('flex w-full items-center gap-3', className)}
      >
        <div className="hazard-stripes-thin h-2 flex-1" />
        <span className="font-display text-3xl uppercase tracking-widest text-hazard">VS</span>
        <div className="hazard-stripes-thin h-2 flex-1" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="versus"
      className={cn(
        'relative grid place-items-center rounded-full border-4 border-hazard bg-surface-0 font-display uppercase tracking-wider text-hazard shadow-glow-hazard',
        SIZE_CLASS[size],
        className,
      )}
    >
      <span aria-hidden="true">VS</span>
    </div>
  );
}
