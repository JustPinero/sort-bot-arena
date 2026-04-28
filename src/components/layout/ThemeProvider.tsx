import { useEffect, useState } from 'react';

import { resolveTheme } from '@/lib/theme';
import type { ResolvedTheme } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme';

import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  forceTheme?: ResolvedTheme;
}

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children, forceTheme }: ThemeProviderProps) {
  const mode = useThemeStore((s) => s.mode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(readSystemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme({ mode, systemPrefersDark, forceTheme });
    document.documentElement.setAttribute('data-theme', resolved);
  }, [mode, systemPrefersDark, forceTheme]);

  return <>{children}</>;
}
