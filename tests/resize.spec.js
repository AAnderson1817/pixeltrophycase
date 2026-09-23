import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

// Layout robustness: the game must survive a zero-size frame and a resize at any point of a card's life.

// the harness stubs requestAnimationFrame, so waits poll on a timer
const POLL = { polling: 50 };

/** Loads a second copy of the game into an iframe with the given CSS size (the harness init script runs there too). */
async function gameFrame(page, css) {
  await page.evaluate(
    (st) =>
      new Promise((res) => {
        const f = document.createElement('iframe');
        f.id = 'sub';
        f.style.cssText = 'position:fixed;left:0;top:0;border:0;' + st;
        f.onload = res;
        f.src = location.href;
        document.body.appendChild(f);
      }),
    css,
  );
  return (await page.$('#sub')).contentFrame();
}
const sizeFrame = (page, css) => page.evaluate((st) => (document.getElementById('sub').style.cssText += st), css);
/** Steps the framed game; returns the error message if a frame threw. */
const stepFrame = (frame, n) =>
  frame.evaluate((k) => {
    try {
      for (let i = 0; i < k; i++) window.APP.step(1 / 60);
      return null;
    } catch (e) {
      return e.message;
    }
  }, n);
const frameState = (frame) =>
  frame.evaluate(() => ({
    ready: window.__ready === true,
    err: getComputedStyle(document.getElementById('err')).display,
    msg: document.getElementById('err').textContent,
  }));

for (const css of ['display:none;width:800px;height:600px', 'width:0;height:600px', 'width:800px;height:0']) {
  test(`boots in a zero-size frame (${css}) and lays out once the frame gets a size`, async ({ page }) => {
    const { errors } = await openGame(page);
    const frame = await gameFrame(page, css);
    expect(await frameState(frame)).toEqual({ ready: true, err: 'none', msg: '' });
    expect(await stepFrame(frame, 5)).toBeNull();

    await sizeFrame(page, 'display:block;width:800px;height:600px');
    await frame.waitForFunction(() => window.APP.layout().W === 400 && window.APP.layout().H === 300, null, POLL);
    const rt = await frame.evaluate(() => window.APP.S.rt);
    expect(await stepFrame(frame, 30)).toBeNull();
    expect(await frame.evaluate(() => window.APP.S.rt)).toBeGreaterThan(rt + 0.4);
    expect((await frameState(frame)).err).toBe('none');
    expect(errors).toEqual([]);
  });
}

test('a frame that collapses to zero width and comes back keeps running', async ({ page }) => {
  const { errors } = await openGame(page);
  const frame = await gameFrame(page, 'width:800px;height:600px');
  expect((await frameState(frame)).ready).toBe(true);
  expect(await stepFrame(frame, 30)).toBeNull();

  await sizeFrame(page, 'width:0');
  await frame.waitForFunction(() => window.APP.layout().W !== 400, null, POLL);
  expect(await stepFrame(frame, 5)).toBeNull();

  await sizeFrame(page, 'width:800px');
  await frame.waitForFunction(() => window.APP.layout().W === 400, null, POLL);
  const rt = await frame.evaluate(() => window.APP.S.rt);
  expect(await stepFrame(frame, 30)).toBeNull();
  expect(await frame.evaluate(() => window.APP.S.rt)).toBeGreaterThan(rt + 0.4);
  expect((await frameState(frame)).err).toBe('none');
  expect(errors).toEqual([]);
});

test('a resize during the collect flight still lands the card on its slot', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await page.evaluate(() => {
    window.APP.forceCard = 'SOLAR BOOTS';
    window.APP.forceFake = false;
    window.APP.beginHold();
  });
  await adv(100);
  await page.evaluate(() => window.APP.endHold());
  await adv(200);
  await page.evaluate(() => window.APP.leave());
  await adv(15);
  await page.setViewportSize({ width: 390, height: 844 }); // desktop to portrait mid-flight
  await page.waitForFunction(() => window.APP.layout().NARROW, null, POLL);
  await adv(30); // the flight takes 0.7 s; the next card is summoned 240 ms after it lands
  const r = await page.evaluate(() => {
    const { S, POOL } = window.APP,
      L = window.APP.layout(),
      c = POOL[S.col.i],
      col = c.set % L.BG.gpr,
      row = Math.floor(c.set / L.BG.gpr);
    return {
      phase: S.phase,
      done: S.col.done,
      x: L.CX + S.pos.x,
      y: L.CY + S.pos.y,
      scale: S.colScale,
      slotX: L.BAGX + col * (L.BG.gw + L.BG.gg) + c.k * (L.SLOT + 2) + L.SLOT / 2,
      slotY: L.BAGY + row * (L.SLOT + 3) + L.SLOT / 2,
      slotScale: L.SLOT / 90,
    };
  });
  expect(r.phase).toBe('collecting');
  expect(r.done).toBe(true);
  expect(r.x).toBeCloseTo(r.slotX, 5);
  expect(r.y).toBeCloseTo(r.slotY, 5);
  expect(r.scale).toBeCloseTo(r.slotScale, 5);
  expect(errors).toEqual([]);
});

test('a resize mid-reveal drops the wall debris cut from the old scene', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(120);
  await page.evaluate(() => {
    window.APP.force(3);
    window.APP.forceFake = false;
    window.APP.beginHold();
  });
  await adv(99);
  await page.evaluate(() => window.APP.endHold());
  await adv(130); // the wall is coming down: bricks, dust and card shards in flight
  const fx = () =>
    page.evaluate(() => {
      const { FX, S } = window.APP;
      return {
        phase: S.phase,
        wall: S.wall.active,
        bricks: FX.bricks.length,
        tiles: FX.tiles.length,
        dustp: FX.dustp.length,
      };
    });
  const before = await fx();
  expect(before).toMatchObject({ phase: 'revealed', wall: true });
  expect(before.bricks).toBeGreaterThan(0);
  expect(before.tiles).toBeGreaterThan(0);
  expect(before.dustp).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForFunction(() => window.APP.layout().W === 367, null, POLL);
  expect(await fx()).toEqual({ phase: 'revealed', wall: false, bricks: 0, tiles: 0, dustp: 0 });

  // the reveal carries on, and the next card breaks the wall at the new size
  await adv(120);
  await page.evaluate(() => window.APP.leave());
  await adv(120);
  await page.evaluate(() => {
    window.APP.force(3);
    window.APP.beginHold();
  });
  await adv(99);
  await page.evaluate(() => window.APP.endHold());
  await adv(130);
  const next = await fx();
  expect(next).toMatchObject({ phase: 'revealed', wall: true });
  expect(next.bricks).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
