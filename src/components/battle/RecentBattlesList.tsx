import { Link } from 'react-router-dom';

import { useBattles } from '@/api/queries';
import { LoadingGear } from '@/components/LoadingGear';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { BattleWeightClassChip } from './BattleWeightClassChip';

import type { Battle } from '@/api/types';

const MAX_RECENT = 8;

function statusBadge(status: Battle['status']) {
  if (status === 'live') return <Badge variant="hazard">Running</Badge>;
  if (status === 'pre_fight') return <Badge variant="tech">Upcoming</Badge>;
  if (status === 'completed') return <Badge variant="victory">Complete</Badge>;
  return <Badge variant="combat">Failed</Badge>;
}

function winnerLabel(battle: Battle): string | null {
  if (battle.status !== 'completed' || !battle.winner_bot_id) return null;
  if (battle.winner_bot_id === battle.fighter_a.bot_id) {
    return battle.fighter_a.display_name;
  }
  if (battle.winner_bot_id === battle.fighter_b.bot_id) {
    return battle.fighter_b.display_name;
  }
  return null;
}

export function RecentBattlesList() {
  const { data, isLoading, isError } = useBattles();

  return (
    <section aria-labelledby="recent-battles-heading" className="mt-12">
      <h2
        id="recent-battles-heading"
        className="font-display text-2xl uppercase tracking-wide"
      >
        Recent Battles
      </h2>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-tertiary">
        The latest matchups from the arena.
      </p>

      {isLoading ? (
        <div className="mt-6">
          <LoadingGear size="h-12 w-12" label="Loading recent battles…" />
        </div>
      ) : null}

      {isError ? (
        <p className="mt-6 rounded-md border bg-surface-1 p-6 text-center text-combat">
          Could not load recent battles. Try again.
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <RecentBattlesContent battles={data?.items ?? []} />
      ) : null}
    </section>
  );
}

function RecentBattlesContent({ battles }: { battles: Battle[] }) {
  if (battles.length === 0) {
    return (
      <div className="mt-6 rounded-md border bg-surface-1 p-6 text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-text-secondary">
          No recent battles yet.
        </p>
        <p className="mt-2 text-sm text-text-tertiary">
          Use the buttons above to set up a match or quick fight.
        </p>
      </div>
    );
  }

  const recent = battles.slice(0, MAX_RECENT);
  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      {recent.map((battle) => {
        const winner = winnerLabel(battle);
        return (
          <li
            key={battle.id}
            className="flex flex-col gap-3 rounded-md border bg-surface-1 p-4 transition-colors duration-snap hover:bg-surface-2"
            data-testid="recent-battle-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {statusBadge(battle.status)}
              <BattleWeightClassChip weightClass={battle.weight_class ?? null} />
            </div>
            <p className="font-display text-xl uppercase tracking-wide">
              <span className="text-corner-1">{battle.fighter_a.display_name}</span>
              <span className="mx-2 text-text-tertiary">vs</span>
              <span className="text-corner-2">{battle.fighter_b.display_name}</span>
            </p>
            {winner ? (
              <p className="font-mono text-xs uppercase tracking-widest text-victory">
                Winner: {winner}
              </p>
            ) : null}
            <Button variant="combat" asChild className="mt-2 self-start">
              <Link to={`/arena/${battle.id}`}>
                {battle.status === 'completed' ? 'Replay' : 'Enter Arena'}
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
