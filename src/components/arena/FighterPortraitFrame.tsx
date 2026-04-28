import type { Bot } from '@/api/types';
import { PortraitFallback } from '@/components/fighter/PortraitFallback';
import { cn } from '@/lib/cn';
import { cornerColor } from '@/lib/cornerColor';
import { isAllowedImageUrl } from '@/lib/imageHost';

import { HealthBar } from './HealthBar';

interface FighterPortraitFrameProps {
  bot: Bot;
  side: 'left' | 'right';
  health: number;
  attacking?: boolean;
  shaken?: boolean;
  className?: string;
}

function damageFilterClasses(health: number): string {
  if (health <= 10) return 'brightness-50 contrast-150 saturate-50';
  if (health <= 25) return 'brightness-75 saturate-75';
  if (health <= 50) return 'brightness-90';
  return '';
}

export function FighterPortraitFrame({
  bot,
  side,
  health,
  attacking,
  shaken,
  className,
}: FighterPortraitFrameProps) {
  const headline = bot.nickname ?? bot.display_name;
  const portraitOk = isAllowedImageUrl(bot.portrait_url);
  const corner = cornerColor(bot.id);

  return (
    <div
      className={cn(
        'relative flex w-full max-w-md flex-col items-center gap-3',
        side === 'right' ? 'items-end' : 'items-start',
        className,
      )}
    >
      <div
        style={{ borderColor: corner, boxShadow: `0 0 24px ${corner}55` }}
        className={cn(
          'relative aspect-square w-full overflow-hidden border-4 bg-surface-inset transition-transform duration-quick ease-snap',
          attacking && (side === 'left' ? 'translate-x-2' : '-translate-x-2'),
          shaken && 'animate-shake',
        )}
      >
        {portraitOk && bot.portrait_url ? (
          <img
            src={bot.portrait_url}
            alt={headline}
            className={cn(
              'h-full w-full object-cover transition-all duration-smooth',
              damageFilterClasses(health),
            )}
            loading="eager"
          />
        ) : (
          <PortraitFallback botId={bot.id} language={bot.language} />
        )}
        {health <= 25 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 mix-blend-multiply"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent 0px, transparent 2px, rgba(255,0,0,0.2) 2px, rgba(255,0,0,0.2) 3px)',
            }}
          />
        ) : null}
      </div>

      <p
        className={cn(
          'font-display text-2xl uppercase tracking-wide text-text-primary',
          side === 'right' && 'text-right',
        )}
      >
        {headline}
      </p>
      <HealthBar value={health} cornerColor={corner} label={`${headline} health`} />
    </div>
  );
}
