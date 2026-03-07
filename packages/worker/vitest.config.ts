import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'worker',
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: true,
  },
});
