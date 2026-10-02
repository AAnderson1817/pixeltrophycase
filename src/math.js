// Minimal vector / quaternion helpers shared by physics and rendering code.
// Vectors are plain {x,y,z}; quaternions are plain {x,y,z,w} (Rapier-compatible).

export const V = {
  make: (x = 0, y = 0, z = 0) => ({ x, y, z }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  len: (a) => Math.hypot(a.x, a.y, a.z),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  norm: (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; },
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }),
  neg: (a) => ({ x: -a.x, y: -a.y, z: -a.z }),
  clone: (a) => ({ x: a.x, y: a.y, z: a.z }),
};

export const Q = {
  identity: () => ({ x: 0, y: 0, z: 0, w: 1 }),
  axisAngle: (axis, angle) => {
    const a = V.norm(axis); const s = Math.sin(angle / 2);
    return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) };
  },
  yaw: (angle) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }),
  // XYZ intrinsic euler (same convention as THREE.Euler default 'XYZ')
  euler: (ex, ey, ez) => {
    const c1 = Math.cos(ex / 2), c2 = Math.cos(ey / 2), c3 = Math.cos(ez / 2);
    const s1 = Math.sin(ex / 2), s2 = Math.sin(ey / 2), s3 = Math.sin(ez / 2);
    return {
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 + s1 * s2 * c3,
      w: c1 * c2 * c3 - s1 * s2 * s3,
    };
  },
  mul: (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }),
  conj: (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w }),
  rotate: (q, v) => {
    // v' = q v q*
    const ix = q.w * v.x + q.y * v.z - q.z * v.y;
    const iy = q.w * v.y + q.z * v.x - q.x * v.z;
    const iz = q.w * v.z + q.x * v.y - q.y * v.x;
    const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
    return {
      x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
    };
  },
  // quaternion that maps +X to the given direction, keeping +Y as close to `up` as possible
  lookAlong: (dir, up = { x: 0, y: 1, z: 0 }) => {
    const f = V.norm(dir);
    let r = V.cross(f, up);
    if (V.len(r) < 1e-6) r = V.cross(f, { x: 0, y: 0, z: 1 });
    r = V.norm(r);
    const u = V.cross(r, f);
    // rotation matrix columns: X->f, Y->u, Z->r  (right-handed: f x u = r)
    return Q.fromBasis(f, u, r);
  },
  fromBasis: (xAxis, yAxis, zAxis) => {
    const m00 = xAxis.x, m01 = yAxis.x, m02 = zAxis.x;
    const m10 = xAxis.y, m11 = yAxis.y, m12 = zAxis.y;
    const m20 = xAxis.z, m21 = yAxis.z, m22 = zAxis.z;
    const tr = m00 + m11 + m22;
    let x, y, z, w;
    if (tr > 0) {
      const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
    } else if (m00 > m11 && m00 > m22) {
      const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
    } else {
      const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
    }
    return { x, y, z, w };
  },
  slerp: (a, b, t) => {
    let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (cos > 0.9995) {
      const r = { x: a.x + (bx - a.x) * t, y: a.y + (by - a.y) * t, z: a.z + (bz - a.z) * t, w: a.w + (bw - a.w) * t };
      const l = Math.hypot(r.x, r.y, r.z, r.w); return { x: r.x / l, y: r.y / l, z: r.z / l, w: r.w / l };
    }
    const th = Math.acos(cos), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return { x: a.x * wa + bx * wb, y: a.y * wa + by * wb, z: a.z * wa + bz * wb, w: a.w * wa + bw * wb };
  },
};

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeInOutCubic = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// Deterministic PRNG (mulberry32) so the machine (and its VFX seeds) is reproducible.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
