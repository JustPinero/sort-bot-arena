import type { Config } from 'tailwindcss';
import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [animate, containerQueries],
} satisfies Config;
