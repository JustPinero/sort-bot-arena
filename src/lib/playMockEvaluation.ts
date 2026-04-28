import type { EvaluationEvent } from '@/api/types';

interface PlayMockEvaluationOptions {
  botId: string;
  total?: number;
  speedMs?: number;
  onEvent: (event: EvaluationEvent) => void;
  onComplete?: () => void;
}

const SAMPLE_INPUTS = [
  'Random 1k',
  'Already Sorted',
  'Reverse Sorted',
  'Few Unique Keys',
  'Adversarial Quicksort Killer',
  'Random 10k',
  'Random 100k',
];

const ts = () => new Date().toISOString();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface MockEvaluationHandle {
  cancel: () => void;
  promise: Promise<void>;
}

export function playMockEvaluation(opts: PlayMockEvaluationOptions): MockEvaluationHandle {
  const { botId, total = SAMPLE_INPUTS.length, speedMs = 350, onEvent, onComplete } = opts;
  let cancelled = false;

  const emit = (event: EvaluationEvent) => {
    if (!cancelled) onEvent(event);
  };

  async function run() {
    emit({ type: 'eval_start', total, ts: ts() });
    let wins = 0;
    let losses = 0;
    for (let i = 0; i < total; i++) {
      await sleep(speedMs);
      if (cancelled) return;
      const time = Number((0.04 + Math.random() * 0.6).toFixed(3));
      const name = SAMPLE_INPUTS[i % SAMPLE_INPUTS.length] ?? `input ${i + 1}`;
      const rank_estimate = Math.max(1, 30 - Math.floor((i / total) * 20));
      const winning = Math.random() > 0.25;
      if (winning) wins++;
      else losses++;
      emit({
        type: 'eval_progress',
        input_id: `in_${i}`,
        input_name: name,
        time_seconds: time,
        rank_estimate,
        completed: i + 1,
        total,
        ts: ts(),
      });
    }
    if (cancelled) return;
    emit({
      type: 'eval_complete',
      bot_id: botId,
      final_rank: wins > losses ? Math.max(1, 14 - wins) : null,
      record: { wins, losses, draws: 0 },
      ts: ts(),
    });
    onComplete?.();
  }

  const promise = run();
  return {
    cancel: () => {
      cancelled = true;
    },
    promise,
  };
}
