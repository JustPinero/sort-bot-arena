import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { useLeaderboard, useStartBattle } from '@/api/queries';
import type { LeaderboardEntry } from '@/api/types';
import { Button } from '@/components/ui/button';


interface QuickFightButtonProps {
  className?: string;
}

export function QuickFightButton({ className }: QuickFightButtonProps) {
  const leaderboard = useLeaderboard({
    weight: 'all',
    activity: 'all',
    language: null,
    sort: 'rank',
  });
  const startBattle = useStartBattle();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const bots: LeaderboardEntry[] = (leaderboard.data?.items ?? []).filter((b) => !b.retired);
  const disabled = leaderboard.isLoading || bots.length < 2 || startBattle.isPending;

  const onClick = async () => {
    setError(null);
    if (bots.length < 2) {
      setError('Need at least 2 fighters.');
      return;
    }

    try {
      const [a, b] = pickRandomDistinctPair(bots);
      const res = await startBattle.mutateAsync({
        bot_a: a.bot_id,
        bot_b: b.bot_id,
        count: 3,
      });
      navigate(`/arena/${res.battle_id}`);
    } catch (err) {
      // On 429 pair_busy: try once more with a different random pair.
      if (err instanceof ApiError && err.status === 429 && err.code === 'pair_busy') {
        try {
          const [a, b] = pickRandomDistinctPair(bots);
          const res = await startBattle.mutateAsync({
            bot_a: a.bot_id,
            bot_b: b.bot_id,
            count: 3,
          });
          navigate(`/arena/${res.battle_id}`);
          return;
        } catch (retryErr) {
          if (retryErr instanceof ApiError && retryErr.status === 429) {
            setError('Couldn’t find a free matchup. Try again shortly.');
            return;
          }
          setError("Couldn't start a quick fight. Try again.");
          return;
        }
      }
      setError("Couldn't start a quick fight. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        type="button"
        variant="combat-secondary"
        onClick={onClick}
        disabled={disabled}
        className={className}
        data-testid="quick-fight-cta"
      >
        {startBattle.isPending ? 'Starting…' : 'Quick fight'}
      </Button>
      {error ? (
        <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function pickRandomDistinctPair<T>(arr: T[]): [T, T] {
  if (arr.length < 2) throw new Error('need at least 2 items');
  const i = Math.floor(Math.random() * arr.length);
  let j = Math.floor(Math.random() * (arr.length - 1));
  if (j >= i) j += 1;
  return [arr[i]!, arr[j]!];
}
