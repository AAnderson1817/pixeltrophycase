/** Fixed scene geometry in logical pixels (384x216). */
export const FLOOR_Y = 150;
export const WIN = { x0: 64, x1: 320, cx: 192, hw: 128 };
/** Top edge of the great arched window at column x (inside [WIN.x0, WIN.x1)). */
export function archTop(x) {
  const u = (x - WIN.cx) / WIN.hw;
  return 44 - 38 * Math.sqrt(Math.max(0, 1 - u * u));
}
export const ARCH = new Int16Array(384);
for (let x = 0; x < 384; x++) ARCH[x] = x >= WIN.x0 && x < WIN.x1 ? Math.round(archTop(x)) : FLOOR_Y;
export const inWindow = (x, y) => x >= WIN.x0 && x < WIN.x1 && y >= ARCH[x] && y < FLOOR_Y;

export const CAB = { x0: 124, x1: 260, y0: 24, y1: 146, ix0: 132, ix1: 252, iy0: 32, iy1: 142 };
/** Shelf compartments: top of the open space, and the y of the board the pedestal stands on. */
export const SHELVES = [
  { top: 32, board: 68 },
  { top: 70, board: 104 },
  { top: 106, board: 140 },
];
export const SLOT_X = [152, 192, 232];
export const PEDESTAL_H = 4;
/** Slots in investiture order: bottom shelf left to right, middle, then top left, top right and the centre last. */
export const ORDER = [
  [2, 0], [2, 1], [2, 2],
  [1, 0], [1, 1], [1, 2],
  [0, 0], [0, 2], [0, 1],
];
export const slotRect = (shelf, col) => {
  const s = SHELVES[shelf];
  return { cx: SLOT_X[col], top: s.top, board: s.board, baseY: s.board - PEDESTAL_H };
};
export const PRESENT = { x: 192, y: 92 }; // where a summoned trophy hovers (sprite centre)
export const PLATE_Y = 168; // hologram nameplate baseline
export const SEAL = { x: 192, y: 16 };
export const PLANET = { x: 296, y: 64, r: 22, rx: 38, ry: 9 };
