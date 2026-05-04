import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/**',
        'src/**/*.test.ts',
        'src/clients/sort-bot-api/types.ts',
        '**/*.config.{ts,cjs,js}',
      ],
      // Slice A2 — coverage floor. Server already exceeds the plan's
      // 80/75/80/80 target. Drop below + CI fails; investigate the
      // regression before adjusting.
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },
  },
});
