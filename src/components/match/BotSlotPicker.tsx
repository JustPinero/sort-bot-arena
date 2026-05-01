import { useMemo } from 'react';

import type { LeaderboardEntry } from '@/api/types';

interface BotSlotPickerProps {
  redBotId: string | null;
  blueBotId: string | null;
  onChangeRed: (id: string | null) => void;
  onChangeBlue: (id: string | null) => void;
  bots: LeaderboardEntry[];
  isLoading?: boolean;
  error?: boolean;
}

export function BotSlotPicker({
  redBotId,
  blueBotId,
  onChangeRed,
  onChangeBlue,
  bots,
  isLoading,
  error,
}: BotSlotPickerProps) {
  const eligible = useMemo(() => bots.filter((b) => !b.retired), [bots]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <SlotSelect
        label="Red corner"
        value={redBotId}
        onChange={onChangeRed}
        bots={eligible}
        isLoading={isLoading}
        error={error}
      />
      <SlotSelect
        label="Blue corner"
        value={blueBotId}
        onChange={onChangeBlue}
        bots={eligible}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

interface SlotSelectProps {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  bots: LeaderboardEntry[];
  isLoading?: boolean;
  error?: boolean;
}

function SlotSelect({ label, value, onChange, bots, isLoading, error }: SlotSelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={isLoading || error || bots.length === 0}
        className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
      >
        <option value="">{isLoading ? 'Loading…' : 'Pick a fighter'}</option>
        {bots.map((b) => (
          <option key={b.bot_id} value={b.bot_id}>
            {b.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
