// `npm run test:dist`: the Playwright suite against the built dist/index.html (the npm script builds first).
// Sets GAME_URL from Node so it works in any shell, cmd.exe included. Extra arguments go to `playwright test`.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const env = { ...process.env, GAME_URL: pathToFileURL(resolve('dist/index.html')).href };
const { status } = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], { stdio: 'inherit', env });
process.exit(status ?? 1);
