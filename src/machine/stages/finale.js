// Stages 17-20: hammer chain, marble cascade, vortex funnel, trophy case finale.
import { V, Q, DEG, easeInOutCubic, clamp, rng } from '../../math.js';
import { linePath, joinPaths, catmullRom, revolve, extrudeProfile, rectProfile } from '../geometry.js';

export function hammerChain(M) {
  const B = M.B;
  const S = M.stage({ name: 'hammers', title: 'Hammer Chain', blurb: 'The cart slams into the first of six hinged hammers; the last one drops onto the big red button.', input: { r: 0.3, material: 'steel', speed: 8.0 } });
  M.entrySensor(S, { x: 0.4, y: 0.4, z: 0 }, 0.6, p => p && p.name === 'cart');
  // track continues level, then the bumper
  B.trough(linePath({ x: -0.5, y: 0.0, z: 0 }, { x: 2.3, y: 0.0, z: 0 }, 3), { radius: 0.55, arcDeg: 150, thick: 0.08, material: 'track' });
  B.fixedBox(0.15, 0.2, 0.55, { x: 2.55, y: 0.2, z: 0 }, { material: 'rubber', color: 0x1a1a1a, name: 'bumper' });
  // Floor plate for the hammer row
  B.fixedBox(5.0, 0.1, 1.0, { x: 6.8, y: -0.1, z: 0 }, { material: 'concrete', color: 0x6a6f78 });
  // Hammers: bar + steel head, pivot at the base, resting 4 degrees back against a post
  const n = 6, pitch = 1.3, barH = 1.6, x1 = 2.0;
  for (let k = 0; k < n; k++) {
    const x = x1 + k * pitch;
    const rest = 4 * DEG;
    const rot = Q.axisAngle({ x: 0, y: 0, z: 1 }, rest);
    const pivot = { x, y: 0.06, z: 0 };
    const hammer = B.part([
      { type: 'box', hx: 0.05, hy: barH / 2, hz: 0.12, pos: { x: 0, y: barH / 2, z: 0 }, material: 'wood' },
      { type: 'box', hx: 0.14, hy: 0.14, hz: 0.18, pos: { x: 0, y: barH + 0.08, z: 0 }, material: 'steel' },
    ], { pos: pivot, rot, material: 'wood', color: 0xb98a5a, name: 'hammer' + k, impactThreshold: 1200, angularDamping: 0.1 });
    B.revolute(B.anchor(pivot), hammer, pivot, { x: 0, y: 0, z: 1 }, { limits: [-105 * DEG, rest + 0.5 * DEG] });
    B.decor([{ type: 'box', hx: 0.08, hy: 0.03, hz: 0.3 }], { pos: { x, y: 0.03, z: 0 }, material: 'steel', color: 0x4a4f58 }); // base bracket (visual)
    B.decor([{ type: 'box', hx: 0.04, hy: 0.5, hz: 0.04 }], { pos: { x: x - 0.17, y: 0.5, z: 0.25 }, material: 'steel', color: 0x4a4f58 }); // rest post (visual)
  }
  // Big red button: sprung plate on a pedestal, switch underneath
  const bxp = x1 + (n - 1) * pitch + 1.25, btop = 0.62;
  B.fixedBox(0.35, 0.25, 0.35, { x: bxp, y: 0.25, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  const button = B.part([{ type: 'cylinder', hh: 0.06, r: 0.3 }], { pos: { x: bxp, y: btop - 0.06, z: 0 }, material: 'paintRed', color: 0xe0202a, name: 'button', mass: 6, impactThreshold: 500 });
  B.prismatic(B.anchor({ x: bxp, y: btop - 0.06, z: 0 }), button, { x: bxp, y: btop - 0.06, z: 0 }, { x: 0, y: 1, z: 0 }, { limits: [-0.1, 0], springPos: 0, stiffness: 2500, damping: 200 });
  let pressed = false;
  B.sensor({ type: 'box', hx: 0.2, hy: 0.01, hz: 0.2 }, { x: bxp, y: btop - 0.06 - 0.1, z: 0 }, { name: 'buttonSwitch', filter: p => p === button, onEnter: (p, t) => { if (!pressed) { pressed = true; M.emit('event', 'button', button, t); for (const f of M.buttonListeners || []) f(t); } } });
  M.cue('hammerMid', { type: 'ball', r: 0.4 }, { x: x1 + 2.5 * pitch + 0.6, y: 1.0, z: 0 }, { filter: p => p && p.name && p.name.startsWith('hammer') });
  S.hero = button;
  S.focus = { x: x1 + 2.5 * pitch, y: 0.8, z: 0 };
  return { exit: { pos: { x: bxp + 1.2, y: 0, z: 0 }, yaw: 0 } };
}

export function marbleCascade(M) {
  const B = M.B;
  const S = M.stage({ name: 'marbles', title: 'Marble Cascade', blurb: 'The button opens a hopper: sixty steel marbles rain through a peg field into a bucket that tips the gate.', input: { r: 0.05, material: 'steel', speed: 0 } });
  // Hopper high above the origin
  const hx = 2.0, hy = 4.6, slot = 0.16;
  const hz = 0.3; // hopper half-depth in z (matches the peg-field glass)
  B.slab({ x: hx - 0.7, y: hy + 0.55, z: 0 }, { x: hx - slot / 2, y: hy, z: 0 }, hz * 2, 0.03, { material: 'steel', color: 0x8a8f99 });
  B.slab({ x: hx + 0.7, y: hy + 0.55, z: 0 }, { x: hx + slot / 2, y: hy, z: 0 }, hz * 2, 0.03, { material: 'steel', color: 0x8a8f99 });
  for (const z of [-hz - 0.015, hz + 0.015]) B.fixedBox(0.72, 0.7, 0.015, { x: hx, y: hy + 0.6, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  for (const sx of [-1, 1]) B.fixedBox(0.03, 0.45, hz, { x: hx + sx * 0.72, y: hy + 0.85, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  for (const z of [-hz - 0.015, hz + 0.015]) B.fixedBox(0.12, 0.12, 0.015, { x: hx, y: hy - 0.1, z }, { material: 'steel', color: 0x8a8f99 }); // slot end caps
  // slot walls (short vertical channel) and the kinematic door
  for (const sx of [-1, 1]) B.fixedBox(0.02, 0.1, hz, { x: hx + sx * (slot / 2 + 0.02), y: hy - 0.1, z: 0 }, { material: 'steel', color: 0x8a8f99 });
  const door = B.part([{ type: 'box', hx: 0.2, hy: 0.02, hz: hz + 0.05 }], { type: 'kinematic', pos: { x: hx, y: hy - 0.22, z: 0 }, material: 'paintRed', color: 0xc0392b, name: 'hopperDoor' });
  let openAt = null;
  const slideW = B.dirToWorld({ x: 0, y: 0, z: 1 });
  B.animate(door, (rec, time) => {
    if (openAt === null) return null;
    const t = clamp((time - openAt) / 0.9, 0, 1);
    return { pos: V.add(rec.base.pos, V.scale(slideW, 1.1 * easeInOutCubic(t))) };
  });
  const marbleParts = [];
  S.trigger = () => { if (openAt === null) { openAt = M.pw.time + 0.4; for (const m of marbleParts) m.body.wakeUp(); } };
  M.buttonListeners = M.buttonListeners || [];
  M.buttonListeners.push(() => S.trigger());
  // Marbles in a loose grid inside the hopper
  const rand = rng(7);
  const rm = 0.05;
  let count = 0;
  for (let layer = 0; layer < 5; layer++) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const px = hx - 0.33 + i * 0.22 + (rand() - 0.5) * 0.03, pz = -0.18 + j * 0.18 + (rand() - 0.5) * 0.03, py = hy + 0.5 + layer * 0.13 + (i % 2) * 0.04;
    marbleParts.push(B.ball(rm, { x: px, y: py, z: pz }, { material: 'steel', instanceKey: 'marble', color: 0xcfd3d8, impactThreshold: 500, canSleep: true, angularDamping: 0.3, name: count === 0 ? 'marble0' : null }));
    count++;
  }
  // Peg field below the hopper
  const pegRot = Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
  for (let r = 0; r < 7; r++) {
    const y = hy - 0.7 - r * 0.4;
    for (let i = -3; i <= 3; i++) {
      const px = hx + i * 0.3 + (r % 2) * 0.15;
      B.part([{ type: 'cylinder', hh: 0.3, r: 0.03, rot: pegRot }], { type: 'fixed', pos: { x: px, y, z: 0 }, material: 'chrome', instanceKey: 'peg', color: 0xd0d4da });
    }
  }
  for (const z of [-0.33, 0.33]) B.fixedBox(1.3, 1.85, 0.02, { x: hx, y: hy - 2.15, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } }); // bottom edge 8 cm above the bucket rim
  for (const sx of [-1, 1]) B.fixedBox(0.02, 1.6, 0.33, { x: hx + sx * 1.3, y: hy - 1.9, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  // Balance beam with a wide bucket under the peg field; gate holds the golden ball
  const pivot = { x: hx + 2.6, y: hy - 4.1, z: 0 };
  const bb = balanceBeam2(B, { pivot, arm: 2.6, bucketW: 1.5, bucketD: 1.0, bucketH: 0.7, ballR: 0.12, ballMaterial: 'gold', ballName: 'G', troughRadius: 0.18 });
  // funnel walls guiding marbles from the peg field into the bucket
  B.slab({ x: hx - 1.35, y: hy - 3.45, z: 0 }, { x: hx - 0.6, y: hy - 3.98, z: 0 }, 0.66, 0.03, { material: 'steel', color: 0x8a8f99 });
  B.slab({ x: hx + 1.35, y: hy - 3.45, z: 0 }, { x: hx + 0.6, y: hy - 3.98, z: 0 }, 0.66, 0.03, { material: 'steel', color: 0x8a8f99 });
  M.entrySensor(S, { x: hx, y: hy - 1.1, z: 0 }, 0.3, p => p && p.instanceKey === 'marble');
  M.cue('marbleRain', { type: 'box', hx: 1.2, hy: 0.2, hz: 0.3 }, { x: hx, y: hy - 2.5, z: 0 }, { filter: p => p && p.instanceKey === 'marble' });
  M.cue('goldRelease', { type: 'ball', r: 0.3 }, { x: bb.exit.x - 1.5, y: bb.exit.y + 0.2, z: 0 }, { filter: p => p && p.name === 'G' });
  S.hero = bb.ball;
  S.focus = { x: hx, y: hy - 2.0, z: 0 };
  return { exit: { pos: { x: bb.exit.x, y: bb.exit.y, z: 0 }, yaw: 0 } };
}

// Local copy of the balance beam (kept in sync with demolition.js) so the finale module stays self-contained.
function balanceBeam2(B, { pivot, arm, bucketW, bucketD, bucketH, gateH = 0.7, ballR, ballMaterial, ballName, troughRadius }) {
  const beamH = 0.1;
  const stemLen = 0.9 - ballR;          // bar (gate) sits 0.9 m under the beam tip minus the ball radius -> at ball-centre height
  const shapes = [
    { type: 'box', hx: arm + 0.3, hy: beamH / 2, hz: 0.15, material: 'wood' },
    { type: 'box', hx: bucketW / 2, hy: 0.01, hz: bucketD / 2, pos: { x: -arm, y: -bucketH - 0.01, z: 0 }, material: 'wood' },
    { type: 'box', hx: 0.01, hy: bucketH / 2, hz: bucketD / 2, pos: { x: -arm - bucketW / 2, y: -bucketH / 2, z: 0 }, material: 'wood' },
    { type: 'box', hx: 0.01, hy: bucketH / 2, hz: bucketD / 2, pos: { x: -arm + bucketW / 2, y: -bucketH / 2, z: 0 }, material: 'wood' },
    { type: 'box', hx: bucketW / 2, hy: bucketH / 2, hz: 0.01, pos: { x: -arm, y: -bucketH / 2, z: bucketD / 2 }, material: 'wood' },
    { type: 'box', hx: bucketW / 2, hy: bucketH / 2, hz: 0.01, pos: { x: -arm, y: -bucketH / 2, z: -bucketD / 2 }, material: 'wood' },
    // gate: a thin stem hanging from the beam tip into the open top of the trough, ending in a bar at ball-centre height
    { type: 'box', hx: 0.02, hy: stemLen / 2, hz: 0.02, pos: { x: arm, y: -beamH / 2 - stemLen / 2, z: 0 }, material: 'steel' },
    { type: 'box', hx: 0.02, hy: 0.02, hz: troughRadius - 0.03, pos: { x: arm, y: -beamH / 2 - stemLen, z: 0 }, material: 'steel' },
    // counterweight on the gate side: the beam rests gate-down by roughly one block's worth of torque
    { type: 'box', hx: 0.08, hy: 0.08, hz: 0.22, pos: { x: arm - 0.35, y: beamH / 2 + 0.08, z: 0 }, material: 'steel' },
  ];
  const beam = B.part(shapes, { pos: pivot, material: 'wood', color: 0xb98a5a, name: ballName + 'Beam', impactThreshold: 1500, angularDamping: 0.3 });
  B.revolute(B.anchor(pivot), beam, pivot, { x: 0, y: 0, z: 1 }, { limits: [-14 * DEG, 14 * DEG] });
  B.fixedBox(0.15, 0.15, 0.6, { x: pivot.x, y: pivot.y - 0.3, z: 0 }, { material: 'steel', color: 0x4a4f58 });
  B.decor([{ type: 'box', hx: 0.1, hy: 2.0, hz: 0.1 }], { pos: { x: pivot.x, y: pivot.y - 2.3, z: 0 }, material: 'steel', color: 0x4a4f58 });
  const restAng = -4 * DEG;
  const barY = pivot.y + arm * Math.sin(restAng) - beamH / 2 - stemLen * Math.cos(restAng);   // bar centre height at rest
  B.fixedBox(0.12, 0.05, 0.4, { x: pivot.x + arm + 0.2, y: pivot.y + (arm + 0.2) * Math.sin(restAng) - beamH / 2 - 0.05 - 0.01, z: 0 }, { material: 'rubber', color: 0x222222 }); // under the beam tip, clear of the plate
  const gx = pivot.x + arm * Math.cos(restAng) + stemLen * Math.sin(-restAng);   // bar x at rest (stem swings slightly)
  const floorY = barY - ballR;        // ball centre at bar height
  const xBall = gx - 0.02 - ballR - 0.01;
  B.trough(joinPaths(linePath({ x: xBall - 0.8, y: floorY + 0.03, z: 0 }, { x: gx + 0.4, y: floorY, z: 0 }, 4), linePath({ x: gx + 0.4, y: floorY, z: 0 }, { x: gx + 2.4, y: floorY - 0.08, z: 0 }, 4)), { radius: troughRadius, arcDeg: 180, thick: 0.035, material: 'track' });
  const ball = B.ball(ballR, { x: xBall, y: floorY + ballR, z: 0 }, { name: ballName, material: ballMaterial, impactThreshold: 1500, tags: ['hero'], angularDamping: 0.6 });
  return { beam, ball, exit: { x: gx + 2.4, y: floorY - 0.08 } };
}

export function vortexFunnel(M) {
  const B = M.B;
  const S = M.stage({ name: 'vortex', title: 'Gravity Well', blurb: 'The golden ball enters a hyperbolic funnel on a tangent and spirals for several orbits before dropping through the eye.', input: { r: 0.12, material: 'gold', speed: 2.0 } });
  M.entrySensor(S, { x: 0.3, y: 0.2, z: 0 }, 0.5);
  const R = 2.4, rh = 0.25, depth = 1.6, cx = 3.0, cz = R + 0.2, yRim = -0.27;
  // entry trough curving to run tangentially at r = 2.2 (z = 0.4), ending inside the rim wall
  const path = catmullRom([{ x: -0.5, y: 0.02, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0.8, y: -0.06, z: 0.12 }, { x: 1.7, y: -0.15, z: 0.38 }, { x: 2.6, y: -0.24, z: 0.4 }, { x: cx + 0.3, y: yRim - 0.04, z: 0.4 }], 10);
  B.trough(path, { radius: 0.2, arcDeg: 200, thick: 0.035, material: 'track' });
  // hyperbolic funnel profile: y(r) = yRim - a (1/r - 1/R)
  const a = depth / (1 / rh - 1 / R);
  const prof = [];
  const wallTop = yRim + 0.4, th = 0.06;
  const N = 28;
  for (let i = 0; i <= N; i++) { const r = R - (R - rh) * Math.pow(i / N, 1.4); prof.push({ x: r, y: yRim - a * (1 / r - 1 / R) }); }
  prof.push({ x: rh, y: yRim - depth - 0.45 });
  prof.push({ x: rh + th, y: yRim - depth - 0.45 });
  for (let i = N; i >= 0; i--) { const r = R - (R - rh) * Math.pow(i / N, 1.4); prof.push({ x: r + th, y: yRim - a * (1 / r - 1 / R) - th }); }
  B.mesh(revolve(prof, 96), { pos: { x: cx, y: 0, z: cz }, material: 'brass', color: 0xc9a227, name: 'vortexFunnel' });
  // rim wall with a 32 degree gap where the entry trough comes through (around -114 degrees)
  const wallProf = [{ x: R, y: yRim - 0.02 }, { x: R, y: wallTop }, { x: R + th, y: wallTop }, { x: R + th, y: yRim - 0.02 }];
  const gapC = Math.atan2(0.4 - cz, 2.04 - cx), gapHalf = 16 * DEG;
  B.mesh(revolve(wallProf, 96, { a0: gapC + gapHalf, a1: gapC - gapHalf + Math.PI * 2 }), { pos: { x: cx, y: 0, z: cz }, material: 'brass', color: 0xc9a227, name: 'vortexRim' });
  // pedestal legs (decor)
  for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4; B.decor([{ type: 'box', hx: 0.08, hy: 1.8, hz: 0.08 }], { pos: { x: cx + (R - 0.3) * Math.cos(an), y: yRim - depth - 1.0, z: cz + (R - 0.3) * Math.sin(an) }, material: 'steel', color: 0x4a4f58 }); }
  M.cue('vortexOrbit', { type: 'ball', r: 0.5 }, { x: cx - R + 0.5, y: yRim - 0.3, z: cz });
  M.cue('vortexEye', { type: 'ball', r: 0.35 }, { x: cx, y: yRim - depth - 0.2, z: cz });
  S.focus = { x: cx, y: yRim - 0.5, z: cz };
  // Exit: a trough directly below the eye catches the ball
  return { exit: { pos: { x: cx, y: yRim - depth - 0.95, z: cz }, yaw: 0 } };
}

export function trophyCase(M) {
  const B = M.B;
  const S = M.stage({ name: 'trophy', title: 'Trophy Case', blurb: 'The golden ball drops into the cup of the pixel trophy. Lights, confetti, applause.', input: { r: 0.12, material: 'gold', speed: 0.5 } });
  // ball falls from the eye above onto the trough start
  B.trough(catmullRom([{ x: -0.6, y: 0.05, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1.2, y: -0.12, z: 0 }, { x: 2.2, y: -0.3, z: 0 }, { x: 2.9, y: -0.36, z: 0 }], 8), { radius: 0.2, arcDeg: 200, thick: 0.035, material: 'track' });
  B.fixedBox(0.03, 0.4, 0.25, { x: -0.63, y: 0.35, z: 0 }, { material: 'track' }); // backstop under the eye
  // Trophy cup (bowl) on top of the pixel trophy; the trough ends over its rim
  const tx = 3.45, cupTop = -0.5;
  const bowl = revolve([{ x: 0.42, y: 0 }, { x: 0.36, y: -0.26 }, { x: 0.2, y: -0.34 }, { x: 0.0, y: -0.36 }, { x: 0.0, y: -0.42 }, { x: 0.22, y: -0.4 }, { x: 0.4, y: -0.32 }, { x: 0.47, y: 0 }], 48);
  // the pixel trophy body is rendered from voxels; physics: the bowl + a pedestal column + base plate, one kinematic body
  // (the bowl must ride with the pedestal, otherwise the rising column lifts the ball out of a fixed bowl)
  const pedestal = B.part([
    { type: 'trimesh', geom: bowl, pos: { x: 0, y: 0.42, z: 0 } },
    { type: 'box', hx: 0.3, hy: 0.6, hz: 0.3, pos: { x: 0, y: -0.6, z: 0 } },
    { type: 'box', hx: 0.9, hy: 0.1, hz: 0.9, pos: { x: 0, y: -1.3, z: 0 } },
  ], { type: 'kinematic', pos: { x: tx, y: cupTop - 0.42, z: 0 }, material: 'gold', color: 0xffc83d, name: 'pedestal', visual: { trophy: true } });
  let finaleAt = null;
  const upW = B.dirToWorld({ x: 0, y: 1, z: 0 }), axisW = B.dirToWorld({ x: 0, y: 1, z: 0 });
  B.animate(pedestal, (rec, time) => {
    if (finaleAt === null) return null;
    const t = time - finaleAt;
    const rise = 0.6 * easeInOutCubic(clamp((t - 0.5) / 2.5, 0, 1));
    const spin = Math.max(0, t - 1.0) * 0.35;
    return { pos: V.add(rec.base.pos, V.scale(upW, rise)), rot: Q.mul(Q.axisAngle(axisW, spin), rec.base.rot) };
  });
  B.sensor({ type: 'ball', r: 0.25 }, { x: tx, y: cupTop - 0.15, z: 0 }, { name: 'trophySensor', filter: p => p && (p.name === 'G' || p.name === 'TEST'), onEnter: (p, t) => { if (finaleAt === null) { finaleAt = t; M.reach(S, t); } } });
  // Glass case: floor plinth, three glass walls, two kinematic doors at the front (+z) that close after the finale
  const cw = 1.6, ch = 2.3, cd = 1.6, cy0 = cupTop - 1.7;
  B.fixedBox(cw, 0.15, cd, { x: tx, y: cy0 - 0.15, z: 0 }, { material: 'marble', color: 0x2b2b30 });
  B.fixedBox(0.02, ch / 2, cd, { x: tx + cw, y: cy0 + ch / 2, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  const lowH = (cupTop - 0.75) - cy0;  // entry-side wall stops below the incoming trough
  B.fixedBox(0.02, lowH / 2, cd, { x: tx - cw, y: cy0 + lowH / 2, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  B.fixedBox(cw, ch / 2, 0.02, { x: tx, y: cy0 + ch / 2, z: -cd }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  // top frame: four thin rails (not a lid) so the camera can look down into the case
  const railY = cy0 + ch + 0.04;
  B.decor([
    { type: 'box', hx: cw + 0.05, hy: 0.04, hz: 0.05, pos: { x: 0, y: 0, z: cd } }, { type: 'box', hx: cw + 0.05, hy: 0.04, hz: 0.05, pos: { x: 0, y: 0, z: -cd } },
    { type: 'box', hx: 0.05, hy: 0.04, hz: cd, pos: { x: cw, y: 0, z: 0 } }, { type: 'box', hx: 0.05, hy: 0.04, hz: cd, pos: { x: -cw, y: 0, z: 0 } },
  ], { pos: { x: tx, y: railY, z: 0 }, material: 'steel', color: 0x3b3f46 });
  for (const sx of [-1, 1]) {
    const hinge = { x: tx + sx * cw, y: cy0 + ch / 2, z: cd };
    const doorOpenRot = Q.yaw(sx * 95 * DEG);
    const door = B.part([{ type: 'box', hx: cw / 2, hy: ch / 2, hz: 0.02, pos: { x: -sx * cw / 2, y: 0, z: 0 } }], { type: 'kinematic', pos: hinge, rot: doorOpenRot, material: 'glass', color: 0xaad4ff, name: 'door' + (sx < 0 ? 'L' : 'R'), visual: { glass: true } });
    B.animate(door, (rec, time) => {
      if (finaleAt === null) return null;
      const t = clamp((time - finaleAt - 4.0) / 2.5, 0, 1);
      return { rot: Q.mul(B.frame.rot, Q.yaw(sx * 95 * DEG * (1 - easeInOutCubic(t)))) };
    });
  }
  // Marquee letters (decor) above the case: PIXEL TROPHY CASE (rendered as voxel text)
  B.decor([{ type: 'box', hx: 2.6, hy: 0.35, hz: 0.1 }], { pos: { x: tx, y: cy0 + ch + 0.7, z: -cd }, material: 'steel', color: 0x1e2128, visual: { marquee: 'PIXEL TROPHY CASE' } });
  S.hero = pedestal;
  S.focus = { x: tx, y: cupTop - 0.6, z: 0 };
  return { exit: { pos: { x: tx, y: cupTop, z: 0 }, yaw: 0 } };
}
