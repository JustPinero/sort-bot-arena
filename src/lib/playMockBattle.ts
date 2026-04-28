import type { BattleEvent } from '@/api/types';

interface PlayMockBattleOptions {
  fighterAId: string;
  fighterBId: string;
  rounds?: number;
  blowoutWinner?: 'a' | 'b' | null;
  speedMs?: number;
  onEvent: (event: BattleEvent) => void;
  onComplete?: () => void;
}

const ts = () => new Date().toISOString();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const COMMENTARY = [
  'BOT A IS COOKING ON THIS INPUT',
  'WHAT A MASTERCLASS — BOT A FINISHES IN UNDER A FRAME',
  'BOT B PUSHES BACK — STILL IN THIS',
  'THE CROWD IS ON ITS FEET',
  'TECHNICAL EXCELLENCE FROM BOTH SIDES',
];

export interface MockBattleHandle {
  cancel: () => void;
  promise: Promise<void>;
}

export function playMockBattle(opts: PlayMockBattleOptions): MockBattleHandle {
  const {
    fighterAId,
    fighterBId,
    rounds = 5,
    blowoutWinner = null,
    speedMs = 600,
    onEvent,
    onComplete,
  } = opts;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  const emit = (e: BattleEvent) => {
    if (!cancelled) onEvent(e);
  };

  async function run() {
    emit({ type: 'walkout', bot_id: fighterAId, ts: ts() });
    await sleep(speedMs);
    if (cancelled) return;
    emit({ type: 'walkout', bot_id: fighterBId, ts: ts() });
    await sleep(speedMs);
    if (cancelled) return;
    emit({ type: 'fight_start', ts: ts() });

    let aWins = 0;
    let bWins = 0;

    for (let round = 1; round <= rounds; round++) {
      if (cancelled) return;

      emit({
        type: 'round_start',
        round,
        input_id: `in_demo_${round}`,
        input_name: `Input ${round}`,
        ts: ts(),
      });

      // a few progress ticks
      for (let p = 25; p <= 100; p += 25) {
        await sleep(speedMs / 4);
        if (cancelled) return;
        emit({
          type: 'round_progress',
          round,
          bot_id: fighterAId,
          progress_pct: p,
          ts: ts(),
        });
      }

      const winnerIsA = blowoutWinner === 'a' || (blowoutWinner === null && Math.random() > 0.5);
      const winnerId = winnerIsA ? fighterAId : fighterBId;
      const aTime = winnerIsA ? 0.04 + Math.random() * 0.02 : 0.12 + Math.random() * 0.05;
      const bTime = winnerIsA ? 0.12 + Math.random() * 0.05 : 0.04 + Math.random() * 0.02;

      emit({
        type: 'round_end',
        round,
        winner_bot_id: winnerId,
        a_time_seconds: Number(aTime.toFixed(3)),
        b_time_seconds: Number(bTime.toFixed(3)),
        delta_seconds: Number((aTime - bTime).toFixed(3)),
        ts: ts(),
      });

      if (winnerIsA) aWins++;
      else bWins++;

      // sprinkle in commentary
      if (round % 2 === 0) {
        await sleep(speedMs / 3);
        if (cancelled) return;
        emit({
          type: 'commentary',
          text: COMMENTARY[(round + aWins) % COMMENTARY.length] ?? '',
          ts: ts(),
        });
      }

      await sleep(speedMs);
    }

    if (cancelled) return;

    const winnerWins = aWins > bWins ? aWins : bWins;
    const isBlowout = winnerWins / rounds >= 0.8;
    const finalWinner = aWins > bWins ? fighterAId : aWins < bWins ? fighterBId : null;

    emit({
      type: 'fight_end',
      winner_bot_id: finalWinner,
      outcome: isBlowout ? 'ko' : finalWinner ? 'decision' : 'draw',
      a_rounds_won: aWins,
      b_rounds_won: bWins,
      ts: ts(),
    });

    onComplete?.();
  }

  const promise = run();
  return { cancel, promise };
}
