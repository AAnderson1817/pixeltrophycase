/**
 * The visible canvas and bloom canvas, mk() for CPU-backed offscreen canvases, shared card-size constants and
 * dithered pattern fills. Every offscreen canvas must come from mk(): a GPU-backed source forces a readback per draw.
 */
import { BAYER, PAL } from '../core/palette.js';
import { $, clamp } from '../core/util.js';

export const cv = $('screen'),
  g = cv.getContext('2d', {
    willReadFrequently: true,
  }),
  bloomC = $('bloom'),
  bg = bloomC.getContext('2d', {
    willReadFrequently: true,
  }),
  stage = $('stage');
// every offscreen canvas is CPU-backed: the visible canvas is, so a GPU-backed source would force a readback per drawImage
export const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', {
    willReadFrequently: true,
  });
  x.imageSmoothingEnabled = false;
  return [c, x];
};
export const CWd = 64,
  CHd = 90,
  T1W = 132,
  T1H = 160;
export const [brC, brG] = mk(20, 20),
  [dissC, dissG] = mk(CWd, CHd),
  [backC, backG] = mk(CWd, CHd),
  [frontC, frontG] = mk(CWd, CHd),
  [artC, artG] = mk(52, 45),
  [tileSrcC, tileSrcG] = mk(CWd, CHd),
  [rotC, rotG] = mk(16, 16);
const patCache = new Map();
export function pat(ctx, col, level) {
  level = clamp(Math.round(level * 16), 0, 16);
  const key = col + '|' + level + '|' + (ctx === g ? 'm' : 'o');
  let p = patCache.get(key);
  if (p) return p;
  const [c, x] = mk(4, 4);
  x.fillStyle = PAL[col] || col;
  for (let i = 0; i < 16; i++) if (BAYER[i] < level / 16) x.fillRect(i % 4, Math.floor(i / 4), 1, 1);
  p = ctx.createPattern(c, 'repeat');
  patCache.set(key, p);
  return p;
}
