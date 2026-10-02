import { initPhysics } from './physics/world.js';
import { App } from './render/app.js';
import * as THREE from 'three';

async function boot() {
  await initPhysics();
  const app = new App(document.getElementById('gl'), document.getElementById('hud'));
  window.__app = app; window.__THREE = THREE;
  document.getElementById('loading').classList.add('hide');
  app.run();
}
boot().catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.innerHTML = `<pre style="color:#f66;max-width:80vw;white-space:pre-wrap">${e.stack || e}</pre>`; });
