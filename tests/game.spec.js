import { test, expect } from '@playwright/test';
import { openGame, collect, savedBag, PIECE_NAMES } from './helpers.js';

test('boots cleanly and draws the vault', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('screen');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return { colours: colours.size, err: getComputedStyle(document.getElementById('err')).display };
  });
  expect(errors).toEqual([]);
  expect(stats.err).toBe('none');
  expect(stats.colours).toBeGreaterThan(20);
  await expect(page.locator('#reset')).toBeDisabled();
});

test('every piece can be revealed, and collecting all 30 completes each set and the collection', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  for (let i = 0; i < PIECE_NAMES.length; i++) {
    await collect(page, adv, PIECE_NAMES[i], { settle: i % 5 === 4 ? 420 : 200 });
    if (i === 4) {
      const bag = await savedBag(page);
      expect(bag.sets['0']).toBe(true);
      expect(bag.sets['1']).toBeFalsy();
    }
  }
  const bag = await savedBag(page);
  expect(Object.keys(bag.owned)).toHaveLength(30);
  expect(bag.complete).toBe(true);
  expect(Object.values(bag.sets).filter(Boolean)).toHaveLength(6);
  await expect(page.locator('#live')).toHaveText('All six armor sets collected');
  expect(errors).toEqual([]);
});

test('reset needs a second press and then empties the collection', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await collect(page, adv, 'SOLAR BOOTS');
  await collect(page, adv, 'SUN GAUNTLET');
  const reset = page.locator('#reset');
  await expect(reset).toBeEnabled();

  await reset.click();
  await expect(reset).toHaveText('Sure?');
  await adv(200); // > 3 s: the confirmation lapses
  await expect(reset).toHaveText('Reset');
  expect(Object.keys((await savedBag(page)).owned)).toHaveLength(2);

  await reset.click();
  await reset.click();
  await expect(reset).toBeDisabled();
  expect(Object.keys((await savedBag(page)).owned)).toHaveLength(0);
  await expect(page.locator('#live')).toHaveText('Collection reset: 0 of 30');
  expect(errors).toEqual([]);
});

for (const [w, h] of [
  [390, 844],
  [1280, 800],
  [1920, 1080],
]) {
  test(`layout fits at ${w}x${h}: bag clear of the card and the HUD`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const { errors } = await openGame(page);
    const L = await page.evaluate(() => window.APP.layout());
    const hudTop = await page.evaluate(() => document.getElementById('hud').getBoundingClientRect().top);
    const bagBottom = (L.BAGY + L.BG.h) * L.SC;
    const cardTop = (L.CY - 45) * L.SC;
    const cardBottom = (L.CY + 45) * L.SC;
    if (L.NARROW) {
      expect(L.BAGY * L.SC).toBeGreaterThan(cardBottom); // bag sits under the altar
      expect(bagBottom).toBeLessThanOrEqual(hudTop);
    } else {
      expect(bagBottom).toBeLessThan(cardTop); // bag row(s) above the card
      expect(L.BAGX + L.BG.w).toBeLessThanOrEqual(L.W);
    }
    expect(errors).toEqual([]);
  });
}
