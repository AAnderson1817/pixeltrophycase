/**
 * Particle pools (FX) and spawners: sparks, rings, confetti, coins, card shards, lightning, and line helpers.
 */
import { A } from '../audio/chip.js';
import { DN } from '../core/perf.js';
import { TAU, reduce, rnd } from '../core/util.js';
import { GMAX, GMIN, H, HY, PBASE, W } from '../game/layout.js';
import { S } from '../game/state.js';
import { CHd, CWd, tileSrcG } from '../gfx/canvas.js';

export const FX = {
  bricks: [],
  dustp: [],
  links: [],
  sparks: [],
  tiles: [],
  confetti: [],
  sucks: [],
  motes: [],
  bolts: [],
  rings: [],
  flames: [],
  coins: [],
  dust: [],
};
export const Q = (n) => Math.round(n * (reduce ? 0.4 : 1) * DN());
export function prune(a) {
  let j = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    if (p.age < p.life) a[j++] = p;
  }
  a.length = j;
}
export const gy = () => rnd(Math.max(GMIN, PBASE + 2), GMAX);
export function sparks(n, key, smin, smax, life, x0, y0, floorless) {
  n = Q(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU,
      s = rnd(smin, smax);
    FX.sparks.push({
      x: x0 ?? S.cx,
      y: y0 ?? S.cy,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      age: 0,
      life: life * rnd(0.5, 1.2),
      k: Math.random() < 0.3 ? 'w' : key,
      big: Math.random() < 0.3,
      g: floorless ? 1e9 : gy(),
    });
  }
}
export function ring(key, speed, w, delay) {
  FX.rings.push({
    r: 12,
    v: speed,
    w,
    k: key,
    age: -(delay || 0),
    life: 0.85,
  });
}
export function confetti(n, keys, rain) {
  for (let i = 0; i < Q(n); i++) {
    const a = -Math.PI / 2 + rnd(-1.4, 1.4),
      s = rnd(70, 230);
    FX.confetti.push(
      rain
        ? {
            x: rnd(0, W),
            y: rnd(-160, -4),
            vx: rnd(-10, 10),
            vy: rnd(0, 40),
            k: keys[i % keys.length],
            age: 0,
            life: rnd(3.5, 6),
            ph: rnd(0, TAU),
            g: gy(),
          }
        : {
            x: S.cx + rnd(-12, 12),
            y: S.cy,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            k: keys[i % keys.length],
            age: 0,
            life: rnd(3, 4.5),
            ph: rnd(0, TAU),
            g: gy(),
          },
    );
  }
}
export function coins(n) {
  for (let i = 0; i < Q(n); i++) {
    const gg = gy();
    FX.coins.push({
      x: S.cx + rnd(-8, 8),
      h: gg - S.cy,
      gy: gg,
      vx: rnd(-150, 150),
      vh: rnd(90, 260),
      ph: rnd(0, 4),
      rest: false,
      age: 0,
      life: rnd(6, 9),
    });
  }
}
export let tile32 = null;
export function shatter(fromCanvas) {
  tileSrcG.clearRect(0, 0, CWd, CHd);
  tileSrcG.drawImage(fromCanvas, 0, 0);
  tile32 = new Uint32Array(tileSrcG.getImageData(0, 0, CWd, CHd).data.buffer);
  const ox = Math.round(S.cx - CWd / 2),
    oy = Math.round(S.cy - CHd / 2);
  for (let ty = 0; ty < CHd; ty += 8)
    for (let tx = 0; tx < CWd; tx += 8) {
      const cx = tx + 4 - CWd / 2,
        cy = ty + 4 - CHd / 2,
        a = Math.atan2(cy, cx) + rnd(-0.4, 0.4),
        s = rnd(80, 220);
      FX.tiles.push({
        sx: tx,
        sy: ty,
        w: Math.min(8, CWd - tx),
        h: Math.min(8, CHd - ty),
        x: ox + tx + 4,
        y: oy + ty + 4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 70,
        rot: 0,
        vr: rnd(-14, 14),
        age: 0,
        life: rnd(1.1, 1.9),
        g: gy(),
      });
    }
}
export function bolt(key) {
  const a = Math.random() * TAU,
    sx = S.cx + Math.cos(a) * 34,
    sy = S.cy + Math.sin(a) * 46,
    len = rnd(24, 70),
    b = a + rnd(-0.5, 0.5);
  let pts = [
      [sx, sy],
      [sx + Math.cos(b) * len, sy + Math.sin(b) * len],
    ],
    disp = len * 0.45;
  for (let k = 0; k < 4; k++) {
    const np = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i],
        [bx, by] = pts[i + 1];
      const dx = bx - ax,
        dy = by - ay,
        L = Math.hypot(dx, dy) || 1,
        off = (Math.random() - 0.5) * disp;
      np.push([(ax + bx) / 2 - (dy / L) * off, (ay + by) / 2 + (dx / L) * off], pts[i + 1]);
    }
    pts = np;
    disp *= 0.55;
  }
  FX.bolts.push({
    pts: pts.map((p) => [Math.round(p[0]), Math.round(p[1])]),
    k: key,
    age: 0,
    life: rnd(0.06, 0.15),
  });
  A.zap();
}
export function lineBuf(b, x0, y0, x1, y1, col) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy,
    n = 0,
    was = false;
  while (n++ < 600) {
    const inb = x0 >= 0 && y0 >= 0 && x0 < W && y0 < H;
    if (inb) {
      b[y0 * W + x0] = col;
      was = true;
    } else if (was) break;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
export function line(x, x0, y0, x1, y1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy,
    n = 0;
  while (n++ < 600) {
    x.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
export function seedDust() {
  FX.dust = [];
  for (let i = 0; i < Math.round((W * H) / 1200); i++)
    FX.dust.push({
      x: rnd(0, W),
      y: rnd(0, HY),
      vx: rnd(-3, 3),
      vy: rnd(-2, 2),
      ph: rnd(0, TAU),
    });
}
