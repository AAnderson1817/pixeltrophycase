/**
 * Builds the vault for the current layout: bricks and floor tiles as lit units, per-pixel altar and sconces, the
 * pixel-to-unit maps and the scene buffers.
 */
import { U32 } from '../core/palette.js';
import { clamp, mulberry } from '../core/util.js';
import { CX, H, HY, PBASE, PTOP, TORCH, W } from '../game/layout.js';
import { S } from '../game/state.js';
import { mk } from '../gfx/canvas.js';

export const SCN = {};
export let UB0X = null;
export let UB0Y = null;
export let UST = null;
export let UDEL = null;
export let URST = null;
export let WALLU = [];
SCN.VOID32 = null;
SCN.VOIDSTARS = [];
export let snapC = null;
export let snapG = null;
export let UNIT = null,
  OFF = null,
  PIXA = null,
  NU = 0,
  UX = null,
  UY = null,
  UALB = null,
  UHASH = null,
  ULVL = null,
  URAMP = null,
  sceneImg = null,
  scene32 = null,
  sceneC = null,
  sceneG = null;
export function buildScene() {
  const N = W * H,
    rng = mulberry(77);
  UNIT = new Int32Array(N).fill(-1);
  OFF = new Int8Array(N);
  PIXA = new Float32Array(N).fill(-1);
  const ux = [],
    uy = [],
    ua = [],
    uh = [],
    uw = [],
    bx0 = [],
    by0 = [];
  const add = (cx, cy, a, wall, x0, y0) => {
    ux.push(cx);
    uy.push(cy);
    ua.push(a);
    uh.push(rng());
    uw.push(wall ? 1 : 0);
    bx0.push(x0 || 0);
    by0.push(y0 || 0);
    return ux.length - 1;
  };
  // wall bricks
  const BW = 14,
    BH = 7,
    bmap = new Map();
  for (let y = 0; y < HY; y++) {
    const row = Math.floor(y / BH),
      off = (row % 2) * 7,
      ly = y % BH;
    for (let x = 0; x < W; x++) {
      const bx = Math.floor((x + off) / BW),
        lx = (x + off) % BW,
        key = row * 100000 + bx;
      let u = bmap.get(key);
      if (u === undefined) {
        const cy = row * BH + BH / 2,
          ao = clamp((HY - cy) / 20, 0, 1);
        u = add(
          bx * BW - off + BW / 2,
          cy,
          (0.66 + rng() * 0.26) * (0.6 + 0.4 * ao) * (rng() < 0.06 ? 0.75 : 1),
          1,
          bx * BW - off,
          row * BH,
        );
        bmap.set(key, u);
      }
      const i = y * W + x;
      UNIT[i] = u;
      if (ly === BH - 1 || lx === BW - 1) OFF[i] = -2;
      else if (ly === 0) OFF[i] = 1;
      else if (ly === BH - 2 || lx === BW - 2) OFF[i] = -1;
      else if (lx === 0 && ly < 3) OFF[i] = 1;
      else if (rng() < 0.012) OFF[i] = -1;
    }
  }
  for (let x = 0; x < W; x++) {
    OFF[(HY - 1) * W + x] = -4;
    if (HY - 2 >= 0 && x % 3) OFF[(HY - 2) * W + x] = Math.min(OFF[(HY - 2) * W + x], -1);
  }
  // floor: staggered flagstones, rows grow toward the viewer
  let y0 = HY,
    h = 3,
    k = 0;
  while (y0 < H) {
    const hi = Math.max(3, Math.round(h)),
      cw = Math.max(8, Math.round(hi * 3.1)),
      offx = (k % 2) * Math.round(cw / 2),
      tmap = new Map(),
      far = clamp((y0 - HY) / 60, 0, 1);
    for (let y = y0; y < Math.min(H, y0 + hi); y++) {
      const ly = y - y0;
      for (let x = 0; x < W; x++) {
        const q = x - CX + offx + cw * 1000,
          col = Math.floor(q / cw),
          lx = q % cw;
        let u = tmap.get(col);
        if (u === undefined) {
          u = add(col * cw - cw * 1000 + CX - offx + cw / 2, y0 + hi / 2, (0.6 + rng() * 0.2) * (0.5 + 0.5 * far));
          tmap.set(col, u);
        }
        const i = y * W + x;
        UNIT[i] = u;
        if (ly === hi - 1 || lx === 0) OFF[i] = -2;
        else if (ly === 0) OFF[i] = 1;
        else if (lx === cw - 1) OFF[i] = -1;
      }
    }
    y0 += hi;
    h *= 1.24;
    k++;
  }
  // altar: per-pixel albedo with bevels (lit per pixel, banded, no dither)
  const slab = (x0, x1, y0, y1, a) => {
    for (let y = y0 - 1; y <= y1 + 1; y++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        UNIT[i] = -1;
        if (x === x0 - 1 || x === x1 + 1 || y === y0 - 1 || y === y1 + 1) {
          PIXA[i] = 0;
          continue;
        }
        let b = a;
        if (y === y0) b += 0.3;
        else if (y === y1) b -= 0.25;
        if (x === x0) b += 0.12;
        else if (x === x1) b -= 0.2;
        PIXA[i] = b;
      }
  };
  slab(CX - 20, CX + 20, PTOP + 6, PBASE - 5, 0.64);
  for (let y = PTOP + 9; y < PBASE - 6; y += 5) for (let x = CX - 18; x <= CX + 18; x++) PIXA[y * W + x] -= 0.14;
  for (let x = CX - 16; x <= CX + 16; x += 8) for (let y = PTOP + 7; y < PBASE - 5; y++) PIXA[y * W + x] -= 0.08;
  slab(CX - 27, CX + 27, PBASE - 4, PBASE, 0.7);
  slab(CX - 30, CX + 30, PTOP, PTOP + 5, 0.84);
  for (let x = CX - 26; x <= CX + 26; x += 6) PIXA[(PTOP + 2) * W + x] += 0.12;
  // sconces
  for (const t of TORCH) {
    for (let y = t.y; y < t.y + 11; y++)
      for (let x = t.x - 3; x <= t.x + 3; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const dx = Math.abs(x - t.x),
          dy = y - t.y;
        let b = -1;
        if (dy < 3) {
          b = dy === 0 ? 0.95 : dx === 3 ? 0.3 : 0.7;
        } else if (dy < 6 && dx <= 1) b = dx === 1 ? 0.4 : 0.6;
        else if (dy < 9 && dx <= 2 - (dy - 6 > 1 ? 1 : 0)) b = 0.45;
        else if (dy >= 9 && dx === 0) b = 0.35;
        if (b >= 0) {
          const i = y * W + x;
          UNIT[i] = -1;
          PIXA[i] = b;
        }
      }
  }
  NU = ux.length;
  UX = Float32Array.from(ux);
  UY = Float32Array.from(uy);
  UALB = Float32Array.from(ua);
  UHASH = Float32Array.from(uh);
  ULVL = new Int8Array(NU);
  URAMP = new Uint8Array(NU);
  UPAL = new Uint32Array(NU * 8);
  OFFI = new Uint8Array(N);
  for (let i = 0; i < N; i++) OFFI[i] = OFF[i] === -4 ? 0 : OFF[i] === -2 ? 1 : OFF[i] + 3;
  // pixels grouped by unit, so a frame only repaints units whose quantised colours changed
  USTART = new Int32Array(NU + 1);
  for (let i = 0; i < N; i++) if (UNIT[i] >= 0) USTART[UNIT[i] + 1]++;
  for (let u = 0; u < NU; u++) USTART[u + 1] += USTART[u];
  UPIX = new Int32Array(USTART[NU]);
  {
    const fillp = USTART.slice(0, NU);
    for (let i = 0; i < N; i++) {
      const u = UNIT[i];
      if (u >= 0) UPIX[fillp[u]++] = i;
    }
  }
  BASE32 = new Uint32Array(N).fill(U32.k);
  SCN.LDIRTY = true;
  UB0X = Int16Array.from(bx0);
  UB0Y = Int16Array.from(by0);
  UST = new Uint8Array(NU);
  UDEL = new Float32Array(NU).fill(Infinity);
  URST = new Float32Array(NU);
  WALLU = [];
  for (let u = 0; u < NU; u++) if (uw[u]) WALLU.push(u);
  SCN.VOID32 = new Uint32Array(W * H);
  SCN.VOIDNEXT = new Uint32Array(W * H);
  SCN.VOIDSTARS = [];
  SCN.voidJob = null;
  [snapC, snapG] = mk(W, H);
  if (S && S.wall) {
    S.wall.active = false;
    S.wall.rebuild = false;
  }
  [sceneC, sceneG] = mk(W, H);
  sceneImg = sceneG.createImageData(W, H);
  scene32 = new Uint32Array(sceneImg.data.buffer);
  // altar + sconce pixels are lit individually; everything else is lit per unit
  const al = [];
  for (let i = 0; i < N; i++) if (UNIT[i] < 0 && PIXA[i] > 0) al.push(i);
  ALTI = Int32Array.from(al);
}
export let UPAL = null;
export let OFFI = null;
export let USTART = null;
export let UPIX = null;
export let BASE32 = null;
SCN.LDIRTY = true;
export let ALTI = null;
SCN.VOIDNEXT = null;
SCN.voidJob = null;
const tone = (v) => {
  const l = Math.floor(6.35 * (1 - Math.exp(-1.3 * v)));
  return l < 0 ? 0 : l > 6 ? 6 : l;
};
const TONE_T = [1, 2, 3, 4, 5, 6].map((k) => -Math.log(1 - k / 6.35) / 1.3); // tone(v) === number of thresholds <= v
export const toneF = (v) => {
  let l = 0;
  while (l < 6 && v >= TONE_T[l]) l++;
  return l;
};
