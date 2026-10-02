// Stages 1-4: gated release + helix, domino serpentine, seesaw catapult + funnel, Newton's cradle.
import { V, Q, DEG, easeInOutCubic, clamp } from '../../math.js';
import { helixPath, linePath, joinPaths, catmullRom, resample, revolve, pathFrames, extrudeProfile, rectProfile } from '../geometry.js';

export function releaseAndHelix(M) {
  const B = M.B;
  const S = M.stage({ name: 'release', title: 'Release', blurb: 'The gate drops and a 110 kg steel sphere rolls into a two-turn helix.' });
  const R = 1.6, turns = 2, drop = 4.0;
  // Start cradle trough, helix, exit trough
  const p1 = linePath({ x: -0.6, y: 0.05, z: 0 }, { x: 2.5, y: -0.15, z: 0 }, 6);
  const helix = helixPath({ cx: 2.5, cz: R, radius: R, y0: -0.15, y1: -0.15 - drop, a0: -Math.PI / 2 - Math.PI * 2 * turns, turns, dir: 1, segmentsPerTurn: 96 });
  const p3 = linePath({ x: 2.5, y: -0.15 - drop, z: 0 }, { x: 5.2, y: -0.15 - drop - 0.25, z: 0 }, 6);
  const path = joinPaths(p1, helix, p3);
  B.trough(path, { radius: 0.22, arcDeg: 245, thick: 0.04, material: 'track', name: 'helixTrough' }); // deep enough to hold the ball at 4 m/s on the 1.6 m helix
  // Central column + supports (decor + collider so nothing passes through)
  B.cylinder(drop / 2 + 1.2, 0.35, { x: 2.5, y: -0.15 - drop / 2 - 0.4, z: R }, { type: 'fixed', material: 'concrete', color: 0x6a6f78 });
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 - Math.PI * 2 * turns + (Math.PI * 2 * turns) * (i / 8);
    const y = -0.15 - drop * (i / 8);
    B.decor([{ type: 'box', hx: R / 2 - 0.1, hy: 0.03, hz: 0.03 }], { pos: { x: 2.5 + (R / 2) * Math.cos(a), y: y - 0.3, z: R + (R / 2) * Math.sin(a) }, rot: Q.yaw(-a), material: 'steel', color: 0x8a8f99 });
  }
  // Hero ball A
  const A = B.ball(0.15, { x: 0, y: 0.2, z: 0 }, { name: 'A', material: 'steel', impactThreshold: 2500, tags: ['hero'] });
  S.hero = A;
  // Kinematic gate in front of the ball; drops on start
  const gate = B.box(0.04, 0.25, 0.3, { x: 0.22, y: 0.25, z: 0 }, { type: 'kinematic', material: 'paintRed', name: 'startGate' });
  const gateBase = V.clone(gate.body.translation());
  let openAt = null;
  B.animate(gate, (rec, time) => {
    if (openAt === null) return null;
    const t = clamp((time - openAt) / 0.8, 0, 1);
    return { pos: { x: gateBase.x, y: gateBase.y - 0.75 * easeInOutCubic(t), z: gateBase.z } };
  });
  M.onStart(() => { openAt = M.pw.time; A.body.wakeUp(); M.reach(S, M.pw.time); });
  // Start platform decor
  B.decor([{ type: 'box', hx: 1.2, hy: 0.15, hz: 1.0 }], { pos: { x: 0.2, y: -0.35, z: 0 }, material: 'concrete', color: 0x5d6168 });
  B.decor([{ type: 'cylinder', hh: 8.5, r: 0.25 }], { pos: { x: 0.2, y: -8.9, z: 0 }, material: 'concrete', color: 0x5d6168 });
  const exit = { pos: { x: 5.2, y: -0.15 - drop - 0.25, z: 0 }, yaw: 0 };
  S.focus = { x: 2.5, y: -2, z: R };
  return { exit };
}

export function dominoSerpentine(M) {
  const B = M.B;
  const S = M.stage({ name: 'dominoes', title: 'Domino Serpentine', blurb: '130 dominoes snake across the platform; a wooden capstone nudges a 190 kg sphere over the edge.' });
  M.entrySensor(S, { x: 0.3, y: 0.2, z: 0 }, 0.5);
  const xk = 1.3;                     // kicker position
  const gapA = xk + 0.12, gapB = xk + 1.15;  // pit: 1.03 m long so the sphere drops in cleanly
  const L1 = 0, L2 = 3.2, L3 = 6.4;   // lane z positions
  const R = 1.6;                      // turn radius
  const xEnd = 8.0, xLeft = -1.0, zMin = -1.2, zMax = 7.6;
  const teeHalf = 0.55;
  const wood = { material: 'wood', color: 0x9b7b55 };
  // Serpentine: straight lanes joined by exact semicircles; uniform spacing, no short leftover at the end
  const arc = (cx, cz, a0, a1, n) => { const o = []; for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push({ x: cx + R * Math.cos(a), y: 0, z: cz + R * Math.sin(a) }); } return o; };
  const spacing = 0.19;
  const x1s = gapB + 0.15, x1e = 6.0, x2e = 1.0, x3e = 6.95;
  const path = joinPaths(
    linePath({ x: x1s, y: 0, z: L1 }, { x: x1e, y: 0, z: L1 }, 20),
    arc(x1e, L1 + R, -Math.PI / 2, Math.PI / 2, 24),
    linePath({ x: x1e, y: 0, z: L2 }, { x: x2e, y: 0, z: L2 }, 20),
    arc(x2e, L2 + R, -Math.PI / 2, -3 * Math.PI / 2, 24),
    linePath({ x: x2e, y: 0, z: L3 }, { x: x3e, y: 0, z: L3 }, 20),
  );
  const pts = resample(path, spacing);
  if (V.dist(pts[pts.length - 1], pts[pts.length - 2]) < 0.7 * spacing) pts.pop();
  const frames = pathFrames(pts);
  const lastX = pts[pts.length - 1].x;
  // Derived positions: trigger post, pendulum knocker, sphere, continuous tee strip
  const postX = lastX + 0.03 + 0.03 + 0.16; // trigger post centre (16 cm gap after the last domino)
  const L = 1.2, theta0 = 55 * DEG, rK = 0.12;
  const xB = postX + L * Math.sin(theta0) + rK + 0.18; // sphere centre: knocker meets it at the bottom of the arc
  const pivot = { x: xB - 0.18 - rK, y: 0.18 + L, z: L3 };
  const stripX0 = xB - 0.4;                // strip begins under the sphere only
  const teeX = xB + 0.05;                  // tee slope begins 5 cm past the sphere's contact point
  const teeLen = 0.8, teeDrop = teeLen * Math.tan(3 * DEG);
  // Platform (top at y=0): left part, gap fillers outside lane 1, right part (cut away under the tee strip)
  B.fixedBox((gapA - xLeft) / 2, 0.15, (zMax - zMin) / 2, { x: (gapA + xLeft) / 2, y: -0.15, z: (zMin + zMax) / 2 }, wood);
  B.fixedBox((gapB - gapA) / 2, 0.15, (zMax - 0.45) / 2, { x: (gapA + gapB) / 2, y: -0.15, z: (0.45 + zMax) / 2 }, wood);
  B.fixedBox((gapB - gapA) / 2, 0.15, (-0.45 - zMin) / 2, { x: (gapA + gapB) / 2, y: -0.15, z: (zMin - 0.45) / 2 }, wood);
  B.fixedBox((xEnd - gapB) / 2, 0.15, ((L3 - teeHalf) - zMin) / 2, { x: (xEnd + gapB) / 2, y: -0.15, z: (zMin + L3 - teeHalf) / 2 }, wood);
  B.fixedBox((xEnd - gapB) / 2, 0.15, (zMax - (L3 + teeHalf)) / 2, { x: (xEnd + gapB) / 2, y: -0.15, z: (zMax + L3 + teeHalf) / 2 }, wood);
  B.fixedBox((stripX0 - gapB) / 2, 0.15, teeHalf, { x: (stripX0 + gapB) / 2, y: -0.15, z: L3 }, wood);
  const strip = extrudeProfile([{ x: stripX0, y: 0, z: L3 }, { x: teeX, y: 0, z: L3 }, { x: teeX + teeLen, y: -teeDrop, z: L3 }], rectProfile(teeHalf * 2, 0.15));
  B.mesh(strip, { ...wood, type: 'fixed' });
  // Ball trap bin under the pit (open top, 1.4 m deep)
  const gx = (gapA + gapB) / 2 + 0.3, gw = (gapB - gapA) / 2 + 0.5;
  B.fixedBox(gw, 0.05, 0.6, { x: gx, y: -2.4, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(0.05, 0.7, 0.6, { x: gx - gw, y: -1.7, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(0.05, 0.7, 0.6, { x: gx + gw, y: -1.7, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(gw, 0.7, 0.05, { x: gx, y: -1.7, z: -0.6 }, { material: 'steel', color: 0x3b3f46 });
  B.fixedBox(gw, 0.7, 0.05, { x: gx, y: -1.7, z: 0.6 }, { material: 'steel', color: 0x3b3f46 });
  // Guide rails so the ball stays on lane 1 up to the kicker
  B.fixedBox(0.8, 0.06, 0.03, { x: 0.6, y: 0.06, z: 0.25 }, { material: 'steel', color: 0x8a8f99 });
  B.fixedBox(0.8, 0.06, 0.03, { x: 0.6, y: 0.06, z: -0.25 }, { material: 'steel', color: 0x8a8f99 });
  // Kicker: tall plank bridging the pit; a lip in front of its base forces it to tip rather than slide
  B.box(0.04, 0.8, 0.16, { x: xk, y: 0.8, z: 0 }, { material: 'darkwood', color: 0x5a3b22, name: 'kicker', impactThreshold: 800 });
  B.fixedBox(0.015, 0.02, 0.2, { x: xk + 0.06, y: 0.02, z: 0 }, { material: 'steel', color: 0x8a8f99 });
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const q = Q.lookAlong(f.t);
    B.part([{ type: 'box', hx: 0.03, hy: 0.25, hz: 0.12 }], { pos: { x: f.p.x, y: 0.25, z: f.p.z }, rot: q, material: 'wood', instanceKey: 'domino', color: i % 2 ? 0xe8dcc4 : 0xd9c9a8, impactThreshold: 600, name: i === 0 ? 'domino0' : i === frames.length - 1 ? 'dominoLast' : null });
  }
  // Trigger post with a lip, holding the pendulum knocker 40 degrees back
  const kY = pivot.y - L * Math.cos(theta0) + 0.012; // 12 mm above the arc: the cable hangs slack while the ball rests on the post
  const postTop = kY - rK;
  // T-shaped post: thin column, wide cap, two low lips clear of the ball's footprint
  const colH = postTop - 0.03;
  B.part([
    { type: 'box', hx: 0.03, hy: colH / 2, hz: 0.12, pos: { x: 0, y: colH / 2, z: 0 } },
    { type: 'box', hx: 0.12, hy: 0.015, hz: 0.12, pos: { x: 0, y: colH + 0.015, z: 0 } },
    { type: 'box', hx: 0.01, hy: 0.015, hz: 0.12, pos: { x: 0.105, y: colH + 0.045, z: 0 } },
    { type: 'box', hx: 0.01, hy: 0.015, hz: 0.12, pos: { x: -0.105, y: colH + 0.045, z: 0 } },
  ], { pos: { x: postX, y: 0, z: L3 }, material: 'darkwood', color: 0x5a3b22, name: 'capstone', impactThreshold: 800 });
  const knocker = B.ball(rK, { x: postX, y: kY + 0.002, z: L3 }, { name: 'knocker', material: 'steel', impactThreshold: 2000, angularDamping: 0.6, linearDamping: 0.05, visual: { rope: { pivot: B.toWorld(pivot) } } });
  B.rope(B.anchor(pivot), knocker, pivot, { x: postX, y: kY, z: L3 }, L);
  // Knocker frame
  B.decor([{ type: 'box', hx: 0.05, hy: 0.05, hz: 0.75 }], { pos: { x: pivot.x, y: pivot.y + 0.08, z: L3 }, material: 'steel', color: 0x3b3f46 });
  for (const dz of [-0.7, 0.7]) B.decor([{ type: 'box', hx: 0.05, hy: (pivot.y + 0.1) / 2, hz: 0.05 }], { pos: { x: pivot.x, y: (pivot.y + 0.1) / 2, z: L3 + dz }, material: 'steel', color: 0x3b3f46 });
  // Ball B
  const Bball = B.ball(0.18, { x: xB, y: 0.18, z: L3 }, { name: 'B', material: 'steel', impactThreshold: 4000, tags: ['hero'], angularDamping: 0.03 });
  S.hero = Bball;
  // Decorative legs for the platform
  for (const [x, z] of [[xLeft + 0.3, zMin + 0.4], [xLeft + 0.3, zMax - 0.4], [xEnd - 0.4, zMin + 0.4], [xEnd - 0.4, zMax - 0.4], [3.5, zMin + 0.4], [3.5, zMax - 0.4]]) {
    B.decor([{ type: 'cylinder', hh: 7.5, r: 0.12 }], { pos: { x, y: -7.8, z }, material: 'steel', color: 0x4a4f58 });
  }
  M.cue('dominoesMid', { type: 'box', hx: 0.3, hy: 0.4, hz: 0.3 }, { x: 3.5, y: 0.3, z: L2 }, { filter: p => p && p.instanceKey === 'domino' });
  S.focus = { x: 3.5, y: 0.3, z: L2 };
  return { exit: { pos: { x: teeX + teeLen, y: -teeDrop, z: L3 }, yaw: 0 } };
}

export function seesawCatapult(M) {
  const B = M.B;
  const S = M.stage({ name: 'catapult', title: 'Seesaw Catapult', blurb: 'The sphere drops 3.8 m onto a seesaw, flinging an aluminium ball into a catch trough.', input: { r: 0.18, material: 'steel', speed: 1.2 } });
  // B falls from (≈0.3..0.5, 0, 0). Seesaw plank along local x, pivot at px, far end under the drop.
  const drop = 3.8, arm = 2.2;
  // Drop channel: B leaves the tee at 0.9-1.5 m/s, hits the back wall and slides down to a fixed landing spot
  const backX = 0.7, landX = backX - 0.18;
  const px = landX - arm + 0.2, py = -drop;
  M.entrySensor(S, { x: landX, y: -1.0, z: 0 }, 0.7, p => p && p.name === 'B');
  const chTop = -0.2, chBot = -2.6, chMid = (chTop + chBot) / 2, chH = (chTop - chBot) / 2;
  B.fixedBox(0.03, chH, 0.32, { x: backX, y: chMid, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  B.fixedBox(0.03, (chBot + 0.9) / -2 + 0, 0.32, { x: 0.1, y: (chBot - 0.9) / 2, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  for (const z of [-0.32, 0.32]) B.fixedBox(0.32, chH, 0.03, { x: (backX + 0.1) / 2, y: chMid, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  // pivot stand
  B.fixedBox(0.12, (drop - 0.5) / 2 + 2, 0.12, { x: px, y: py - (drop - 0.5) / 2 - 2 - 0.3, z: 0 }, { material: 'steel', color: 0x4a4f58 });
  B.fixedBox(0.25, 0.3, 0.6, { x: px, y: py - 0.5, z: 0 }, { material: 'steel', color: 0x4a4f58 });
  // plank (compound: board + landing cup walls at the far end + ring at the near end + counterweight)
  const plank = B.part([
    { type: 'box', hx: arm, hy: 0.025, hz: 0.3 },
    { type: 'box', hx: 0.03, hy: 0.12, hz: 0.3, pos: { x: arm - 0.03, y: 0.145, z: 0 } },
    { type: 'box', hx: 0.5, hy: 0.1, hz: 0.015, pos: { x: arm - 0.5, y: 0.125, z: 0.285 } },
    { type: 'box', hx: 0.5, hy: 0.1, hz: 0.015, pos: { x: arm - 0.5, y: 0.125, z: -0.285 } },
    { type: 'box', hx: 0.03, hy: 0.04, hz: 0.14, pos: { x: -arm + 0.05, y: 0.065, z: 0 } },
    { type: 'box', hx: 0.12, hy: 0.05, hz: 0.18, pos: { x: -1.0, y: -0.075, z: 0 }, material: 'steel' },
  ], { pos: { x: px, y: py, z: 0 }, material: 'wood', color: 0xb98a5a, name: 'seesaw', impactThreshold: 3000 });
  const pivotAnchor = B.anchor({ x: px, y: py, z: 0 });
  B.revolute(pivotAnchor, plank, { x: px, y: py, z: 0 }, { x: 0, y: 0, z: 1 }, { limits: [-32 * DEG, 10 * DEG] });
  // hard stop block under the far end (sets the launch angle)
  const stopAng = 30 * DEG, stopR = arm - 0.3;
  B.fixedBox(0.25, 0.1, 0.4, { x: px + stopR * Math.cos(stopAng), y: py - stopR * Math.sin(stopAng) - 0.15, z: 0 }, { material: 'rubber', color: 0x222222 });
  // near end rests on a low stand (plank starts tilted a few degrees: far end up)
  B.fixedBox(0.12, 0.1, 0.4, { x: px - arm + 0.1, y: py - 0.22, z: 0 }, { material: 'rubber', color: 0x222222 });
  // the catapult ball C
  const C = B.ball(0.1, { x: px - arm + 0.2, y: py + 0.025 + 0.1, z: 0 }, { name: 'C', material: 'aluminum', impactThreshold: 800, tags: ['hero'] });
  S.hero = C;
  // Containment: glass walls along both sides of the plank and at both ends, so B stays in the seesaw bay
  const bayLen = arm + 0.8;
  for (const z of [-0.5, 0.5]) {
    B.fixedBox(bayLen / 2, 1.5, 0.03, { x: px + bayLen / 2, y: py + 0.3, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
    B.fixedBox(bayLen / 2, 0.9, 0.03, { x: px - bayLen / 2, y: py - 0.3, z }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  }
  B.fixedBox(0.03, 1.5, 0.5, { x: px + bayLen, y: py + 0.3, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  B.fixedBox(0.03, 0.9, 0.5, { x: px - bayLen, y: py - 0.3, z: 0 }, { material: 'glass', color: 0xaad4ff, visual: { glass: true } });
  // floor of the bay (catches B after the launch)
  B.fixedBox(bayLen, 0.1, 0.5, { x: px, y: py - 1.5, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  // Funnel to catch C (position tuned from the simulated trajectory)
  // Catch trough: C's measured flight rises through y = py+2.3 at x ~ px-1.1 and comes down through it at x ~ px+0.8.
  // A walled trough starting right of the ascent catches the descent and curves away (to -z) toward the cradle.
  const cy = py + 2.25, turnR = 0.6;
  const tx0 = px - 0.4, tx1 = px + 0.6;                    // straight catch section (ascent clears tx0 by ~0.3 m)
  const tc = { x: tx1, z: -turnR };                        // turn centre
  const arcPts = [];
  for (let i = 1; i <= 16; i++) { const a = Math.PI / 2 - (Math.PI / 2) * (i / 16); arcPts.push({ x: tc.x + turnR * Math.cos(a), y: cy - 0.1 - 0.15 * (i / 16), z: tc.z + turnR * Math.sin(a) }); }
  const catchPath = joinPaths(linePath({ x: tx0, y: cy, z: 0 }, { x: tx1, y: cy - 0.1, z: 0 }, 6), arcPts);
  B.trough(catchPath, { profile: 'trough', width: 0.8, wall: 0.45, thick: 0.04, material: 'track', name: 'catchTrough' });
  B.fixedBox(0.03, 0.3, 0.44, { x: tx0 - 0.03, y: cy + 0.1, z: 0 }, { material: 'track' }); // low end stop on the approach side
  // felt backboard: whatever the launch strength, C hits it and drops into the turn of the catch trough
  const bbBot = cy - 0.1, bbTop = -0.16;
  B.fixedBox(0.025, (bbTop - bbBot) / 2, 0.55, { x: 0.02, y: (bbTop + bbBot) / 2, z: -0.1 }, { material: 'felt', color: 0x5a1e1e, name: 'backboard' });
  const catchEnd = catchPath[catchPath.length - 1];
  // Support struts
  for (const [x, z] of [[tx0 + 0.2, 0.3], [tx0 + 0.2, -0.3], [tx1, 0.3]]) B.decor([{ type: 'box', hx: 0.03, hy: (cy - 0.04 - (py - 1.6)) / 2, hz: 0.03 }], { pos: { x, y: (cy - 0.04 + py - 1.6) / 2, z }, material: 'steel', color: 0x4a4f58 });
  const fx = catchEnd.x, fy = catchEnd.y;
  M.cue('catapultLaunch', { type: 'box', hx: 0.5, hy: 0.3, hz: 0.5 }, { x: px - arm + 0.6, y: py + 1.2, z: 0 }, { filter: p => p && p.name === 'C' });
  M.cue('funnelCatch', { type: 'ball', r: 0.4 }, { x: px, y: cy + 0.2, z: 0 }, { filter: p => p && p.name === 'C' });
  S.focus = { x: px, y: py + 1, z: 0 };
  // Exit: end of the catch trough, heading -z
  return { exit: { pos: { x: fx, y: fy, z: catchEnd.z }, yaw: Math.PI / 2 } };
}

export function newtonsCradle(M) {
  const B = M.B;
  const S = M.stage({ name: 'cradle', title: "Newton's Cradle", blurb: 'Momentum passes through five hanging spheres of equal mass to release the next ball.', input: { r: 0.1, material: 'aluminum', speed: 1.5 } });
  M.entrySensor(S, { x: 0.3, y: 0.3, z: 0 }, 0.4, p => p && p.name === 'C');
  const r = 0.1;                  // cradle ball radius (same mass as C for clean momentum transfer)
  // chute: catches C from the funnel outlet above (0,0.75,0) and descends to the cradle height
  const path = joinPaths(
    linePath({ x: -0.02, y: 0.0, z: 0 }, { x: 0.6, y: -0.05, z: 0 }, 3),
    catmullRom([{ x: 0.6, y: -0.05, z: 0 }, { x: 1.8, y: -0.4, z: 0 }, { x: 3.0, y: -0.62, z: 0 }, { x: 4.0, y: -0.65, z: 0 }], 10),
  );
  B.trough(path, { profile: 'pipe', radius: 0.45, arcDeg: 175, thick: 0.04, material: 'track' }); // rounded: the ball self-centres
  const yC = -0.65 + 0.1;         // C centre height at chute end
  const yBall = yC;               // cradle balls centred at the same height
  const x1 = 4.0 + 0.1 + r + 0.05;
  const L = 1.6;                  // pendulum length
  const yTop = yBall + L;
  // frame
  B.fixedBox(0.9, 0.05, 0.05, { x: x1 + 2 * (2 * r + 0.004), y: yTop + 0.05, z: 0 }, { material: 'steel', color: 0x3b3f46 });
  for (const z of [-0.7, 0.7]) {
    B.decor([{ type: 'box', hx: 0.05, hy: (L + 0.5) / 2, hz: 0.05 }], { pos: { x: x1 - 0.5, y: yTop - (L + 0.5) / 2 + 0.1, z }, material: 'steel', color: 0x3b3f46 });
    B.decor([{ type: 'box', hx: 0.05, hy: (L + 0.5) / 2, hz: 0.05 }], { pos: { x: x1 + 4 * (2 * r + 0.004) + 0.5, y: yTop - (L + 0.5) / 2 + 0.1, z }, material: 'steel', color: 0x3b3f46 });
    B.decor([{ type: 'box', hx: 1.0, hy: 0.05, hz: 0.05 }], { pos: { x: x1 + 2 * (2 * r + 0.004), y: yTop + 0.05, z }, material: 'steel', color: 0x3b3f46 });
    B.decor([{ type: 'box', hx: 1.0, hy: 0.05, hz: 0.05 }], { pos: { x: x1 + 2 * (2 * r + 0.004), y: yBall - r - 0.4, z }, material: 'steel', color: 0x3b3f46 });
  }
  const cradle = [];
  for (let i = 0; i < 5; i++) {
    const x = x1 + i * (2 * r + 0.004);
    const ball = B.ball(r, { x, y: yBall, z: 0 }, { name: 'cradle' + i, material: 'cradle', impactThreshold: 300, angularDamping: 0.2, visual: { look: 'chrome', strings: { top: B.toWorld({ x, y: yTop, z: 0 }), spread: 0.7 } } });
    const a = B.anchor({ x, y: yTop, z: 0 });
    B.revolute(a, ball, { x, y: yTop, z: 0 }, { x: 0, y: 0, z: 1 });
    cradle.push(ball);
  }
  S.hero = cradle[4];
  // D: resting on a level trough just past the last cradle ball
  const x5 = x1 + 4 * (2 * r + 0.004);
  const rD = 0.15;
  const xD = x5 + r + rD + 0.03;
  const dPath = joinPaths(linePath({ x: xD - 0.4, y: yBall - rD, z: 0 }, { x: xD + 0.2, y: yBall - rD, z: 0 }, 2), linePath({ x: xD + 0.2, y: yBall - rD, z: 0 }, { x: xD + 1.6, y: yBall - rD - 0.05, z: 0 }, 4));
  B.trough(dPath, { radius: 0.22, arcDeg: 180, thick: 0.035, material: 'track' });
  const D = B.ball(rD, { x: xD, y: yBall, z: 0 }, { name: 'D', material: 'aluminum', impactThreshold: 1200, tags: ['hero'], visual: { look: 'chrome' } });
  M.cue('cradleHit', { type: 'ball', r: 0.25 }, { x: x1, y: yBall, z: 0 }, { filter: p => p && p.name === 'C' });
  S.focus = { x: x1 + 0.6, y: yBall + 0.5, z: 0 };
  return { exit: { pos: { x: xD + 1.6, y: yBall - rD - 0.05, z: 0 }, yaw: 0 } };
}
