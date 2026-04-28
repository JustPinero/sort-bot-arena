import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useMyBots, useRetireBot } from '@/api/queries';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function MyFightersPage() {
  const { data, isLoading } = useMyBots();
  const retire = useRetireBot();
  const [retiring, setRetiring] = useState<string | null>(null);

  const bots = data ?? [];

  const onRetire = async (botId: string) => {
    setRetiring(botId);
    try {
      await retire.mutateAsync(botId);
    } finally {
      setRetiring(null);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">My Fighters</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Bots you&apos;ve registered
        </p>
      </header>

      {isLoading ? (
        <div className="mt-8 h-32 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      {!isLoading && bots.length === 0 ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-text-tertiary">
          No fighters yet. Head to{' '}
          <Link to="/submit" className="text-hazard underline-offset-2 hover:underline">
            Submit
          </Link>{' '}
          to register one.
        </p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-3">
        {bots.map((bot) => {
          const headline = bot.nickname ?? bot.display_name;
          return (
            <li
              key={bot.id}
              className="flex items-center gap-4 rounded-md border bg-surface-1 p-4 transition-colors duration-snap hover:bg-surface-2"
            >
              <CornerColorBadge botId={bot.id} size="lg" />
              <div className="flex flex-1 flex-col gap-1">
                <Link
                  to={`/bots/${bot.id}`}
                  className="font-display text-2xl uppercase tracking-wide hover:underline"
                >
                  {headline}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <WeightClassChip language={bot.language} />
                  <RecordChip
                    wins={bot.record.wins}
                    losses={bot.record.losses}
                    draws={bot.record.draws}
                  />
                  {bot.rank ? <Badge variant="tech">#{bot.rank}</Badge> : null}
                  {bot.retired ? <Badge variant="combat">Retired</Badge> : null}
                </div>
              </div>
              {!bot.retired ? (
                <Button
                  variant="destructive"
                  onClick={() => onRetire(bot.id)}
                  disabled={retiring === bot.id}
                >
                  {retiring === bot.id ? 'Retiring…' : 'Retire'}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
