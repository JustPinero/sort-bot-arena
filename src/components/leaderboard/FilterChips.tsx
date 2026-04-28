import type { ActivityFilter, LeaderboardSort, WeightClassFilter } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

interface FilterChipsProps {
  weight: WeightClassFilter;
  activity: ActivityFilter;
  sort: LeaderboardSort;
  onWeightChange: (w: WeightClassFilter) => void;
  onActivityChange: (a: ActivityFilter) => void;
  onSortChange: (s: LeaderboardSort) => void;
  className?: string;
}

const WEIGHTS: { value: WeightClassFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'heavyweight', label: 'Heavy' },
  { value: 'cruiserweight', label: 'Cruiser' },
  { value: 'middleweight', label: 'Middle' },
  { value: 'lightweight', label: 'Light' },
];

const ACTIVITIES: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

const SORTS: { value: LeaderboardSort; label: string }[] = [
  { value: 'rank', label: 'Rank' },
  { value: 'wins', label: 'Wins' },
  { value: 'ko', label: 'KO%' },
  { value: 'recent', label: 'Recent' },
  { value: 'alphabetical', label: 'A–Z' },
];

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  current: T;
  onChange: (v: T) => void;
}

function ChipGroup<T extends string>({ label, options, current, onChange }: ChipGroupProps<T>) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span
        aria-hidden="true"
        className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary"
      >
        {label}
      </span>
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center rounded-sm px-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors duration-snap',
              active
                ? 'bg-hazard text-surface-0'
                : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function FilterChips({
  weight,
  activity,
  sort,
  onWeightChange,
  onActivityChange,
  onSortChange,
  className,
}: FilterChipsProps) {
  const anyActive = weight !== 'all' || activity !== 'all' || sort !== 'rank';

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-label="Leaderboard filters">
      <div className="flex flex-wrap items-center gap-4">
        <ChipGroup
          label="Weight class"
          options={WEIGHTS}
          current={weight}
          onChange={onWeightChange}
        />
        {anyActive ? (
          <Badge variant="hazard" className="ml-auto">
            Filtered
          </Badge>
        ) : null}
      </div>
      <ChipGroup
        label="Activity"
        options={ACTIVITIES}
        current={activity}
        onChange={onActivityChange}
      />
      <ChipGroup label="Sort" options={SORTS} current={sort} onChange={onSortChange} />
    </div>
  );
}
