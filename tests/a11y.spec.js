import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test('audio is suspended, and the charge voices stopped, while the page is hidden', async ({ page }) => {
  // Real audio and a real frame loop (the deterministic harness removes AudioContext). The wrapper keeps the context
  // and tracks sources that were started without a stop: after the first gesture that is only the ambient drone.
  await page.addInitScript(() => {
    const C = window.AudioContext;
    if (!C) return;
    const live = (window.__live = new Set());
    const P = AudioScheduledSourceNode.prototype,
      start = P.start,
      stop = P.stop;
    P.start = function (...a) {
      live.add(this);
      return start.apply(this, a);
    };
    P.stop = function (...a) {
      live.delete(this);
      return stop.apply(this, a);
    };
    window.AudioContext = class extends C {
      constructor(...a) {
        super(...a);
        window.__ac = this;
        queueMicrotask(() => (window.__drone = new Set(live)));
      }
    };
  });
  const { errors } = await openGame(page, { deterministic: false });
  await page.waitForFunction(() => APP.S.phase === 'idle');
  const box = await page.locator('#hit').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__ac && window.__ac.state === 'running' && APP.S.charge > 0.05);
  await page.evaluate(() => (APP.paused = true)); // hold the charge: no burst while we look
  const extra = () => page.evaluate(() => [...window.__live].filter((s) => !window.__drone.has(s)).length);
  expect(await extra()).toBeGreaterThan(0); // the charge voices are sounding

  await setHidden(page, true);
  await page.waitForFunction(() => window.__ac.state === 'suspended', null, { timeout: 5000 });
  expect(await extra()).toBe(0);
  const t0 = await page.evaluate(() => window.__ac.currentTime);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__ac.currentTime)).toBe(t0);

  await setHidden(page, false);
  await page.waitForFunction(() => window.__ac.state === 'running', null, { timeout: 5000 });

  // hidden again while the resume is still in flight (e.g. Ctrl+Tab past the tab): it must still end up suspended
  await setHidden(page, true);
  await page.waitForFunction(() => window.__ac.state === 'suspended', null, { timeout: 5000 });
  await page.evaluate(() => {
    for (const h of [false, true]) {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__ac.state)).toBe('suspended');
  await setHidden(page, false);
  await page.waitForFunction(() => window.__ac.state === 'running', null, { timeout: 5000 });

  // pagehide suspends too; a context that was already suspended is not resumed by becoming visible
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.waitForFunction(() => window.__ac.state === 'suspended', null, { timeout: 5000 });
  await setHidden(page, false);
  await page.waitForFunction(() => window.__ac.state === 'running', null, { timeout: 5000 });
  await page.evaluate(() => window.__ac.suspend());
  await setHidden(page, true);
  await setHidden(page, false);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__ac.state)).toBe('suspended');

  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('the mute button names its state in its text only, without aria-pressed', async ({ page }) => {
  const { errors } = await openGame(page);
  const mute = page.locator('#mute');
  await expect(mute).toHaveText('Sound on');
  await expect(mute).not.toHaveAttribute('aria-pressed');
  await mute.click();
  await expect(mute).toHaveText('Sound off');
  await expect(mute).not.toHaveAttribute('aria-pressed');
  await mute.click();
  await expect(mute).toHaveText('Sound on');
  await expect(mute).not.toHaveAttribute('aria-pressed');
  expect(errors).toEqual([]);
});

test('"Draw another" can only take focus while it is shown', async ({ page }) => {
  const { errors, adv } = await openGame(page);
  await adv(90);
  const again = page.locator('#again');
  const focusable = () =>
    page.evaluate(() => {
      const b = document.getElementById('again');
      document.getElementById('hit').focus();
      b.focus();
      return document.activeElement === b;
    });
  expect(await page.evaluate(() => APP.S.phase)).toBe('idle');
  await expect(again).not.toHaveClass(/\bshow\b/);
  expect(await focusable()).toBe(false);
  await page.locator('#hit').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('again');

  await page.evaluate(() => {
    APP.forceCard = 'SOLAR BOOTS';
    APP.forceFake = false;
    APP.beginHold();
  });
  await adv(100);
  await page.evaluate(() => APP.endHold());
  await adv(200);
  expect(await page.evaluate(() => APP.S.phase)).toBe('revealed');
  await expect(again).toHaveClass(/\bshow\b/);
  expect(await focusable()).toBe(true);

  await page.evaluate(() => APP.leave());
  await adv(1);
  await expect(again).not.toHaveClass(/\bshow\b/);
  expect(await focusable()).toBe(false);
  expect(errors).toEqual([]);
});
