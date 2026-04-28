import { cn } from '@/lib/cn';

interface HazardStripesProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: 'thin' | 'thick';
  className?: string;
}

export function HazardStripes({
  orientation = 'horizontal',
  thickness = 'thick',
  className,
}: HazardStripesProps) {
  const sizeClass = orientation === 'horizontal' ? 'h-4 w-full' : 'w-4 h-full';
  const patternClass = thickness === 'thin' ? 'hazard-stripes-thin' : 'hazard-stripes';
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(patternClass, sizeClass, className)}
    />
  );
}
