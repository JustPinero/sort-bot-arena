import type { Bot, BattleEvent, BattleOutcome, BattleRankChange } from '@/api/types';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { PortraitFallback } from '@/components/fighter/PortraitFallback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { isAllowedImageUrl } from '@/lib/imageHost';

interface PostFightDecisionProps {
  fighterA: Bot;
  fighterB: Bot;
  finalEvent: Extract<BattleEvent, { type: 'fight_end' }>;
  rankChange?: BattleRankChange;
  onReplay?: () => void;
  onNextFight?: () => void;
  className?: string;
}

function isBlowout(aWon: number, bWon: number): boolean {
  const total = aWon + bWon;
  if (total === 0) return false;
  const winnerRounds = Math.max(aWon, bWon);
  return winnerRounds / total >= 0.8;
}

function decisionTitle(outcome: BattleOutcome, blowout: boolean): string {
  if (outcome === 'ko') return 'Knockout';
  if (outcome === 'tko') return 'Technical Knockout';
  if (outcome === 'draw') return 'Draw';
  if (outcome === 'no_contest') return 'No Contest';
  return blowout ? 'Decisive Victory' : 'Decision Victory';
}

function FightPosterPortrait({ bot, variant }: { bot: Bot; variant: 'winner' | 'loser' }) {
  const portraitOk = isAllowedImageUrl(bot.portrait_url);
  return (
    <div
      className={cn(
        'relative aspect-square w-40 overflow-hidden border-4',
        variant === 'winner'
          ? 'border-champion shadow-glow-champion'
          : 'border-combat brightness-50 contrast-125 saturate-50',
      )}
    >
      {portraitOk && bot.portrait_url ? (
        <img
          src={bot.portrait_url}
          alt={bot.nickname ?? bot.display_name}
          className="h-full w-full object-cover"
        />
      ) : (
        <PortraitFallback botId={bot.id} language={bot.language} />
      )}
    </div>
  );
}

export function PostFightDecision({
  fighterA,
  fighterB,
  finalEvent,
  rankChange,
  onReplay,
  onNextFight,
  className,
}: PostFightDecisionProps) {
  const { winner_bot_id, outcome, a_rounds_won, b_rounds_won } = finalEvent;
  const blowout = isBlowout(a_rounds_won, b_rounds_won);
  const isKo = outcome === 'ko' || outcome === 'tko';
  const winnerBot =
    winner_bot_id === fighterA.id ? fighterA : winner_bot_id === fighterB.id ? fighterB : null;
  const loserBot = winnerBot ? (winnerBot.id === fighterA.id ? fighterB : fighterA) : null;
  const dethroned = Boolean(rankChange);

  return (
    <section
      aria-label="Post-fight decision"
      className={cn(
        'relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12 text-center',
        className,
      )}
    >
      <HazardStripes thickness="thick" />

      <h1
        className={cn(
          'font-display uppercase tracking-widest',
          isKo
            ? 'text-5xl text-combat [text-shadow:0_0_40px_rgba(220,38,38,0.6)]'
            : 'text-4xl text-hazard',
          'animate-slam-in',
        )}
      >
        {decisionTitle(outcome, blowout)}
      </h1>

      {winnerBot && loserBot ? (
        <div className="flex items-center gap-8">
          <FightPosterPortrait bot={winnerBot} variant="winner" />
          <div className="font-display text-3xl uppercase tracking-widest text-text-tertiary">
            DEFEATED
          </div>
          <FightPosterPortrait bot={loserBot} variant="loser" />
        </div>
      ) : null}

      <div className="rounded-md border bg-surface-1 px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
          Final scorecard
        </p>
        <div className="mt-2 flex items-center gap-6 font-display text-3xl uppercase tracking-wide tabular-nums">
          <span className={cn(a_rounds_won > b_rounds_won && 'text-victory')}>{a_rounds_won}</span>
          <span className="text-text-tertiary">·</span>
          <span className={cn(b_rounds_won > a_rounds_won && 'text-victory')}>{b_rounds_won}</span>
        </div>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-secondary">
          {winnerBot ? `Winner: ${winnerBot.nickname ?? winnerBot.display_name}` : 'No winner'}
        </p>
      </div>

      {dethroned ? (
        <div className="flex flex-col items-center gap-2">
          <ChampionBelt active />
          <p className="font-display text-xl uppercase tracking-wide text-champion">New Champion</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Badge variant={isKo ? 'combat' : 'default'}>
          {outcome.toUpperCase().replace('_', ' ')}
        </Badge>
        {blowout ? <Badge variant="hazard">Blowout</Badge> : null}
      </div>

      <div className="flex gap-3">
        {onReplay ? (
          <Button variant="default" onClick={onReplay}>
            Replay
          </Button>
        ) : null}
        {onNextFight ? (
          <Button variant="combat" onClick={onNextFight}>
            Next Fight
          </Button>
        ) : null}
      </div>
    </section>
  );
}
