/**
 * The investiture: a phase machine that summons each treasure down a transit beam, presents it with its
 * nameplate, opens the case, seats it on a rising pedestal, seals the doors, and after the ninth holds the
 * finale before dissolving the collection and beginning again. Also composes every frame in draw order.
 */
import { IB, W, H, bayer, rectD, vline, remap } from '../gfx/fb.js';
import { C1, C2, C3, G2, G3, G4, UP, UP2, DN } from '../core/palette.js';
import { mulberry } from '../core/rng.js';
import { seg, lerp, easeOut, easeInOut, clamp } from '../core/util.js';
import { PRESENT, PLATE_Y, ORDER, slotRect, WIN, SEAL } from '../scene/layout.js';
import { drawSky } from '../scene/sky.js';
import { drawHall } from '../scene/hall.js';
import { drawCabinet, drawDoors, drawReflection, drawTrophy } from '../scene/cabinet.js';
import { TROPHIES, frameOf } from '../scene/trophies.js';
import { FX, stepParticles, drawParticles, clearParticles } from '../fx/particles.js';
import { SFX } from '../audio/chip.js';
import { label } from '../gfx/text.js';
import { view } from '../gfx/screen.js';

export const DUR = { intro: 1.6, summon: 1.8, present: 2.4, open: 0.7, place: 1.1, seal: 0.9, rest: 0.45, finale: 9.5, reset: 3.2 };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const FIRE_COLOURS = [G4, C3, 21, 29, 37, 33];

export const S = {
  t: 0, frame: 0, phase: 'intro', pt: 0, idx: 0, loops: 0,
  placed: new Int8Array(9).fill(-1),
  lamps: new Float32Array(9), lampT: new Float32Array(9), pedestals: new Float32Array(9),
  flash: new Float32Array(9), dissolve: new Float32Array(9).fill(16),
  door: 0, sealPulse: 0, beam: 0,
  float: { vis: false, x: PRESENT.x, y: PRESENT.y, lv: 16, lit: false },
  plate: { a: 0, b: 0, title: null },
  hitstop: 0, flashAll: 0, shake: 0, flick: 0,
  speed: 1, paused: false,
  trophies: TROPHIES,
  rng: mulberry(0x7a0c),
  onPhase: null,
};

const VIG = (() => {
  const idx = [], lv = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const l = clamp((d - 0.7) / 0.5, 0, 1) * 13;
    if (l >= 1) { idx.push(y * W + x); lv.push(Math.round(l)); }
  }
  return { idx: Int32Array.from(idx), lv: Uint8Array.from(lv) };
})();

function setPhase(p) {
  S.phase = p; S.pt = 0;
  if (S.onPhase) S.onPhase(p);
}
export function current() { return TROPHIES[S.idx]; }
const slotOf = (i) => { const [sh, col] = ORDER[i]; return { k: sh * 3 + col, ...slotRect(sh, col) }; };

export function reset() {
  S.t = 0; S.frame = 0; S.idx = 0; S.placed.fill(-1); S.lamps.fill(0); S.lampT.fill(0); S.pedestals.fill(0);
  S.flash.fill(0); S.dissolve.fill(16); S.door = 0; S.sealPulse = 0; S.beam = 0; S.float.vis = false;
  S.hitstop = 0; S.flashAll = 0; S.shake = 0; S.plate.a = S.plate.b = 0; S.plate.title = null;
  clearParticles(); setPhase('intro');
}
/** Jump to the end of the current phase. */
export function skip() {
  if (S.phase === 'place' && !S.landed) land();
  S.pt = DUR[S.phase];
}

let landed = false;
function land() {
  const { k, cx, baseY } = slotOf(S.idx);
  S.placed[k] = S.idx; S.float.vis = false; landed = true; S.landed = true;
  S.pedestals[k] = 1; S.lampT[k] = 1; S.flash[k] = 1; S.flashAll = 0.8; S.shake = 1; S.hitstop = 5;
  const tr = TROPHIES[S.idx];
  FX.ring(cx, baseY - (tr.h >> 1), 2, 22, 0.5, C3);
  FX.ring(cx, baseY - (tr.h >> 1), 1, 12, 0.35, G4);
  FX.sparks(S.rng, cx, baseY, 26);
  FX.dust(S.rng, cx, baseY - 6, 30, C3, 22);
  SFX.land(); SFX.thud();
}

export function update(dt) {
  if (S.paused) return;
  if (S.hitstop > 0) { S.hitstop--; S.frame++; return; }
  S.t += dt; S.pt += dt; S.frame++;
  const r = S.rng, pt = S.pt, dur = DUR[S.phase];
  S.flick = S.flick * 0.8 + (r() - 0.5) * 0.4;
  // decays
  S.flashAll = Math.max(0, S.flashAll - dt * 3.2);
  S.shake = Math.max(0, S.shake - dt * 4);
  S.sealPulse = Math.max(0, S.sealPulse - dt * 1.1);
  for (let k = 0; k < 9; k++) {
    S.flash[k] = Math.max(0, S.flash[k] - dt * 2.2);
    S.lamps[k] += (S.lampT[k] - S.lamps[k]) * Math.min(1, dt * 6);
  }
  const tr = TROPHIES[S.idx];
  switch (S.phase) {
    case 'intro':
      S.plate.title = S.loops === 0 ? ['Hall of Orbits', 'The investiture of the nine treasures'] : ['Hall of Orbits', 'The orbit begins again'];
      if (pt >= dur) { S.plate.title = null; landed = false; S.landed = false; setPhase('summon'); SFX.summon(); }
      break;
    case 'summon': {
      S.beam = seg(pt, 0, 0.3) * (1 - seg(pt, 1.35, 1.8));
      S.float.vis = pt >= 0.3;
      S.float.lv = Math.round(seg(pt, 0.3, 1.25) * 16);
      S.float.x = PRESENT.x;
      S.float.y = Math.round(lerp(PRESENT.y - 64, PRESENT.y, easeOut(seg(pt, 0.3, 1.4))));
      S.float.lit = pt < 1.4;
      if (S.float.vis && pt < 1.4 && (S.frame & 1)) FX.dust(r, S.float.x, S.float.y + r.range(-10, 10), 2, C2, 6);
      if (pt >= dur) { S.beam = 0; S.float.lit = false; S.plate.a = S.plate.b = 0; setPhase('present'); }
      break;
    }
    case 'present': {
      S.float.y = PRESENT.y + Math.round(Math.sin(S.t * 2.6) * 1.5);
      const a = Math.floor(seg(pt, 0.15, 1.0) * tr.name.length), b = Math.floor(seg(pt, 1.05, 1.9) * tr.sub.length);
      if (a > S.plate.a && tr.name[a - 1] !== ' ') SFX.blip(a);
      if (b > S.plate.b && tr.sub[b - 1] !== ' ') SFX.blip(b + 2);
      S.plate.a = a; S.plate.b = b;
      if (pt >= dur) { setPhase('open'); SFX.doors(true); }
      break;
    }
    case 'open':
      S.door = easeInOut(seg(pt, 0, 0.7));
      S.float.y = PRESENT.y + Math.round(Math.sin(S.t * 2.6) * 1.5);
      if (pt >= dur) { S.door = 1; S.p0 = { x: S.float.x, y: S.float.y }; setPhase('place'); }
      break;
    case 'place': {
      const { k, cx, baseY } = slotOf(S.idx);
      const ty = baseY - (tr.h >> 1);
      const u = easeInOut(seg(pt, 0, 0.85));
      const p0 = S.p0, apex = Math.min(p0.y, ty) - 26;
      const mx = (p0.x + cx) / 2;
      // quadratic bezier through an apex above both ends
      const bx = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * mx + u * u * cx;
      const by = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * apex + u * u * ty;
      S.float.x = Math.round(bx); S.float.y = Math.round(by);
      S.pedestals[k] = Math.max(S.pedestals[k], seg(pt, 0.25, 0.75));
      if (S.frame % 2 === 0 && !landed) FX.dust(r, S.float.x, S.float.y + 8, 1, G3, 4);
      if (!landed && pt >= 0.85) land();
      if (pt >= dur) { setPhase('seal'); SFX.doors(false); }
      break;
    }
    case 'seal':
      S.door = 1 - easeInOut(seg(pt, 0, 0.7));
      if (pt >= 0.7 && S.sealPulse === 0 && !S.sealed) { S.sealPulse = 1; S.sealed = true; SFX.seal(); }
      if (pt >= dur) { S.door = 0; S.sealed = false; setPhase('rest'); }
      break;
    case 'rest':
      if (pt >= dur) {
        S.plate.a = S.plate.b = 0; landed = false; S.landed = false;
        if (S.idx + 1 >= TROPHIES.length) { setPhase('finale'); SFX.fanfare(); S.nextFire = 0; }
        else { S.idx++; setPhase('summon'); SFX.summon(); }
      }
      break;
    case 'finale': {
      // the lamps pulse in a wave, confetti falls for the first stretch, fireworks outside the window
      for (let k = 0; k < 9; k++) S.flash[k] = Math.max(S.flash[k], Math.sin(pt * 3 - k * 0.5) > 0.9 ? 0.6 : 0);
      if (pt < 5.5 && S.frame % 3 === 0) FX.confetti(r, 70, 314, 4);
      if (pt >= S.nextFire && pt < 8.4) {
        S.nextFire = pt + r.range(0.22, 0.5);
        FX.firework(r, r.range(WIN.x0 + 10, WIN.x1 - 10), r.range(10, 70), r.int(40, 70), r.pick(FIRE_COLOURS));
        SFX.burst();
      }
      if (Math.floor(pt * 1.4) !== Math.floor((pt - dt) * 1.4)) S.sealPulse = 1;
      S.plate.title = pt < 4.6
        ? ['The nine treasures are seated', 'Long orbit the High Throne of Cyiurkhhn IV']
        : ['Pixel Trophy Case', 'Galactic bespoke edition'];
      if (pt >= dur) { S.plate.title = null; setPhase('reset'); SFX.dissolve(); }
      break;
    }
    case 'reset': {
      S.door = easeInOut(seg(pt, 0, 0.8)) * (1 - easeInOut(seg(pt, 2.4, 3.1)));
      for (let k = 0; k < 9; k++) {
        const t0 = 0.5 + k * 0.14;
        const d = 1 - seg(pt, t0, t0 + 0.9);
        S.dissolve[k] = Math.round(d * 16);
        if (d > 0 && d < 1 && S.placed[k] >= 0 && S.frame % 2 === 0) {
          const sh = Math.floor(k / 3), col = k % 3, sr = slotRect(sh, col);
          FX.rise(r, sr.cx, sr.baseY - 10, 2, r.chance(0.5) ? C3 : G4);
        }
        S.lampT[k] = d > 0.3 ? 1 : 0;
        if (d === 0) { S.placed[k] = -1; S.pedestals[k] = Math.max(0, S.pedestals[k] - dt * 2); }
      }
      if (pt >= dur) {
        S.placed.fill(-1); S.pedestals.fill(0); S.dissolve.fill(16); S.lampT.fill(0); S.door = 0;
        S.idx = 0; S.loops++; setPhase('intro');
      }
      break;
    }
  }
  stepParticles(dt);
}

export function render() {
  const t = S.t, r = S.rng;
  drawSky(t, r, S.phase === 'finale');
  drawParticles(true);
  drawHall(t, S.flick);
  drawCabinet(S, t);
  drawDoors(S.door, t);
  // the summoned treasure and its transit beam
  if (S.beam > 0) {
    const yb = S.float.vis ? S.float.y + 10 : PRESENT.y + 10;
    rectD(PRESENT.x - 7, 0, 15, yb, C1, Math.round(S.beam * 5));
    rectD(PRESENT.x - 3, 0, 7, yb, C2, Math.round(S.beam * 7));
    for (let y = 0; y < yb; y++) if (bayer(PRESENT.x, y + (S.frame >> 1)) < S.beam * 9) IB[y * W + PRESENT.x] = C3;
    vline(PRESENT.x - 7, 0, yb, bayer(1, S.frame) < 6 ? C2 : C1); vline(PRESENT.x + 7, 0, yb, bayer(2, S.frame) < 6 ? C2 : C1);
  }
  if (S.float.vis) {
    const tr = TROPHIES[S.idx];
    const f = frameOf(tr, t, 99);
    drawTrophy(tr, f, S.float.x, S.float.y + (tr.h >> 1), t, 99, 0, S.float.lv, S.float.lit ? UP : undefined);
    if (S.float.lv < 16) for (let i = 0; i < 2; i++) IB[(S.float.y + r.int(-10, 10)) * W + S.float.x + r.int(-7, 7)] = C3;
  }
  drawReflection();
  drawParticles(false);
  // hologram nameplates
  const tr = TROPHIES[S.idx];
  const flicker = (S.frame % 47) < 2 ? (S.frame & 1) : undefined;
  if (S.plate.title) {
    const [a, b] = S.plate.title;
    label(192, PLATE_Y - 10, a, G3, { align: 'c', script: true, skipRow: flicker });
    label(192, PLATE_Y, a, G4, { align: 'c' });
    label(192, PLATE_Y + 10, b, C3, { align: 'c' });
  } else if (S.plate.a > 0 || (S.phase !== 'summon' && S.phase !== 'intro' && S.phase !== 'reset')) {
    const a = tr.name.slice(0, S.plate.a), b = tr.sub.slice(0, S.plate.b);
    label(192, PLATE_Y - 10, a, C2, { align: 'c', script: true, skipRow: flicker });
    label(192, PLATE_Y, a, G4, { align: 'c' });
    if (b) label(192, PLATE_Y + 10, b, C3, { align: 'c' });
    if (S.plate.a > 0 && S.plate.a < tr.name.length && (S.frame & 4)) label(192 + (tr.name.slice(0, S.plate.a).length * 4 >> 1) + 1, PLATE_Y, '_', G4);
  }
  // treasure counter, top right, in Roman numerals for the court's chronicle
  const n = S.phase === 'finale' ? 9 : S.phase === 'reset' || S.phase === 'intro' ? 0 : Math.min(9, S.idx + (S.placed[slotOf(S.idx).k] >= 0 ? 1 : 0));
  label(380, 198, `${n ? ROMAN[n - 1] : '-'} / IX`, G2, { align: 'r' });
  label(4, 198, 'Hall of Orbits', DN[G2]);
  // seal glow in the sky above the pediment when pulsing
  if (S.sealPulse > 0.4) remap(SEAL.x - 20, 0, 41, 10, UP, Math.round((S.sealPulse - 0.4) * 10));
  // full-frame flash and vignette
  if (S.flashAll > 0) remap(0, 0, W, H, S.flashAll > 0.5 ? UP2 : UP, Math.round(S.flashAll * 14));
  for (let i = 0; i < VIG.idx.length; i++) { const p = VIG.idx[i]; if (bayer(p % W, (p / W) | 0) < VIG.lv[i]) IB[p] = DN[IB[p]]; }
  view.shakeX = S.shake > 0 ? Math.round((r() * 2 - 1) * S.shake * 1.5) : 0;
  view.shakeY = S.shake > 0 ? Math.round((r() * 2 - 1) * S.shake) : 0;
}
