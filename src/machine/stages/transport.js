// Stages 12-16: roller conveyor, lift, grand spiral, bowling lane with pin sieve, cart run.
import { V, Q, DEG, easeInOutCubic, clamp } from '../../math.js';
import { linePath, joinPaths, catmullRom, helixPath } from '../geometry.js';
import { RAPIER } from '../../physics/world.js';

export function rollerConveyor(M) {
  const B = M.B;
  const S = M.stage({ name: 'conveyor', title: 'Flight Conveyor', blurb: 'Four chain-driven pusher flights loop through a slotted trough and shove the sphere to the lift cup at one metre per second.', input: { r: 0.1, material: 'steel', speed: 2.0 } });
  M.entrySensor(S, { x: 0.3, y: 0.15, z: 0 }, 0.5);
  const x0 = 0.4, x1 = 3.4, speed = 1.0, dip = 0.45;
  // flat slotted trough: two rails 6 cm apart (the flight stems pass through the slot), low side walls
  for (const sz of [-1, 1]) B.fixedBox((x1 - x0) / 2 + 0.3, 0.025, 0.11, { x: (x0 + x1) / 2, y: -0.025, z: sz * 0.14 }, { material: 'track' });
  for (const sz of [-1, 1]) B.fixedBox((x1 - x0) / 2 + 0.3, 0.12, 0.02, { x: (x0 + x1) / 2, y: 0.1, z: sz * 0.27 }, { material: 'steel', color: 0x8a8f99 });
  B.trough(linePath({ x: -0.4, y: 0.01, z: 0 }, { x: x0 + 0.1, y: 0.0, z: 0 }, 3), { radius: 0.16, arcDeg: 180, thick: 0.035, material: 'track' });
  // chain loop: forward along the top, down at the far end, back underneath, up at the start
  const L1 = x1 - x0, loopLen = 2 * L1 + 2 * dip;
  const flights = 4;
  const posAt = (sArc) => {
    let u = ((sArc % loopLen) + loopLen) % loopLen;
    if (u < L1) return { x: x0 + u, y: 0.11, down: false };
    u -= L1; if (u < dip) return { x: x1, y: 0.11 - u, down: true };
    u -= dip; if (u < L1) return { x: x1 - u, y: 0.11 - dip, down: true };
    u -= L1; return { x: x0, y: 0.11 - dip + u, down: true };
  };
  const toW = (pl) => B.toWorld(pl);
  for (let k = 0; k < flights; k++) {
    const s0 = k * loopLen / flights;
    const p0 = posAt(s0);
    const flight = B.part([
      { type: 'box', hx: 0.025, hy: 0.09, hz: 0.24 },
      { type: 'box', hx: 0.02, hy: 0.06, hz: 0.02, pos: { x: 0, y: -0.14, z: 0 } },   // stem through the slot
    ], { type: 'kinematic', pos: { x: p0.x, y: p0.y, z: 0 }, material: 'paintYellow', color: 0xf1c40f, instanceKey: 'flight', name: k === 0 ? 'flight0' : null });
    B.animate(flight, (rec, time) => { const p = posAt(s0 + speed * time); return { pos: toW({ x: p.x, y: p.y, z: 0 }) }; });
  }
  // sprockets and chain run (decor)
  for (const x of [x0, x1]) B.decor([{ type: 'cylinder', hh: 0.03, r: dip / 2 }], { pos: { x, y: 0.11 - dip / 2, z: 0 }, rot: Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2), material: 'steel', color: 0x4a4f58 });
  B.decor([{ type: 'box', hx: L1 / 2, hy: 0.02, hz: 0.02 }], { pos: { x: (x0 + x1) / 2, y: 0.11 - dip, z: 0 }, material: 'steel', color: 0x2b2b2b });
  B.decor([{ type: 'box', hx: L1 / 2 + 0.3, hy: 0.04, hz: 0.3 }], { pos: { x: (x0 + x1) / 2, y: -0.6, z: 0 }, material: 'steel', color: 0x4a4f58 });
  for (const x of [x0 - 0.1, x1 + 0.1]) for (const z of [-0.25, 0.25]) B.decor([{ type: 'box', hx: 0.04, hy: 0.5, hz: 0.04 }], { pos: { x, y: -1.1, z }, material: 'steel', color: 0x4a4f58 });
  M.cue('conveyorMid', { type: 'ball', r: 0.25 }, { x: (x0 + x1) / 2, y: 0.1, z: 0 });
  S.focus = { x: (x0 + x1) / 2, y: 0, z: 0 };
  return { exit: { pos: { x: x1 + 0.1, y: 0, z: 0 }, yaw: 0 } };
}

export function lift(M) {
  const B = M.B;
  const H = 13.0;
  const S = M.stage({ name: 'lift', title: 'Lift', blurb: 'A sensor in the cup starts the hoist: thirteen metres up in nine seconds, then the cup tips sideways into the spiral.', input: { r: 0.1, material: 'steel', speed: 1.0 } });
  M.entrySensor(S, { x: 0.35, y: 0.15, z: 0 }, 0.35);
  // Cup (kinematic): floor top at y = 0; entry over a 3 cm lip at -x; back wall at +x; tall wall at -z; 3 cm pour lip at +z
  const cupX = 0.4;
  const cup = B.part([
    { type: 'box', hx: 0.35, hy: 0.03, hz: 0.3, pos: { x: 0, y: -0.03, z: 0 } },
    { type: 'box', hx: 0.35, hy: 0.22, hz: 0.03, pos: { x: 0, y: 0.19, z: -0.3 } },
    { type: 'box', hx: 0.35, hy: 0.03, hz: 0.03, pos: { x: 0, y: 0.0, z: 0.3 } },
    { type: 'box', hx: 0.08, hy: 0.01, hz: 0.3, pos: { x: -0.4, y: 0.005, z: 0 }, rot: Q.axisAngle({ x: 0, y: 0, z: 1 }, -10 * DEG) }, // entry ramp lip
    { type: 'box', hx: 0.03, hy: 0.22, hz: 0.3, pos: { x: 0.35, y: 0.19, z: 0 }, material: 'felt' },
  ], { type: 'kinematic', pos: { x: cupX, y: -0.02, z: 0 }, material: 'paintYellow', color: 0xf1c40f, name: 'liftCup' });
  let startAt = null;
  const upW = B.dirToWorld({ x: 0, y: 1, z: 0 }), axisW = B.dirToWorld({ x: 1, y: 0, z: 0 });
  B.animate(cup, (rec, time) => {
    if (startAt === null) return null;
    const t = time - startAt;
    const rise = H * easeInOutCubic(clamp((t - 0.6) / 9.0, 0, 1));
    const tilt = 110 * DEG * easeInOutCubic(clamp((t - 10.0) / 1.6, 0, 1));    // positive about +x: the +z (lip) side goes down
    return { pos: V.add(rec.base.pos, V.scale(upW, rise)), rot: Q.mul(Q.axisAngle(axisW, tilt), rec.base.rot) };
  });
  B.sensor({ type: 'ball', r: 0.2 }, { x: cupX, y: 0.12, z: 0 }, { name: 'liftSensor', filter: p => p && p.type === 'dynamic', onEnter: (p, t) => { if (startAt === null) { startAt = t; M.emit('event', 'liftStart', p, t); } } });
  // Mast behind the cup (-z side) and guide
  B.decor([{ type: 'box', hx: 0.12, hy: H / 2 + 0.8, hz: 0.12 }], { pos: { x: cupX, y: H / 2 + 0.2, z: -0.6 }, material: 'steel', color: 0x4a4f58 });
  B.decor([{ type: 'box', hx: 0.5, hy: 0.12, hz: 0.5 }], { pos: { x: cupX, y: H + 1.0, z: -0.6 }, material: 'steel', color: 0x4a4f58 });
  B.decor([{ type: 'box', hx: 0.6, hy: 0.1, hz: 0.6 }], { pos: { x: cupX, y: -0.6, z: -0.6 }, material: 'concrete', color: 0x5d6168 });
  // Receiving trough at the top on the +z side, heading +z
  const ry = H - 0.34;
  B.trough(linePath({ x: cupX, y: ry, z: 0.12 }, { x: cupX, y: ry - 0.07, z: 1.4 }, 4), { radius: 0.45, arcDeg: 170, thick: 0.035, material: 'track' });   // wide: the ball may leave the cup off-centre
  B.trough(linePath({ x: cupX, y: ry - 0.07, z: 1.35 }, { x: cupX, y: ry - 0.1, z: 1.9 }, 2), { radius: 0.26, arcDeg: 180, thick: 0.035, material: 'track' });
  M.cue('liftTop', { type: 'ball', r: 0.6 }, { x: cupX, y: H, z: 0 }, { filter: p => p && p.name === 'liftCup' });
  S.hero = cup;
  S.focus = { x: cupX, y: H / 2, z: 0 };
  return { exit: { pos: { x: cupX, y: ry - 0.1, z: 1.9 }, yaw: -Math.PI / 2 } };
}

export function grandSpiral(M) {
  const B = M.B;
  const S = M.stage({ name: 'spiral', title: 'Grand Spiral', blurb: 'Two turns around the central column, five metres down.', input: { r: 0.1, material: 'steel', speed: 1.5 } });
  M.entrySensor(S, { x: 0.3, y: 0.15, z: 0 }, 0.5);
  const R = 2.4, turns = 2.0, drop = 5.0;
  const p1 = linePath({ x: -0.4, y: 0.01, z: 0 }, { x: 1.0, y: -0.06, z: 0 }, 4);
  const helix = helixPath({ cx: 1.0, cz: R, radius: R, y0: -0.06, y1: -0.06 - drop, a0: -Math.PI / 2 - Math.PI * 2 * turns, turns, dir: 1, segmentsPerTurn: 128 });
  const p3 = linePath({ x: 1.0, y: -0.06 - drop, z: 0 }, { x: 4.0, y: -0.06 - drop - 0.15, z: 0 }, 6);
  B.trough(joinPaths(p1, helix, p3), { radius: 0.21, arcDeg: 262, thick: 0.035, material: 'paintBlue', name: 'spiralTrough' }); // near-tube: holds the ball at 5 m/s
  B.cylinder(drop / 2 + 1.5, 0.5, { x: 1.0, y: -drop / 2 - 0.6, z: R }, { type: 'fixed', material: 'concrete', color: 0x6a6f78 });
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 - Math.PI * 2 * turns + Math.PI * 2 * turns * (i / 10);
    const y = -0.06 - drop * (i / 10);
    B.decor([{ type: 'box', hx: R / 2 - 0.2, hy: 0.03, hz: 0.03 }], { pos: { x: 1.0 + (R / 2 + 0.15) * Math.cos(a), y: y - 0.26, z: R + (R / 2 + 0.15) * Math.sin(a) }, rot: Q.yaw(-a), material: 'steel', color: 0x8a8f99 });
  }
  M.cue('spiralMid', { type: 'ball', r: 0.5 }, { x: 1.0 - R, y: -drop / 2, z: R });
  S.focus = { x: 1.0, y: -drop / 2, z: R };
  return { exit: { pos: { x: 4.0, y: -0.06 - drop - 0.15, z: 0 }, yaw: 0 } };
}

export function bowling(M) {
  const B = M.B;
  const S = M.stage({ name: 'bowling', title: 'Bowling', blurb: 'Strike! Ball and pins tumble off the deck into the pit, and their weight on the pit plate releases the cart.', input: { r: 0.1, material: 'steel', speed: 6.5 } });
  M.entrySensor(S, { x: 0.3, y: 0.15, z: 0 }, 0.5);
  // Lane: flat floor with low side walls up to the pin deck; deck ends at x = 6.0 over the pit
  B.trough(linePath({ x: -0.4, y: 0.01, z: 0 }, { x: 4.4, y: 0.0, z: 0 }, 4), { profile: 'trough', width: 1.05, wall: 0.12, thick: 0.05, material: 'darkwood', color: 0x6b4a2b });
  B.fixedBox(0.85, 0.025, 0.7, { x: 5.2, y: -0.025, z: 0 }, { material: 'darkwood', color: 0x6b4a2b }); // pin deck
  const pinR = 0.06, pinH = 0.38;
  let n = 0;
  for (let row = 0; row < 4; row++) {
    const x = 5.0 + row * 0.26;
    for (let i = 0; i <= row; i++) {
      const z = (i - row / 2) * 0.3;
      B.part([{ type: 'cylinder', hh: pinH / 2, r: pinR }], { pos: { x, y: pinH / 2, z }, material: 'plastic', mass: 1.5, instanceKey: 'pin', color: 0xf5f0e6, impactThreshold: 200, name: n === 0 ? 'pin0' : null });
      n++;
    }
  }
  // Pit: walls on three sides and a felt back wall; the floor is a sprung plate on a vertical prismatic joint
  const px0 = 6.05, px1 = 7.65, pz = 0.95, pTop = -0.75;
  for (const sz of [-1, 1]) B.fixedBox((px1 - px0) / 2, 0.55, 0.03, { x: (px0 + px1) / 2, y: pTop + 0.5, z: sz * pz }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  B.fixedBox(0.04, 0.9, pz, { x: px1 + 0.04, y: pTop + 0.85, z: 0 }, { material: 'felt', color: 0x5a1e1e });
  B.fixedBox(0.03, 0.3, pz, { x: px0 - 0.03, y: pTop + 0.25, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  const plate = B.part([{ type: 'box', hx: (px1 - px0) / 2 - 0.02, hy: 0.04, hz: pz - 0.03 }], { pos: { x: (px0 + px1) / 2, y: pTop - 0.04, z: 0 }, material: 'paintRed', color: 0xc0392b, name: 'pitPlate', mass: 5, impactThreshold: 1500 });
  B.prismatic(B.anchor({ x: (px0 + px1) / 2, y: pTop - 0.04, z: 0 }), plate, { x: (px0 + px1) / 2, y: pTop - 0.04, z: 0 }, { x: 0, y: 1, z: 0 }, { limits: [-0.12, 0], springPos: 0, stiffness: 2500, damping: 250 });
  B.fixedBox((px1 - px0) / 2, 0.2, pz, { x: (px0 + px1) / 2, y: pTop - 0.45, z: 0 }, { material: 'steel', color: 0x3b3f46 }); // housing
  let struck = false;
  B.sensor({ type: 'box', hx: 0.5, hy: 0.01, hz: 0.5 }, { x: (px0 + px1) / 2, y: pTop - 0.04 - 0.105, z: 0 }, {
    name: 'pitSwitch', filter: p => p === plate, onEnter: (p, t) => { if (!struck) { struck = true; M.emit('event', 'strike', plate, t); for (const f of M.strikeListeners || []) f(t); } },
  });
  M.cue('strike', { type: 'box', hx: 0.5, hy: 0.4, hz: 0.6 }, { x: 5.4, y: 0.3, z: 0 }, { filter: p => p && (p.name === 'F' || p.name === 'TEST') });
  S.focus = { x: 5.3, y: 0.3, z: 0 };
  return { exit: { pos: { x: px1 + 0.6, y: 0, z: 0 }, yaw: 0 } };
}

export function cartRun(M) {
  const B = M.B;
  const S = M.stage({ name: 'cart', title: 'Rail Sled', blurb: 'The pit switch drops the chock and a 90 kg rail sled on PTFE runners screams down a 4.5 m half-pipe descent.', input: { r: 0.1, material: 'steel', speed: 0 } });
  const yt = -0.72;                           // track floor
  // gentle crest, 23 degree grade, long run-out
  const profilePts = [{ x: -0.5, y: yt + 0.3 }, { x: 0.0, y: yt + 0.26 }, { x: 1.2, y: yt + 0.16 }, { x: 3.0, y: yt }, { x: 5.0, y: yt - 0.5 }, { x: 8.0, y: yt - 1.6 }, { x: 11.0, y: yt - 2.9 }, { x: 13.5, y: yt - 3.8 }, { x: 16.0, y: yt - 4.35 }, { x: 18.5, y: yt - 4.5 }, { x: 20.5, y: yt - 4.5 }, { x: 22.5, y: yt - 4.5 }];
  const track = catmullRom(profilePts.map(p => ({ x: p.x, y: p.y, z: 0 })), 24);
  B.trough(track, { radius: 0.55, arcDeg: 150, thick: 0.08, material: 'track', name: 'cartTrack' });
  // Sled: rounded runner base + cargo tray; decorative wheels (no colliders)
  const cx = 1.6, cy = yt + 0.12 + 0.12;
  const wrot = Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
  const sled = B.part([
    { type: 'roundBox', hx: 0.62, hy: 0.06, hz: 0.26, radius: 0.06, material: 'skid' },
    { type: 'box', hx: 0.6, hy: 0.04, hz: 0.3, pos: { x: 0, y: 0.1, z: 0 } },
    { type: 'box', hx: 0.03, hy: 0.16, hz: 0.3, pos: { x: 0.6, y: 0.3, z: 0 }, material: 'felt' },
    { type: 'box', hx: 0.6, hy: 0.14, hz: 0.03, pos: { x: 0, y: 0.28, z: 0.3 } },
    { type: 'box', hx: 0.6, hy: 0.14, hz: 0.03, pos: { x: 0, y: 0.28, z: -0.3 } },
    { type: 'box', hx: 0.03, hy: 0.14, hz: 0.3, pos: { x: -0.6, y: 0.28, z: 0 } },
    ...[[-0.42, -0.34], [-0.42, 0.34], [0.42, -0.34], [0.42, 0.34]].map(([dx, dz]) => ({ type: 'cylinder', hh: 0.04, r: 0.13, rot: wrot, pos: { x: dx, y: 0.02, z: dz }, material: 'rubber', noCollide: true })),
  ], { pos: { x: cx, y: cy, z: 0 }, material: 'paintRed', color: 0xb03a2e, name: 'cart', mass: 90, impactThreshold: 3000, tags: ['hero'], canSleep: false, angularDamping: 0.5 });
  sled.colliders[0].setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);   // the PTFE runner's 0.04 wins against the steel track
  // Kinematic chock in front of the sled; drops away on the strike signal
  const chock = B.part([{ type: 'box', hx: 0.06, hy: 0.12, hz: 0.3 }], { type: 'kinematic', pos: { x: cx + 0.62 + 0.08, y: yt + 0.12 + 0.1, z: 0 }, material: 'paintYellow', color: 0xf1c40f, name: 'chock' });
  let releaseAt = null;
  const downW = B.dirToWorld({ x: 0, y: -1, z: 0 });
  B.animate(chock, (rec, time) => { if (releaseAt === null) return null; const t = clamp((time - releaseAt) / 0.6, 0, 1); return { pos: V.add(rec.base.pos, V.scale(downW, 0.5 * easeInOutCubic(t))) }; });
  S.trigger = () => { if (releaseAt === null) { releaseAt = M.pw.time + 0.4; sled.body.wakeUp(); } };
  M.strikeListeners = M.strikeListeners || [];
  M.strikeListeners.push(() => S.trigger());
  B.sensor({ type: 'box', hx: 0.3, hy: 0.6, hz: 0.6 }, { x: 3.6, y: yt + 0.4, z: 0 }, { name: 'enter:cart', filter: p => p && p.name === 'cart', onEnter: (p, t) => M.reach(S, t) });
  S.hero = sled;
  for (let i = 1; i < track.length; i += 12) {
    const p = track[i];
    for (const z of [-0.62, 0.62]) B.decor([{ type: 'box', hx: 0.08, hy: Math.max(0.3, (p.y - 0.1 - (yt - 7.5)) / 2), hz: 0.08 }], { pos: { x: p.x, y: (p.y - 0.1 + yt - 7.5) / 2, z }, material: 'steel', color: 0x4a4f58 });
  }
  M.cue('cartSpeed', { type: 'box', hx: 0.4, hy: 0.6, hz: 0.6 }, { x: 12.0, y: yt - 4.5, z: 0 }, { filter: p => p && p.name === 'cart' });
  S.focus = { x: 8, y: yt - 2.5, z: 0 };
  return { exit: { pos: { x: 20.5, y: yt - 4.5, z: 0 }, yaw: 0 } };
}
