import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useBattle, useBot } from '@/api/queries';
import type { BattleEvent } from '@/api/types';
import { LiveBattle } from '@/components/arena/LiveBattle';
import { PostFightDecision } from '@/components/arena/PostFightDecision';
import { PreFightStaredown } from '@/components/arena/PreFightStaredown';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Button } from '@/components/ui/button';
import { deriveBattleState } from '@/lib/battleReducer';
import { playMockBattle } from '@/lib/playMockBattle';

type Phase = 'pre_fight' | 'live' | 'completed';

export default function BattlePage() {
  const { battleId } = useParams<{ battleId: string }>();
  const battleQuery = useBattle(battleId);
  const battle = battleQuery.data;

  const fighterAQuery = useBot(battle?.fighter_a.bot_id);
  const fighterBQuery = useBot(battle?.fighter_b.bot_id);

  const [phase, setPhase] = useState<Phase>('pre_fight');
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const handleRef = useRef<{ cancel: () => void } | null>(null);

  const startBout = () => {
    if (!battle || handleRef.current) return;
    setPhase('live');
    setEvents([]);
    handleRef.current = playMockBattle({
      fighterAId: battle.fighter_a.bot_id,
      fighterBId: battle.fighter_b.bot_id,
      rounds: battle.rounds_total,
      speedMs: 600,
      onEvent: (event) => {
        setEvents((prev) => [...prev, event]);
        if (event.type === 'fight_end') {
          setPhase('completed');
        }
      },
    });
  };

  const replay = () => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setEvents([]);
    setPhase('pre_fight');
  };

  useEffect(() => {
    return () => {
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, []);

  const derived = useMemo(
    () => deriveBattleState(events, battle?.fighter_a.bot_id ?? '', battle?.fighter_b.bot_id ?? ''),
    [events, battle?.fighter_a.bot_id, battle?.fighter_b.bot_id],
  );

  if (battleQuery.isLoading || fighterAQuery.isLoading || fighterBQuery.isLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-12 w-48 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-6 h-72 w-full animate-pulse rounded-md bg-surface-2" />
      </section>
    );
  }

  if (battleQuery.isError || !battle) {
    const status = (battleQuery.error as { status?: number } | null)?.status ?? 0;
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">
          {status === 404 ? 'Battle not on the card' : 'Battle could not load'}
        </h1>
        <Button variant="combat" asChild className="mt-8">
          <Link to="/arena">Back to Arena</Link>
        </Button>
      </section>
    );
  }

  if (!fighterAQuery.data || !fighterBQuery.data) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-combat">Fighters not in the database.</p>
      </section>
    );
  }

  const a = fighterAQuery.data;
  const b = fighterBQuery.data;
  const finalEvent = events.find((e) => e.type === 'fight_end') as
    | Extract<BattleEvent, { type: 'fight_end' }>
    | undefined;

  return (
    <>
      {phase === 'pre_fight' ? (
        <PreFightStaredown
          fighterA={a}
          fighterB={b}
          countdownSeconds={5}
          onEnterArena={startBout}
        />
      ) : null}

      {phase === 'live' || (phase === 'completed' && !finalEvent) ? (
        <LiveBattle
          fighterA={a}
          fighterB={b}
          events={events}
          derived={derived}
          roundsTotal={battle.rounds_total}
        />
      ) : null}

      {phase === 'completed' && finalEvent ? (
        <PostFightDecision fighterA={a} fighterB={b} finalEvent={finalEvent} onReplay={replay} />
      ) : null}
    </>
  );
}
