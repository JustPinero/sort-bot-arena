import { Link, useParams } from 'react-router-dom';

import { apiErrorStatus } from '@/api/error-helpers';
import { usePerInputLeaderboard } from '@/api/queries';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtRelativeDate, fmtTime } from '@/lib/format';

export default function PerInputLeaderboardPage() {
  const { inputId } = useParams<{ inputId: string }>();
  const { data, isLoading, isError, error } = usePerInputLeaderboard(inputId);

  if (isError) {
    const status = apiErrorStatus(error) ?? 0;
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">
          {status === 404 ? 'Input not found' : 'Could not load this input'}
        </h1>
        <Button variant="combat" asChild className="mt-8">
          <Link to="/leaderboard">Back to Rankings</Link>
        </Button>
      </section>
    );
  }

  if (isLoading || !data) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <HazardStripes thickness="thick" />
        <div className="mt-8 h-12 w-1/2 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-4 h-72 w-full animate-pulse rounded-md bg-surface-2" />
      </section>
    );
  }

  const { input, items } = data;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Per-input leaderboard
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">{input.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
          <Badge variant="tech">n = {input.size.toLocaleString()}</Badge>
          {input.description ? <span>{input.description}</span> : null}
        </div>
      </header>

      <table className="mt-8 w-full table-auto text-left">
        <caption className="sr-only">Per-input rankings for {input.name}</caption>
        <thead>
          <tr className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            <th scope="col" className="pb-2 font-medium">
              Rank
            </th>
            <th scope="col" className="pb-2 font-medium">
              Fighter
            </th>
            <th scope="col" className="pb-2 font-medium">
              Time
            </th>
            <th scope="col" className="pb-2 font-medium">
              Set
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const headline = row.nickname ?? row.display_name;
            return (
              <tr
                key={row.bot_id}
                className="border-t transition-colors duration-snap hover:bg-surface-2"
              >
                <td className="py-3">
                  <span className="font-mono text-sm font-bold tabular-nums">
                    #{row.rank_in_field}
                  </span>
                </td>
                <td className="py-3">
                  <Link
                    to={`/bots/${row.bot_id}`}
                    className="flex items-center gap-3 text-text-primary"
                  >
                    <CornerColorBadge botId={row.bot_id} size="md" />
                    <div className="flex flex-col">
                      <span className="font-display text-base uppercase tracking-wide">
                        {headline}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
                        {row.display_name}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="py-3 font-mono text-sm tabular-nums text-hazard">
                  {fmtTime(row.time_seconds)}
                </td>
                <td className="py-3 text-sm text-text-tertiary">
                  {fmtRelativeDate(row.achieved_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
