import { cn } from '@/lib/cn';

interface ScoutingReportProps {
  analysis: string | null | undefined;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

export function ScoutingReport({ analysis, isLoading, isError, className }: ScoutingReportProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-md bg-surface-1 p-6', className)} aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded-sm bg-surface-2" />
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <section
        aria-labelledby="scouting-empty"
        className={cn('rounded-md border bg-surface-1 p-6 text-center', className)}
      >
        <h3
          id="scouting-empty"
          className="font-mono text-xs uppercase tracking-widest text-text-tertiary"
        >
          Scouting Report
        </h3>
        <p className="mt-3 font-display text-2xl uppercase tracking-wide text-text-secondary">
          Analysis not available
        </p>
        <p className="mt-2 text-sm text-text-tertiary">
          The AI breakdown for this fighter has not been generated yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="scouting-heading"
      className={cn('rounded-md border bg-surface-1 p-6', className)}
    >
      <h3 id="scouting-heading" className="font-mono text-xs uppercase tracking-widest text-tech">
        Breakdown
      </h3>
      <p className="mt-3 whitespace-pre-wrap text-base text-text-primary">{analysis}</p>
    </section>
  );
}
