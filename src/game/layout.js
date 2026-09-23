/**
 * Chooses the integer pixel scale and logical canvas size for the window, then places the card, altar, torches, bag
 * and HTML overlays. Runs at boot and on resize; a resize drops the wall-break debris cut from the old scene.
 */
import { $, clamp } from '../core/util.js';
import { FX, seedDust } from '../fx/particles.js';
import { bagGeom } from './bag.js';
import { CHd, CWd, cv, g, stage } from '../gfx/canvas.js';
import { setupBloom } from '../render/bloom.js';
import { setupLayers } from '../render/render.js';
import { buildScene } from '../scene/scene.js';
import { resetWallSnap } from '../scene/wall.js';

export let NARROW = false,
  BAGY = 4,
  SC = 3,
  W = 400,
  H = 260,
  TS = 4,
  CX = 200,
  CY = 110,
  HY = 180,
  PTOP = 160,
  PBASE = 186,
  GMIN = 190,
  GMAX = 250,
  TOP = 0,
  HUDTOP = 250,
  SLOT = 18,
  TORCH = [],
  MAT = null,
  BASE = null;
// bag grid placement, set by layout() and read by game/bag.js (group arrangement is documented there)
export let BAGX = 4,
  BG = {
    gpr: 3,
    rows: 2,
    gg: 6,
    w: 276,
    h: 37,
  };
export const hit = $('hit'),
  again = $('again'),
  live = $('live');
export function layout() {
  const iw = innerWidth,
    ih = innerHeight;
  SC = Math.max(2, Math.floor(Math.min(iw / 128, ih / 228)));
  // at least 1x1: a hidden or collapsed host frame reports 0, and a 0-sized canvas or ImageData throws
  W = Math.max(1, Math.ceil(iw / SC));
  H = Math.max(1, Math.ceil(ih / SC));
  for (const c of [cv]) {
    c.width = W;
    c.height = H;
    c.style.width = W * SC + 'px';
    c.style.height = H * SC + 'px';
  }
  setupBloom();
  g.imageSmoothingEnabled = false;
  setupLayers();
  TS = W >= 300 ? 4 : 3;
  NARROW = W < 300;
  TOP = Math.ceil((parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0) / SC);
  HUDTOP = Math.floor($('hud').getBoundingClientRect().top / SC);
  if (NARROW) {
    SLOT = clamp(Math.floor((W - 10) / 10) - 2, 7, 16);
    BG = bagGeom(SLOT);
  } else {
    // largest slot (16..10) that fits the width and still leaves the card its room
    const wmax = Math.floor(((W - 8 - 26 - 12) / 3 + 2) / 5) - 2;
    SLOT = 10;
    for (const s of [16, 14, 12]) {
      if (s > wmax) continue;
      if (TOP + 4 + bagGeom(s).h + 8 + 5 * TS + 10 + 45 + 96 <= HUDTOP - 4) {
        SLOT = s;
        break;
      }
    }
    BG = bagGeom(SLOT);
  }
  const titleTop = NARROW ? TOP + 8 : TOP + 4 + BG.h + 8,
    CY0 = titleTop + 5 * TS + 10 + 45,
    need = CY0 + 45 + 7 + 26 + 18 + (NARROW ? BG.h + 10 : 0),
    extra = Math.max(0, HUDTOP - 4 - need);
  CX = Math.round(W / 2);
  CY = Math.round(CY0 + extra * 0.42);
  PTOP = CY + 45 + 8;
  PBASE = PTOP + 26;
  HY = PTOP + 13;
  GMIN = HY + 4;
  BAGY = NARROW ? HUDTOP - BG.h - 6 : TOP + 4;
  BAGX = NARROW ? Math.round((W - BG.w) / 2) : 4;
  GMAX = Math.max(GMIN + 6, NARROW ? BAGY - 3 : HUDTOP - 4);
  const tdx = Math.round(clamp(W * 0.36, 46, 150));
  TORCH = [
    {
      x: CX - tdx,
      y: CY - 6,
    },
    {
      x: CX + tdx,
      y: CY - 6,
    },
  ];
  buildScene();
  // the rebuilt scene ends any wall break; debris, dust and card shards were cut from the old scene or land on the
  // old floor, so they go with it
  resetWallSnap();
  FX.bricks.length = 0;
  FX.tiles.length = 0;
  FX.dustp.length = 0;
  seedDust();
  hit.style.left = (CX - CWd / 2) * SC + 'px';
  hit.style.top = (CY - CHd / 2) * SC + 'px';
  hit.style.width = CWd * SC + 'px';
  hit.style.height = CHd * SC + 'px';
  again.style.left = CX * SC + 'px';
  again.style.top = Math.min((PBASE + 8) * SC, (NARROW ? BAGY - 4 : HUDTOP - 14) * SC - 44) + 'px';
  $('crt').style.backgroundImage =
    `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 ${SC - 1}px, rgba(0,0,0,.16) ${SC - 1}px ${SC}px), radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, rgba(0,0,0,.5) 100%)`;
  stage.style.transformOrigin = `${CX * SC}px ${CY * SC}px`;
}
