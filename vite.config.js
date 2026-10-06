import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: { output: { entryFileNames: 'app.js', assetFileNames: 'app.[ext]' } },
  },
  server: { port: 5173 },
});
