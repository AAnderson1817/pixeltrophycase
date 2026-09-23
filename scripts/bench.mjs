// Frame-cost benchmark in headless Chromium. Plays a scripted session (idle, legendary reveal with wall break,
// collect, fake-out epic upgrade) on the real rAF loop and reports per-phase script time and frame intervals.
//
//   npm run build && npm run bench                     # dist/index.html, 1920x1080
//   npm run bench -- --size 390x844 --dpr 3 --cpu 4    # phone-sized, CPU slowed 4x
//   npm run bench -- --url http://localhost:5173       # a running dev server
//   npm run bench -- --no-probe                        # keep the bloom layer even if the compositor is slow
//
// "script ms" is time spent in the game's frame callback (JS + canvas raster). Headless Chromium composites in
// software, so fps here understates what a GPU-composited browser does with the blended bloom layer.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0
    ? d
    : process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--')
      ? true
      : process.argv[i + 1];
};
const [W, H] = String(arg('size', '1920x1080')).split('x').map(Number);
const DPR = +arg('dpr', 1),
  CPU = +arg('cpu', 1);
const url = arg('url', 'file://' + resolve('dist/index.html'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__frames = [];
  window.__marks = [];
  window.requestAnimationFrame = (cb) =>
    raf((ts) => {
      const t0 = performance.now();
      cb(ts);
      window.__frames.push([t0, performance.now() - t0]);
    });
});
const cdp = await ctx.newCDPSession(page);
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
if (arg('no-probe', false)) await page.evaluate(() => (window.APP.noProbe = true));

const wait = (ms) => page.waitForTimeout(ms);
const mark = (n) => page.evaluate((n) => window.__marks.push([n, performance.now()]), n);
await wait(1500);
await mark('idle');
await wait(2000);
await page.evaluate(() => {
  APP.force(3);
  APP.forceFake = false;
});
await mark('charge');
await page.evaluate(() => APP.beginHold());
await wait(1700);
await page.evaluate(() => APP.endHold());
await mark('legendary reveal');
await wait(5500);
await mark('collect + enter');
await page.evaluate(() => APP.leave());
await wait(2500);
await page.evaluate(() => {
  APP.force(2);
  APP.forceFake = true;
});
await mark('charge 2');
await page.evaluate(() => APP.beginHold());
await wait(1700);
await page.evaluate(() => APP.endHold());
await mark('fake-out + upgrade');
await wait(6500);
await mark('end');

const { frames, marks, perf } = await page.evaluate(() => ({
  frames: window.__frames,
  marks: window.__marks,
  perf: window.APP.PERF,
}));
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);
const rows = [];
for (let i = 0; i < marks.length - 1; i++) {
  const [name, a] = marks[i],
    b = marks[i + 1][1];
  const fr = frames.filter((f) => f[0] >= a && f[0] < b);
  const ms = fr.map((f) => f[1]).sort((x, y) => x - y);
  const iv = fr
    .slice(1)
    .map((f, k) => f[0] - fr[k][0])
    .sort((x, y) => x - y);
  rows.push({
    phase: name,
    fps: +(fr.length / ((b - a) / 1000)).toFixed(1),
    'script ms mean': +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(2),
    'script ms p95': +q(ms, 0.95).toFixed(1),
    'script ms max': +ms[ms.length - 1].toFixed(1),
    'frames >16.7ms': ms.filter((x) => x > 16.7).length,
    'interval p95': +q(iv, 0.95).toFixed(1),
  });
}
console.log(`${url}  ${W}x${H} @${DPR}x  cpu x${CPU}`);
console.table(rows);
console.log('governor:', JSON.stringify(perf));
if (errors.length) console.log('page errors:', errors);
await browser.close();
