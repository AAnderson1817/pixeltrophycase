// GPU particle system (sparks, dust, confetti, fireworks), ribbon trails, impact rings, camera shake, time dilation.
import * as THREE from 'three';
import { rng } from '../math.js';

const PARTICLE_VS = /* glsl */`
  attribute vec3 vel; attribute vec4 pdata; // birth, life, size, kind
  attribute vec3 pcolor;
  uniform float uTime; uniform float uPixelRatio; uniform float uScale; // uScale: device px per metre at 1 m
  varying float vAge; varying vec3 vColor; varying float vKind; varying float vSeed; varying float vNear;
  void main() {
    float age = (uTime - pdata.x) / pdata.y;
    vAge = age; vColor = pcolor; vKind = pdata.w; vSeed = fract(pdata.x * 13.37);
    float t = (uTime - pdata.x);
    vec3 g = vec3(0.0, -9.81, 0.0);
    float drag = pdata.w == 2.0 ? 0.85 : (pdata.w == 1.0 ? 0.08 : 0.55);
    // analytic drag-ish integration
    float k = drag;
    float tt = (1.0 - exp(-k * t)) / k;
    vec3 gScaled = g * (pdata.w == 1.0 ? 0.08 : (pdata.w == 2.0 ? 0.35 : 1.0));
    vec3 p = position + vel * tt + gScaled * (t * t * 0.5);
    if (pdata.w == 2.0) p += vec3(sin(t * 6.0 + vSeed * 20.0), 0.0, cos(t * 5.0 + vSeed * 17.0)) * 0.08 * t;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float fade = pdata.w == 0.0 ? (1.0 - age) : (pdata.w == 1.0 ? sin(min(age, 1.0) * 3.1416) : 1.0);
    float px = pdata.z * 0.01 * uScale / max(-mv.z, 0.05) * (pdata.w == 1.0 ? (0.6 + age * 1.6) : max(fade, 0.2));
    gl_PointSize = min(px, 96.0 * uPixelRatio);
    vNear = smoothstep(0.25, 1.5, -mv.z);
    gl_Position = projectionMatrix * mv;
    if (age > 1.0 || age < 0.0) gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
  }`;
const PARTICLE_FS = /* glsl */`
  varying float vAge; varying vec3 vColor; varying float vKind; varying float vSeed; varying float vNear;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (vKind == 2.0) { // confetti: rotating rectangle
      float a = vSeed * 6.28 + vAge * 9.0;
      vec2 r = vec2(uv.x * cos(a) - uv.y * sin(a), uv.x * sin(a) + uv.y * cos(a));
      if (abs(r.x) > 0.42 || abs(r.y) > 0.22) discard;
      gl_FragColor = vec4(vColor * (0.7 + 0.5 * sin(a)), vNear * (1.0 - smoothstep(0.85, 1.0, vAge)));
      return;
    }
    if (d > 0.5) discard;
    float soft = vKind == 1.0 ? smoothstep(0.5, 0.0, d) : smoothstep(0.5, 0.1, d);
    float alpha = vNear * (vKind == 1.0 ? soft * 0.3 * (1.0 - vAge) : soft * (1.0 - vAge * vAge));
    vec3 col = vKind == 1.0 ? vColor : vColor * (1.0 + 2.0 * (1.0 - vAge) * soft);
    gl_FragColor = vec4(col, alpha);
  }`;

class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max; this.head = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.data = new Float32Array(max * 4); this.col = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) { this.data[i * 4] = -1e9; this.data[i * 4 + 1] = 1; }
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.BufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('vel', this.aVel); g.setAttribute('pdata', this.aData); g.setAttribute('pcolor', this.aCol);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uScale: { value: 900 } },
    });
    this.points = new THREE.Points(g, this.material); this.points.frustumCulled = false; this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
    this.dirty = [];
    this.time = 0;
  }
  emit(n, at, rand, fn) {
    const start = this.head;
    for (let i = 0; i < n; i++) {
      const idx = this.head; this.head = (this.head + 1) % this.max;
      const p = fn(i, rand);
      this.pos[idx * 3] = at.x + (p.ox || 0); this.pos[idx * 3 + 1] = at.y + (p.oy || 0); this.pos[idx * 3 + 2] = at.z + (p.oz || 0);
      this.vel[idx * 3] = p.vx; this.vel[idx * 3 + 1] = p.vy; this.vel[idx * 3 + 2] = p.vz;
      this.data[idx * 4] = this.time; this.data[idx * 4 + 1] = p.life; this.data[idx * 4 + 2] = p.size; this.data[idx * 4 + 3] = p.kind;
      this.col[idx * 3] = p.r; this.col[idx * 3 + 1] = p.g; this.col[idx * 3 + 2] = p.b;
    }
    if (start + n <= this.max) this.dirty.push([start, n]); else { this.dirty.push([start, this.max - start]); this.dirty.push([0, n - (this.max - start)]); }
  }
  update(time) {
    this.time = time; this.material.uniforms.uTime.value = time;
    if (!this.dirty.length) return;
    for (const a of [this.aPos, this.aVel, this.aCol]) { a.clearUpdateRanges(); for (const [s, n] of this.dirty) a.addUpdateRange(s * 3, n * 3); a.needsUpdate = true; }
    this.aData.clearUpdateRanges(); for (const [s, n] of this.dirty) this.aData.addUpdateRange(s * 4, n * 4); this.aData.needsUpdate = true;
    this.dirty.length = 0;
  }
}

/** Two GPU pools: additive for hot sparks/fireworks, normal-blended for dust and confetti (which must occlude, not glow). */
export class ParticleSystem {
  constructor(scene, max = 16000) {
    this.hot = new ParticlePool(scene, max, true);
    this.soft = new ParticlePool(scene, max, false);
    this.rand = rng(1234);
  }
  setPixelRatio(r) { this.hot.material.uniforms.uPixelRatio.value = r; this.soft.material.uniforms.uPixelRatio.value = r; }
  /** Device-pixel scale of the current view: px per metre at 1 m distance. */
  setView(camera, bufferHeightPx) { const k = bufferHeightPx / (2 * Math.tan(camera.fov * Math.PI / 360)); this.hot.material.uniforms.uScale.value = k; this.soft.material.uniforms.uScale.value = k; }
  update(time) { this.hot.update(time); this.soft.update(time); }
  /** kind: 0 spark (additive, gravity, fades), 1 dust (soft, slow), 2 confetti (flat, fluttering) */
  emit(n, at, fn, pool = 'hot') { this[pool].emit(n, at, this.rand, fn); }

  sparks(at, normal, strength = 1, count = 24) {
    this.emit(count, at, (i, R) => {
      const sp = (2 + 6 * R()) * strength;
      const dx = R() - 0.5, dy = R() * 0.9, dz = R() - 0.5;
      const v = new THREE.Vector3(dx + normal.x * 0.8, dy + normal.y * 0.8, dz + normal.z * 0.8).normalize().multiplyScalar(sp);
      const heat = R();
      return { vx: v.x, vy: v.y, vz: v.z, life: 0.25 + R() * 0.55, size: 2.2 + R() * 2.5, kind: 0, r: 1.0, g: 0.55 + 0.4 * heat, b: 0.15 + 0.3 * heat };
    });
  }
  dust(at, strength = 1, count = 10, color = [0.42, 0.39, 0.35]) {
    this.emit(count, at, (i, R) => {
      const a = R() * Math.PI * 2, sp = (0.3 + R() * 0.9) * strength;
      return { vx: Math.cos(a) * sp, vy: 0.4 + R() * 0.8 * strength, vz: Math.sin(a) * sp, life: 0.8 + R() * 0.9, size: 7 + R() * 9, kind: 1, r: color[0], g: color[1], b: color[2], ox: (R() - 0.5) * 0.2, oy: 0.05, oz: (R() - 0.5) * 0.2 };
    }, 'soft');
  }
  confettiBurst(at, count = 400, spread = 7) {
    const palette = [[1, 0.2, 0.3], [1, 0.8, 0.1], [0.2, 0.9, 0.5], [0.3, 0.6, 1], [0.9, 0.3, 1], [1, 1, 1]];
    this.emit(count, at, (i, R) => {
      const a = R() * Math.PI * 2, el = 0.4 + R() * 1.1, sp = (3 + R() * spread);
      const c = palette[Math.floor(R() * palette.length)];
      return { vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(a) * Math.cos(el) * sp, life: 3.5 + R() * 2.5, size: 6 + R() * 5, kind: 2, r: c[0], g: c[1], b: c[2] };
    }, 'soft');
  }
  firework(at, color = [1, 0.6, 0.2], count = 220) {
    this.emit(count, at, (i, R) => {
      const u = R() * 2 - 1, th = R() * Math.PI * 2, s = Math.sqrt(1 - u * u), sp = 5 + R() * 4;
      return { vx: s * Math.cos(th) * sp, vy: u * sp, vz: s * Math.sin(th) * sp, life: 1.2 + R() * 1.0, size: 6 + R() * 5, kind: 0, r: color[0], g: color[1], b: color[2] };
    });
  }
}

/** Camera-facing ribbon trails for fast hero balls. */
export class TrailSystem {
  constructor(scene) {
    this.scene = scene; this.trails = new Map(); this.maxPts = 28;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0xfff2c8) } },
      vertexShader: `attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vT; void main(){ float a = pow(vT, 1.8) * 0.5; gl_FragColor = vec4(uColor * (0.4 + 0.7 * vT), a); }`,
    });
  }
  track(part) {
    if (this.trails.has(part.id)) return;
    const n = this.maxPts;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 2 * 3), tt = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('t', new THREE.BufferAttribute(tt, 1));
    for (let i = 0; i < n; i++) { tt[i * 2] = i / (n - 1); tt[i * 2 + 1] = i / (n - 1); }
    geom.setIndex(idx); geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mesh = new THREE.Mesh(geom, this.mat); mesh.frustumCulled = false; mesh.renderOrder = 9;
    this.scene.add(mesh);
    this.trails.set(part.id, { part, mesh, pts: [], pos, width: (part.shapes[0]?.r || 0.1) * 0.9, visible: false });
  }
  update(camera, dt) {
    const camPos = camera.position;
    for (const tr of this.trails.values()) {
      const p = tr.part.obj.position;
      const v = tr.part.body.linvel(); const speed = Math.hypot(v.x, v.y, v.z);
      tr.pts.push(p.clone()); if (tr.pts.length > this.maxPts) tr.pts.shift();
      const fast = speed > 3.0;
      tr.mesh.visible = fast || tr.visible;
      tr.visible = fast ? true : (tr.visible && speed > 1.5);
      if (!tr.mesh.visible) continue;
      const n = this.maxPts, pts = tr.pts;
      const dir = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const k = Math.max(0, pts.length - n + i);
        const a = pts[k], b = pts[Math.min(pts.length - 1, k + 1)];
        dir.subVectors(b, a); if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
        toCam.subVectors(camPos, a); side.crossVectors(dir, toCam).normalize();
        const w = tr.width * (0.25 + 0.75 * i / (n - 1)) * Math.min(1, speed / 6);
        tr.pos[i * 6] = a.x + side.x * w; tr.pos[i * 6 + 1] = a.y + side.y * w; tr.pos[i * 6 + 2] = a.z + side.z * w;
        tr.pos[i * 6 + 3] = a.x - side.x * w; tr.pos[i * 6 + 4] = a.y - side.y * w; tr.pos[i * 6 + 5] = a.z - side.z * w;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }
}

/** Expanding impact rings (shockwave decals). */
export class ImpactRings {
  constructor(scene, n = 24) {
    this.pool = [];
    const geom = new THREE.RingGeometry(0.6, 1.0, 40);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(geom, mat); m.visible = false; m.renderOrder = 8;
      scene.add(m); this.pool.push({ mesh: m, t: 0, life: 0.5, scale: 1 });
    }
    this.next = 0;
  }
  spawn(at, normal, size = 0.6, life = 0.45) {
    const r = this.pool[this.next]; this.next = (this.next + 1) % this.pool.length;
    r.mesh.visible = true; r.t = 0; r.life = life; r.scale = size;
    r.mesh.position.set(at.x + normal.x * 0.02, at.y + normal.y * 0.02, at.z + normal.z * 0.02);
    r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(normal.x, normal.y, normal.z).normalize());
  }
  update(dt) {
    for (const r of this.pool) {
      if (!r.mesh.visible) continue;
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const s = r.scale * (0.2 + 1.3 * k); r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.45 * (1 - k) * (1 - k);
    }
  }
}

export class CameraShake {
  constructor() { this.amp = 0; this.t = 0; this.rand = rng(99); }
  kick(a) { this.amp = Math.min(1.5, this.amp + a); }
  update(dt) { this.t += dt; this.amp = Math.max(0, this.amp - dt * 2.2 * (0.4 + this.amp)); }
  offset(out) {
    const a = this.amp * this.amp * 0.12, t = this.t * 31;
    out.set(Math.sin(t * 1.3) * a, Math.sin(t * 1.7 + 1.3) * a * 0.7, Math.cos(t * 1.1 + 0.7) * a * 0.5);
    return out;
  }
}
