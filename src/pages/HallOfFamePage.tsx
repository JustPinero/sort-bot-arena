import { Link } from 'react-router-dom';

import { useHallOfFame } from '@/api/queries';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';

export default function HallOfFamePage() {
  const { data, isLoading } = useHallOfFame();
  const bots = data ?? [];

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">Hall of Fame</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Retired fighters · Final career stats
        </p>
      </header>

      {isLoading ? (
        <div className="mt-8 h-32 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      {!isLoading && bots.length === 0 ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-text-tertiary">
          No fighters in the Hall of Fame yet.
        </p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {bots.map((bot) => {
          const headline = bot.nickname ?? bot.display_name;
          return (
            <li
              key={bot.id}
              className="flex flex-col gap-3 rounded-md border bg-surface-1 p-4 opacity-90 grayscale transition-all duration-snap hover:opacity-100 hover:grayscale-0"
            >
              <div className="flex items-center gap-3">
                <CornerColorBadge botId={bot.id} size="lg" />
                <Link
                  to={`/bots/${bot.id}`}
                  className="font-display text-2xl uppercase tracking-wide hover:underline"
                >
                  {headline}
                </Link>
                <Badge variant="combat" className="ml-auto">
                  Retired
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WeightClassChip language={bot.language} />
                <RecordChip
                  wins={bot.record.wins}
                  losses={bot.record.losses}
                  draws={bot.record.draws}
                />
              </div>
              {bot.algorithm ? (
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
                  {bot.algorithm}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
