import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: ['packages/core', 'packages/worker', 'packages/web'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/worker/src/**/*.ts',
        'packages/web/src/**/*.ts',
        'packages/web/src/**/*.tsx',
      ],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/__test-utils__/**',
        '**/*.test.{ts,tsx}',
        '**/dist/**',
        '**/index.ts',
        '**/types/**',
        '**/*.d.ts',
        'packages/web/src/routeTree.gen.ts',
        'packages/web/src/components/ui/**',
        'packages/web/e2e/**',
        'packages/worker/src/workflows/**',
        'packages/worker/src/run-hello.ts',
        'packages/web/src/routes/**',
        'packages/web/src/router.tsx',
        'packages/web/src/styles.css',
        'packages/web/src/logo.svg',
        'packages/core/src/ai/prompts/**',
      ],
      thresholds: {
        // Global floor -- per-tier thresholds tuned in plan 10-03 after tests exist
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
});
