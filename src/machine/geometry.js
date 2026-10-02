// Pure-JS procedural geometry: paths, profiles, extrusion and revolution.
// Output format: { positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array }
// The same data feeds Rapier trimesh colliders and Three.js BufferGeometry.
import { V } from '../math.js';

// ---------- Paths ----------

export function linePath(a, b, segments = 1) {
  const out = [];
  for (let i = 0; i <= segments; i++) out.push(V.lerp(a, b, i / segments));
  return out;
}

export function catmullRom(points, segmentsPerSpan = 10, closed = false) {
  const n = points.length;
  const out = [];
  const get = (i) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const spans = closed ? n : n - 1;
  for (let s = 0; s < spans; s++) {
    const p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
    const last = s === spans - 1 && !closed;
    for (let j = 0; j < segmentsPerSpan + (last ? 1 : 0); j++) {
      const t = j / segmentsPerSpan, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c2, d) => 0.5 * ((2 * b) + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y), z: c(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  return out;
}

/** Helix around the vertical axis through (cx, cz). Angles in radians; `turns` may be fractional; dir=+1 CCW (viewed from above, i.e. increasing angle). */
export function helixPath({ cx, cz, radius, y0, y1, a0, turns, dir = 1, segmentsPerTurn = 64 }) {
  const n = Math.max(2, Math.round(Math.abs(turns) * segmentsPerTurn));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = a0 + dir * turns * Math.PI * 2 * f;
    out.push({ x: cx + radius * Math.cos(a), y: y0 + (y1 - y0) * f, z: cz + radius * Math.sin(a) });
  }
  return out;
}

/** Vertical loop in the local XY plane (ball travelling +X enters at the bottom). z drifts from z0 to z1 across the loop. */
export function loopPath({ cx, cy, radius, z0, z1, segments = 96, startAngle = -Math.PI / 2, turns = 1 }) {
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const a = startAngle + turns * Math.PI * 2 * f;
    out.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a), z: z0 + (z1 - z0) * f });
  }
  return out;
}

/** Quarter-turn arc for a path travelling +X at `start`; sign +1 turns toward +Z (a right turn, exit yaw -90 deg), -1 toward -Z. */
export function quarterTurn(start, R, sign = 1, segments = 24, drop = 0) {
  const out = [];
  for (let i = 1; i <= segments; i++) {
    const th = (Math.PI / 2) * (i / segments);
    out.push({ x: start.x + R * Math.sin(th), y: start.y - drop * (i / segments), z: start.z + sign * (R - R * Math.cos(th)) });
  }
  return out;
}

/** Concatenate paths, dropping coincident joints. */
export function joinPaths(...paths) {
  const out = [];
  for (const p of paths) {
    for (const q of p) {
      const last = out[out.length - 1];
      if (last && V.dist(last, q) < 1e-6) continue;
      out.push(q);
    }
  }
  return out;
}

/** Resample a polyline to roughly uniform spacing (keeps endpoints). */
export function resample(path, spacing) {
  const out = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const d = V.dist(a, b);
    let s = spacing - carry;
    while (s <= d) { out.push(V.lerp(a, b, s / d)); s += spacing; }
    carry = d - (s - spacing);
  }
  const last = path[path.length - 1];
  if (V.dist(out[out.length - 1], last) > 1e-6) out.push(last);
  return out;
}

export function pathLength(path) {
  let l = 0; for (let i = 1; i < path.length; i++) l += V.dist(path[i - 1], path[i]); return l;
}

/**
 * Compute moving frames along a path.
 * upMode 'world'  : up = world Y projected perpendicular to the tangent (ramps, helices, spirals)
 * upMode 'custom' : up from upAt(point, index) (e.g. toward a loop centre)
 * upMode 'transport': parallel transport (double reflection) from world up
 */
export function pathFrames(path, { upMode = 'world', upAt = null, bank = null } = {}) {
  const n = path.length;
  const frames = [];
  let prevU = { x: 0, y: 1, z: 0 };
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    let t = V.norm(V.sub(b, a));
    let u;
    if (upMode === 'custom' && upAt) {
      u = V.norm(upAt(p, i, t));
    } else if (upMode === 'transport') {
      u = prevU;
    } else {
      const wy = { x: 0, y: 1, z: 0 };
      if (Math.abs(V.dot(t, wy)) > 0.999) u = { x: 0, y: 0, z: 1 }; else u = wy;
    }
    // Orthonormalise
    let r = V.cross(t, u);
    if (V.len(r) < 1e-6) r = V.cross(t, { x: 0, y: 0, z: 1 });
    r = V.norm(r);
    u = V.norm(V.cross(r, t));
    if (bank) {
      const ang = bank(p, i, t);
      const c = Math.cos(ang), s = Math.sin(ang);
      const r2 = V.add(V.scale(r, c), V.scale(u, s));
      const u2 = V.add(V.scale(u, c), V.scale(r, -s));
      r = r2; u = u2;
    }
    prevU = u;
    frames.push({ p, t, r, u });
  }
  return frames;
}

// ---------- 2D profiles (x = right, y = up), closed polygons, CCW so left-normals point outward from the solid ----------

/** Flat-bottomed U channel with wall thickness. width = interior width. */
export function troughProfile({ width = 0.5, wall = 0.2, thick = 0.05 } = {}) {
  const w = width / 2, t = thick;
  return [
    { x: -w, y: 0 }, { x: w, y: 0 }, { x: w, y: wall }, { x: w + t, y: wall },
    { x: w + t, y: -t }, { x: -w - t, y: -t }, { x: -w - t, y: wall }, { x: -w, y: wall },
  ];
}

/** Rounded (circular-arc) trough. radius = interior radius; arcDeg = how far the walls wrap (180 = half pipe). y=0 is the lowest interior point. */
export function pipeProfile({ radius = 0.3, arcDeg = 170, thick = 0.05, segments = 14 } = {}) {
  const half = (arcDeg / 2) * Math.PI / 180;
  const pts = [];
  // interior arc from left rim to right rim passing through the bottom
  for (let i = 0; i <= segments; i++) {
    const a = -Math.PI / 2 - half + (2 * half) * (i / segments);
    pts.push({ x: radius * Math.cos(a), y: radius + radius * Math.sin(a) });
  }
  // exterior arc back from right rim to left rim
  for (let i = segments; i >= 0; i--) {
    const a = -Math.PI / 2 - half + (2 * half) * (i / segments);
    pts.push({ x: (radius + thick) * Math.cos(a), y: radius + (radius + thick) * Math.sin(a) });
  }
  return pts;
}

/** Solid rectangle profile (for rails / beams extruded along paths). Centre at (0, -h/2) so the top face is at y=0. */
export function rectProfile(w, h, yTop = 0) {
  // clockwise so that left-normals point outward from the solid
  return [{ x: -w / 2, y: yTop }, { x: w / 2, y: yTop }, { x: w / 2, y: yTop - h }, { x: -w / 2, y: yTop - h }];
}

// ---------- Mesh generation ----------

function pushQuad(out, a0, a1, b0, b1, intendedNormal) {
  // vertices are indices into positions; ensure winding faces intendedNormal
  const P = out.positions;
  const ax = P[a0 * 3], ay = P[a0 * 3 + 1], az = P[a0 * 3 + 2];
  const e1 = { x: P[b0 * 3] - ax, y: P[b0 * 3 + 1] - ay, z: P[b0 * 3 + 2] - az };
  const e2 = { x: P[b1 * 3] - ax, y: P[b1 * 3 + 1] - ay, z: P[b1 * 3 + 2] - az };
  const c = V.cross(e1, e2);
  const flip = V.dot(c, intendedNormal) < 0;
  if (!flip) out.indices.push(a0, b0, b1, a0, b1, a1);
  else out.indices.push(a0, b1, b0, a0, a1, b1);
}

/**
 * Extrude a closed 2D profile along a path. Each profile edge gets its own vertex strip (hard edges across
 * the profile, smooth along the path).
 */
export function extrudeProfile(path, profile, { upMode = 'world', upAt = null, bank = null, uvScale = 1, closedPath = false } = {}) {
  const frames = pathFrames(path, { upMode, upAt, bank });
  const n = frames.length, m = profile.length;
  const positions = [], normals = [], uvs = [];
  const out = { positions, normals, uvs, indices: [] };
  // arc length per ring
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + V.dist(frames[i - 1].p, frames[i].p));
  // profile edge data
  const edges = [];
  let vAcc = 0;
  for (let k = 0; k < m; k++) {
    const p0 = profile[k], p1 = profile[(k + 1) % m];
    const dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1;
    edges.push({ p0, p1, n: { x: -dy / l, y: dx / l }, v0: vAcc, v1: vAcc + l });
    vAcc += l;
  }
  // vertices: ring i, edge k, end e (0/1) -> index = (i*m + k)*2 + e
  for (let i = 0; i < n; i++) {
    const { p, r, u } = frames[i];
    for (let k = 0; k < m; k++) {
      const e = edges[k];
      const nrm = V.add(V.scale(r, e.n.x), V.scale(u, e.n.y));
      for (const [pt, vv] of [[e.p0, e.v0], [e.p1, e.v1]]) {
        positions.push(p.x + r.x * pt.x + u.x * pt.y, p.y + r.y * pt.x + u.y * pt.y, p.z + r.z * pt.x + u.z * pt.y);
        normals.push(nrm.x, nrm.y, nrm.z);
        uvs.push(s[i] * uvScale, vv * uvScale);
      }
    }
  }
  const rings = closedPath ? n : n - 1;
  for (let i = 0; i < rings; i++) {
    const i1 = (i + 1) % n;
    for (let k = 0; k < m; k++) {
      const a0 = (i * m + k) * 2, a1 = a0 + 1;
      const b0 = (i1 * m + k) * 2, b1 = b0 + 1;
      const nrm = { x: normals[a0 * 3], y: normals[a0 * 3 + 1], z: normals[a0 * 3 + 2] };
      pushQuad(out, a0, a1, b0, b1, nrm);
    }
  }
  return finalize(out);
}

/**
 * Revolve a closed (r, y) profile around the Y axis. Profile points: {x: radius, y: height}.
 * Hard edges across profile corners, smooth around the axis.
 */
export function revolve(profile, segments = 64, { a0 = 0, a1 = Math.PI * 2, uvScale = 1 } = {}) {
  const m = profile.length;
  const positions = [], normals = [], uvs = [];
  const out = { positions, normals, uvs, indices: [] };
  const closed = Math.abs((a1 - a0) - Math.PI * 2) < 1e-6;
  const edges = [];
  for (let k = 0; k < m; k++) {
    const p0 = profile[k], p1 = profile[(k + 1) % m];
    const dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1;
    edges.push({ p0, p1, n: { x: -dy / l, y: dx / l } });
  }
  const n = segments + 1;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / segments);
    const c = Math.cos(a), s = Math.sin(a);
    for (let k = 0; k < m; k++) {
      const e = edges[k];
      for (const pt of [e.p0, e.p1]) {
        positions.push(pt.x * c, pt.y, pt.x * s);
        normals.push(e.n.x * c, e.n.y, e.n.x * s);
        uvs.push((i / segments) * uvScale, pt.y * uvScale);
      }
    }
  }
  const rings = closed ? segments : segments;
  for (let i = 0; i < rings; i++) {
    const i1 = (i + 1) % n;
    if (closed && i1 === 0) continue; // last ring duplicates the first (i = segments) - fine, already covered
    for (let k = 0; k < m; k++) {
      const a0i = (i * m + k) * 2, a1i = a0i + 1;
      const b0i = (i1 * m + k) * 2, b1i = b0i + 1;
      const nrm = { x: normals[a0i * 3], y: normals[a0i * 3 + 1], z: normals[a0i * 3 + 2] };
      pushQuad(out, a0i, a1i, b0i, b1i, nrm);
    }
  }
  return finalize(out);
}

/** Merge several geometries into one. */
export function mergeGeoms(geoms) {
  let nv = 0, ni = 0;
  for (const g of geoms) { nv += g.positions.length / 3; ni += g.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
  const indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of geoms) {
    positions.set(g.positions, vo * 3); normals.set(g.normals, vo * 3); uvs.set(g.uvs, vo * 2);
    for (let i = 0; i < g.indices.length; i++) indices[io + i] = g.indices[i] + vo;
    vo += g.positions.length / 3; io += g.indices.length;
  }
  return { positions, normals, uvs, indices };
}

/** Apply a rigid transform (translation + quaternion) to a geometry in place. */
export function transformGeom(g, pos, q) {
  const P = g.positions, N = g.normals;
  for (let i = 0; i < P.length; i += 3) {
    const p = rotQ(q, P[i], P[i + 1], P[i + 2]);
    P[i] = p.x + pos.x; P[i + 1] = p.y + pos.y; P[i + 2] = p.z + pos.z;
    const n = rotQ(q, N[i], N[i + 1], N[i + 2]);
    N[i] = n.x; N[i + 1] = n.y; N[i + 2] = n.z;
  }
  return g;
}

function rotQ(q, x, y, z) {
  const ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

function finalize(out) {
  return {
    positions: new Float32Array(out.positions),
    normals: new Float32Array(out.normals),
    uvs: new Float32Array(out.uvs),
    indices: new Uint32Array(out.indices),
  };
}

/** Axis-aligned bounds of a geometry. */
export function geomBounds(g) {
  const P = g.positions; const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < P.length; i += 3) {
    min.x = Math.min(min.x, P[i]); max.x = Math.max(max.x, P[i]);
    min.y = Math.min(min.y, P[i + 1]); max.y = Math.max(max.y, P[i + 1]);
    min.z = Math.min(min.z, P[i + 2]); max.z = Math.max(max.z, P[i + 2]);
  }
  return { min, max };
}
