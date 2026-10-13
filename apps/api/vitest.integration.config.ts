import { defineConfig } from 'vitest/config';

// Runs against the Postgres and Redis from docker-compose.yml (a separate test database and Redis db 1)
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.int.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
