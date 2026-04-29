import { Link } from 'react-router-dom';

import { useHomeSnapshot } from '@/api/queries';
import type { FeedItem } from '@/api/types';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Badge } from '@/components/ui/badge';
import { fmtRelativeDate } from '@/lib/format';

const KIND_BADGE: Record<FeedItem['kind'], 'hazard' | 'combat' | 'tech' | 'champion' | 'default'> =
  {
    rank_change: 'tech',
    submission: 'default',
    ko: 'combat',
    tournament: 'hazard',
    achievement: 'champion',
  };

export default function EventsFeedPage() {
  const { data, isLoading } = useHomeSnapshot();
  const items = data?.ticker ?? [];

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">Live Events</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Global activity · KOs, submissions, rank changes, tournaments
        </p>
      </header>

      {isLoading ? (
        <div className="mt-8 h-32 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      <ul aria-live="polite" className="mt-8 flex flex-col gap-2">
        {items.map((item) => {
          const inner = (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-surface-1 px-4 py-3 transition-colors duration-snap hover:bg-surface-2">
              <Badge variant={KIND_BADGE[item.kind]}>{item.kind.replace('_', ' ')}</Badge>
              <span className="flex-1 font-mono text-sm uppercase tracking-wide text-text-primary">
                {item.text}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
                {fmtRelativeDate(item.ts)}
              </span>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link to={item.href} aria-label={item.text}>
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
