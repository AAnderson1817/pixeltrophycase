/**
 * The view through the great window: deep space, a two-cloud nebula, twinkling stars, two moons and the ringed
 * giant Khhn that Cyiurkhhn IV orbits. Everything is quantised to the palette with ordered dither.
 */
import { IB, W, bayer, px } from '../gfx/fb.js';
import { N0, N1, N2, V0, V1, V2, V3, C0, C1, C2, C3, S3, S4, S5, W as WHT, WW, G2, G4, DN, DN2 } from '../core/palette.js';
import { mulberry } from '../core/rng.js';
import { FLOOR_Y, WIN, inWindow, PLANET } from './layout.js';
import { TAU } from '../core/util.js';

const SKY_H = FLOOR_Y;
const skyBuf = new Uint8Array(W * SKY_H);
const stars = [];
const rng = mulberry(0x5eed);

function valueNoise(seed, scale) {
  const r = mulberry(seed);
  const gw = Math.ceil(W / scale) + 2, gh = Math.ceil(SKY_H / scale) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const x0 = Math.floor(fx) % gw, y0 = Math.floor(fy) % gh, x1 = (x0 + 1) % gw, y1 = (y0 + 1) % gh;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * gw + x0], b = g[y0 * gw + x1], c = g[y1 * gw + x0], d = g[y1 * gw + x1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

export function initSky() {
  const n1 = valueNoise(11, 96), n2 = valueNoise(12, 40), n3 = valueNoise(13, 14);
  const m1 = valueNoise(21, 120), m2 = valueNoise(22, 50), m3 = valueNoise(23, 18);
  const violet = [N0, V0, V1, V2];
  const teal = [N0, N1, N2, C0];
  for (let y = 0; y < SKY_H; y++)
    for (let x = 0; x < W; x++) {
      // wrap horizontally so the slow scroll is seamless: blend the noise at x and x+W
      const wx = x / W;
      const nv = (a, b, c) => {
        const p = a(x, y) * 0.55 + b(x, y) * 0.3 + c(x, y) * 0.15;
        const q = a(x + W, y) * 0.55 + b(x + W, y) * 0.3 + c(x + W, y) * 0.15;
        return p * (1 - wx) + q * wx;
      };
      let v = (nv(n1, n2, n3) - 0.5) * 2.4 + 0.1; // violet cloud
      let t = (nv(m1, m2, m3) - 0.5) * 2.2 - 0.05; // teal cloud
      // the clouds thin toward the top of the window and the horizon glow warms the bottom
      v *= 0.6 + 0.4 * Math.sin((y / SKY_H) * Math.PI);
      t *= 0.5 + 0.5 * (y / SKY_H);
      let c = N0;
      const put = (ramp, s) => {
        if (s <= 0) return;
        const f = s * 3, i = Math.min(3, Math.floor(f)), lv = Math.round((f - i) * 16);
        const base = ramp[i], next = ramp[Math.min(3, i + 1)];
        c = bayer(x, y) < lv ? next : base;
      };
      if (v >= t) put(violet, v); else put(teal, t);
      skyBuf[y * W + x] = c;
    }
  // stars: three sizes, each with a twinkle phase; a few are coloured
  for (let i = 0; i < 230; i++) {
    const big = rng.chance(0.08);
    stars.push({
      x: rng.int(0, W), y: rng.int(0, SKY_H), big,
      c: big ? WW : rng.chance(0.75) ? S5 : rng.pick([C3, G4, S4, WHT]),
      ph: rng() * TAU, sp: rng.range(0.6, 2.4), tw: rng.chance(0.5),
    });
  }
}

const moons = [
  { r: 5, a: 0.0, speed: 0.011, ox: 150, oy: 70, rx: 90, ry: 12, c: S5, d: S4 },
  { r: 3, a: 2.4, speed: 0.019, ox: 140, oy: 56, rx: 70, ry: 8, c: C3, d: C2 },
];
const shooting = [];

function drawPlanet(t) {
  const { x: cx, y: cy, r, rx, ry } = PLANET;
  const roll = t * 0.35;
  const band = (y, x) => Math.sin(y * 0.52 + Math.sin(x * 0.11 + roll) * 0.9 + roll * 0.4) * 0.5 + 0.5;
  // ring behind the disc (upper half)
  const ring = (x, y, front) => {
    const dx = x - cx, dy = y - cy;
    const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    if (q > 1 || q < 0.56) return;
    if (!front && dx * dx + dy * dy < r * r) return;
    const bandI = Math.floor((q - 0.56) / 0.44 * 5);
    const c = [S3, S4, G2, S5, S4][bandI];
    if (bayer(x, y) < (bandI === 1 || bandI === 3 ? 16 : 11)) if (inWindow(x, y)) IB[y * W + x] = c;
  };
  for (let y = cy - ry; y <= cy; y++) for (let x = cx - rx; x <= cx + rx; x++) ring(x, y, false);
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) {
      const x = cx + dx;
      if (!inWindow(x, y)) continue;
      const b = band(dy + Math.sqrt(Math.max(0, r * r - dx * dx - dy * dy)) * 0.15, dx);
      let c = b < 0.3 ? V1 : b < 0.62 ? V2 : b < 0.9 ? V3 : C1;
      // terminator: lit from the upper left
      const sh = (dx * 0.55 + dy * 0.75) / r + 0.15;
      if (sh > 0.25 && bayer(x, y) < (sh - 0.25) * 24) c = DN[c];
      if (sh > 0.7 && bayer(x, y) < (sh - 0.7) * 40) c = DN2[c];
      if (Math.abs(dx) === hw || Math.abs(dy) === r) c = DN[c];
      IB[y * W + x] = c;
    }
  }
  for (let y = cy + 1; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) ring(x, y, true);
  // limb glow on the lit side
  for (let a = 2.6; a < 4.9; a += 0.08) {
    const x = Math.round(cx + Math.cos(a) * (r + 1)), y = Math.round(cy + Math.sin(a) * (r + 1));
    if (inWindow(x, y) && bayer(x, y) < 9) IB[y * W + x] = V3;
  }
}

export function drawSky(t, rng2, finale) {
  const off = Math.floor(t * 1.1) % W;
  for (let y = 0; y < SKY_H; y++) {
    const row = y * W, srow = row + off;
    const first = W - off;
    IB.set(skyBuf.subarray(srow, srow + first), row);
    IB.set(skyBuf.subarray(row, row + off), row + first);
  }
  for (const s of stars) {
    const tw = s.tw ? Math.sin(t * s.sp + s.ph) : 1;
    if (tw < -0.55) continue;
    const x = (s.x - Math.floor(t * 0.25)) ;
    const xx = ((x % W) + W) % W;
    if (!inWindow(xx, s.y)) continue;
    const c = tw < 0.1 ? DN[s.c] : s.c;
    IB[s.y * W + xx] = c;
    if (s.big && tw > 0.5) { px(xx - 1, s.y, DN[c]); px(xx + 1, s.y, DN[c]); px(xx, s.y - 1, DN[c]); px(xx, s.y + 1, DN[c]); }
  }
  for (const m of moons) {
    const a = m.a + t * m.speed;
    const x = Math.round(m.ox + Math.cos(a) * m.rx), y = Math.round(m.oy + Math.sin(a) * m.ry);
    if (Math.sin(a) < -0.98) continue;
    for (let dy = -m.r; dy <= m.r; dy++) for (let dx = -m.r; dx <= m.r; dx++) {
      if (dx * dx + dy * dy > m.r * m.r) continue;
      const xx = x + dx, yy = y + dy;
      if (!inWindow(xx, yy)) continue;
      const sh = (dx * 0.6 + dy * 0.8) / m.r;
      IB[yy * W + xx] = sh > 0.3 ? (bayer(xx, yy) < 9 ? DN2[m.c] : m.d) : sh > -0.2 ? m.d : m.c;
    }
  }
  drawPlanet(t);
  // shooting stars: short bright streaks, more of them during the finale
  if (rng2.chance(finale ? 0.09 : 0.012)) shooting.push({ x: rng2.range(WIN.x0, WIN.x1), y: rng2.range(0, 80), vx: rng2.range(-3, -1.4), vy: rng2.range(0.6, 1.4), life: rng2.range(10, 20) });
  for (let i = shooting.length - 1; i >= 0; i--) {
    const s = shooting[i];
    for (let k = 0; k < 6; k++) {
      const x = Math.round(s.x - s.vx * k * 0.7), y = Math.round(s.y - s.vy * k * 0.7);
      if (inWindow(x, y)) IB[y * W + x] = k === 0 ? WW : k < 3 ? C3 : k < 5 ? C2 : C1;
    }
    s.x += s.vx; s.y += s.vy; s.life--;
    if (s.life <= 0 || s.x < WIN.x0) shooting.splice(i, 1);
  }
}
