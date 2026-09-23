/**
 * 3x5 bitmap font. Each (text, scale, colours) combination is rasterised once and cached as a canvas.
 */
import { PAL } from '../core/palette.js';

const F3 = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '.###..#..#...##',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '.###..#.##.#.##',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..',
  Q: '.#.#.##.###..##',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.########.#',
  X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
  0: '####.##.##.####',
  1: '.#.##..#..#.###',
  2: '##...#.#.#..###',
  3: '##...#.#...###.',
  4: '#.##.####..#..#',
  5: '####..##...###.',
  6: '.###..####.####',
  7: '###..#.#..#..#.',
  8: '####.#####.####',
  9: '####.####..###.',
  '!': '.#..#..#.....#.',
  '?': '##...#.#.....#.',
  '+': '....#.###.#....',
  '.': '.............#.',
  ':': '....#.....#....',
  '-': '......###......',
  ' ': '...............',
  x: '...#.#.#.#.#...',
  "'": '.#..#..........',
  '/': '..#..#.#.#..#..',
  '>': '#...#...#.#.#..',
};
export const textW = (str, s) => str.length * 4 * s - s;
function glyphs(g, str, x, y, s, colFn) {
  for (let n = 0; n < str.length; n++) {
    const gl = F3[str[n]] || F3['?'];
    for (let i = 0; i < 15; i++)
      if (gl[i] === '#') {
        g.fillStyle = colFn(Math.floor(i / 3), n);
        g.fillRect(x + n * 4 * s + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
      }
  }
}
/* text is rasterised once per (string, scale, colours) and blitted: same pixels, one drawImage instead of hundreds of fillRects */
const TXC = new Map();
export function txCache(key, w, h, paint) {
  let c = TXC.get(key);
  if (c) return c;
  if (TXC.size > 400) TXC.clear();
  c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const x = c.getContext('2d');
  paint(x);
  TXC.set(key, c);
  return c;
}
const OUT10 = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [0, 2],
    [1, 2],
  ],
  OUT8 = OUT10.slice(0, 8);
export function drawText(g, str, x, y, s, col, outline) {
  x = Math.round(x);
  y = Math.round(y);
  const c = PAL[col] || col;
  const cv = txCache('t|' + str + '|' + s + '|' + c + '|' + (outline || ''), textW(str, s) + 2, 5 * s + 3, (t) => {
    if (outline) {
      const o = () => PAL[outline];
      for (const [ox, oy] of OUT10) glyphs(t, str, 1 + ox, 1 + oy, s, o);
    }
    glyphs(t, str, 1, 1, s, () => c);
  });
  g.drawImage(cv, x - 1, y - 1);
}
export function drawRampText(g, str, x, y, s, rampFn) {
  x = Math.round(x);
  y = Math.round(y);
  const o = Math.max(1, s >> 1),
    sh = Math.max(2, s);
  let key = 'r|' + str + '|' + s;
  for (let n = 0; n < str.length; n++) for (let r = 0; r < 5; r++) key += rampFn(r, n);
  const cv = txCache(key, textW(str, s) + 2 * o + 1, 5 * s + Math.max(o, sh) + o, (t) => {
    const k = () => PAL.k;
    for (const [ox, oy] of OUT8) glyphs(t, str, o + ox * o, o + oy * o, s, k);
    glyphs(t, str, o + 1, o + sh, s, k);
    glyphs(t, str, o, o, s, (row, n) => PAL[rampFn(row, n)]);
  });
  g.drawImage(cv, x - o, y - o);
}
