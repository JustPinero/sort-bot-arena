import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

import type { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium transition-all duration-snap ease-snap focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'h-10 rounded-md border bg-transparent px-4 text-text-primary hover:bg-surface-2 hover:border-text-secondary',
        combat:
          'h-12 rounded-combat bg-hazard px-6 font-display text-xl uppercase tracking-wider text-surface-0 hover:shadow-glow-hazard hover:-translate-y-px',
        'combat-secondary':
          'h-12 rounded-combat border-2 border-combat bg-transparent px-6 font-display text-xl uppercase tracking-wider text-combat hover:bg-combat hover:text-text-primary',
        champion:
          'h-12 rounded-md border-2 border-champion bg-champion-bg px-6 font-display text-xl uppercase tracking-wider text-champion shadow-glow-champion hover:animate-glow-cycle',
        ghost:
          'h-10 rounded-md px-4 text-text-secondary hover:bg-surface-2 hover:text-text-primary',
        destructive:
          'h-10 rounded-md border border-combat bg-transparent px-4 text-combat hover:bg-combat hover:text-text-primary',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
