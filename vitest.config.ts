import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'test/webview/**/*.test.tsx'],
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['test/webview/**', 'jsdom'],
    ],
    setupFiles: ['./test/setup.ts'],
  },
});
