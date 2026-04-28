import { Binary, Code2, Leaf, Wand2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { cornerColor } from '@/lib/cornerColor';

import type { ComponentType } from 'react';

interface PortraitFallbackProps {
  botId: string;
  language: string;
  className?: string;
}

const LANG_ICON: Record<string, ComponentType<{ className?: string }>> = {
  python: Wand2,
  node: Leaf,
  go: Code2,
  binary: Binary,
};

export function PortraitFallback({ botId, language, className }: PortraitFallbackProps) {
  const Icon = LANG_ICON[language.toLowerCase()] ?? Code2;
  const color = cornerColor(botId);

  return (
    <div
      role="img"
      aria-label={`${language} fighter silhouette`}
      style={{ borderColor: color, color }}
      className={cn(
        'grid aspect-square w-full place-items-center border-4 bg-surface-inset',
        className,
      )}
    >
      <Icon className="h-1/3 w-1/3" />
    </div>
  );
}
