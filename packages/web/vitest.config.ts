import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
  },
});
