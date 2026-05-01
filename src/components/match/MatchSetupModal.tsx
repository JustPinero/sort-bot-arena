import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { useInputs, useLeaderboard, useStartBattle } from '@/api/queries';
import type { InputSummary, LeaderboardEntry } from '@/api/types';
import { LoadingGear } from '@/components/LoadingGear';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { BotSlotPicker } from './BotSlotPicker';
import { InputPickerTabs, presetCount, type PresetKey } from './InputPickerTabs';


interface MatchSetupModalProps {
  triggerLabel?: string;
  triggerClassName?: string;
  defaultOpen?: boolean;
}

type TabKey = 'preset' | 'manual' | 'upload';

export function MatchSetupModal({
  triggerLabel = 'Setup a match',
  triggerClassName,
  defaultOpen = false,
}: MatchSetupModalProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <DialogTrigger asChild>
                <Button
                  variant="combat"
                  className={triggerClassName}
                  data-testid="setup-match-cta"
                >
                  {triggerLabel}
                </Button>
              </DialogTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent>Open the match builder to pick fighters and inputs.</TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-2xl">
          <MatchSetupForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

interface MatchSetupFormProps {
  onClose: () => void;
}

function MatchSetupForm({ onClose }: MatchSetupFormProps) {
  const navigate = useNavigate();
  const leaderboard = useLeaderboard({
    weight: 'all',
    activity: 'all',
    language: null,
    sort: 'rank',
  });
  const inputsQuery = useInputs();
  const startBattle = useStartBattle();

  const [redBotId, setRedBotId] = useState<string | null>(null);
  const [blueBotId, setBlueBotId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('preset');
  const [preset, setPreset] = useState<PresetKey>('sparring');
  const [selectedInputIds, setSelectedInputIds] = useState<Set<string>>(new Set());
  const [extraInputs, setExtraInputs] = useState<InputSummary[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const bots: LeaderboardEntry[] = leaderboard.data?.items ?? [];

  const allInputs = useMemo(() => {
    const base = inputsQuery.data?.items ?? [];
    const seen = new Set(base.map((i) => i.id));
    const merged = [...base];
    for (const e of extraInputs) {
      if (!seen.has(e.id)) merged.push(e);
    }
    return merged;
  }, [inputsQuery.data, extraInputs]);

  const distinctBots = redBotId !== null && blueBotId !== null && redBotId !== blueBotId;
  const tabValid =
    tab === 'preset'
      ? true
      : tab === 'manual'
        ? selectedInputIds.size > 0
        : false;
  const canSubmit = distinctBots && tabValid && !startBattle.isPending;

  const onToggleInput = (id: string) => {
    setSelectedInputIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onInputUploaded = (input: InputSummary) => {
    setExtraInputs((prev) => (prev.some((p) => p.id === input.id) ? prev : [...prev, input]));
    setSelectedInputIds((prev) => {
      const next = new Set(prev);
      next.add(input.id);
      return next;
    });
  };

  // Auto-clear submit error when user changes inputs
  useEffect(() => {
    setSubmitError(null);
  }, [redBotId, blueBotId, tab, preset, selectedInputIds]);

  const onSubmit = async () => {
    if (!redBotId || !blueBotId || redBotId === blueBotId) return;
    setSubmitError(null);
    const body =
      tab === 'preset'
        ? { bot_a: redBotId, bot_b: blueBotId, count: presetCount(preset) }
        : { bot_a: redBotId, bot_b: blueBotId, input_ids: Array.from(selectedInputIds) };

    try {
      const res = await startBattle.mutateAsync(body);
      onClose();
      navigate(`/arena/${res.battle_id}`);
    } catch (err) {
      setSubmitError(messageForStartError(err));
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <header>
        <DialogTitle>Setup a match</DialogTitle>
        <DialogDescription>
          Pick two fighters and the inputs they&apos;ll battle on.
        </DialogDescription>
      </header>

      <BotSlotPicker
        redBotId={redBotId}
        blueBotId={blueBotId}
        onChangeRed={setRedBotId}
        onChangeBlue={setBlueBotId}
        bots={bots}
        isLoading={leaderboard.isLoading}
        error={leaderboard.isError}
      />

      {redBotId && blueBotId && redBotId === blueBotId ? (
        <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
          Pick two different fighters.
        </p>
      ) : null}

      <InputPickerTabs
        inputs={allInputs}
        preset={preset}
        onChangePreset={setPreset}
        selectedInputIds={selectedInputIds}
        onToggleInput={onToggleInput}
        activeTab={tab}
        onChangeTab={setTab}
        onInputUploaded={onInputUploaded}
      />

      {submitError ? (
        <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="font-mono text-xs uppercase tracking-wide text-text-tertiary hover:text-text-primary"
              onClick={onClose}
            >
              Cancel
            </button>
          </TooltipTrigger>
          <TooltipContent>Discard your picks and close the match builder.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" disabled={!canSubmit}>
              {startBattle.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingGear size="h-4 w-4" className="!py-0" />
                  <span>Starting</span>
                </span>
              ) : (
                'Start match'
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>POSTs to /battles and redirects to the live arena.</TooltipContent>
        </Tooltip>
      </div>
    </form>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function messageForStartError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      const tag = err.code || err.message;
      if (tag === 'pair_busy') {
        return 'That matchup is already running. Try again in a few seconds.';
      }
      if (tag === 'pair_cooldown') {
        return `That matchup hit the per-hour limit. Try again in ${formatRetryAfter(err.retryAfterSeconds)}.`;
      }
      return 'Slow down — that matchup is rate limited.';
    }
    return err.message || `Couldn't start the match (${err.status})`;
  }
  return "Couldn't start the match — try again.";
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatRetryAfter(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 'a moment';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  return `${mins} min`;
}
