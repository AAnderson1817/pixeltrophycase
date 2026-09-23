import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openGame } from './helpers.js';

// Golden frames: the main canvas and the bloom buffer are hashed at fixed points of a scripted, deterministic run.
// Any change to what the game draws changes a hash. That is the point: refactors must keep every hash; intentional
// visual changes regenerate them with `npm run test:golden:update` (and the diff of frames.json is reviewed).
const FILE = new URL('./golden/frames.json', import.meta.url);

async function hashCanvases(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const id of ['screen', 'bloom']) {
      const c = document.getElementById(id);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const buf = await crypto.subtle.digest('SHA-256', d);
      out[id] = [...new Uint8Array(buf)]
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return out;
  });
}

test('golden frames', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  const frames = {};
  const snap = async (name) => (frames[name] = await hashCanvases(page));
  const act = (fn, arg) => page.evaluate(fn, arg);

  await adv(120);
  await snap('idle');
  await act(() => {
    APP.force(3);
    APP.forceFake = false;
    APP.beginHold();
  });
  await adv(75);
  await snap('charge');
  await adv(24);
  await snap('hitstop');
  await act(() => APP.endHold());
  await adv(40);
  await snap('reveal-legendary');
  await adv(110);
  await snap('wall-break');
  await adv(100);
  await snap('settled');
  await act(() => APP.leave());
  await adv(20);
  await snap('collect');
  await adv(80);
  // The next card is still being summoned and a hold only starts once it is idle: step until it lands.
  await act(() => {
    for (let i = 0; i < 600 && APP.S.phase !== 'idle'; i++) window.__adv(1);
  });
  await act(() => {
    APP.force(2);
    APP.forceFake = true;
    APP.beginHold();
  });
  await adv(105);
  await act(() => APP.endHold());
  await adv(60);
  await snap('fake-rare');
  await adv(150);
  await snap('upgrade');
  await adv(80);
  await snap('epic');
  expect(errors).toEqual([]);

  // Re-record only on request (`npm run test:golden:update` passes --update-snapshots); a missing file is a failure.
  if (['all', 'changed'].includes(test.info().config.updateSnapshots)) {
    mkdirSync(new URL('./golden/', import.meta.url), { recursive: true });
    writeFileSync(FILE, JSON.stringify(frames, null, 2) + '\n');
    console.log('golden: wrote tests/golden/frames.json');
    return;
  }
  expect(existsSync(FILE), 'tests/golden/frames.json is missing: run npm run test:golden:update').toBe(true);
  expect(frames).toEqual(JSON.parse(readFileSync(FILE, 'utf8')));
});
