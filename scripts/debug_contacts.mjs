// Usage: node scripts/debug_contacts.mjs <partName> <t0> <t1> [stages] — prints what a part touches in a time window
import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
const [name, t0, t1, stages = 4] = process.argv.slice(2);
await initPhysics();
const pw = new PhysicsWorld();
const M = buildMachine(pw, { maxStages: +stages });
M.start();
const part = M.B.get(name);
let last = '';
while (pw.time < +t1) {
  pw.step(); M.update(pw.time);
  if (pw.time < +t0) continue;
  const touching = [];
  for (const c of part.colliders) pw.world.contactPairsWith(c, (other) => { const op = pw.colliderToPart.get(other.handle); touching.push(op ? (op.name || op.instanceKey || op.type + '#' + op.id) : 'collider#' + other.handle); });
  const key = touching.join(',');
  if (key !== last) { const t = part.body.translation(); console.log(`t=${pw.time.toFixed(3)} ${name} at (${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}) touching: [${key}]`); last = key; }
}
