/**
 * Chip-voice synthesiser: pulse, triangle, square and filtered noise through a short hall echo. The context is
 * created on the first user gesture; everything is scheduled on the audio clock, so the sim never waits on it.
 */
let ctx = null, master = null, echo = null, drone = null;
export const A = { on: false, ready: false };

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  echo = ctx.createDelay(1); echo.delayTime.value = 0.23;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  echo.connect(fb).connect(lp).connect(echo);
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  echo.connect(wet).connect(master);
  A.ready = true;
  startDrone();
}
export function setSound(on) {
  if (on) initAudio();
  if (!ctx) return;
  A.on = on;
  if (on && ctx.state === 'suspended') ctx.resume();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.linearRampToValueAtTime(on ? 0.5 : 0, ctx.currentTime + 0.15);
}
export function suspendAudio(hidden) {
  if (!ctx) return;
  if (hidden) ctx.suspend(); else if (A.on) ctx.resume();
}

function out(node, t, dur, send = 0.6) {
  node.connect(master);
  const g = ctx.createGain(); g.gain.value = send;
  node.connect(g).connect(echo);
}
/** One voice: type, frequency (optionally sliding to f2), duration, volume. */
export function tone(f, dur, { type = 'square', vol = 0.18, f2 = f, at = 0, attack = 0.005, send = 0.5, duty } = {}) {
  if (!ctx || !A.on) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  if (type === 'pulse' && ctx.createPeriodicWave) {
    const n = 24, re = new Float32Array(n), im = new Float32Array(n), d = duty || 0.25;
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
    o.setPeriodicWave(ctx.createPeriodicWave(re, im));
  } else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); out(g, t, dur, send);
  o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
export function noise(dur, { vol = 0.12, at = 0, hp = 800, lp = 6000, send = 0.3, sweep } = {}) {
  if (!ctx || !A.on) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.setValueAtTime(lp, t);
  if (sweep) l.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(h).connect(l).connect(g); out(g, t, dur, send);
  s.start(t); s.stop(t + dur + 0.05);
}
function startDrone() {
  drone = ctx.createGain(); drone.gain.value = 0.045;
  for (const [f, type] of [[55, 'triangle'], [55.4, 'triangle'], [110.2, 'sine']]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + f / 900;
    const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(o.frequency);
    o.connect(drone); o.start(); lfo.start();
  }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  drone.connect(lp).connect(master);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
/** Court cues. */
export const SFX = {
  summon() { [0, 4, 7, 12].forEach((s, i) => tone(NOTE(64 + s), 0.5, { type: 'pulse', vol: 0.08, at: i * 0.11, duty: 0.125 })); noise(1.2, { vol: 0.05, hp: 2000, lp: 9000, sweep: 300 }); },
  blip(i) { tone(NOTE(84 + (i % 5)), 0.05, { type: 'square', vol: 0.05, send: 0.1 }); },
  doors(open) { noise(0.5, { vol: 0.08, hp: 300, lp: open ? 1200 : 2400, sweep: open ? 2600 : 500 }); tone(open ? 180 : 140, 0.4, { type: 'triangle', vol: 0.06, f2: open ? 260 : 90 }); },
  land() { tone(NOTE(88), 0.9, { type: 'triangle', vol: 0.2 }); tone(NOTE(95), 1.4, { type: 'sine', vol: 0.12, at: 0.02 }); tone(NOTE(100), 1.8, { type: 'sine', vol: 0.07, at: 0.05 }); noise(0.18, { vol: 0.1, hp: 3000, lp: 9000 }); },
  thud() { tone(60, 0.35, { type: 'triangle', vol: 0.25, f2: 32 }); noise(0.2, { vol: 0.08, hp: 80, lp: 400 }); },
  seal() { tone(NOTE(57), 1.6, { type: 'pulse', vol: 0.09, duty: 0.5 }); tone(NOTE(64), 1.6, { type: 'pulse', vol: 0.07, at: 0.08, duty: 0.5 }); },
  fanfare() {
    const mel = [[0, 0], [0, 0.18], [0, 0.36], [4, 0.54], [7, 0.9], [4, 1.26], [7, 1.44], [12, 1.8], [11, 2.5], [12, 2.9]];
    for (const [s, at] of mel) { tone(NOTE(67 + s), at > 2.4 ? 1.2 : 0.3, { type: 'pulse', vol: 0.14, at, duty: 0.25 }); tone(NOTE(55 + s), at > 2.4 ? 1.2 : 0.3, { type: 'triangle', vol: 0.1, at }); }
    [0, 0.9, 1.8, 2.9].forEach((at) => tone(NOTE(43), 0.5, { type: 'triangle', vol: 0.2, at, f2: NOTE(43) }));
  },
  burst() { noise(0.6, { vol: 0.07, hp: 600, lp: 5000, sweep: 400 }); tone(NOTE(72 + Math.floor(Math.random() * 7)), 0.3, { type: 'sine', vol: 0.05 }); },
  dissolve() { noise(2.4, { vol: 0.07, hp: 1500, lp: 3000, sweep: 12000 }); tone(NOTE(76), 2.2, { type: 'sine', vol: 0.06, f2: NOTE(100) }); },
};
