/**
 * Pointer, keyboard and HUD buttons (rarity pills, two-press reset, mute).
 */
import { A, buzz } from '../audio/chip.js';
import { $, MOTION, clamp, later } from '../core/util.js';
import { POOL } from '../data/armor.js';
import { BAG, resetBag, saveBag, syncReset } from './bag.js';
import { assignCard, fidget, leave } from './flow.js';
import { CX, CY, SC, again, hit, layout, live } from './layout.js';
import { S } from './state.js';
import { CHd, CWd } from '../gfx/canvas.js';

export function beginHold() {
  A.init();
  if (S.phase === 'revealed') {
    fidget();
    return;
  }
  if (S.phase !== 'idle' || S.auto) return;
  if (S.r < 0) assignCard();
  S.holding = true;
  S.downAt = performance.now();
  S.sq.v = -2.8 * MOTION;
  A.press();
  buzz(6);
}
export function endHold() {
  if (!S.holding) return;
  S.holding = false;
  if (S.phase !== 'idle') return;
  if (performance.now() - S.downAt < 240 && S.charge < 0.35) S.auto = true;
  else if (S.charge < 1) S.sq.v += 2.8 * MOTION;
}
let resetArm = 0;
export function initInput() {
  hit.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    hit.setPointerCapture?.(e.pointerId);
    beginHold();
  });
  window.addEventListener('pointerup', endHold);
  window.addEventListener('pointercancel', endHold);
  window.addEventListener('pointermove', (e) => {
    const cx = CX * SC,
      cy = CY * SC;
    S.ptr.nx = clamp((e.clientX - cx) / (CWd * SC * 0.9), -1, 1);
    S.ptr.ny = clamp((e.clientY - cy) / (CHd * SC * 0.9), -1, 1);
    S.ptr.last = S.t;
  });
  hit.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button') && e.target !== hit) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (S.phase === 'revealed') {
        A.init();
        leave();
      } else beginHold();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') endHold();
  });
  again.addEventListener('click', () => {
    A.init();
    leave();
    hit.focus({
      preventScroll: true,
    });
  });
  document.querySelectorAll('.pill[data-force]').forEach((b) =>
    b.addEventListener('click', () => {
      A.init();
      document.querySelectorAll('.pill[data-force]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      S.force = +b.dataset.force;
      A.blip();
      if (S.phase === 'idle' && S.charge === 0 && !S.holding) S.r = -1;
    }),
  );
  $('reset').addEventListener('click', (e) => {
    A.init();
    const b = e.currentTarget;
    clearTimeout(resetArm);
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Sure?';
      live.textContent = 'Press again to reset your collection';
      A.blip();
      resetArm = later(3000, () => {
        b.classList.remove('armed');
        b.textContent = 'Reset';
      });
      return;
    }
    resetBag();
    // the revealed or flying piece stays yours: it goes into the fresh collection and lands as NEW
    if (S.pending) {
      BAG.owned[POOL[S.pending.i].name] = 1;
      saveBag();
      S.pending.isNew = true;
    }
    b.classList.remove('armed');
    b.textContent = 'Reset';
    syncReset();
    live.textContent = 'Collection reset: 0 of ' + POOL.length;
    A.rebuild();
    buzz([20, 30, 20]);
    hit.focus({
      preventScroll: true,
    });
  });
  $('mute').addEventListener('click', (e) => {
    A.init();
    const on = !A.on;
    A.setOn(on);
    e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
    e.currentTarget.setAttribute('aria-pressed', String(!on));
  });
  window.addEventListener('resize', layout);
}
