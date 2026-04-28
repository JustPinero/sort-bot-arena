import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useTournament } from '@/api/queries';
import type { TournamentMatch, TournamentParticipant } from '@/api/types';
import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { MatchCard } from '@/components/tournaments/MatchCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/lib/format';

export default function TournamentBracketPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useTournament(id);

  const participantsById = useMemo<Record<string, TournamentParticipant>>(() => {
    const map: Record<string, TournamentParticipant> = {};
    for (const p of data?.participants ?? []) map[p.bot_id] = p;
    return map;
  }, [data]);

  const rounds = useMemo(() => {
    const grouped = new Map<number, TournamentMatch[]>();
    for (const m of data?.matches ?? []) {
      const list = grouped.get(m.round) ?? [];
      list.push(m);
      grouped.set(m.round, list);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({ round, matches }));
  }, [data]);

  if (isError) {
    const status = (error as { status?: number } | null)?.status ?? 0;
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">
          {status === 404 ? 'Tournament not on the card' : 'Could not load tournament'}
        </h1>
        <Button variant="combat" asChild className="mt-8">
          <Link to="/tournaments">Back to Tournaments</Link>
        </Button>
      </section>
    );
  }

  if (isLoading || !data) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-12 w-1/2 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-6 h-72 w-full animate-pulse rounded-md bg-surface-2" />
      </section>
    );
  }

  const champ = data.champion_bot_id ? participantsById[data.champion_bot_id] : null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-text-tertiary">
          Tournament · {fmtDate(data.scheduled_at)}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">{data.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={data.status === 'active' ? 'hazard' : 'default'}>
            {data.status === 'active'
              ? 'Live tonight'
              : data.status === 'upcoming'
                ? 'Upcoming'
                : 'Completed'}
          </Badge>
          <Badge variant="tech">{data.participant_count} fighters</Badge>
          <Badge variant="default">{data.rounds_total} rounds</Badge>
          {data.weight_class_filter ? (
            <Badge variant="default">{data.weight_class_filter}-only</Badge>
          ) : null}
        </div>
        {data.prize_description ? (
          <p className="mt-3 text-sm text-text-secondary">Prize: {data.prize_description}</p>
        ) : null}
      </header>

      {data.status === 'completed' && champ ? (
        <div className="mt-8 flex items-center gap-3 rounded-md border border-champion bg-champion-bg p-4 shadow-glow-champion">
          <ChampionBelt active />
          <div className="flex flex-col">
            <p className="font-mono text-xs uppercase tracking-widest text-champion">Champion</p>
            <Link
              to={`/bots/${champ.bot_id}`}
              className="font-display text-2xl uppercase tracking-wide hover:underline"
            >
              {champ.nickname ?? champ.display_name}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rounds.map(({ round, matches }) => (
          <div key={round} className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
              {round === data.rounds_total ? 'Final' : `Round ${round}`}
            </p>
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} participantsById={participantsById} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
