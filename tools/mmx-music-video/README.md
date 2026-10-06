# Mega Man X — "Opening Stage" music video pipeline

Everything in the video is generated from the Mega Man X (SNES) ROM. No external
audio or art is used.

## How it works

1. **Headless emulator** — `rec.c` is a frontend for the LakeSnes core
   (https://github.com/elzo-d/LakeSnes). It runs the ROM with a scripted
   controller, writes raw RGB frames and PCM audio, saves/loads states, and can
   freeze the main CPU while the sound processor keeps running
   (`--apuonly N`). Freezing the CPU is how the clean, sound-effect-free music
   track was captured: the game cannot trigger sound effects while it is frozen,
   but the SPC700 keeps playing the stage theme.
   `lakesnes-voice-mute-and-apu-only.patch` is the small core patch it needs.

2. **Search-based player** — `bot.c` plays the opening highway stage with
   savestate lookahead: it tries random input macros (run, jump, wall-kick,
   shoot), scores them by progress and health read from RAM
   (`$7E0BAD` x position, `$7E0BCF` HP), commits the best one, and backtracks
   when every candidate dies. The output is an input script that `rec.c`
   replays deterministically to record the footage.

3. **Beat-synced cut** — `render.py` / `mvlib.py` build the 1080p60 video with
   numpy: nearest-neighbour upscales, beat-grid cuts (179 BPM, detected from
   the captured music), MTV-style lower third, flashes, RGB-split glitches,
   scanlines and a cold open built from the game's own intro text screens.

## Build

```
git clone https://github.com/elzo-d/LakeSnes
(cd LakeSnes && git apply ../lakesnes-voice-mute-and-apu-only.patch)
gcc -O3 -I LakeSnes/snes -o rec rec.c LakeSnes/snes/*.c -lm
gcc -O3 -I LakeSnes/snes -o bot bot.c LakeSnes/snes/*.c -lm
```
