/**
 * The collection: the bag persisted in localStorage, per-slot state, the grid geometry (one group of 5 per set) and reset.
 */
import { $ } from '../core/util.js';
import { POOL, SETS } from '../data/armor.js';
import { BAGX, BAGY, BG, NARROW, SLOT } from './layout.js';

const STORE = 'loot-pixel-armor-v1';
export let BAG = {
  owned: {},
  complete: false,
  sets: {},
};
try {
  const v = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (v && v.owned) {
    BAG = v;
    BAG.sets = BAG.sets || {};
    // flags must agree with owned: older builds could save set/complete flags on a bag emptied by a reset
    const has = (c) => BAG.owned[c.name];
    SETS.forEach((_, k) => {
      if (BAG.sets[k] && !POOL.every((c) => c.set !== k || has(c))) delete BAG.sets[k];
    });
    if (BAG.complete && !POOL.every(has)) BAG.complete = false;
  }
} catch {}
export const saveBag = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(BAG));
  } catch {}
};
export let slotShown = POOL.map((c) => !!BAG.owned[c.name]),
  slotFlash = POOL.map(() => -1);
export const shownCount = () => slotShown.filter(Boolean).length;
export const syncReset = () => {
  const b = $('reset');
  b.disabled = Object.keys(BAG.owned).length === 0;
  if (b.disabled) {
    b.classList.remove('armed');
    b.textContent = 'Reset';
  }
};
syncReset();
// bag: one group of 5 slots per set; 3 groups per row on wide screens (2 rows), 2 per row on narrow ones (3 rows)
export function bagGeom(slot) {
  const gpr = NARROW ? 2 : 3,
    rows = Math.ceil(SETS.length / gpr),
    gg = NARROW ? 4 : 6,
    gw = 5 * (slot + 2) - 2;
  return {
    gpr,
    rows,
    gg,
    gw,
    w: gpr * gw + (gpr - 1) * gg,
    h: rows * (slot + 3) - 1,
  };
}
// o: optional object to fill instead of allocating one (per-frame callers)
export function slotRect(i, o = {}) {
  const c = POOL[i],
    col = c.set % BG.gpr,
    row = Math.floor(c.set / BG.gpr);
  o.x = BAGX + col * (BG.gw + BG.gg) + c.k * (SLOT + 2);
  o.y = BAGY + row * (SLOT + 3);
  o.w = SLOT;
  o.h = SLOT;
  return o;
}
export const setDone = (si) => POOL.every((c, k) => c.set !== si || slotShown[k]);
export function resetBag() {
  BAG = {
    owned: {},
    complete: false,
    sets: {},
  };
  saveBag();
  slotShown = POOL.map(() => false);
  slotFlash = POOL.map(() => -1);
}
export function flashAll() {
  for (let k = 0; k < slotFlash.length; k++) slotFlash[k] = 0.5 + k * 0.07;
}
export function fadeFlashes(rdt) {
  for (let k = 0; k < slotFlash.length; k++) slotFlash[k] = Math.max(-1, slotFlash[k] - rdt);
}
