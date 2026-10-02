// Builder: declarative construction of parts (physics body + render descriptors), joints, sensors, animators.
// Works in a stack of local frames (translation + yaw) so stages can be laid out relative to each other.
import { RAPIER } from '../physics/world.js';
import { V, Q } from '../math.js';
import { mat } from './materials.js';
import { extrudeProfile, pipeProfile, troughProfile } from './geometry.js';

let nextId = 1;

export class Builder {
  constructor(pw) {
    this.pw = pw;
    this.world = pw.world;
    this.frames = [{ pos: { x: 0, y: 0, z: 0 }, rot: Q.identity() }];
    this.stage = -1;
    this.named = new Map();
  }

  // ---------- frames ----------
  get frame() { return this.frames[this.frames.length - 1]; }
  pushFrame(pos, yaw = 0) {
    const f = this.frame;
    const rot = Q.mul(f.rot, Q.yaw(yaw));
    const p = V.add(f.pos, Q.rotate(f.rot, pos));
    this.frames.push({ pos: p, rot });
    return this.frame;
  }
  popFrame() { if (this.frames.length > 1) this.frames.pop(); }
  toWorld(p) { return V.add(this.frame.pos, Q.rotate(this.frame.rot, p)); }
  toWorldQ(q) { return Q.mul(this.frame.rot, q || Q.identity()); }
  dirToWorld(d) { return Q.rotate(this.frame.rot, d); }
  /** Convert a local point+yaw (e.g. a stage exit) into an absolute frame spec. */
  frameAt(p, yaw = 0) {
    const f = this.frame;
    return { pos: this.toWorld(p), rot: Q.mul(f.rot, Q.yaw(yaw)) };
  }
  setFrame(absFrame) { this.frames.push(absFrame); }

  // ---------- parts ----------
  _desc(type) {
    switch (type) {
      case 'fixed': return RAPIER.RigidBodyDesc.fixed();
      case 'kinematic': return RAPIER.RigidBodyDesc.kinematicPositionBased();
      case 'kinematicVel': return RAPIER.RigidBodyDesc.kinematicVelocityBased();
      default: return RAPIER.RigidBodyDesc.dynamic();
    }
  }

  /**
   * Create a part with one or more shapes.
   * shapes: [{ type:'box', hx,hy,hz } | {type:'ball', r} | {type:'cylinder', hh, r} | {type:'capsule', hh, r}
   *          | {type:'trimesh', geom} | {type:'hull', points}, pos?, rot?, material?, sensor? }]
   */
  part(shapes, { type = 'dynamic', pos = { x: 0, y: 0, z: 0 }, rot = Q.identity(), material = 'steel', mass = null,
    ccd = false, angularDamping = 0, linearDamping = 0, name = null, instanceKey = null, color = null, tags = [],
    impactThreshold = null, canSleep = true, dominance = 0, visual = {}, gravityScale = 1 } = {}) {
    const wp = this.toWorld(pos), wq = this.toWorldQ(rot);
    const desc = this._desc(type).setTranslation(wp.x, wp.y, wp.z).setRotation(wq);
    if (type === 'dynamic') {
      desc.setCcdEnabled(ccd).setAngularDamping(angularDamping).setLinearDamping(linearDamping).setCanSleep(canSleep).setDominanceGroup(dominance).setGravityScale(gravityScale);
    }
    const body = this.world.createRigidBody(desc);
    const part = {
      id: nextId++, name, body, colliders: [], shapes: [], material, color, instanceKey, tags: new Set(tags),
      type, isStatic: type === 'fixed', stage: this.stage, visual,
      prev: { x: wp.x, y: wp.y, z: wp.z, qx: wq.x, qy: wq.y, qz: wq.z, qw: wq.w },
      curr: { x: wp.x, y: wp.y, z: wp.z, qx: wq.x, qy: wq.y, qz: wq.z, qw: wq.w },
    };
    for (const s of shapes) this.addShape(part, s, { mass: mass !== null && shapes.length === 1 ? mass : null, impactThreshold });
    if (mass !== null && shapes.length > 1) body.setAdditionalMass(0, true), this._scaleMass(part, mass);
    this.pw.addPart(part);
    if (name) this.named.set(name, part);
    return part;
  }

  _scaleMass(part, targetMass) {
    const m = part.body.mass();
    if (m <= 0) return;
    const f = targetMass / m;
    for (const c of part.colliders) c.setDensity(c.density() * f);
  }

  addShape(part, s, { mass = null, impactThreshold = null } = {}) {
    const m = mat(s.material || part.material);
    let cd;
    switch (s.type) {
      case 'box': cd = RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz); break;
      case 'roundBox': cd = RAPIER.ColliderDesc.roundCuboid(s.hx, s.hy, s.hz, s.radius); break;
      case 'ball': cd = RAPIER.ColliderDesc.ball(s.r); break;
      case 'cylinder': cd = RAPIER.ColliderDesc.cylinder(s.hh, s.r); break;
      case 'capsule': cd = RAPIER.ColliderDesc.capsule(s.hh, s.r); break;
      case 'trimesh': cd = RAPIER.ColliderDesc.trimesh(s.geom.positions, s.geom.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES); break;
      case 'hull': cd = RAPIER.ColliderDesc.convexHull(s.points); break;
      default: throw new Error('unknown shape ' + s.type);
    }
    const lp = s.pos || { x: 0, y: 0, z: 0 }, lq = s.rot || Q.identity();
    cd.setTranslation(lp.x, lp.y, lp.z).setRotation(lq);
    cd.setFriction(m.friction).setRestitution(m.restitution);
    if (mass !== null) cd.setMass(mass); else cd.setDensity(m.density);
    if (s.sensor) cd.setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const thr = s.impactThreshold ?? impactThreshold;
    if (thr !== null && thr !== undefined) {
      cd.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(thr);
    }
    const col = this.world.createCollider(cd, part.body);
    part.colliders.push(col);
    part.shapes.push({ ...s, pos: lp, rot: lq, material: s.material || part.material });
    if (part.body) this.pw.colliderToPart.set(col.handle, part);
    return col;
  }

  // Convenience single-shape parts (local-frame coordinates)
  box(hx, hy, hz, pos, opts = {}) { return this.part([{ type: 'box', hx, hy, hz }], { pos, ...opts }); }
  ball(r, pos, opts = {}) { return this.part([{ type: 'ball', r }], { pos, ccd: true, angularDamping: 0.08, canSleep: false, ...opts }); }
  cylinder(hh, r, pos, opts = {}) { return this.part([{ type: 'cylinder', hh, r }], { pos, ...opts }); }
  capsule(hh, r, pos, opts = {}) { return this.part([{ type: 'capsule', hh, r }], { pos, ...opts }); }
  fixedBox(hx, hy, hz, pos, opts = {}) { return this.box(hx, hy, hz, pos, { type: 'fixed', material: 'concrete', ...opts }); }

  /** A static slab whose TOP surface runs from point a to point b (local coords), width across, thickness below. */
  slab(a, b, width, thick, opts = {}) {
    const dir = V.sub(b, a), len = V.len(dir);
    const q = Q.lookAlong(dir);
    const up = Q.rotate(q, { x: 0, y: 1, z: 0 });
    const center = V.sub(V.lerp(a, b, 0.5), V.scale(up, thick / 2));
    return this.part([{ type: 'box', hx: len / 2, hy: thick / 2, hz: width / 2 }], { type: 'fixed', pos: center, rot: q, material: 'track', ...opts });
  }

  /** Static trimesh built from a path + profile in local coords. */
  trough(path, { profile = 'pipe', radius = 0.3, width = 0.5, wall = 0.2, thick = 0.05, arcDeg = 170, upMode = 'world', upAt = null, bank = null, material = 'track', type = 'fixed', ...opts } = {}) {
    const prof = profile === 'pipe' ? pipeProfile({ radius, arcDeg, thick }) : profile === 'trough' ? troughProfile({ width, wall, thick }) : profile;
    const geom = extrudeProfile(path, prof, { upMode, upAt, bank, uvScale: 1 });
    return this.part([{ type: 'trimesh', geom }], { type, material, ...opts });
  }

  /** Static trimesh from a prebuilt geometry (local coords). */
  mesh(geom, opts = {}) { return this.part([{ type: 'trimesh', geom }], { type: 'fixed', material: 'track', ...opts }); }

  /** Visual-only part (no physics). */
  decor(shapes, { pos = { x: 0, y: 0, z: 0 }, rot = Q.identity(), material = 'steel', color = null, name = null, visual = {}, instanceKey = null } = {}) {
    const wp = this.toWorld(pos), wq = this.toWorldQ(rot);
    const part = {
      id: nextId++, name, body: null, colliders: [], material, color, instanceKey, tags: new Set(['decor']), type: 'decor', isStatic: true, stage: this.stage, visual,
      shapes: shapes.map(s => ({ ...s, pos: s.pos || { x: 0, y: 0, z: 0 }, rot: s.rot || Q.identity(), material: s.material || material })),
      prev: { x: wp.x, y: wp.y, z: wp.z, qx: wq.x, qy: wq.y, qz: wq.z, qw: wq.w },
      curr: { x: wp.x, y: wp.y, z: wp.z, qx: wq.x, qy: wq.y, qz: wq.z, qw: wq.w },
    };
    this.pw.parts.push(part);
    return part;
  }

  // ---------- sensors ----------
  /** Sensor volume (local coords). onEnter(part, time). */
  sensor(shape, pos, { onEnter, onExit = null, filter = null, once = true, name = null, rot = Q.identity() } = {}) {
    const wp = this.toWorld(pos), wq = this.toWorldQ(rot);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wp.x, wp.y, wp.z).setRotation(wq));
    let cd;
    if (shape.type === 'box') cd = RAPIER.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz);
    else if (shape.type === 'ball') cd = RAPIER.ColliderDesc.ball(shape.r);
    else cd = RAPIER.ColliderDesc.cylinder(shape.hh, shape.r);
    cd.setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const col = this.world.createCollider(cd, body);
    const rec = { name, onEnter, onExit, filter, once, fired: false, collider: col, body, pos: wp, shape };
    this.pw.registerSensor(col, rec);
    return rec;
  }

  // ---------- joints ----------
  _localAnchor(part, worldPoint) {
    const t = part.body.translation(), r = part.body.rotation();
    return Q.rotate(Q.conj(r), V.sub(worldPoint, t));
  }
  _localDir(part, worldDir) { return Q.rotate(Q.conj(part.body.rotation()), worldDir); }

  /** Fixed anchor body (no collider) at a local point, used as the parent of joints to the world. */
  anchor(pos, rot = Q.identity()) {
    const wp = this.toWorld(pos), wq = this.toWorldQ(rot);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wp.x, wp.y, wp.z).setRotation(wq));
    return { body, colliders: [], isStatic: true, type: 'anchor', shapes: [] };
  }

  /** Revolute joint between a and b at local point `pivot` around local-frame `axis`. */
  revolute(a, b, pivot, axis, { limits = null, motorVel = null, motorFactor = 1, motorPos = null, stiffness = 0, damping = 0, contacts = false } = {}) {
    const wp = this.toWorld(pivot), wa = V.norm(this.dirToWorld(axis));
    const jd = RAPIER.JointData.revoluteWithAxes(this._localAnchor(a, wp), this._localAnchor(b, wp), this._localDir(a, wa), this._localDir(b, wa));
    const j = this.world.createImpulseJoint(jd, a.body, b.body, true);
    if (limits) j.setLimits(limits[0], limits[1]);
    if (motorVel !== null) j.configureMotorVelocity(motorVel, motorFactor);
    if (motorPos !== null) j.configureMotorPosition(motorPos, stiffness, damping);
    j.setContactsEnabled(contacts);
    return j;
  }

  /** Prismatic joint; both bodies must share the same orientation (axis is expressed in that shared local frame). */
  prismatic(a, b, point, axis, { limits = null, springPos = null, stiffness = 0, damping = 0, contacts = false, forceBased = true } = {}) {
    const wp = this.toWorld(point), wa = V.norm(this.dirToWorld(axis));
    const jd = RAPIER.JointData.prismatic(this._localAnchor(a, wp), this._localAnchor(b, wp), this._localDir(a, wa));
    const j = this.world.createImpulseJoint(jd, a.body, b.body, true);
    if (limits) j.setLimits(limits[0], limits[1]);
    if (springPos !== null) { if (forceBased) j.configureMotorModel(RAPIER.MotorModel.ForceBased); j.configureMotorPosition(springPos, stiffness, damping); }
    j.setContactsEnabled(contacts);
    return j;
  }

  spherical(a, b, point, { contacts = false } = {}) {
    const wp = this.toWorld(point);
    const jd = RAPIER.JointData.spherical(this._localAnchor(a, wp), this._localAnchor(b, wp));
    const j = this.world.createImpulseJoint(jd, a.body, b.body, true);
    j.setContactsEnabled(contacts);
    return j;
  }

  rope(a, b, pointA, pointB, length = null, { contacts = false } = {}) {
    const wa = this.toWorld(pointA), wb = this.toWorld(pointB);
    const len = length ?? V.dist(wa, wb);
    const jd = RAPIER.JointData.rope(len, this._localAnchor(a, wa), this._localAnchor(b, wb));
    const j = this.world.createImpulseJoint(jd, a.body, b.body, true);
    j.setContactsEnabled(contacts);
    return j;
  }

  weld(a, b, point) {
    const wp = this.toWorld(point);
    const ra = a.body.rotation(), rb = b.body.rotation();
    const jd = RAPIER.JointData.fixed(this._localAnchor(a, wp), Q.identity(), this._localAnchor(b, wp), Q.mul(Q.conj(rb), ra));
    return this.world.createImpulseJoint(jd, a.body, b.body, true);
  }

  // ---------- kinematic helpers ----------
  /** Register a kinematic animator: fn(part, time, dt) -> {pos, rot} in WORLD coords (or null to hold). */
  animate(part, fn) {
    const base = { pos: V.clone(part.body.translation()), rot: { ...part.body.rotation() } };
    const rec = {
      part, base, fn, active: true,
      update: (time, dt) => {
        if (!rec.active) return;
        const r = fn(rec, time, dt);
        if (!r) return;
        if (r.pos) part.body.setNextKinematicTranslation(r.pos);
        if (r.rot) part.body.setNextKinematicRotation(r.rot);
      },
    };
    this.pw.addAnimator(rec);
    return rec;
  }

  get(name) { return this.named.get(name); }
}
