import { useEffect, useState } from 'react';

import type { BattleEvent, Bot } from '@/api/types';
import type { BattleDerivedState } from '@/lib/battleReducer';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';

import { CommentaryFeed } from './CommentaryFeed';
import { FighterPortraitFrame } from './FighterPortraitFrame';
import { HypeMeter } from './HypeMeter';
import { RoundCounter } from './RoundCounter';
import { StatSlamIn } from './StatSlamIn';

interface LiveBattleProps {
  fighterA: Bot;
  fighterB: Bot;
  events: BattleEvent[];
  derived: BattleDerivedState;
  roundsTotal: number;
  className?: string;
}

interface CueState {
  attackingSide: 'left' | 'right' | null;
  shakenSide: 'left' | 'right' | null;
  slamText: string | null;
}

const CUE_DURATION_MS = 1400;

export function LiveBattle({
  fighterA,
  fighterB,
  events,
  derived,
  roundsTotal,
  className,
}: LiveBattleProps) {
  const [cue, setCue] = useState<CueState>({
    attackingSide: null,
    shakenSide: null,
    slamText: null,
  });

  // Drive animation cues from the *latest* event so we don't replay history.
  useEffect(() => {
    const last = events.at(-1);
    if (!last) return;
    if (last.type === 'round_end') {
      const aWon = last.winner_bot_id === fighterA.id;
      const fasterTime = aWon ? last.a_time_seconds : last.b_time_seconds;
      const slowerTime = aWon ? last.b_time_seconds : last.a_time_seconds;
      const ratio = slowerTime > 0 ? slowerTime / Math.max(fasterTime, 0.001) : 1;
      setCue({
        attackingSide: aWon ? 'left' : 'right',
        shakenSide: aWon ? 'right' : 'left',
        slamText: `ROUND ${last.round} — ${aWon ? (fighterA.nickname ?? 'A') : (fighterB.nickname ?? 'B')} BY ${Math.abs(
          last.delta_seconds,
        ).toFixed(3)}s · ${ratio.toFixed(1)}× FASTER`,
      });
      const id = window.setTimeout(
        () => setCue({ attackingSide: null, shakenSide: null, slamText: null }),
        CUE_DURATION_MS,
      );
      return () => window.clearTimeout(id);
    }
    if (last.type === 'fighter_downed') {
      const downedSide = last.bot_id === fighterA.id ? 'left' : 'right';
      setCue({
        attackingSide: downedSide === 'left' ? 'right' : 'left',
        shakenSide: downedSide,
        slamText: `DOWNED — ${last.reason.toUpperCase()}`,
      });
      const id = window.setTimeout(
        () => setCue({ attackingSide: null, shakenSide: null, slamText: null }),
        CUE_DURATION_MS,
      );
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [events, fighterA, fighterB]);

  const lastRoundResult = [...events].reverse().find((e) => e.type === 'round_end') ?? null;

  return (
    <section
      aria-label="Live battle"
      className={cn('relative flex flex-col gap-4 px-4 py-6', className)}
    >
      <HypeMeter level={derived.hypeLevel} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <FighterPortraitFrame
          bot={fighterA}
          side="left"
          health={derived.aHealth}
          attacking={cue.attackingSide === 'left'}
          shaken={cue.shakenSide === 'left'}
        />

        <div className="flex flex-col items-center gap-4">
          <RoundCounter current={derived.currentRound} total={roundsTotal} />
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
            {derived.currentInputName ?? 'Awaiting input'}
          </p>
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span className="text-victory">{derived.aRoundsWon}</span>
            <span className="text-text-tertiary">VS</span>
            <span className="text-victory">{derived.bRoundsWon}</span>
          </div>
          {lastRoundResult && lastRoundResult.type === 'round_end' ? (
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
              Last: {fmtTime(lastRoundResult.a_time_seconds)} vs{' '}
              {fmtTime(lastRoundResult.b_time_seconds)}
            </p>
          ) : null}
          {cue.attackingSide ? (
            <span
              aria-hidden="true"
              data-testid="attack-beam"
              data-side={cue.attackingSide}
              className={cn(
                'block h-1 w-32 origin-center rounded-full bg-hazard shadow-glow-hazard',
                cue.attackingSide === 'left'
                  ? 'animate-[slam-in_400ms_ease-out_forwards]'
                  : 'animate-[slam-in_400ms_ease-out_forwards]',
              )}
            />
          ) : null}
        </div>

        <FighterPortraitFrame
          bot={fighterB}
          side="right"
          health={derived.bHealth}
          attacking={cue.attackingSide === 'right'}
          shaken={cue.shakenSide === 'right'}
        />
      </div>

      <CommentaryFeed events={events} className="mt-6" />

      <StatSlamIn text={cue.slamText} />
    </section>
  );
}
