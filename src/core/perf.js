/**
 * Effect-density knobs. PERF.base is the fixed cut versus the original game; PERF.dq is moved by the governor in game/loop.js.
 */
/* effect density: base cut vs the original, times an adaptive factor the governor moves between .35 and 1 */
export const PERF = {
  base: 0.62,
  dq: 1,
  work: 4,
  bloomOff: false,
};
export const DN = () => PERF.base * PERF.dq;
