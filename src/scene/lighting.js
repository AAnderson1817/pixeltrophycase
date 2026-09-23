/**
 * Per-frame lighting: lights each unit from the torches, the card, the beam and the rays, repaints only units whose
 * quantised colours changed, lights the altar per pixel and draws shock rings over their annulus only.
 */
import { BAYER, PAL, RAMPU, U32 } from '../core/palette.js';
import { TAU, clamp } from '../core/util.js';
import { RAR } from '../data/armor.js';
import { FX } from '../fx/particles.js';
import { H, HY, TORCH, W } from '../game/layout.js';
import { S, tens } from '../game/state.js';
import { g } from '../gfx/canvas.js';
import {
  ALTI,
  BASE32,
  NU,
  OFFI,
  PIXA,
  SCN,
  UALB,
  UHASH,
  UPAL,
  UPIX,
  UST,
  USTART,
  UX,
  UY,
  scene32,
  sceneImg,
  toneF,
} from './scene.js';

// Same light model as before; light is computed per unit once, then pixels only do table lookups. No allocations.
const RF = new Uint32Array(28),
  CL7 = new Uint8Array(40);
for (let i = 0; i < 40; i++) CL7[i] = clamp(i - 16, 0, 6);
const TX = new Float64Array(4),
  TY = new Float64Array(4),
  TI = new Float64Array(4),
  TR2 = new Float64Array(4);
const RG_R = new Float64Array(32),
  RG_W = new Float64Array(32),
  RG_C = new Uint32Array(32);
// light() returns card and warm (torch) light through LV: a double in a module-level let is heap-boxed on each write
const LV = new Float64Array(2);
let INB = false;
export function lightPass(ox, oy) {
  const cx = S.cx,
    cy = S.cy,
    cI = S.cardI,
    cR2 = (30 + 24 * Math.min(cI, 2.2)) ** 2,
    amb = S.amb,
    c = tens();
  const cRamp = RAMPU[S.lightKey] || RAMPU.s,
    rayRamp = S.vr >= 0 ? RAMPU[RAR[S.vr].ramp] : cRamp;
  RF.set(RAMPU.stone, 0);
  RF.set(RAMPU.warm, 7);
  RF.set(cRamp, 14);
  RF.set(rayRamp, 21);
  const nT = Math.min(4, TORCH.length);
  for (let i = 0; i < nT; i++) {
    const t = TORCH[i];
    TX[i] = t.x;
    TY[i] = t.y - 3;
    TI[i] =
      (0.78 + 0.14 * Math.sin(S.t * 13 + i * 2) + 0.07 * Math.sin(S.t * 31 + i) + (Math.random() - 0.5) * 0.05) *
      (1 + S.torchBoost) *
      (1 - 0.45 * c);
    TR2[i] = (26 + 12 * S.torchBoost) ** 2;
  }
  const rays = Math.min(1, S.rays),
    nR = 12,
    per = TAU / nR,
    beam = S.beam,
    useBeam = beam > 0.03,
    bw = 15 + 8 * Math.min(beam, 1),
    rmax = Math.max(W, H) * 0.9,
    rayA = S.rayAng;
  const light = (x, y) => {
    const fy = y >= HY ? 1.7 : 1,
      dyc = (y - cy) * fy,
      dxc = x - cx;
    let lc = (cI * cR2) / (cR2 + dxc * dxc + dyc * dyc),
      lw = 0;
    for (let t = 0; t < nT; t++) {
      const a = x - TX[t],
        b = (y - TY[t]) * fy;
      lw += (TI[t] * TR2[t]) / (TR2[t] + a * a + b * b);
    }
    INB = false;
    if (useBeam && y < cy && Math.abs(dxc) < bw) {
      lc += beam * (1 - Math.abs(dxc) / bw) * 1.1;
      INB = true;
    }
    LV[0] = lc;
    LV[1] = lw;
  };
  const B32 = BASE32,
    V = SCN.VOID32,
    all = SCN.LDIRTY;
  SCN.LDIRTY = false;
  const repaint = (u, o) => {
    const e = USTART[u + 1];
    if (UPAL[o] === 0) {
      for (let k = USTART[u]; k < e; k++) {
        const i = UPIX[k];
        B32[i] = V[i];
      }
    } else {
      for (let k = USTART[u]; k < e; k++) {
        const i = UPIX[k];
        B32[i] = UPAL[o + OFFI[i]];
      }
    }
  };
  for (let u = 0; u < NU; u++) {
    const st = UST[u],
      o = u << 3;
    if (st === 2) {
      if (all || UPAL[o] !== 0) {
        UPAL[o] = UPAL[o + 1] = UPAL[o + 2] = UPAL[o + 3] = UPAL[o + 4] = 0;
        repaint(u, o);
      }
      continue;
    }
    const x = UX[u],
      y = UY[u];
    light(x, y);
    const lc = LV[0],
      lw = LV[1],
      L = amb + lw + lc;
    let lvl = toneF(UALB[u] * L);
    const h = UHASH[u];
    let sel = INB || lc / L > 0.2 + 0.5 * h ? 2 : lw / L > 0.26 + 0.44 * h ? 1 : 0;
    if (rays > 0.02) {
      const a = Math.atan2(y - cy, x - cx) + rayA,
        sec = ((a % per) + per) % per;
      if (sec < 0.17) {
        const d = Math.hypot(x - cx, y - cy),
          iv = rays * (1 - d / rmax);
        if (iv > 0.15 + h * 0.3) {
          lvl += iv > 0.55 ? 2 : 1;
          sel = 3;
        }
      }
    }
    if (lvl > 6) lvl = 6;
    if (st === 1) {
      sel = 3;
      lvl += 2;
    }
    // one colour per OFF value (-4,-2,-1,0,+1 -> slots 0..4); pixels then need a single lookup
    const rb = sel * 7,
      c0 = RF[rb + CL7[lvl + 12]],
      c1 = RF[rb + CL7[lvl + 14]],
      c2 = RF[rb + CL7[lvl + 15]],
      c3 = RF[rb + CL7[lvl + 16]],
      c4 = RF[rb + CL7[lvl + 17]];
    if (all || UPAL[o] !== c0 || UPAL[o + 1] !== c1 || UPAL[o + 2] !== c2 || UPAL[o + 3] !== c3 || UPAL[o + 4] !== c4) {
      UPAL[o] = c0;
      UPAL[o + 1] = c1;
      UPAL[o + 2] = c2;
      UPAL[o + 3] = c3;
      UPAL[o + 4] = c4;
      repaint(u, o);
    }
  }
  const S32 = scene32;
  S32.set(B32);
  const stoneR = RAMPU.stone,
    warmR = RAMPU.warm;
  for (let k = 0; k < ALTI.length; k++) {
    const i = ALTI[k],
      y = (i / W) | 0,
      x = i - y * W;
    light(x, y);
    const lc = LV[0],
      lw = LV[1],
      L = amb + lw + lc,
      l = toneF(PIXA[i] * L),
      b2 = BAYER[((y + 2) & 3) * 4 + ((x + 1) & 3)];
    S32[i] = (lc / L > 0.2 + 0.5 * b2 ? cRamp : lw / L > 0.3 + 0.4 * b2 ? warmR : stoneR)[l];
  }
  // shock rings: only the annulus is visited; later rings first so the earliest ring wins, as before
  let nr = 0;
  for (const r of FX.rings)
    if (r.age > 0 && nr < 32) {
      RG_R[nr] = r.r;
      RG_W[nr] = Math.max(1, Math.round(r.w * (1 - r.age / r.life)));
      RG_C[nr] = U32[r.k];
      nr++;
    }
  for (let q = nr - 1; q >= 0; q--) {
    const R = RG_R[q],
      w = RG_W[q],
      col = RG_C[q],
      ro = R + w,
      rin = R - w;
    const y0 = Math.max(0, Math.floor(cy - ro)),
      y1 = Math.min(H - 1, Math.ceil(cy + ro));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy,
        dy2 = dy * dy,
        xo = Math.sqrt(Math.max(0, ro * ro - dy2)),
        xi = rin > 0 && rin * rin > dy2 ? Math.sqrt(rin * rin - dy2) : -1,
        row = y * W;
      for (let side = 0; side < (xi < 0 ? 1 : 2); side++) {
        let a, b;
        if (xi < 0) {
          a = cx - xo - 1;
          b = cx + xo + 1;
        } else if (side === 0) {
          a = cx - xo - 1;
          b = cx - xi + 1;
        } else {
          a = cx + xi - 1;
          b = cx + xo + 1;
        }
        const xa = Math.max(0, Math.floor(a)),
          xb = Math.min(W - 1, Math.ceil(b));
        for (let x = xa; x <= xb; x++) {
          const dx = x - cx;
          if (Math.abs(Math.sqrt(dx * dx + dy2) - R) < w) S32[row + x] = col;
        }
      }
    }
  }
  if (ox || oy) {
    g.fillStyle = PAL.k;
    g.fillRect(0, 0, W, H);
  }
  g.putImageData(sceneImg, ox, oy);
}
