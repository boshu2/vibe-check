import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        statements: 40,
        branches: 40,
        functions: 50,
        lines: 40,
      },
    },
  },
});
