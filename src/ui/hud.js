/** HTML controls: sound, speed, next, pause; keyboard shortcuts; the HUD hides when the pointer rests. */
import { S, skip } from '../anim/director.js';
import { setSound, A, suspendAudio } from '../audio/chip.js';

const SPEEDS = [1, 2, 4];
export function initHud() {
  const hud = document.getElementById('hud');
  const bSound = document.getElementById('btn-sound');
  const bSpeed = document.getElementById('btn-speed');
  const bSkip = document.getElementById('btn-skip');
  const bPause = document.getElementById('btn-pause');
  const live = document.getElementById('phase');
  const sync = () => {
    bSound.textContent = A.on ? 'Sound on' : 'Sound off';
    bSound.setAttribute('aria-pressed', String(A.on));
    bSpeed.textContent = `${S.speed}×`;
    bPause.textContent = S.paused ? 'Resume' : 'Pause';
    bPause.setAttribute('aria-pressed', String(S.paused));
  };
  const toggleSound = () => { setSound(!A.on); sync(); };
  const cycleSpeed = () => { S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; sync(); };
  const togglePause = () => { S.paused = !S.paused; sync(); };
  bSound.addEventListener('click', toggleSound);
  bSpeed.addEventListener('click', cycleSpeed);
  bSkip.addEventListener('click', () => skip());
  bPause.addEventListener('click', togglePause);
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 's' || e.key === 'S') toggleSound();
    else if (e.key === 'n' || e.key === 'N') skip();
    else if (e.key === '1' || e.key === '2' || e.key === '3') { S.speed = SPEEDS[Number(e.key) - 1]; sync(); }
  });
  let idle = 0;
  const wake = () => { hud.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => hud.classList.add('idle'), 3500); };
  window.addEventListener('pointermove', wake); window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
  wake();
  document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));
  S.onPhase = (p) => {
    const tr = S.trophies[S.idx];
    live.textContent = p === 'present' ? `Presenting ${tr.name}: ${tr.sub}` : p === 'finale' ? 'All nine treasures are seated.' : p === 'reset' ? 'The collection dissolves.' : '';
  };
  sync();
}
