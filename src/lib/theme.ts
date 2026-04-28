export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ResolveThemeArgs {
  mode: ThemeMode;
  systemPrefersDark: boolean;
  forceTheme?: ResolvedTheme;
}

export function resolveTheme({
  mode,
  systemPrefersDark,
  forceTheme,
}: ResolveThemeArgs): ResolvedTheme {
  if (forceTheme) return forceTheme;
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}
