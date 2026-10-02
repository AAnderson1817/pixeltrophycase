// Physical material table. friction / restitution are Rapier coefficients (combined by average by default),
// density in kg/m^3. The renderer maps the same keys to PBR materials.
export const MATERIALS = {
  steel:    { friction: 0.45, restitution: 0.55, density: 7850 },
  chrome:   { friction: 0.40, restitution: 0.60, density: 7850 },
  wood:     { friction: 0.50, restitution: 0.30, density: 700 },
  darkwood: { friction: 0.50, restitution: 0.30, density: 750 },
  rubber:   { friction: 0.90, restitution: 0.80, density: 1100 },
  concrete: { friction: 0.65, restitution: 0.20, density: 2400 },
  gold:     { friction: 0.40, restitution: 0.40, density: 19300 },
  aluminum: { friction: 0.40, restitution: 0.45, density: 2700 },
  glass:    { friction: 0.35, restitution: 0.60, density: 2500 },
  plastic:  { friction: 0.40, restitution: 0.45, density: 1050 },
  brass:    { friction: 0.40, restitution: 0.50, density: 8500 },
  track:    { friction: 0.55, restitution: 0.25, density: 7850 }, // painted steel track / rails
  paintRed: { friction: 0.50, restitution: 0.35, density: 7850 },
  paintBlue:{ friction: 0.50, restitution: 0.35, density: 7850 },
  paintYellow:{ friction: 0.50, restitution: 0.35, density: 7850 },
  felt:     { friction: 0.85, restitution: 0.10, density: 300 },
  marble:   { friction: 0.40, restitution: 0.50, density: 2700 },
  copper:   { friction: 0.40, restitution: 0.45, density: 8960 },
  cradle:   { friction: 0.40, restitution: 0.80, density: 2700 },  // polished aluminium cradle spheres
  conveyor: { friction: 1.60, restitution: 0.05, density: 1100 },  // grippy roller lagging
  skid:     { friction: 0.04, restitution: 0.10, density: 2000 },  // PTFE sled runners on steel rail
};
export function mat(name) {
  const m = MATERIALS[name];
  if (!m) throw new Error('unknown material ' + name);
  return m;
}
