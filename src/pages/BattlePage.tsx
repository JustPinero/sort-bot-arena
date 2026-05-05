import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiErrorStatus } from '@/api/error-helpers';
import { useBattle, useBot } from '@/api/queries';
import type { BattleEvent, BattleFighter, Bot } from '@/api/types';
import { LiveBattle } from '@/components/arena/LiveBattle';
import { PostFightDecision } from '@/components/arena/PostFightDecision';
import { PreFightStaredown } from '@/components/arena/PreFightStaredown';
import { BattleWeightClassChip } from '@/components/battle/BattleWeightClassChip';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Button } from '@/components/ui/button';
import { deriveBattleState } from '@/lib/battleReducer';
import { playMockBattle } from '@/lib/playMockBattle';

type Phase = 'pre_fight' | 'live' | 'completed';

// Synthesize a Bot shape from the BattleFighter that already rides on
// the battle response. Used when the dedicated `useBot` fetch returns
// undefined (upstream sort-bot-api occasionally 404s during sandbox
// rebuilds; TanStack's `retryNon4xx` won't retry, leaving the page
// stuck on "Fighters not in the database"). The battle response
// already carries bot_id / nickname / display_name / language /
// portrait_url / corner / rank — everything the arena components need
// to render the staredown, the live viewer, and the post-fight
// decision card. Rich fields the dedicated bot endpoint adds
// (record / KO% / signature_input / achilles_heel / recent_form /
// achievements / analysis) degrade to neutral defaults.
function botFromBattleFighter(f: BattleFighter): Bot {
  return {
    id: f.bot_id,
    display_name: f.display_name,
    nickname: f.nickname,
    language: f.language,
    algorithm: null,
    portrait_url: f.portrait_url,
    rank: f.rank,
    record: { wins: 0, losses: 0, draws: 0 },
    ko_percentage: 0,
    signature_input: null,
    achilles_heel: null,
    recent_form: [],
    achievements: [],
    trash_talk: f.trash_talk ?? null,
    analysis_url: null,
    retired: false,
  };
}

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

  // We only block on the `battle` fetch — fighter fetches degrade to
  // the BattleFighter on the battle response if they fail or are slow.
  if (battleQuery.isLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-12 w-48 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-6 h-72 w-full animate-pulse rounded-md bg-surface-2" />
      </section>
    );
  }

  if (battleQuery.isError || !battle) {
    const status = apiErrorStatus(battleQuery.error) ?? 0;
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

  // Prefer the rich Bot from the dedicated endpoint; fall back to the
  // synthesized shape from the battle response so a transient
  // upstream 404 on `/v1/bots/:id` never blocks the page from rendering.
  const a: Bot = fighterAQuery.data ?? botFromBattleFighter(battle.fighter_a);
  const b: Bot = fighterBQuery.data ?? botFromBattleFighter(battle.fighter_b);
  const finalEvent = events.find((e) => e.type === 'fight_end') as
    | Extract<BattleEvent, { type: 'fight_end' }>
    | undefined;

  return (
    <>
      {battle.weight_class ? (
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 pt-6">
          <BattleWeightClassChip weightClass={battle.weight_class} />
        </div>
      ) : null}

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
