/**
 * Two 3x5 bitmap fonts: Latin (for the court's translations) and the Cyiurkhhn script, 26 glyphs generated once
 * from a fixed seed so every nameplate is written in a consistent alien hand.
 */
import { K } from '../core/palette.js';
import { px, W } from './fb.js';
import { mulberry } from '../core/rng.js';

const F3 = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###',
  F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.#####.##.#', I: '###.#..#..#.###', J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.########.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..', Q: '.#.#.##.###..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.',
  U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.########.#', X: '#.##.#.#.#.##.#', Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###', 0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.',
  4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..####.####', 7: '###..#.#..#..#.', 8: '####.#####.####',
  9: '####.####..###.', '!': '.#..#..#.....#.', '?': '##...#.#.....#.', '+': '....#.###.#....', '.': '.............#.',
  ':': '....#.....#....', '-': '......###......', ' ': '...............', "'": '.#..#..........', '/': '..#..#.#.#..#..',
  ',': '............#.#', '·': '.......#.......', '&': '.#..#...#.#.#.#',
};

/* Cyiurkhhn script: each glyph has a spine (a full column or row) plus 3-5 strokes, mirrored for the vowels. */
const CY = {};
{
  const r = mulberry(0xc41ba5);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const L of letters) {
    const g = Array(15).fill('.');
    const vowel = 'AEIOUY'.includes(L);
    const spine = r.int(0, 3);
    if (vowel) for (let y = 0; y < 5; y++) g[y * 3 + 1] = '#';
    else for (let y = 0; y < 5; y++) g[y * 3 + spine] = '#';
    const strokes = r.int(3, 6);
    for (let i = 0; i < strokes; i++) {
      const x = r.int(0, 3), y = r.int(0, 5);
      g[y * 3 + x] = '#';
      if (vowel) g[y * 3 + (2 - x)] = '#';
    }
    if (r.chance(0.4)) { const y = r.int(0, 5); for (let x = 0; x < 3; x++) g[y * 3 + x] = '#'; }
    CY[L] = g.join('');
  }
}

export const textW = (str) => str.length * 4 - 1;

/** Draw text at pixel (x, y). align: 'l' | 'c' | 'r'. outline: palette index drawn around every glyph pixel. */
export function text(x, y, str, c, o = {}) {
  str = String(str).toUpperCase();
  const w = textW(str);
  if (o.align === 'c') x -= w >> 1; else if (o.align === 'r') x -= w;
  x |= 0; y |= 0;
  const font = o.script ? CY : F3;
  const out = o.outline;
  const skip = o.skipRow;
  for (let pass = out !== undefined ? 0 : 1; pass < 2; pass++)
    for (let n = 0; n < str.length; n++) {
      const ch = str[n];
      const gl = font[ch] || (o.script ? (ch === ' ' ? F3[' '] : F3[ch] || F3['?']) : F3[ch] || F3['?']);
      for (let i = 0; i < 15; i++) {
        if (gl[i] !== '#') continue;
        const gx = x + n * 4 + (i % 3), gy = y + ((i / 3) | 0);
        if (skip !== undefined && (gy & 1) === skip) continue;
        if (pass === 0) { px(gx - 1, gy, out); px(gx + 1, gy, out); px(gx, gy - 1, out); px(gx, gy + 1, out); }
        else px(gx, gy, typeof c === 'function' ? c((i / 3) | 0, n) : c);
      }
    }
  return w;
}
/** Text with a 1px black outline, the default for anything over the scene. */
export const label = (x, y, str, c, o = {}) => text(x, y, str, c, { outline: K, ...o });
export const centreX = W >> 1;
