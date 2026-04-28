import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useBot, useBotInputPerformance } from '@/api/queries';
import type { InputPerformance } from '@/api/types';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { TaleOfTheTape } from '@/components/fighter/TaleOfTheTape';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';

interface SharedRow {
  input_id: string;
  input_name: string;
  size: number;
  a_time: number;
  b_time: number;
  delta_seconds: number;
}

function buildSharedRows(a: InputPerformance[], b: InputPerformance[]): SharedRow[] {
  const bIndex = new Map(b.map((r) => [r.input_id, r]));
  const rows: SharedRow[] = [];
  for (const ra of a) {
    const rb = bIndex.get(ra.input_id);
    if (!rb) continue;
    rows.push({
      input_id: ra.input_id,
      input_name: ra.input_name,
      size: ra.size,
      a_time: ra.time_seconds,
      b_time: rb.time_seconds,
      delta_seconds: ra.time_seconds - rb.time_seconds,
    });
  }
  return rows.sort((x, y) => Math.abs(y.delta_seconds) - Math.abs(x.delta_seconds));
}

export default function HeadToHeadPage() {
  const { a, b } = useParams<{ a: string; b: string }>();
  const aQuery = useBot(a);
  const bQuery = useBot(b);
  const aInputs = useBotInputPerformance(a);
  const bInputs = useBotInputPerformance(b);

  const sharedRows = useMemo(
    () => buildSharedRows(aInputs.data ?? [], bInputs.data ?? []),
    [aInputs.data, bInputs.data],
  );

  if (aQuery.isLoading || bQuery.isLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-[600px] w-full animate-pulse bg-surface-2" aria-busy="true" />
      </section>
    );
  }

  if (aQuery.isError || bQuery.isError || !aQuery.data || !bQuery.data) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">
          Matchup not available
        </h1>
        <p className="mt-2 text-text-secondary">One of these fighters is not in the database.</p>
        <Button variant="combat" asChild className="mt-8">
          <Link to="/leaderboard">Back to Rankings</Link>
        </Button>
      </section>
    );
  }

  const botA = aQuery.data;
  const botB = bQuery.data;
  const aLabel = botA.nickname ?? botA.display_name;
  const bLabel = botB.nickname ?? botB.display_name;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="sr-only">
        {aLabel} vs {bLabel}
      </h1>

      <TaleOfTheTape fighterA={botA} fighterB={botB} mode="static" />

      <div className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Shared inputs ({sharedRows.length})
        </h2>
        {sharedRows.length === 0 ? (
          <p className="mt-3 rounded-md border bg-surface-1 p-6 text-center text-sm text-text-tertiary">
            These fighters have not run on the same inputs yet.
          </p>
        ) : (
          <table className="mt-4 w-full table-auto text-left">
            <caption className="sr-only">Shared input performance comparison</caption>
            <thead>
              <tr className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                <th scope="col" className="pb-2 font-medium">
                  Input
                </th>
                <th scope="col" className="pb-2 font-medium">
                  {aLabel}
                </th>
                <th scope="col" className="pb-2 font-medium">
                  {bLabel}
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Delta
                </th>
              </tr>
            </thead>
            <tbody>
              {sharedRows.map((row) => {
                const aWins = row.delta_seconds < 0;
                const margin = Math.abs(row.delta_seconds);
                const decisive = margin / Math.max(row.a_time, row.b_time) > 0.3;
                return (
                  <tr key={row.input_id} className="border-t">
                    <td className="py-3">
                      <p className="text-text-primary">{row.input_name}</p>
                      <p className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
                        n = {row.size.toLocaleString()}
                      </p>
                    </td>
                    <td
                      className={cn(
                        'py-3 font-mono tabular-nums',
                        aWins ? 'text-victory' : 'text-text-primary',
                      )}
                    >
                      {fmtTime(row.a_time)}
                    </td>
                    <td
                      className={cn(
                        'py-3 font-mono tabular-nums',
                        !aWins ? 'text-victory' : 'text-text-primary',
                      )}
                    >
                      {fmtTime(row.b_time)}
                    </td>
                    <td className="py-3">
                      <Badge variant={decisive ? (aWins ? 'victory' : 'combat') : 'default'}>
                        {aWins ? 'A' : 'B'} +{margin.toFixed(3)}s
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
