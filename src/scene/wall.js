/**
 * The wall breaking open on a reveal: the void behind it is generated a few rows per frame, bricks detach into
 * physics debris, and the wall rebuilds for the next card.
 */
import { A, buzz } from '../audio/chip.js';
import { RAMPU, U32, bay } from '../core/palette.js';
import { DN } from '../core/perf.js';
import { MOTION, TAU, clamp, mulberry, rnd } from '../core/util.js';
import { RAR } from '../data/armor.js';
import { FX } from '../fx/particles.js';
import { CX, CY, GMAX, HY, NARROW, PBASE, TORCH, W } from '../game/layout.js';
import { S } from '../game/state.js';
import { SCN, UB0X, UB0Y, UDEL, URST, UST, UX, UY, WALLU, scene32, sceneImg, snapG } from './scene.js';

/* the void behind the wall is generated a few rows per frame from the moment the rarity is final, into a spare buffer,
   so the wall break never pays for it in one frame; same noise, same rng order, same pixels */
export function makeVoidJob(r) {
  const rp = RAMPU[RAR[r].ramp],
    rng = mulberry(S.seed * 13 + 5),
    ox = CX,
    oy = CY - 6,
    R0 = Math.round(clamp(Math.min(W, HY) * 0.2, 18, 40)),
    big = Math.max(W, HY);
  const gs = 18,
    gw = Math.ceil(W / gs) + 3,
    gh = Math.ceil(HY / gs) + 3,
    grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const vn = (x, y) => {
    const gx = x / gs,
      gy = y / gs,
      x0 = Math.floor(gx),
      y0 = Math.floor(gy),
      fx = gx - x0,
      fy = gy - y0,
      sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = grid[y0 * gw + x0],
      b = grid[y0 * gw + x0 + 1],
      c = grid[(y0 + 1) * gw + x0],
      d = grid[(y0 + 1) * gw + x0 + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const ridge = new Float32Array(W),
    ridge2 = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    ridge[x] = HY - 6 - (vn(x * 0.6 + 300, 5) * 0.7 + vn(x * 1.7 + 80, 9) * 0.3) * Math.min(34, HY * 0.28);
    ridge2[x] = HY - 3 - (vn(x * 0.9 + 900, 40) * 0.6 + vn(x * 2.6, 70) * 0.4) * Math.min(18, HY * 0.15);
  }
  return {
    r,
    seed: S.seed,
    rp,
    rng,
    vn,
    ox,
    oy,
    R0,
    big,
    ridge,
    ridge2,
    y: 0,
    done: false,
    stars: [],
    buf: SCN.VOIDNEXT,
    W,
    HY,
  };
}
export function voidRows(J, n) {
  if (J.W !== W || J.HY !== HY) return false;
  const { r, rp, rng, vn, ox, oy, R0, big, ridge, ridge2, stars, buf } = J,
    end = Math.min(HY, J.y + n);
  for (let y = J.y; y < end; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - ox,
        dy = y - oy,
        d = Math.hypot(dx, dy),
        b = bay(x, y);
      let col;
      if (y >= ridge2[x]) {
        buf[y * W + x] = y < ridge2[x] + 1 ? rp[2] : U32.k;
        continue;
      }
      if (y >= ridge[x]) {
        buf[y * W + x] = y < ridge[x] + 1 ? rp[3] : b < 0.25 ? rp[1] : U32['0'];
        continue;
      }
      if (d < R0) {
        const sh = (dx + dy * 0.8) / R0;
        let l = Math.floor(5.6 - (sh + 1) * 1.7 + b * 1.3);
        if (d > R0 - 1.2) l = 6;
        col = rp[clamp(l, 2, 6)];
        if (r === 3 && (Math.floor(d) + Math.floor(Math.atan2(dy, dx) * 6)) % 9 === 0 && d < R0 - 3) col = U32.o;
      } else {
        let v = vn(x, y) * 0.55 + vn(x * 2.3 + 40, y * 2.3 + 20) * 0.3;
        v = v * 0.75 + Math.max(0, 1 - d / (big * 0.75)) * 0.5 - 0.08 + Math.pow(y / HY, 1.8) * 0.55;
        const halo = Math.max(0, 1 - (d - R0) / (R0 * 1.1));
        v += halo * halo * 0.55;
        if (r >= 2 && Math.abs(d - R0 * 1.55) < 1.1 && Math.abs(dy) < R0 * 0.5) v += 0.5;
        const l = clamp(Math.floor(v * 4.4 + b - 0.5), 0, 5);
        col = rp[l];
        if (l <= 1 && rng() < 0.014) {
          const k = rng() < 0.3 ? 'w' : rng() < 0.6 ? 'c' : '4';
          col = U32[k];
          stars.push([x, y, rng() * TAU]);
        }
      }
      buf[y * W + x] = col || U32.k;
    } // far-right noise samples fall off the grid (NaN) in the original too; it showed the black ground there
  J.y = end;
  J.done = J.y >= HY;
  return J.done;
}
export let snap32 = null;
/** layout() rebuilt the scene for a new size: the old snapshot no longer matches it (startWallBreak takes a new one). */
export function resetWallSnap() {
  snap32 = null;
}
export function startWallBreak(r) {
  const B = S.wall;
  if (
    !SCN.voidJob ||
    SCN.voidJob.r !== r ||
    SCN.voidJob.seed !== S.seed ||
    SCN.voidJob.W !== W ||
    SCN.voidJob.HY !== HY
  )
    SCN.voidJob = makeVoidJob(r);
  voidRows(SCN.voidJob, 1e9);
  const old = SCN.VOID32;
  SCN.VOID32 = SCN.voidJob.buf;
  SCN.VOIDNEXT = old;
  SCN.VOIDSTARS = SCN.voidJob.stars;
  SCN.voidJob = null;
  SCN.LDIRTY = true;
  B.active = true;
  B.rebuild = false;
  B.t = 0;
  B.r = r;
  snapG.putImageData(sceneImg, 0, 0);
  if (!snap32 || snap32.length !== scene32.length) snap32 = new Uint32Array(scene32.length);
  snap32.set(scene32);
  const reach = r === 3 ? 1e9 : [0.42, 0.56, 0.76][r] * Math.max(W, HY);
  for (const u of WALLU) {
    const prot = TORCH.some(
      (t) => Math.hypot(UX[u] - t.x, UY[u] - (t.y + 4)) < 11 || (Math.abs(UX[u] - t.x) < 8 && UY[u] > t.y),
    );
    const d = Math.hypot(UX[u] - CX, (UY[u] - CY) * 1.1);
    UDEL[u] = !prot && d <= reach ? 0.25 + d / (NARROW ? 150 : 230) + Math.random() * 0.18 : Infinity;
  }
  A.rumble(r);
  S.trauma = Math.min(1, S.trauma + 0.35);
  S.zoom.v += 0.5 * MOTION;
  buzz([30, 20, 60]);
}
function brickGround(x) {
  const lo = Math.min(GMAX - 1, HY + 2),
    hi = Math.max(lo + 1, Math.min(GMAX, HY + (GMAX - HY) * 0.55));
  return Math.abs(x - CX) < 34 ? rnd(Math.min(GMAX - 1, PBASE + 1), Math.min(GMAX, PBASE + 9)) : rnd(lo, hi);
}
export function dustAt(x, y, n, up) {
  for (let i = 0; i < n; i++)
    FX.dustp.push({
      x: x + rnd(-3, 3),
      y: y + rnd(-2, 2),
      vx: rnd(-18, 18),
      vy: -rnd(up ? 10 : 2, up ? 40 : 14),
      age: 0,
      life: rnd(0.4, 1),
    });
}
function detach(u) {
  const x0 = UB0X[u],
    y0 = UB0Y[u],
    sx = Math.max(0, x0),
    sy = Math.max(0, y0),
    sw = Math.min(x0 + 14, W) - sx,
    sh = Math.min(y0 + 7, HY) - sy;
  if (sw <= 0 || sh <= 0) return;
  const cx = sx + sw / 2,
    cy = sy + sh / 2,
    dx = cx - CX,
    dy = cy - S.cy,
    d = Math.hypot(dx, dy) || 1;
  if (FX.bricks.length < Math.round((NARROW ? 200 : 380) * DN()) && !(cy < HY * 0.3 && Math.random() < 0.45))
    FX.bricks.push({
      sx,
      sy,
      w: sw,
      h: sh,
      x: cx,
      y: cy,
      vx: (dx / d) * rnd(15, 70) + rnd(-20, 20),
      vy: -rnd(0, 60) * (dy < 0 ? 0.4 : 1),
      rot: 0,
      vr: rnd(-6, 6),
      g: brickGround(cx),
      age: 0,
      life: rnd(3.5, 5.5),
      rest: false,
    });
  if (Math.random() < 0.5) dustAt(cx, cy, 2, false);
}
export function wallStep(rdt) {
  const B = S.wall;
  if (!B.active) return;
  if (!B.rebuild) {
    B.t += rdt;
    let pending = 0;
    for (const u of WALLU) {
      const del = UDEL[u];
      if (del === Infinity) continue;
      const st = UST[u];
      if (st === 0 && B.t >= del - 0.14) UST[u] = 1;
      else if (st === 1 && B.t >= del) {
        UST[u] = 2;
        detach(u);
      }
      if (UST[u] < 2) pending++;
    }
    if (pending > 0) S.trauma = Math.max(S.trauma, 0.24 * MOTION);
  } else {
    B.rt += rdt;
    let left = 0;
    for (const u of WALLU) {
      if (!UST[u]) continue;
      if (B.rt >= URST[u]) {
        UST[u] = 0;
        UDEL[u] = Infinity;
        if (Math.random() < 0.3) dustAt(UX[u], UY[u], 1, true);
        if (Math.random() < 0.05) A.blip();
      } else left++;
    }
    if (!left) {
      B.active = false;
      B.rebuild = false;
    }
  }
}
export function wallRebuild() {
  const B = S.wall;
  if (!B.active) return;
  B.rebuild = true;
  B.rt = 0;
  const md = Math.max(W, HY) * 0.8;
  for (const u of WALLU) {
    UDEL[u] = Infinity;
    if (UST[u]) {
      const d = Math.hypot(UX[u] - CX, UY[u] - CY);
      URST[u] = 0.08 + (1 - Math.min(1, d / md)) * 0.7 + Math.random() * 0.1;
    }
  }
  FX.bricks.forEach((b) => {
    b.life = Math.min(b.life, b.age + rnd(0.15, 0.5));
  });
  A.rebuild();
}
