import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { EvaluationEvent } from '@/api/types';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { LEDDisplay } from '@/components/design-system/LEDDisplay';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';

interface DebutEvaluationProps {
  botId: string;
  events: EvaluationEvent[];
  className?: string;
}

export function DebutEvaluation({ botId, events, className }: DebutEvaluationProps) {
  const navigate = useNavigate();
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const lastProgress = [...events].reverse().find((e) => e.type === 'eval_progress') as
    | Extract<EvaluationEvent, { type: 'eval_progress' }>
    | undefined;
  const startEvent = events.find((e) => e.type === 'eval_start') as
    | Extract<EvaluationEvent, { type: 'eval_start' }>
    | undefined;
  const complete = events.find((e) => e.type === 'eval_complete') as
    | Extract<EvaluationEvent, { type: 'eval_complete' }>
    | undefined;
  const failed = events.find((e) => e.type === 'eval_failed') as
    | Extract<EvaluationEvent, { type: 'eval_failed' }>
    | undefined;

  const total = lastProgress?.total ?? startEvent?.total ?? 0;
  const completed = lastProgress?.completed ?? 0;
  const pct = total === 0 ? 0 : completed / total;

  useEffect(() => {
    if (!complete) return;
    setRedirectIn(3);
    const tick = window.setInterval(
      () => setRedirectIn((s) => (s === null || s <= 0 ? s : s - 1)),
      1000,
    );
    const id = window.setTimeout(() => navigate(`/bots/${complete.bot_id}`), 3000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(tick);
    };
  }, [complete, navigate]);

  return (
    <section
      aria-label="Debut evaluation"
      className={cn('mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8', className)}
    >
      <HazardStripes thickness="thick" />

      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Debut evaluation · {botId}
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-wide">
          {complete ? 'Fighter Debut Complete' : failed ? 'Debut Failed' : 'Running The Gauntlet…'}
        </h1>
      </header>

      {!complete && !failed ? (
        <div className="rounded-md border bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
              Progress
            </span>
            <LEDDisplay
              value={`${completed}/${total}`}
              format="count"
              glow="hazard"
              label="evaluation progress"
            />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-sm bg-surface-2">
            <div
              role="progressbar"
              aria-valuenow={Math.round(pct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Evaluation progress"
              style={{ width: `${pct * 100}%` }}
              className="h-full bg-hazard transition-all duration-quick"
            />
          </div>
          {lastProgress?.rank_estimate ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
              Currently projected:{' '}
              <span className="text-hazard">#{lastProgress.rank_estimate}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <ol
        aria-live="polite"
        className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border bg-surface-1 p-3"
      >
        {events.length === 0 ? (
          <li className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            Waiting for the corner to ring the bell…
          </li>
        ) : null}
        {events.map((e, i) => (
          <li
            key={`${e.type}-${i}`}
            className="font-mono text-xs uppercase tracking-wide text-text-secondary"
          >
            {e.type === 'eval_start' ? `EVAL START — ${e.total} inputs` : null}
            {e.type === 'eval_progress'
              ? `${e.input_name} — ${fmtTime(e.time_seconds)}${
                  e.rank_estimate ? ` · projected #${e.rank_estimate}` : ''
                }`
              : null}
            {e.type === 'eval_complete'
              ? `EVAL COMPLETE — final rank ${
                  e.final_rank ? `#${e.final_rank}` : 'unranked'
                }, record ${e.record.wins}-${e.record.losses}-${e.record.draws}`
              : null}
            {e.type === 'eval_failed' ? `EVAL FAILED — ${e.reason}` : null}
          </li>
        ))}
      </ol>

      {complete ? (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-text-secondary">
          Redirecting to fighter profile in {redirectIn ?? 3}s…
        </p>
      ) : null}

      {failed ? (
        <p className="rounded-md border border-combat bg-combat-bg p-4 text-combat">
          {failed.reason}
        </p>
      ) : null}
    </section>
  );
}
