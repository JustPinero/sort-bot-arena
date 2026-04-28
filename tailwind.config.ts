import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          inset: 'var(--surface-inset)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          emphasis: 'var(--border-emphasis)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        hazard: {
          DEFAULT: 'var(--hazard-yellow)',
          bg: 'var(--hazard-yellow-bg)',
        },
        combat: {
          DEFAULT: 'var(--combat-red)',
          bg: 'var(--combat-red-bg)',
        },
        tech: {
          DEFAULT: 'var(--tech-cyan)',
          bg: 'var(--tech-cyan-bg)',
        },
        champion: {
          DEFAULT: 'var(--champion-gold)',
          bg: 'var(--champion-gold-bg)',
        },
        victory: {
          DEFAULT: 'var(--victory-green)',
          bg: 'var(--victory-green-bg)',
        },
        corner: {
          1: 'var(--corner-1)',
          2: 'var(--corner-2)',
          3: 'var(--corner-3)',
          4: 'var(--corner-4)',
          5: 'var(--corner-5)',
          6: 'var(--corner-6)',
          7: 'var(--corner-7)',
          8: 'var(--corner-8)',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        led: ['DSEG7 Classic Mini', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['24px', '32px'],
        '2xl': ['32px', '40px'],
        '3xl': ['48px', '56px'],
        '4xl': ['72px', '80px'],
        '5xl': ['96px', '100px'],
      },
      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
        widest: '0.16em',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        combat: 'var(--radius-combat)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      borderWidth: {
        DEFAULT: 'var(--border-1)',
        2: 'var(--border-2)',
        4: 'var(--border-4)',
      },
      transitionTimingFunction: {
        snap: 'var(--ease-snap)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        bounce: 'var(--ease-bounce)',
      },
      transitionDuration: {
        snap: 'var(--motion-snap)',
        quick: 'var(--motion-quick)',
        smooth: 'var(--motion-smooth)',
        dramatic: 'var(--motion-dramatic)',
      },
      boxShadow: {
        'glow-hazard': 'var(--glow-hazard)',
        'glow-combat': 'var(--glow-combat)',
        'glow-tech': 'var(--glow-tech)',
        'glow-champion': 'var(--glow-champion)',
        'glow-victory': 'var(--glow-victory)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        'pulse-broadcast': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        'slam-in': {
          '0%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'glow-cycle': {
          '0%, 100%': { boxShadow: '0 0 24px rgba(251, 191, 36, 0.45)' },
          '50%': { boxShadow: '0 0 32px rgba(250, 204, 21, 0.55)' },
        },
      },
      animation: {
        shake: 'shake 200ms var(--ease-snap)',
        'pulse-broadcast': 'pulse-broadcast 2s var(--ease-in) infinite',
        'slam-in': 'slam-in 400ms var(--ease-snap) forwards',
        'glow-cycle': 'glow-cycle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [animate, containerQueries],
} satisfies Config;
