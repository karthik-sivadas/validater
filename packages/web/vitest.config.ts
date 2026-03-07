import { defineProject } from 'vitest/config';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineProject({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
  },
});
