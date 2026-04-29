import { useAchievementsCatalog } from '@/api/queries';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { AchievementIconStrip } from '@/components/fighter/AchievementIconStrip';

export default function AchievementsPage() {
  const { data, isLoading } = useAchievementsCatalog();
  const items = data ?? [];

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">Achievements</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          The whole catalog · Lower percentage means rarer
        </p>
      </header>

      {isLoading ? (
        <div className="mt-8 h-32 w-full animate-pulse rounded-md bg-surface-2" />
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((ach) => (
          <li key={ach.id} className="flex flex-col gap-2 rounded-md border bg-surface-1 p-4">
            <div className="flex items-center justify-between">
              <AchievementIconStrip achievements={[ach]} maxVisible={1} />
              <span className="font-mono text-xs uppercase tracking-widest text-champion tabular-nums">
                {ach.unlocked_pct.toFixed(1)}%
              </span>
            </div>
            <p className="font-display text-lg uppercase tracking-wide text-champion">{ach.name}</p>
            <p className="text-sm text-text-secondary">{ach.description}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              {ach.unlocked_pct < 1
                ? 'Mythic'
                : ach.unlocked_pct < 5
                  ? 'Legendary'
                  : ach.unlocked_pct < 20
                    ? 'Rare'
                    : 'Common'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
