// Lists machine parts that sit within reach of each stage's default director camera position (occluder check).
import { initPhysics, PhysicsWorld } from '../src/physics/world.js';
import { buildMachine } from '../src/machine/machine.js';
import { geomBounds } from '../src/machine/geometry.js';
import { Q, V } from '../src/math.js';
import fs from 'node:fs';
await initPhysics();
const pw = new PhysicsWorld(); const M = buildMachine(pw);
const src = fs.readFileSync('src/render/director.js', 'utf8');
const presets = {}; for (const m of src.matchAll(/^\s+(\w+):\s+\{ dist: ([\d.]+), elev: (-?[\d.]+), azim: (-?[\d.]+) \}/gm)) presets[m[1]] = { dist: +m[2], elev: +m[3], azim: +m[4] };
const near = (pt, r) => {
  const out = [];
  for (const p of pw.parts) {
    if (p.name === 'floor') continue;
    const t = p.curr;
    let rad = 0.3;
    for (const s of p.shapes) {
      if (s.type === 'trimesh') { const b = geomBounds(s.geom); rad = Math.max(rad, V.len(V.sub(b.max, b.min)) / 2); }
      else if (s.type === 'box') rad = Math.max(rad, Math.hypot(s.hx, s.hy, s.hz) + V.len(s.pos || { x: 0, y: 0, z: 0 }));
      else if (s.r) rad = Math.max(rad, s.r + (s.hh || 0) + V.len(s.pos || { x: 0, y: 0, z: 0 }));
    }
    const d = Math.hypot(t.x - pt.x, t.y - pt.y, t.z - pt.z);
    if (d < rad + r) out.push(`${p.name || '(' + p.shapes[0].type + ')'}@s${p.stage} d=${d.toFixed(1)} r=${rad.toFixed(1)}`);
  }
  return out;
};
for (const st of M.stages) {
  const pr = presets[st.name] || { dist: 8, elev: 18, azim: 70 };
  const f = st.focus || { x: 0, y: 0, z: 0 };
  const fw = V.add(st.frame.pos, Q.rotate(st.frame.rot, f));
  const yaw = 2 * Math.atan2(st.frame.rot.y, st.frame.rot.w);
  const az = yaw + pr.azim * Math.PI / 180, el = pr.elev * Math.PI / 180;
  const cam = V.add(fw, V.scale({ x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: -Math.sin(az) * Math.cos(el) }, pr.dist));
  cam.y = Math.max(cam.y, 0.6);
  // sample along the view ray too (occluders between camera and focus)
  const hits = new Set(near(cam, 0.8));
  for (let k = 0.15; k < 0.9; k += 0.15) for (const h of near(V.add(cam, V.scale(V.sub(fw, cam), k)), 0.25)) hits.add(h);
  console.log(`${String(st.index).padStart(2)} ${st.name.padEnd(9)} cam(${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)}) focus(${fw.x.toFixed(1)},${fw.y.toFixed(1)},${fw.z.toFixed(1)}) yaw=${(yaw * 180 / Math.PI).toFixed(0)} ${hits.size ? '\n      ' + [...hits].join('\n      ') : 'clear'}`);
}
