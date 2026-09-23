/**
 * Pointer, keyboard and HUD buttons (rarity pills, two-press reset, mute). A hold belongs to the source that started
 * it (a pointerId, or the key code for Space/Enter) and only that source's release ends it; losing focus or hiding the page
 * ends any hold. A press made during the summon is queued, and sim.js turns it into a hold when the card lands.
 */
import { A, buzz } from '../audio/chip.js';
import { $, MOTION, clamp, later } from '../core/util.js';
import { POOL } from '../data/armor.js';
import { BAG, resetBag, saveBag, syncReset } from './bag.js';
import { assignCard, fidget, leave } from './flow.js';
import { CX, CY, SC, again, hit, layout, live } from './layout.js';
import { S } from './state.js';
import { CHd, CWd } from '../gfx/canvas.js';

// src: the pointerId or key code pressing. The APP.beginHold() hook passes none and is not queued during the summon.
// queued: sim.js starting a hold that was pressed during the summon (the tap timer runs from that press).
export function beginHold(src, queued = false) {
  A.init();
  if (S.phase === 'revealed') {
    fidget();
    return;
  }
  if (S.holding || S.queued || S.auto) return;
  if (S.phase === 'entering' && src !== undefined) {
    S.queued = true;
    S.holdSrc = src;
    S.downAt = S.rt;
    return;
  }
  if (S.phase !== 'idle') return;
  if (S.r < 0) assignCard();
  S.holding = true;
  S.holdSrc = src;
  if (!queued) S.downAt = S.rt;
  S.sq.v = -2.8 * MOTION;
  A.press();
  buzz(6);
}
// Without a source (the APP hook, blur, hidden page) it ends whatever hold or queued press there is. cancel (focus
// lost, pointer taken by the browser) is not a release: it never counts as a tap, so the card cannot open by itself.
export function endHold(src, cancel = false) {
  if (src !== undefined && src !== S.holdSrc) return;
  S.queued = false;
  S.holdSrc = null;
  if (!S.holding) return;
  S.holding = false;
  if (S.phase !== 'idle') return;
  if (!cancel && S.rt - S.downAt < 0.24 && S.charge < 0.35) S.auto = true;
  else if (S.charge < 1) S.sq.v += 2.8 * MOTION;
}
let resetArm = 0;
export function initInput() {
  hit.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    hit.setPointerCapture?.(e.pointerId);
    beginHold(e.pointerId);
  });
  window.addEventListener('pointerup', (e) => endHold(e.pointerId));
  window.addEventListener('pointercancel', (e) => endHold(e.pointerId, true));
  window.addEventListener('blur', () => endHold(undefined, true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) endHold(undefined, true);
  });
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
      } else beginHold(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') endHold(e.code);
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
      if (S.phase === 'idle' && S.charge === 0 && !S.holding) {
        S.r = -1;
        S.tease = 0;
        S.teaseKey = 's';
        S.lightKey = 's';
      }
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
      if (S.stamp) Object.assign(S.stamp, { text: 'NEW!', key: 'y' });
    }
    b.classList.remove('armed');
    b.textContent = 'Reset';
    syncReset();
    live.textContent = 'Collection reset: ' + Object.keys(BAG.owned).length + ' of ' + POOL.length;
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
  });
  window.addEventListener('resize', layout);
}
