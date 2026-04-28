import type { ResolvedTheme } from '@/lib/theme';

import { ThemeProvider } from './ThemeProvider';
import { TopNav } from './TopNav';

import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  forceTheme?: ResolvedTheme;
  scanLines?: boolean;
}

export function AppShell({ children, forceTheme, scanLines }: AppShellProps) {
  return (
    <ThemeProvider forceTheme={forceTheme}>
      <div className="min-h-screen bg-surface-0 text-text-primary">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-hazard focus:px-3 focus:py-1 focus:font-mono focus:text-xs focus:text-surface-0"
        >
          Skip to content
        </a>
        <TopNav forceThemeLocked={Boolean(forceTheme)} />
        <main id="main" className={scanLines ? 'scan-lines' : undefined}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
