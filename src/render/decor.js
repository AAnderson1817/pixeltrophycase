// Decorative geometry: the hall, the pixel trophy, marquee lettering.
import * as THREE from 'three';
import { getMaterial, emissiveMaterial, concreteTexture } from './materials.js';

/** Voxel trophy (pixel-art cup) built from instanced cubes; returns a Group positioned so the cup rim is at y = 0. */
export function buildTrophyVoxels() {
  const rows = [
    // bottom -> top, each string is one layer seen from the front (x), depth mirrored in z for a chunky look
    '....####....',
    '....####....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '#.########.#',
    '#.########.#',
    '#.########.#',
    '##.######.##',
    '.##########.',
    '..########..',
  ];
  const v = 0.11;
  const positions = [];
  rows.forEach((row, yi) => {
    const depth = yi < 2 ? 4 : yi < 5 ? 2 : Math.max(2, Math.round((row.split('#').length - 1) * 0.55));
    for (let xi = 0; xi < row.length; xi++) {
      if (row[xi] !== '#') continue;
      for (let zi = 0; zi < depth; zi++) positions.push([(xi - row.length / 2 + 0.5) * v, (yi + 0.5) * v, (zi - depth / 2 + 0.5) * v]);
    }
  });
  const g = new THREE.BoxGeometry(v * 0.98, v * 0.98, v * 0.98);
  const mesh = new THREE.InstancedMesh(g, getMaterial('gold'), positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); mesh.setMatrixAt(i, m); });
  mesh.castShadow = true; mesh.receiveShadow = true;
  const group = new THREE.Group();
  mesh.position.y = -rows.length * v - 0.42; // cup rim sits at the bowl bottom (y = -0.42 of the pedestal part)
  group.add(mesh);
  return group;
}

/** Glowing marquee letters as a canvas texture on a plane. */
export function buildMarquee(text, shape) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0b10'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = 'bold 110px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd54a'; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 24;
  ctx.fillText(text, c.width / 2, c.height / 2 + 6);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.6, roughness: 0.6 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(shape.hx * 2 - 0.1, shape.hy * 2 - 0.1), mat);
  plane.position.z = shape.hz + 0.01;
  return plane;
}

/** The exhibition hall: floor, walls, ceiling trusses, skylight strips, pillars. */
export function buildHall(scene, bounds) {
  const group = new THREE.Group(); group.name = 'hall';
  const pad = 12;
  const minX = bounds.min.x - pad, maxX = bounds.max.x + pad, minZ = bounds.min.z - pad, maxZ = bounds.max.z + pad;
  const w = maxX - minX, d = maxZ - minZ, h = Math.max(34, bounds.max.y + 6);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // floor
  const floorMat = getMaterial('concrete');
  floorMat.map.repeat.set(w / 4, d / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.001, cz); floor.receiveShadow = true;
  group.add(floor);
  // walls (dark, matte)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.95, metalness: 0.0, side: THREE.BackSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  box.position.set(cx, h / 2, cz); box.receiveShadow = false;
  group.add(box);
  // pillars along the walls
  const pillarMat = getMaterial('concrete');
  const pillarGeom = new THREE.BoxGeometry(1.2, h, 1.2);
  for (let x = minX + 6; x < maxX - 3; x += 12) for (const z of [minZ + 0.7, maxZ - 0.7]) { const p = new THREE.Mesh(pillarGeom, pillarMat); p.position.set(x, h / 2, z); p.castShadow = false; p.receiveShadow = true; group.add(p); }
  // ceiling trusses + skylight strips (emissive, feed the bloom)
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.7, metalness: 0.6 });
  const trussGeom = new THREE.BoxGeometry(0.5, 1.6, d - 2);
  const skyMat = emissiveMaterial(0xdfe9ff, 1.8);
  const skyGeom = new THREE.BoxGeometry(2.4, 0.1, d - 6);
  for (let x = minX + 6; x < maxX - 3; x += 12) {
    const t = new THREE.Mesh(trussGeom, trussMat); t.position.set(x, h - 1.0, cz); group.add(t);
    const sMesh = new THREE.Mesh(skyGeom, skyMat); sMesh.position.set(x + 6, h - 0.2, cz); group.add(sMesh);
  }
  // wall-mounted lamp fixtures
  const lampMat = emissiveMaterial(0xfff1d6, 2.2);
  const lampGeom = new THREE.BoxGeometry(1.4, 0.25, 0.25);
  for (let x = minX + 8; x < maxX - 4; x += 8) for (const z of [minZ + 0.6, maxZ - 0.6]) { const l = new THREE.Mesh(lampGeom, lampMat); l.position.set(x, 6, z); group.add(l); }
  scene.add(group);
  return { group, size: { w, d, h }, center: { x: cx, z: cz } };
}
