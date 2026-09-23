/**
 * Cached sprites: coins, torch halos, and rotation sheets that resample rotated bricks and card shards in typed arrays.
 */
import { BAYER, PAL, U32 } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { g, mk } from '../gfx/canvas.js';
import { txCache } from '../gfx/text.js';

// coins: the three spin silhouettes are pre-rasterised with the exact per-row shape (x,y rounded; sprite origin -4,-4)
const COIN_SPR = [1, 0.6, 0.18].map((sw) => {
  const [c, x] = mk(9, 8);
  const X = 4,
    Y = 4;
  for (let yy = -3; yy <= 2; yy++) {
    const hw = Math.max(0, Math.round(Math.sqrt(9 - (yy + 0.5) * (yy + 0.5)) * sw));
    const l = X - hw,
      w = hw * 2 + 1;
    x.fillStyle = PAL.k;
    x.fillRect(l - 1, Y + yy, w + 2, 1);
    if (yy === -3 || yy === 2) {
      x.fillRect(l, Y + yy - (yy < 0 ? 1 : -1), w, 1);
    }
    x.fillStyle = PAL[yy <= -2 ? 'o' : yy >= 1 ? 'Y' : 'y'];
    x.fillRect(l, Y + yy, w, 1);
    if (w >= 5 && yy > -2 && yy < 1) {
      x.fillStyle = PAL.Y;
      x.fillRect(X, Y + yy, 1, 1);
      x.fillStyle = PAL.o;
      x.fillRect(l, Y + yy, 1, 1);
    }
  }
  return c;
});
// torch halo: three dithered discs (35% / 60% / 90%), Bayer phase px,py so it matches a canvas-anchored pattern fill
export function haloSpr(r1, r2, px, py) {
  const R = Math.max(r1, r2, 2),
    n = 2 * R + 1;
  return txCache('halo|' + r1 + '|' + r2 + '|' + px + '|' + py, n, n, (x) => {
    const im = x.createImageData(n, n),
      d = new Uint32Array(im.data.buffer);
    for (const [r, k, l] of [
      [r1, 'Y', 0.35],
      [r2, 'y', 0.6],
      [2, 'o', 0.9],
    ]) {
      const lv = clamp(Math.round(l * 16), 0, 16) / 16,
        c = U32[k];
      for (let yy = -r; yy <= r; yy++) {
        const hw = Math.round(Math.sqrt(r * r - yy * yy)),
          sy = R + yy;
        for (let xx = -hw; xx <= hw; xx++) {
          const sx = R + xx;
          if (BAYER[((sy + py) & 3) * 4 + ((sx + px) & 3)] < lv) d[sy * n + sx] = c;
        }
      }
    }
    x.putImageData(im, 0, 0);
  });
}
/* rotation sheets: rotated bricks / card shards are resampled nearest-neighbour (same inverse mapping as a rotated
   drawImage with smoothing off) into slots of one buffer, uploaded once, then blitted with one drawImage each */
function makeSheet(box, cols, rows) {
  const [c, x] = mk(box * cols, box * rows),
    img = x.createImageData(box * cols, box * rows);
  return {
    c,
    x,
    img,
    d: new Uint32Array(img.data.buffer),
    box,
    cols,
    rows,
    n: 0,
    sw: box * cols,
  };
}
export const RSB = makeSheet(20, 32, 16),
  RST = makeSheet(16, 16, 8);
export function rotSlot(SH, src, sw, sx, sy, w, h, a) {
  if (SH.n >= SH.cols * SH.rows) return -1;
  const k = SH.n++,
    B = SH.box,
    half = B / 2,
    x0 = (k % SH.cols) * B,
    y0 = ((k / SH.cols) | 0) * B,
    c = Math.cos(a),
    s = Math.sin(a),
    d = SH.d,
    hw = w / 2,
    hh = h / 2;
  for (let dy = 0; dy < B; dy++) {
    const py = dy + 0.5 - half,
      row = (y0 + dy) * SH.sw + x0;
    for (let dx = 0; dx < B; dx++) {
      const px = dx + 0.5 - half,
        ux = px * c + py * s + hw,
        uy = -px * s + py * c + hh;
      d[row + dx] = ux >= 0 && uy >= 0 && ux < w && uy < h ? src[(sy + (uy | 0)) * sw + sx + (ux | 0)] : 0;
    }
  }
  return k;
}
export function sheetPut(SH) {
  if (!SH.n) return;
  const rows = Math.ceil(SH.n / SH.cols) * SH.box;
  SH.x.putImageData(SH.img, 0, 0, 0, 0, SH.sw, rows);
}
export function sheetDraw(SH, k, x, y) {
  const B = SH.box;
  g.drawImage(SH.c, (k % SH.cols) * B, ((k / SH.cols) | 0) * B, B, B, x, y, B, B);
}
export function drawCoin(x, y, ph) {
  g.drawImage(COIN_SPR[[0, 1, 2, 1][Math.floor(ph) % 4]], Math.round(x) - 4, Math.round(y) - 4);
}
