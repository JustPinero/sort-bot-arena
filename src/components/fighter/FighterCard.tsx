import { useId, useMemo } from 'react';

import type { Bot } from '@/api/types';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { cornerColor } from '@/lib/cornerColor';
import { fmtTime } from '@/lib/format';
import { isAllowedImageUrl } from '@/lib/imageHost';

import { AchievementIconStrip } from './AchievementIconStrip';
import { PortraitFallback } from './PortraitFallback';

import type { ReactNode } from 'react';

interface FighterCardProps {
  bot: Bot;
  interactive?: boolean;
  emphasized?: boolean;
  onFighterClick?: (botId: string) => void;
  className?: string;
}

const FORM_LABEL: Record<'W' | 'L' | 'D', string> = {
  W: 'win',
  L: 'loss',
  D: 'draw',
};

function StatLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
      {children}
    </p>
  );
}

export function FighterCard({
  bot,
  interactive = false,
  emphasized = false,
  onFighterClick,
  className,
}: FighterCardProps) {
  const headingId = useId();
  const isChampion = bot.rank === 1 && !bot.retired;
  const isRookie = bot.record.wins === 0 && bot.record.losses === 0 && bot.record.draws === 0;
  const corner = useMemo(() => cornerColor(bot.id), [bot.id]);
  const portraitOk = isAllowedImageUrl(bot.portrait_url);
  const headline = bot.nickname ?? bot.display_name;

  const cardChildren = (
    <article
      data-retired={bot.retired || undefined}
      data-emphasized={emphasized || undefined}
      data-interactive={interactive || undefined}
      aria-labelledby={headingId}
      style={{ borderColor: corner }}
      className={cn(
        'group relative flex w-full max-w-[380px] flex-col overflow-hidden border-4 bg-surface-1 text-left text-text-primary transition-all duration-snap',
        bot.retired && 'opacity-80 grayscale',
        emphasized && 'shadow-glow-hazard',
        interactive && 'group-hover:scale-[1.02] hover:scale-[1.02] hover:shadow-glow-hazard',
        isChampion && 'animate-glow-cycle',
      )}
    >
      <HazardStripes thickness="thin" />

      <div className="relative aspect-square w-full bg-surface-inset">
        {portraitOk && bot.portrait_url ? (
          <img
            src={bot.portrait_url}
            alt={headline}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <PortraitFallback botId={bot.id} language={bot.language} />
        )}
        {isChampion ? (
          <div className="absolute right-2 top-2">
            <ChampionBelt active />
          </div>
        ) : null}
        {bot.retired ? (
          <div className="absolute left-2 top-2">
            <Badge variant="combat">Retired</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <h3 id={headingId} className="font-display text-3xl uppercase leading-none tracking-wide">
          {headline}
        </h3>
        <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          {bot.nickname ? bot.display_name : null}
          {bot.nickname && bot.algorithm ? ' · ' : null}
          {bot.algorithm}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <WeightClassChip language={bot.language} />
          {isRookie ? (
            <RecordChip wins={0} losses={0} draws={0} variant="rookie" />
          ) : (
            <RecordChip
              wins={bot.record.wins}
              losses={bot.record.losses}
              draws={bot.record.draws}
            />
          )}
          {bot.rank != null ? (
            <Badge variant={isChampion ? 'champion' : 'tech'}>
              {isChampion ? '#1' : `#${bot.rank}`}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <StatLabel>Signature Move</StatLabel>
            <p className="mt-1 text-sm text-text-primary">
              {bot.signature_input
                ? `${bot.signature_input.input_name} · ${fmtTime(bot.signature_input.time_seconds)}`
                : '—'}
            </p>
          </div>
          <div>
            <StatLabel>Achilles Heel</StatLabel>
            <p className="mt-1 text-sm text-text-primary">
              {bot.achilles_heel
                ? `${bot.achilles_heel.input_name} · ${fmtTime(bot.achilles_heel.time_seconds)}`
                : '—'}
            </p>
          </div>
          <div>
            <StatLabel>KO %</StatLabel>
            <p className="mt-1 font-mono text-lg font-bold text-hazard tabular-nums">
              {bot.ko_percentage.toFixed(1)}%
            </p>
          </div>
          <div>
            <StatLabel>Recent Form</StatLabel>
            {bot.recent_form.length > 0 ? (
              <ul className="mt-1 flex gap-1">
                {bot.recent_form.map((s, i) => (
                  <li
                    key={i}
                    aria-label={FORM_LABEL[s]}
                    className={cn(
                      'grid h-5 w-5 place-items-center rounded-sm font-mono text-xs font-bold',
                      s === 'W' && 'bg-victory-bg text-victory',
                      s === 'L' && 'bg-combat-bg text-combat',
                      s === 'D' && 'bg-surface-2 text-text-secondary',
                    )}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-text-tertiary">—</p>
            )}
          </div>
        </div>

        <div>
          <StatLabel>Achievements</StatLabel>
          <AchievementIconStrip className="mt-2" achievements={bot.achievements} />
        </div>
      </div>
    </article>
  );

  if (interactive && !bot.retired && onFighterClick) {
    return (
      <button
        type="button"
        onClick={() => onFighterClick(bot.id)}
        className={cn(
          'group inline-block w-full max-w-[380px] cursor-pointer text-left focus-visible:outline-none',
          className,
        )}
        aria-label={`Open profile: ${headline}`}
      >
        {cardChildren}
      </button>
    );
  }

  return <div className={cn('inline-block w-full max-w-[380px]', className)}>{cardChildren}</div>;
}
