// PBR material library with procedural textures (canvas generated, no external assets).
import * as THREE from 'three';

const texCache = new Map();
const matCache = new Map();

function canvasTexture(key, size, paint, { repeat = 1, colorSpace = THREE.SRGBColorSpace } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = colorSpace; t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

// cheap value noise
function noise2(x, y, seed = 0) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, y, scale, seed) {
  const xi = Math.floor(x / scale), yi = Math.floor(y / scale), fx = x / scale - xi, fy = y / scale - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = noise2(xi, yi, seed), b = noise2(xi + 1, yi, seed), c = noise2(xi, yi + 1, seed), d = noise2(xi + 1, yi + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function fbm(x, y, seed, octaves = 4) {
  let v = 0, amp = 0.5, sc = 64;
  for (let i = 0; i < octaves; i++) { v += amp * smoothNoise(x, y, sc, seed + i); amp *= 0.5; sc *= 0.5; }
  return v;
}

export function woodTexture(tint = [168, 118, 72], dark = [96, 60, 30]) {
  const key = 'wood' + tint.join(',');
  return canvasTexture(key, 512, (ctx, n) => {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const grain = Math.sin((x + 60 * fbm(x, y, 3, 3)) * 0.07 + y * 0.003) * 0.5 + 0.5;
      const f = 0.25 + Math.pow(grain, 2.0) * 0.4 + 0.2 * fbm(x, y, 11, 4);
      const i = (y * n + x) * 4;
      img.data[i] = tint[0] * (1 - f) + dark[0] * f; img.data[i + 1] = tint[1] * (1 - f) + dark[1] * f; img.data[i + 2] = tint[2] * (1 - f) + dark[2] * f; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 2 });
}

export function concreteTexture() {
  return canvasTexture('concrete', 512, (ctx, n) => {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 120 + 50 * fbm(x, y, 5, 5) + 18 * (noise2(x, y, 9) - 0.5);
      const i = (y * n + x) * 4; img.data[i] = v; img.data[i + 1] = v + 2; img.data[i + 2] = v + 6; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // tile seams
    ctx.strokeStyle = 'rgba(40,40,45,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, n); ctx.moveTo(0, 0); ctx.lineTo(n, 0); ctx.stroke();
  }, { repeat: 1 });
}

export function brushedRoughness() {
  return canvasTexture('brushed', 512, (ctx, n) => {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      const line = 0.35 + 0.3 * noise2(0, y, 2);
      for (let x = 0; x < n; x++) {
        const v = 255 * Math.min(1, Math.max(0, line + 0.15 * (noise2(x, y, 4) - 0.5) + 0.1 * fbm(x, y, 7, 3)));
        const i = (y * n + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 3, colorSpace: THREE.NoColorSpace });
}

export function scuffRoughness() {
  return canvasTexture('scuff', 512, (ctx, n) => {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 255 * Math.min(1, 0.55 + 0.45 * fbm(x, y, 21, 5) - 0.25 * Math.pow(fbm(x * 2, y * 2, 33, 3), 3));
      const i = (y * n + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 2, colorSpace: THREE.NoColorSpace });
}

const BASE = {
  steel:    () => ({ color: 0xb4b9c2, metalness: 1.0, roughness: 0.42, roughnessMap: brushedRoughness(), envMapIntensity: 0.7 }),
  chrome:   () => ({ color: 0xf2f4f8, metalness: 1.0, roughness: 0.18, envMapIntensity: 0.6 }),
  cradle:   () => ({ color: 0xf2f4f8, metalness: 1.0, roughness: 0.18, envMapIntensity: 0.6 }),
  aluminum: () => ({ color: 0xd6d9de, metalness: 1.0, roughness: 0.32, roughnessMap: brushedRoughness(), envMapIntensity: 0.7 }),
  wood:     () => ({ color: 0xffffff, map: woodTexture([178, 128, 80], [112, 74, 40]), metalness: 0, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.4 }),
  darkwood: () => ({ color: 0xffffff, map: woodTexture([112, 74, 44], [58, 34, 18]), metalness: 0, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.35 }),
  rubber:   () => ({ color: 0x1b1b1d, metalness: 0, roughness: 0.92, roughnessMap: scuffRoughness() }),
  conveyor: () => ({ color: 0x242426, metalness: 0, roughness: 0.9 }),
  concrete: () => ({ color: 0xb9b4ac, map: concreteTexture(), metalness: 0, roughness: 0.95 }),
  gold:     () => ({ color: 0xe4ad2e, metalness: 1.0, roughness: 0.46, envMapIntensity: 0.45 }),
  brass:    () => ({ color: 0xcfa43a, metalness: 1.0, roughness: 0.3, roughnessMap: brushedRoughness(), envMapIntensity: 0.6 }),
  copper:   () => ({ color: 0xb87333, metalness: 1.0, roughness: 0.3 }),
  // glass: no diffuse albedo (a lit pale diffuse at 10% alpha still reads as 40% grey after tone mapping); presence comes from reflections
  glass:    () => ({ color: 0x0b141c, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.7, specularIntensity: 1.0 }),
  plastic:  () => ({ color: 0xf4f1ea, metalness: 0, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
  track:    () => ({ color: 0x3d4a5c, metalness: 0.75, roughness: 0.4, roughnessMap: scuffRoughness() }),
  paintRed: () => ({ color: 0xc8352b, metalness: 0.1, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  paintBlue:() => ({ color: 0x2d6fc4, metalness: 0.1, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  paintYellow:() => ({ color: 0xf1c40f, metalness: 0.1, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.1 }),
  felt:     () => ({ color: 0x6e1f1f, metalness: 0, roughness: 1.0 }),
  marble:   () => ({ color: 0x2a2a30, metalness: 0.05, roughness: 0.18, clearcoat: 0.6 }),
  skid:     () => ({ color: 0xe8e8e8, metalness: 0, roughness: 0.4 }),
};

/** Get (cached) material for a physics material name, optional colour override and look override. */
export function getMaterial(name, color = null, look = null) {
  const base = look || name;
  const key = `${base}|${color === null ? '' : color}`;
  if (matCache.has(key)) return matCache.get(key);
  const def = (BASE[base] || BASE.steel)();
  if (color !== null && color !== undefined && !def.map) def.color = color;
  if (color !== null && color !== undefined && def.map) { def.color = color; } // tint textured materials
  const m = new THREE.MeshPhysicalMaterial(def);
  matCache.set(key, m);
  return m;
}

export function emissiveMaterial(color, intensity = 2.5) {
  const key = `emissive|${color}|${intensity}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0 });
  matCache.set(key, m);
  return m;
}

export function allMaterials() { return [...matCache.values()]; }
