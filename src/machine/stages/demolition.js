// Stages 9-11: wrecking-ball block tower, debris-driven balance gate, Plinko board.
import { V, Q, DEG } from '../../math.js';
import { linePath, joinPaths, catmullRom } from '../geometry.js';

export function wreckingBall(M) {
  const B = M.B;
  const S = M.stage({ name: 'wrecking', title: 'Wrecking Ball', blurb: 'The 1.4-tonne ball sweeps through a thirty-block timber tower at 9 m/s.', input: { r: 0.35, material: 'steel', speed: 8.0 } });
  // Reached when the wrecking ball passes through the tower footprint
  B.sensor({ type: 'box', hx: 0.5, hy: 0.8, hz: 0.8 }, { x: 0.3, y: 0.8, z: 0 }, { name: 'enter:wrecking', filter: p => p && (p.name === 'W' || p.name === 'TEST'), onEnter: (p, t) => M.reach(S, t) });
  // Platform (top at y = 0) spanning the arc bottom and the debris run-off
  B.fixedBox(2.6, 0.2, 1.2, { x: 1.4, y: -0.2, z: 0 }, { material: 'concrete', color: 0x6a6f78 });
  B.decor([{ type: 'box', hx: 2.6, hy: 0.2, hz: 1.2 }], { pos: { x: 1.4, y: -0.6, z: 0 }, material: 'concrete', color: 0x50545b });
  // Jenga-style tower: 10 layers x 3 blocks, alternating orientation
  const bl = 0.75, bw = 0.25, bh = 0.15, tx = 0.9, layers = 10;
  for (let L = 0; L < layers; L++) {
    const y = bh / 2 + L * bh + 0.002 * L;
    for (let i = -1; i <= 1; i++) {
      const alongX = L % 2 === 0;
      const pos = alongX ? { x: tx, y, z: i * bw } : { x: tx + i * bw, y, z: 0 };
      const rot = alongX ? Q.identity() : Q.yaw(Math.PI / 2);
      B.part([{ type: 'box', hx: bl / 2, hy: bh / 2, hz: bw / 2 - 0.002 }], { pos, rot, material: 'wood', instanceKey: 'block', color: (L + i) % 2 ? 0xc9a070 : 0xb98a5a, impactThreshold: 1500, name: L === layers - 1 && i === 0 ? 'topBlock' : null });
    }
  }
  // Low kerbs keep debris on the platform until the run-off edge
  for (const z of [-1.2, 1.2]) B.fixedBox(2.6, 0.15, 0.04, { x: 1.4, y: 0.15, z }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(0.04, 0.18, 1.2, { x: -1.2, y: 0.18, z: 0 }, { material: 'steel', color: 0x3b3f46 }); // low back stop (clear of the ball's arc)
  M.cue('towerSmash', { type: 'ball', r: 0.7 }, { x: tx, y: 0.8, z: 0 }, { filter: p => p && (p.name === 'W' || p.name === 'TEST') });
  S.focus = { x: tx, y: 0.8, z: 0 };
  return { exit: { pos: { x: 4.0, y: 0, z: 0 }, yaw: 0 } };
}

/** Shared mechanism: a beam on a pivot; a bucket at one end, a gate plate at the other holding a ball on a trough. */
function balanceBeam(B, M, { pivot, arm = 2.5, bucketW = 1.2, bucketD = 1.0, bucketH = 0.6, gateH = 0.7, ballR, ballMaterial, ballName, troughRadius, tags = [] }) {
  const beamH = 0.1;
  const stemLen = 0.9 - ballR;          // bar (gate) sits 0.9 m under the beam tip minus the ball radius -> at ball-centre height
  const shapes = [
    { type: 'box', hx: arm + 0.3, hy: beamH / 2, hz: 0.15, material: 'wood' },
    // thin-walled bucket hanging under the left end (~55 kg)
    { type: 'box', hx: bucketW / 2, hy: 0.01, hz: bucketD / 2, pos: { x: -arm, y: -bucketH - 0.01, z: 0 }, material: 'wood' },
    { type: 'box', hx: 0.01, hy: bucketH / 2, hz: bucketD / 2, pos: { x: -arm - bucketW / 2, y: -bucketH / 2, z: 0 }, material: 'wood' },
    { type: 'box', hx: 0.01, hy: bucketH / 2, hz: bucketD / 2, pos: { x: -arm + bucketW / 2, y: -bucketH / 2, z: 0 }, material: 'wood' },
    { type: 'box', hx: bucketW / 2, hy: bucketH / 2, hz: 0.01, pos: { x: -arm, y: -bucketH / 2, z: bucketD / 2 }, material: 'wood' },
    { type: 'box', hx: bucketW / 2, hy: bucketH / 2, hz: 0.01, pos: { x: -arm, y: -bucketH / 2, z: -bucketD / 2 }, material: 'wood' },
    // steel gate plate hanging under the right end (~70 kg): the beam rests gate-down by ~35 kg.m, one block tips it
    // gate: a thin stem hanging from the beam tip into the open top of the trough, ending in a bar at ball-centre height
    { type: 'box', hx: 0.02, hy: stemLen / 2, hz: 0.02, pos: { x: arm, y: -beamH / 2 - stemLen / 2, z: 0 }, material: 'steel' },
    { type: 'box', hx: 0.02, hy: 0.02, hz: troughRadius - 0.03, pos: { x: arm, y: -beamH / 2 - stemLen, z: 0 }, material: 'steel' },
    // counterweight on the gate side: the beam rests gate-down by roughly one block's worth of torque
    { type: 'box', hx: 0.08, hy: 0.08, hz: 0.22, pos: { x: arm - 0.35, y: beamH / 2 + 0.08, z: 0 }, material: 'steel' },
  ];
  const beam = B.part(shapes, { pos: pivot, material: 'wood', color: 0xb98a5a, name: ballName + 'Beam', impactThreshold: 1500, angularDamping: 0.3 });
  B.revolute(B.anchor(pivot), beam, pivot, { x: 0, y: 0, z: 1 }, { limits: [-14 * DEG, 14 * DEG] });
  // pivot stand (decor + collider)
  B.fixedBox(0.15, 0.15, 0.6, { x: pivot.x, y: pivot.y - 0.3, z: 0 }, { material: 'steel', color: 0x4a4f58 });
  B.decor([{ type: 'box', hx: 0.1, hy: 2.0, hz: 0.1 }], { pos: { x: pivot.x, y: pivot.y - 2.3, z: 0 }, material: 'steel', color: 0x4a4f58 });
  // rest stop under the gate end: the beam sits at about -4 degrees (gate end down)
  const restAng = -4 * DEG;
  const barY = pivot.y + arm * Math.sin(restAng) - beamH / 2 - stemLen * Math.cos(restAng);   // bar centre height at rest
  B.fixedBox(0.12, 0.05, 0.4, { x: pivot.x + arm + 0.2, y: pivot.y + (arm + 0.2) * Math.sin(restAng) - beamH / 2 - 0.05 - 0.01, z: 0 }, { material: 'rubber', color: 0x222222 }); // under the beam tip, clear of the plate
  // ball trough: level section with the ball resting against the gate plate, a gap for the plate, then a 2 degree descent
  const gx = pivot.x + arm * Math.cos(restAng) + stemLen * Math.sin(-restAng);   // bar x at rest (stem swings slightly)
  const floorY = barY - ballR;        // ball centre at bar height
  const xBall = gx - 0.02 - ballR - 0.01;
  B.trough(joinPaths(linePath({ x: xBall - 0.8, y: floorY + 0.03, z: 0 }, { x: gx + 0.4, y: floorY, z: 0 }, 4), linePath({ x: gx + 0.4, y: floorY, z: 0 }, { x: gx + 2.4, y: floorY - 0.08, z: 0 }, 4)), { radius: troughRadius, arcDeg: 180, thick: 0.035, material: 'track' });
  const ball = B.ball(ballR, { x: xBall, y: floorY + ballR, z: 0 }, { name: ballName, material: ballMaterial, impactThreshold: 1500, tags: ['hero', ...tags] });
  return { beam, ball, exit: { x: gx + 2.4, y: floorY - 0.08 }, bucketPos: { x: pivot.x - arm, y: pivot.y - bucketH / 2 } };
}

export function balanceGate(M) {
  const B = M.B;
  const S = M.stage({ name: 'balance', title: 'Balance Gate', blurb: 'Timber debris pours down a chute into a bucket; the loaded beam lifts a gate and frees the next sphere.', input: { r: 0.1, material: 'wood', speed: 3.0 } });
  // Debris reaches the platform edge at x = 0 (y = 0) and slides down a 50 degree chute into the bucket
  const pivot = { x: 5.6, y: -1.4, z: 0 };
  const bb = balanceBeam(B, M, { pivot, arm: 2.5, ballR: 0.1, ballMaterial: 'steel', ballName: 'F', troughRadius: 0.16 });
  M.entrySensor(S, { x: 0.8, y: -0.4, z: 0 }, 0.9, p => p && (p.instanceKey === 'block'));
  // chute from the platform edge down to just above the bucket rim
  const bp = bb.bucketPos; // bucket centre (x, mid height)
  const rimY = pivot.y - 0.02;
  const chute = catmullRom([{ x: -0.5, y: 0.01, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0.8, y: -0.5, z: 0 }, { x: 1.8, y: -1.2, z: 0 }, { x: bp.x - 0.9, y: rimY + 0.45, z: 0 }, { x: bp.x - 0.5, y: rimY + 0.4, z: 0 }], 8);
  B.trough(chute, { profile: 'trough', width: 1.6, wall: 0.6, thick: 0.05, material: 'track', name: 'debrisChute' });
  // deflector above the bucket's far side so blocks do not fly past
  B.fixedBox(0.04, 0.6, 0.7, { x: bp.x + 1.0, y: rimY + 0.75, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  M.cue('bucketLoad', { type: 'box', hx: 0.5, hy: 0.3, hz: 0.4 }, { x: bp.x, y: rimY + 0.2, z: 0 }, { filter: p => p && p.instanceKey === 'block' });
  M.cue('gateLift', { type: 'ball', r: 0.3 }, { x: bb.exit.x - 1.5, y: bb.exit.y + 0.2, z: 0 }, { filter: p => p && p.name === 'F' });
  S.hero = bb.ball;
  S.focus = { x: pivot.x, y: pivot.y, z: 0 };
  return { exit: { pos: { x: bb.exit.x, y: bb.exit.y, z: 0 }, yaw: 0 } };
}

export function plinko(M) {
  const B = M.B;
  const S = M.stage({ name: 'plinko', title: 'Plinko Board', blurb: 'The sphere rattles down six rows of staggered pegs between glass sheets into a collector.', input: { r: 0.1, material: 'steel', speed: 1.5 } });
  M.entrySensor(S, { x: 0.3, y: 0.15, z: 0 }, 0.35);
  // short trough to the board top, then a drop into the peg field
  B.trough(linePath({ x: -0.4, y: 0.01, z: 0 }, { x: 0.9, y: -0.08, z: 0 }, 3), { radius: 0.16, arcDeg: 180, thick: 0.035, material: 'track' });
  const bx = 1.1, top = -0.3, rows = 6, dy = 0.45, dx = 0.5, halfW = 1.6, gap = 0.17;
  // back wall and front glass
  B.fixedBox(halfW + 0.3, rows * dy / 2 + 0.9, 0.03, { x: bx, y: top - rows * dy / 2 - 0.3, z: -gap - 0.03 }, { material: 'darkwood', color: 0x2c2420 });
  B.fixedBox(halfW + 0.3, rows * dy / 2 + 0.9, 0.03, { x: bx, y: top - rows * dy / 2 - 0.3, z: gap + 0.03 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  const pegRot = Q.axisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
  for (let r = 0; r < rows; r++) {
    const y = top - r * dy;
    const off = (r % 2) * dx / 2;
    for (let x = -halfW; x <= halfW + 0.01; x += dx) {
      const px = bx + x + off;
      if (px > bx + halfW + 0.01) continue;
      B.part([{ type: 'cylinder', hh: gap, r: 0.045, rot: pegRot }], { type: 'fixed', pos: { x: px, y, z: 0 }, material: 'chrome', instanceKey: 'peg', color: 0xd0d4da });
    }
  }
  // side walls of the peg field
  for (const sx of [-1, 1]) B.fixedBox(0.03, rows * dy / 2 + 0.1, gap, { x: bx + sx * (halfW + 0.3), y: top - rows * dy / 2 - 0.15, z: 0 }, { material: 'track' }); // tops below the entry trough
  // V collector into a central exit
  const by = top - rows * dy - 0.65;
  B.slab({ x: bx - halfW - 0.3, y: by + 0.8, z: 0 }, { x: bx - 0.18, y: by, z: 0 }, 0.3, 0.05, { material: 'track' });
  B.slab({ x: bx + halfW + 0.3, y: by + 0.8, z: 0 }, { x: bx + 0.18, y: by, z: 0 }, 0.3, 0.05, { material: 'track' });
  // exit chute below the collector heading +x
  const ex = joinPaths(linePath({ x: bx - 0.3, y: by - 0.45, z: 0 }, { x: bx + 0.3, y: by - 0.5, z: 0 }, 2), catmullRom([{ x: bx + 0.3, y: by - 0.5, z: 0 }, { x: bx + 1.2, y: by - 0.7, z: 0 }, { x: bx + 2.4, y: by - 0.85, z: 0 }, { x: bx + 3.2, y: by - 0.88, z: 0 }], 8));
  B.trough(ex, { radius: 0.2, arcDeg: 200, thick: 0.035, material: 'track' });
  B.fixedBox(0.03, 0.35, 0.22, { x: bx - 0.33, y: by - 0.2, z: 0 }, { material: 'track' });
  M.cue('plinkoMid', { type: 'box', hx: halfW, hy: 0.2, hz: gap }, { x: bx, y: top - 4 * dy, z: 0 }, { filter: p => p && (p.name === 'F' || p.name === 'TEST') });
  S.focus = { x: bx, y: top - rows * dy / 2, z: 0 };
  return { exit: { pos: { x: bx + 3.2, y: by - 0.88, z: 0 }, yaw: 0 } };
}
