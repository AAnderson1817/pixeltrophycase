/**
 * Chip-tune audio: every sound is synthesised with Web Audio (25% pulse, square, triangle, noise) through a short
 * dungeon echo. The context starts on the first user gesture.
 */
import { reduce, rnd } from '../core/util.js';

export const A = {
  ctx: null,
  on: true,
  charging: false,
  ch: null,
  lastClink: 0,
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const c = (this.ctx = new C());
      this.out = c.createGain();
      this.out.gain.value = this.on ? 0.5 : 0;
      this.lp = c.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 20000;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 5;
      this.out.connect(this.lp);
      this.lp.connect(comp);
      comp.connect(c.destination);
      this.master = c.createGain();
      this.master.connect(this.out);
      const dl = c.createDelay(1);
      dl.delayTime.value = 0.14;
      const fb = c.createGain();
      fb.gain.value = 0.33;
      const dlp = c.createBiquadFilter();
      dlp.type = 'lowpass';
      dlp.frequency.value = 2600;
      const wet = c.createGain();
      wet.gain.value = 0.3;
      this.master.connect(dl);
      dl.connect(dlp);
      dlp.connect(fb);
      fb.connect(dl);
      dlp.connect(wet);
      wet.connect(this.out);
      const len = c.sampleRate,
        buf = c.createBuffer(1, len, c.sampleRate),
        d = buf.getChannelData(0);
      let v = 0;
      for (let i = 0; i < len; i++) {
        if (i % 5 === 0) v = Math.random() * 2 - 1;
        d[i] = v;
      }
      this.noise = buf;
      const n2 = c.createBuffer(1, len, c.sampleRate),
        d2 = n2.getChannelData(0);
      for (let i = 0; i < len; i++) {
        if (i % 36 === 0) v = Math.random() * 2 - 1;
        d2[i] = v;
      }
      this.noiseLo = n2;
      const real = new Float32Array(32),
        imag = new Float32Array(32);
      for (let n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
      this.pulse25 = c.createPeriodicWave(real, imag);
      this.ambStart();
    } catch (e) {
      this.ctx = null;
    }
  },
  setOn(v) {
    this.on = v;
    if (this.out) this.out.gain.setTargetAtTime(v ? 0.5 : 0, this.ctx.currentTime, 0.02);
  },
  now() {
    return this.ctx.currentTime;
  },
  midi(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  },
  osc(t, type, f, dur, gain, fTo) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    if (type === 'p25') o.setPeriodicWave(this.pulse25);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fTo) o.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  nz(t, dur, gain, lo, f0, f1) {
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = lo ? this.noiseLo : this.noise;
    s.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0 || 12000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  },
  seq(t, notes, step, type, gain, len) {
    notes.forEach((m, i) => {
      if (m != null) this.osc(t + i * step, type, this.midi(m), (len || step) * 0.95, gain);
    });
  },
  chargeStart() {
    if (!this.ctx || this.charging) return;
    const c = this.ctx,
      o = c.createOscillator(),
      o2 = c.createOscillator(),
      g = c.createGain(),
      g2 = c.createGain();
    o.setPeriodicWave(this.pulse25);
    o2.type = 'triangle';
    g.gain.value = 0;
    g2.gain.value = 0;
    o.connect(g);
    o2.connect(g2);
    g.connect(this.master);
    g2.connect(this.master);
    o.start();
    o2.start();
    const ns = c.createBufferSource();
    ns.buffer = this.noise;
    ns.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.Q.value = 3;
    const ng = c.createGain();
    ng.gain.value = 0;
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(this.master);
    ns.start();
    this.ch = {
      o,
      o2,
      g,
      g2,
      ns,
      nf,
      ng,
    };
    this.charging = true;
  },
  chargeUpdate(v, t) {
    if (!this.charging) return;
    const ch = this.ch,
      n = this.now();
    const arp = [0, 4, 7, 12, 7, 4][Math.floor(t * (9 + 26 * v)) % 6],
      base = 45 + Math.floor(v * 28);
    ch.o.frequency.setValueAtTime(this.midi(base + arp), n);
    ch.o2.frequency.setValueAtTime(this.midi(base - 12), n);
    ch.g.gain.setTargetAtTime(v > 0.002 ? 0.045 + 0.09 * v : 0, n, 0.02);
    ch.g2.gain.setTargetAtTime(v > 0.002 ? 0.12 + 0.1 * v : 0, n, 0.02);
    ch.nf.frequency.setTargetAtTime(400 + 7000 * v * v, n, 0.04);
    ch.ng.gain.setTargetAtTime(0.18 * v * v * v, n, 0.04);
  },
  chargeStop() {
    if (!this.charging) return;
    const n = this.now(),
      ch = this.ch;
    [ch.g, ch.g2, ch.ng].forEach((x) => {
      x.gain.cancelScheduledValues(n);
      x.gain.setValueAtTime(0, n);
    });
    ch.o.stop(n + 0.05);
    ch.o2.stop(n + 0.05);
    ch.ns.stop(n + 0.05);
    this.charging = false;
    this.ch = null;
  },
  heart(v) {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'triangle', 150, 0.1, 0.55 + 0.3 * v, 40);
    this.osc(t + 0.1, 'triangle', 115, 0.12, 0.45 + 0.3 * v, 35);
  },
  crack(i) {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.1, 0.4);
    this.osc(t, 'square', this.midi(84 + i * 3), 0.05, 0.07);
    this.osc(t, 'triangle', 90, 0.1, 0.4, 45);
  },
  zap() {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.05, 0.12, false, 9000, 3000);
    this.osc(t, 'square', rnd(200, 900), 0.03, 0.03);
  },
  tease(l) {
    if (!this.ctx) return;
    const t = this.now(),
      b = [0, 72, 76, 79][l];
    this.seq(t, [b, b + 4, b + 7, b + 12, b + 16, b + 19], 0.035, 'square', 0.08);
    this.nz(t, 0.3, 0.15, false, 9000, 2000);
  },
  boom(r) {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 1.4, 0.8, true, 7000, 120);
    this.nz(t, 0.3, 0.5, false);
    this.osc(t, 'triangle', 200, 0.8, 0.9, 28);
    this.osc(t, 'square', 100, 0.35, 0.12, 30);
    for (let i = 0; i < 8 + r * 4; i++) this.nz(t + Math.random() * 0.35, 0.05, 0.15, false, rnd(4000, 11000), 2000);
    const J = [
      [72, 76, 79, 84],
      [67, 72, 76, 79, 84, 88],
      [69, 73, 76, 81, null, 83, 85, 88, null, 93],
      [76, 79, 84, null, 86, 88, null, 91, null, null, 88, 91, 96, null, 100],
    ];
    const s = r === 3 ? 0.08 : 0.065,
      d = r === 3 ? 0.3 : 0.14;
    this.seq(t + d, J[r], s, 'p25', 0.11, s * 1.3);
    this.seq(
      t + d,
      J[r].map((m) => (m == null ? null : m - 12)),
      s,
      'square',
      0.05,
      s * 1.3,
    );
    if (r >= 1) {
      const bass =
        r === 3
          ? [48, null, 55, null, 60, null, 55, null, 48, null, 43, null, 48]
          : r === 2
            ? [45, null, 52, null, 57, null, 52]
            : [48, null, 55];
      this.seq(t + d, bass, s, 'triangle', 0.24, s * 2);
    }
    if (r === 3)
      for (let i = 0; i < 20; i++)
        this.osc(t + 1.4 + i * 0.04, 'square', this.midi(96 + [0, 4, 7, 12][i % 4]), 0.035, 0.035);
  },
  roar() {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.7, 0.35, true, 600, 3000);
  },
  after() {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.6, 0.45, true, 4000, 150);
    this.osc(t, 'triangle', 130, 0.4, 0.7, 32);
  },
  letter(i, n) {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'square', this.midi(72 + i * 2), 0.04, 0.06);
    this.osc(t, 'triangle', 110, 0.06, 0.35, 55);
    if (i === n - 1) {
      this.nz(t, 0.25, 0.35, true, 3000, 250);
      this.osc(t, 'triangle', 90, 0.3, 0.7, 32);
    }
  },
  pip(i) {
    if (!this.ctx) return;
    this.seq(this.now(), [84 + i * 5, 91 + i * 5], 0.04, 'square', 0.06);
  },
  bar(p, i) {
    if (!this.ctx) return;
    this.osc(this.now(), 'p25', this.midi(70 + i * 5 + Math.floor(p * 14)), 0.025, 0.05);
  },
  barEnd(i) {
    if (!this.ctx) return;
    this.seq(this.now(), [86 + i * 3, 93 + i * 3], 0.04, 'square', 0.06);
  },
  clink() {
    if (!this.ctx) return;
    const n = this.now();
    if (n - this.lastClink < 0.035) return;
    this.lastClink = n;
    const f = rnd(2200, 3400);
    this.osc(n, 'square', f, 0.03, 0.03);
    this.osc(n + 0.025, 'square', f * 1.33, 0.05, 0.025);
  },
  glitch() {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 14; i++) this.osc(t + i * 0.028, 'square', rnd(80, 2200), 0.028, 0.07);
    this.nz(t, 0.4, 0.4, false, 9000, 300);
    this.osc(t, 'square', 990, 0.45, 0.08, 50);
  },
  stamp(isNew) {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'triangle', 160, 0.2, 0.8, 48);
    this.nz(t, 0.12, 0.35);
    if (isNew) this.seq(t + 0.05, [88, 93, 96, 100], 0.045, 'square', 0.08);
    else this.seq(t + 0.05, [76, 79], 0.06, 'square', 0.07);
  },
  collect() {
    if (!this.ctx) return;
    const t = this.now();
    this.seq(t, [79, 84, 88, 91], 0.04, 'p25', 0.09);
    this.osc(t, 'triangle', 100, 0.14, 0.45, 50);
  },
  whoosh() {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.35, 0.28, false, 900, 7000);
  },
  land() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'triangle', 140, 0.16, 0.7, 42);
    this.nz(t, 0.12, 0.3, true, 2200, 250);
  },
  press() {
    if (!this.ctx) return;
    this.osc(this.now(), 'square', this.midi(60), 0.04, 0.06);
  },
  blip() {
    if (!this.ctx) return;
    this.osc(this.now(), 'square', this.midi(90), 0.03, 0.05);
  },
  fidget() {
    if (!this.ctx) return;
    this.seq(this.now(), [79, 83, 86, 91, 95], 0.035, 'square', 0.07);
    this.nz(this.now(), 0.25, 0.15, false, 1200, 6000);
  },
  fanfare() {
    if (!this.ctx) return;
    const t = this.now();
    const mel = [72, 72, 76, 79, null, 76, 79, 84, null, null, 84, 86, 88, null, 91, null, 96];
    this.seq(t, mel, 0.1, 'p25', 0.12, 0.12);
    this.seq(
      t,
      mel.map((m) => (m == null ? null : m - 5)),
      0.1,
      'square',
      0.05,
      0.12,
    );
    this.seq(
      t,
      [48, null, 55, null, 60, null, 55, null, 53, null, 60, null, 65, null, 67, null, 72],
      0.1,
      'triangle',
      0.26,
      0.18,
    );
    this.nz(t, 0.7, 0.45, true, 5000, 250);
  },
  ambStart() {
    if (this.amb || !this.ctx) return;
    const c = this.ctx,
      g = c.createGain(),
      f = c.createBiquadFilter();
    g.gain.value = 0.045;
    f.type = 'lowpass';
    f.frequency.value = 240;
    [55, 55.7, 82.4].forEach((fr) => {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fr;
      o.connect(f);
      o.start();
    });
    const lfo = c.createOscillator(),
      lg = c.createGain();
    lfo.frequency.value = 0.11;
    lg.gain.value = 0.02;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
    f.connect(g);
    g.connect(this.out);
    this.amb = g;
  },
  crackle(pan) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = this.now(),
      s2 = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s2.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = rnd(1800, 5200);
    g.gain.setValueAtTime(rnd(0.015, 0.05), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + rnd(0.01, 0.04));
    s2.connect(f);
    f.connect(g);
    if (c.createStereoPanner) {
      const pn = c.createStereoPanner();
      pn.pan.value = pan;
      g.connect(pn);
      pn.connect(this.out);
    } else g.connect(this.out);
    s2.start(t, Math.random() * 0.8);
    s2.stop(t + 0.06);
  },
  snap() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'square', 2300, 0.07, 0.08, 700);
    this.nz(t, 0.1, 0.35, false, 12000, 3000);
    this.osc(t, 'triangle', 170, 0.14, 0.45, 55);
    this.osc(t + 0.02, 'square', 3100, 0.04, 0.04);
  },
  clunk() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc(t, 'triangle', 120, 0.16, 0.6, 48);
    this.nz(t, 0.1, 0.3, true, 2400, 300);
    this.osc(t, 'square', 900, 0.03, 0.03);
  },
  rumble(r) {
    if (!this.ctx) return;
    const t = this.now(),
      d = 1.6 + r * 0.5;
    this.nz(t, d, 0.55, true, 420, 90);
    this.osc(t, 'triangle', 48, d, 0.35, 32);
    this.nz(t + 0.1, 0.5, 0.25, true, 1600, 200);
  },
  thud() {
    if (!this.ctx) return;
    const n = this.now();
    if (n - (this.lastThud || 0) < 0.045) return;
    this.lastThud = n;
    this.osc(n, 'triangle', rnd(80, 120), 0.12, 0.4, 40);
    this.nz(n, 0.08, 0.22, true, rnd(900, 1800), 200);
  },
  rebuild() {
    if (!this.ctx) return;
    const t = this.now();
    this.nz(t, 0.7, 0.2, true, 300, 2500);
    this.seq(t + 0.1, [48, 52, 55, 60, 64, 67], 0.07, 'triangle', 0.18, 0.09);
  },
  summon() {
    if (!this.ctx) return;
    const t = this.now();
    this.seq(t, [60, 67, 72, 76, 79, 84, 88, 91], 0.05, 'p25', 0.055, 0.07);
    this.nz(t, 0.7, 0.14, false, 500, 7000);
    this.osc(t, 'triangle', 55, 0.8, 0.25, 110);
  },
  muffle(d) {
    if (!this.ctx) return;
    const t = this.now(),
      f = this.lp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(650, t + 0.04);
    f.setValueAtTime(650, t + d * 0.7);
    f.exponentialRampToValueAtTime(20000, t + d + 0.25);
  },
};
export const buzz = (p) => {
  try {
    if (!reduce && A.ctx && navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
};
