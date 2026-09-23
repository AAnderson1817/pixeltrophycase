/**
 * The card lifecycle: pick rarity and piece, charge, burst, hitstop, reveal, fake-out upgrade, commit to the bag,
 * collect flight, set and full-collection celebrations, next card.
 */
import { A, buzz } from '../audio/chip.js';
import { buildArtBg, drawFront, frontCracks, resetCracks } from '../card/faces.js';
import { MOTION, TAU, later, reduce, ri, rnd } from '../core/util.js';
import { POOL, RAR, SETS } from '../data/armor.js';
import { FX, Q, bolt, coins, confetti, gy, ring, shatter, sparks } from '../fx/particles.js';
import { BAG, flashAll, saveBag, setDone, shownCount, slotFlash, slotRect, slotShown, syncReset } from './bag.js';
import { CX, CY, TORCH, again, hit, live } from './layout.js';
import { S } from './state.js';
import { CHd, backC, frontC } from '../gfx/canvas.js';
import { SCN } from '../scene/scene.js';
import { makeVoidJob, startWallBreak, wallRebuild } from '../scene/wall.js';

function pickRarity() {
  if (S.force >= 0) return S.force;
  let u = Math.random();
  for (let i = 0; i < 4; i++) {
    u -= RAR[i].odds;
    if (u <= 0) return i;
  }
  return 0;
}
export function assignCard() {
  S.r = pickRarity();
  let opts = POOL.filter((c) => c.r === S.r);
  if (window.APP.forceCard) {
    opts = POOL.filter((c) => c.name === window.APP.forceCard);
    S.r = opts[0].r;
  }
  const c = opts[ri(0, opts.length - 1)];
  S.spec = Object.assign(
    {
      seed: ri(1, 1e9),
      idx: POOL.indexOf(c),
    },
    c,
  );
  S.fake =
    window.APP.forceFake !== undefined
      ? window.APP.forceFake && S.r >= 2
      : (S.r === 3 && Math.random() < 0.45) || (S.r === 2 && Math.random() < 0.3);
  S.vr = S.fake ? S.r - 1 : S.r;
  paint(S.vr);
}
function paint(vr) {
  buildArtBg(vr);
  const [a, b] = RAR[vr].bars;
  S.barTarget = [rnd(a, b), rnd(a, b), rnd(a, b)];
  S.bars = [0, 0, 0];
  S.barFlash = [0, 0, 0];
}
export function teaseUp(l) {
  S.tease = l;
  S.teaseKey = RAR[l].l;
  S.lightKey = RAR[l].ramp;
  S.pulse = 0.12 * MOTION;
  S.trauma = Math.min(1, S.trauma + 0.4);
  A.tease(l);
  buzz(25);
  S.cardI += 0.8;
  sparks(34 + l * 14, RAR[l].l, 40, 150, 0.5, S.cx, S.cy, true);
  ring(RAR[l].l, 280, 2, 0);
  for (let i = 0; i < 1 + l; i++) bolt(RAR[l].l);
}
export function burst() {
  if (S.vr < 0 || !S.spec) {
    assignCard();
  }
  S.phase = 'hitstop';
  S.hitstopDur = S.hitstop = RAR[S.vr].hitstop * (reduce ? 0.5 : 1);
  S.sq.x = 0.2;
  S.sq.v = 0;
  S.zoom.x = 1 + 0.07 * MOTION;
  S.zoom.v = 0;
  if (!S.upgrading) {
    S.charge = 1;
    if (S.lockOn) {
      S.lockOn = false;
      S.chains = [false, false, false, false];
      FX.links.push({
        lock: true,
        x: S.cx,
        y: S.cy + 7,
        vx: rnd(-70, 70),
        vy: -rnd(170, 230),
        g: gy(),
        age: 0,
        life: 6,
        rest: false,
      });
    }
  }
  A.chargeStop();
  A.boom(S.vr);
  buzz([45, 25, 110]);
}
export function release() {
  const r = S.vr,
    R = RAR[r],
    up = S.upgrading,
    final = !S.fake || up,
    gen = S.seed;
  S.phase = 'revealed';
  S.glitch = 0;
  S.backOn = false;
  S.auto = false;
  S.popT0 = S.rt;
  S.lightKey = R.ramp;
  if (up) {
    drawFront(S.rt);
    shatter(frontC);
    frontCracks.forEach((t) => {
      t.shown = false;
      t.prog = 0;
    });
    paint(r);
  } else shatter(backC);
  S.spin = {
    a: 0,
    from: 0,
    to: (reduce ? 0 : R.spin) * TAU,
    t: 0,
    dur: 0.5 + 0.32 * R.spin,
  };
  S.sq.v = -5;
  S.trauma = Math.min(1, 0.62 + r * 0.13);
  S.flash = 1;
  S.flashKey = R.l;
  S.rays = reduce ? R.rays : 1.3;
  S.raysT = R.rays;
  S.zoom.v = -1.3 * MOTION;
  S.ca = reduce ? 0 : 1;
  S.cardI = 2.6;
  S.cardIT = R.glow;
  S.torchBoost = 1.2;
  S.beam = r >= 2 ? 1.4 : 0;
  A.roar();
  S.slowmo = reduce ? 0 : [0, 0, 0.3, 0.72][r];
  if (S.slowmo) A.muffle(S.slowmo + 0.3);
  S.after = r >= 1 ? 0.32 : -1;
  sparks(R.spark * (up ? 1.4 : 1), R.l, 60, 260, 1.3);
  sparks(R.spark * 0.4, 'w', 110, 340, 0.5);
  for (const t of TORCH)
    for (let i = 0; i < Q(26); i++)
      FX.flames.push({
        x: t.x + rnd(-2, 2),
        y: t.y - 2,
        vx: (t.x - S.cx) * rnd(0.6, 1.6) + rnd(-30, 30),
        vy: -rnd(40, 140),
        age: 0,
        life: rnd(0.3, 0.8),
        big: true,
      });
  ring(R.l, 360, 3, 0);
  ring('w', 270, 1, 0.05);
  if (r >= 2) ring(R.d, 220, 2, 0.14);
  if (r === 3) {
    ring('Y', 170, 3, 0.26);
    ring('o', 120, 1, 0.4);
  }
  if (r >= 1) for (let i = 0; i < 2 + r * 2; i++) bolt(R.l);
  if (r >= 2) confetti(r === 3 ? 170 : 90, r === 3 ? ['y', 'o', 'Y', 'w', 'r'] : ['v', 'm', 'V', 'w', 't'], false);
  if (R.coins)
    later(90, () => {
      if (S.seed === gen) coins(R.coins);
    });
  S.title = {
    text: R.name,
    t0: S.rt,
    ramp: R.title,
    quake: 0,
  };
  [...R.name].forEach((_, i) =>
    later(60 + i * 55 + 170, () => {
      if (S.seed !== gen) return;
      A.letter(i, R.name.length);
      if (i === R.name.length - 1) {
        S.trauma = Math.min(1, S.trauma + 0.35);
        S.zoom.v += 0.6 * MOTION;
        buzz(25);
      }
    }),
  );
  for (let i = 0; i <= r; i++)
    later(650 + i * 110, () => {
      if (S.seed === gen) A.pip(i);
    });
  S.barT = [S.rt + 0.75, S.rt + 1.05, S.rt + 1.35];
  S.barDone = [0, 0, 0];
  live.textContent = `${R.name}: ${S.spec.name}`;
  hit.setAttribute('aria-label', `${R.name} ${S.spec.name}. Tap to spin it.`);
  S.upgrading = false;
  if (final) {
    S.fake = false;
    commit(gen);
    SCN.voidJob = makeVoidJob(S.vr);
    later(1150, () => {
      if (S.phase === 'revealed' && S.seed === gen) startWallBreak(S.vr);
    });
    later(1000, () => {
      if (S.phase === 'revealed' && S.seed === gen) again.classList.add('show');
    });
  } else
    later(2200, () => {
      if (S.phase === 'revealed' && S.seed === gen) startUpgrade();
    });
}
function commit(gen) {
  const nm = S.spec.name;
  S.pending = {
    i: S.spec.idx,
    isNew: !BAG.owned[nm],
  };
  BAG.owned[nm] = (BAG.owned[nm] || 0) + 1;
  saveBag();
  syncReset();
  // read when it fires: a Reset in between re-adds the pending piece as new (input.js)
  later(1900, () => {
    if (S.phase !== 'revealed' || S.seed !== gen) return;
    const isNew = S.pending.isNew;
    S.stamp = {
      text: isNew ? 'NEW!' : 'x' + BAG.owned[nm],
      key: isNew ? 'y' : '4',
      t0: S.rt,
    };
    A.stamp(isNew);
    S.trauma = Math.min(1, S.trauma + 0.25);
    S.pulse = 0.08 * MOTION;
    buzz(25);
    sparks(26, isNew ? 'o' : '4', 30, 130, 0.5, S.cx + 30, S.cy - 44, true);
  });
}
function startUpgrade() {
  S.phase = 'upgrading';
  S.up = 0;
  S.upgrading = true;
  S.reached = [0, 0, 0, 0];
  S.beat = 0;
  S.teaseKey = RAR[S.r].l;
  S.lightKey = RAR[S.r].ramp;
  S.raysT = 0;
  S.beam = 0;
  again.classList.remove('show');
  if (S.title) S.title.quake = 1;
  A.glitch();
  A.chargeStart();
  S.trauma = Math.min(1, S.trauma + 0.5);
  S.flash = 0.5;
  S.flashKey = 'm';
  S.ca = 0.8;
  buzz([20, 40, 20]);
}
export function aftershock() {
  const k = RAR[S.vr].l;
  S.trauma = Math.min(1, S.trauma + 0.45);
  S.zoom.v += 0.9 * MOTION;
  ring(k, 300, 2, 0);
  sparks(40 + S.vr * 20, k, 40, 170, 0.7);
  A.after();
  buzz(35);
  S.cardI += 1;
  S.ca = Math.max(S.ca, 0.5);
  if (S.vr === 3) {
    confetti(70, ['y', 'o', 'w', 'Y'], false);
    coins(20);
  }
}
export function fidget() {
  S.spin = {
    a: 0,
    from: 0,
    to: TAU,
    t: 0,
    dur: 0.5,
  };
  S.sq.v = -3;
  sparks(46, RAR[S.vr].l, 30, 160, 0.6, S.cx, S.cy);
  ring(RAR[S.vr].l, 220, 1, 0);
  A.fidget();
  buzz(15);
  S.cardI += 0.6;
  if (S.vr >= 2) coins(3);
}
export function leave() {
  if (S.phase !== 'revealed' || S.fake) return;
  const i = S.pending ? S.pending.i : 0,
    sl = slotRect(i);
  S.col = {
    t: 0,
    tx: sl.x + sl.w / 2 - CX,
    ty: sl.y + sl.h / 2 - CY,
    s1: sl.h / CHd,
    dir: Math.random() < 0.5 ? -1 : 1,
    done: false,
    i,
  };
  S.phase = 'collecting';
  again.classList.remove('show');
  S.title = null;
  S.stamp = null;
  S.raysT = 0;
  S.beam = 0;
  S.cardIT = 0.5;
  A.whoosh();
  buzz(8);
}
export function arrive() {
  const i = S.col.i,
    sl = slotRect(i);
  S.hidden = true;
  slotShown[i] = !!BAG.owned[POOL[i].name];
  slotFlash[i] = 0.5;
  A.collect();
  buzz(20);
  S.trauma = Math.min(1, S.trauma + 0.15);
  sparks(34, RAR[POOL[i].r].l, 20, 130, 0.45, sl.x + sl.w / 2, sl.y + sl.h / 2, true);
  S.pending = null;
  // any set complete but not yet flagged (its last piece may have been revealed before a reload), not only this one's;
  // a Reset before the celebration fires replaces BAG, so it is dropped and the next card still enters
  const bag = BAG,
    due = SETS.findIndex((_, k) => !BAG.sets[k] && setDone(k));
  if (!BAG.complete && shownCount() === POOL.length)
    later(380, () => (BAG === bag && shownCount() === POOL.length ? celebrate() : startEnter()));
  else if (due >= 0) later(380, () => (BAG === bag && setDone(due) ? celebrateSet(due) : startEnter()));
  else later(240, startEnter);
}
function celebrateSet(si) {
  const st = SETS[si];
  BAG.sets[si] = true;
  saveBag();
  S.vr = 3;
  S.lightKey = st.light;
  S.title = {
    text: st.name + ' SET',
    t0: S.rt,
    ramp: st.ramp,
    quake: 0,
  };
  POOL.forEach((c, k) => {
    if (c.set === si) slotFlash[k] = 0.5 + c.k * 0.08;
  });
  confetti(150, st.conf, true);
  coins(24);
  S.trauma = Math.min(1, S.trauma + 0.45);
  S.flash = 0.6;
  S.flashKey = st.c;
  S.rays = 0.8;
  S.raysT = 0;
  S.cardI = 2.4;
  S.cardIT = 0.3;
  S.torchBoost = 1.2;
  A.fanfare();
  buzz([50, 30, 50, 30, 120]);
  live.textContent = st.name[0] + st.name.slice(1).toLowerCase() + ' set complete';
  later(2800, () => {
    S.title = null;
    startEnter();
  });
}
function celebrate() {
  BAG.complete = true;
  SETS.forEach((_, k) => {
    BAG.sets[k] = true;
  });
  saveBag();
  syncReset();
  S.vr = 3;
  S.lightKey = 'y';
  S.title = {
    text: 'ALL SETS!',
    t0: S.rt,
    ramp: null,
    quake: 0,
  };
  flashAll();
  confetti(260, ['y', 'o', 't', 'v', 'w', 'Y', 'm'], true);
  coins(50);
  S.trauma = Math.min(1, S.trauma + 0.6);
  S.flash = 0.8;
  S.flashKey = 'y';
  S.rays = 1;
  S.raysT = 0;
  S.cardI = 3;
  S.cardIT = 0.3;
  S.torchBoost = 1.5;
  A.fanfare();
  buzz([60, 40, 60, 40, 160]);
  live.textContent = 'All six armor sets collected';
  later(3200, () => {
    S.title = null;
    startEnter();
  });
}
export function startEnter() {
  S.phase = 'entering';
  S.landed = false;
  S.auto = false;
  S.holding = false;
  A.chargeStop();
  S.pos.x = 0;
  S.pos.y = 0;
  S.pos.vy = 0;
  S.summon = 0;
  S.summonChime = false;
  S.chains = [true, true, true, true];
  S.lockOn = true;
  S.charge = 0;
  S.reached = [0, 0, 0, 0];
  S.tease = 0;
  S.teaseKey = 's';
  S.lightKey = 's';
  S.r = -1;
  S.vr = -1;
  S.spec = null;
  S.fake = false;
  S.upgrading = false;
  S.up = 0;
  S.hidden = false;
  S.after = -1;
  S.title = null;
  S.stamp = null;
  S.glitch = 0;
  S.backOn = true;
  S.cardIT = 0.5;
  S.beam = 0;
  S.spin = {
    a: 0,
    from: 0,
    to: 0,
    t: 1,
    dur: 1,
  };
  S.seed++;
  resetCracks(S.seed);
  wallRebuild();
  FX.coins.forEach((c) => {
    c.life = Math.min(c.life, c.age + rnd(0.2, 0.8));
  });
  FX.links.forEach((c) => {
    c.life = Math.min(c.life, c.age + rnd(0.2, 0.8));
  });
  hit.setAttribute('aria-label', 'Loot card. Press and hold to open.');
}
