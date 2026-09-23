/**
 * Math and timing helpers shared by every system: random ranges, the seeded mulberry32 RNG, the reduced-motion flag and later().
 */
export const TAU = Math.PI * 2,
  $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp = (a, b, t) => a + (b - a) * t,
  rnd = (a, b) => a + Math.random() * (b - a),
  ri = (a, b) => Math.floor(rnd(a, b + 1));
export function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches,
  MOTION = reduce ? 0.3 : 1;
export const later = (ms, f) => setTimeout(f, ms);
