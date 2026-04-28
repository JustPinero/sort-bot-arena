import { useLeaderboard } from '@/api/queries';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { FilterChips } from '@/components/leaderboard/FilterChips';
import { PodiumTop3 } from '@/components/leaderboard/PodiumTop3';
import { RankingsTable } from '@/components/leaderboard/RankingsTable';
import { useLeaderboardFilters } from '@/hooks/useLeaderboardFilters';

export default function LeaderboardPage() {
  const { filters, setWeight, setActivity, setSort } = useLeaderboardFilters();
  const { data, isLoading, isError } = useLeaderboard(filters);

  const entries = data?.items ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">P4P Rankings</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Pound for pound — across every weight class
        </p>
      </header>

      <FilterChips
        className="mt-8"
        weight={filters.weight}
        activity={filters.activity}
        sort={filters.sort}
        onWeightChange={setWeight}
        onActivityChange={setActivity}
        onSortChange={setSort}
      />

      {isError ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-combat">
          Could not load the leaderboard. Try again.
        </p>
      ) : (
        <>
          {entries.length > 0 ? (
            <div className="mt-8">
              <PodiumTop3 entries={entries} />
            </div>
          ) : null}

          <div className="mt-12">
            <RankingsTable
              entries={entries}
              isLoading={isLoading}
              startRank={entries.some((e) => e.rank <= 3) ? 4 : undefined}
            />
          </div>
        </>
      )}
    </section>
  );
}
