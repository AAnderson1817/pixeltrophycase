/**
 * The frame loop: tick (simulation + render), pacing on high-refresh displays, the performance governor, and boot().
 */
import { A } from '../audio/chip.js';
import { buildBackBase } from '../card/faces.js';
import { showErr } from '../core/errors.js';
import { PERF } from '../core/perf.js';
import { later, lerp, reduce, rnd } from '../core/util.js';
import { POOL, RAR, SETS } from '../data/armor.js';
import { FX } from '../fx/particles.js';
import { leave, release, startEnter } from './flow.js';
import { beginHold, endHold, initInput } from './input.js';
import * as LAYOUT from './layout.js';
import { TS, layout } from './layout.js';
import { step, ui } from './sim.js';
import { S } from './state.js';
import { bloomC, mk } from '../gfx/canvas.js';
import { drawRampText } from '../gfx/text.js';
import { render } from '../render/render.js';
import { wallStep } from '../scene/wall.js';

let last = performance.now();
function tick(rdt) {
  S.rt += rdt;
  if (S.phase === 'hitstop') {
    S.hitstop -= rdt;
    if (S.hitstop <= 0) {
      release();
    }
    render();
    return;
  }
  if (S.slowmo > 0) {
    S.slowmo -= rdt;
    S.ts = lerp(S.ts, 0.2, 1 - Math.exp(-25 * rdt));
  } else S.ts = lerp(S.ts, 1, 1 - Math.exp(-3.5 * rdt));
  S.flash *= Math.exp(-7 * rdt);
  if (A.ctx && A.on) {
    S.crk -= rdt;
    if (S.crk <= 0) {
      S.crk = rnd(0.05, 0.4) * (1 - (0.5 * S.torchBoost) / 1.5);
      A.crackle(Math.random() < 0.5 ? -0.55 : 0.55);
    }
  }
  step(rdt * S.ts, rdt);
  wallStep(rdt);
  ui(rdt);
  const boxT =
    (S.slowmo > 0 || S.phase === 'upgrading' || (S.phase === 'idle' && S.charge > 0.8 && S.vr >= 2)) && !reduce ? 1 : 0;
  S.box = lerp(S.box, boxT, 1 - Math.exp(-(boxT ? 9 : 3) * rdt));
  render();
}
/* pacing: on 90Hz+ displays render every Nth refresh (120Hz -> 60, 144Hz -> 72, 240Hz -> 60) for an even cadence.
   governor: script time per frame steers effect density; if frames still arrive late while script time is low, the
   blended bloom layer is switched off for a moment, and kept off only if that clearly fixes the frame rate. */
const PACE = {
    raw: [],
    refresh: 16.67,
    div: 1,
    n: 0,
    lastRaw: 0,
    lastDraw: 0,
  },
  IVW = new Float32Array(60);
let ivn = 0,
  probe = null,
  probeHold = 0,
  govN = 0;
PERF.bloomSkip = false;
const slowFrac = (lim) => {
  let k = 0;
  for (let i = 0; i < 60; i++) if (IVW[i] > lim) k++;
  return k / 60;
};
function govern(now, wk) {
  PERF.work = PERF.work * 0.92 + wk * 0.08;
  const iv = now - PACE.lastDraw;
  PACE.lastDraw = now;
  if (iv < 250) {
    IVW[ivn % 60] = iv;
    ivn++;
  }
  if (++govN >= 20) {
    govN = 0;
    if (PERF.work > 9 && PERF.dq > 0.35) PERF.dq = Math.max(0.35, PERF.dq * 0.85);
    else if (PERF.work < 5.5 && PERF.dq < 1) PERF.dq = Math.min(1, PERF.dq * 1.05);
  }
  if (PERF.bloomOff || window.APP.noProbe) return;
  const tgt = PACE.refresh * PACE.div,
    lim = tgt * 1.3;
  if (!probe) {
    if (now > probeHold && ivn >= 60 && PERF.work < tgt * 0.5 && slowFrac(lim) > 0.5) {
      probe = {
        before: slowFrac(lim),
      };
      ivn = 0;
      PERF.bloomSkip = true;
      bloomC.style.visibility = 'hidden';
    }
  } else if (ivn >= 60) {
    if (slowFrac(lim) < probe.before * 0.5) PERF.bloomOff = true;
    else {
      PERF.bloomSkip = false;
      bloomC.style.visibility = '';
      probeHold = now + 20000;
    }
    probe = null;
    ivn = 0;
  }
}
function frame(now) {
  const d = now - PACE.lastRaw;
  PACE.lastRaw = now;
  if (d > 2 && d < 40) {
    PACE.raw.push(d);
    if (PACE.raw.length >= 45) {
      const a = PACE.raw.sort((x, y) => x - y),
        ref = a[Math.floor(a.length * 0.2)];
      PACE.refresh = ref;
      PACE.div = Math.max(1, Math.floor(16.67 / ref + 0.1));
      PACE.raw.length = 0;
    }
  }
  if (window.APP.paused) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  if (PACE.div > 1 && ++PACE.n % PACE.div) {
    requestAnimationFrame(frame);
    return;
  }
  const raw = Math.max(0, (now - last) / 1000),
    rdt = Math.min(1 / 30, raw);
  last = now;
  const t0 = performance.now();
  try {
    tick(rdt);
  } catch (e) {
    console.error(e.stack);
    showErr(e.message);
    return;
  }
  govern(now, performance.now() - t0);
  requestAnimationFrame(frame);
}
export function boot() {
  initInput();
  buildBackBase();
  layout();
  startEnter();
  if (document.fonts) document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
  later(400, () => {
    try {
      const [, pg] = mk(8, 8);
      for (const [txt, rp] of [...RAR.map((R) => [R.name, R.title]), ...SETS.map((st) => [st.name + ' SET', st.ramp])])
        for (const ch of txt)
          for (const lit of [false, true])
            drawRampText(pg, ch, 0, 0, TS, (row) => (lit && row < 3 ? (row === 0 ? 'w' : 'o') : rp[row]));
    } catch (e) {}
  });
  Object.assign(window.APP, {
    force: (r) => {
      S.force = r;
    },
    step: (d) => tick(d),
    render,
    beginHold,
    endHold,
    leave,
    FX,
    PERF,
    PACE,
    POOL,
    // read-only snapshot of the current layout, for tests and debugging
    layout: () => {
      const { SC, W, H, TS, CX, CY, HY, PTOP, PBASE, TOP, HUDTOP, SLOT, NARROW, BAGX, BAGY, BG } = LAYOUT;
      return { SC, W, H, TS, CX, CY, HY, PTOP, PBASE, TOP, HUDTOP, SLOT, NARROW, BAGX, BAGY, BG: { ...BG } };
    },
  });
  window.__ready = true;
}
