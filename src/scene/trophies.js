/**
 * The nine treasures of the High Throne, as 13x20 pixel sprites with animation: palette pulses, hand-drawn frames,
 * a procedurally spun gimbal and a levitating shard. Names carry a Cyiurkhhn script line and the court's translation.
 */
import { sprite, mapSprite } from '../gfx/fb.js';
import {
  K, G0, G1, G2, G3, G4, C0, C1, C2, C3, V0, V1, V2, V3, R0, R1, R2, R3, O0, O1, O2, O3,
  S1, S2, S3, S4, S5, W, WW, E0, E1, E2, E3, UP, ID, N,
} from '../core/palette.js';

const L = {
  k: K, D: G0, G: G1, g: G2, y: G3, Y: G4,
  C: C0, c: C1, t: C2, T: C3,
  V: V0, v: V1, m: V2, M: V3,
  R: R0, r: R1, p: R2, P: R3,
  O: O0, o: O1, F: O2, f: O3,
  S: S1, s: S2, h: S3, H: S4, w: S5, W: W, X: WW,
  E: E0, e: E1, n: E2, N: E3,
};
/** Remap that lifts only the listed indices one ramp step. */
function lift(idx, to) {
  const m = new Uint8Array(N); m.set(ID);
  for (let i = 0; i < idx.length; i++) m[idx[i]] = to ? to[i] : UP[idx[i]];
  return m;
}

const EMBER = [
  '.....kkk.....',
  '...kkFffkk...',
  '..kFfXfFook..',
  '.kFffffFoook.',
  '.kffFFFFoook.',
  'kFfFFFFooOOok',
  'kFFFFFooOOOok',
  'kFFFooooOOOok',
  '.kFooOOOOOok.',
  '.kooOOOOOOok.',
  '..kooOOOOk...',
  '...kkOOkk....',
  '..kG.kkk.Gk..',
  '.kGy.kyk.yGk.',
  '.kG..kyk..Gk.',
  'kGy.kGyGk.yGk',
  'kGGkGyyyGkGGk',
  '.kkGGGGGGGkk.',
  '..kGyyyyyGk..',
  '..kkkkkkkkk..',
];
const CROWN = [
  '.............',
  '.............',
  '.............',
  'k...k.k.k...k',
  'kTk.kTkTk.kTk',
  'kyk.kyyyk.kyk',
  'kyykkyyykkyyk',
  'kYyyyyyyyyyGk',
  'kyyyyyyyyyyGk',
  'kyCtyyCtyyCtk',
  'kytTyytTyytTk',
  'kyyyyyyyyyyGk',
  'kGGGGGGGGGGGk',
  '.kkkkkkkkkkk.',
  '..kRrrrrrrRk.',
  '.krrrPrrrPrrk',
  '.kRrrrrrrrrRk',
  '..kRRRRRRRRk.',
  '...kkkkkkkk..',
  '.............',
];
const CHALICE = [
  '.kkkkkkkkkkk.',
  'kHwwWwwwwwhhk',
  'kHwwwwwwwwhhk',
  'kHCtTtCtTtChk',
  'kHwwwwwwwwhhk',
  '.kHwwwwwwhhk.',
  '.kHwwwwwwhhk.',
  '.kHHwwwwHhhk.',
  '..kHHwwHHhk..',
  '...kHHHHhk...',
  '....kHhhk....',
  '.....kHk.....',
  '.....kHk.....',
  '....kGyGk....',
  '.....kHk.....',
  '.....kHk.....',
  '....kkHkk....',
  '...kHHhhhk...',
  '..kHwHHhhhk..',
  '..kkkkkkkkk..',
];
const COMET = [
  '....kkkkk....',
  '....kGyyGk...',
  '....kGGGGk...',
  '.....kHHk....',
  '.....kHhk....',
  '...kkkHhkkk..',
  '..kHOOOOOOOhk',
  '.kHOXTOOOOOOk',
  '.kHOTtOOoOOOk',
  '.kHOOtcOOOOOk',
  '.kHOOOtcOOOOk',
  '.kHOOoOtcOOOk',
  '.kHOOOOOcCOOk',
  '.kHOOOOOOCOOk',
  '.kHOOoOOOOCOk',
  '.kHOOOOOOOOOk',
  '.kHhOOOOOOOhk',
  '..kHhOOOOOhk.',
  '...kkHHHHkk..',
  '....kkkkkk...',
];
const COMET2 = COMET.map((r, i) => (i >= 8 && i <= 14 ? r.replace(/t/g, '§').replace(/c/g, 't').replace(/§/g, 'T').replace(/C/g, 'c') : r));
const SCEPTER_BASE = [
  '.....kkk.....',
  '....kVmMk....',
  '...kVvmMMvk..',
  '...kVvvmMvk..',
  '....kVvvvk...',
  '.....kGyk....',
  '....kGyyGk...',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '.....kyGk....',
  '....kGyyGk...',
  '...kkGyyGkk..',
  '..kHHhhhhhhk.',
  '..kkkkkkkkkk.',
];
const RING = ['..kkkkyGkkkk.', '.kG.kkyGkk.Gk', '..kkkkyGkkkk.'];
function scepterFrame(top) {
  const rows = SCEPTER_BASE.slice();
  for (let i = 0; i < 3; i++) rows[top + i] = RING[i];
  return rows;
}
const SHARD = [
  '......kk.....',
  '.....kWXk....',
  '.....kWwXk...',
  '....kWwwHk...',
  '....kWwwHhk..',
  '...kWWwwHhk..',
  '...kWwtwHhk..',
  '..kWWwtTwhhk.',
  '..kWwwtwwhhk.',
  '..kWwwwHHhhk.',
  '...kwwwHhhk..',
  '...kwwHHhhk..',
  '....kwHhhk...',
  '.....kHhk....',
  '......kk.....',
  '.............',
  '...kkkkkkk...',
  '..kSsssssSk..',
  '..kSSSSSSSSk.',
  '...kkkkkkkk..',
];
const ASTRO_BASE = [
  '....kkkkk....',
  '..kkGyyyGkk..',
  '.kGy.....yGk.',
  'kGy..kkk..yGk',
  'kG..kcTck..Gk',
  'kG..kctck..Gk',
  'kG..kCcck..Gk',
  'kGy..kkk..yGk',
  '.kGy.....yGk.',
  '..kkGyyyGkk..',
  '....kkkkk....',
  '.....kGk.....',
  '.....kGk.....',
  '....kGyGk....',
  '...kGGyGGk...',
  '..kkkkkkkkk..',
  '.kSsssssssSk.',
  '.kSSSSSSSSSk.',
  '.kkkkkkkkkkk.',
  '.............',
];
function astroFrame(hw) {
  // an inner gimbal ring, a vertical ellipse whose width changes as it turns
  const rows = ASTRO_BASE.map((r) => r.split(''));
  const cx = 6, cy = 5, ry = 4;
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    const x = Math.round(cx + Math.cos(a) * hw), y = Math.round(cy + Math.sin(a) * ry);
    if (y < 0 || y > 10 || x < 0 || x > 12) continue;
    const front = Math.cos(a) >= -0.05;
    const ch = rows[y][x];
    if (ch === '.' || ch === 'k' || front) rows[y][x] = front ? 'g' : 'D';
  }
  return rows.map((r) => r.join(''));
}
const HEART = [
  '.............',
  '....kkkkk....',
  '...kVvvvVk...',
  '..kVvmMmvVk..',
  '.kVvmMMMmvVk.',
  '.kVvmMMMmvVk.',
  '.kVVvmMmvVVk.',
  '..kVVvmvVVk..',
  '...kVVvVVk...',
  '....kVVVk....',
  '.....kVk.....',
  '..kG..k..Gk..',
  '..kGk.k.kGk..',
  '...kGkkkGk...',
  '....kGyGk....',
  '.....kGk.....',
  '....kGyGk....',
  '...kkGyGkk...',
  '..kSssssssSk.',
  '..kkkkkkkkkk.',
];
const LAUREL = [
  '.....kkk.....',
  '....kRrRk....',
  '...kRr.rRk...',
  '..kRr.k.rRk..',
  '..kkknkNkkk..',
  '.knNenkenNnk.',
  'kneEkGyyGkEnk',
  'kNekGyyYyGkek',
  'kneGyyYXYyGek',
  'kNekGyyYyGkek',
  'kneEkGyyGkEnk',
  '.knNenkenNnk.',
  '..kkknkNkkk..',
  '...kkkkkkk...',
  '.....kkk.....',
  '....kGyGk....',
  '...kkGyGkk...',
  '..kSssssssSk.',
  '..kSSSSSSSSk.',
  '..kkkkkkkkkk.',
];

const mk = (rows) => sprite(rows, L);

export const TROPHIES = [
  {
    id: 'ember', name: 'Ember of the First Sun', sub: 'A coal from the dawn of Khhn',
    frames: [mk(EMBER)], fps: 0, pulse: { map: lift([O2, O3, O1]), period: 0.9 },
  },
  {
    id: 'crown', name: 'Crown of the Nine Tides', sub: 'Worn by the drowned queens',
    frames: [mk(CROWN)], fps: 0, pulse: { map: lift([C2, C3], [C3, WW]), period: 1.7 },
  },
  {
    id: 'chalice', name: 'Chalice of Vhaal', sub: 'Never emptied. Never filled.',
    frames: [mk(CHALICE)], fps: 0, pulse: { map: lift([C2, C3], [C3, WW]), period: 1.3 },
  },
  {
    id: 'comet', name: 'The Comet in Amber', sub: 'Caught on its 400th return',
    frames: [mk(COMET), mk(COMET2)], fps: 3, pulse: { map: lift([C3], [WW]), period: 0.5 },
  },
  {
    id: 'scepter', name: 'Scepter of the Quiet Orbit', sub: 'It has never been raised',
    frames: [8, 9, 10, 11, 12, 11, 10, 9].map((top) => mk(scepterFrame(top))), fps: 6,
    pulse: { map: lift([V2, V3]), period: 2.1 },
  },
  {
    id: 'shard', name: 'Shard of the Broken Moon', sub: 'All that remains of Yssir',
    frames: [mk(SHARD)], fps: 0, hover: { rows: [0, 15], amp: 1.6, period: 2.6 },
    pulse: { map: lift([C2, C3], [C3, WW]), period: 1.1 },
  },
  {
    id: 'astrolabe', name: 'Astrolabe of Khhn', sub: 'It still finds home',
    frames: [1, 2, 3, 4, 3, 2].map((hw) => mk(astroFrame(hw))), fps: 5,
    pulse: { map: lift([C3], [WW]), period: 0.8 },
  },
  {
    id: 'heart', name: 'Heart of a Dead Star', sub: 'Cold. Still beating.',
    frames: [mk(HEART)], fps: 0, pulse: { map: lift([V3, V2, V1], [R3, R2, R1]), period: 1.9, duty: 0.18 },
  },
  {
    id: 'laurel', name: 'The Grand Laurel', sub: 'For the High Throne of Cyiurkhhn IV',
    frames: [mk(LAUREL)], fps: 0, pulse: { map: lift([G3, G4, E2], [G4, WW, E3]), period: 1.5 },
  },
];
for (const t of TROPHIES) {
  t.lit = t.frames.map((f) => mapSprite(f, t.pulse.map));
  t.w = t.frames[0].w; t.h = t.frames[0].h;
}

/** Pick the frame and lit variant for time t (seconds). */
export function frameOf(t, time, phaseOffset = 0) {
  const i = t.fps ? Math.floor(time * t.fps + phaseOffset) % t.frames.length : 0;
  const ph = ((time + phaseOffset * 0.37) % t.pulse.period) / t.pulse.period;
  const duty = t.pulse.duty !== undefined ? t.pulse.duty : 0.45;
  return ph < duty ? t.lit[i] : t.frames[i];
}
