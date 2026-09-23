import { test, expect } from '@playwright/test';
import { openGame, collect } from './helpers.js';

// Hold input: who owns a hold, what ends it, presses made during the summon, tap detection, rarity pills.

const hold = (page) =>
  page.evaluate(() => {
    const { phase, holding, auto, charge, r, vr, tease, teaseKey, lightKey } = window.APP.S;
    return { phase, holding, auto, charge, r, vr, tease, teaseKey, lightKey };
  });

async function pointAtCard(page) {
  const b = await page.locator('#hit').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
}

test('switching the rarity pill after a drained charge drops the old tier tease', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await page.locator('.pill[data-force="3"]').click();
  await page.evaluate(() => {
    window.APP.forceFake = false;
    window.APP.beginHold();
  });
  await adv(90); // charge .94: teased up to Legendary
  expect(await hold(page)).toMatchObject({ r: 3, tease: 3, teaseKey: 'y', lightKey: 'y' });
  await page.evaluate(() => window.APP.endHold());
  await adv(90); // drained back to 0
  expect(await hold(page)).toMatchObject({ phase: 'idle', charge: 0 });

  await page.locator('.pill[data-force="0"]').click();
  expect(await hold(page)).toMatchObject({ r: -1, tease: 0, teaseKey: 's', lightKey: 's' });
  await page.evaluate(() => window.APP.beginHold());
  await adv(10);
  expect(await hold(page)).toMatchObject({ r: 0, vr: 0, tease: 0, teaseKey: 's', lightKey: 's', holding: true });
  expect(errors).toEqual([]);
});

test('a pointer hold ends only on its own release, not on another pointer or the keyboard', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await pointAtCard(page);
  await page.mouse.down();
  await adv(30);
  // a second finger (or a palm) touches the page and lifts
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 98 }));
  });
  await adv(5);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: true, auto: false });
  // Space pressed and released during the pointer hold
  await page.keyboard.press('Space');
  await adv(5);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: true, auto: false });
  await page.mouse.up();
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  expect(errors).toEqual([]);
});

test('a keyboard hold ends only on the key release, not on a click elsewhere', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await page.locator('#hit').focus();
  await page.keyboard.down('Space');
  await adv(30);
  await page.mouse.click(5, 5);
  await adv(5);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: true, auto: false });
  await page.keyboard.up('Space');
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  expect(errors).toEqual([]);
});

test('Space and Enter are separate holds: releasing one does not end the other', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await page.locator('#hit').focus();
  await page.keyboard.down('Space');
  await adv(20);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await adv(5);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: true, auto: false });
  await page.keyboard.up('Space');
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  expect(errors).toEqual([]);
});

test('a hold ends when the window loses focus', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await page.locator('#hit').focus();
  await page.keyboard.down('Space');
  await adv(20);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await adv(120); // the keyup went to another window: the card must not charge on and open by itself
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false, charge: 0 });
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});

test('a hold ends when the page is hidden', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await pointAtCard(page);
  await page.mouse.down();
  await adv(20);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await adv(120);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false, charge: 0 });
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('a press made during the summon becomes a hold when the card lands, if still held', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(20);
  expect(await hold(page)).toMatchObject({ phase: 'entering' });
  // pointer pressed mid-summon and held through the landing
  await pointAtCard(page);
  await page.mouse.down();
  await adv(60);
  let s = await hold(page);
  expect(s).toMatchObject({ phase: 'idle', holding: true, auto: false });
  expect(s.charge).toBeGreaterThan(0);
  await page.mouse.up();
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  await adv(60);

  // Space pressed and released mid-summon: nothing is held when the card lands
  await collect(page, adv, 'SOLAR BOOTS', { settle: 70 });
  expect(await hold(page)).toMatchObject({ phase: 'entering' });
  await page.locator('#hit').focus();
  await page.keyboard.press('Space');
  await adv(60);
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false, charge: 0 });

  // Space pressed mid-summon and held through the landing
  await collect(page, adv, 'SUN GAUNTLET', { settle: 70 });
  expect(await hold(page)).toMatchObject({ phase: 'entering' });
  await page.locator('#hit').focus();
  await page.keyboard.down('Space');
  await adv(60);
  s = await hold(page);
  expect(s).toMatchObject({ phase: 'idle', holding: true, auto: false });
  expect(s.charge).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  expect(errors).toEqual([]);
});

test('tap versus hold is timed on the game clock, not on wall-clock time', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  // 0.33 s of game time with the wall clock standing still: a hold, not a tap
  const held = await page.evaluate(() => {
    const now = performance.now;
    performance.now = () => 0;
    window.APP.beginHold();
    window.__adv(20);
    window.APP.endHold();
    performance.now = now;
    return window.APP.S.auto;
  });
  expect(held).toBe(false);
  await adv(60);
  expect(await hold(page)).toMatchObject({ phase: 'idle', charge: 0 });
  // 0.1 s of game time on a slow machine (300 ms of wall clock): a tap, which auto-opens the card
  const tapped = await page.evaluate(() => {
    window.APP.beginHold();
    window.__adv(6);
    const t = performance.now();
    while (performance.now() - t < 300);
    window.APP.endHold();
    return window.APP.S.auto;
  });
  expect(tapped).toBe(true);
  expect(errors).toEqual([]);
});

test('a press held through the summon is not a tap, however soon after the landing it is released', async ({
  page,
}) => {
  const { errors, adv } = await openGame(page);
  await adv(20);
  expect(await hold(page)).toMatchObject({ phase: 'entering' });
  await pointAtCard(page);
  await page.mouse.down();
  await page.evaluate(() => {
    for (let i = 0; i < 600 && window.APP.S.phase !== 'idle'; i++) window.__adv(1);
    window.__adv(3); // released 0.05 s after the landing, well over 0.24 s after the press
  });
  await page.mouse.up();
  expect(await hold(page)).toMatchObject({ phase: 'idle', holding: false, auto: false });
  expect(errors).toEqual([]);
});
