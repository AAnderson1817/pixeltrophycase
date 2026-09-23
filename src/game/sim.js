/**
 * Per-frame simulation on world time (slow-motion aware): charge tension, phase updates, springs, torches and all
 * particle physics.
 */
import { A, buzz } from '../audio/chip.js';
import { snapChain } from '../card/chains.js';
import { backCracks, frontCracks } from '../card/faces.js';
import { DN } from '../core/perf.js';
import { MOTION, TAU, lerp, reduce, rnd } from '../core/util.js';
import { RAR } from '../data/armor.js';
import { FX, bolt, prune, ring, sparks } from '../fx/particles.js';
import { fadeFlashes } from './bag.js';
import { aftershock, arrive, assignCard, burst, teaseUp } from './flow.js';
import { CX, CY, HY, NARROW, PTOP, TORCH, W } from './layout.js';
import { S, tens } from './state.js';
import { SCN } from '../scene/scene.js';
import { dustAt, voidRows } from '../scene/wall.js';

const CHARGE_T = 1.6,
  CRACK_AT = [0.14, 0.3, 0.47, 0.64],
  TEASE_AT = [0.38, 0.62, 0.85];
function spring(s, target, k, c, dt) {
  const n = 4,
    h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (-k * (s.x - target) - c * s.v) * h;
    s.x += s.v * h;
  }
}
function tension(c, rdt, want, cracks) {
  if (cracks === backCracks && c > 0.2 && Math.random() < rdt * c * 9) A.clink();
  for (let i = 0; i < 4; i++)
    if (!S.reached[i] && c >= CRACK_AT[i]) {
      S.reached[i] = 1;
      cracks[i].shown = true;
      if (cracks === backCracks) snapChain(i);
      A.crack(i);
      S.trauma = Math.min(1, S.trauma + 0.25);
      S.pulse += 0.05 * MOTION;
      S.cardI += 0.35;
      sparks(14, S.teaseKey, 30, 110, 0.35, S.cx, S.cy, true);
      buzz(10);
    }
  cracks.forEach((t) => {
    if (t.shown) t.prog = Math.min(1, t.prog + rdt * 6);
  });
  if (want && c > 0.03) {
    S.beat -= rdt;
    if (S.beat <= 0) {
      S.beat = lerp(0.62, 0.15, c);
      A.heart(c);
      S.pulse += (0.03 + 0.05 * c) * MOTION;
      S.cardI += 0.15 + 0.3 * c;
      buzz(Math.round(6 + 14 * c));
    }
  }
  if (c > 0.42) {
    S.zapAcc += rdt * Math.pow((c - 0.42) / 0.58, 1.5) * 12 * (reduce ? 0.3 : 1) * Math.min(1, DN() + 0.25);
    while (S.zapAcc > 1) {
      S.zapAcc--;
      bolt(Math.random() < 0.3 ? 'w' : S.teaseKey);
    }
  }
  S.trauma = Math.max(S.trauma, 0.4 * c * c);
  S.glow = c;
  S.cardIT = 0.5 + 1.3 * c * c;
  S.amb = lerp(0.3, 0.12, c);
  if (c > 0.03) {
    S.suckAcc += rdt * (18 + 180 * c * c) * (reduce ? 0.4 : 1) * DN();
    while (S.suckAcc > 1) {
      S.suckAcc--;
      const a = rnd(0, TAU),
        d = rnd(55, 130);
      FX.sucks.push({
        x: S.cx + Math.cos(a) * d,
        y: S.cy + Math.sin(a) * d * 0.8,
        v: rnd(20, 50),
        k: Math.random() < 0.35 ? 'w' : S.teaseKey,
      });
    }
  }
}
export function step(dt, rdt) {
  S.t += dt;
  if (S.phase === 'idle') {
    const want = S.holding || S.auto;
    if (want && (S.r < 0 || !S.spec)) assignCard();
    if (want) {
      if (!A.charging) A.chargeStart();
      S.charge = Math.min(1, S.charge + rdt / CHARGE_T);
    } else S.charge = Math.max(0, S.charge - rdt * 1.3);
    const c = S.charge;
    A.chargeUpdate(c, S.rt);
    if (!want && c <= 0) A.chargeStop();
    for (let i = 0; i < 3; i++) if (S.tease < i + 1 && S.vr >= i + 1 && c >= TEASE_AT[i]) teaseUp(i + 1);
    tension(c, rdt, want, backCracks);
    if (S.auto && c <= 0) S.auto = false;
    if (c >= 1) burst();
  } else if (S.phase === 'upgrading') {
    S.up = Math.min(1, S.up + rdt / 1.5);
    A.chargeUpdate(S.up, S.rt);
    S.glitch = 0.2 + S.up * 0.8;
    tension(S.up, rdt, true, frontCracks);
    if (S.up >= 1) {
      S.vr = S.r;
      burst();
    }
  } else {
    S.glow = Math.max(0, S.glow - dt * 3);
    S.amb = lerp(S.amb, S.phase === 'revealed' ? 0.34 : 0.3, 1 - Math.exp(-2 * dt));
  }
  if (S.phase === 'revealed') {
    if (S.after > 0) {
      S.after -= dt;
      if (S.after <= 0) aftershock();
    }
    if (S.vr >= 2) {
      S.zapAcc += dt * (S.vr === 3 ? 1.6 : 0.8) * (reduce ? 0.3 : 1) * Math.min(1, DN() + 0.25);
      while (S.zapAcc > 1) {
        S.zapAcc--;
        bolt(RAR[S.vr].l);
      }
    }
    if (S.vr >= 1) {
      S.sparkAcc += dt * RAR[S.vr].sparkle * (reduce ? 0.4 : 1) * DN();
      while (S.sparkAcc > 1) {
        S.sparkAcc--;
        const a = rnd(0, TAU);
        FX.motes.push({
          x: S.cx + Math.cos(a) * rnd(36, 54),
          y: S.cy + Math.sin(a) * rnd(48, 62),
          vy: -rnd(4, 12),
          age: 0,
          life: rnd(0.8, 1.6),
          k: Math.random() < 0.5 ? 'w' : RAR[S.vr].l,
        });
      }
    }
    S.cardIT = RAR[S.vr].glow * (1 + 0.12 * Math.sin(S.rt * 2.4));
  }
  if (S.phase === 'entering') {
    S.summon = Math.min(1, S.summon + rdt / (reduce ? 0.4 : 0.95));
    const sp = S.summon;
    S.cardIT = 0.5 + 0.9 * Math.sin(sp * Math.PI);
    S.beam = Math.max(S.beam, 0.75 * Math.sin(Math.min(1, sp * 1.3) * Math.PI));
    if (Math.random() < rdt * 70 * (1 - sp) * DN()) {
      const a = rnd(0, TAU);
      FX.motes.push({
        x: CX + Math.cos(a) * rnd(10, 28),
        y: PTOP - 1 + Math.sin(a) * 4,
        vy: -rnd(25, 70),
        age: 0,
        life: rnd(0.4, 0.9),
        k: Math.random() < 0.5 ? 'w' : '4',
      });
    }
    if (!S.summonChime && sp > 0.2) {
      S.summonChime = true;
      A.summon();
    }
    if (sp >= 1) {
      S.phase = 'idle';
      S.sq.v = 5;
      S.trauma = Math.min(1, S.trauma + 0.22);
      ring('4', 220, 1, 0);
      sparks(22, 'c', 20, 100, 0.4, CX, CY, true);
      A.land();
      buzz(12);
    }
  }
  if (S.phase === 'collecting') {
    const C = S.col;
    C.t = Math.min(1, C.t + rdt / 0.7);
    const t = C.t,
      e = t < 0.2 ? -0.08 * Math.sin((t / 0.2) * Math.PI) : Math.pow((t - 0.2) / 0.8, 2),
      u = Math.max(0, e);
    S.pos.x = 2 * (1 - u) * u * C.dir * 50 + u * u * C.tx;
    S.pos.y = 2 * (1 - u) * u * -60 + u * u * C.ty + (e < 0 ? -e * 50 : 0);
    S.colScale = Math.max(0.08, lerp(1, C.s1, u) * (e < 0 ? 1 + e : 1));
    S.colSpin = C.dir * u * TAU * 1.5;
    if (t >= 1 && !C.done) {
      C.done = true;
      arrive();
    }
  }
  // springs & timers
  spring(S.sq, 0, 260, 12, dt);
  spring(S.zoom, 1, 90, 10, dt);
  S.pulse *= Math.exp(-9 * dt);
  if (S.spin.t < 1) {
    S.spin.t = Math.min(1, S.spin.t + dt / S.spin.dur);
    const e = 1 - Math.pow(1 - S.spin.t, 3);
    S.spin.a = lerp(S.spin.from, S.spin.to, e);
  }
  const live = S.t - S.ptr.last < 2.5,
    c = tens(),
    damp = 1 - c * 0.8;
  const over = live && Math.abs(S.ptr.nx) < 0.95 && Math.abs(S.ptr.ny) < 0.95;
  const tx = (over ? -S.ptr.ny * 0.34 : 0) * damp * MOTION,
    ty = (over ? S.ptr.nx * 0.46 : 0) * damp * MOTION;
  const k = 1 - Math.exp(-9 * dt);
  S.tilt.x = lerp(S.tilt.x, tx, k);
  S.tilt.y = lerp(S.tilt.y, ty, k);
  S.trauma = Math.max(0, S.trauma - dt * 1.6);
  S.rays = lerp(S.rays, S.raysT, 1 - Math.exp(-1.6 * dt));
  S.rayAng += dt * (0.22 + S.rays * 0.35);
  S.cardI = lerp(S.cardI, S.cardIT, 1 - Math.exp(-(S.cardI > S.cardIT ? 3.4 : 8) * dt));
  S.beam *= Math.exp(-0.9 * dt);
  S.torchBoost *= Math.exp(-2 * dt);
  S.ca *= Math.exp(-4 * rdt);
  for (let i = 0; i < 3; i++) {
    if (S.barFlash[i] > 0) S.barFlash[i] -= rdt;
  }
  // torches
  S.flameAcc += dt * (26 + 40 * S.torchBoost) * (reduce ? 0.5 : 1) * Math.min(1, 0.4 + DN());
  while (S.flameAcc > 1) {
    S.flameAcc--;
    for (const t of TORCH) {
      const lean = (S.cx - t.x) * 0.9 * c;
      FX.flames.push({
        x: t.x + rnd(-1.5, 1.5),
        y: t.y - 1,
        vx: lean * rnd(0.6, 1.2) + rnd(-5, 5),
        vy: -rnd(18, 40) * (1 + S.torchBoost),
        age: 0,
        life: rnd(0.3, 0.6) * (1 + S.torchBoost * 0.4),
      });
    }
  }
  for (const t of TORCH) {
    if (Math.random() < dt * 2.5)
      FX.flames.push({
        x: t.x,
        y: t.y - 4,
        vx: rnd(-8, 8) + (S.cx - t.x) * 0.6 * c,
        vy: -rnd(30, 60),
        age: 0,
        life: rnd(1, 2),
        ember: true,
      });
  }
  // particles
  const dr = (f) => Math.exp(-f * dt),
    d22 = dr(2.2),
    d08 = dr(0.8),
    d3 = dr(3),
    d06 = dr(0.6),
    d05 = dr(0.5),
    d2 = dr(2),
    d15 = dr(1.5),
    d07 = dr(0.7),
    d12 = dr(1.2);
  for (const p of FX.sparks) {
    p.age += dt;
    const d = d22;
    p.vx *= d;
    p.vy = p.vy * d + 220 * dt;
    p.px = p.x;
    p.py = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > p.g && p.vy > 0) {
      p.y = p.g;
      p.vy *= -0.45;
      p.vx *= 0.7;
    }
  }
  for (const p of FX.tiles) {
    p.age += dt;
    p.vx *= d08;
    p.vy += 460 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.y > p.g && p.vy > 0) {
      p.y = p.g;
      p.vy *= -0.35;
      p.vx *= 0.6;
      p.vr *= 0.5;
    }
  }
  for (const p of FX.confetti) {
    p.age += dt;
    if (p.land) continue;
    const d = d3;
    p.vx = p.vx * d + Math.sin(p.ph) * 22 * dt;
    p.vy = p.vy * d + 130 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ph += dt * 10;
    if (p.y >= p.g) {
      p.y = p.g;
      p.land = true;
      p.life = p.age + rnd(1.5, 3.5);
    }
  }
  for (const p of FX.coins) {
    p.age += dt;
    if (p.rest) continue;
    p.vh -= 520 * dt;
    p.h += p.vh * dt;
    p.x += p.vx * dt;
    p.vx *= d06;
    p.ph += dt * (10 + Math.abs(p.vh) * 0.04);
    if (p.h <= 0) {
      p.h = 0;
      if (Math.abs(p.vh) > 40) {
        A.clink();
        p.vh *= -0.42;
        p.vx *= 0.6;
      } else {
        p.rest = true;
        p.vh = 0;
      }
    }
  }
  for (const p of FX.bricks) {
    p.age += dt;
    if (p.rest) continue;
    p.vy += 560 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= d05;
    p.rot += p.vr * dt;
    if (p.y + p.h / 2 > p.g && p.vy > 0) {
      p.y = p.g - p.h / 2;
      const hard = p.vy;
      if (hard > 120 && p.w >= 10 && FX.bricks.length < Math.round((NARROW ? 260 : 480) * DN())) {
        const hw = Math.floor(p.w / 2);
        FX.bricks.push({
          sx: p.sx + hw,
          sy: p.sy,
          w: p.w - hw,
          h: p.h,
          x: p.x + hw / 2,
          y: p.y,
          vx: p.vx + rnd(15, 45),
          vy: -hard * 0.3,
          rot: p.rot,
          vr: rnd(-8, 8),
          g: p.g + rnd(-1, 2),
          age: p.age,
          life: p.life,
          rest: false,
        });
        p.w = hw;
        p.x -= hw / 2;
        p.vx -= rnd(15, 45);
      }
      if (hard > 45) {
        p.vy *= -0.3;
        p.vx *= 0.5;
        p.vr *= 0.5;
        A.thud();
        dustAt(p.x, p.y + p.h / 2, hard > 120 ? 4 : 2, true);
        if (hard > 150) S.trauma = Math.min(1, S.trauma + 0.03);
      } else {
        p.rest = true;
        p.vy = 0;
        p.vr = 0;
        p.rot = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
      }
    }
  }
  for (const p of FX.dustp) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= d2;
    p.vy *= d15;
  }
  for (const p of FX.links) {
    p.age += dt;
    if (p.rest) continue;
    p.vy += (p.lock ? 540 : 440) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= d07;
    if (p.y > p.g && p.vy > 0) {
      p.y = p.g;
      if (Math.abs(p.vy) > 45) {
        p.vy *= -(p.lock ? 0.3 : 0.38);
        p.vx *= 0.6;
        if (p.lock) A.clunk();
        else A.clink();
      } else p.rest = true;
    }
  }
  for (const p of FX.sucks) {
    const dx = S.cx - p.x,
      dy = S.cy - p.y,
      d = Math.hypot(dx, dy) || 1;
    p.px = p.x;
    p.py = p.y;
    p.v += (120 + 520 * tens()) * dt;
    const m = Math.min(d, p.v * dt);
    p.x += (dx / d) * m;
    p.y += (dy / d) * m;
    p.d = d;
  }
  for (const p of FX.motes) {
    p.age += dt;
    p.y += p.vy * dt;
  }
  for (const p of FX.flames) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= d15;
    if (!p.ember) p.vy *= d05;
    else {
      p.vx += Math.sin(p.age * 5) * 6 * dt;
    }
  }
  for (const p of FX.bolts) p.age += dt;
  for (const p of FX.rings) {
    p.age += dt;
    if (p.age > 0) {
      p.r += p.v * dt;
      p.v *= dr(2.6);
    }
  }
  for (const p of FX.dust) {
    const dx = S.cx - p.x,
      dy = S.cy - p.y,
      d = Math.hypot(dx, dy) || 1,
      pull = c * c * 120;
    p.vx += ((dx / d) * pull + Math.sin(S.t * 0.5 + p.ph) * 1.5) * dt;
    p.vy += ((dy / d) * pull + Math.cos(S.t * 0.4 + p.ph) * 1.2) * dt;
    p.vx *= d12;
    p.vy *= d12;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (d < 10 || p.x < 0 || p.x > W || p.y < 0 || p.y > HY) {
      p.x = rnd(0, W);
      p.y = rnd(0, HY);
      p.vx = 0;
      p.vy = 0;
    }
  }
  // in-place pruning: no new arrays per frame
  prune(FX.sparks);
  prune(FX.tiles);
  prune(FX.confetti);
  prune(FX.motes);
  prune(FX.bolts);
  prune(FX.rings);
  prune(FX.flames);
  prune(FX.coins);
  prune(FX.links);
  prune(FX.bricks);
  prune(FX.dustp);
  {
    const a = FX.sucks;
    let j = 0;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      if (p.d === undefined || p.d > 8) a[j++] = p;
    }
    a.length = j;
  }
  if (FX.sparks.length > 900) FX.sparks.splice(0, FX.sparks.length - 900);
  if (SCN.voidJob && !SCN.voidJob.done) voidRows(SCN.voidJob, Math.max(2, Math.ceil(HY / 40)));
}
export function ui(rdt) {
  if (S.phase === 'revealed') {
    for (let k = 0; k < 3; k++) {
      if (S.barDone[k]) continue;
      const e = S.rt - S.barT[k];
      if (e < 0) continue;
      const p = Math.min(1, e / 0.32);
      const v = S.barTarget[k] * (1 - Math.pow(1 - p, 3));
      if (Math.round(v * 36) !== Math.round(S.bars[k] * 36)) A.bar(p, k);
      S.bars[k] = v;
      if (p >= 1) {
        S.barDone[k] = 1;
        S.barFlash[k] = 0.18;
        A.barEnd(k);
        S.pulse += 0.03 * MOTION;
        sparks(
          10 + S.vr * 4,
          RAR[S.vr].l,
          20,
          80,
          0.4,
          Math.round(S.cx - 32 + 21 + 36 * S.bars[k]),
          Math.round(S.cy - 45 + 68 + k * 6),
          true,
        );
        buzz(10);
      }
    }
  }
  fadeFlashes(rdt);
}
