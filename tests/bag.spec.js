import { test, expect } from '@playwright/test';
import { ARMOR, PIECE_NAMES, openGame, collect, savedBag } from './helpers.js';

// Collection integrity around Reset and set completion: flags only ever describe the bag they are written to.
const KEY = 'loot-pixel-armor-v1';
const SOLAR = ARMOR.filter((a) => a.set === 0).map((a) => a.name);
const EMPTY = { owned: {}, complete: false, sets: {} };

/** Steps one frame at a time (at most `max`) until APP.S[key] === value; returns whether it got there. */
const stepUntil = (page, key, value, max = 600) =>
  page.evaluate(
    ([k, v, n]) => {
      for (let f = 0; f < n && window.APP.S[k] !== v; f++) window.__adv(1);
      return window.APP.S[k] === v;
    },
    [key, value, max],
  );

/** Opens one card of the given name and stops on the frame it is revealed (its stamp comes 1.9 s later). */
async function reveal(page, adv, name) {
  await page.evaluate((n) => {
    window.APP.forceCard = n;
    window.APP.forceFake = false;
    window.APP.beginHold();
  }, name);
  await adv(100);
  await page.evaluate(() => window.APP.endHold());
  expect(await stepUntil(page, 'phase', 'revealed')).toBe(true);
}

/** Collects the revealed card and stops on the frame it lands in the bag (arrive()). */
async function land(page) {
  await page.evaluate(() => window.APP.leave());
  expect(await stepUntil(page, 'hidden', true)).toBe(true);
}

/**
 * openGame with a bag already saved, as after a reload. openGame's init script clears localStorage; the bag is written
 * again after that clear, whichever of the two init scripts runs first.
 */
async function openWithBag(page, bag) {
  await page.addInitScript(
    ([key, value]) => {
      const clear = Storage.prototype.clear;
      Storage.prototype.clear = function () {
        clear.call(this);
        this.setItem(key, value);
      };
      localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify(bag)],
  );
  return openGame(page);
}

async function confirmReset(page) {
  const reset = page.locator('#reset');
  await reset.click();
  await reset.click();
  await expect(page.locator('#live')).toHaveText('Collection reset: 0 of 30');
}

test('reset right after the set-completing piece lands: the fresh bag gets no set flag and the next card enters', async ({
  page,
}) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  for (const name of SOLAR.slice(0, 4)) await collect(page, adv, name);
  await reveal(page, adv, SOLAR[4]);
  await land(page); // the SOLAR SET celebration is now 380 ms away
  await confirmReset(page);
  await adv(30);
  expect(await savedBag(page)).toEqual(EMPTY);
  expect(await page.evaluate(() => [window.APP.S.phase, window.APP.S.title])).toEqual(['entering', null]);
  expect(errors).toEqual([]);
});

test('reset right after the 30th piece lands: the fresh bag is not marked complete and the next card enters', async ({
  page,
}) => {
  const last = PIECE_NAMES[PIECE_NAMES.length - 1];
  const owned = Object.fromEntries(PIECE_NAMES.filter((n) => n !== last).map((n) => [n, 1]));
  const { errors, adv } = await openWithBag(page, {
    owned,
    complete: false,
    sets: { 0: true, 1: true, 2: true, 3: true, 4: true },
  });
  await adv(90);
  await reveal(page, adv, last);
  await land(page); // the ALL SETS! celebration is now 380 ms away
  await confirmReset(page);
  await adv(30);
  expect(await savedBag(page)).toEqual(EMPTY);
  expect(await page.evaluate(() => [window.APP.S.phase, window.APP.S.title])).toEqual(['entering', null]);
  expect(errors).toEqual([]);
});

test('a set completed by a reveal that was never collected is celebrated on the first landing after a reload', async ({
  page,
  context,
}) => {
  const first = await openGame(page);
  await first.adv(90);
  for (const name of SOLAR.slice(0, 4)) await collect(page, first.adv, name);
  await reveal(page, first.adv, SOLAR[4]);
  await first.adv(130); // NEW! stamp; the player closes the tab instead of pressing Draw another
  expect(await page.evaluate(() => window.APP.S.stamp.text)).toBe('NEW!');
  const saved = await savedBag(page);
  expect(Object.keys(saved.owned).sort()).toEqual([...SOLAR].sort());
  expect(saved.sets).toEqual({});
  expect(first.errors).toEqual([]);
  await page.close();

  const again = await context.newPage();
  const { errors, adv } = await openWithBag(again, saved);
  await adv(90);
  await collect(again, adv, 'RAVEN BOOTS', { settle: 420 }); // another set's piece
  await expect(again.locator('#live')).toHaveText('Solar set complete');
  expect((await savedBag(again)).sets).toEqual({ 0: true });
  expect(errors).toEqual([]);
});

test('reset while a revealed piece is on screen: the piece stays in the fresh bag and its stamp says NEW!', async ({
  page,
}) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await collect(page, adv, 'SOLAR BOOTS');
  await collect(page, adv, 'SOLAR BOOTS');
  await reveal(page, adv, 'SOLAR BOOTS');
  expect((await savedBag(page)).owned).toEqual({ 'SOLAR BOOTS': 3 });
  await confirmReset(page); // before the stamp, which would have said x3
  expect(await savedBag(page)).toEqual({ owned: { 'SOLAR BOOTS': 1 }, complete: false, sets: {} });
  await expect(page.locator('#reset')).toBeEnabled();
  await adv(130);
  expect(await page.evaluate(() => window.APP.S.stamp)).toMatchObject({ text: 'NEW!', key: 'y' });
  await land(page);
  await adv(30);
  expect(await savedBag(page)).toEqual({ owned: { 'SOLAR BOOTS': 1 }, complete: false, sets: {} });
  expect(await page.evaluate(() => window.APP.S.phase)).toBe('entering');
  expect(errors).toEqual([]);
});

test('reset after the stamp is up: the stamp switches to NEW!', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  await collect(page, adv, 'SOLAR BOOTS');
  await reveal(page, adv, 'SOLAR BOOTS');
  await adv(130);
  expect(await page.evaluate(() => window.APP.S.stamp)).toMatchObject({ text: 'x2', key: '4' });
  await confirmReset(page);
  expect(await page.evaluate(() => window.APP.S.stamp)).toMatchObject({ text: 'NEW!', key: 'y' });
  expect(errors).toEqual([]);
});

test('set and collection flags saved on a bag that does not own those pieces are dropped on load', async ({ page }) => {
  // what the old reset/celebration race left behind: SOLAR really complete, ECLIPSE and "complete" flagged falsely
  const owned = Object.fromEntries(SOLAR.map((n) => [n, 1]));
  const { errors, adv } = await openWithBag(page, { owned, complete: true, sets: { 0: true, 1: true } });
  await adv(90);
  await collect(page, adv, 'RAVEN BOOTS');
  expect(await savedBag(page)).toEqual({ owned: { ...owned, 'RAVEN BOOTS': 1 }, complete: false, sets: { 0: true } });
  expect(errors).toEqual([]);
});
