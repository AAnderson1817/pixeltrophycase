/**
 * Chains and padlock over the card back, cached link sprites, chain snapping, and the summon dissolve.
 */
import { A, buzz } from '../audio/chip.js';
import { PAL, RAMPS, bay } from '../core/palette.js';
import { MOTION, ri, rnd } from '../core/util.js';
import { RAR } from '../data/armor.js';
import { FX, gy, sparks } from '../fx/particles.js';
import { S } from '../game/state.js';
import { CHd, CWd, dissC, dissG, mk } from '../gfx/canvas.js';
import { txCache } from '../gfx/text.js';

function rectCanvas(rows, mirror) {
  const h = rows.length,
    w = rows[0].length,
    [c, x] = mk(w, h);
  rows.forEach((row, y) => {
    for (let i = 0; i < w; i++) {
      const ch = row[mirror ? w - 1 - i : i];
      if (ch !== '.') {
        x.fillStyle = PAL[ch];
        x.fillRect(i, y, 1, 1);
      }
    }
  });
  return c;
}
const PADLOCK = [
  '...kkkkk...',
  '..ksSSSsk..',
  '.ksk...ksk.',
  '.ksk...ksk.',
  '.ksk...ksk.',
  'kkkkkkkkkkk',
  'kyyoyyyyyYk',
  'kyoyyyyyyYk',
  'kyyyykyyyYk',
  'kyyykkkyyYk',
  'kyyyykyyyYk',
  'kYyyyyyyYYk',
  'kkkkkkkkkkk',
];
export const LOCKC = rectCanvas(PADLOCK),
  LOCKM = rectCanvas(PADLOCK, true),
  LOCKW = rectCanvas(PADLOCK.map((r) => r.replace(/[^.k]/g, 'w')));
const SEG = [
  [
    [6, 9],
    [32, 45],
  ],
  [
    [58, 9],
    [32, 45],
  ],
  [
    [32, 45],
    [58, 81],
  ],
  [
    [32, 45],
    [6, 81],
  ],
];
const CHAIN_LINKS = SEG.map(([[x0, y0], [x1, y1]]) => {
  const L = Math.hypot(x1 - x0, y1 - y0),
    n = Math.floor(L / 3.3),
    out = [];
  for (let j = 0; j <= n; j++) {
    const u = j / n,
      px = x0 + (x1 - x0) * u,
      py = y0 + (y1 - y0) * u;
    if (Math.hypot(px - 32, py - 45) < 8) continue;
    out.push([Math.round(px), Math.round(py), j % 2]);
  }
  return out;
});
function chainCols(c) {
  const rp = RAMPS[RAR[Math.max(0, S.tease)].ramp];
  return c > 0.25 ? [rp[4], c > 0.62 ? 'w' : rp[5], rp[3]] : ['S', 's', 'D'];
}
// chain links as cached 4x4 / 2x2 sprites (even link drawn at jx-1,jy-1; odd at jx,jy)
export function linkSpr(odd, base, hi) {
  return odd
    ? txCache('lo|' + base + hi, 2, 2, (x) => {
        x.fillStyle = PAL.k;
        x.fillRect(0, 1, 2, 1);
        x.fillStyle = PAL[base];
        x.fillRect(0, 0, 2, 1);
        x.fillStyle = PAL[hi];
        x.fillRect(0, 0, 1, 1);
      })
    : txCache('le|' + base + hi, 4, 4, (x) => {
        x.fillStyle = PAL.k;
        x.fillRect(1, 1, 3, 3);
        x.fillStyle = PAL[base];
        x.fillRect(0, 0, 3, 1);
        x.fillRect(0, 2, 3, 1);
        x.fillRect(0, 1, 1, 1);
        x.fillRect(2, 1, 1, 1);
        x.fillStyle = PAL[hi];
        x.fillRect(0, 0, 1, 1);
      });
}
export function drawChains(x) {
  const c = S.phase === 'idle' ? S.charge : 0,
    [base, hi, lo] = chainCols(c),
    EV = linkSpr(0, base, hi),
    OD = linkSpr(1, lo, hi);
  for (let si = 0; si < 4; si++) {
    if (!S.chains[si]) continue;
    const [[x0, y0], [x1, y1]] = SEG[si],
      nx = -(y1 - y0),
      ny = x1 - x0,
      nl = Math.hypot(nx, ny);
    for (const [lx, ly, odd] of CHAIN_LINKS[si]) {
      let jx = lx,
        jy = ly;
      if (c > 0.25 && Math.random() < c * 0.55) {
        const o = ri(-1, 1);
        jx += Math.round((nx / nl) * o);
        jy += Math.round((ny / nl) * o);
      }
      if (!odd) x.drawImage(EV, jx - 1, jy - 1);
      else x.drawImage(OD, jx, jy);
    }
  }
  if (S.lockOn) {
    const sh = c > 0.2 && Math.random() < c ? ri(-1, 1) : 0,
      flash = c > 0.8 && Math.floor(S.rt * 14) % 2;
    x.drawImage(flash ? LOCKW : LOCKC, 27 + sh, 38 + (c > 0.5 ? ri(-1, 0) : 0));
  }
}
export function snapChain(i) {
  if (!S.chains[i]) return;
  S.chains[i] = false;
  const ox = S.cx - 32,
    oy = S.cy - 45,
    [[x0, y0], [x1, y1]] = SEG[i],
    outx = (x0 + x1) / 2 - 32,
    outy = (y0 + y1) / 2 - 45,
    ol = Math.hypot(outx, outy) || 1;
  for (const [lx, ly, odd] of CHAIN_LINKS[i])
    FX.links.push({
      x: ox + lx,
      y: oy + ly,
      vx: (outx / ol) * rnd(40, 150) + rnd(-30, 30),
      vy: (outy / ol) * rnd(20, 80) - rnd(60, 160),
      g: gy(),
      age: 0,
      life: rnd(3, 5),
      odd,
      rest: false,
    });
  sparks(20, S.teaseKey, 40, 170, 0.4, ox + 32 + Math.round(outx * 0.25), oy + 45 + Math.round(outy * 0.25), true);
  A.snap();
  S.trauma = Math.min(1, S.trauma + 0.22);
  S.sq.v -= 1.5 * MOTION;
  buzz(20);
}
export function dissolve(src, p) {
  const img = src.getContext('2d').getImageData(0, 0, CWd, CHd),
    d = img.data;
  for (let y = 0; y < CHd; y++)
    for (let x = 0; x < CWd; x++) {
      const o = (y * CWd + x) * 4;
      if (!d[o + 3]) continue;
      const th = bay(x, y) * 0.3 + (1 - y / CHd) * 0.7;
      if (th > p) d[o + 3] = 0;
      else if (th > p - 0.07) {
        d[o] = 255;
        d[o + 1] = 255;
        d[o + 2] = 255;
      }
    }
  dissG.putImageData(img, 0, 0);
  return dissC;
}
