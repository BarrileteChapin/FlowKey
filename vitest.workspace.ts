import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    esbuild: {
      jsx: 'automatic',
    },
    test: {
      name: 'flowkey',
      include: ['test/unit/**/*.test.ts', 'test/webview/**/*.test.tsx'],
      globals: true,
      environment: 'node',
      environmentMatchGlobs: [
        ['test/webview/**', 'jsdom'],
      ],
      setupFiles: ['./test/setup.ts'],
    },
  },
]);
