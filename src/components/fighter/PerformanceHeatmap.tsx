import type { InputPerformance } from '@/api/types';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';

interface PerformanceHeatmapProps {
  data: InputPerformance[];
  className?: string;
}

function colorFor(rank: number, total: number): string {
  const pct = rank / Math.max(total, 1);
  if (pct < 0.2) return 'var(--tech-cyan)';
  if (pct < 0.4) return 'var(--victory-green)';
  if (pct < 0.7) return 'var(--surface-3)';
  return 'var(--combat-red)';
}

export function PerformanceHeatmap({ data, className }: PerformanceHeatmapProps) {
  if (data.length === 0) {
    return (
      <p
        className={cn(
          'rounded-md border bg-surface-1 p-6 text-center text-sm text-text-tertiary',
          className,
        )}
      >
        No input data yet.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul
        aria-label="Per-input performance"
        className="grid auto-rows-[44px] list-none grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1 p-0"
      >
        {data.map((row) => {
          const tone = colorFor(row.rank_in_field, row.total_in_field);
          return (
            <li
              key={row.input_id}
              title={`${row.input_name} · ${fmtTime(row.time_seconds)} · #${row.rank_in_field}/${row.total_in_field}`}
              aria-label={`${row.input_name}: ${fmtTime(row.time_seconds)}, ranked ${row.rank_in_field} of ${row.total_in_field}`}
              style={{ backgroundColor: tone }}
              className="grid place-items-center font-mono text-[10px] tabular-nums text-surface-0 transition-transform duration-snap hover:scale-105"
            >
              {row.rank_in_field}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
        <span>
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-3 w-3 align-middle"
            style={{ backgroundColor: 'var(--tech-cyan)' }}
          />
          Finishing move
        </span>
        <span>
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-3 w-3 align-middle"
            style={{ backgroundColor: 'var(--victory-green)' }}
          />
          Strong
        </span>
        <span>
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-3 w-3 align-middle"
            style={{ backgroundColor: 'var(--combat-red)' }}
          />
          Exposed
        </span>
      </div>
    </div>
  );
}
