import { cn } from '@/lib/cn';
import { weightClass } from '@/lib/weightClass';

interface WeightClassChipProps {
  language: string;
  className?: string;
}

export function WeightClassChip({ language, className }: WeightClassChipProps) {
  const cls = weightClass(language);
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-sm bg-tech-bg px-2 font-mono text-xs font-bold uppercase tracking-wide text-tech',
        className,
      )}
    >
      {cls}
    </span>
  );
}
