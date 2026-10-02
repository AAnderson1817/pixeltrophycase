import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
await initPhysics();
const pw = new PhysicsWorld();
const M = buildMachine(pw);
for (const s of M.stages) {
  // lowest collider among this stage's parts
  let minY = Infinity;
  for (const p of pw.parts) if (p.stage === s.index && p.body) { for (const sh of p.shapes) { const r = sh.hy ?? sh.r ?? 0.3; minY = Math.min(minY, p.curr.y - r - (sh.pos ? Math.abs(sh.pos.y) : 0)); } }
  const yaw = Math.round(2 * Math.atan2(s.frame.rot.y, s.frame.rot.w) * 180 / Math.PI);
  console.log(String(s.index).padStart(2), s.name.padEnd(10), 'frame', `(${s.frame.pos.x.toFixed(1)}, ${s.frame.pos.y.toFixed(1)}, ${s.frame.pos.z.toFixed(1)})`, 'yaw', yaw, 'lowest part y', minY.toFixed(1));
}
console.log('bounds', JSON.stringify(M.bounds(), (k, v) => typeof v === 'number' ? +v.toFixed(1) : v));
