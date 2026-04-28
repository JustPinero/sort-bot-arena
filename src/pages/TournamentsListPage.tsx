import { Link } from 'react-router-dom';

import { useTournaments } from '@/api/queries';
import type { Tournament } from '@/api/types';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Badge } from '@/components/ui/badge';
import { fmtDate } from '@/lib/format';

function statusBadge(status: Tournament['status']) {
  if (status === 'active') return <Badge variant="hazard">Live tonight</Badge>;
  if (status === 'upcoming') return <Badge variant="tech">Upcoming</Badge>;
  return <Badge variant="default">Completed</Badge>;
}

export default function TournamentsListPage() {
  const { data, isLoading } = useTournaments();
  const tournaments = data?.items ?? [];

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">Tournaments</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Fight nights
        </p>
      </header>

      {isLoading ? (
        <div className="mt-8 h-40 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      {!isLoading && tournaments.length === 0 ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-text-tertiary">
          No tournaments scheduled.
        </p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {tournaments.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-3 rounded-md border bg-surface-1 p-4 transition-colors duration-snap hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              {statusBadge(t.status)}
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                {fmtDate(t.scheduled_at)}
              </span>
            </div>
            <Link
              to={`/tournaments/${t.id}`}
              className="font-display text-2xl uppercase tracking-wide hover:underline"
            >
              {t.name}
            </Link>
            <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
              {t.participant_count} fighters · {t.rounds_total} rounds
              {t.weight_class_filter ? ` · ${t.weight_class_filter}-only` : ''}
            </p>
            {t.prize_description ? (
              <p className="text-sm text-text-secondary">Prize: {t.prize_description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
