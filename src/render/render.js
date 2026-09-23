/**
 * Composes each frame in draw order: lit scene, floor props, debris, torches, card, particles, reflection, UI
 * (title, stamp, hint, bag), letterbox, flash, post-FX, bloom. Also draws the impact frame during hitstop.
 */
import { drawCard3D } from '../card/card3d.js';
import { LOCKC, LOCKM, dissolve, linkSpr } from '../card/chains.js';
import { CYCLE, drawBack, drawFront } from '../card/faces.js';
import { DARKEN, PAL, RAMPS, U32 } from '../core/palette.js';
import { MOTION, TAU, clamp, reduce, ri, rnd } from '../core/util.js';
import { ARMOR, ATLASC, POOL, RAR, SETS } from '../data/armor.js';
import { FX, line, lineBuf, tile32 } from '../fx/particles.js';
import { BAG, shownCount, slotFlash, slotRect, slotShown } from '../game/bag.js';
import { BG, CX, CY, H, NARROW, PBASE, PTOP, TORCH, TS, W } from '../game/layout.js';
import { S, tens } from '../game/state.js';
import { CHd, CWd, backC, brC, brG, cv, frontC, g, mk, pat, rotC, rotG, stage, tileSrcC } from '../gfx/canvas.js';
import { drawRampText, drawText, textW } from '../gfx/text.js';
import { bloomCopy } from './bloom.js';
import { postFX } from './postfx.js';
import { reflect } from './reflect.js';
import { RSB, RST, drawCoin, haloSpr, rotSlot, sheetDraw, sheetPut } from './sprites.js';
import { lightPass } from '../scene/lighting.js';
import { SCN, UNIT, UST, snapC } from '../scene/scene.js';
import { snap32 } from '../scene/wall.js';

let layerC,
  layerG,
  silC,
  silG,
  impImg = null,
  imp32 = null;
export function setupLayers() {
  [layerC, layerG] = mk(W, H);
  [silC, silG] = mk(W, H);
}
export function render() {
  const tr = S.trauma * S.trauma * MOTION,
    ox = Math.round((Math.sin(S.t * 37) * 0.6 + Math.sin(S.t * 61) * 0.4) * 7 * tr),
    oy = Math.round((Math.sin(S.t * 43 + 1) * 0.6 + Math.sin(S.t * 71) * 0.4) * 7 * tr);
  const c = tens(),
    bob = S.phase === 'idle' || S.phase === 'revealed' ? Math.round(Math.sin(S.t * 2.2) * 2 * (1 - c) * MOTION) : 0;
  const jx = Math.round((Math.random() - 0.5) * c * c * 4 * MOTION),
    jy = Math.round((Math.random() - 0.5) * c * c * 2 * MOTION),
    lift = -Math.round(5 * c * MOTION);
  S.cx = CX + Math.round(S.pos.x);
  S.cy = CY + Math.round(S.pos.y) + bob + lift;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  lightPass(ox, oy);
  // dust motes (lit)
  {
    const rk = RAMPS[S.lightKey] || RAMPS.s,
      c6 = PAL[rk[6]],
      c5 = PAL[rk[5]],
      cD = PAL['5'];
    for (const p of FX.dust) {
      const x = Math.round(p.x) + ox,
        y = Math.round(p.y) + oy,
        d = Math.hypot(p.x - S.cx, p.y - S.cy);
      let near = false;
      for (const t of TORCH) {
        const a = p.x - t.x,
          b = p.y - t.y;
        if (a * a + b * b < 900) {
          near = true;
          break;
        }
      }
      const lit = (S.cardI * 2200) / (2200 + d * d) + (near ? 0.6 : 0);
      if (lit < 0.25) continue;
      g.fillStyle = lit > 0.9 ? c6 : lit > 0.5 ? c5 : cD;
      g.fillRect(x, y, 1, 1);
    }
  }
  // shadow on altar
  if (!S.hidden && S.phase !== 'collecting') {
    const air = S.phase === 'entering' ? S.summon : 1;
    const sw = Math.round(46 * air * (1 - c * 0.25) * Math.max(0.3, Math.abs(Math.cos(S.spin.a))));
    if (sw > 2) {
      g.fillStyle = pat(g, 'k', 0.7);
      g.fillRect(CX - Math.round(sw / 2) + ox, PTOP + 1 + oy, sw, 2);
      g.fillStyle = pat(g, 'k', 0.35);
      g.fillRect(CX - Math.round(sw / 2) - 3 + ox, PTOP + 3 + oy, sw + 6, 1);
    }
  }
  // floor stuff: coins, tiles, confetti on floor
  for (const p of FX.coins) {
    const t = p.age / p.life;
    if (t > 0.85 && Math.floor(p.age * 20) & 1) continue;
    g.fillStyle = pat(g, 'k', 0.6);
    g.fillRect(Math.round(p.x) - 2 + ox, Math.round(p.gy) + 1 + oy, 5, 1);
    drawCoin(p.x + ox, p.gy - p.h + oy - 1, p.rest ? (Math.floor(p.x * 7) % 3 === 0 ? 1 : 0) : p.ph);
  }
  // void stars twinkle through the broken wall
  if (S.wall.active) {
    for (const [x, y, ph] of SCN.VOIDSTARS) {
      const u = UNIT[y * W + x];
      if (u < 0 || UST[u] !== 2) continue;
      const tw = Math.sin(S.t * 2.6 + ph);
      if (tw < 0.55) continue;
      const X = x + ox,
        Y = y + oy;
      g.fillStyle = PAL.w;
      g.fillRect(X, Y, 1, 1);
      if (tw > 0.93) {
        g.fillStyle = PAL[RAMPS[RAR[S.wall.r].ramp][5]];
        g.fillRect(X - 1, Y, 1, 1);
        g.fillRect(X + 1, Y, 1, 1);
        g.fillRect(X, Y - 1, 1, 1);
        g.fillRect(X, Y + 1, 1, 1);
      }
    }
  }
  // falling bricks + dust
  const brickHidden = (p) => {
    const t = p.age / p.life;
    return t > 0.88 && Math.floor(p.age * 20) & 1;
  };
  RSB.n = 0;
  if (snap32)
    for (const p of FX.bricks) {
      p._s = -1;
      if (brickHidden(p)) continue;
      const a = Math.round(p.rot * 4) / 4;
      if (!p.rest && a !== 0) p._s = rotSlot(RSB, snap32, W, p.sx, p.sy, p.w, p.h, a);
    }
  sheetPut(RSB);
  for (const p of FX.bricks) {
    if (brickHidden(p)) continue;
    const X = Math.round(p.x) + ox,
      Y = Math.round(p.y) + oy,
      a = Math.round(p.rot * 4) / 4;
    if (p.rest || a === 0) {
      g.drawImage(snapC, p.sx, p.sy, p.w, p.h, X - Math.floor(p.w / 2), Y - Math.floor(p.h / 2), p.w, p.h);
      if (p.rest) {
        g.fillStyle = PAL.k;
        g.fillRect(X - Math.floor(p.w / 2), Y + Math.ceil(p.h / 2), p.w, 1);
      }
    } else if (p._s >= 0) sheetDraw(RSB, p._s, X - 10, Y - 10);
    else {
      brG.setTransform(1, 0, 0, 1, 0, 0);
      brG.clearRect(0, 0, 20, 20);
      brG.translate(10, 10);
      brG.rotate(a);
      brG.drawImage(snapC, p.sx, p.sy, p.w, p.h, -p.w / 2, -p.h / 2, p.w, p.h);
      g.drawImage(brC, X - 10, Y - 10);
    }
  }
  for (const p of FX.dustp) {
    const t = p.age / p.life;
    if (t > 0.6 && Math.floor(p.age * 24) & 1) continue;
    g.fillStyle = PAL[t < 0.4 ? '4' : '5'];
    g.fillRect(Math.round(p.x) + ox, Math.round(p.y) + oy, t < 0.3 ? 2 : 1, t < 0.3 ? 2 : 1);
  }
  // broken chain links + padlock
  {
    const hotC = RAMPS[RAR[Math.max(0, S.tease)].ramp][4];
    for (const p of FX.links) {
      const t = p.age / p.life;
      if (t > 0.85 && Math.floor(p.age * 20) & 1) continue;
      const x = Math.round(p.x) + ox,
        y = Math.round(p.y) + oy;
      if (p.lock) {
        g.fillStyle = pat(g, 'k', 0.6);
        g.fillRect(x - 5, Math.round(p.g) + 1 + oy, 11, 1);
        g.drawImage(!p.rest && Math.floor(p.age * 12) % 2 ? LOCKM : LOCKC, x - 5, y - 12);
        continue;
      }
      const hot = p.age < 0.6,
        col = hot ? hotC : 'S',
        hi = hot ? 'w' : 's';
      if (p.odd) g.drawImage(linkSpr(1, col, hi), x, y);
      else g.drawImage(linkSpr(0, col, hi), x - 1, y - 1);
    }
  }
  // summoning circle
  if (S.phase === 'entering' && S.summon < 1) {
    const sp = S.summon,
      fade = sp < 0.8 ? 1 : (1 - sp) / 0.2,
      rx = Math.round(30 * Math.min(1, sp * 2.4)),
      ry = Math.max(1, Math.round(rx * 0.2)),
      cyc = PTOP - 1 + oy,
      arc = TAU * Math.min(1, sp * 1.8);
    if (rx > 2)
      for (let a = 0; a < arc; a += 0.6 / rx) {
        if (Math.random() > fade) continue;
        const aa = a + S.t * 1.6;
        g.fillStyle = PAL[Math.floor(a * 6) % 5 === 0 ? 'o' : 'c'];
        g.fillRect(Math.round(CX + Math.cos(aa) * rx) + ox, Math.round(cyc + Math.sin(aa) * ry), 1, 1);
      }
    for (let k = 0; k < 8; k++) {
      const aa = (k / 8) * TAU - S.t * 2.2,
        rr = rx * 0.7;
      if (sp > 0.2 + k * 0.05 && Math.random() < fade) {
        g.fillStyle = PAL.y;
        g.fillRect(Math.round(CX + Math.cos(aa) * rr) + ox - 1, Math.round(cyc + Math.sin(aa) * rr * 0.2), 2, 1);
      }
    }
  }
  // torch halos + flames
  for (const t of TORCH) {
    const fl = 1 + 0.15 * Math.sin(S.t * 13) + S.torchBoost * 0.6,
      x = t.x + ox,
      y = t.y - 3 + oy;
    g.drawImage(
      haloSpr(Math.round(7 * fl), Math.round(4 * fl), (x - Math.round(7 * fl)) & 3, (y - Math.round(7 * fl)) & 3),
      x - Math.round(7 * fl),
      y - Math.round(7 * fl),
    );
  }
  for (const p of FX.flames) {
    const t = p.age / p.life,
      x = Math.round(p.x) + ox,
      y = Math.round(p.y) + oy;
    if (p.ember) {
      g.fillStyle = PAL[t < 0.5 ? 'y' : t < 0.8 ? 'Y' : 'r'];
      g.fillRect(x, y, 1, 1);
      continue;
    }
    const k = t < 0.15 ? 'w' : t < 0.3 ? 'o' : t < 0.5 ? 'y' : t < 0.7 ? 'Y' : t < 0.85 ? 'r' : 'R';
    g.fillStyle = PAL[k];
    const s = p.big ? (t < 0.5 ? 4 : 2) : t < 0.3 ? 3 : t < 0.6 ? 2 : 1;
    g.fillRect(x - (s >> 1), y - (s >> 1), s, s);
  }
  // sucks
  for (const p of FX.sucks) {
    g.fillStyle = PAL[p.k];
    line(g, p.px + ox, p.py + oy, p.x + ox, p.y + oy);
  }
  // card
  const showFront =
    S.phase === 'revealed' ||
    S.phase === 'upgrading' ||
    S.phase === 'collecting' ||
    (S.phase === 'hitstop' && S.upgrading);
  // the card goes straight onto the frame; only the impact frame needs it on its own layer (for the silhouette)
  const LG = S.phase === 'hitstop' ? layerG : g;
  if (LG === layerG) layerG.clearRect(0, 0, W, H);
  if (!S.hidden) {
    if (showFront) drawFront(S.rt);
    else drawBack(S.rt);
    let sc = 1 + S.pulse,
      ry = S.tilt.y + S.spin.a,
      rx = S.tilt.x;
    if (S.phase === 'collecting') {
      sc = S.colScale;
      ry += S.colSpin;
    }
    const sqx = 1 + S.sq.x,
      sqy = 1 - S.sq.x * 0.6;
    const shine = showFront ? (S.vr >= 1 ? 0.9 : 0.5) : 0.35;
    if (S.glow > 0.05) {
      const gw = Math.round(1 + 5 * S.glow),
        w = Math.round(CWd * sc * Math.max(0.15, Math.abs(Math.cos(ry)))),
        h = Math.round(CHd * sc);
      const x = S.cx - Math.round(w / 2) + ox + jx,
        y = S.cy - Math.round(h / 2) + oy + jy;
      const ring = (o, col) => {
        LG.fillStyle = PAL[col];
        LG.fillRect(x - o, y - o, w + 2 * o, 1);
        LG.fillRect(x - o, y + h + o - 1, w + 2 * o, 1);
        LG.fillRect(x - o, y - o, 1, h + 2 * o);
        LG.fillRect(x + w + o - 1, y - o, 1, h + 2 * o);
      };
      const tk = S.teaseKey,
        rp = RAMPS[RAR[Math.max(0, S.tease)].ramp];
      ring(1, tk);
      if (S.glow > 0.35) ring(2, rp[4]);
      if (S.glow > 0.7 && Math.floor(S.rt * 16) % 2) ring(3, rp[3]);
    }
    drawCard3D(
      LG,
      showFront ? frontC : S.phase === 'entering' ? dissolve(backC, clamp((S.summon - 0.15) / 0.75, 0, 1.08)) : backC,
      showFront ? null : S.backOn ? null : null,
      S.cx + ox + jx,
      S.cy + oy + jy + Math.round((1 - sqy) * CHd * 0.5),
      ry,
      rx,
      (sc * (sqx + sqy)) / 2,
      shine,
    );
  }
  if (S.phase === 'hitstop') {
    renderImpact(ox, oy);
    return;
  }
  // tiles (rotated nearest-neighbour)
  const tileHidden = (p) => {
    const t = p.age / p.life;
    return t > 0.7 && Math.floor(p.age * 30) & 1;
  };
  RST.n = 0;
  if (tile32)
    for (const p of FX.tiles) {
      p._s = tileHidden(p) ? -1 : rotSlot(RST, tile32, CWd, p.sx, p.sy, p.w, p.h, Math.round(p.rot * 4) / 4);
    }
  sheetPut(RST);
  for (const p of FX.tiles) {
    if (tileHidden(p)) continue;
    if (p._s >= 0) {
      sheetDraw(RST, p._s, Math.round(p.x) - 8 + ox, Math.round(p.y) - 8 + oy);
      continue;
    }
    rotG.clearRect(0, 0, 16, 16);
    rotG.save();
    rotG.translate(8, 8);
    rotG.rotate(Math.round(p.rot * 4) / 4);
    rotG.drawImage(tileSrcC, p.sx, p.sy, p.w, p.h, -p.w / 2, -p.h / 2, p.w, p.h);
    rotG.restore();
    g.drawImage(rotC, Math.round(p.x) - 8 + ox, Math.round(p.y) - 8 + oy);
  }
  // bolts
  for (const b of FX.bolts) {
    if (Math.random() < 0.25) continue;
    g.fillStyle = PAL[b.k];
    for (let i = 0; i < b.pts.length - 1; i++) {
      const [x0, y0] = b.pts[i],
        [x1, y1] = b.pts[i + 1];
      line(g, x0 + ox + 1, y0 + oy, x1 + ox + 1, y1 + oy);
      line(g, x0 + ox, y0 + oy + 1, x1 + ox, y1 + oy + 1);
    }
    g.fillStyle = PAL.w;
    for (let i = 0; i < b.pts.length - 1; i++) {
      const [x0, y0] = b.pts[i],
        [x1, y1] = b.pts[i + 1];
      line(g, x0 + ox, y0 + oy, x1 + ox, y1 + oy);
    }
  }
  // sparks
  const dk = RAR[Math.max(0, S.vr)].d;
  for (const p of FX.sparks) {
    const t = p.age / p.life;
    const k = t > 0.6 && Math.floor(p.age * 24) & 1 ? dk : p.k;
    g.fillStyle = PAL[k];
    const s = p.big && t < 0.5 ? 2 : 1;
    g.fillRect(Math.round(p.x) + ox, Math.round(p.y) + oy, s, s);
    if (t < 0.45 && p.px !== undefined) {
      g.fillStyle = PAL[dk];
      line(g, p.px + ox, p.py + oy, p.x + ox, p.y + oy);
      g.fillStyle = PAL[k];
      g.fillRect(Math.round(p.x) + ox, Math.round(p.y) + oy, s, s);
    }
  }
  for (const p of FX.confetti) {
    const t = p.age / p.life;
    if (t > 0.8 && Math.floor(p.age * 20) & 1) continue;
    g.fillStyle = PAL[p.k];
    const hor = p.land ? true : Math.sin(p.ph) > 0;
    g.fillRect(Math.round(p.x) + ox, Math.round(p.y) + oy - (hor ? 0 : 1), hor ? 2 : 1, hor ? 1 : 2);
  }
  for (const p of FX.motes) {
    const t = p.age / p.life,
      s = t < 0.3 || t > 0.7 ? 0 : 1,
      x = Math.round(p.x) + ox,
      y = Math.round(p.y) + oy;
    g.fillStyle = PAL.w;
    g.fillRect(x, y, 1, 1);
    if (s) {
      g.fillStyle = PAL[p.k];
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  if (!window.APP.noR) reflect(ox, oy);
  // title
  if (S.title) {
    const T = S.title,
      str = T.text,
      tw = textW(str, TS),
      x0 = Math.round(CX - tw / 2),
      yBase = Math.round(CY - CHd / 2 - 5 * TS - 10);
    const shine = (((S.rt * 1.1) % 2.2) * (str.length + 6)) / 1.6 - 3;
    for (let i = 0; i < str.length; i++) {
      const e = S.rt - T.t0 - 0.06 - i * 0.055;
      if (e < 0) continue;
      let dy;
      if (e < 0.18) {
        const p = e / 0.18;
        dy = -Math.round((1 - p * p) * 34);
      } else if (e < 0.32) {
        dy = Math.round(Math.sin(((e - 0.18) / 0.14) * Math.PI) * -4);
      } else dy = Math.round(Math.sin(S.rt * 4 + i * 0.7) * 1.3);
      const qx = T.quake ? ri(-2, 2) : 0,
        qy = T.quake ? ri(-1, 1) : 0;
      const lit = Math.abs(i - shine) < 1.2;
      const rf = T.ramp
        ? (row) => (lit && row < 3 ? (row === 0 ? 'w' : 'o') : T.ramp[row])
        : (row) => (row === 0 ? CYCLE[(Math.floor(S.rt * 10) + i) % CYCLE.length] : ['o', 'y', 'Y', 'R'][row - 1]);
      drawRampText(g, str[i], x0 + i * 4 * TS + qx + ox, yBase + dy + qy + oy, TS, rf);
    }
  }
  // stamp
  if (S.stamp) {
    const e = S.rt - S.stamp.t0,
      fin = W >= 300 ? 2 : 1,
      s = e < 0.05 ? fin + 3 : e < 0.1 ? fin + 2 : e < 0.16 ? fin + 1 : fin,
      str = S.stamp.text,
      tw = textW(str, s),
      bx = Math.round(S.cx + CWd / 2 - tw / 2 - 4) + ox,
      by = Math.round(S.cy - CHd / 2 - 6) + oy;
    g.fillStyle = PAL.k;
    g.fillRect(bx - 4, by - 4, tw + 8, 5 * s + 8);
    g.fillStyle = PAL[S.stamp.key];
    g.fillRect(bx - 3, by - 3, tw + 6, 5 * s + 6);
    g.fillStyle = PAL.w;
    g.fillRect(bx - 3, by - 3, tw + 6, 1);
    g.fillStyle = PAL[S.stamp.key === 'y' ? 'Y' : '5'];
    g.fillRect(bx - 3, by + 5 * s + 2, tw + 6, 1);
    drawText(g, str, bx, by, s, 'k');
  }
  // hint
  if (S.phase === 'idle' && S.charge < 0.05 && Math.floor(S.rt * 2) % 2 === 0) {
    const str = S.auto ? 'HERE IT COMES' : 'HOLD TO OPEN';
    drawText(g, str, Math.round(CX - textW(str, 1) / 2), PBASE + 8, 1, 'c', 'k');
  }
  // bag
  for (let i = 0; i < POOL.length; i++) {
    const r = slotRect(i),
      fl = slotFlash[i] > 0 && Math.floor(slotFlash[i] * 20) & 1,
      R = RAR[POOL[i].r];
    g.fillStyle = PAL.k;
    g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    g.fillStyle = PAL[slotShown[i] ? R.d : 1];
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = PAL[slotShown[i] ? R.l : 2];
    g.fillRect(r.x, r.y, r.w, 1);
    g.fillRect(r.x, r.y, 1, r.h);
    if (fl) {
      g.fillStyle = PAL.w;
      g.fillRect(r.x, r.y, r.w, r.h);
    } else if (slotShown[i] && ATLASC) {
      const A = ARMOR[POOL[i].spr];
      if (r.w >= 13)
        g.drawImage(
          ATLASC,
          A.i16[0],
          A.i16[1],
          16,
          16,
          r.x + Math.floor((r.w - Math.min(16, r.w)) / 2),
          r.y + Math.floor((r.h - Math.min(16, r.h)) / 2),
          Math.min(16, r.w),
          Math.min(16, r.h),
        );
      else {
        const s = Math.min(10, r.w),
          o = Math.floor((r.w - s) / 2);
        g.drawImage(ATLASC, A.i10[0], A.i10[1], 10, 10, r.x + o, r.y + o, s, s);
      }
    } else {
      g.fillStyle = PAL[0];
      g.fillRect(r.x + Math.floor(r.w / 2) - 1, r.y + Math.floor(r.h / 2) - 1, 2, 2);
    }
  }
  // one underline per set: its colour while collecting, gold once the set is complete
  for (let s = 0; s < SETS.length; s++) {
    const a = slotRect(s * 5),
      b = slotRect(s * 5 + 4);
    g.fillStyle = PAL[BAG.sets[s] ? 'y' : DARKEN[SETS[s].c] || SETS[s].c];
    g.fillRect(a.x - 1, a.y + a.h + 1, b.x + b.w - a.x + 2, 1);
  }
  if (!NARROW) {
    const e = slotRect(BG.gpr * 5 - 1);
    drawText(g, `${shownCount()}/${POOL.length}`, e.x + e.w + 5, e.y + Math.floor(e.h / 2) - 2, 1, '4', 'k');
  }
  // letterbox
  if (S.box > 0.02) {
    const bh = Math.round(S.box * H * 0.1);
    g.fillStyle = PAL.k;
    g.fillRect(0, 0, W, bh);
    g.fillRect(0, H - bh, W, bh);
  }
  // flash
  if (S.flash > 0.03) {
    g.fillStyle = S.flash > 0.85 ? PAL[S.flashKey] : pat(g, S.flashKey, S.flash);
    g.fillRect(0, 0, W, H);
  }
  postFX();
  bloomCopy();
  stage.style.transform = Math.abs(S.zoom.x - 1) > 0.0005 ? `scale(${S.zoom.x.toFixed(4)})` : '';
}
function renderImpact(ox, oy) {
  const e = 1 - S.hitstop / S.hitstopDur;
  if (e < 0.22) {
    g.drawImage(layerC, 0, 0);
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  } else {
    const dark = e < 0.66,
      fg = dark ? PAL.w : PAL.k,
      fg32 = dark ? U32.w : U32.k;
    if (!impImg || impImg.width !== W || impImg.height !== H) {
      impImg = g.createImageData(W, H);
      imp32 = new Uint32Array(impImg.data.buffer);
    }
    imp32.fill(dark ? U32.k : U32.w);
    const Rm = Math.hypot(W, H);
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * TAU,
        r0 = rnd(52, 80),
        r1 = Rm;
      lineBuf(
        imp32,
        S.cx + Math.cos(a) * r0,
        S.cy + Math.sin(a) * r0,
        S.cx + Math.cos(a) * r1,
        S.cy + Math.sin(a) * r1,
        fg32,
      );
      if (i % 3 === 0)
        lineBuf(
          imp32,
          S.cx + Math.cos(a) * r0 + 1,
          S.cy + Math.sin(a) * r0,
          S.cx + Math.cos(a) * r1 + 1,
          S.cy + Math.sin(a) * r1,
          fg32,
        );
    }
    for (let i = 0; i < 3; i++) {
      const r = Math.round(60 + e * 80 + i * 14);
      for (let a = 0; a < TAU; a += 0.05) {
        if (Math.random() < 0.5) {
          const x = Math.round(S.cx + Math.cos(a) * r),
            y = Math.round(S.cy + Math.sin(a) * r);
          if (x >= 0 && y >= 0 && x < W && y < H) imp32[y * W + x] = fg32;
        }
      }
    }
    g.putImageData(impImg, 0, 0);
    silG.clearRect(0, 0, W, H);
    silG.drawImage(layerC, 0, 0);
    silG.globalCompositeOperation = 'source-in';
    silG.fillStyle = fg;
    silG.fillRect(0, 0, W, H);
    silG.globalCompositeOperation = 'source-over';
    g.drawImage(silC, 0, 0);
    if (!reduce && !NARROW) {
      const hw = Math.ceil(W / 2),
        hh = Math.ceil(H / 2),
        sx = Math.round(clamp(S.cx - W / 4, 0, W - hw)),
        sy = Math.round(clamp(S.cy - H / 4, 0, H - hh));
      silG.clearRect(0, 0, W, H);
      silG.drawImage(cv, 0, 0);
      g.drawImage(silC, sx, sy, hw, hh, 0, 0, hw * 2, hh * 2);
    }
  }
  bloomCopy();
  stage.style.transform = `scale(${S.zoom.x.toFixed(4)})`;
}
