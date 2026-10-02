// Builds Three.js meshes for machine parts and keeps them in sync with the interpolated physics transforms.
import * as THREE from 'three';
import { getMaterial } from './materials.js';
import { buildTrophyVoxels, buildMarquee } from './decor.js';

const geomCache = new Map();
function shapeGeometry(s) {
  let key;
  switch (s.type) {
    case 'box': key = `box|${s.hx}|${s.hy}|${s.hz}`; break;
    case 'roundBox': key = `rbox|${s.hx}|${s.hy}|${s.hz}|${s.radius}`; break;
    case 'ball': key = `ball|${s.r}`; break;
    case 'cylinder': key = `cyl|${s.hh}|${s.r}`; break;
    case 'capsule': key = `cap|${s.hh}|${s.r}`; break;
    case 'trimesh': key = null; break;
    default: key = `unknown`;
  }
  if (key && geomCache.has(key)) return geomCache.get(key);
  let g;
  switch (s.type) {
    case 'box': g = new THREE.BoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2); break;
    case 'roundBox': g = new THREE.BoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2); break;
    case 'ball': g = new THREE.SphereGeometry(s.r, s.r > 0.2 ? 48 : 28, s.r > 0.2 ? 32 : 20); break;
    case 'cylinder': g = new THREE.CylinderGeometry(s.r, s.r, s.hh * 2, 32); break;
    case 'capsule': g = new THREE.CapsuleGeometry(s.r, s.hh * 2, 6, 20); break;
    case 'trimesh': {
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(s.geom.positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(s.geom.normals, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(s.geom.uvs, 2));
      g.setIndex(new THREE.BufferAttribute(s.geom.indices, 1));
      g.computeBoundingSphere();
      break;
    }
    default: g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
  if (key) geomCache.set(key, g);
  return g;
}

export class SceneSync {
  constructor(scene, pw) {
    this.scene = scene; this.pw = pw;
    this.root = new THREE.Group(); this.root.name = 'machine'; scene.add(this.root);
    this.objects = [];          // { part, obj }  non-instanced moving parts
    this.instanced = [];        // { mesh, entries: [{part, shapeIndex}] }
    this.lines = [];            // ropes / rods / strings
    this.tmpPos = new THREE.Vector3(); this.tmpQ = new THREE.Quaternion(); this.tmpS = new THREE.Vector3(1, 1, 1); this.tmpM = new THREE.Matrix4();
    this.tmpM2 = new THREE.Matrix4(); this.lp = new THREE.Vector3(); this.lq = new THREE.Quaternion();
    this.t = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    this.build();
  }

  build() {
    const groups = new Map(); // instanceKey -> parts
    for (const part of this.pw.parts) {
      if (part.visual?.hidden) continue; // e.g. the physics floor slab: the hall draws its own floor (avoids coplanar z-fighting)
      if (part.instanceKey) { if (!groups.has(part.instanceKey)) groups.set(part.instanceKey, []); groups.get(part.instanceKey).push(part); continue; }
      this.buildPart(part);
    }
    for (const [key, parts] of groups) this.buildInstanced(key, parts);
  }

  buildPart(part) {
    const look = part.visual?.look || null;
    const group = new THREE.Group();
    group.name = part.name || part.instanceKey || part.type;
    for (const s of part.shapes) {
      const geom = shapeGeometry(s);
      const mat = part.visual?.glass ? getMaterial('glass') : getMaterial(s.material, part.color, look);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      mesh.quaternion.set(s.rot.x, s.rot.y, s.rot.z, s.rot.w);
      mesh.castShadow = !part.visual?.glass; mesh.receiveShadow = true;
      if (s.type === 'trimesh') { mesh.castShadow = true; }
      group.add(mesh);
    }
    if (part.visual?.trophy) group.add(buildTrophyVoxels());
    if (part.visual?.marquee) group.add(buildMarquee(part.visual.marquee, part.shapes[0]));
    if (part.visual?.ring) { /* loop support ring: replace box with torus */ }
    const c = part.curr;
    group.position.set(c.x, c.y, c.z); group.quaternion.set(c.qx, c.qy, c.qz, c.qw);
    this.root.add(group);
    part.obj = group;
    if (part.body && !part.isStatic) this.objects.push({ part, obj: group });
    const vis = part.visual || {};
    if (vis.rope || vis.rod) this.addLine(part, vis.rope?.pivot || vis.rod?.pivot, vis.rod ? 0.03 : 0.012, vis.rod ? 'steel' : 'rubber');
    if (vis.strings) { const top = vis.strings.top; this.addLine(part, { x: top.x, y: top.y, z: top.z + vis.strings.spread }, 0.006, 'steel'); this.addLine(part, { x: top.x, y: top.y, z: top.z - vis.strings.spread }, 0.006, 'steel'); }
  }

  addLine(part, pivot, radius, material) {
    const geom = new THREE.CylinderGeometry(radius, radius, 1, 8, 1, true);
    geom.translate(0, 0.5, 0); // from origin up to 1
    const mesh = new THREE.Mesh(geom, getMaterial(material));
    mesh.castShadow = false;
    this.root.add(mesh);
    this.lines.push({ part, pivot: new THREE.Vector3(pivot.x, pivot.y, pivot.z), mesh });
  }

  buildInstanced(key, parts) {
    // all parts in a group share the shape list; one InstancedMesh per shape index
    const proto = parts[0];
    for (let si = 0; si < proto.shapes.length; si++) {
      const s = proto.shapes[si];
      const geom = shapeGeometry(s);
      const mat = getMaterial(s.material, proto.color, proto.visual?.look || null);
      const mesh = new THREE.InstancedMesh(geom, mat, parts.length);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = key;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const colorVary = parts.some(p => p.color !== proto.color);
      if (colorVary) { const col = new THREE.Color(); parts.forEach((p, i) => { col.set(p.color ?? 0xffffff); mesh.setColorAt(i, col); }); if (mat.map) mat.color.set(0xffffff); }
      const entries = parts.map((p, i) => ({ part: p, index: i, shape: p.shapes[si] }));
      this.root.add(mesh);
      this.instanced.push({ mesh, entries, dynamic: !!proto.body && !proto.isStatic });
      for (const e of entries) this.setInstance(mesh, e, e.part.curr);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setInstance(mesh, e, t) {
    this.tmpPos.set(t.x, t.y, t.z); this.tmpQ.set(t.qx, t.qy, t.qz, t.qw);
    this.tmpM.compose(this.tmpPos, this.tmpQ, this.tmpS);
    const s = e.shape;
    if (s.pos.x || s.pos.y || s.pos.z || s.rot.x || s.rot.y || s.rot.z) {
      this.lp.set(s.pos.x, s.pos.y, s.pos.z); this.lq.set(s.rot.x, s.rot.y, s.rot.z, s.rot.w);
      this.tmpM2.compose(this.lp, this.lq, this.tmpS); this.tmpM.multiply(this.tmpM2);
    }
    mesh.setMatrixAt(e.index, this.tmpM);
  }

  update() {
    const pw = this.pw, t = this.t;
    for (const { part, obj } of this.objects) {
      pw.interpolate(part, t);
      obj.position.set(t.x, t.y, t.z); obj.quaternion.set(t.qx, t.qy, t.qz, t.qw);
    }
    for (const g of this.instanced) {
      if (!g.dynamic) continue;
      let any = false;
      for (const e of g.entries) {
        if (e.part.body.isSleeping() && e.synced) continue;
        pw.interpolate(e.part, t); this.setInstance(g.mesh, e, t); e.synced = e.part.body.isSleeping(); any = true;
      }
      if (any) g.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const l of this.lines) {
      const p = l.part.obj.position;
      const d = this.tmpPos.copy(p).sub(l.pivot);
      const len = d.length();
      l.mesh.position.copy(l.pivot);
      l.mesh.scale.set(1, len, 1);
      this.tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      l.mesh.quaternion.copy(this.tmpQ);
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => { if (o.isMesh && o.geometry && !geomCache.has(o.geometry)) { /* shared via cache; leave */ } });
  }
}
