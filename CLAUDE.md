# Loot Pixel Vault — notes for Claude Code

Pixel-art loot-card opener. Hold the card, it bursts, an armor piece is revealed and flies into the bag; collect all
30 pieces across six sets. Plain JavaScript ES modules, Canvas 2D, Web Audio. No runtime dependencies.

## Commands

| Command                           | What it does                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on http://localhost:5173                                                                                                                  |
| `npm run build`                   | `dist/index.html` (one self-contained file: JS, CSS and atlas PNG inlined) and `dist/artifact.html` (same, without the document skeleton, for publishing) |
| `npm test`                        | Playwright: behaviour tests + golden frames, against a Vite server on port 5179 (`GAME_PORT` to change; a busy port fails the run)                        |
| `npm run test:dist`               | Build, then run the same tests against `dist/index.html`                                                                                                  |
| `npm run test:golden:update`      | Re-record golden frame hashes (only after an intended visual change)                                                                                      |
| `npm run bench`                   | Frame-cost benchmark on `dist/index.html` (`-- --size 390x844 --dpr 3 --cpu 4`, `-- --url <dev server>`, `-- --no-probe`)                                 |
| `npm run sprites`                 | Regenerate the armor atlas from `art/sheets/` (Python 3.11; see Sprite pipeline for the install line)                                                     |
| `npm run lint`                    | ESLint: recommended rules plus the invariants below that a linter can check (`eslint.config.js`)                                                          |
| `npm run format` / `format:check` | Prettier                                                                                                                                                  |

First run: `npm install && npx playwright install chromium` (Node 22.13+ or 24+). In Claude Code on the web, `.claude/hooks/session-start.sh` installs the npm and Python dependencies at session start; Chromium is preinstalled there.

Before finishing any change: `npm run format:check`, `npm run lint` and `npm test` must pass. If the change touches rendering, also run `npm run build && npm run bench` and check it stays inside the budget under Invariants.

CI (`.github/workflows/ci.yml`, every push): format check, lint, `npm test`, `npm run test:dist`, and a job that re-runs the sprite pipeline with the pinned versions and fails if the committed atlas differs.

## Module map (`src/`)

```
main.js            entry: errors handler first, styles, boot()
core/  errors.js   on-page error box        util.js     rnd/ri/lerp/clamp, mulberry(), MOTION, later()
       palette.js  PAL, U32, BAYER, ramps   perf.js     PERF knobs, DN() density multiplier
data/  armor.js    SETS, ARMOR (atlas json), RAR (rarity tiers + odds), POOL, ATLASC
gfx/   canvas.js   #screen/#bloom contexts, mk(), card size consts, dither fills
       text.js     3x5 bitmap font, cached per (text, scale, colours)
audio/ chip.js     A: all sound, synthesised (pulse/square/triangle/noise + echo)
scene/ scene.js    builds bricks/tiles/altar as lit units for the layout; SCN container
       lighting.js per-frame unit lighting, dirty-unit repaint, altar per pixel, shock rings
       wall.js     wall break on reveal: void generation, brick debris, rebuild
card/  faces.js    back + front faces (64x90)
       chains.js   chains, padlock, snap, summon dissolve
       card3d.js   pseudo-3D warp (column/row slices) in typed arrays
game/  state.js    S (all mutable game state), window.APP created here
       layout.js   integer scale + logical size, positions
       bag.js      collection, localStorage 'loot-pixel-armor-v1', grid, resetBag()
       flow.js     card lifecycle: assign, burst, hitstop, reveal, fake-out upgrade, collect, celebrate, next
       input.js    pointer/keyboard/HUD (rarity pills, two-press reset, mute); initInput()
       sim.js      simulation on world time (slow-mo aware)
       loop.js     frame(), tick(), pacing (PACE), governor, compositor probe, boot()
fx/    particles.js FX pools + spawners (sparks, rings, confetti, coins, shards, bolts)
render/render.js   frame composition in draw order; impact frame
       sprites.js  coin/halo sprites, rotation sheets
       reflect.js  floor reflection        postfx.js  chromatic split + glitch rows
       bloom.js    JS bloom into #bloom (screen-blended by CSS)
```

Phase machine (`S.phase`): `entering → idle → hitstop → revealed → (upgrading → hitstop → revealed) → collecting → entering`.

## Invariants — do not break

- **60 fps budget.** Script time per frame at 1920×1080 is ~2–5 ms mean in `npm run bench`. Anything per-frame must stay in that envelope.
- **Offscreen canvases come from `mk()`** (`willReadFrequently: true`, CPU-backed). A GPU-backed source drawn into the CPU-backed screen forces a readback every frame.
- **No per-frame allocation in hot paths.** Pixel work goes through `Uint32Array` views over `ImageData`; reuse buffers (see `pfxBuf`, `SCN.VOID32`, rotation sheets). Cache anything that can be cached (glyphs, coins, chain links, halos). The known exception is the `getImageData` readbacks (reflection, bloom, post-FX, card faces), which allocate by API design; some older paths still build small arrays, closures and cache-key strings per frame, so do not copy those patterns.
- **No blur or alpha gradients inside `#screen`.** Soft light only via 7-step palette ramps + Bayer dither. Glow only via `render/bloom.js` into `#bloom`.
- **Palette keys only.** Colours are single-character keys into `PAL`/`U32` (`core/palette.js`); no free hex colours in drawing code.
- **Effects escalate with rarity** and never appear below their tier (`RAR[i]` in `data/armor.js`). Particle counts are multiplied by `DN()` so the governor can trim them.
- **Physics on world time, UI on real time.** `sim.js` uses `dt` (slow-mo scaled); UI timers use `rdt` / `later()`.
- **Live bindings.** Modules share state through ES imports. A module may reassign only bindings it declares, through its own functions (`layout()`, `resetBag()`, `resetCracks()`, the scene build). State another module must reassign lives in a container object: `S` (`game/state.js`) or `SCN` (`scene/scene.js`). Otherwise mutate in place (arrays/objects).
- **Timers use `later()`** (wraps `setTimeout`): the deterministic test harness replaces `setTimeout`, so anything on `requestAnimationFrame` timing or `performance.now()` alone will not be stepped in tests.
- **Determinism in tests** relies on `Math.random` being the only randomness source (plus `mulberry` streams seeded from card seeds or constants). Do not add `crypto.getRandomValues` or `Date`-seeded randomness.

`npm run lint` enforces the checkable part in `src/` (bare or `window.`/`globalThis.`-qualified): timers only through `later()`, `requestAnimationFrame` only in `game/loop.js`, no `Date`/`crypto` randomness, no hex colour literals outside `core/palette.js`, canvases only from `mk()`.

## Test hooks (`window.APP`)

`S` (state), `force(r)` (0–3 rarity, -1 random), `forceFake` (bool), `forceCard` (piece name), `step(dt)` (one tick + render), `render()`, `beginHold()` (no input source: ignored during the summon, unlike a real press, which is queued), `endHold()` (ends any hold), `leave()` (collect/dismiss), `FX`, `PERF`, `PACE`, `POOL`, `layout()` (read-only snapshot), `paused`, `noProbe`, `noR`. `window.__ready` is set at the end of `boot()`.

`tests/helpers.js#openGame` makes runs deterministic: no audio, seeded `Math.random` (LCG, seed 777), no rAF, simulated `setTimeout` clock advanced by `window.__adv(frames)` at 1/60 s.

## Golden frames

`tests/golden.spec.js` hashes `#screen` and `#bloom` at ten checkpoints (idle, charge, hitstop, legendary reveal, wall break, settled, collect, fake rare, upgrade, epic). The first seven were recorded from the original single-file game, so they prove the modular build is pixel-identical. The last three were re-recorded after a script fix: the second hold used to start while the next card was still being summoned, so it was dropped and those checkpoints were idle frames.

- A refactor must keep them passing unchanged.
- An intentional visual change: run `npm run test:golden:update`, check the change by eye in `npm run dev` (the HUD pills and `APP.forceFake` reach every tier), and commit `tests/golden/frames.json` with the change that caused it, saying why in the commit message.
- New randomness consumption (an extra `Math.random()` call anywhere before a checkpoint) shifts every later frame; that is a visual change.

## Performance tooling

`PERF` (`core/perf.js`): `base` .62 is the fixed density cut; `dq` (.35–1) is moved by the governor in `game/loop.js` from script time per frame; the compositor probe sets `bloomSkip` (and hides `#bloom`) while it measures, and keeps `bloomOff` only if hiding `#bloom` restored the frame rate. `PACE.div` renders every Nth refresh on displays of about 115 Hz and up (120→60, 144→72, 240→60); 90–110 Hz displays render every refresh.

## Sprite pipeline

`tools/sprites/extract.py` cuts the 30 pieces from the six concept sheets in `art/sheets/`: flood-fill background removal, erase rects, rotation, premultiplied area downscale to ≤50×38 plus 16 px and 10 px bag icons, median-cut colour reduction, 1 px `k` outline. Writes `src/assets/armor-atlas.png`, `src/data/armor-atlas.json` and a preview at `tools/sprites/out/preview.png`. Per-piece crop boxes, rarity and names are the `PIECES` table at the top of the script. Output is deterministic: with the pinned library versions, re-running on unchanged sheets must produce identical files (CI checks this). Install with `pip install -r tools/sprites/requirements.txt -c tools/sprites/constraints.txt` (verified on Python 3.11).

## Publishing

Live artifact: https://claude.ai/artifact/8HDrep1914chbqv6oSGF8w. To update it: `npm run build`, then publish `dist/artifact.html` to that URL with the Artifact tool (same URL keeps the link). The artifact host adds the doctype/head/body skeleton, which is why `scripts/export-artifact.mjs` strips them; the file must start with `<title>`.

## Style

Prettier (`printWidth` 120, single quotes). Each module opens with a `/** … */` block stating its responsibility; keep it accurate when moving code. Design constraints are in `docs/DESIGN.md`.
