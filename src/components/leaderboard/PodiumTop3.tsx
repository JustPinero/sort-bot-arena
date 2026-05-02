import { Link } from 'react-router-dom';

import type { LeaderboardEntry } from '@/api/types';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { PortraitFallback } from '@/components/fighter/PortraitFallback';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';
import { isAllowedImageUrl } from '@/lib/imageHost';

interface PodiumTop3Props {
  entries: LeaderboardEntry[];
  className?: string;
}

const POSITIONS = [
  {
    rank: 2,
    label: 'Silver',
    accent: 'text-text-secondary',
    border: 'border-text-secondary',
    height: 'h-[420px]',
  },
  {
    rank: 1,
    label: 'Champion',
    accent: 'text-champion',
    border: 'border-champion',
    height: 'h-[480px]',
  },
  {
    rank: 3,
    label: 'Bronze',
    accent: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-700 dark:border-orange-400',
    height: 'h-[400px]',
  },
] as const;

function PodiumCard({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: (typeof POSITIONS)[number];
}) {
  const headline = entry.nickname ?? entry.display_name;
  const portraitOk = isAllowedImageUrl(entry.portrait_url);
  const isChampion = position.rank === 1;

  return (
    <Link
      to={`/bots/${entry.bot_id}`}
      aria-label={`Rank ${entry.rank}: ${headline}`}
      className={cn(
        'flex flex-col overflow-hidden border-4 bg-surface-1 transition-all duration-snap hover:scale-[1.02] hover:shadow-glow-hazard',
        position.border,
        position.height,
        isChampion && 'animate-glow-cycle',
      )}
    >
      <HazardStripes thickness="thin" />

      <div className="relative aspect-square w-full bg-surface-inset">
        {portraitOk && entry.portrait_url ? (
          <img
            src={entry.portrait_url}
            alt={headline}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <PortraitFallback botId={entry.bot_id} language={entry.language} />
        )}

        <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
          {isChampion ? <ChampionBelt active /> : null}
          <Badge
            variant={isChampion ? 'champion' : 'default'}
            className={cn('font-display text-2xl', position.accent)}
          >
            #{entry.rank}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p
          className={cn(
            'font-mono text-[11px] font-bold uppercase tracking-widest',
            position.accent,
          )}
        >
          {position.label}
        </p>
        <h2 className="font-display text-2xl uppercase leading-none tracking-wide">{headline}</h2>
        <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          {entry.display_name}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <CornerColorBadge botId={entry.bot_id} size="sm" />
          <WeightClassChip language={entry.language} />
          <RecordChip
            wins={entry.record.wins}
            losses={entry.record.losses}
            draws={entry.record.draws}
          />
        </div>

        {entry.signature_input ? (
          <p className="font-mono text-xs text-text-secondary">
            Signature: {entry.signature_input.input_name} ·{' '}
            <span className="text-hazard">{fmtTime(entry.signature_input.time_seconds)}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function PodiumTop3({ entries, className }: PodiumTop3Props) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const positions = POSITIONS.filter((p) => byRank.has(p.rank));

  if (positions.length === 0) return null;

  return (
    <section
      aria-label="Top 3 fighters"
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end', className)}
    >
      {positions.map((p) => {
        const entry = byRank.get(p.rank);
        if (!entry) return null;
        return <PodiumCard key={p.rank} entry={entry} position={p} />;
      })}
    </section>
  );
}
