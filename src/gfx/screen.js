/**
 * Presents the index framebuffer on #screen at an integer scale and derives a half-resolution bright pass for the
 * #bloom layer (screen-blended and blurred by CSS, so the pixel canvas itself stays crisp).
 */
import { IB, W, H } from './fb.js';
import { U32, LUM } from '../core/palette.js';

const screen = document.getElementById('screen');
const bloom = document.getElementById('bloom');
const sg = screen.getContext('2d', { alpha: false });
const bg = bloom.getContext('2d');
const off = document.createElement('canvas');
off.width = W; off.height = H;
const og = off.getContext('2d', { alpha: false, willReadFrequently: true });
const img = og.createImageData(W, H);
const u32 = new Uint32Array(img.data.buffer);
const BW = W >> 1, BH = H >> 1;
const boff = document.createElement('canvas');
boff.width = BW; boff.height = BH;
const bog = boff.getContext('2d', { willReadFrequently: true });
const bimg = bog.createImageData(BW, BH);
const b32 = new Uint32Array(bimg.data.buffer);
const BLOOM_THRESHOLD = 150;

export const view = { scale: 2, shakeX: 0, shakeY: 0 };

export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.max(1, Math.min(Math.floor(vw / W), Math.floor(vh / H)));
  view.scale = s;
  screen.width = W * s; screen.height = H * s;
  bloom.width = BW; bloom.height = BH;
  screen.style.width = bloom.style.width = `${W * s}px`;
  screen.style.height = bloom.style.height = `${H * s}px`;
  document.documentElement.style.setProperty('--scale', s);
  sg.imageSmoothingEnabled = false;
}

export function present(bloomOn = true) {
  for (let i = 0; i < IB.length; i++) u32[i] = U32[IB[i]];
  og.putImageData(img, 0, 0);
  const s = view.scale;
  sg.imageSmoothingEnabled = false;
  if (view.shakeX || view.shakeY) { sg.fillStyle = '#07060f'; sg.fillRect(0, 0, screen.width, screen.height); }
  sg.drawImage(off, view.shakeX * s, view.shakeY * s, W * s, H * s);
  if (!bloomOn) { bg.clearRect(0, 0, BW, BH); return; }
  // bright pass: brightest of each 2x2 block above the threshold
  for (let y = 0; y < BH; y++) {
    const r0 = (y * 2) * W, r1 = r0 + W;
    for (let x = 0; x < BW; x++) {
      const x2 = x * 2;
      let best = IB[r0 + x2], l = LUM[best], c;
      c = IB[r0 + x2 + 1]; if (LUM[c] > l) { l = LUM[c]; best = c; }
      c = IB[r1 + x2]; if (LUM[c] > l) { l = LUM[c]; best = c; }
      c = IB[r1 + x2 + 1]; if (LUM[c] > l) { l = LUM[c]; best = c; }
      b32[y * BW + x] = l >= BLOOM_THRESHOLD ? U32[best] : 0;
    }
  }
  bog.putImageData(bimg, 0, 0);
  bg.clearRect(0, 0, BW, BH);
  bg.drawImage(boff, view.shakeX / 2, view.shakeY / 2);
}
export { screen };
