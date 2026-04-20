import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const entries = ['hud', 'flow-editor', 'accessibility'] as const;

export default defineConfig(({ mode }) => {
  const entry = (process.env.ENTRY as string) || '';

  // When ENTRY is set, build a single entry (used in npm scripts loop)
  if (entry && entries.includes(entry as (typeof entries)[number])) {
    return singleEntry(entry);
  }

  // Default: build all entries sequentially via a custom plugin
  return singleEntry('hud');
});

function singleEntry(name: string) {
  return {
    plugins: [react()],
    build: {
      outDir: `../dist/webview/${name}`,
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, `${name}/main.tsx`),
        output: {
          entryFileNames: 'index.js',
          assetFileNames: 'index[extname]',
          chunkFileNames: '[name].js',
        },
      },
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
  };
}
