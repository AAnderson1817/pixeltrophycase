// Headless physics verification: builds the machine, runs it, and reports when each stage is reached.
// Usage: node scripts/simulate.mjs [--duration 150] [--stages N] [--trace ballName[,ballName]] [--step 0.25]
import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const duration = parseFloat(opt('duration', '150'));
const maxStages = parseInt(opt('stages', '999'));
const trace = (opt('trace', '') || '').split(',').filter(Boolean);
const traceStep = parseFloat(opt('step', '0.25'));
const localStage = parseInt(opt('local', '-1'));
const fromStage = parseInt(opt('from', '-1'));
const contactsOf = opt('contacts', '');
const dumpKey = opt('dump', '');    // instanceKey: dump positions of these parts at the end (stage-local)
const jitterMm = parseFloat(opt('jitter', '0'));  // robustness probe: shift the machine origin by this many millimetres

await initPhysics();
const pw = new PhysicsWorld();
const t0 = performance.now();
const machine = buildMachine(pw, { maxStages, origin: { x: -28 + jitterMm / 1000, y: 29 + jitterMm / 1000, z: -14 } });
console.log(`built: ${pw.bodyCount()} bodies, ${pw.colliderCount()} colliders, ${machine.stages.length} stages, ${(performance.now() - t0).toFixed(0)} ms`);
console.log('bounds', JSON.stringify(machine.bounds(), (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));

let impacts = 0;
pw.onContact(() => impacts++);
machine.on('stage', (s, time) => console.log(`  t=${time.toFixed(2).padStart(7)}  stage ${String(s.index).padStart(2)}  ${s.name}`));
if (fromStage > 0) {
  // isolated stage test: skip earlier stages, drop the declared input ball at the stage entry
  for (let i = 0; i < fromStage; i++) machine.stages[i].reachedAt = -1;
  machine.current = fromStage - 1;
  const st = machine.stages[fromStage];
  const inp = st.input || { r: 0.12, material: 'steel', speed: 1.5 };
  const B = machine.B; B.frames.length = 1; B.setFrame(st.frame);
  const ball = B.ball(inp.r, { x: -0.3, y: inp.r + 0.03, z: 0 }, { name: 'TEST', material: inp.material, impactThreshold: 2000, tags: ['hero'] });
  const v = B.dirToWorld({ x: inp.speed, y: 0, z: 0 }); ball.body.setLinvel(v, true);
  B.frames.length = 1;
  machine.started = true;
  if (st.trigger) machine.after(0.5, () => st.trigger());
  console.log(`isolated test of stage ${fromStage} (${st.name}) with ${inp.material} ball r=${inp.r} at ${inp.speed} m/s`);
} else machine.start();

const steps = Math.round(duration / (1 / 120));
let nextTrace = 0;
const ts = performance.now();
for (let i = 0; i < steps; i++) {
  pw.step();
  machine.update(pw.time);
  if (trace.length && pw.time >= nextTrace) {
    nextTrace += traceStep;
    const parts = trace.map(n => {
      const p = machine.B.get(n); if (!p) return `${n}:?`;
      let t = p.body.translation(); const v = p.body.linvel(), q = p.body.rotation();
      if (localStage >= 0 && machine.stages[localStage]) { const f = machine.stages[localStage].frame; const d = { x: t.x - f.pos.x, y: t.y - f.pos.y, z: t.z - f.pos.z }; const c = { x: f.rot.x, y: f.rot.y, z: f.rot.z, w: -f.rot.w }; const ix = c.w * d.x + c.y * d.z - c.z * d.y, iy = c.w * d.y + c.z * d.x - c.x * d.z, iz = c.w * d.z + c.x * d.y - c.y * d.x, iw = -c.x * d.x - c.y * d.y - c.z * d.z; t = { x: ix * c.w + iw * -c.x + iy * -c.z - iz * -c.y, y: iy * c.w + iw * -c.y + iz * -c.x - ix * -c.z, z: iz * c.w + iw * -c.z + ix * -c.y - iy * -c.x }; }
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z); // body +Y dot world +Y
      const tilt = Math.acos(Math.max(-1, Math.min(1, upY))) * 180 / Math.PI;
      let ang = '';
      if (localStage >= 0 && machine.stages[localStage]) { const f = machine.stages[localStage].frame; const c = { x: -f.rot.x, y: -f.rot.y, z: -f.rot.z, w: f.rot.w }; const ql = { x: c.w * q.x + c.x * q.w + c.y * q.z - c.z * q.y, y: c.w * q.y - c.x * q.z + c.y * q.w + c.z * q.x, z: c.w * q.z + c.x * q.y - c.y * q.x + c.z * q.w, w: c.w * q.w - c.x * q.x - c.y * q.y - c.z * q.z }; ang = ` angZ=${(2 * Math.atan2(ql.z, ql.w) * 180 / Math.PI).toFixed(1)}`; }
      return `${n}:(${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}) v=${Math.hypot(v.x, v.y, v.z).toFixed(2)} tilt=${tilt.toFixed(0)}${ang}`;
    });
    const fallen = pw.parts.filter(p => p.instanceKey === 'domino' && (1 - 2 * (p.curr.qx ** 2 + p.curr.qz ** 2)) < 0.7).length;
    let contacts = '';
    if (contactsOf) { const cp = machine.B.get(contactsOf); const names = []; if (cp) for (const c of cp.colliders) pw.world.contactPairsWith(c, (o) => { let real = false; pw.world.contactPair(c, o, (m) => { if (m.numContacts() > 0) real = true; }); if (!real) return; const op = pw.colliderToPart.get(o.handle); names.push(op ? (op.name || op.instanceKey || op.type + '#' + op.id) : '?'); }); contacts = ` ${contactsOf} touches [${names.join(',')}]`; }
    console.log(`  t=${pw.time.toFixed(2)} ${parts.join('  ')}  dominoesDown=${fallen}${contacts}`);
  }
  if (fromStage < 0 && machine.finished && pw.time > machine.finishedAt + 3) break;
}
const wall = (performance.now() - ts) / 1000;
console.log(`simulated ${pw.time.toFixed(1)} s in ${wall.toFixed(1)} s wall (${(pw.time / wall).toFixed(1)}x realtime), ${impacts} impact events`);
if (dumpKey) {
  const f = machine.stages[Math.max(0, localStage)].frame;
  const rows = pw.parts.filter(p => p.instanceKey === dumpKey).map(p => { const d = { x: p.curr.x - f.pos.x, y: p.curr.y - f.pos.y, z: p.curr.z - f.pos.z }; const c = { x: -f.rot.x, y: -f.rot.y, z: -f.rot.z, w: f.rot.w }; const ix = c.w * d.x + c.y * d.z - c.z * d.y, iy = c.w * d.y + c.z * d.x - c.x * d.z, iz = c.w * d.z + c.x * d.y - c.y * d.x, iw = -c.x * d.x - c.y * d.y - c.z * d.z; return { x: ix * c.w + iw * -c.x + iy * -c.z - iz * -c.y, y: iy * c.w + iw * -c.y + iz * -c.x - ix * -c.z, z: iz * c.w + iw * -c.z + ix * -c.y - iy * -c.x }; });
  console.log(`${dumpKey} positions (stage ${localStage} local):`, rows.map(r => `(${r.x.toFixed(1)},${r.y.toFixed(1)},${r.z.toFixed(1)})`).join(' '));
}
const missing = machine.stages.filter(s => s.reachedAt === null);
if (localStage < 0) { const b = machine.bounds(); }
if (missing.length) {
  console.log('NOT REACHED:', missing.map(s => `${s.index}:${s.name}`).join(', '));
  process.exit(1);
} else {
  console.log(`ALL ${machine.stages.length} STAGES REACHED. Finale at t=${machine.finishedAt?.toFixed(2)} s`);
}
