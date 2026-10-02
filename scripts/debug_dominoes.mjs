import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
await initPhysics();
const pw = new PhysicsWorld();
const M = buildMachine(pw, { maxStages: 2 });
const doms = pw.parts.filter(p => p.instanceKey === 'domino');
const f = M.stages[1].frame.pos;
const upY = p => 1 - 2 * (p.curr.qx ** 2 + p.curr.qz ** 2);
M.start();
const report = (label) => {
  const down = doms.map((p, i) => [i, p]).filter(([i, p]) => upY(p) < 0.7);
  console.log(label, 'down:', down.map(([i, p]) => `${i}@(${(p.curr.x - f.x).toFixed(2)},${(p.curr.y - f.y).toFixed(2)},${(p.curr.z - f.z).toFixed(2)})`).join(' '));
  // first standing domino after the last fallen one, in order
  let lastDown = -1; for (const [i] of down) lastDown = Math.max(lastDown, i);
  if (lastDown >= 0 && lastDown + 1 < doms.length) { const p = doms[lastDown + 1]; console.log('  first standing after chain:', lastDown + 1, `(${(p.curr.x - f.x).toFixed(2)},${(p.curr.z - f.z).toFixed(2)})`, 'upY', upY(p).toFixed(2)); }
};
for (let i = 0; i < 120 * 2; i++) pw.step();
report('t=2');
console.log('domino count', doms.length, 'first', `(${(doms[0].curr.x - f.x).toFixed(2)},${(doms[0].curr.z - f.z).toFixed(2)})`, 'last', `(${(doms.at(-1).curr.x - f.x).toFixed(2)},${(doms.at(-1).curr.z - f.z).toFixed(2)})`);
for (let i = 0; i < 120 * 22; i++) pw.step();
report("t=18");
// print all domino positions in order with upY
console.log(doms.map((p, i) => `${i}:(${(p.curr.x - f.x).toFixed(1)},${(p.curr.z - f.z).toFixed(1)})${upY(p) < 0.7 ? 'X' : '|'}`).join(' '));
