import { Moon, Sun, SunMoon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

const PRIMARY_LINKS = [
  { to: '/arena', label: 'Arena' },
  { to: '/leaderboard', label: 'Rankings' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/submit', label: 'Submit' },
];

interface TopNavProps {
  forceThemeLocked?: boolean;
}

export function TopNav({ forceThemeLocked }: TopNavProps) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const displayName = useAuthStore((s) => s.displayName);

  const cycleTheme = () => {
    setMode(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system');
  };

  const ThemeIcon = mode === 'system' ? SunMoon : mode === 'light' ? Sun : Moon;

  return (
    <header className="sticky top-0 z-40 border-b bg-surface-1/80 backdrop-blur">
      <nav
        role="navigation"
        aria-label="Primary"
        className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4"
      >
        <NavLink
          to="/"
          className="flex items-center gap-2 font-display text-xl uppercase tracking-wider text-text-primary"
          aria-label="Home"
        >
          <span className="inline-block h-3 w-3 bg-hazard" aria-hidden="true" />
          Sort&nbsp;Arena
        </NavLink>

        <ul className="ml-4 flex flex-1 items-center gap-1">
          {PRIMARY_LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-8 items-center rounded-sm px-3 font-mono text-xs font-bold uppercase tracking-wide transition-colors duration-snap',
                    isActive
                      ? 'bg-surface-2 text-hazard'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
                  )
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={cycleTheme}
          disabled={forceThemeLocked}
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-snap hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Theme: ${mode}. Click to cycle.`}
          title={forceThemeLocked ? 'Theme is forced on this route' : `Theme: ${mode}`}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        <span
          className="hidden font-mono text-xs uppercase tracking-wide text-text-tertiary md:inline"
          data-testid="user-display-name"
        >
          {displayName ?? 'guest'}
        </span>
      </nav>
    </header>
  );
}
