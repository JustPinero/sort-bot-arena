import type { Bot } from '@/api/types';
import { TaleOfTheTape } from '@/components/fighter/TaleOfTheTape';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { CountdownTimer } from './CountdownTimer';
import { TrashTalkBubble } from './TrashTalkBubble';

interface PreFightStaredownProps {
  fighterA: Bot;
  fighterB: Bot;
  countdownSeconds?: number;
  onEnterArena?: () => void;
  className?: string;
}

export function PreFightStaredown({
  fighterA,
  fighterB,
  countdownSeconds = 5,
  onEnterArena,
  className,
}: PreFightStaredownProps) {
  return (
    <section
      aria-label="Pre-fight staredown"
      className={cn('mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-8', className)}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Pre-fight staredown
      </p>

      <CountdownTimer seconds={countdownSeconds} />

      <TaleOfTheTape fighterA={fighterA} fighterB={fighterB} mode="active" />

      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <TrashTalkBubble
          speaker={fighterA.nickname ?? fighterA.display_name}
          text={fighterA.trash_talk}
          side="left"
        />
        <TrashTalkBubble
          speaker={fighterB.nickname ?? fighterB.display_name}
          text={fighterB.trash_talk}
          side="right"
        />
      </div>

      {onEnterArena ? (
        <Button variant="combat" onClick={onEnterArena}>
          Enter Arena
        </Button>
      ) : null}
    </section>
  );
}
