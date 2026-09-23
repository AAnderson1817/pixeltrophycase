import { readFileSync } from 'node:fs';

export const ARMOR = JSON.parse(readFileSync(new URL('../src/data/armor-atlas.json', import.meta.url), 'utf8'));
export const PIECE_NAMES = ARMOR.map((a) => a.name);

/**
 * Opens the game in a deterministic harness: no audio, seeded Math.random, no rAF loop (frames are stepped with
 * APP.step at 1/60 s) and a simulated setTimeout clock so the game's `later()` timers fire on simulated time.
 * Google Fonts is blocked so the HUD (and therefore the layout) is measured with the same fallback font everywhere.
 */
export async function openGame(page, { deterministic = true } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|fonts\.g/.test(m.text())) errors.push(m.text());
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript((det) => {
    try {
      localStorage.clear();
    } catch {}
    if (!det) return;
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    window.requestAnimationFrame = () => 0;
    let s = 777;
    Math.random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x80000000;
    };
  }, deterministic);
  await page.goto(process.env.GAME_URL || '/');
  await page.waitForFunction(() => window.__ready === true);
  if (deterministic) {
    await page.evaluate(() => {
      const sim = { t: 0, q: [], id: 0 };
      window.setTimeout = (f, ms) => {
        sim.q.push({ t: sim.t + (ms || 0), f, id: ++sim.id });
        return sim.id;
      };
      window.clearTimeout = (id) => {
        sim.q = sim.q.filter((e) => e.id !== id);
      };
      window.__adv = (n) => {
        for (let i = 0; i < n; i++) {
          sim.t += 1000 / 60;
          const due = sim.q.filter((e) => e.t <= sim.t);
          sim.q = sim.q.filter((e) => e.t > sim.t);
          due.sort((a, b) => a.t - b.t).forEach((e) => e.f());
          window.APP.step(1 / 60);
        }
      };
    });
  }
  const adv = (frames) => page.evaluate((n) => window.__adv(n), frames);
  return { errors, adv };
}

/** Opens one card of the given name and puts it in the bag. */
export async function collect(page, adv, name, { settle = 200 } = {}) {
  await page.evaluate((n) => {
    window.APP.forceCard = n;
    window.APP.forceFake = false;
    window.APP.beginHold();
  }, name);
  await adv(100);
  await page.evaluate(() => window.APP.endHold());
  await adv(200);
  await page.evaluate(() => window.APP.leave());
  await adv(settle);
}

export const savedBag = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('loot-pixel-armor-v1') || 'null'));
