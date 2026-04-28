import { Award, Crown, Mountain, Star, Sword } from 'lucide-react';

import type { Achievement } from '@/api/types';
import { cn } from '@/lib/cn';

import type { ComponentType } from 'react';

interface AchievementIconStripProps {
  achievements: Achievement[];
  maxVisible?: number;
  className?: string;
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  sword: Sword,
  crown: Crown,
  mountain: Mountain,
  star: Star,
};

const FALLBACK_ICON = Award;

export function AchievementIconStrip({
  achievements,
  maxVisible = 6,
  className,
}: AchievementIconStripProps) {
  if (achievements.length === 0) {
    return (
      <p
        className={cn('font-mono text-xs uppercase tracking-widest text-text-tertiary', className)}
      >
        No achievements yet
      </p>
    );
  }

  const visible = achievements.slice(0, maxVisible);
  const overflow = achievements.length - visible.length;

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {visible.map((ach) => {
        const Icon = ICONS[ach.icon] ?? FALLBACK_ICON;
        return (
          <li
            key={ach.id}
            className="grid h-8 w-8 place-items-center rounded-sm bg-surface-2 text-champion"
            title={`${ach.name} — ${ach.description}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{ach.name}</span>
          </li>
        );
      })}
      {overflow > 0 ? (
        <li className="font-mono text-xs uppercase tracking-wide text-text-tertiary">
          +{overflow} more
        </li>
      ) : null}
    </ul>
  );
}
