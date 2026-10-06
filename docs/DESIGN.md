# Design

## Constraint sheet

|             |                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FORMAT**  | 384×216 logical pixels at an integer scale filling the window, letterboxed on the page background. 60 Hz fixed step.                                                                                                                              |
| **PALETTE** | 38 fixed colours in eight ramps: space, stone, gold, crimson, teal, violet, ember, green. Every effect is a remap along a ramp (`UP`, `DN`, `UP2`, `DN2`, `HOLO`) with 4×4 Bayer coverage. No alpha, no gradients, no blur inside the framebuffer. |
| **SCENE**   | Hall of Orbits: arched window onto the nebula and the ringed giant Khhn, brick walls, banners, pillars, sconces, polished perspective floor with runner, three-step dais, the case centred and reflected in the floor.                             |
| **CASE**    | 136×122 obsidian carcass, 120×110 interior, three compartments of three slots (40 px pitch). Trophies 13×20, pedestal 4 px, lamp cone per slot.                                                                                                   |
| **MARKS**   | 1 px void outlines on every sprite. Light from the upper left. 3×5 fonts, 1 px outline on all text over the scene.                                                                                                                                 |
| **MOTION**  | Materialise by dissolve, never fade. Hitstop on every landing. One easing family (smoothstep/in-out) for mechanical motion, ease-out for falls.                                                                                                   |
| **SOUND**   | Chip voices only, through one hall delay. Off until the viewer turns it on.                                                                                                                                                                       |
| **PERF**    | Full frame in about 1.5 ms of script time in headless Chromium (software canvas); the only per-frame allocations are the two `putImageData` calls.                                                                                                |

## Geometry (logical px)

```
window        x 64..320, arch top y = 44 - 38·sqrt(1-u²)   (u = (x-192)/128), floor y 150
mullions      x 96, 287 ; transom y 84
pillars       x 52..63, 320..331 ; banners x 12..34, 349..371, y 8..99 ; sconces (43,70) (340,70)
case          x 124..260, y 24..146 ; interior x 132..252, y 32..142
compartments  tops 32, 70, 106 ; boards 68, 104, 140 ; slot centres x 152, 192, 232
seal          (192,16) r 7 ; pediment 12 rows above the case
present pose  (192,92) ; nameplate lines y 158 / 168 / 178 ; counter y 198
dais          steps y 146/150/154, half-widths 74/80/86
reflection    rows 158..215 mirror rows 304-y of the case at 7/16 coverage through DN2
planet        (296,64) r 22, ring rx 38 ry 9
```

## Phase timings

| Phase   | s    | Beats                                                                                             |
| ------- | ---- | ------------------------------------------------------------------------------------------------- |
| intro   | 1.6  | title card                                                                                        |
| summon  | 1.8  | beam 0–0.3 in, 1.35–1.8 out; dissolve 0.3–1.25; descent 0.3–1.4 (ease-out) from y 28 to 92        |
| present | 2.4  | script line types 0.15–1.0, translation 1.05–1.9; hover ±1.5 px                                   |
| open    | 0.7  | door 0→1 in-out                                                                                   |
| place   | 1.1  | bezier 0–0.85 (apex 26 px above both ends); pedestal 0.25–0.75; land at 0.85: hitstop 5 frames    |
| seal    | 0.9  | door 1→0 over 0.7; seal pulse at 0.7                                                              |
| rest    | 0.45 |                                                                                                   |
| finale  | 9.5  | fanfare at 0; confetti to 5.5; fireworks every 0.22–0.5 s to 8.4; seal pulse at 1.4 Hz; two cards |
| reset   | 3.2  | doors 0–0.8 open, 2.4–3.1 close; slot k dissolves over 0.5+0.14k .. 1.4+0.14k; dust rises         |

## Landing

`flashAll` 0.8 decaying at 3.2/s (UP2 above 0.5, UP below, coverage 14·flash); slot `flash` 1 decaying at 2.2/s;
shake 1 decaying at 4/s (±1.5 px); rings 2→22 px teal over 0.5 s and 1→12 px gold over 0.35 s; 26 gold sparks with
gravity; 30 stardust.

## Cyiurkhhn script

26 glyphs on the 3×5 grid from seed `0xc41ba5`: vowels (A E I O U Y) take a centre spine and mirrored strokes,
consonants a spine in a random column and 3–5 strokes, 40 % get a full bar. Spaces and punctuation fall back to
the Latin font so word rhythm matches the translation line beneath.
