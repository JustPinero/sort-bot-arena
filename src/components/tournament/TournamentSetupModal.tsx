import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { useLeaderboard, useStartTournament } from '@/api/queries';
import type { LeaderboardEntry } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

import { BotTilePicker } from './BotTilePicker';
import { type BracketSize, pickRandomBots } from './bracket';
import { BracketSizeSelect } from './BracketSizeSelect';
import { InputModeToggle, type TournamentInputMode } from './InputModeToggle';

interface TournamentSetupModalProps {
  triggerLabel?: string;
  triggerClassName?: string;
  defaultOpen?: boolean;
}

export function TournamentSetupModal({
  triggerLabel = 'Setup a tournament',
  triggerClassName,
  defaultOpen = false,
}: TournamentSetupModalProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [bracketSize, setBracketSize] = useState<BracketSize>(8);
  const [inputMode, setInputMode] = useState<TournamentInputMode>('flat_random');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const startTournament = useStartTournament();

  const leaderboard = useLeaderboard({
    weight: 'all',
    activity: 'all',
    language: null,
    sort: 'rank',
  });

  const eligibleBots: LeaderboardEntry[] = useMemo(() => {
    return (leaderboard.data?.items ?? []).filter((entry) => !entry.retired);
  }, [leaderboard.data]);

  const reset = () => {
    setSelected([]);
    setError(null);
    setBracketSize(8);
    setInputMode('flat_random');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const toggle = (botId: string) => {
    setSelected((curr) => {
      if (curr.includes(botId)) return curr.filter((id) => id !== botId);
      if (curr.length >= bracketSize) return curr;
      return [...curr, botId];
    });
  };

  const onRandom = () => {
    if (eligibleBots.length < bracketSize) return;
    const picks = pickRandomBots(
      eligibleBots.map((b) => b.bot_id),
      bracketSize,
    );
    setSelected(picks);
  };

  const onSubmit = async () => {
    if (selected.length !== bracketSize) return;
    setError(null);
    try {
      const result = await startTournament.mutateAsync({
        participant_bot_ids: selected,
        count: 3,
        bracket_size: bracketSize,
        input_mode: inputMode,
      });
      // Reset before navigating away. The modal effectively closes on
      // navigation; selection cleared per spec.
      reset();
      setOpen(false);
      navigate(`/tournaments/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || `Could not start tournament (${err.status})`);
      } else {
        setError('Could not start tournament. Try again.');
      }
    }
  };

  const enoughBots = eligibleBots.length >= bracketSize;
  const randomDisabled = !enoughBots || leaderboard.isLoading;
  const randomTooltip = enoughBots
    ? 'Pre-fills the picker with random bots. You can still swap before Start.'
    : `Need ≥${bracketSize} evaluated bots in the leaderboard.`;
  const canStart = selected.length === bracketSize && !startTournament.isPending && enoughBots;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center rounded-sm px-3 font-mono text-xs font-bold uppercase tracking-wide bg-tech text-black hover:opacity-90',
            triggerClassName,
          )}
          data-testid="setup-tournament-cta"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <header className="flex flex-col gap-1">
          <DialogTitle>Setup a tournament</DialogTitle>
          <DialogDescription>
            Pick a bracket size, fill the slots, and send the bots into the gauntlet.
          </DialogDescription>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BracketSizeSelect
            value={bracketSize}
            onChange={(size) => {
              setBracketSize(size);
              setSelected((curr) => curr.slice(0, size));
            }}
          />
          <InputModeToggle value={inputMode} onChange={setInputMode} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            onClick={onRandom}
            disabled={randomDisabled}
            aria-label="Random fill"
            title={randomTooltip}
          >
            Random
          </Button>
          {!enoughBots && !leaderboard.isLoading ? (
            <span
              role="note"
              className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary"
            >
              Need ≥{bracketSize} evaluated bots.
            </span>
          ) : null}
        </div>

        <BotTilePicker
          bots={eligibleBots}
          selected={selected}
          bracketSize={bracketSize}
          onToggle={toggle}
        />

        {error ? (
          <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="combat" size="md" onClick={onSubmit} disabled={!canStart}>
            {startTournament.isPending ? 'Starting…' : 'Start tournament'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
