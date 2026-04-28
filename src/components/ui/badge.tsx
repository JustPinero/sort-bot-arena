import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

import type { HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex h-6 items-center rounded-sm px-2 font-mono text-xs font-bold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-text-primary',
        hazard: 'bg-hazard-bg text-hazard',
        combat: 'bg-combat-bg text-combat',
        champion: 'bg-champion-bg text-champion shadow-glow-champion',
        rookie: 'bg-hazard-bg text-hazard',
        record: 'bg-surface-2 text-text-primary tabular-nums',
        victory: 'bg-victory-bg text-victory',
        tech: 'bg-tech-bg text-tech',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
