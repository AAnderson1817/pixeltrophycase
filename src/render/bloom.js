/**
 * Bloom: half-res threshold (contrast 2.6, brightness .72, saturate 1.3), box downsample and a small blur, all in JS.
 * The browser only scales the result and screen-blends it over the game canvas.
 */
import { PERF } from '../core/perf.js';
import { clamp } from '../core/util.js';
import { H, SC, W } from '../game/layout.js';
import { bg, bloomC, cv, mk } from '../gfx/canvas.js';

let bsG = null,
  bloomImg = null,
  BLM = null;
export function setupBloom() {
  // bloom: threshold at half res exactly like before (the contrast curve is non-linear, so it must see 2x2 averages),
  // then average m x m more and blur with a small kernel so that, with the browser's bilinear upscale, the total spread
  // matches the old blur(7px) on nearest-upscaled half-res blocks: sigma^2 = 49 + (2SC)^2/12 CSS px^2.
  {
    const hw = Math.max(2, Math.ceil(W / 2)),
      hh = Math.max(2, Math.ceil(H / 2)),
      tgt = Math.sqrt(49 + (2 * SC) ** 2 / 12);
    let m = 1;
    for (let k = 4; k > 1; k--)
      if (k * SC <= tgt * 1.1) {
        m = k;
        break;
      } // F=2mSC; F/2 = spread with no kernel
    const F = 2 * m * SC,
      bw = Math.max(2, Math.ceil(hw / m)),
      bh = Math.max(2, Math.ceil(hh / m)),
      n = bw * bh,
      vk = (tgt * tgt) / (F * F) - 0.25,
      kc = vk > 0.02 ? 2 / vk - 2 : 1e9;
    bloomC.width = bw;
    bloomC.height = bh;
    bloomC.style.width = bw * F + 'px';
    bloomC.style.height = bh * F + 'px';
    [, bsG] = mk(hw, hh);
    bsG.imageSmoothingEnabled = true;
    bsG.imageSmoothingQuality = 'low';
    bloomImg = bg.createImageData(bw, bh);
    for (let i = 3; i < bloomImg.data.length; i += 4) bloomImg.data[i] = 255;
    const w0 = Math.round(256 / (kc + 2));
    BLM = {
      hw,
      hh,
      m,
      bw,
      bh,
      w0,
      w1: 256 - 2 * w0,
      h: new Uint16Array(hw * hh * 3),
      a: new Uint16Array(n * 3),
      t: new Uint16Array(n * 3),
      nz: new Uint8Array(bh),
      hz: new Uint8Array(hh),
    };
  }
}
/* bloom: half-res copy -> contrast(2.6) brightness(.72) saturate(1.3) -> small separable blur, all in JS on ~1/8 of the pixels.
   The browser only scales it up (bilinear) and screen-blends it; no CSS filter runs on the full-screen layer any more. */
const CBI = new Int32Array(256);
for (let i = 0; i < 256; i++) CBI[i] = Math.round(clamp((i / 255 - 0.5) * 2.6 + 0.5, 0, 1) * 0.72 * 255);
const SAT = 1.3,
  Q0 = Math.round((0.213 + 0.787 * SAT) * 1024),
  Q1 = Math.round((0.715 - 0.715 * SAT) * 1024),
  Q2 = Math.round((0.072 - 0.072 * SAT) * 1024),
  Q3 = Math.round((0.213 - 0.213 * SAT) * 1024),
  Q4 = Math.round((0.715 + 0.285 * SAT) * 1024),
  Q5 = Math.round((0.072 + 0.928 * SAT) * 1024);
// [1 2 1]/4 blur, horizontal then vertical, on interleaved RGB (Uint16); zero outside the frame, like the transparent
// edge of a CSS blur. Branch-free interior loops.
function blur3(a, t, bw, bh, nz, w0, w1) {
  const st = bw * 3; // [w0 w1 w0]/256; rows with no light and no lit neighbour are skipped
  for (let y = 0; y < bh; y++) {
    const r = y * st,
      e = r + st;
    if (!nz[y]) {
      t.fill(0, r, e);
      continue;
    }
    for (let c = 0; c < 3; c++) {
      t[r + c] = (w1 * a[r + c] + w0 * a[r + 3 + c] + 128) >> 8;
      t[e - 3 + c] = (w0 * a[e - 6 + c] + w1 * a[e - 3 + c] + 128) >> 8;
    }
    for (let i = r + 3; i < e - 3; i++) t[i] = (w0 * (a[i - 3] + a[i + 3]) + w1 * a[i] + 128) >> 8;
  }
  for (let y = 0; y < bh; y++) {
    const r = y * st,
      e = r + st,
      up = y > 0 && nz[y - 1],
      dn = y < bh - 1 && nz[y + 1];
    if (!nz[y] && !up && !dn) {
      a.fill(0, r, e);
      continue;
    }
    if (y === 0) {
      for (let i = r; i < e; i++) a[i] = (w1 * t[i] + w0 * t[i + st] + 128) >> 8;
    } else if (y === bh - 1) {
      for (let i = r; i < e; i++) a[i] = (w0 * t[i - st] + w1 * t[i] + 128) >> 8;
    } else for (let i = r; i < e; i++) a[i] = (w0 * (t[i - st] + t[i + st]) + w1 * t[i] + 128) >> 8;
  }
}
export function bloomCopy() {
  if (PERF.bloomSkip || !BLM) return;
  const { hw, hh, m, bw, bh, h, a, t, nz, hz, w0, w1 } = BLM;
  bsG.clearRect(0, 0, hw, hh);
  bsG.drawImage(cv, 0, 0, hw, hh);
  const s = bsG.getImageData(0, 0, hw, hh).data;
  // contrast(2.6) brightness(.72) saturate(1.3) on the half-res copy; dark pixels short-circuit to 0
  const hA = m === 1 ? a : h;
  for (let y = 0; y < hh; y++) {
    let any = 0;
    for (let x = 0, i = y * hw, o = i * 4, j = i * 3; x < hw; x++, o += 4, j += 3) {
      const r = CBI[s[o]],
        gg = CBI[s[o + 1]],
        b = CBI[s[o + 2]];
      if ((r | gg | b) === 0) {
        hA[j] = 0;
        hA[j + 1] = 0;
        hA[j + 2] = 0;
        continue;
      }
      any = 1;
      let v = (Q0 * r + Q1 * gg + Q2 * b) >> 10;
      hA[j] = v < 0 ? 0 : v > 255 ? 255 : v;
      v = (Q3 * r + Q4 * gg + Q2 * b) >> 10;
      hA[j + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
      v = (Q3 * r + Q1 * gg + Q5 * b) >> 10;
      hA[j + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    hz[y] = any;
  }
  if (m === 1) nz.set(hz);
  else {
    const inv = 1 / (m * m); // m x m box average (zero outside the frame)
    for (let by = 0; by < bh; by++) {
      let any = 0;
      for (let yy = by * m; yy < Math.min(hh, by * m + m); yy++) any |= hz[yy];
      nz[by] = any;
      const ro = by * bw * 3;
      if (!any) {
        a.fill(0, ro, ro + bw * 3);
        continue;
      }
      for (let bx = 0; bx < bw; bx++) {
        let R = 0,
          G = 0,
          B = 0;
        for (let yy = by * m; yy < Math.min(hh, by * m + m); yy++) {
          if (!hz[yy]) continue;
          for (let xx = bx * m; xx < Math.min(hw, bx * m + m); xx++) {
            const j = (yy * hw + xx) * 3;
            R += h[j];
            G += h[j + 1];
            B += h[j + 2];
          }
        }
        const o = ro + bx * 3;
        a[o] = R * inv + 0.5;
        a[o + 1] = G * inv + 0.5;
        a[o + 2] = B * inv + 0.5;
      }
    }
  }
  if (w0 > 0) blur3(a, t, bw, bh, nz, w0, w1);
  const d = bloomImg.data;
  for (let o = 0, j = 0; o < d.length; o += 4, j += 3) {
    d[o] = a[j];
    d[o + 1] = a[j + 1];
    d[o + 2] = a[j + 2];
  }
  bg.putImageData(bloomImg, 0, 0);
}
