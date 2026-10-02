// Renderer application: scene, lighting, post-processing, VFX hooks, main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../physics/world.js';
import { buildMachine } from '../machine/machine.js';
import { SceneSync } from './sync.js';
import { buildHall } from './decor.js';
import { ParticleSystem, TrailSystem, ImpactRings, CameraShake } from './vfx.js';
import { Director } from './director.js';
import { HUD } from '../ui/hud.js';
import { emissiveMaterial } from './materials.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.025 }, uAberration: { value: 0.0005 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uAberration; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec2 d = (vUv - 0.5);
      float r2 = dot(d, d);
      vec2 ca = d * uAberration * r2 * 40.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + ca).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - ca).b;
      float vig = 1.0 - uVignette * smoothstep(0.25, 0.95, r2 * 2.2);
      col *= vig;
      col += (hash(vUv * 1000.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class App {
  constructor(canvas, hudRoot) {
    this.canvas = canvas; this.hudRoot = hudRoot;
    this.quality = 'high';
    this.slomoEnabled = true;
    this.speed = 1;
    this.paused = false;
    this.lastFrameAt = performance.now();
    this.fps = 60;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c12);
    this.scene.fog = new THREE.FogExp2(0x0a0c12, 0.0075);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.camera.position.set(-20, 30, -6);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28; // RoomEnvironment has a very bright ceiling panel; metals viewed from above otherwise clip
    pmrem.dispose();
    this.setupLights();
    this.setupPost();
    this.buildWorld();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  setupLights() {
    const key = new THREE.DirectionalLight(0xfff1dc, 2.0);
    key.position.set(12, 30, 10); key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.06; key.shadow.radius = 3;
    const sc = key.shadow.camera; sc.near = 1; sc.far = 90; sc.left = sc.bottom = -16; sc.right = sc.top = 16;
    this.scene.add(key); this.scene.add(key.target); this.key = key;
    this.scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x2b241c, 0.95));
    // finale spots (off until the trophy)
    this.spots = [];
    for (let i = 0; i < 3; i++) { const s = new THREE.SpotLight([0xff4d6d, 0x4dc3ff, 0xffd84d][i], 0, 40, 0.32, 0.5, 1.2); s.castShadow = false; this.scene.add(s); this.scene.add(s.target); this.spots.push(s); }
  }

  setupPost() {
    const r = this.renderer;
    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.output = GTAOPass.OUTPUT.Default; this.gtao.blendIntensity = 0.9;
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.0, scale: 1.2, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
    this.gtao.enabled = false;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.42, 0.95);
    this.composer.addPass(this.bloom);
    this.smaa = new SMAAPass(1, 1); this.composer.addPass(this.smaa);
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.applyQuality();
  }

  applyQuality() {
    const q = this.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 1.5);
    this.renderer.setPixelRatio(pr);
    this.gtao.enabled = q === 'ultra';
    this.bloom.enabled = q !== 'low';
    this.smaa.enabled = q !== 'low';
    this.renderer.shadowMap.enabled = true;
    this.key.shadow.mapSize.set(q === 'low' ? 2048 : 4096, q === 'low' ? 2048 : 4096);
    if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    if (this.particles) this.particles.setPixelRatio(pr);
    this.resize();
  }

  buildWorld() {
    this.pw = new PhysicsWorld();
    this.machine = buildMachine(this.pw);
    this.sync = new SceneSync(this.scene, this.pw);
    if (!this.hall) this.hall = buildHall(this.scene, this.machine.bounds());
    this.particles = this.particles || new ParticleSystem(this.scene);
    this.trails = new TrailSystem(this.scene);
    for (const p of this.pw.parts) if (p.tags && p.tags.has('hero') && p.shapes[0]?.type === 'ball') this.trails.track(p);
    this.rings = this.rings || new ImpactRings(this.scene);
    this.shake = new CameraShake();
    this.director = new Director(this.camera, this.canvas, this.machine, this.pw);
    this.hud = new HUD(this.hudRoot, this.machine, {
      start: () => this.start(), pause: () => this.togglePause(), reset: () => this.reset(),
      speed: (v) => this.setSpeed(v), camera: (m) => this.setCamera(m), quality: (q) => { this.quality = q; this.applyQuality(); }, slomo: (on) => { this.slomoEnabled = on; },
    });
    this.hud.setCamera(this.cameraMode || 'auto');
    this.pw.onContact((ev) => this.onImpact(ev));
    this.machine.on('event', (name, part, t) => this.onCue(name, part, t));
    this.machine.on('finale', (t) => this.onFinale(t));
    this.slomoUntil = -1; this.finaleAt = -1; this.lastContact = new Map();
    this.pw.timeScale = this.speed;
    if (this.cameraMode) this.director.setMode(this.cameraMode === 'overview' ? 'auto' : this.cameraMode);
    this.director.overview = this.cameraMode === 'overview';
  }

  start() { this.machine.start(); this.hud.setStarted(true); }
  togglePause() { this.paused = !this.paused; this.pw.paused = this.paused; this.hud.setPaused(this.paused); }
  setSpeed(v) { this.speed = v; this.hud.setSpeed(v); }
  setCamera(m) { this.cameraMode = m; this.director.overview = m === 'overview'; this.director.setMode(m === 'overview' ? 'auto' : m); this.hud.setCamera(m); }
  reset() {
    this.sync.dispose();
    for (const tr of this.trails.trails.values()) this.scene.remove(tr.mesh);
    this.hudRoot.innerHTML = '';
    this.paused = false;
    for (const s of this.spots) s.intensity = 0;
    this.buildWorld();
    this.hud.showFinale(false);
  }

  onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); if (!this.machine.started) this.start(); else this.togglePause(); }
    else if (e.key === 'r' || e.key === 'R') this.reset();
    else if (e.key === 'c' || e.key === 'C') this.setCamera(this.cameraMode === 'orbit' ? 'auto' : 'orbit');
    else if (e.key === 'o' || e.key === 'O') this.setCamera(this.cameraMode === 'overview' ? 'auto' : 'overview');
    else if (e.key >= '1' && e.key <= '4') this.setSpeed([0.25, 0.5, 1, 2][e.key - 1]);
  }

  materialClass(part) {
    const m = part?.shapes?.[0]?.material || part?.material || 'steel';
    if (['steel', 'chrome', 'aluminum', 'gold', 'brass', 'copper', 'cradle', 'track', 'paintRed', 'paintBlue', 'paintYellow', 'skid'].includes(m)) return 'metal';
    if (['wood', 'darkwood', 'plastic', 'concrete', 'marble'].includes(m)) return 'hard';
    return 'soft';
  }

  onImpact(ev) {
    const now = this.pw.time;
    const a = ev.partA, b = ev.partB;
    const keyId = a?.id < b?.id ? `${a?.id}-${b?.id}` : `${b?.id}-${a?.id}`;
    // A contact-force event fires every step while two bodies touch. Only a pair that was NOT touching
    // during the previous steps is an impact; a ball rolling in a trough or a block resting on a slab is not.
    const last = this.lastContact.get(keyId);
    this.lastContact.set(keyId, now);
    if (last !== undefined && now - last < 0.12) return;
    const ca = this.materialClass(a), cb = this.materialClass(b);
    const strength = Math.min(2.5, ev.force / 6000);
    if (strength < 0.08) return;
    const n = ev.normal;
    if (ca === 'metal' && cb === 'metal') { this.particles.sparks(ev.point, n, 0.6 + strength, Math.round(8 + 18 * strength)); if (strength > 0.4) this.rings.spawn(ev.point, n, 0.15 + 0.3 * strength); }
    else if (ca === 'hard' || cb === 'hard') { this.particles.dust(ev.point, 0.5 + strength, Math.round(4 + 8 * strength)); if (strength > 0.5) this.particles.sparks(ev.point, n, 0.4, 6); }
    else { this.particles.dust(ev.point, 0.4 + strength * 0.5, 4, [0.35, 0.3, 0.3]); }
    if (ev.force > 40000) { this.shake.kick(Math.min(1, ev.force / 150000)); this.rings.spawn(ev.point, n, 1.0, 0.6); }
    // forget stale pairs occasionally so the map does not grow without bound
    if (this.lastContact.size > 4000) for (const [k, t] of this.lastContact) if (now - t > 1) this.lastContact.delete(k);
  }

  onCue(name, part, t) {
    const slow = { towerSmash: 1.6, strike: 1.0, loopTop: 0.9, catapultLaunch: 0.9, hookRelease: 0.6, cartSpeed: 0.8 };
    if (this.slomoEnabled && slow[name]) { this.slomoUntil = t + slow[name] * 0.3; this.pw.timeScale = 0.3 * this.speed; this.shake.kick(0.3); }
    if (name === 'towerSmash') this.shake.kick(0.9);
    if (name === 'button' || name === 'plateSwitch') { const p = part.obj?.position; if (p) this.particles.sparks(p, { x: 0, y: 1, z: 0 }, 1.0, 30); }
  }

  onFinale(t) {
    this.finaleAt = t;
    this.hud.showFinale(true);
    const stage = this.machine.stages[this.machine.stages.length - 1];
    const f = stage.frame.pos; this.finalePos = new THREE.Vector3(f.x, f.y, f.z);
    const hero = stage.hero?.obj?.position; if (hero) this.finalePos.copy(hero);
    this.spots.forEach((s, i) => { s.position.set(this.finalePos.x + Math.cos(i * 2.1) * 6, this.finalePos.y + 8, this.finalePos.z + Math.sin(i * 2.1) * 6); s.target.position.copy(this.finalePos); });
    this.finaleBursts = [0.2, 0.9, 1.7, 2.6, 3.4, 4.5, 5.8, 7.2].map((d, i) => ({ at: t + d, kind: i % 3 === 0 ? 'confetti' : 'firework' }));
  }

  updateFinale() {
    if (this.finaleAt < 0) return;
    const t = this.pw.time - this.finaleAt;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.3);
    this.spots.forEach((s, i) => { s.intensity = Math.min(1, t / 1.5) * (34 + 16 * Math.sin(t * 1.7 + i * 2)); s.position.x = this.finalePos.x + Math.cos(t * 0.6 + i * 2.1) * 6; s.position.z = this.finalePos.z + Math.sin(t * 0.6 + i * 2.1) * 6; });
    this.bloom.strength = 0.38 + 0.3 * Math.min(1, t / 2) * pulse;
    for (const b of this.finaleBursts) {
      if (b.done || this.pw.time < b.at) continue; b.done = true;
      const at = { x: this.finalePos.x + (Math.random() - 0.5) * 4, y: this.finalePos.y + 3 + Math.random() * 5, z: this.finalePos.z + (Math.random() - 0.5) * 4 };
      if (b.kind === 'confetti') this.particles.confettiBurst({ x: this.finalePos.x, y: this.finalePos.y + 1.5, z: this.finalePos.z }, 500, 7);
      else this.particles.firework(at, [[1, 0.55, 0.2], [0.3, 0.8, 1], [1, 0.3, 0.6], [0.95, 0.9, 0.4]][Math.floor(Math.random() * 4)]);
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.gtao.setSize(w, h); this.bloom.setSize(w, h); this.smaa.setSize(w, h);
  }

  /** Advance simulation by wall-clock seconds and render one frame. */
  frame(dtWall) {
    const dt = Math.min(dtWall, 0.1);
    if (this.slomoUntil > 0 && this.pw.time >= this.slomoUntil) { this.slomoUntil = -1; this.pw.timeScale = this.speed; }
    if (this.slomoUntil < 0) this.pw.timeScale = this.speed;
    this.pw.update(dt);
    this.machine.update(this.pw.time);
    this.sync.update();
    this.particles.setView(this.camera, this.renderer.domElement.height);
    this.particles.update(this.pw.time);
    this.trails.update(this.camera, dt);
    this.rings.update(dt * this.pw.timeScale);
    this.shake.update(dt);
    this.updateFinale();
    const shakeOff = this.shake.offset(new THREE.Vector3());
    this.director.update(dt, shakeOff);
    // shadow light follows the look target
    const lt = this.director.lookTarget;
    this.key.target.position.copy(lt); this.key.position.set(lt.x + 10, lt.y + 24, lt.z + 8);
    this.grade.uniforms.uTime.value = this.pw.time;
    this.hud.update(this.pw.time, this.fps, this.pw.bodyCount());
    this.composer.render();
  }

  run() {
    const loop = () => {
      requestAnimationFrame(loop);
      const nowMs = performance.now(); const dt = (nowMs - this.lastFrameAt) / 1000; this.lastFrameAt = nowMs;
      this.fps += ((1 / Math.max(dt, 1e-3)) - this.fps) * 0.05;
      this.frame(dt);
    };
    loop();
  }

  /** Deterministic offline stepping used by the headless screenshot script. */
  stepTo(seconds) {
    while (this.pw.time < seconds) { this.pw.step(); this.machine.update(this.pw.time); }
    this.pw.alpha = 0; this.pw.timeScale = this.speed;
    this.particles.setView(this.camera, this.renderer.domElement.height);
    for (let i = 0; i < 90; i++) { this.sync.update(); this.particles.update(this.pw.time); this.trails.update(this.camera, 1 / 60); this.rings.update(1 / 60); this.shake.update(1 / 60); this.updateFinale(); this.director.update(1 / 60, null); }
    const lt = this.director.lookTarget; this.key.target.position.copy(lt); this.key.position.set(lt.x + 10, lt.y + 24, lt.z + 8);
    this.hud.update(this.pw.time, 60, this.pw.bodyCount());
    this.composer.render();
  }
}
