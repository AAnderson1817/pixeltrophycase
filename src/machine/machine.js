// The Rube Goldberg machine: stage orchestration, chaining frames, progress tracking.
import { Builder } from './builder.js';
import { V, Q } from '../math.js';
import { geomBounds } from './geometry.js';
import * as opening from './stages/opening.js';
import * as descent from './stages/descent.js';
import * as demolition from './stages/demolition.js';
import * as transport from './stages/transport.js';
import * as finale from './stages/finale.js';

export const STAGE_FUNCS = [
  opening.releaseAndHelix,
  opening.dominoSerpentine,
  opening.seesawCatapult,
  opening.newtonsCradle,
  descent.zigzagPlanks,
  descent.loopTheLoop,
  descent.paddleWheel,
  descent.pressurePlateRelease,
  demolition.wreckingBall,
  demolition.balanceGate,
  demolition.plinko,
  transport.rollerConveyor,
  transport.lift,
  transport.grandSpiral,
  transport.bowling,
  transport.cartRun,
  finale.hammerChain,
  finale.marbleCascade,
  finale.vortexFunnel,
  finale.trophyCase,
];

export class Machine {
  constructor(pw, { maxStages = 999 } = {}) {
    this.pw = pw;
    this.B = new Builder(pw);
    this.stages = [];
    this.current = -1;
    this.listeners = { stage: [], event: [], finale: [] };
    this.finished = false;
    this.finishedAt = null;
    this.startTime = null;
    this.started = false;
    this.maxStages = maxStages;
    this.actions = []; // deferred timed actions { at, fn }
    this.heroes = [];
    this.startFns = [];
  }

  on(ev, fn) { this.listeners[ev].push(fn); return this; }
  emit(ev, ...args) { for (const f of this.listeners[ev]) f(...args); }

  /** Register a stage; returns stage record. Called at the start of each stage function. */
  stage(def) {
    const s = { index: this.stages.length, reachedAt: null, hero: null, focus: null, ...def };
    this.stages.push(s);
    this.B.stage = s.index;
    return s;
  }

  reach(stage, time) {
    if (stage.reachedAt !== null) return;
    stage.reachedAt = time;
    if (stage.index > this.current) this.current = stage.index;
    this.emit('stage', stage, time);
    if (stage.index === this.stages.length - 1 && this.stages.length >= Math.min(this.maxStages, STAGE_FUNCS.length)) {
      this.finished = true; this.finishedAt = time; this.emit('finale', time);
    }
  }

  /** Entry sensor at local point; reaching it marks the stage. */
  entrySensor(stage, pos, r = 0.35, filter = null) {
    const f = filter ? (p) => (p && p.name === 'TEST') || filter(p) : null;
    return this.B.sensor({ type: 'ball', r }, pos, { name: 'enter:' + stage.name, filter: f, onEnter: (p, t) => this.reach(stage, t) });
  }

  /** Named sub-event sensor (for camera/VFX cues). */
  cue(name, shape, pos, { filter = null, once = true } = {}) {
    return this.B.sensor(shape, pos, { name, filter, once, onEnter: (p, t) => this.emit('event', name, p, t) });
  }

  after(delay, fn) { this.actions.push({ at: this.pw.time + delay, fn }); }
  onStart(fn) { this.startFns.push(fn); }

  start() {
    if (this.started) return;
    this.started = true;
    this.startTime = this.pw.time;
    for (const f of this.startFns) f();
  }

  update(time) {
    if (!this.actions.length) return;
    const due = this.actions.filter(a => a.at <= time);
    if (due.length) {
      this.actions = this.actions.filter(a => a.at > time);
      for (const a of due) a.fn();
    }
  }

  bounds() {
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const p of this.pw.parts) {
      if (p.name === 'floor') continue; // the hall slab is not part of the machine's extent
      const t = p.curr;
      let r = 0.5;
      for (const s of p.shapes) {
        if (s.type === 'trimesh') { const b = geomBounds(s.geom); r = Math.max(r, V.len(V.sub(b.max, b.min)) / 2); }
        else if (s.type === 'box') r = Math.max(r, Math.hypot(s.hx, s.hy, s.hz));
        else if (s.r) r = Math.max(r, s.r + (s.hh || 0));
      }
      min.x = Math.min(min.x, t.x - r); min.y = Math.min(min.y, t.y - r); min.z = Math.min(min.z, t.z - r);
      max.x = Math.max(max.x, t.x + r); max.y = Math.max(max.y, t.y + r); max.z = Math.max(max.z, t.z + r);
    }
    return { min, max };
  }
}

/**
 * Build the whole machine. Each stage is built in a local frame whose origin is the point where the ball
 * arrives (trough floor) travelling along local +X; the stage returns where it hands the ball off.
 */
export function buildMachine(pw, { maxStages = 999, origin = { x: -28, y: 29, z: -14 } } = {}) {
  const M = new Machine(pw, { maxStages });
  const B = M.B;
  // Hall floor (world y = 0)
  B.setFrame({ pos: { x: 0, y: 0, z: 0 }, rot: Q.identity() });
  B.fixedBox(90, 0.5, 90, { x: 0, y: -0.5, z: 0 }, { material: 'concrete', color: 0x7a7d82, name: 'floor', visual: { hidden: true } });
  B.frames.length = 1;
  B.setFrame({ pos: origin, rot: Q.identity() });
  let exit = { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
  const n = Math.min(maxStages, STAGE_FUNCS.length);
  for (let i = 0; i < n; i++) {
    const abs = B.frameAt(exit.pos, exit.yaw);
    B.frames.length = 1; B.setFrame(abs);
    const res = STAGE_FUNCS[i](M);
    exit = res.exit;
    M.stages[M.stages.length - 1].frame = abs;
  }
  B.frames.length = 1;
  return M;
}
