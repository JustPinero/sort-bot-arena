import { ArrowDown, ArrowUp, Minus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { LeaderboardEntry, RankTrend } from '@/api/types';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { fmtRelativeDate, fmtTime } from '@/lib/format';

interface RankingsTableProps {
  entries: LeaderboardEntry[];
  isLoading?: boolean;
  startRank?: number;
  className?: string;
}

const TREND_ICON: Record<RankTrend, { icon: typeof ArrowUp; color: string; label: string }> = {
  up: { icon: ArrowUp, color: 'text-victory', label: 'rank up' },
  down: { icon: ArrowDown, color: 'text-combat', label: 'rank down' },
  steady: { icon: Minus, color: 'text-text-tertiary', label: 'unchanged' },
  new: { icon: Sparkles, color: 'text-hazard', label: 'new entrant' },
  returning: { icon: Sparkles, color: 'text-tech', label: 'returning' },
};

function TrendCell({ trend }: { trend: RankTrend }) {
  const t = TREND_ICON[trend];
  const Icon = t.icon;
  return (
    <span role="img" aria-label={t.label} className={cn('inline-flex items-center', t.color)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function RankingsTable({ entries, isLoading, startRank, className }: RankingsTableProps) {
  if (!isLoading && entries.length === 0) {
    return (
      <div className={cn('rounded-md border bg-surface-1 p-8 text-center', className)}>
        <p className="font-display text-2xl uppercase tracking-wide text-text-secondary">
          No fighters match these weight classes
        </p>
        <p className="mt-2 text-sm text-text-tertiary">Try expanding your search.</p>
      </div>
    );
  }

  const visible = startRank ? entries.filter((e) => e.rank >= startRank) : entries;

  return (
    <table className={cn('w-full table-auto text-left', className)}>
      <caption className="sr-only">P4P Rankings</caption>
      <thead>
        <tr className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          <th scope="col" className="pb-2 font-medium">
            Rank
          </th>
          <th scope="col" className="pb-2 font-medium">
            Fighter
          </th>
          <th scope="col" className="pb-2 font-medium">
            Record
          </th>
          <th scope="col" className="pb-2 font-medium">
            Weight
          </th>
          <th scope="col" className="pb-2 font-medium">
            KO%
          </th>
          <th scope="col" className="pb-2 font-medium">
            Signature
          </th>
          <th scope="col" className="pb-2 font-medium">
            Last fight
          </th>
        </tr>
      </thead>
      <tbody>
        {visible.map((e) => {
          const headline = e.nickname ?? e.display_name;
          return (
            <tr
              key={e.bot_id}
              className="border-t transition-colors duration-snap hover:bg-surface-2"
            >
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tabular-nums">#{e.rank}</span>
                  <TrendCell trend={e.trend} />
                </div>
              </td>
              <td className="py-3">
                <Link
                  to={`/bots/${e.bot_id}`}
                  className="flex items-center gap-3 text-text-primary"
                  aria-label={`Open profile: ${headline}`}
                >
                  <CornerColorBadge botId={e.bot_id} size="md" />
                  <div className="flex flex-col">
                    <span className="font-display text-base uppercase tracking-wide">
                      {headline}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
                      {e.display_name}
                    </span>
                  </div>
                </Link>
              </td>
              <td className="py-3">
                <RecordChip wins={e.record.wins} losses={e.record.losses} draws={e.record.draws} />
              </td>
              <td className="py-3">
                <WeightClassChip language={e.language} />
              </td>
              <td className="py-3 font-mono text-sm tabular-nums text-hazard">
                {e.ko_percentage.toFixed(1)}
              </td>
              <td className="py-3 text-sm text-text-secondary">
                {e.signature_input ? (
                  <>
                    <span className="text-text-primary">{e.signature_input.input_name}</span>
                    {' · '}
                    <span className="font-mono text-hazard">
                      {fmtTime(e.signature_input.time_seconds)}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-3 text-sm text-text-tertiary">
                {e.last_fight_at ? fmtRelativeDate(e.last_fight_at) : '—'}
              </td>
            </tr>
          );
        })}
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <tr key={`skel-${i}`} className="border-t">
                <td colSpan={7} className="py-3">
                  <Badge variant="default" className="sr-only">
                    Loading
                  </Badge>
                  <div className="h-4 w-full animate-pulse rounded-sm bg-surface-2" />
                </td>
              </tr>
            ))
          : null}
      </tbody>
    </table>
  );
}
