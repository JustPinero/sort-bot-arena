import { Link } from 'react-router-dom';

import { useTournaments } from '@/api/queries';
import type { Tournament, TournamentStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';

const MAX_RECENT = 6;

function statusBadge(status: TournamentStatus) {
  if (status === 'active') return <Badge variant="hazard">Live</Badge>;
  if (status === 'upcoming') return <Badge variant="tech">Upcoming</Badge>;
  return <Badge variant="default">Completed</Badge>;
}

export function RecentTournamentsList() {
  const { data, isLoading, isError } = useTournaments();
  const tournaments = (data?.items ?? []).slice(0, MAX_RECENT);

  return (
    <section
      aria-labelledby="recent-tournaments-heading"
      data-testid="recent-tournaments"
      className="mt-12"
    >
      <h2
        id="recent-tournaments-heading"
        className="font-display text-2xl uppercase tracking-wide"
      >
        Recent Tournaments
      </h2>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Brackets from the last few cards.
      </p>

      {isError ? (
        <p className="mt-4 rounded-md border bg-surface-1 p-6 text-center text-combat">
          Could not load recent tournaments.
        </p>
      ) : null}

      {isLoading ? (
        <div
          data-testid="recent-tournaments-loading"
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <div className="h-28 animate-pulse rounded-md bg-surface-2" />
          <div className="h-28 animate-pulse rounded-md bg-surface-2" />
          <div className="h-28 animate-pulse rounded-md bg-surface-2" />
        </div>
      ) : null}

      {!isLoading && !isError && tournaments.length === 0 ? (
        <div className="mt-4 rounded-md border bg-surface-1 p-6 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-text-secondary">
            No recent tournaments yet.
          </p>
          <p className="mt-2 text-sm text-text-tertiary">
            Hit{' '}
            <span className="font-mono text-xs uppercase tracking-wide text-tech">
              Setup a tournament
            </span>{' '}
            above to run the first one.
          </p>
        </div>
      ) : null}

      {!isLoading && tournaments.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t: Tournament) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-md border bg-surface-1 p-4 transition-colors duration-snap hover:bg-surface-2"
            >
              <div className="flex items-center justify-between">
                {statusBadge(t.status)}
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
                  {t.participant_count} fighters
                </span>
              </div>
              <Link
                to={`/tournaments/${t.id}`}
                className="font-display text-lg uppercase tracking-wide hover:underline"
              >
                {t.name}
              </Link>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                {t.rounds_total} rounds
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
