import { Link } from 'react-router-dom';

import type { BotRun } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtRelativeDate } from '@/lib/format';

interface FightHistoryTableProps {
  runs: BotRun[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

const OUTCOME_VARIANT: Record<BotRun['outcome'], 'victory' | 'combat' | 'default'> = {
  win: 'victory',
  loss: 'combat',
  draw: 'default',
  no_contest: 'default',
};

export function FightHistoryTable({
  runs,
  isLoading,
  hasMore,
  onLoadMore,
  className,
}: FightHistoryTableProps) {
  if (!isLoading && runs.length === 0) {
    return (
      <p
        className={cn(
          'rounded-md border bg-surface-1 p-6 text-center text-sm text-text-tertiary',
          className,
        )}
      >
        No fights yet.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <table className="w-full table-auto text-left">
        <caption className="sr-only">Fight history</caption>
        <thead>
          <tr className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            <th scope="col" className="pb-2 font-medium">
              Opponent
            </th>
            <th scope="col" className="pb-2 font-medium">
              Result
            </th>
            <th scope="col" className="pb-2 font-medium">
              Method
            </th>
            <th scope="col" className="pb-2 font-medium">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t">
              <td className="py-3">
                <Link
                  to={`/bots/${run.opponent_id}`}
                  className="text-text-primary underline-offset-2 hover:underline"
                >
                  {run.opponent_nickname ?? run.opponent_id}
                </Link>
              </td>
              <td className="py-3">
                <Badge variant={OUTCOME_VARIANT[run.outcome]}>{run.outcome.toUpperCase()}</Badge>
              </td>
              <td className="py-3 font-mono text-xs uppercase tracking-wide text-text-secondary">
                {run.ko ? 'KO' : 'DEC'}
              </td>
              <td className="py-3 text-sm text-text-secondary">{fmtRelativeDate(run.date)}</td>
            </tr>
          ))}
          {isLoading
            ? Array.from({ length: 3 }, (_, i) => (
                <tr key={`skel-${i}`} className="border-t">
                  <td colSpan={4} className="py-3">
                    <div className="h-4 w-full animate-pulse rounded-sm bg-surface-2" />
                  </td>
                </tr>
              ))
            : null}
        </tbody>
      </table>

      {hasMore && onLoadMore ? (
        <Button variant="ghost" onClick={onLoadMore} className="self-center">
          Load more
        </Button>
      ) : null}
    </div>
  );
}
