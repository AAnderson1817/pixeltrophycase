// DOM heads-up display: stage card, timeline, clock, controls.
export class HUD {
  constructor(root, machine, callbacks) {
    this.machine = machine; this.cb = callbacks;
    root.innerHTML = `
      <div class="hud-top">
        <div class="brand"><span class="pix">PIXEL</span> TROPHY CASE <span class="sub">a 20-stage Rube Goldberg machine</span></div>
        <div class="clock" id="clock">00:00.0</div>
      </div>
      <div class="stage-card" id="stageCard"><div class="stage-num" id="stageNum">—</div><div><div class="stage-title" id="stageTitle">Press Start</div><div class="stage-blurb" id="stageBlurb">A 110 kg steel sphere is waiting behind the gate.</div></div></div>
      <div class="timeline" id="timeline"></div>
      <div class="controls">
        <button id="btnStart" class="primary">▶ Start</button>
        <button id="btnPause">⏸ Pause</button>
        <button id="btnReset">↺ Reset</button>
        <span class="sep"></span>
        <label>Speed <select id="speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
        <label>Camera <select id="camMode"><option value="auto" selected>Director</option><option value="orbit">Orbit</option><option value="overview">Overview</option></select></label>
        <label>Quality <select id="quality"><option value="low">Low</option><option value="high" selected>High</option><option value="ultra">Ultra (GTAO)</option></select></label>
        <label><input type="checkbox" id="slomo" checked> Impact slow-mo</label>
        <span class="stats" id="stats"></span>
      </div>
      <div class="finale" id="finale">★ MACHINE COMPLETE ★</div>
      <div class="help">Space start/pause · R reset · C camera · O overview · 1-4 speed</div>`;
    this.el = (id) => root.querySelector('#' + id);
    const tl = this.el('timeline');
    machine.stages.forEach((s, i) => { const d = document.createElement('div'); d.className = 'tl-seg'; d.title = s.title; d.dataset.i = i; tl.appendChild(d); });
    this.el('btnStart').onclick = () => callbacks.start();
    this.el('btnPause').onclick = () => callbacks.pause();
    this.el('btnReset').onclick = () => callbacks.reset();
    this.el('speed').onchange = (e) => callbacks.speed(parseFloat(e.target.value));
    this.el('camMode').onchange = (e) => callbacks.camera(e.target.value);
    this.el('quality').onchange = (e) => callbacks.quality(e.target.value);
    this.el('slomo').onchange = (e) => callbacks.slomo(e.target.checked);
    this.lastStage = -2;
    this.statsTimer = 0;
  }
  setPaused(p) { this.el('btnPause').textContent = p ? '▶ Resume' : '⏸ Pause'; }
  setStarted(s) { this.el('btnStart').disabled = s; this.el('btnStart').textContent = s ? '▶ Running' : '▶ Start'; }
  setCamera(m) { this.el('camMode').value = m; }
  setSpeed(v) { this.el('speed').value = String(v); }
  showFinale(on) { this.el('finale').classList.toggle('on', on); }
  update(time, fps, bodyCount) {
    const m = this.machine;
    const t = Math.max(0, time - (m.startTime ?? time));
    this.el('clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
    if (m.current !== this.lastStage) {
      this.lastStage = m.current;
      if (m.current >= 0) {
        const s = m.stages[m.current];
        this.el('stageNum').textContent = String(m.current + 1).padStart(2, '0');
        this.el('stageTitle').textContent = s.title; this.el('stageBlurb').textContent = s.blurb;
        const card = this.el('stageCard'); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      }
      this.machine.stages.forEach((s, i) => { const seg = this.el('timeline').children[i]; seg.classList.toggle('done', s.reachedAt !== null && i < m.current); seg.classList.toggle('active', i === m.current); });
    }
    this.statsTimer += 1;
    if (this.statsTimer % 15 === 0) this.el('stats').textContent = `${fps.toFixed(0)} fps · ${bodyCount} bodies · 120 Hz`;
  }
}
