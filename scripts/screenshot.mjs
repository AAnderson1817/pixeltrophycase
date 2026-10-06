// Headless render check. Builds dist/ if needed, serves it, drives the deterministic ceremony to key moments and
// screenshots them. With --check it also asserts the whole loop (nine seatings, finale, reset) completes without
// console errors, and exits non-zero otherwise.
// Usage: node scripts/screenshot.mjs [--check] [--out docs/shots] [--build] [--nobloom]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve('dist');
if (!fs.existsSync(path.join(root, 'index.html')) || args.includes('--build')) { console.log('building…'); execSync('npm run build', { stdio: 'inherit' }); }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?headless=1${args.includes('--nobloom') ? '&nobloom=1' : ''}`;
const outDir = opt('out', 'scripts/out');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });

// Moments: [file stem, predicate source]. Predicates run in the page against the director state.
const moments = [
  ['01_summon', 'S.phase === "summon" && S.pt >= 1.0'],
  ['02_present', 'S.phase === "present" && S.pt >= 2.1'],
  ['03_place', 'S.phase === "place" && S.pt >= 0.5'],
  ['04_landed', 'S.phase === "seal" && S.idx === 0 && S.pt >= 0.05'],
  ['05_fifth', 'S.phase === "present" && S.idx === 4 && S.pt >= 2.0'],
  ['06_ninth', 'S.phase === "place" && S.idx === 8 && S.pt >= 0.4'],
  ['07_finale', 'S.phase === "finale" && S.pt >= 2.2'],
  ['08_dissolve', 'S.phase === "reset" && S.pt >= 1.4'],
  ['09_loop', 'S.loops >= 1 && S.phase === "summon"'],
];
let totalFrames = 0;
const shots = [];
for (const [stem, pred] of moments) {
  const t0 = Date.now();
  const r = await page.evaluate((src) => {
    const f = new Function('S', `return (${src});`);
    const n = window.APP.stepUntil(f, 12000);
    const S = window.APP.S;
    return { n, t: S.t, phase: S.phase, idx: S.idx, placed: Array.from(S.placed).filter((v) => v >= 0).length, loops: S.loops, ok: f(S) };
  }, pred);
  totalFrames += r.n;
  if (!r.ok) { errors.push(`[moment] ${stem}: predicate not reached within 12000 frames (phase=${r.phase} idx=${r.idx})`); continue; }
  const file = path.join(outDir, `${stem}.png`);
  await page.locator('#stage').screenshot({ path: file });
  shots.push(file);
  console.log(`${stem.padEnd(12)} t=${r.t.toFixed(1).padStart(5)}s phase=${r.phase.padEnd(7)} idx=${r.idx} placed=${r.placed} loops=${r.loops}  ${file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
const perf = await page.evaluate(() => {
  const t0 = performance.now();
  for (let i = 0; i < 240; i++) window.APP.step(1);
  return (performance.now() - t0) / 240;
});
console.log(`frames stepped: ${totalFrames}; mean step+render+present: ${perf.toFixed(2)} ms (headless software canvas)`);
await browser.close(); server.close();
if (errors.length) { console.log('problems:'); for (const e of errors) console.log('  ' + e); }
if (args.includes('--check')) {
  if (errors.length) { console.log('CHECK FAILED'); process.exit(1); }
  console.log('CHECK PASSED: nine treasures seated, finale held, collection dissolved, loop restarted, no console errors.');
}
