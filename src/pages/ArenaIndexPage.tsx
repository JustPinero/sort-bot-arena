import { Link } from 'react-router-dom';

import { useBattles } from '@/api/queries';
import type { Battle } from '@/api/types';
import { RecentBattlesList } from '@/components/battle/RecentBattlesList';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { MatchSetupModal } from '@/components/match/MatchSetupModal';
import { QuickFightButton } from '@/components/match/QuickFightButton';
import { RecentTournamentsList } from '@/components/tournament/RecentTournamentsList';
import { TournamentSetupModal } from '@/components/tournament/TournamentSetupModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtRelativeDate } from '@/lib/format';

function statusBadge(status: Battle['status']) {
  if (status === 'live') return <Badge variant="hazard">Live</Badge>;
  if (status === 'pre_fight') return <Badge variant="tech">Upcoming</Badge>;
  return <Badge variant="default">Completed</Badge>;
}

export default function ArenaIndexPage() {
  const { data, isLoading, isError } = useBattles();
  const battles = data?.items ?? [];

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">The Arena</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Live battles. Highlights. Upsets.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <MatchSetupModal />
          <QuickFightButton />
          <TournamentSetupModal />
        </div>
      </header>

      {isError ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-combat">
          Could not load tonight&apos;s card. Try again.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-md bg-surface-2" />
          <div className="h-40 animate-pulse rounded-md bg-surface-2" />
        </div>
      ) : null}

      {!isLoading && !isError && battles.length === 0 ? (
        <p className="mt-8 rounded-md border bg-surface-1 p-6 text-center text-text-tertiary">
          No battles scheduled. Check back tonight.
        </p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {battles.map((battle) => {
          const a = battle.fighter_a;
          const b = battle.fighter_b;
          const aLabel = a.nickname ?? a.display_name;
          const bLabel = b.nickname ?? b.display_name;

          return (
            <li
              key={battle.id}
              className="flex flex-col gap-3 rounded-md border bg-surface-1 p-4 transition-colors duration-snap hover:bg-surface-2"
            >
              <div className="flex items-center justify-between">
                {statusBadge(battle.status)}
                <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                  {fmtRelativeDate(battle.scheduled_at)}
                </span>
              </div>
              <p className="font-display text-2xl uppercase tracking-wide">
                {aLabel} <span className="text-text-tertiary">vs</span> {bLabel}
              </p>
              <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                {battle.rounds_total} rounds · {a.language} vs {b.language}
              </p>
              <Button variant="combat" asChild className="mt-2">
                <Link to={`/arena/${battle.id}`}>
                  {battle.status === 'completed' ? 'Replay' : 'Enter Arena'}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>

      <RecentBattlesList />

      <RecentTournamentsList />
    </section>
  );
}
