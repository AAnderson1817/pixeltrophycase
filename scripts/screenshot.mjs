// Headless render check: builds the app, serves dist/, drives the deterministic simulation to key moments and screenshots them.
// Usage: node scripts/screenshot.mjs [--times 4,30,62,134] [--out scripts/out] [--prefix shot] [--jpeg] [--probe] [--nobloom] [--noglass] [--build]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const times = opt('times', '4,16,27,46,62,76,100,136').split(',').map(Number);
const root = path.resolve('dist');
if (!fs.existsSync(path.join(root, 'index.html')) || args.includes('--build')) { console.log('building…'); execSync('npx vite build', { stdio: 'inherit' }); }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const outDir = opt('out', 'scripts/out'); const jpeg = args.includes('--jpeg');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__app && window.__app.machine, null, { timeout: 120000 });
const info = await page.evaluate(() => ({ bodies: window.__app.pw.bodyCount(), stages: window.__app.machine.stages.length, gl: window.__app.renderer.getContext().getParameter(window.__app.renderer.getContext().VERSION) }));
console.log('app ready:', info);
await page.evaluate(() => { window.__app.start(); });
for (const t of times) {
  const t0 = Date.now();
  const reached = await page.evaluate(({ tt, nobloom, noglass }) => { const a = window.__app; a.bloom.enabled = !nobloom; if (noglass) a.scene.traverse((o) => { if (o.isMesh && o.material?.transparent && o.material.opacity < 0.5) o.visible = false; }); a.stepTo(tt); return a.machine.stages.filter(s => s.reachedAt !== null).length; }, { tt: t, nobloom: args.includes('--nobloom'), noglass: args.includes('--noglass') });
  if (args.includes('--probe')) {
    const pr = await page.evaluate(() => { const a = window.__app, d = a.director, c = a.camera, st = a.machine.stages[Math.max(0, a.machine.current)]; const f = (v) => [v.x, v.y, v.z].map(n => n.toFixed(2)).join(','); const T = window.__THREE; const inside = []; const box = new T.Box3();
      a.scene.traverse((o) => { if (o.isMesh && o.visible && o.geometry && o.parent?.name !== 'hall') { box.setFromObject(o); if (box.containsPoint(c.position)) inside.push(o.parent?.name || o.name || o.type); } });
      const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(0, 0), c); rc.far = 60;
      const hits = rc.intersectObjects(a.scene.children, true).filter(h => h.object.isMesh && h.object.parent?.name !== 'hall').slice(0, 3).map(h => `${h.object.parent?.name || h.object.name || h.object.type}@${h.distance.toFixed(1)}m`);
      return { stage: st.name, cam: f(c.position), target: f(d.lookTarget), hero: st.hero?.obj ? f(st.hero.obj.position) : null, inside: [...new Set(inside)], centreRay: hits }; });
    console.log('   probe', JSON.stringify(pr));
  }
  const file = `${outDir}/${opt('prefix', 'shot')}_${String(t).padStart(3, '0')}s.${jpeg ? 'jpg' : 'png'}`;
  await page.waitForTimeout(600); // let HUD CSS transitions settle
  await page.screenshot(jpeg ? { path: file, type: 'jpeg', quality: 82 } : { path: file });
  console.log(`t=${t}s stages reached=${reached}  -> ${file}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
if (errors.length) { console.log('console errors/warnings:'); for (const e of errors.slice(0, 20)) console.log('  ' + e); }
await browser.close(); server.close();
