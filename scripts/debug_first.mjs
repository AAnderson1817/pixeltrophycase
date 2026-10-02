import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
await initPhysics();
const pw = new PhysicsWorld();
const M = buildMachine(pw, { maxStages: 4 });
const f = M.stages[1].frame.pos;
const doms = pw.parts.filter(p => p.instanceKey === 'domino');
const upY = p => 1 - 2 * (p.curr.qx ** 2 + p.curr.qz ** 2);
M.start();
for (let step = 0; step < 120 * 2; step++) {
  pw.step();
  const moving = doms.map((p, i) => [i, p]).filter(([i, p]) => !p.body.isSleeping() && Math.hypot(p.body.linvel().x, p.body.linvel().y, p.body.linvel().z) > 0.05);
  if (moving.length && step % 12 === 0) console.log(`t=${pw.time.toFixed(2)} moving dominoes:`, moving.slice(0, 8).map(([i, p]) => `${i}@(${(p.curr.x - f.x).toFixed(2)},${(p.curr.y - f.y).toFixed(2)},${(p.curr.z - f.z).toFixed(2)}) upY=${upY(p).toFixed(2)}`).join(' '));
}
// list all non-domino dynamic parts near the end of lane 3
for (const p of pw.parts) {
  if (!p.body || p.instanceKey === 'domino') continue;
  const lx = p.curr.x - f.x, lz = p.curr.z - f.z, ly = p.curr.y - f.y;
  if (lx > 6.0 && lx < 9.5 && Math.abs(lz - 6.4) < 1.5 && ly > -0.5 && ly < 2) console.log('part near end:', p.name, p.type, `(${lx.toFixed(2)},${ly.toFixed(2)},${lz.toFixed(2)})`, p.shapes.map(s => s.type + (s.hx ? `[${s.hx},${s.hy},${s.hz}]@(${s.pos.x.toFixed(3)},${s.pos.y.toFixed(3)},${s.pos.z.toFixed(2)})` : s.r ? `[r=${s.r}]` : '')).join(' '));
}
