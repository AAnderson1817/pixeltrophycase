/**
 * Fixed-size particle pool. Kinds: dust (1px, fades down its ramp), spark (gravity, gold), confetti (flutters,
 * court colours), firework (in space: drag, no gravity, clipped to the window), ring (expanding circle).
 */
import { px, circle, W, H } from '../gfx/fb.js';
import { DN, G3, G4, C2, C3, R2, R3, V2, V3, WW, S5 } from '../core/palette.js';
import { inWindow } from '../scene/layout.js';

const MAX = 1600;
const P = {
  n: 0,
  x: new Float32Array(MAX), y: new Float32Array(MAX), vx: new Float32Array(MAX), vy: new Float32Array(MAX),
  life: new Float32Array(MAX), max: new Float32Array(MAX), c: new Uint8Array(MAX), kind: new Uint8Array(MAX),
  seed: new Float32Array(MAX),
};
const DUST = 0, SPARK = 1, CONFETTI = 2, FIREWORK = 3, RING = 4, RISE = 5;
export const CONFETTI_COLOURS = [G3, G4, C2, C3, R2, R3, V2, V3, WW, S5];

function add(kind, x, y, vx, vy, life, c, seed = 0) {
  if (P.n >= MAX) return;
  const i = P.n++;
  P.kind[i] = kind; P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
  P.life[i] = life; P.max[i] = life; P.c[i] = c; P.seed[i] = seed;
}
function kill(i) {
  const j = --P.n;
  P.kind[i] = P.kind[j]; P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j];
  P.life[i] = P.life[j]; P.max[i] = P.max[j]; P.c[i] = P.c[j]; P.seed[i] = P.seed[j];
}
export const count = () => P.n;
export function clearParticles() { P.n = 0; }

export const FX = {
  /** Soft stardust drifting from a point. */
  dust(rng, x, y, n, c = C3, spread = 1.2) {
    for (let i = 0; i < n; i++) add(DUST, x + rng.range(-2, 2), y + rng.range(-2, 2), rng.range(-spread, spread), rng.range(-spread, spread * 0.4), rng.range(0.4, 1.1), rng.chance(0.3) ? DN[c] : c);
  },
  /** Gold sparks with gravity. */
  sparks(rng, x, y, n, c = G4) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(-Math.PI, 0), s = rng.range(18, 60);
      add(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(0.3, 0.8), rng.chance(0.5) ? c : G3);
    }
  },
  /** Celebration confetti released from the top of the hall. */
  confetti(rng, x0, x1, n) {
    for (let i = 0; i < n; i++) add(CONFETTI, rng.range(x0, x1), rng.range(-12, -2), rng.range(-6, 6), rng.range(10, 22), rng.range(3.5, 6), rng.pick(CONFETTI_COLOURS), rng() * 6.28);
  },
  /** A radial burst in the sky, seen through the window. */
  firework(rng, x, y, n, c) {
    const s0 = rng.range(16, 34);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.2832), s = s0 * rng.range(0.6, 1);
      add(FIREWORK, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.8, rng.range(0.8, 1.5), rng.chance(0.2) ? WW : c);
    }
  },
  ring(x, y, r0, r1, life, c) { add(RING, x, y, r0, r1, life, c); },
  /** Dust that rises toward the window when a treasure dissolves. */
  rise(rng, x, y, n, c) {
    for (let i = 0; i < n; i++) add(RISE, x + rng.range(-5, 5), y + rng.range(-8, 4), rng.range(-4, 4), rng.range(-22, -8), rng.range(0.9, 1.8), c);
  },
};

export function stepParticles(dt) {
  for (let i = P.n - 1; i >= 0; i--) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) { kill(i); continue; }
    const k = P.kind[i];
    if (k === SPARK) { P.vy[i] += 90 * dt; P.vx[i] *= 0.985; }
    else if (k === CONFETTI) { P.vx[i] = Math.sin(P.life[i] * 7 + P.seed[i]) * 9; }
    else if (k === FIREWORK) { P.vx[i] *= 0.96; P.vy[i] *= 0.96; }
    else if (k === DUST) { P.vx[i] *= 0.97; P.vy[i] = P.vy[i] * 0.97 - 2 * dt; }
    else if (k === RISE) { P.vx[i] += Math.sin(P.life[i] * 5 + P.seed[i]) * 0.6; P.vy[i] -= 6 * dt; }
    if (k !== RING) { P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; }
    if (P.y[i] > H + 4 || P.x[i] < -4 || P.x[i] > W + 4 || (k === RISE && P.y[i] < -4)) kill(i);
  }
}

/** Draw particles of the given kinds (sky layer: fireworks; room layer: the rest). */
export function drawParticles(sky) {
  for (let i = 0; i < P.n; i++) {
    const k = P.kind[i];
    if (sky !== (k === FIREWORK)) continue;
    const f = P.life[i] / P.max[i];
    const x = Math.round(P.x[i]), y = Math.round(P.y[i]);
    let c = P.c[i];
    if (k === RING) {
      const r = Math.round(P.vx[i] + (P.vy[i] - P.vx[i]) * (1 - f));
      circle(x, y, r, f < 0.35 ? DN[c] : c);
      continue;
    }
    if (f < 0.3) c = DN[c];
    if (f < 0.12 && k !== CONFETTI) c = DN[c];
    if (k === FIREWORK) { if (!inWindow(x, y)) continue; px(x, y, c); if (f > 0.7) px(x, y - 1, c); continue; }
    px(x, y, c);
    if (k === CONFETTI) { if (Math.sin(P.life[i] * 7 + P.seed[i]) > 0) px(x + 1, y, c); else px(x, y + 1, DN[c]); }
    if (k === SPARK && f > 0.5) px(x - Math.sign(P.vx[i]), y, DN[c]);
  }
}
