// Stages 5-8: switchback zigzag, loop-the-loop, paddle wheel, pressure plate + wrecking ball release.
import { V, Q, DEG, easeInOutCubic, clamp } from '../../math.js';
import { linePath, joinPaths, catmullRom, loopPath, quarterTurn } from '../geometry.js';

export function zigzagPlanks(M) {
  const B = M.B;
  const S = M.stage({ name: 'zigzag', title: 'Switchback Descent', blurb: 'Five stacked chutes with rubber bumpers zigzag the ball down three and a half metres.', input: { r: 0.15, material: 'aluminum', speed: 1.0 } });
  M.entrySensor(S, { x: 0.3, y: 0.25, z: 0 }, 0.4);
  const levels = 5, len = 3.6, slope = 0.3, fall = 0.42;
  const xEven = [0.0, 3.6], xOdd = [4.6, 1.0];
  let y = 0;
  let exit = null;
  for (let k = 0; k < levels; k++) {
    const even = k % 2 === 0;
    const [xs, xe] = even ? xEven : xOdd;
    const path = linePath({ x: xs, y, z: 0 }, { x: xe, y: y - slope, z: 0 }, 8);
    B.trough(path, { radius: 0.3, arcDeg: 215, thick: 0.04, material: k % 2 ? 'paintBlue' : 'track' });
    if (k > 0) {
      // rubber bumper at the catching end
      const bx = even ? xs - 0.08 : xs + 0.08;
      B.fixedBox(0.06, 0.32, 0.36, { x: bx, y: y + 0.28, z: 0 }, { material: 'rubber', color: 0x1a1a1a, name: k === 1 ? 'bumper1' : null });
    }
    // support brackets
    for (const x of [xs + (even ? 0.4 : -0.4), xe + (even ? -0.4 : 0.4)]) B.decor([{ type: 'box', hx: 0.04, hy: 0.35, hz: 0.04 }], { pos: { x, y: y - slope / 2 - 0.4, z: 0.45 }, material: 'steel', color: 0x4a4f58 });
    if (k === levels - 1) exit = { x: xe, y: y - slope, even };
    y -= slope + fall;
  }
  // back panel (decor) and side glass so the ball cannot leave the stack
  B.decor([{ type: 'box', hx: 2.6, hy: (levels * (slope + fall)) / 2 + 0.3, hz: 0.03 }], { pos: { x: 2.3, y: -(levels * (slope + fall)) / 2 + 0.2, z: 0.56 }, material: 'darkwood', color: 0x3a2d22 });
  M.cue('zigzagBounce', { type: 'ball', r: 0.4 }, { x: 4.3, y: -0.6, z: 0 });
  S.focus = { x: 2.3, y: -2.0, z: 0 };
  return { exit: { pos: { x: exit.x, y: exit.y, z: 0 }, yaw: exit.even ? 0 : Math.PI } };
}

export function loopTheLoop(M) {
  const B = M.B;
  const S = M.stage({ name: 'loop', title: 'Loop-the-Loop', blurb: 'A 4.7 m plunge feeds a 1.3 m radius vertical loop; the ball needs 3.6 m/s at the top and arrives with 5.5.', input: { r: 0.15, material: 'aluminum', speed: 2.5 } });
  M.entrySensor(S, { x: 0.3, y: 0.25, z: 0 }, 0.4);
  const R = 1.3, drop = 4.75, xc = 7.5, zDrift = 0.8;
  const descent = catmullRom([{ x: -0.6, y: 0.02, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1.6, y: -0.55, z: 0 }, { x: 3.2, y: -2.0, z: 0 }, { x: 4.6, y: -3.6, z: 0 }, { x: 6.0, y: -4.55, z: 0 }, { x: xc, y: -drop, z: 0 }, { x: xc + 1.2, y: -drop, z: 0 }], 12);
  B.trough(descent, { radius: 0.3, arcDeg: 200, thick: 0.04, material: 'track' });
  const loop = loopPath({ cx: xc, cy: -drop + R, radius: R, z0: 0, z1: zDrift, segments: 120 });
  const center = { x: xc, y: -drop + R };
  B.trough(loop, { radius: 0.32, arcDeg: 250, thick: 0.04, material: 'paintRed', upMode: 'custom', upAt: (p) => ({ x: center.x - p.x, y: center.y - p.y, z: 0 }), name: 'loopTrack' });
  const Rt = 1.6;
  const out = joinPaths(linePath({ x: xc - 0.6, y: -drop, z: zDrift }, { x: xc + 2.4, y: -drop - 0.1, z: zDrift }, 6), quarterTurn({ x: xc + 2.4, y: -drop - 0.1, z: zDrift }, Rt, 1, 24, 0.06));
  B.trough(out, { radius: 0.3, arcDeg: 200, thick: 0.04, material: 'track' });
  const outEnd = out[out.length - 1];
  // loop support ring (decor)
  B.decor([{ type: 'cylinder', hh: 0.04, r: R + 0.5 }], { pos: { x: xc, y: center.y, z: zDrift / 2 + 0.55 }, rot: Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2), material: 'steel', color: 0x4a4f58, visual: { ring: true } });
  B.decor([{ type: 'box', hx: 0.06, hy: (center.y + drop + 0.2) / 2 + 0.6, hz: 0.06 }], { pos: { x: xc + R + 0.5, y: center.y / 2 - drop / 2 - 0.1, z: zDrift / 2 + 0.55 }, material: 'steel', color: 0x4a4f58 });
  M.cue('loopTop', { type: 'ball', r: 0.45 }, { x: xc, y: center.y + R, z: zDrift / 2 });
  S.focus = { x: xc, y: center.y, z: zDrift / 2 };
  return { exit: { pos: outEnd, yaw: -Math.PI / 2 } };
}

export function paddleWheel(M) {
  const B = M.B;
  const S = M.stage({ name: 'paddle', title: 'Paddle Wheel', blurb: 'The ball drops through a shaft onto an eight-blade wheel; a rising blade flicks the next ball off its ledge.', input: { r: 0.15, material: 'aluminum', speed: 7.0 } });
  M.entrySensor(S, { x: 0.3, y: 0.25, z: 0 }, 0.4);
  // Level trough into a vertical drop shaft (speed independent landing)
  const shaftX0 = 2.9, shaftX1 = 3.75, shaftTop = 0.4, shaftBot = -1.1;
  B.trough(linePath({ x: -0.4, y: 0.0, z: 0 }, { x: shaftX0 - 0.05, y: -0.02, z: 0 }, 4), { radius: 0.3, arcDeg: 200, thick: 0.04, material: 'track' });
  const sm = (shaftTop + shaftBot) / 2, sh = (shaftTop - shaftBot) / 2;
  B.fixedBox(0.03, sh + 0.3, 0.33, { x: shaftX1, y: sm + 0.3, z: 0 }, { material: 'felt', color: 0x8b1e1e }); // felt-faced back wall kills the bounce
  B.fixedBox(0.03, (shaftTop - 0.5 - shaftBot) / 2, 0.33, { x: shaftX0 - 0.1, y: (shaftTop - 0.5 + shaftBot) / 2, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  for (const z of [-0.33, 0.33]) B.fixedBox((shaftX1 - shaftX0) / 2 + 0.07, sh, 0.03, { x: (shaftX0 + shaftX1) / 2 - 0.05, y: sm, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  // Wheel
  const cx = (shaftX0 + shaftX1) / 2 + 0.6, cy = shaftBot - 1.5;
  const paddles = [];
  const hubRot = Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
  paddles.push({ type: 'cylinder', hh: 0.6, r: 0.22, rot: hubRot, material: 'steel' });
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    paddles.push({ type: 'box', hx: 0.52, hy: 0.02, hz: 0.5, pos: { x: 0.73 * Math.cos(a), y: 0.73 * Math.sin(a), z: 0 }, rot: Q.axisAngle({ x: 0, y: 0, z: 1 }, a), material: 'plastic' });
  }
  const wheel = B.part(paddles, { pos: { x: cx, y: cy, z: 0 }, material: 'plastic', color: 0xd94f2b, name: 'wheel', impactThreshold: 600 });
  B.revolute(B.anchor({ x: cx, y: cy, z: 0 }), wheel, { x: cx, y: cy, z: 0 }, { x: 0, y: 0, z: 1 }, { motorVel: 0, motorFactor: 1.5 });
  // axle supports (decor)
  for (const z of [-0.8, 0.8]) {
    B.decor([{ type: 'cylinder', hh: 0.1, r: 0.08 }], { pos: { x: cx, y: cy, z }, rot: hubRot, material: 'steel', color: 0x8a8f99 });
    B.decor([{ type: 'box', hx: 0.06, hy: 1.2, hz: 0.06 }], { pos: { x: cx, y: cy - 1.2, z }, material: 'steel', color: 0x4a4f58 });
  }
  // Catch bin for the spent ball under the wheel
  B.fixedBox(1.4, 0.05, 0.8, { x: cx, y: cy - 2.45, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(0.05, 0.4, 0.8, { x: cx - 1.4, y: cy - 2.05, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(0.05, 0.4, 0.8, { x: cx + 1.4, y: cy - 2.05, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  for (const z of [-0.8, 0.8]) B.fixedBox(1.4, 0.4, 0.05, { x: cx, y: cy - 2.05, z }, { material: 'steel', color: 0x3b3f46 });
  // Ball E on a ledge at the wheel's rising side (the blade tips clip its lower-left quadrant)
  const rE = 0.12, RE = 1.32, ang = 20 * DEG;
  const ex = cx + RE * Math.cos(ang), ey = cy + RE * Math.sin(ang);
  const ledgeTop = ey - rE;
  const ledgeX0 = ex - 0.02, ledgeX1 = ex + 1.8;
  B.trough(joinPaths(linePath({ x: ledgeX0, y: ledgeTop, z: 0 }, { x: ledgeX0 + 0.25, y: ledgeTop, z: 0 }, 2), linePath({ x: ledgeX0 + 0.25, y: ledgeTop, z: 0 }, { x: ledgeX1, y: ledgeTop - 0.09, z: 0 }, 5)),
    { radius: 0.2, arcDeg: 170, thick: 0.04, material: 'track' });
  const E = B.ball(rE, { x: ex, y: ey, z: 0 }, { name: 'E', material: 'steel', impactThreshold: 2000, tags: ['hero'] });
  S.hero = E;
  M.cue('wheelHit', { type: 'box', hx: 0.6, hy: 0.3, hz: 0.5 }, { x: cx - 0.6, y: cy + 1.0, z: 0 });
  S.focus = { x: cx, y: cy, z: 0 };
  return { exit: { pos: { x: ledgeX1, y: ledgeTop - 0.09, z: 0 }, yaw: 0 } };
}

export function pressurePlateRelease(M) {
  const B = M.B;
  const S = M.stage({ name: 'plate', title: 'Pressure Plate', blurb: 'A 57 kg sphere compresses a sprung plate; the switch retracts the hook holding a 1.4-tonne wrecking ball.', input: { r: 0.12, material: 'steel', speed: 1.0 } });
  M.entrySensor(S, { x: 0.3, y: 0.2, z: 0 }, 0.4);
  // Ramp to the plate
  const plateX = 3.4, plateTop = -1.0;
  B.trough(catmullRom([{ x: -0.6, y: 0.03, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1.5, y: -0.45, z: 0 }, { x: 2.6, y: -0.9, z: 0 }, { x: plateX - 0.45, y: plateTop + 0.01, z: 0 }], 10), { radius: 0.2, arcDeg: 180, thick: 0.035, material: 'track' });
  // Sprung plate (dynamic cup on a vertical prismatic joint)
  const plate = B.part([
    { type: 'box', hx: 0.45, hy: 0.04, hz: 0.45 },
    { type: 'box', hx: 0.03, hy: 0.16, hz: 0.45, pos: { x: 0.42, y: 0.2, z: 0 }, material: 'felt' },
    { type: 'box', hx: 0.45, hy: 0.16, hz: 0.03, pos: { x: 0, y: 0.2, z: 0.42 } },
    { type: 'box', hx: 0.45, hy: 0.16, hz: 0.03, pos: { x: 0, y: 0.2, z: -0.42 } },
    { type: 'box', hx: 0.03, hy: 0.03, hz: 0.45, pos: { x: -0.42, y: 0.07, z: 0 } },
  ], { pos: { x: plateX, y: plateTop - 0.04, z: 0 }, material: 'paintRed', color: 0xc0392b, name: 'plate', mass: 8, impactThreshold: 800 });
  const plateAnchor = B.anchor({ x: plateX, y: plateTop - 0.04, z: 0 });
  B.prismatic(plateAnchor, plate, { x: plateX, y: plateTop - 0.04, z: 0 }, { x: 0, y: 1, z: 0 }, { limits: [-0.12, 0.0], springPos: 0, stiffness: 3500, damping: 300 });
  // housing under the plate
  B.fixedBox(0.5, 0.3, 0.5, { x: plateX, y: plateTop - 0.5, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.decor([{ type: 'cylinder', hh: 1.0, r: 0.12 }], { pos: { x: plateX, y: plateTop - 1.8, z: 0 }, material: 'steel', color: 0x4a4f58 });
  // Wrecking ball: rigid rod pendulum in the plane z = -1.6, resting on a kinematic hook
  const L = 5.0, rW = 0.35, zW = -1.6, yT = -1.6;
  const xW = 6.0, pivot = { x: xW, y: yT + rW + 0.1 + L, z: zW };
  const th0 = 60 * DEG;
  const rest = { x: xW - L * Math.sin(th0), y: pivot.y - L * Math.cos(th0), z: zW };
  const W = B.ball(rW, rest, { name: 'W', material: 'steel', impactThreshold: 20000, angularDamping: 0.05, tags: ['hero'], visual: { rod: { pivot: B.toWorld(pivot) } } });
  B.revolute(B.anchor(pivot), W, pivot, { x: 0, y: 0, z: 1 });
  S.hero = W;
  const tan = { x: Math.cos(th0), y: -Math.sin(th0) };           // direction of travel along the arc from rest
  const hookPos = { x: rest.x + (rW + 0.11) * tan.x, y: rest.y + (rW + 0.11) * tan.y, z: zW };
  const hook = B.part([{ type: 'box', hx: 0.1, hy: 0.12, hz: 0.5 }], { type: 'kinematic', pos: hookPos, rot: Q.axisAngle({ x: 0, y: 0, z: 1 }, -th0), material: 'steel', color: 0xf1c40f, name: 'hook' });
  const radialOut = B.dirToWorld({ x: -Math.sin(th0), y: -Math.cos(th0), z: 0 }); // world-space retract direction
  let releaseAt = null;
  B.animate(hook, (rec, time) => {
    if (releaseAt === null) return null;
    const t = clamp((time - releaseAt) / 0.5, 0, 1), d = 1.2 * easeInOutCubic(t);
    return { pos: V.add(rec.base.pos, V.scale(radialOut, d)) };
  });
  // The switch: a sensor just under the plate's rest position, triggered by the plate body when compressed
  B.sensor({ type: 'box', hx: 0.3, hy: 0.01, hz: 0.3 }, { x: plateX, y: plateTop - 0.04 - 0.125, z: 0 }, {
    name: 'plateSwitch', filter: p => p === plate, onEnter: (p, t) => { if (releaseAt === null) { releaseAt = t + 0.3; M.emit('event', 'plateSwitch', plate, t); } },
  });
  // Gantry (decor)
  B.decor([{ type: 'box', hx: 0.12, hy: 0.12, hz: 1.4 }], { pos: { x: pivot.x, y: pivot.y + 0.15, z: zW }, material: 'steel', color: 0x4a4f58 });
  for (const dz of [-1.3, 1.3]) B.decor([{ type: 'box', hx: 0.12, hy: (pivot.y + 0.1 - (yT - 0.6)) / 2, hz: 0.12 }], { pos: { x: pivot.x, y: (pivot.y + 0.1 + yT - 0.6) / 2, z: zW + dz }, material: 'steel', color: 0x4a4f58 });
  M.cue('hookRelease', { type: 'ball', r: 0.6 }, { x: rest.x + 1.0, y: rest.y - 0.8, z: zW }, { filter: p => p && p.name === 'W' });
  S.focus = { x: plateX, y: plateTop, z: 0 };
  // Exit: on the tower platform, just before the arc bottom, in the wrecking plane
  return { exit: { pos: { x: xW - 0.6, y: yT, z: zW }, yaw: 0 } };
}
