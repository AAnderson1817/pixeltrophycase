# Design

## Constraint sheet

|             |                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FORMAT**  | One logical canvas at an integer pixel scale (at least 2×) filling the window. Card is 64×90 logical px, hovering over a stone altar.                                                                                                                                                                                                       |
| **SCENE**   | Torch-lit vault: brick wall, mode-7 tiled floor, altar, two sconces. Each brick/tile is lit per frame from the two torches, the card, its beam and the reveal rays, and quantised into 7-step palette ramps; its pixels keep fixed bevel offsets. The altar is lit per pixel with Bayer dither. No alpha gradients.                         |
| **PALETTE** | 32 fixed colours (`PAL`, single-character keys). Ramps: stone `k 0 1 2 3 5 4` · warm (torch) `k 0 d d b Y o` · silver / teal / violet / gold rarity ramps.                                                                                                                                                                                  |
| **LOOT**    | 30 armor pieces from six sets, 5 per set. Rarity by piece type. Completing a set celebrates it; completing all six celebrates the collection.                                                                                                                                                                                               |
| **MARKS**   | 1 px `k` outlines. Armor sprites cut from the concept sheets, area-downscaled to ≤50×38, colour-reduced. 3×5 bitmap font with per-row colour ramps. Square particles; 8×8 tile shards rotated nearest-neighbour; Bresenham lines. The card is drawn in pseudo-3D by column and row slices so it keeps hard pixels while it tilts and spins. |
| **LIGHT**   | Torches are warm; the card's light is its rarity colour. While holding, the room fills with the tease colour.                                                                                                                                                                                                                               |
| **RULES**   | No blur inside the canvas (bloom lives in a separate screen-blended layer). No alpha gradients. Every effect escalates with rarity and never appears below its tier. Physics on world time (slow-mo aware), UI on real time.                                                                                                                |
| **SOUND**   | Chip voices only (25% pulse, square, triangle, noise) through a short dungeon echo.                                                                                                                                                                                                                                                         |
| **PERF**    | 60 fps budget; see below.                                                                                                                                                                                                                                                                                                                   |

## Performance model

- Every offscreen canvas is CPU-backed, so nothing is read back from the GPU.
- Lighting is solved per brick/tile; only units whose quantised colour changed are repainted into one pixel buffer. Shock rings visit only their annulus.
- The card's pseudo-3D warp, rotated shards/bricks, speed lines, cracks, glitch rows and the chromatic split run in typed arrays.
- Glyphs, coins, chain links, torch halos and the art glow are cached sprites.
- Bloom: half-res threshold (contrast 2.6, brightness .72, saturate 1.3, ~7 px spread) computed in JS on a small buffer; the browser only scales and screen-blends it.
- Particle density is ~60% of the original design (`PERF.base` .62). A governor trims it further (`PERF.dq` down to .35) when script time per frame runs long, and drops the blended bloom layer only if hiding it is what restores the frame rate.
- Displays of about 115 Hz and up render every Nth refresh (120→60, 144→72, 240→60); 90–110 Hz render every refresh.

## Sets and pieces

| Set     | Colour     | Common       | Common       | Rare        | Epic         | Legendary     |
| ------- | ---------- | ------------ | ------------ | ----------- | ------------ | ------------- |
| Solar   | `y` gold   | Solar Boots  | Sun Gauntlet | Sun Scepter | Halo Helm    | Sun Cuirass   |
| Eclipse | `v` violet | Raven Boots  | Star Greaves | Night Blade | Eclipse Helm | Eclipse Mail  |
| Anubis  | `t` teal   | Duat Greaves | Scarab Crest | Jackal Axe  | Anubis Helm  | Duat Mantle   |
| Quetzal | `g` green  | Plume Boots  | Feather Ward | Sun Totem   | Eagle Helm   | Quetzal Wings |
| Lunar   | `s` silver | Moon Boots   | Wolf Mask    | Moon Scythe | Lunar Helm   | Lunar Robe    |
| Tidal   | `u` blue   | Tide Greaves | Osprey Guard | Wave Shield | Tide Helm    | Tidal Plate   |

Rarity by piece type: boots and limb pieces common, weapons and shields rare, helmets epic, chest pieces and wings legendary.

## Rarity tiers

| Tier      | Odds | Hitstop | Slow-mo after reveal | Coins | Fake-out chance                    |
| --------- | ---- | ------- | -------------------- | ----- | ---------------------------------- |
| Common    | 50%  | 0.10 s  | —                    | 0     | —                                  |
| Rare      | 28%  | 0.14 s  | —                    | 8     | —                                  |
| Epic      | 15%  | 0.20 s  | 0.30 s               | 22    | 30% (shows as Rare, then upgrades) |
| Legendary | 7%   | 0.30 s  | 0.72 s               | 60    | 45% (shows as Epic, then upgrades) |

The draw picks a tier by odds (or the forced tier from the HUD pills), then a piece uniformly within that tier. Per-tier effect settings (sparks, rays, spin, sparkle, stat-bar ranges, glow) are in `RAR` in `src/data/armor.js`.

## Card flow

1. **Entering** — the card is summoned onto the altar, chained and padlocked.
2. **Idle / charge** — hold to charge (1.6 s to full). Tease flashes at 38 / 62 / 85% charge up to the card's shown tier: the room light shifts to the tier colour, bolts and sparks escalate. Releasing early lets the charge decay; a quick tap auto-charges.
3. **Hitstop** — at full charge the lock and chains break and time freezes on the impact frame for the tier's hitstop, then the card reveals.
4. **Revealed** — the front shows the piece, rarity frame, nameplate and three stat bars. The wall behind breaks open into a void (from 1.15 s), and a stamp reads **NEW!** or the duplicate count. Tap to fidget-spin the card.
5. **Upgrading** (fake-outs only) — 2.2 s after a fake reveal the card cracks, glitches, goes through a second hitstop and re-reveals one tier higher.
6. **Collecting** — **Draw another** flies the piece into its bag slot. Completing a set triggers the set celebration; completing all 30 triggers the collection celebration.
7. Back to **Entering** with the wall rebuilt.

## Bag

Six groups of five slots, one group per set: 3 groups per row on wide screens (2 rows), 2 per row on narrow screens (3 rows). Saved in `localStorage` (`loot-pixel-armor-v1`). **Reset** asks for a second press within 3 s, then empties the collection.
