/**
 * Pseudo-3D card: column slices for the spin, row slices for the tilt, shading and foil glint, all sampled
 * nearest-neighbour in typed arrays and blitted once.
 */
import { BAYER, U32 } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { S } from '../game/state.js';
import { CHd, CWd, T1H, T1W, mk } from '../gfx/canvas.js';

// card warp buffers (pseudo-3D done in typed arrays, blitted once)
const CARDW = T1W + 44,
  CARDH = T1H + 56,
  [cardC, cardG] = mk(CARDW, CARDH),
  cardImg = cardG.createImageData(CARDW, CARDH),
  card32 = new Uint32Array(cardImg.data.buffer),
  t1b = new Uint32Array(T1W * T1H);
const FOC = 240,
  XE = new Float64Array(CWd + 1),
  HE = new Float64Array(CWd + 1),
  ZE = new Float64Array(CWd + 1),
  ROWHAS = new Uint8Array(T1H);
function fillB(b, bw, bh, x, y, w, h, col) {
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  const xa = Math.max(0, x),
    xb = Math.min(bw, x + w),
    ya = Math.max(0, y),
    yb = Math.min(bh, y + h);
  for (let yy = ya; yy < yb; yy++) {
    const r = yy * bw;
    for (let xx = xa; xx < xb; xx++) b[r + xx] = col;
  }
}
/* pseudo-3D card: identical column (Y spin) and row (X tilt) slicing to the canvas version, but sampled nearest-neighbour
   in typed arrays and blitted once, instead of ~250 one-pixel drawImage calls and ~320 fillRects per frame */
export function drawCard3D(ctx, face, back, cx, cy, ry, rx, sc, shine) {
  const f32 = new Uint32Array(face.getContext('2d').getImageData(0, 0, CWd, CHd).data.buffer),
    b = t1b;
  b.fill(0);
  ROWHAS.fill(0);
  const cr = Math.cos(ry),
    sr = Math.sin(ry),
    ox = T1W / 2,
    oy = T1H / 2,
    mirror = cr < 0;
  const xe = XE,
    he = HE,
    ze = ZE;
  for (let u = 0; u <= CWd; u++) {
    const xx = (u - CWd / 2) * sc,
      X = xx * cr,
      Z = xx * sr,
      p = FOC / (FOC + Z);
    xe[u] = X * p;
    he[u] = CHd * sc * p;
    ze[u] = p;
  }
  for (let u = 0; u < CWd; u++) {
    const a = xe[u],
      bb = xe[u + 1],
      L = Math.round(Math.min(a, bb)),
      Rr = Math.round(Math.max(a, bb)),
      w = Rr - L;
    if (w <= 0) continue;
    const h = Math.round((he[u] + he[u + 1]) / 2);
    if (h <= 0) continue;
    const sx = mirror ? CWd - 1 - u : u,
      dx0 = ox + L,
      dy0 = Math.round(oy - h / 2),
      xa = Math.max(0, dx0),
      xb = Math.min(T1W, dx0 + w),
      ya = Math.max(0, dy0),
      yb = Math.min(T1H, dy0 + h),
      k = CHd / h;
    if (xa >= xb) continue;
    for (let y = ya; y < yb; y++) {
      let sy = Math.floor((y - dy0 + 0.5) * k);
      if (sy > CHd - 1) sy = CHd - 1;
      const c = f32[sy * CWd + sx];
      if (!(c >>> 24)) continue;
      const row = y * T1W;
      ROWHAS[y] = 1;
      for (let x = xa; x < xb; x++) b[row + x] = c;
    }
  }
  // edge thickness
  if (Math.abs(sr) > 0.12) {
    const near = ze[0] > ze[CWd] ? 0 : CWd;
    const ex = Math.round(xe[near]),
      eh = Math.round(he[near]),
      ew = Math.max(1, Math.round(3 * Math.abs(sr) * sc));
    const dir = xe[near] < xe[near === 0 ? CWd : 0] ? -1 : 1;
    const x0 = dir < 0 ? ox + ex - ew : ox + ex,
      y0 = Math.round(oy - eh / 2) + 1;
    fillB(b, T1W, T1H, x0, y0, ew, eh - 2, U32.Y);
    fillB(b, T1W, T1H, x0, y0, ew, 1, U32.y);
    fillB(b, T1W, T1H, dir < 0 ? x0 : x0 + ew - 1, y0, 1, eh - 2, U32.k);
    for (let y = Math.max(0, Math.min(y0, y0 + eh - 2)); y < Math.min(T1H, Math.max(y0 + 1, y0 + eh - 2)); y++)
      ROWHAS[y] = 1;
  }
  // shading + foil glint: dithered, only over opaque pixels (source-atop), same Bayer phase as the pattern fills
  const shade = (1 - Math.abs(cr)) * 0.6 + Math.abs(rx) * 0.25;
  if (shade > 0.09) {
    const lv = clamp(Math.round(shade * 16), 0, 16) / 16,
      K = U32.k;
    for (let y = 0; y < T1H; y++) {
      if (!ROWHAS[y]) continue;
      const row = y * T1W,
        by = (y & 3) * 4;
      for (let x = 0; x < T1W; x++) {
        const i = row + x;
        if (b[i] >>> 24 && BAYER[by + (x & 3)] < lv) b[i] = K;
      }
    }
  }
  if (shine > 0) {
    const bx = Math.round(ox + (-ry * 1.6 + rx * 0.8) * 40 + Math.sin(S.rt * 0.9) * 10),
      Wt = U32.w;
    for (const [dx, wd, lvl] of [
      [0, 5, 0.3 * shine],
      [1, 2, 0.6 * shine],
    ]) {
      const lv = clamp(Math.round(lvl * 16), 0, 16) / 16;
      for (let yy = 0; yy < T1H; yy++) {
        if (!ROWHAS[yy]) continue;
        const xx = bx + dx - Math.round((yy - oy) * 0.45),
          row = yy * T1W,
          by = (yy & 3) * 4;
        for (let x = Math.max(0, xx); x < Math.min(T1W, xx + wd); x++) {
          const i = row + x;
          if (b[i] >>> 24 && BAYER[by + (x & 3)] < lv) b[i] = Wt;
        }
      }
    }
  }
  // rows (X tilt) into the card buffer
  const crx = Math.cos(rx),
    srx = Math.sin(rx),
    top = Math.max(0, Math.floor(oy - CHd * sc * 0.75)),
    bot = Math.min(T1H, Math.ceil(oy + CHd * sc * 0.75));
  const o = card32,
    bx0 = Math.round(cx) - (CARDW >> 1),
    by0 = Math.round(cy) - (CARDH >> 1);
  o.fill(0);
  let minx = CARDW,
    maxx = -1,
    miny = CARDH,
    maxy = -1;
  for (let v = top; v < bot; v++) {
    if (!ROWHAS[v]) continue;
    const y = v - oy,
      Y = y * crx,
      Z = y * srx,
      p = FOC / (FOC + Z),
      dy = cy + Y * p,
      y2 = v + 1 - oy,
      p2 = FOC / (FOC + y2 * srx),
      dy2 = cy + y2 * crx * p2;
    const r0 = Math.round(dy),
      r1 = Math.max(r0 + 1, Math.round(dy2)),
      rw = Math.round(T1W * p);
    if (rw <= 0) continue;
    const X0 = Math.round(cx - rw / 2) - bx0,
      k = T1W / rw,
      srow = v * T1W;
    const ia = Math.max(0, -X0),
      ib = Math.min(rw, CARDW - X0);
    if (ia >= ib) continue;
    for (let r = r0; r < r1; r++) {
      const yy = r - by0;
      if (yy < 0 || yy >= CARDH) continue;
      const orow = yy * CARDW;
      let any = false;
      for (let i = ia; i < ib; i++) {
        const c = b[srow + Math.floor((i + 0.5) * k)];
        if (c >>> 24) {
          o[orow + X0 + i] = c;
          any = true;
        }
      }
      if (any) {
        if (yy < miny) miny = yy;
        if (yy > maxy) maxy = yy;
        if (X0 + ia < minx) minx = X0 + ia;
        if (X0 + ib - 1 > maxx) maxx = X0 + ib - 1;
      }
    }
  }
  if (maxx < 0) return;
  const w = maxx - minx + 1,
    h = maxy - miny + 1;
  cardG.putImageData(cardImg, 0, 0, minx, miny, w, h);
  ctx.drawImage(cardC, minx, miny, w, h, bx0 + minx, by0 + miny, w, h);
}
