/**
 * Fixed 38-colour palette. Everything on screen is a palette index; the framebuffer stores indices and is
 * converted to RGBA once per frame. Ramps give each index a brighter (UP) and darker (DN) neighbour so lighting
 * is a lookup, never a blend.
 */
export const HEX = [
  '#07060f', // 0  K   void
  '#0c0a1e', // 1  N0  deep space
  '#151a3c', // 2  N1
  '#223060', // 3  N2
  '#1a1626', // 4  S0  obsidian
  '#2a2440', // 5  S1
  '#3d3760', // 6  S2
  '#585484', // 7  S3
  '#7f7cab', // 8  S4
  '#b4b2d4', // 9  S5  silver
  '#ece9f8', // 10 W   near white
  '#ffffff', // 11 WW  white
  '#4a2a0a', // 12 G0  gold
  '#8a5a14', // 13 G1
  '#c9961e', // 14 G2
  '#f2cf4a', // 15 G3
  '#fff2a8', // 16 G4
  '#3a0b1e', // 17 R0  crimson
  '#7a1538', // 18 R1
  '#b8274f', // 19 R2
  '#e8557a', // 20 R3
  '#ffa0c0', // 21 R4
  '#0e3a4a', // 22 C0  teal
  '#1a7a8a', // 23 C1
  '#3ec4d4', // 24 C2
  '#b8f4ff', // 25 C3
  '#2a1548', // 26 V0  violet
  '#4a2a7a', // 27 V1
  '#7a4ab8', // 28 V2
  '#b88aea', // 29 V3
  '#7a2410', // 30 O0  ember
  '#c04a10', // 31 O1
  '#ff8a2a', // 32 O2
  '#ffd080', // 33 O3
  '#0f3a24', // 34 E0  green
  '#1f6a3a', // 35 E1
  '#4ab86a', // 36 E2
  '#b8f0a8', // 37 E3
];
export const N = HEX.length;
export const K = 0, N0 = 1, N1 = 2, N2 = 3;
export const S0 = 4, S1 = 5, S2 = 6, S3 = 7, S4 = 8, S5 = 9, W = 10, WW = 11;
export const G0 = 12, G1 = 13, G2 = 14, G3 = 15, G4 = 16;
export const R0 = 17, R1 = 18, R2 = 19, R3 = 20, R4 = 21;
export const C0 = 22, C1 = 23, C2 = 24, C3 = 25;
export const V0 = 26, V1 = 27, V2 = 28, V3 = 29;
export const O0 = 30, O1 = 31, O2 = 32, O3 = 33;
export const E0 = 34, E1 = 35, E2 = 36, E3 = 37;

/** ABGR32 for little-endian ImageData writes. */
export const U32 = new Uint32Array(N);
for (let i = 0; i < N; i++) {
  const v = parseInt(HEX[i].slice(1), 16);
  U32[i] = (0xff << 24) | ((v & 0xff) << 16) | (v & 0xff00) | (v >>> 16);
}
/** Perceived luminance 0..255, used by the bloom threshold. */
export const LUM = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const v = parseInt(HEX[i].slice(1), 16);
  LUM[i] = Math.round(0.2126 * (v >>> 16) + 0.7152 * ((v >>> 8) & 0xff) + 0.0722 * (v & 0xff));
}

const RAMPS = [
  [K, N0, N1, N2, S3, S4, S5, W, WW],
  [K, S0, S1, S2, S3, S4, S5, W, WW],
  [K, G0, G1, G2, G3, G4, WW],
  [K, R0, R1, R2, R3, R4, WW],
  [K, C0, C1, C2, C3, WW],
  [K, V0, V1, V2, V3, WW],
  [K, O0, O1, O2, O3, WW],
  [K, E0, E1, E2, E3, WW],
];
export const UP = new Uint8Array(N);
export const DN = new Uint8Array(N);
export const ID = new Uint8Array(N);
for (let i = 0; i < N; i++) { UP[i] = i; DN[i] = i; ID[i] = i; }
const seen = new Set();
for (const r of RAMPS)
  for (let j = 0; j < r.length; j++) {
    const c = r[j];
    if (seen.has(c)) continue;
    seen.add(c);
    UP[c] = r[Math.min(j + 1, r.length - 1)];
    DN[c] = r[Math.max(j - 1, 0)];
  }
export const UP2 = UP.map((c) => UP[c]);
export const DN2 = DN.map((c) => DN[c]);
/** Compose remaps: out[i] = b[a[i]]. */
export const compose = (a, b) => a.map((c) => b[c]);
/** A remap that sends listed indices to one colour (silhouettes, holograms). */
export function solid(c) { const m = new Uint8Array(N); m.fill(c); return m; }
/** Hologram remap: every colour becomes the teal of the same brightness. */
export const HOLO = (() => {
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const l = LUM[i];
    m[i] = l < 60 ? C0 : l < 110 ? C1 : l < 170 ? C2 : l < 230 ? C3 : WW;
  }
  m[K] = K;
  return m;
})();
