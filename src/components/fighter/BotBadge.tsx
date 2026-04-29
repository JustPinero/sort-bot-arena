import { useState } from 'react';

import { config } from '@/api/config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface BotBadgeProps {
  botId: string;
  className?: string;
}

export function BotBadge({ botId, className }: BotBadgeProps) {
  const badgeUrl = `${config.apiBaseUrl}/v1/bots/${botId}/badge.svg`;
  const profileUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/bots/${botId}`;
  const markdown = `[![sort-arena](${badgeUrl})](${profileUrl})`;
  const html = `<a href="${profileUrl}"><img src="${badgeUrl}" alt="sort-arena badge"/></a>`;

  const [copied, setCopied] = useState<'markdown' | 'html' | null>(null);
  const copy = async (text: string, kind: 'markdown' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore — clipboard may be blocked
    }
  };

  return (
    <section className={cn('rounded-md border bg-surface-1 p-4', className)}>
      <h3 className="font-mono text-xs uppercase tracking-widest text-tech">Embeddable Badge</h3>
      <p className="mt-2 text-sm text-text-secondary">
        Drop this in your README, Slack profile, or hometown bulletin board.
      </p>
      <div className="mt-3 flex justify-center rounded-md border bg-surface-2 p-4">
        <img
          src={badgeUrl}
          alt={`sort-arena badge for ${botId}`}
          width={220}
          height={40}
          loading="lazy"
        />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-sm bg-surface-2 px-3 py-2 font-mono text-xs">
            {markdown}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(markdown, 'markdown')}
            aria-label="Copy markdown embed"
          >
            {copied === 'markdown' ? 'Copied' : 'Copy MD'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-sm bg-surface-2 px-3 py-2 font-mono text-xs">
            {html}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(html, 'html')}
            aria-label="Copy HTML embed"
          >
            {copied === 'html' ? 'Copied' : 'Copy HTML'}
          </Button>
        </div>
      </div>
    </section>
  );
}
