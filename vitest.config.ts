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
        // Global floor -- tuned to actual coverage (2026-03-07) minus 5% buffer
        // Actual: lines 32.7%, branches 79.2%, functions 68.0%, statements 32.7%
        // These prevent regression; aspirational targets are in REQUIREMENTS.md
        lines: 27,
        functions: 63,
        branches: 74,
        statements: 27,
      },
    },
  },
});
