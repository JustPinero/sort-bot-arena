import { cn } from '@/lib/cn';

interface TrashTalkBubbleProps {
  speaker: string;
  text: string | null | undefined;
  side: 'left' | 'right';
  className?: string;
}

const GENERIC_TAUNTS = [
  'Sort or be sorted.',
  "I've never seen a slower partition.",
  'Pivot? Try crater.',
  "You're just an unstable bubble.",
];

export function TrashTalkBubble({ speaker, text, side, className }: TrashTalkBubbleProps) {
  // Stable fallback per speaker so the same bot gets the same generic taunt.
  const fallbackIdx =
    speaker.length === 0
      ? 0
      : Math.abs([...speaker].reduce((a, c) => a + c.charCodeAt(0), 0)) % GENERIC_TAUNTS.length;
  const line = text ?? GENERIC_TAUNTS[fallbackIdx] ?? GENERIC_TAUNTS[0]!;

  return (
    <figure
      className={cn(
        'max-w-sm rounded-md border bg-surface-2 p-4',
        side === 'right' && 'self-end text-right',
        className,
      )}
    >
      <blockquote
        className={cn('text-sm italic text-text-primary', side === 'right' && 'text-right')}
      >
        “{line}”
      </blockquote>
      <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
        — {speaker}
      </figcaption>
    </figure>
  );
}
