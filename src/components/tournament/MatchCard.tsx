import { Link } from 'react-router-dom';

import type { TournamentMatch, TournamentParticipant } from '@/api/types';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

interface MatchCardProps {
  match: TournamentMatch;
  participantsById: Record<string, TournamentParticipant>;
  className?: string;
}

function FighterRow({
  participant,
  isWinner,
  emphasized,
}: {
  participant: TournamentParticipant | null;
  isWinner: boolean;
  emphasized?: boolean;
}) {
  if (!participant) {
    return (
      <div className="flex h-9 items-center gap-3 px-3 py-2 text-text-tertiary">
        <span className="font-mono text-[11px] uppercase tracking-widest">— TBD —</span>
      </div>
    );
  }
  const headline = participant.nickname ?? participant.display_name;
  return (
    <Link
      to={`/bots/${participant.bot_id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2 transition-colors duration-snap hover:bg-surface-2',
        isWinner && 'bg-victory-bg',
        emphasized && 'bg-hazard-bg',
      )}
    >
      <CornerColorBadge botId={participant.bot_id} size="sm" />
      <span className="font-display text-base uppercase tracking-wide">{headline}</span>
      {isWinner ? <Badge variant="victory">W</Badge> : null}
    </Link>
  );
}

export function MatchCard({ match, participantsById, className }: MatchCardProps) {
  const a = match.fighter_a_bot_id ? participantsById[match.fighter_a_bot_id] : null;
  const b = match.fighter_b_bot_id ? participantsById[match.fighter_b_bot_id] : null;
  const isLive = match.status === 'live';
  const isBye = match.status === 'bye';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-md border bg-surface-1',
        isLive && 'border-hazard shadow-glow-hazard',
        className,
      )}
      data-status={match.status}
    >
      <header className="flex items-center justify-between border-b bg-surface-2 px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          R{match.round} · #{match.position + 1}
        </span>
        {isLive ? <Badge variant="hazard">Live</Badge> : null}
        {isBye ? <Badge variant="default">Bye</Badge> : null}
        {match.battle_id ? (
          <Link
            to={`/arena/${match.battle_id}`}
            className="font-mono text-[10px] uppercase tracking-widest text-tech underline-offset-2 hover:underline"
          >
            {match.status === 'live' ? 'Watch' : 'View'}
          </Link>
        ) : null}
      </header>
      {isBye ? (
        <>
          <FighterRow participant={a ?? b ?? null} isWinner={false} emphasized />
          <div className="border-t" />
          <p className="px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
            Advances on bye
          </p>
        </>
      ) : (
        <>
          <FighterRow
            participant={a ?? null}
            isWinner={Boolean(match.winner_bot_id && match.winner_bot_id === a?.bot_id)}
          />
          <div className="border-t" />
          <FighterRow
            participant={b ?? null}
            isWinner={Boolean(match.winner_bot_id && match.winner_bot_id === b?.bot_id)}
          />
        </>
      )}
    </article>
  );
}
