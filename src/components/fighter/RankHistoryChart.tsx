import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { BotSnapshot } from '@/api/types';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';

interface RankHistoryChartProps {
  snapshots: BotSnapshot[];
  className?: string;
}

interface ChartDatum {
  label: string;
  rank: number;
}

export function RankHistoryChart({ snapshots, className }: RankHistoryChartProps) {
  if (snapshots.length === 0) {
    return (
      <p
        className={cn(
          'rounded-md border bg-surface-1 p-6 text-center text-sm text-text-tertiary',
          className,
        )}
      >
        No rank history yet.
      </p>
    );
  }

  const data: ChartDatum[] = snapshots.map((s) => ({
    label: fmtDate(s.date),
    rank: s.rank,
  }));

  const maxRank = Math.max(...snapshots.map((s) => s.rank));

  return (
    <div
      className={cn('rounded-md border bg-surface-1 p-4', className)}
      aria-label="Rank history over time"
      role="img"
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--border-default)" strokeDasharray="2 4" />
          <XAxis
            dataKey="label"
            stroke="var(--text-tertiary)"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-emphasis)' }}
          />
          <YAxis
            reversed
            domain={[1, Math.max(maxRank, 10)]}
            stroke="var(--text-tertiary)"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-emphasis)' }}
            tickFormatter={(v: number) => `#${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border-emphasis)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(v) => [`#${v as number}`, 'rank']}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="var(--champion-gold)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--champion-gold)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
