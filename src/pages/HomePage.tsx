import { Link } from 'react-router-dom';

import { useHomeSnapshot } from '@/api/queries';
import type { FeedItem } from '@/api/types';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtRelativeDate } from '@/lib/format';

const KIND_BADGE: Record<FeedItem['kind'], 'hazard' | 'combat' | 'tech' | 'champion' | 'default'> =
  {
    rank_change: 'tech',
    submission: 'default',
    ko: 'combat',
    tournament: 'hazard',
    achievement: 'champion',
  };

function TickerLine({ item }: { item: FeedItem }) {
  const inner = (
    <span className="flex items-center gap-3 whitespace-nowrap px-4">
      <Badge variant={KIND_BADGE[item.kind]}>{item.kind.replace('_', ' ')}</Badge>
      <span className="font-mono text-xs uppercase tracking-widest text-text-secondary">
        {item.text}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
        {fmtRelativeDate(item.ts)}
      </span>
    </span>
  );
  if (item.href) {
    return (
      <Link to={item.href} className="hover:text-text-primary">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function HomePage() {
  const { data, isLoading } = useHomeSnapshot();

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex items-center gap-4">
        <HazardStripes thickness="thick" className="h-8 flex-1" />
        <h1 className="font-display text-5xl uppercase tracking-widest">Sort Arena</h1>
        <HazardStripes thickness="thick" className="h-8 flex-1" />
      </header>
      <p className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Live broadcast — pound-for-pound rankings, fight nights, and KOs
      </p>

      {isLoading ? (
        <div className="mt-8 h-12 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      {data ? (
        <>
          <div
            aria-label="Broadcast ticker"
            className="mt-8 flex h-12 items-center overflow-hidden rounded-md border bg-surface-1"
          >
            <ul className="flex animate-[ticker_60s_linear_infinite] gap-1 hover:[animation-play-state:paused]">
              {[...data.ticker, ...data.ticker].map((item, i) => (
                <li key={`${item.id}-${i}`} className="border-r last:border-r-0">
                  <TickerLine item={item} />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {data.champion ? (
              <div className="rounded-md border-2 border-champion bg-champion-bg p-4 shadow-glow-champion">
                <div className="flex items-center gap-3">
                  <ChampionBelt active />
                  <p className="font-mono text-xs uppercase tracking-widest text-champion">
                    Champion&apos;s corner
                  </p>
                </div>
                <p className="mt-3 font-display text-3xl uppercase tracking-wide">
                  {data.champion.nickname ?? data.champion.display_name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CornerColorBadge botId={data.champion.bot_id} size="md" />
                  <WeightClassChip language={data.champion.language} />
                  <RecordChip
                    wins={data.champion.record.wins}
                    losses={data.champion.record.losses}
                    draws={data.champion.record.draws}
                  />
                </div>
                <Button variant="combat" asChild className="mt-4">
                  <Link to={`/bots/${data.champion.bot_id}`}>View Profile</Link>
                </Button>
              </div>
            ) : null}

            {data.featured_battle_id ? (
              <div className="rounded-md border bg-surface-1 p-4">
                <p className="font-mono text-xs uppercase tracking-widest text-tech">
                  Featured fight
                </p>
                <p className="mt-3 font-display text-2xl uppercase tracking-wide">
                  Live tonight in the Arena
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  The biggest matchup on the card right now.
                </p>
                <Button variant="combat" asChild className="mt-4">
                  <Link to={`/arena/${data.featured_battle_id}`}>Enter Arena</Link>
                </Button>
              </div>
            ) : null}

            {data.biggest_upset ? (
              <div className="rounded-md border-2 border-combat bg-combat-bg p-4">
                <p className="font-mono text-xs uppercase tracking-widest text-combat">
                  Biggest upset
                </p>
                <p className="mt-3 font-display text-2xl uppercase tracking-wide">
                  {data.biggest_upset.text}
                </p>
                <Button variant="combat-secondary" asChild className="mt-4">
                  <Link to={`/arena/${data.biggest_upset.battle_id}`}>Watch Replay</Link>
                </Button>
              </div>
            ) : null}
          </div>

          {data.rookie_of_the_day ? (
            <div className="mt-8 rounded-md border bg-surface-1 p-4">
              <p className="font-mono text-xs uppercase tracking-widest text-hazard">
                Rookie of the day
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CornerColorBadge botId={data.rookie_of_the_day.bot_id} size="lg" />
                <Link
                  to={`/bots/${data.rookie_of_the_day.bot_id}`}
                  className={cn('font-display text-2xl uppercase tracking-wide hover:underline')}
                >
                  {data.rookie_of_the_day.nickname ?? data.rookie_of_the_day.display_name}
                </Link>
                <WeightClassChip language={data.rookie_of_the_day.language} />
                <RecordChip
                  wins={data.rookie_of_the_day.record.wins}
                  losses={data.rookie_of_the_day.record.losses}
                  draws={data.rookie_of_the_day.record.draws}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
