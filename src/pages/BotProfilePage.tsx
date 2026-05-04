import { Link, useParams, useSearchParams } from 'react-router-dom';

import { apiErrorStatus } from '@/api/error-helpers';
import {
  useBot,
  useBotAnalysis,
  useBotInputPerformance,
  useBotRuns,
  useBotSnapshots,
} from '@/api/queries';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { AchievementIconStrip } from '@/components/fighter/AchievementIconStrip';
import { BotBadge } from '@/components/fighter/BotBadge';
import { FightHistoryTable } from '@/components/fighter/FightHistoryTable';
import { PerformanceHeatmap } from '@/components/fighter/PerformanceHeatmap';
import { ProfileTabs } from '@/components/fighter/ProfileTabs';
import { RankHistoryChart } from '@/components/fighter/RankHistoryChart';
import { ScoutingReport } from '@/components/fighter/ScoutingReport';
import { TaleOfTheTape } from '@/components/fighter/TaleOfTheTape';
import { Button } from '@/components/ui/button';
import { fmtRelativeDate } from '@/lib/format';

function HeroSkeleton() {
  return (
    <div
      className="mx-auto h-[600px] w-full max-w-[420px] animate-pulse bg-surface-2"
      aria-busy="true"
    />
  );
}

function NotFoundPanel({ id }: { id: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center">
      <HazardStripes thickness="thick" />
      <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">
        Fighter not in the database
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Bot id: {id}
      </p>
      <p className="mt-4 text-text-secondary">That bot has never registered for an evaluation.</p>
      <Button variant="combat" asChild className="mt-8">
        <Link to="/leaderboard">Back to Rankings</Link>
      </Button>
    </section>
  );
}

export default function BotProfilePage() {
  const { botId } = useParams<{ botId: string }>();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'history';

  const botQuery = useBot(botId);
  const runsQuery = useBotRuns(botId);
  const snapshotsQuery = useBotSnapshots(botId);
  const inputsQuery = useBotInputPerformance(botId);
  const analysisQuery = useBotAnalysis(botId, { enabled: activeTab === 'scouting' });

  if (botQuery.isLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <HeroSkeleton />
      </section>
    );
  }

  if (botQuery.isError) {
    if (apiErrorStatus(botQuery.error) === 404) return <NotFoundPanel id={botId ?? '—'} />;
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-combat">Could not load this fighter. Try again.</p>
      </section>
    );
  }

  const bot = botQuery.data;
  if (!bot) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      {bot.rank === 1 && !bot.retired ? (
        <div className="flex items-center justify-end">
          <ChampionBelt active />
        </div>
      ) : null}

      <div className="mt-6">
        <TaleOfTheTape fighterA={bot} fighterB={null} mode="static" />
      </div>

      <div className="mt-8">
        <BotBadge botId={bot.id} />
      </div>

      <div className="mt-12">
        <ProfileTabs
          tabs={[
            {
              key: 'history',
              label: 'Fight History',
              content: (
                <FightHistoryTable
                  runs={runsQuery.data?.items ?? []}
                  isLoading={runsQuery.isLoading}
                  hasMore={Boolean(runsQuery.data?.next_cursor)}
                />
              ),
            },
            {
              key: 'performance',
              label: 'Performance',
              content: (
                <div className="flex flex-col gap-6">
                  <RankHistoryChart snapshots={snapshotsQuery.data ?? []} />
                  <PerformanceHeatmap data={inputsQuery.data ?? []} />
                </div>
              ),
            },
            {
              key: 'scouting',
              label: 'Scouting Report',
              content: (
                <ScoutingReport
                  analysis={analysisQuery.data?.analysis ?? null}
                  isLoading={analysisQuery.isLoading}
                  isError={analysisQuery.isError}
                />
              ),
            },
            {
              key: 'achievements',
              label: 'Achievements',
              content: (
                <div className="rounded-md border bg-surface-1 p-6">
                  {bot.achievements.length === 0 ? (
                    <p className="text-text-tertiary">No achievements unlocked yet.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bot.achievements.map((ach) => (
                        <li
                          key={ach.id}
                          className="flex flex-col gap-1 rounded-md border bg-surface-2 p-3"
                        >
                          <AchievementIconStrip achievements={[ach]} maxVisible={1} />
                          <p className="font-display text-lg uppercase tracking-wide text-champion">
                            {ach.name}
                          </p>
                          <p className="text-sm text-text-secondary">{ach.description}</p>
                          <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                            Unlocked {fmtRelativeDate(ach.unlocked_at)} ·{' '}
                            {ach.rarity_pct.toFixed(1)}% have this
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            },
          ]}
          defaultTab="history"
        />
      </div>
    </section>
  );
}
