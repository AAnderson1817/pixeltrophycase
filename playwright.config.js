import { defineConfig } from '@playwright/test';

// By default tests run against the Vite dev server (source modules). Set GAME_URL to test another build,
// e.g. `npm run test:dist` (file:// URL of the single-file build).
const external = process.env.GAME_URL;

export default defineConfig({
  testDir: 'tests',
  timeout: 180_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: external ? undefined : 'http://localhost:5179',
    viewport: { width: 1280, height: 800 },
  },
  webServer: external
    ? undefined
    : {
        command: 'npx vite --port 5179 --strictPort',
        url: 'http://localhost:5179',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
