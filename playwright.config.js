import { defineConfig } from '@playwright/test';

// By default tests run against a Vite dev server started here (source modules). GAME_URL points them at another
// build instead: `npm run test:dist` sets it to the file:// URL of dist/index.html. GAME_PORT moves the dev server off
// 5179 (e.g. two checkouts testing at once); a port that is already in use fails the run instead of being reused.
const external = process.env.GAME_URL;
const port = Number(process.env.GAME_PORT || 5179);

export default defineConfig({
  testDir: 'tests',
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: external ? undefined : `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
  },
  webServer: external
    ? undefined
    : {
        command: `npx vite --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
