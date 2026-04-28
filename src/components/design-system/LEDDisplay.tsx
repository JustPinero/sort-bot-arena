import { cn } from '@/lib/cn';

export type LEDFormat = 'time' | 'score' | 'count';
export type LEDGlow = 'hazard' | 'tech' | 'champion';

interface LEDDisplayProps {
  value: string | number;
  format?: LEDFormat;
  glow?: LEDGlow;
  label?: string;
  className?: string;
}

const GLOW_CLASSES: Record<LEDGlow, string> = {
  hazard: 'text-hazard [text-shadow:0_0_12px_rgba(250,204,21,0.6)]',
  tech: 'text-tech [text-shadow:0_0_12px_rgba(6,182,212,0.6)]',
  champion: 'text-champion [text-shadow:0_0_16px_rgba(251,191,36,0.7)]',
};

export function LEDDisplay({
  value,
  format = 'count',
  glow = 'hazard',
  label,
  className,
}: LEDDisplayProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      data-format={format}
      className={cn(
        'led-frame inline-flex items-center font-mono text-2xl font-bold tabular-nums tracking-wide',
        GLOW_CLASSES[glow],
        className,
      )}
    >
      {String(value)}
    </span>
  );
}
