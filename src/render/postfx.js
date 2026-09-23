/**
 * Chromatic split and glitch row tears, one 32-bit operation per pixel.
 */
import { MOTION, ri } from '../core/util.js';
import { H, W } from '../game/layout.js';
import { S } from '../game/state.js';
import { g } from '../gfx/canvas.js';

export function postFX() {
  const k = Math.round(S.ca * 3 * MOTION),
    gl = S.glitch;
  if (k < 1 && gl < 0.05) return;
  // chromatic split + tear rows, one 32-bit op per pixel (R from x+k, G from x, B from x-k)
  const img = g.getImageData(0, 0, W, H),
    d = new Uint32Array(img.data.buffer);
  if (!pfxBuf || pfxBuf.length !== d.length) pfxBuf = new Uint32Array(d.length);
  pfxBuf.set(d);
  const src = pfxBuf,
    W1 = W - 1;
  for (let y = 0; y < H; y++) {
    const tear = gl > 0.05 && Math.random() < gl * 0.08 ? ri(-6, 6) : 0;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let xr = x + k + tear,
        xb = x - k + tear,
        xg = x + tear;
      xr = xr < 0 ? 0 : xr > W1 ? W1 : xr;
      xb = xb < 0 ? 0 : xb > W1 ? W1 : xb;
      xg = xg < 0 ? 0 : xg > W1 ? W1 : xg;
      d[row + x] = (src[row + xr] & 0xff) | (src[row + xg] & 0xff00) | (src[row + xb] & 0xff0000) | 0xff000000;
    }
  }
  g.putImageData(img, 0, 0);
}
let pfxBuf = null;
