/**
 * The Hall of Orbits: stone walls with the throne's banners, fluted pillars, torch sconces, the polished
 * perspective floor with its crimson runner, and the three-step dais. Static parts are rasterised once.
 */
import { IB, W, H, bayer, rect, hline, vline, remapDisc, sprite, blit } from '../gfx/fb.js';
import { K, S0, S1, S2, S3, S4, S5, G0, G1, G2, G3, G4, R0, R1, R2, O1, O2, O3, UP, DN, DN2 } from '../core/palette.js';
import { FLOOR_Y, WIN, ARCH } from './layout.js';
import { text } from '../gfx/text.js';
import { mulberry } from '../core/rng.js';

const NONE = 255;
const wallBuf = new Uint8Array(W * FLOOR_Y).fill(NONE);
const floorBuf = new Uint8Array(W * (H - FLOOR_Y));
const SCONCES = [{ x: 43, y: 70 }, { x: 340, y: 70 }];
const PILLARS = [52, 320];
const BANNERS = [12, 349];

const SIGIL = sprite([
  '....k....',
  '...kyk...',
  '..kyYyk..',
  '.kyykyyk.',
  'kyYkkkYyk',
  '.kyykyyk.',
  '..kyYyk..',
  '...kyk...',
  '....k....',
], { k: K, y: G3, Y: G4 });

function brick(x, y) {
  const row = Math.floor(y / 6), col = Math.floor((x + (row & 1) * 6) / 12);
  const mortar = y % 6 === 0 || (x + (row & 1) * 6) % 12 === 0;
  if (mortar) return S0;
  const r = mulberry(row * 1013 + col * 7919 + 17)();
  return r < 0.15 ? S2 : r < 0.3 ? S0 : S1;
}

export function initHall() {
  // walls, with the window cut out
  for (let y = 0; y < FLOOR_Y; y++)
    for (let x = 0; x < W; x++) {
      const inWin = x >= WIN.x0 && x < WIN.x1 && y >= ARCH[x];
      if (inWin) continue;
      let c = brick(x, y);
      // darker toward the outer edges, lighter in the middle band
      const edge = Math.min(x, W - 1 - x);
      if (edge < 40 && bayer(x, y) < (40 - edge) / 2.5) c = DN[c];
      wallBuf[y * W + x] = c;
    }
  // window reveal: a stone surround following the arch, with a gold bead on the inside edge
  for (let x = WIN.x0 - 3; x < WIN.x1 + 3; x++) {
    const inside = x >= WIN.x0 && x < WIN.x1;
    const top = inside ? ARCH[x] : ARCH[x < WIN.x0 ? WIN.x0 : WIN.x1 - 1];
    for (let k = 1; k <= 3; k++) {
      const y = top - k;
      if (y >= 0 && y < FLOOR_Y) wallBuf[y * W + x] = k === 1 ? G1 : k === 2 ? S3 : S2;
    }
    if (!inside) for (let y = top; y < FLOOR_Y; y++) wallBuf[y * W + x] = x < WIN.x0 ? (x === WIN.x0 - 1 ? G1 : x === WIN.x0 - 2 ? S3 : S2) : (x === WIN.x1 ? G1 : x === WIN.x1 + 1 ? S3 : S2);
  }
  // mullions and transom inside the window
  for (const mx of [96, 287]) for (let y = ARCH[mx]; y < FLOOR_Y; y++) { wallBuf[y * W + mx] = S3; wallBuf[y * W + mx + 1] = S1; }
  for (let x = WIN.x0; x < WIN.x1; x++) if (84 >= ARCH[x]) { wallBuf[84 * W + x] = S3; wallBuf[85 * W + x] = S1; }
  // sill
  for (let x = WIN.x0 - 3; x < WIN.x1 + 3; x++) { wallBuf[(FLOOR_Y - 2) * W + x] = S4; wallBuf[(FLOOR_Y - 1) * W + x] = S2; }
  // pillars: fluted shafts, gold-trimmed capitals and bases
  for (const pxl of PILLARS) {
    const flute = [S1, S2, S3, S4, S5, S4, S3, S2, S1, S0, S1, S2];
    for (let y = 8; y < FLOOR_Y - 8; y++) for (let i = 0; i < 12; i++) wallBuf[y * W + pxl + i] = flute[i];
    for (let y = 0; y < 8; y++) for (let x = pxl - 2; x < pxl + 14; x++) wallBuf[y * W + x] = y === 7 ? G1 : y < 2 ? S4 : y === 2 ? G2 : S3;
    for (let y = FLOOR_Y - 8; y < FLOOR_Y; y++) for (let x = pxl - 2; x < pxl + 14; x++) wallBuf[y * W + x] = y === FLOOR_Y - 8 ? G1 : y === FLOOR_Y - 1 ? S1 : S3;
  }
  // banners
  for (const bx of BANNERS) {
    for (let y = 8; y < 100; y++) for (let x = bx; x < bx + 23; x++) {
      const border = x === bx || x === bx + 22;
      let c = border ? R0 : (x + y) % 7 === 0 ? R0 : R1;
      // fold shading down the right third
      if (!border && x > bx + 15 && bayer(x, y) < 8) c = R0;
      if (y >= 92) {
        // v-notch hem with gold fringe
        const d = Math.abs(x - (bx + 11));
        if (y - 92 > 7 - d) c = NONE; else if (y - 92 === 7 - d) c = G2;
      }
      wallBuf[y * W + x] = c;
    }
    for (let x = bx - 2; x < bx + 25; x++) { wallBuf[7 * W + x] = G2; wallBuf[8 * W + x] = G1; }
    for (let y = 2; y < 7; y++) wallBuf[y * W + bx + 11] = G1;
    // sigil and the throne's name in Cyiurkhhn script, one glyph per line
    for (let y = 0; y < SIGIL.h; y++) for (let x = 0; x < SIGIL.w; x++) { const c = SIGIL.d[y * SIGIL.w + x]; if (c >= 0) wallBuf[(14 + y) * W + bx + 7 + x] = c; }
    const word = 'CYIURKHHN';
    for (let i = 0; i < word.length; i++) {
      // rasterise a script glyph into the wall buffer by drawing into IB temporarily
      IB.fill(NONE, 0, 64);
      text(0, 0, word[i], G3, { script: true });
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) { const c = IB[yy * W + xx]; if (c !== NONE) wallBuf[(27 + i * 7 + yy) * W + bx + 10 + xx] = c; }
      IB.fill(K, 0, 64);
    }
    // the banner's lower field carries a thin gold rule
    for (let x = bx + 3; x < bx + 20; x++) wallBuf[90 * W + x] = G1;
  }
  // sconce brackets
  for (const s of SCONCES) {
    for (let y = s.y + 2; y < s.y + 9; y++) wallBuf[y * W + s.x] = y === s.y + 2 ? G2 : G1;
    wallBuf[(s.y + 2) * W + s.x - 1] = G2; wallBuf[(s.y + 2) * W + s.x + 1] = G2;
    wallBuf[(s.y + 1) * W + s.x - 2] = G1; wallBuf[(s.y + 1) * W + s.x + 2] = G1;
    wallBuf[(s.y + 8) * W + s.x] = G2;
  }

  // floor: projective tiles with a crimson runner down the middle
  const vy = 112, Kz = 600, Kx = 600, T = 3;
  for (let y = FLOOR_Y; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fz = Kz / (y - vy), fx = ((x - 192) * fz) / Kx;
      const u = fx / T, v = fz / T;
      const gu = u - Math.floor(u), gv = v - Math.floor(v);
      const grout = gu < 0.12 || gv < 0.12;
      let c;
      const ax = Math.abs(fx);
      if (ax < 8.6) c = grout ? R0 : (Math.floor(u) + Math.floor(v)) & 1 ? R1 : R1;
      else if (ax < 9.6) c = G1;
      else if (ax < 10.2) c = G0;
      else c = grout ? S0 : (Math.floor(u) + Math.floor(v)) & 1 ? S1 : S2;
      if (!grout && ax < 8.6 && (Math.floor(u) + Math.floor(v)) % 3 === 0 && gu > 0.4 && gu < 0.7 && gv > 0.4 && gv < 0.7) c = R2;
      // recede into dark toward the horizon
      const far = Math.max(0, (172 - y) / 22);
      if (far > 0 && bayer(x, y) < far * 16) c = DN[c];
      if (far > 0.6 && bayer(x, y) < (far - 0.6) * 24) c = DN2[c];
      floorBuf[(y - FLOOR_Y) * W + x] = c;
    }
}

const FLAME = [
  sprite(['.F.', 'fOF', 'fFf', '.o.'], { F: O2, f: O3, O: O1, o: O1 }),
  sprite(['F..', 'FfF', 'fFo', '.o.'], { F: O2, f: O3, O: O1, o: O1 }),
  sprite(['..F', 'Ffo', 'fFF', '.o.'], { F: O2, f: O3, O: O1, o: O1 }),
];

export function drawHall(t, flick) {
  // walls
  for (let i = 0; i < wallBuf.length; i++) { const c = wallBuf[i]; if (c !== NONE) IB[i] = c; }
  // floor
  IB.set(floorBuf, FLOOR_Y * W);
  // sconces: flame, halo on the wall and a warm pool on the floor
  SCONCES.forEach((s, i) => {
    const f = FLAME[Math.floor(t * 9 + i * 1.3) % 3];
    const lv = 7 + Math.round(flick * 4);
    remapDisc(s.x, s.y + 2, 18, UP, lv);
    blit(f, s.x - 1, s.y - 3 + (Math.floor(t * 9 + i) % 5 === 0 ? 1 : 0));
  });
  // dais
  const steps = [[118, 146], [112, 150], [106, 154]];
  steps.forEach(([x0, y0], i) => {
    const w = (192 - x0) * 2;
    rect(x0, y0, w, 4, S3);
    hline(x0, x0 + w - 1, y0, S5);
    hline(x0, x0 + w - 1, y0 + 3, S1);
    hline(x0 + 1, x0 + w - 2, y0 + 1, i === 0 ? G2 : S4);
    vline(x0, y0, y0 + 3, S4); vline(x0 + w - 1, y0, y0 + 3, S2);
    // carpet continues over the dais
    rect(x0 + (w >> 1) - 29, y0, 58, 4, R1);
    hline(x0 + (w >> 1) - 29, x0 + (w >> 1) + 28, y0, R2);
    vline(x0 + (w >> 1) - 30, y0, y0 + 3, G1); vline(x0 + (w >> 1) + 29, y0, y0 + 3, G1);
  });
}
