import type { Bot } from '@/api/types';
import { cn } from '@/lib/cn';

import { FighterCard } from './FighterCard';
import { VSBadge } from './VSBadge';

export type TaleOfTheTapeMode = 'pre-fight' | 'active' | 'post-fight' | 'static';

interface TaleOfTheTapeProps {
  fighterA: Bot;
  fighterB: Bot | null;
  mode?: TaleOfTheTapeMode;
  emphasizeBot?: string;
  showVS?: boolean;
  onFighterClick?: (botId: string) => void;
  className?: string;
}

export function TaleOfTheTape({
  fighterA,
  fighterB,
  mode = 'static',
  emphasizeBot,
  showVS = true,
  onFighterClick,
  className,
}: TaleOfTheTapeProps) {
  const interactive = mode === 'pre-fight' || mode === 'post-fight' || mode === 'static';

  if (fighterB === null) {
    return (
      <div className={cn('mx-auto w-full max-w-[420px]', className)} data-mode={mode}>
        <FighterCard
          bot={fighterA}
          interactive={interactive && Boolean(onFighterClick)}
          emphasized={emphasizeBot === fighterA.id}
          onFighterClick={onFighterClick}
        />
      </div>
    );
  }

  return (
    <div
      data-mode={mode}
      className={cn(
        '@container mx-auto w-full',
        'flex flex-col items-center justify-center gap-6',
        '@[800px]:flex-row @[800px]:items-stretch @[800px]:gap-4',
        className,
      )}
    >
      <FighterCard
        bot={fighterA}
        interactive={interactive && Boolean(onFighterClick)}
        emphasized={emphasizeBot === fighterA.id}
        onFighterClick={onFighterClick}
      />

      {showVS ? (
        <>
          <div className="hidden @[800px]:flex @[800px]:items-center">
            <VSBadge size="md" />
          </div>
          <div className="w-full @[800px]:hidden">
            <VSBadge orientation="horizontal" />
          </div>
        </>
      ) : null}

      <FighterCard
        bot={fighterB}
        interactive={interactive && Boolean(onFighterClick)}
        emphasized={emphasizeBot === fighterB.id}
        onFighterClick={onFighterClick}
      />
    </div>
  );
}
