// Fixed-timestep Rapier world with render interpolation, sensors, contact events and kinematic animators.
import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };
export const FIXED_DT = 1 / 120;

let initialised = false;
export async function initPhysics() {
  if (!initialised) { await RAPIER.init(); initialised = true; }
  return RAPIER;
}

export class PhysicsWorld {
  constructor({ gravity = -9.81 } = {}) {
    this.world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.world.timestep = FIXED_DT;
    const ip = this.world.integrationParameters;
    ip.numSolverIterations = 8;
    ip.maxCcdSubsteps = 4;
    this.events = new RAPIER.EventQueue(true);
    this.time = 0;
    this.accumulator = 0;
    this.alpha = 0;
    this.timeScale = 1;
    this.paused = false;
    this.parts = [];            // every part (static + dynamic)
    this.movingParts = [];      // dynamic + kinematic parts (need interpolation)
    this.colliderToPart = new Map();
    this.sensors = new Map();   // collider handle -> sensor record
    this.animators = [];        // { update(time, dt) }
    this.preStep = [];          // fn(time)
    this.contactListeners = []; // fn({partA, partB, point, normal, force})
    this.stepCount = 0;
    this.maxStepsPerFrame = 12;
  }

  addPart(part) {
    this.parts.push(part);
    if (part.body && part.body.bodyType() !== RAPIER.RigidBodyType.Fixed) {
      this.movingParts.push(part);
      this._snapshot(part, part.prev); this._snapshot(part, part.curr);
    }
    for (const c of part.colliders) this.colliderToPart.set(c.handle, part);
    return part;
  }

  registerSensor(collider, record) { this.sensors.set(collider.handle, record); }
  addAnimator(a) { this.animators.push(a); return a; }
  onContact(fn) { this.contactListeners.push(fn); }

  _snapshot(part, into) {
    const t = part.body.translation(), r = part.body.rotation();
    into.x = t.x; into.y = t.y; into.z = t.z;
    into.qx = r.x; into.qy = r.y; into.qz = r.z; into.qw = r.w;
  }

  /** Advance by wall-clock seconds; returns number of physics steps taken. */
  update(dtWall) {
    if (this.paused) return 0;
    this.accumulator += Math.min(dtWall, 0.25) * this.timeScale;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < this.maxStepsPerFrame) {
      this.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = 0; // drop time if we fall behind
    this.alpha = this.accumulator / FIXED_DT;
    return steps;
  }

  /** One fixed step. */
  step() {
    const h = FIXED_DT;
    for (const a of this.animators) a.update(this.time, h);
    for (const f of this.preStep) f(this.time, h);
    for (const p of this.movingParts) {
      if (p.body.isSleeping()) continue;
      const c = p.curr, q = p.prev;
      q.x = c.x; q.y = c.y; q.z = c.z; q.qx = c.qx; q.qy = c.qy; q.qz = c.qz; q.qw = c.qw;
    }
    this.world.step(this.events);
    this.time += h;
    this.stepCount++;
    for (const p of this.movingParts) {
      if (p.body.isSleeping()) continue;
      this._snapshot(p, p.curr);
    }
    this.events.drainCollisionEvents((h1, h2, started) => {
      const s1 = this.sensors.get(h1), s2 = this.sensors.get(h2);
      if (s1) this._fireSensor(s1, h2, started);
      if (s2) this._fireSensor(s2, h1, started);
    });
    if (this.contactListeners.length) {
      this.events.drainContactForceEvents((ev) => {
        const c1 = this.world.getCollider(ev.collider1()), c2 = this.world.getCollider(ev.collider2());
        if (!c1 || !c2) return;
        const pa = this.colliderToPart.get(c1.handle), pb = this.colliderToPart.get(c2.handle);
        const force = ev.maxForceMagnitude();
        let point = null, normal = null;
        this.world.contactPair(c1, c2, (manifold) => {
          if (point) return;
          const n = manifold.numSolverContacts();
          if (n > 0) { point = manifold.solverContactPoint(0); normal = manifold.normal(); }
        });
        if (!point) { const t = c1.translation(); point = { x: t.x, y: t.y, z: t.z }; normal = { x: 0, y: 1, z: 0 }; }
        for (const fn of this.contactListeners) fn({ partA: pa, partB: pb, point, normal, force, time: this.time });
      });
    } else {
      this.events.drainContactForceEvents(() => {});
    }
  }

  _fireSensor(sensor, otherHandle, started) {
    const other = this.colliderToPart.get(otherHandle);
    if (sensor.filter && !sensor.filter(other)) return;
    if (started) {
      if (sensor.once && sensor.fired) return;
      sensor.fired = true;
      sensor.onEnter && sensor.onEnter(other, this.time);
    } else {
      sensor.onExit && sensor.onExit(other, this.time);
    }
  }

  /** Interpolated transform for rendering. */
  interpolate(part, out) {
    const a = this.alpha, p = part.prev, c = part.curr;
    out.x = p.x + (c.x - p.x) * a; out.y = p.y + (c.y - p.y) * a; out.z = p.z + (c.z - p.z) * a;
    // nlerp is fine for small per-step rotations
    let dot = p.qx * c.qx + p.qy * c.qy + p.qz * c.qz + p.qw * c.qw;
    const s = dot < 0 ? -1 : 1;
    let qx = p.qx + (c.qx * s - p.qx) * a, qy = p.qy + (c.qy * s - p.qy) * a, qz = p.qz + (c.qz * s - p.qz) * a, qw = p.qw + (c.qw * s - p.qw) * a;
    const l = Math.hypot(qx, qy, qz, qw) || 1;
    out.qx = qx / l; out.qy = qy / l; out.qz = qz / l; out.qw = qw / l;
    return out;
  }

  bodyCount() { return this.world.bodies.len(); }
  colliderCount() { return this.world.colliders.len(); }
}
