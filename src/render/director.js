// Cinematic camera: follows the active stage's hero and the most recent impacts with damped motion; orbit mode for free look.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Q } from '../math.js';

const PRESETS = {
  release:   { dist: 7.5, elev: 18, azim: 40 },
  dominoes:  { dist: 7.0, elev: 32, azim: 120 },
  catapult:  { dist: 8.5, elev: 12, azim: 100 },
  cradle:    { dist: 4.2, elev: 14, azim: 95 },
  zigzag:    { dist: 7.0, elev: 8, azim: 90 },
  loop:      { dist: 9.0, elev: 10, azim: 92 },
  paddle:    { dist: 6.5, elev: 12, azim: 70 },
  plate:     { dist: 9.0, elev: 14, azim: 60 },
  wrecking:  { dist: 9.5, elev: 16, azim: 110 },
  balance:   { dist: 9.0, elev: 12, azim: 80 },
  plinko:    { dist: 7.0, elev: 6, azim: -95 },  // from the front-glass (+z) side; the back wall is at -z
  conveyor:  { dist: 4.5, elev: 22, azim: 60 },
  lift:      { dist: 9.0, elev: 14, azim: 10 },   // from the open +x side: mast and conveyor behind, spiral above
  spiral:    { dist: 9.5, elev: 20, azim: 50 },
  bowling:   { dist: 7.5, elev: 14, azim: 150 },
  cart:      { dist: 11.0, elev: 18, azim: 75 },
  hammers:   { dist: 8.5, elev: 14, azim: 70 },
  marbles:   { dist: 8.0, elev: 10, azim: 80 },
  vortex:    { dist: 7.5, elev: 40, azim: 60 },
  trophy:    { dist: 5.5, elev: 30, azim: -110 }, // from the door (+z) side, looking down into the case
};

export class Director {
  constructor(camera, dom, machine, pw) {
    this.camera = camera; this.machine = machine; this.pw = pw;
    this.mode = 'auto';
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.enabled = false;
    this.pos = camera.position.clone(); this.target = new THREE.Vector3(); this.lookTarget = new THREE.Vector3();
    this.action = new THREE.Vector3(); this.actionTime = -1e9; this.actionWeight = 0;
    this.lastStage = -1; this.cutTimer = 0;
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
    this.overview = false;
    pw.onContact((ev) => this.noteContact(ev));
    machine.on('stage', () => { this.cutTimer = 1.2; });
    this.initialised = false;
  }

  setMode(m) {
    this.mode = m;
    this.controls.enabled = m === 'orbit';
    if (m === 'orbit') { this.controls.target.copy(this.lookTarget); this.controls.update(); }
  }

  noteContact(ev) {
    if (ev.force < 400) return;
    const stage = this.machine.stages[Math.max(0, this.machine.current)];
    const pa = ev.partA, pb = ev.partB;
    if (stage && pa && pb && pa.stage !== stage.index && pb.stage !== stage.index) return; // ignore far-away noise
    const w = Math.min(1, ev.force / 6000);
    if (this.pw.time - this.actionTime > 0.4) { this.action.set(ev.point.x, ev.point.y, ev.point.z); this.actionWeight = w; }
    else { this.action.lerp(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z), 0.35); this.actionWeight = Math.max(this.actionWeight * 0.8, w); }
    this.actionTime = this.pw.time;
  }

  stageWorldFocus(stage) {
    const f = stage.focus || { x: 0, y: 0, z: 0 };
    const p = Q.rotate(stage.frame.rot, f);
    return this.tmp2.set(stage.frame.pos.x + p.x, stage.frame.pos.y + p.y, stage.frame.pos.z + p.z);
  }

  /** Desired look target for the current stage. */
  computeTarget(out) {
    const M = this.machine;
    const idx = Math.max(0, M.current);
    const stage = M.stages[idx];
    const focus = this.stageWorldFocus(stage);
    let heroPos = null;
    if (stage.hero && stage.hero.obj) {
      heroPos = stage.hero.obj.position;
      const v = stage.hero.body ? stage.hero.body.linvel() : { x: 0, y: 0, z: 0 };
      const speed = Math.hypot(v.x, v.y, v.z);
      const heroW = Math.min(1, speed / 1.5);
      out.copy(focus).lerp(heroPos, 0.35 + 0.5 * heroW);
    } else out.copy(focus);
    const age = this.pw.time - this.actionTime;
    if (age < 1.5 && this.actionWeight > 0.05) {
      const w = (1 - age / 1.5) * 0.55 * this.actionWeight;
      // only pull toward action points within 12 m of the stage focus (avoid distant noise)
      if (this.action.distanceTo(focus) < 12) out.lerp(this.action, w);
    }
    return out;
  }

  update(dt, shake) {
    const M = this.machine;
    const idx = Math.max(0, M.current);
    const stage = M.stages[idx];
    const preset = PRESETS[stage.name] || { dist: 8, elev: 18, azim: 70 };
    const desiredTarget = this.computeTarget(this.tmp);
    if (!this.initialised) { this.lookTarget.copy(desiredTarget); this.initialised = true; }
    const kT = this.cutTimer > 0 ? 6 : 2.6;
    this.lookTarget.lerp(desiredTarget, 1 - Math.exp(-dt * kT));
    if (this.mode === 'orbit') {
      this.controls.target.lerp(this.lookTarget, 1 - Math.exp(-dt * 2));
      this.controls.update();
      return;
    }
    // camera offset in the stage frame: azimuth measured from the stage +X heading, elevation above
    const yaw = 2 * Math.atan2(stage.frame.rot.y, stage.frame.rot.w);
    const az = yaw + THREE.MathUtils.degToRad(preset.azim), el = THREE.MathUtils.degToRad(preset.elev);
    const dist = this.overview ? 42 : preset.dist;
    const elev = this.overview ? THREE.MathUtils.degToRad(35) : el;
    const off = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), -Math.sin(az) * Math.cos(elev)).multiplyScalar(dist);
    const desiredPos = this.tmp2.copy(this.lookTarget).add(off);
    desiredPos.y = Math.max(desiredPos.y, 0.6);
    const kP = this.cutTimer > 0 ? 3.5 : 1.8;
    this.pos.lerp(desiredPos, 1 - Math.exp(-dt * kP));
    this.cutTimer = Math.max(0, this.cutTimer - dt);
    this.camera.position.copy(this.pos);
    if (shake) this.camera.position.add(shake);
    this.camera.lookAt(this.lookTarget);
    const targetFov = this.overview ? 50 : 42;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 2));
    this.camera.updateProjectionMatrix();
  }
}
