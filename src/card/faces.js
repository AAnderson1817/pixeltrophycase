/**
 * Card faces, drawn into 64x90 canvases: the back (sheen, glints, cracks, chains) and the front (rarity frame, armor
 * sprite, nameplate, stat bars, gems, upgrade cracks and glitch).
 */
import { drawChains } from './chains.js';
import { LIGHTEN, PAL, U32, bay } from '../core/palette.js';
import { TAU, mulberry, ri } from '../core/util.js';
import { ARMOR, ATLASC, RAR } from '../data/armor.js';
import { S } from '../game/state.js';
import { CHd, CWd, artC, artG, backG, frontG } from '../gfx/canvas.js';
import { drawText, textW, txCache } from '../gfx/text.js';

let backBase = null;
export function buildBackBase() {
  const x = backG;
  x.clearRect(0, 0, CWd, CHd);
  x.fillStyle = PAL[1];
  x.fillRect(1, 1, CWd - 2, CHd - 2);
  for (let yy = 2; yy < CHd - 2; yy++)
    for (let xx = 2; xx < CWd - 2; xx++) {
      const a = (xx + yy) % 8 === 0 || (xx - yy + 800) % 8 === 0;
      if (a) {
        x.fillStyle = PAL[2];
        x.fillRect(xx, yy, 1, 1);
      } else if (bay(xx, yy) < (yy / CHd) * 0.35) {
        x.fillStyle = PAL[0];
        x.fillRect(xx, yy, 1, 1);
      }
    }
  x.fillStyle = PAL.k;
  x.fillRect(2, 0, CWd - 4, 1);
  x.fillRect(2, CHd - 1, CWd - 4, 1);
  x.fillRect(0, 2, 1, CHd - 4);
  x.fillRect(CWd - 1, 2, 1, CHd - 4);
  x.fillRect(1, 1, 1, 1);
  x.fillRect(CWd - 2, 1, 1, 1);
  x.fillRect(1, CHd - 2, 1, 1);
  x.fillRect(CWd - 2, CHd - 2, 1, 1);
  x.fillStyle = PAL.c;
  x.fillRect(2, 1, CWd - 4, 1);
  x.fillRect(1, 2, 1, CHd - 4);
  x.fillStyle = PAL[4];
  x.fillRect(2, CHd - 2, CWd - 4, 1);
  x.fillRect(CWd - 2, 2, 1, CHd - 4);
  const frame = (a, col, sh) => {
    x.fillStyle = PAL[col];
    x.fillRect(a, a, CWd - 2 * a, 1);
    x.fillRect(a, a, 1, CHd - 2 * a);
    x.fillStyle = PAL[sh];
    x.fillRect(a, CHd - 1 - a, CWd - 2 * a, 1);
    x.fillRect(CWd - 1 - a, a, 1, CHd - 2 * a);
  };
  frame(4, 'o', 'Y');
  frame(5, 'y', 'R');
  frame(7, 'Y', 'd');
  for (const [a, b] of [
    [4, 4],
    [CWd - 9, 4],
    [4, CHd - 9],
    [CWd - 9, CHd - 9],
  ]) {
    x.fillStyle = PAL.k;
    x.fillRect(a, b, 5, 5);
    x.fillStyle = PAL.y;
    x.fillRect(a + 1, b + 1, 3, 3);
    x.fillStyle = PAL.o;
    x.fillRect(a + 1, b + 1, 1, 1);
    x.fillStyle = PAL.Y;
    x.fillRect(a + 3, b + 3, 1, 1);
    x.fillStyle = PAL.r;
    x.fillRect(a + 2, b + 2, 1, 1);
  }
  const cx = 32,
    cy = 44,
    R = 19;
  for (let yy = -R; yy <= R; yy++)
    for (let xx = -R; xx <= R; xx++) {
      const d = Math.abs(xx) + Math.abs(yy);
      if (d > R) continue;
      let col;
      if (d === R) col = 'k';
      else if (d >= R - 2) col = xx < 0 || yy < 0 ? (d === R - 1 ? 'o' : 'y') : d === R - 1 ? 'Y' : 'y';
      else if (d === R - 3) col = 'k';
      else col = bay(xx + 40, yy + 40) < (1 - d / (R - 3)) * 0.8 ? '5' : '3';
      x.fillStyle = PAL[col];
      x.fillRect(cx + xx, cy + yy, 1, 1);
    }
  drawText(x, '?', cx - 5 + 1, cy - 10 + 2, 4, 'k');
  drawText(x, '?', cx - 5, cy - 10, 4, 'y');
  x.fillStyle = PAL.o;
  x.fillRect(cx - 5, cy - 10, 4, 2);
  x.fillRect(cx - 1, cy + 6, 4, 1);
  x.fillStyle = PAL.Y;
  x.fillRect(cx + 3, cy - 4, 4, 2);
  for (const [sx, sy] of [
    [32, 14],
    [32, 74],
    [14, 44],
    [50, 44],
  ]) {
    x.fillStyle = PAL.y;
    x.fillRect(sx, sy - 1, 1, 3);
    x.fillRect(sx - 1, sy, 3, 1);
    x.fillStyle = PAL.o;
    x.fillRect(sx, sy, 1, 1);
  }
  backBase = x.getImageData(0, 0, CWd, CHd);
}
function genCracks(seed, cx, cy) {
  const rng = mulberry(seed),
    tiers = [[], [], [], []];
  function walk(x, y, a, len, tier, depth) {
    const pts = [];
    for (let i = 0; i < len; i++) {
      a += (rng() - 0.5) * 0.75;
      x += Math.cos(a);
      y += Math.sin(a);
      const px = Math.round(x),
        py = Math.round(y);
      if (px < 2 || py < 2 || px > CWd - 3 || py > CHd - 3) break;
      pts.push([px, py]);
      if (depth < 1 && rng() < 0.04)
        walk(
          x,
          y,
          a + (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.6),
          Math.floor(len * 0.4),
          Math.min(3, tier + 1),
          depth + 1,
        );
    }
    tiers[tier].push(pts);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng() * 0.5;
    walk(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, a, 16 + Math.floor(rng() * 20), i % 4, 0);
  }
  return tiers.map((ps) => ({
    paths: ps,
    shown: false,
    prog: 0,
  }));
}
export let backCracks = genCracks(1, 32, 44),
  frontCracks = genCracks(2, 32, 28);
export function resetCracks(seed) {
  backCracks = genCracks(seed * 31, 32, 44);
  frontCracks = genCracks(seed * 31 + 7, 32, 28);
}
export function buildArtBg(vr) {
  const R = RAR[vr],
    x = artG,
    rng = mulberry(S.spec.seed);
  const im = x.createImageData(52, 45),
    d = new Uint32Array(im.data.buffer); // same pixels as the per-pixel fillRect version
  for (let yy = 0; yy < 45; yy++)
    for (let xx = 0; xx < 52; xx++) {
      const t = yy / 44;
      const dx = (xx - 26) / 26,
        dy = (yy - 24) / 22,
        rad = Math.sqrt(dx * dx + dy * dy);
      const b = bay(xx, yy);
      let c = b < (1 - rad) * 0.55 ? U32[R.x] : b < t * 0.9 ? U32[0] : U32[1];
      if ((1 - rad) * 0.8 > b + 0.5) c = U32[R.d];
      d[yy * 52 + xx] = c;
    }
  for (let xx = 0; xx < 52; xx++) {
    const y0 = 40 + (xx % 3 === 0 ? 1 : 0);
    for (let yy = y0; yy < Math.min(45, y0 + 5); yy++) d[yy * 52 + xx] = U32[0];
  }
  for (let xx = 0; xx < 52; xx++) d[40 * 52 + xx] = U32[1];
  x.putImageData(im, 0, 0);
  S.artStars = [];
  for (let i = 0; i < 16; i++) S.artStars.push([Math.floor(rng() * 52), Math.floor(rng() * 34), rng() * TAU]);
}
export const CYCLE = ['y', 'o', 'w', 'o', 'y', 'Y'];
const GL32 = new Uint32Array(CWd * CHd);
export function drawFront(t) {
  const x = frontG,
    vr = S.vr,
    R = RAR[vr];
  x.clearRect(0, 0, CWd, CHd);
  x.fillStyle = PAL.k;
  x.fillRect(2, 0, CWd - 4, CHd);
  x.fillRect(0, 2, CWd, CHd - 4);
  x.fillRect(1, 1, CWd - 2, CHd - 2);
  const rimL = vr === 3 ? CYCLE[Math.floor(t * 12) % CYCLE.length] : R.l;
  x.fillStyle = PAL[R.l];
  x.fillRect(1, 1, CWd - 2, CHd - 2);
  x.fillStyle = PAL.w;
  x.fillRect(2, 1, CWd - 4, 1);
  x.fillRect(1, 2, 1, CHd - 4);
  x.fillStyle = PAL[LIGHTEN[R.l] || 'w'];
  x.fillRect(2, 2, CWd - 4, 1);
  x.fillRect(2, 2, 1, CHd - 4);
  x.fillStyle = PAL[R.d];
  x.fillRect(2, CHd - 2, CWd - 4, 1);
  x.fillRect(CWd - 2, 2, 1, CHd - 4);
  x.fillRect(3, CHd - 3, CWd - 5, 1);
  x.fillRect(CWd - 3, 3, 1, CHd - 5);
  if (vr === 3) {
    for (let i = 0; i < (CWd + CHd) * 2; i += 4) {
      const col = CYCLE[(Math.floor(t * 14) + Math.floor(i / 4)) % CYCLE.length];
      x.fillStyle = PAL[col];
      let px, py;
      const P = i % (2 * (CWd + CHd));
      if (P < CWd) {
        px = P;
        py = 1;
      } else if (P < CWd + CHd) {
        px = CWd - 2;
        py = P - CWd;
      } else if (P < 2 * CWd + CHd) {
        px = CWd - 1 - (P - CWd - CHd);
        py = CHd - 2;
      } else {
        px = 1;
        py = CHd - 1 - (P - 2 * CWd - CHd);
      }
      x.fillRect(px, py, 2, 2);
    }
  }
  x.fillStyle = PAL.k;
  x.fillRect(4, 4, CWd - 8, CHd - 8);
  x.fillStyle = PAL[0];
  x.fillRect(5, 5, CWd - 10, CHd - 10);
  for (const [a, b] of [
    [2, 2],
    [CWd - 6, 2],
    [2, CHd - 6],
    [CWd - 6, CHd - 6],
  ]) {
    x.fillStyle = PAL.k;
    x.fillRect(a, b, 4, 4);
    x.fillStyle = PAL[rimL];
    x.fillRect(a + 1, b + 1, 2, 2);
    x.fillStyle = PAL.w;
    x.fillRect(a + 1, b + 1, 1, 1);
  }
  // art
  x.fillStyle = PAL[R.d];
  x.fillRect(5, 5, 54, 47);
  x.drawImage(artC, 6, 6);
  for (const [sx, sy, ph] of S.artStars) {
    const tw = Math.sin(t * 3 + ph);
    if (tw > 0.2) {
      x.fillStyle = tw > 0.8 ? PAL.w : PAL[4];
      x.fillRect(6 + sx, 6 + sy, 1, 1);
      if (tw > 0.93) {
        x.fillStyle = PAL[R.l];
        x.fillRect(5 + sx, 6 + sy, 1, 1);
        x.fillRect(7 + sx, 6 + sy, 1, 1);
        x.fillRect(6 + sx, 5 + sy, 1, 1);
        x.fillRect(6 + sx, 7 + sy, 1, 1);
      }
    }
  }
  const bob = Math.round(Math.sin(t * 3.2) * 1.4);
  const gr = Math.round(9 + Math.sin(t * 4) * 1.5),
    gox = Math.ceil(gr * 1.4) + 1;
  x.drawImage(
    txCache('glow|' + gr + '|' + R.l + '|' + R.d, 2 * gox + 1, 2 * gr + 1, (q) => {
      for (let yy = -gr; yy <= gr; yy++)
        for (let xx = -gr * 1.4; xx <= gr * 1.4; xx++) {
          const d = Math.sqrt((xx / 1.4) ** 2 + yy * yy) / gr;
          if (d < 1 && bay(xx + 64, yy + 64) < (1 - d) * 0.7) {
            q.fillStyle = PAL[d < 0.4 ? R.l : R.d];
            q.fillRect(gox + Math.round(xx), gr + yy, 1, 1);
          }
        }
    }),
    32 - gox,
    28 - gr,
  );
  x.fillStyle = PAL.k;
  x.fillRect(20, 45, 24, 2);
  x.fillStyle = PAL[1];
  x.fillRect(17, 46, 30, 1);
  const pt = S.rt - S.popT0,
    ps = pt < 0.42 ? 1 + 0.75 * Math.pow(1 - pt / 0.42, 2) : 1;
  if (ATLASC) {
    const [sx, sy, sw, sh] = ARMOR[S.spec.spr].c,
      dw = Math.round(sw * ps),
      dh = Math.round(sh * ps);
    x.drawImage(ATLASC, sx, sy, sw, sh, Math.round(32 - dw / 2), Math.round(26 - dh / 2) + bob, dw, dh);
  }
  if (vr >= 1) {
    for (let i = 0; i < R.sparkle + 1; i++) {
      const cyc = Math.floor(t * 1.4 + i * 0.37),
        ph = (t * 1.4 + i * 0.37) % 1,
        px = 8 + ((i * 37 + cyc * 13) % 46),
        py = 8 + ((i * 23 + cyc * 7) % 34);
      const big = ph > 0.3 && ph < 0.7;
      x.fillStyle = PAL.w;
      x.fillRect(px, py, 1, 1);
      if (big) {
        x.fillStyle = PAL[R.l];
        x.fillRect(px - 1, py, 1, 1);
        x.fillRect(px + 1, py, 1, 1);
        x.fillRect(px, py - 1, 1, 1);
        x.fillRect(px, py + 1, 1, 1);
        if (ph > 0.45 && ph < 0.55) {
          x.fillRect(px - 2, py, 1, 1);
          x.fillRect(px + 2, py, 1, 1);
          x.fillRect(px, py - 2, 1, 1);
          x.fillRect(px, py + 2, 1, 1);
        }
      }
    }
  }
  x.fillStyle = PAL[R.l];
  x.fillRect(5, 52, 54, 1);
  // nameplate
  x.fillStyle = PAL[1];
  x.fillRect(6, 54, 52, 10);
  x.fillStyle = PAL[2];
  x.fillRect(6, 54, 52, 1);
  x.fillStyle = PAL.k;
  x.fillRect(6, 63, 52, 1);
  const nm = S.spec.name;
  drawText(x, nm, Math.round(32 - textW(nm, 1) / 2), 56, 1, 'c', 'k');
  // bars
  ['ATK', 'DEF', 'MAG'].forEach((lb, k) => {
    const y = 66 + k * 6;
    drawText(x, lb, 7, y, 1, '4');
    const bw = 36,
      bx = 21;
    x.fillStyle = PAL.k;
    x.fillRect(bx - 1, y, bw + 2, 5);
    x.fillStyle = PAL[1];
    x.fillRect(bx, y + 1, bw, 3);
    const f = Math.round(bw * (S.bars[k] || 0));
    if (f > 0) {
      x.fillStyle = PAL[R.l];
      x.fillRect(bx, y + 1, f, 3);
      x.fillStyle = PAL[R.d];
      for (let j = 3; j < f; j += 4) x.fillRect(bx + j, y + 1, 1, 3);
    }
    if (f > 0) {
      x.fillStyle = PAL.w;
      x.fillRect(bx, y + 1, f, 1);
      if (S.barFlash[k] > 0) {
        x.fillStyle = PAL.w;
        x.fillRect(bx + f - 2, y, 3, 5);
      }
    }
  });
  // gems
  const gw = (vr + 1) * 6 - 2;
  for (let i = 0; i <= vr; i++) {
    const gx = Math.round(32 - gw / 2) + i * 6,
      gy = 83;
    x.fillStyle = PAL.k;
    x.fillRect(gx + 1, gy - 1, 2, 6);
    x.fillRect(gx, gy, 4, 4);
    x.fillStyle = PAL[R.l];
    x.fillRect(gx + 1, gy, 2, 4);
    x.fillRect(gx, gy + 1, 4, 2);
    x.fillStyle = PAL.w;
    x.fillRect(gx + 1, gy, 1, 1);
  }
  // upgrade cracks + glitch rows in a pixel buffer (same result as the fillRect / per-row drawImage version)
  const upg = S.phase === 'upgrading';
  if (upg || S.glitch > 0) {
    const im = x.getImageData(0, 0, CWd, CHd),
      b = new Uint32Array(im.data.buffer);
    if (upg) cracksBuf(b, frontCracks, RAR[S.r].l);
    if (S.glitch > 0) {
      GL32.set(b);
      b.fill(0);
      for (let yy = 0; yy < CHd; yy++) {
        const dx = Math.random() < S.glitch * 0.45 ? ri(-5, 5) : 0,
          row = yy * CWd;
        for (let xx = Math.max(0, dx); xx < Math.min(CWd, CWd + dx); xx++) b[row + xx] = GL32[row + xx - dx];
      }
      for (let k = 0; k < Math.floor(S.glitch * 8); k++) {
        const c = U32[['m', 't', 'y', 'v', 'w'][ri(0, 4)]],
          x0 = ri(0, 50),
          y0 = ri(0, CHd - 1),
          w = ri(4, 24);
        for (let xx = x0; xx < Math.min(CWd, x0 + w); xx++) b[y0 * CWd + xx] = c;
      }
    }
    x.putImageData(im, 0, 0);
  }
}
const backWork = new ImageData(CWd, CHd),
  back32 = new Uint32Array(backWork.data.buffer),
  GLINTS = [
    [32, 14],
    [32, 74],
    [14, 44],
    [50, 44],
  ];
// cracks straight into a pixel buffer (same pixels as the old per-pixel fillRect version)
function cracksBuf(b, cracks, col) {
  const c = U32[col],
    w = U32.w;
  for (const t of cracks) {
    if (!t.shown) continue;
    const f = Math.min(1, t.prog);
    for (const p of t.paths) {
      const n = Math.floor(p.length * f);
      for (let i = 0; i < n; i++) {
        const px = p[i][0],
          py = p[i][1];
        b[py * CWd + px + 1] = c;
        b[(py + 1) * CWd + px] = c;
      }
    }
  }
  for (const t of cracks) {
    if (!t.shown) continue;
    const f = Math.min(1, t.prog);
    for (const p of t.paths) {
      const n = Math.floor(p.length * f);
      for (let i = 0; i < n; i++) b[p[i][1] * CWd + p[i][0]] = w;
    }
  }
}
export function drawBack(t) {
  const d = backWork.data,
    band = ((t * 42) % 180) - 50;
  d.set(backBase.data);
  for (let yy = 2; yy < CHd - 2; yy++) {
    const bx = Math.round(band - yy * 0.6);
    for (let xx = bx; xx < bx + 4; xx++) {
      if (xx < 2 || xx >= CWd - 2) continue;
      const o = (yy * CWd + xx) * 4;
      const k = xx === bx || xx === bx + 3 ? 40 : 80;
      d[o] = Math.min(255, d[o] + k);
      d[o + 1] = Math.min(255, d[o + 1] + k);
      d[o + 2] = Math.min(255, d[o + 2] + k * 0.8);
    }
  }
  const gl = Math.floor(t * 1.5) % 4,
    gx = GLINTS[gl][0],
    gy = GLINTS[gl][1],
    ph = (t * 1.5) % 1;
  if (ph < 0.4) {
    const s = ph < 0.13 ? 1 : ph < 0.26 ? 2 : 1,
      w = U32.w;
    for (let i = -s; i <= s; i++) {
      back32[gy * CWd + gx + i] = w;
      back32[(gy + i) * CWd + gx] = w;
    }
  }
  cracksBuf(back32, backCracks, S.teaseKey);
  backG.putImageData(backWork, 0, 0);
  drawChains(backG);
}
