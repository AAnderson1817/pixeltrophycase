/**
 * Floor reflection: mirrors bright pixels from above the horizon onto unoccluded floor pixels with dithered falloff
 * and a ripple.
 */
import { BAYER } from '../core/palette.js';
import { H, HY, NARROW, W } from '../game/layout.js';
import { S } from '../game/state.js';
import { g } from '../gfx/canvas.js';
import { UNIT, scene32 } from '../scene/scene.js';

export function reflect(ox, oy) {
  const hy = HY + oy;
  if (hy >= H - 2 || !scene32) return;
  const ya = Math.max(0, hy + 1),
    y0 = Math.min(ya, Math.max(0, Math.round(hy - 1 - (H - 1 - hy) * 1.45))); // only the rows the mirror reads or writes
  const img = g.getImageData(0, y0, W, H - y0),
    d = new Uint32Array(img.data.buffer),
    T = S.t,
    span = H - hy;
  for (let y = ya; y < H; y++) {
    const dist = y - hy,
      sy = Math.round(hy - 1 - dist * 1.45);
    if (sy < 0) break;
    const str = (NARROW ? 0.36 : 0.5) * (1 - dist / span);
    if (str < 0.04) continue;
    const wob = dist > 3 ? Math.round(Math.sin(y * 0.85 + T * 2.4)) : 0,
      by = (y & 3) * 4,
      row = (y - y0) * W,
      srow = (sy - y0) * W,
      scy = y - oy;
    if (scy < 0 || scy >= H) continue;
    for (let x = 0; x < W; x++) {
      if (BAYER[by + (x & 3)] >= str) continue;
      const scx = x - ox;
      if (scx < 0 || scx >= W) continue;
      const si = scy * W + scx;
      if (UNIT[si] < 0) continue;
      const cur = d[row + x];
      if (cur !== scene32[si]) continue;
      const xs = x + wob;
      if (xs < 0 || xs >= W) continue;
      const src = d[srow + xs];
      const lc = (cur & 255) + ((cur >>> 8) & 255) + ((cur >>> 16) & 255),
        ls = (src & 255) + ((src >>> 8) & 255) + ((src >>> 16) & 255);
      if (ls > lc + 140) d[row + x] = src;
    }
  }
  g.putImageData(img, 0, y0, 0, ya - y0, W, H - ya);
}
