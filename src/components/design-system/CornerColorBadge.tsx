import { cn } from '@/lib/cn';
import { cornerColor } from '@/lib/cornerColor';

interface CornerColorBadgeProps {
  botId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

export function CornerColorBadge({ botId, size = 'md', className }: CornerColorBadgeProps) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: cornerColor(botId) }}
      className={cn('inline-block rounded-sm', SIZES[size], className)}
    />
  );
}
