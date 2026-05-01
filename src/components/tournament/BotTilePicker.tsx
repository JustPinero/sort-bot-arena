import { useMemo, useState } from 'react';

import type { LeaderboardEntry } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 50;

interface BotTilePickerProps {
  bots: LeaderboardEntry[];
  selected: ReadonlyArray<string>;
  bracketSize: number;
  onToggle: (botId: string) => void;
  className?: string;
}

export function BotTilePicker({
  bots,
  selected,
  bracketSize,
  onToggle,
  className,
}: BotTilePickerProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const eligible = useMemo(() => bots.filter((b) => !b.retired), [bots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((b) => {
      const name = b.display_name.toLowerCase();
      const nick = b.nickname?.toLowerCase() ?? '';
      return name.includes(q) || nick.includes(q);
    });
  }, [eligible, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const selectedSet = new Set(selected);

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('flex flex-col gap-3', className)}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            <span data-testid="selected-count">{selected.length}</span> / {bracketSize} selected
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <input
                type="search"
                aria-label="Search bots by name"
                placeholder="Search bots"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-48 rounded-sm border bg-surface-2 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
              />
            </TooltipTrigger>
            <TooltipContent>Filters tiles by display name or nickname.</TooltipContent>
          </Tooltip>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-sm border bg-surface-1 p-4 text-center text-sm text-text-tertiary">
            No bots match.
          </p>
        ) : (
          <ul
            aria-label="Bot tile picker"
            className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"
          >
            {visible.map((bot) => {
              const isSelected = selectedSet.has(bot.bot_id);
              const atCap = !isSelected && selected.length >= bracketSize;
              const label = bot.nickname ?? bot.display_name;
              return (
                <li key={bot.bot_id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Select ${bot.display_name}`}
                    onClick={() => onToggle(bot.bot_id)}
                    disabled={atCap}
                    className={cn(
                      'flex h-full w-full flex-col gap-1 rounded-sm border bg-surface-2 p-2 text-left transition-colors',
                      isSelected
                        ? 'border-hazard bg-hazard/10'
                        : 'border-transparent hover:border-text-tertiary',
                      atCap && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm uppercase tracking-wide">{label}</span>
                      <Badge variant="default" className="h-5 px-1 text-[10px]">
                        #{bot.rank}
                      </Badge>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                      {bot.display_name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              Prev
            </Button>
            <span className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
              Page {safePage + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
