/**
 * Index-colour framebuffer. Every primitive writes palette indices into IB; screen.js converts to RGBA once a frame.
 * Dithering uses an ordered 4x4 Bayer matrix; "level" arguments are 0..16 pixels-per-16 coverage.
 */
import { K } from '../core/palette.js';

export const W = 384;
export const H = 216;
export const IB = new Uint8Array(W * H);

const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

export function clear(c = K) { IB.fill(c); }
export function px(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) IB[y * W + x] = c; }
export const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? IB[y * W + x] : K);

export function rect(x, y, w, h, c) {
  const x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
  const x1 = x + w > W ? W : x + w, y1 = y + h > H ? H : y + h;
  for (let yy = y0; yy < y1; yy++) IB.fill(c, yy * W + x0, yy * W + x1);
}
/** Dithered rect: paints c on the fraction lv/16 of pixels. */
export function rectD(x, y, w, h, c, lv) {
  if (lv <= 0) return;
  if (lv >= 16) return rect(x, y, w, h, c);
  const x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
  const x1 = x + w > W ? W : x + w, y1 = y + h > H ? H : y + h;
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * W, by = (yy & 3) << 2;
    for (let xx = x0; xx < x1; xx++) if (BAYER[by | (xx & 3)] < lv) IB[row + xx] = c;
  }
}
export function frame(x, y, w, h, c) {
  hline(x, x + w - 1, y, c); hline(x, x + w - 1, y + h - 1, c);
  vline(x, y, y + h - 1, c); vline(x + w - 1, y, y + h - 1, c);
}
export function hline(x0, x1, y, c) {
  if (y < 0 || y >= H) return;
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (x0 < 0) x0 = 0; if (x1 >= W) x1 = W - 1;
  if (x0 <= x1) IB.fill(c, y * W + x0, y * W + x1 + 1);
}
export function vline(x, y0, y1, c) {
  if (x < 0 || x >= W) return;
  if (y0 > y1) [y0, y1] = [y1, y0];
  if (y0 < 0) y0 = 0; if (y1 >= H) y1 = H - 1;
  for (let y = y0; y <= y1; y++) IB[y * W + x] = c;
}
export function line(x0, y0, x1, y1, c) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
export function circle(cx, cy, r, c) {
  cx |= 0; cy |= 0; r |= 0;
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    px(cx + x, cy + y, c); px(cx - x, cy + y, c); px(cx + x, cy - y, c); px(cx - x, cy - y, c);
    px(cx + y, cy + x, c); px(cx - y, cy + x, c); px(cx + y, cy - x, c); px(cx - y, cy - x, c);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
export function disc(cx, cy, r, c, lv = 16) {
  cx |= 0; cy |= 0;
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy; if (y < 0 || y >= H) continue;
    const hw = Math.floor(Math.sqrt(r2 - dy * dy));
    if (lv >= 16) hline(cx - hw, cx + hw, y, c);
    else for (let x = cx - hw; x <= cx + hw; x++) if (x >= 0 && x < W && bayer(x, y) < lv) IB[y * W + x] = c;
  }
}
/** Remap existing pixels in a rect through a palette map, on the fraction lv/16 of pixels. */
export function remap(x, y, w, h, map, lv = 16) {
  if (lv <= 0) return;
  const x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
  const x1 = x + w > W ? W : x + w, y1 = y + h > H ? H : y + h;
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * W, by = (yy & 3) << 2;
    if (lv >= 16) for (let xx = x0; xx < x1; xx++) IB[row + xx] = map[IB[row + xx]];
    else for (let xx = x0; xx < x1; xx++) if (BAYER[by | (xx & 3)] < lv) IB[row + xx] = map[IB[row + xx]];
  }
}
/** Remap pixels inside a disc, with coverage falling from lv at the centre to 0 at the rim. */
export function remapDisc(cx, cy, r, map, lv) {
  cx |= 0; cy |= 0;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy; if (y < 0 || y >= H) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx; if (x < 0 || x >= W) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / r; if (d > 1) continue;
      if (bayer(x, y) < lv * (1 - d)) IB[y * W + x] = map[IB[y * W + x]];
    }
  }
}

/**
 * Sprites: { w, h, d: Int8Array } with -1 transparent. Built from ASCII rows and a legend {char: paletteIndex}.
 */
export function sprite(rows, legend) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const d = new Int8Array(w * h).fill(-1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      if (!(ch in legend)) throw new Error(`sprite: no legend for '${ch}'`);
      d[y * w + x] = legend[ch];
    }
  return { w, h, d };
}
/**
 * Blit with options: map (palette remap), lv (0..16 dissolve coverage), flip (horizontal),
 * rows [r0, r1) to draw a band of the sprite, dy per-row function for wobble.
 */
export function blit(s, x, y, o) {
  x |= 0; y |= 0;
  const map = o && o.map, lv = o && o.lv !== undefined ? o.lv : 16, flip = o && o.flip;
  const r0 = o && o.rows ? o.rows[0] : 0, r1 = o && o.rows ? o.rows[1] : s.h;
  if (lv <= 0) return;
  for (let sy = r0; sy < r1; sy++) {
    const yy = y + sy; if (yy < 0 || yy >= H) continue;
    const row = yy * W, srow = sy * s.w, by = (yy & 3) << 2;
    for (let sx = 0; sx < s.w; sx++) {
      let c = s.d[srow + sx]; if (c < 0) continue;
      const xx = x + (flip ? s.w - 1 - sx : sx); if (xx < 0 || xx >= W) continue;
      if (lv < 16 && BAYER[by | (xx & 3)] >= lv) continue;
      if (map) c = map[c];
      IB[row + xx] = c;
    }
  }
}
/** Copy a sprite with a remap applied (for caching lit/dark variants). */
export function mapSprite(s, map) { return { w: s.w, h: s.h, d: s.d.map((c) => (c < 0 ? -1 : map[c])) }; }
