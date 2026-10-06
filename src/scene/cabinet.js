/**
 * The trophy case itself: obsidian carcass with gold filigree, crimson velvet back, three shelves of three
 * pedestals, shelf lamps with dithered light cones, sliding crystal doors and the royal seal in the pediment.
 * Also paints the case's reflection into the polished floor.
 */
import { IB, W, bayer, rect, hline, vline, px, remap, circle, disc, blit, frame } from '../gfx/fb.js';
import { S0, S1, S2, S3, S4, G0, G1, G2, G3, G4, R0, R1, R2, C2, C3, WW, UP, UP2, DN2 } from '../core/palette.js';
import { CAB, SHELVES, SLOT_X, PEDESTAL_H, SEAL, slotRect } from './layout.js';
import { frameOf } from './trophies.js';

const IW = CAB.ix1 - CAB.ix0; // 120
const DOOR_W = IW / 2;

/** Light cone coverage (0..16) per slot, precomputed over the compartment. */
const cones = SHELVES.map((s) =>
  SLOT_X.map((cx) => {
    const h = s.board - s.top;
    const m = new Uint8Array(40 * h);
    for (let y = 0; y < h; y++) {
      const hw = 2.5 + y * 0.42;
      for (let x = 0; x < 40; x++) {
        const dx = Math.abs(x + cx - 20 + 0.5 - cx);
        const lv = dx > hw ? 0 : (1 - dx / hw) * (14 - y * 0.12);
        m[y * 40 + x] = Math.max(0, Math.round(lv));
      }
    }
    return m;
  }),
);

/** Quilted velvet: a faint diamond lattice of seams with a stud at each crossing. */
function velvet(x, y) {
  const a = (x + y) % 12 === 0, b = (x - y + 1200) % 12 === 0;
  if (a && b) return R0;
  if ((a || b) && bayer(x, y) < 6) return R0;
  return R1;
}

/**
 * state: { placed: Set of 'shelf,col', lamps: Float32Array[9] 0..1, pedestals: Float32Array[9] 0..1,
 *          door: 0..1 open, sealPulse: 0..1, time }
 */
export function drawCabinet(st, time) {
  const { x0, x1, y0, y1, ix0, ix1, iy0, iy1 } = CAB;
  // carcass
  rect(x0, y0, x1 - x0, y1 - y0, S1);
  frame(x0, y0, x1 - x0, y1 - y0, S0);
  frame(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2, G1);
  frame(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4, S2);
  // filigree studs along the stiles
  for (let y = y0 + 6; y < y1 - 4; y += 6) { px(x0 + 4, y, G2); px(x1 - 5, y, G2); px(x0 + 4, y + 1, G0); px(x1 - 5, y + 1, G0); }
  // velvet back
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) IB[y * W + x] = velvet(x, y);
  // lamp cones on the velvet
  SHELVES.forEach((s, si) => {
    const h = s.board - s.top;
    SLOT_X.forEach((cx, ci) => {
      const L = st.lamps[si * 3 + ci];
      if (L <= 0) return;
      const m = cones[si][ci];
      for (let y = 0; y < h; y++) {
        const yy = s.top + y, row = yy * W;
        for (let x = 0; x < 40; x++) {
          const lv = m[y * 40 + x] * L;
          if (lv <= 0) continue;
          const xx = cx - 20 + x;
          if (xx < ix0 || xx >= ix1) continue;
          const b = bayer(xx, yy);
          if (b < lv) IB[row + xx] = UP[IB[row + xx]];
          if (b < lv - 9) IB[row + xx] = UP[IB[row + xx]];
        }
      }
    });
  });
  // shelves, lamps, plaques, pedestals, trophies
  SHELVES.forEach((s, si) => {
    // ceiling lamp strip for this compartment
    SLOT_X.forEach((cx, ci) => {
      const L = st.lamps[si * 3 + ci];
      hline(cx - 3, cx + 3, s.top, L > 0 ? G2 : S2);
      px(cx, s.top + 1, L > 0.5 ? G4 : L > 0 ? G3 : S3);
      if (L > 0.5) { px(cx - 1, s.top + 1, G3); px(cx + 1, s.top + 1, G3); }
    });
    // board
    rect(ix0, s.board, IW, 2, S2);
    hline(ix0, ix1 - 1, s.board, G1);
    hline(ix0, ix1 - 1, s.board + 1, S0);
    SLOT_X.forEach((cx, ci) => {
      const k = si * 3 + ci;
      const ped = st.pedestals[k];
      if (ped > 0) {
        const ph = Math.round(ped * PEDESTAL_H);
        const top = s.board - ph;
        rect(cx - 5, top, 11, ph, G1);
        hline(cx - 5, cx + 5, top, G3);
        hline(cx - 4, cx + 4, s.board - 1, G0);
        px(cx - 5, top, G2); px(cx + 5, top, G2);
      }
      // plaque below the board edge
      hline(cx - 5, cx + 5, s.board + 1, G2);
      const id = st.placed[k];
      if (id !== undefined && id >= 0) {
        const tr = st.trophies[id];
        const f = frameOf(tr, time, k);
        const { baseY } = slotRect(si, ci);
        drawTrophy(tr, f, cx, baseY, time, k, st.flash[k], st.dissolve[k]);
      }
    });
  });
  // pediment and seal
  const sx = SEAL.x, sy = SEAL.y;
  for (let i = 0; i < 12; i++) hline(x0 + 2 + i * 5, x1 - 3 - i * 5, y0 - 1 - i, i === 11 ? G2 : i === 0 ? G1 : S1);
  for (let i = 1; i < 11; i++) { px(x0 + 2 + i * 5, y0 - 1 - i, G1); px(x1 - 3 - i * 5, y0 - 1 - i, G1); }
  hline(x0 + 2, x1 - 3, y0 - 1, G2);
  const pulse = st.sealPulse;
  disc(sx, sy, 7, pulse > 0.5 ? R2 : R1);
  circle(sx, sy, 7, pulse > 0 ? G4 : G2);
  circle(sx, sy, 8, G0);
  circle(sx, sy, 3, pulse > 0.3 ? C3 : C2);
  px(sx, sy, WW); px(sx, sy - 5, G3); px(sx, sy + 5, G3); px(sx - 5, sy, G3); px(sx + 5, sy, G3);
  if (pulse > 0) remap(sx - 12, sy - 12, 25, 25, UP, Math.round(pulse * 10));
  // finials on the corners
  for (const fx of [x0 + 1, x1 - 2]) { vline(fx, y0 - 4, y0 - 1, G1); px(fx, y0 - 5, G3); }
}

export function drawTrophy(tr, f, cx, baseY, time, k, flash, lv = 16, map) {
  const x = cx - (f.w >> 1);
  const y = baseY - f.h;
  if (!map) map = flash > 0.5 ? UP2 : flash > 0 ? UP : undefined;
  if (tr.hover) {
    const dy = Math.round(Math.sin((time / tr.hover.period + k * 0.3) * Math.PI * 2) * tr.hover.amp) - 1;
    blit(f, x, y, { rows: [tr.hover.rows[1], f.h], map, lv });
    blit(f, x, y + dy, { rows: tr.hover.rows, map, lv });
    return;
  }
  blit(f, x, y, { map, lv });
}

/** The two crystal doors; open is 0..1. Drawn after trophies so they sit in front. */
export function drawDoors(open, time) {
  const { ix0, ix1, iy0, iy1 } = CAB;
  const h = iy1 - iy0;
  const off = Math.round(open * (DOOR_W - 2));
  const panes = [
    [ix0, ix0 + DOOR_W - off],
    [ix0 + DOOR_W + off, ix1],
  ];
  const glint = ((time * 28) % (IW + h + 60)) - 30;
  panes.forEach(([a, b], i) => {
    if (b <= a) return;
    // haze: a light lift, stronger along the top where the hall's lamps catch the glass, a cool tint on a few pixels
    remap(a, iy0, b - a, 10, UP, 5);
    remap(a, iy0 + 10, b - a, h - 10, UP, 2);
    for (let y = iy0; y < iy1; y++) for (let x = a; x < b; x++) {
      if (bayer(x, y) === 0 && ((x >> 2) + (y >> 2)) % 3 === 0) IB[y * W + x] = UP2[IB[y * W + x]];
      // moving diagonal glint
      const d = x - ix0 + (y - iy0) - glint;
      if (d === 0 || d === 1 || d === 8) IB[y * W + x] = bayer(x, y) < 11 ? C3 : UP[IB[y * W + x]];
    }
    // frame and handle
    const edgeX = i === 0 ? b - 1 : a;
    vline(edgeX, iy0, iy1 - 1, S4);
    vline(i === 0 ? a : b - 1, iy0, iy1 - 1, S3);
    const hx = i === 0 ? b - 3 : a + 2;
    vline(hx, iy0 + 52, iy0 + 57, G3); px(hx, iy0 + 52, G4);
    // corner sparkle
    px(i === 0 ? a + 1 : b - 2, iy0 + 1, C3);
  });
  // door track at top and bottom
  hline(ix0, ix1 - 1, iy0 - 1, S3);
  hline(ix0, ix1 - 1, iy1, S3);
}

/** Reflect the lower part of the case into the polished floor below the dais. */
export function drawReflection() {
  const { x0, x1 } = CAB;
  for (let yr = 158; yr < 216; yr++) {
    const ys = 304 - yr;
    if (ys < CAB.y0 - 12) break;
    const row = yr * W, srow = ys * W;
    for (let x = x0 - 6; x < x1 + 6; x++) {
      const b = bayer(x, yr);
      if (b >= 7) continue;
      IB[row + x] = DN2[IB[srow + x]];
    }
  }
}
