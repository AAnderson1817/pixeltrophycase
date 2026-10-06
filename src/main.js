/**
 * Entry: fixed 60 Hz simulation with an accumulator, rendering every animation frame. With ?headless=1 the loop
 * is driven by window.APP.step() instead, which the render check uses to reach exact moments deterministically.
 */
import { initSky } from './scene/sky.js';
import { initHall } from './scene/hall.js';
import { S, update, render, reset, skip, DUR } from './anim/director.js';
import { resize, present } from './gfx/screen.js';
import { initHud } from './ui/hud.js';
import { initAudio } from './audio/chip.js';

const DT = 1 / 60;
const q = new URLSearchParams(location.search);
const headless = q.has('headless');

window.addEventListener('error', (e) => {
  let box = document.getElementById('err');
  if (!box) { box = document.createElement('div'); box.id = 'err'; document.body.appendChild(box); }
  box.textContent = `${e.message}\n${e.filename || ''}:${e.lineno || ''}`;
});

function stepOnce() {
  update(DT);
}
function frame() {
  stepOnce();
  for (let i = 1; i < S.speed; i++) stepOnce();
  render();
  present(!q.has('nobloom'));
}

function boot() {
  initSky(); initHall(); initHud();
  resize();
  window.addEventListener('resize', resize);
  const unlock = () => { initAudio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  if (q.has('speed')) S.speed = Number(q.get('speed')) || 1;
  reset();
  window.APP = {
    S, DUR, skip, reset, render,
    step(n = 1) { for (let i = 0; i < n; i++) stepOnce(); render(); present(!q.has('nobloom')); },
    /** Step until the predicate on S holds (or maxFrames pass). Returns frames stepped. */
    stepUntil(pred, maxFrames = 20000) {
      let n = 0;
      while (n < maxFrames && !pred(S)) { stepOnce(); n++; }
      render(); present(!q.has('nobloom'));
      return n;
    },
  };
  if (!headless) {
    let last = performance.now(), acc = 0;
    const loop = (now) => {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      let steps = 0;
      while (acc >= DT && steps < 4) { stepOnce(); for (let i = 1; i < S.speed; i++) stepOnce(); acc -= DT; steps++; }
      if (steps) { render(); present(!q.has('nobloom')); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else frame();
  window.__ready = true;
}
boot();
