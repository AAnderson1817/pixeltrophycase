import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build is one self-contained HTML file (JS, CSS and the sprite atlas inlined) so it can be published as a
// claude.ai artifact or opened straight from disk. Google Fonts stays an external stylesheet (allowed by the CSP).
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: { port: 5173 },
});
