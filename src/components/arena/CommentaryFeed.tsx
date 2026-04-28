import { useEffect, useRef } from 'react';

import type { BattleEvent } from '@/api/types';
import { cn } from '@/lib/cn';

interface CommentaryFeedProps {
  events: BattleEvent[];
  maxItems?: number;
  className?: string;
}

function eventLine(event: BattleEvent): string | null {
  switch (event.type) {
    case 'walkout':
      return `WALKOUT — ${event.bot_id}`;
    case 'fight_start':
      return 'FIGHT START — let them work';
    case 'round_start':
      return `ROUND ${event.round} — ${event.input_name}`;
    case 'round_end':
      return `ROUND ${event.round} — winner ${event.winner_bot_id} by ${Math.abs(
        event.delta_seconds,
      ).toFixed(3)}s`;
    case 'fighter_downed':
      return `DOWNED — ${event.bot_id} (${event.reason})`;
    case 'commentary':
      return event.text;
    case 'fight_end':
      return `FIGHT END — ${event.outcome} for ${event.winner_bot_id ?? 'draw'}`;
    case 'round_progress':
      return null;
  }
}

export function CommentaryFeed({ events, maxItems = 12, className }: CommentaryFeedProps) {
  const ref = useRef<HTMLOListElement>(null);
  const lines = events
    .map((e) => ({ id: e.ts + e.type, line: eventLine(e), event: e }))
    .filter((x) => x.line !== null)
    .slice(-maxItems);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.scrollTo !== 'function') return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <aside aria-label="Live commentary" className={cn('flex flex-col', className)}>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Live commentary
      </h3>
      <ol
        ref={ref}
        aria-live="polite"
        className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border bg-surface-1 p-3"
      >
        {lines.map(({ id, line }) => (
          <li
            key={id}
            className="font-mono text-[12px] uppercase tracking-wide text-text-secondary"
          >
            {line}
          </li>
        ))}
        {lines.length === 0 ? (
          <li className="font-mono text-[12px] uppercase tracking-widest text-text-tertiary">
            Waiting for action…
          </li>
        ) : null}
      </ol>
    </aside>
  );
}
