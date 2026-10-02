// Usage: node scripts/debug_near.mjs <stageIndex> <x> <y> <z> [radius] — lists colliders near a stage-local point
import { initPhysics, PhysicsWorld, RAPIER } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
import { V, Q } from '../src/math.js';
const [si, x, y, z, r = 0.6] = process.argv.slice(2).map(Number);
await initPhysics();
const pw = new PhysicsWorld();
const M = buildMachine(pw, { maxStages: 4 });
const f = M.stages[si].frame;
const wp = V.add(f.pos, Q.rotate(f.rot, { x, y, z }));
console.log('world point', wp);
const shape = new RAPIER.Ball(r);
pw.world.intersectionsWithShape(wp, Q.identity(), shape, (col) => {
  const part = pw.colliderToPart.get(col.handle);
  const t = col.translation();
  const lp = Q.rotate(Q.conj(f.rot), V.sub(t, f.pos));
  const st = col.shapeType ? col.shapeType() : col.shape.type;
  console.log(`collider type=${st} sensor=${col.isSensor()} part=${part?.name || part?.instanceKey || part?.type || '?'} stage=${part?.stage} localPos=(${lp.x.toFixed(2)},${lp.y.toFixed(2)},${lp.z.toFixed(2)})`, part?.shapes?.length === 1 ? JSON.stringify(part.shapes[0], (k, v) => k === 'geom' ? `[geom ${v.positions.length / 3} verts]` : v) : '');
  return true;
});
