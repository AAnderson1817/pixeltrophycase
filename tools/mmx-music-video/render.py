"""Mega Man X — "Opening Stage" music video renderer (beat-synced cut of emulator footage)."""
import sys, json, numpy as np
from PIL import Image
sys.path.insert(0, '/tmp/claude-0/-home-user-pixeltrophycase/416eb1b9-85f1-5892-8318-d0d79128932f/scratchpad/mv')
from mvlib import *

FPS = 60
GAME_FPS = 60.0988
tl = json.load(open(S + '/out/timeline.json'))
COLD, PER, PH, NBEATS = tl['cold'], tl['per'], tl['phase'], tl['nbeats']
BEAT0 = COLD + PH - PER          # time of beat 0 (music onset)
def bt(b): return BEAT0 + b * PER  # beat index -> seconds
TOTAL = bt(NBEATS)
PREVIEW = float(sys.argv[2]) if len(sys.argv) > 2 else None

ATT = S + '/out/attract.mkv'
RUN = S + '/out/intro_run.mkv' if len(sys.argv) < 2 else sys.argv[1]

# ---------------------------------------------------------------- shot list
# (t_start, t_end, source, frame_start, speed, style, opts)
# style: 'cover' (8x crop, opts cx/cy pan), 'pillar' (5x crop centered), 'box' (4x on blurred bg)
shots = []
def add(t0, t1, src, f0, speed=1.0, style='cover', **o): shots.append(dict(t0=t0, t1=t1, src=src, f0=f0, speed=speed, style=style, o=o))
def addb(b0, b1, src, f0, speed=1.0, style='cover', **o):
    if src == RUN and style == 'cover' and o.get('cx', 0.0) == 0.0: o['cx'] = 1.0
    add(bt(b0), bt(b1), src, f0, speed, style, **o)

# cold open (seconds)
add(0.0, 2.6, ATT, 1176, 4.0, 'box', crt=True, tint=(0.8, 1.0, 0.85))
add(2.6, 4.4, ATT, 1950, 2.0, 'cover', cx=0.15, cy=0.55, crt=True)
add(4.4, 6.4, ATT, 3264, 4.0, 'box', crt=True)
add(6.4, 7.55, ATT, 2976, 1.0, 'cover', cx=0.2, cy=0.5, split=6, crt=True)
add(7.55, COLD, ATT, 7380, 1.0, 'pillar', stutter=True, glitch=True)
# loop 1 ------------------------------------------------------------- (beats 0..127)
addb(0, 8, ATT, 7400, 1.0, 'pillar', flash=1.0)                       # logo slam
addb(8, 16, RUN, 560, 1.0, 'cover', cx=0.0, cy=0.2, cy2=0.45)         # READY + teleport in
addb(16, 20, RUN, 720, 1.0, 'cover', cx=0.0, cy=0.45)
addb(20, 24, RUN, 800, 1.0, 'cover', cx=0.2, cy=0.4)
addb(24, 28, RUN, 880, 1.0, 'cover', cx=0.0, cy=0.45)
addb(28, 32, RUN, 960, 1.0, 'pillar')
addb(32, 34, RUN, 1040, 1.0, 'cover', cx=0.0, cy=0.45)
addb(34, 36, ATT, 8700, 1.0, 'cover', cx=0.0, cy=0.4)
addb(36, 38, RUN, 1100, 1.0, 'cover', cx=0.2, cy=0.45)
addb(38, 40, ATT, 8940, 1.0, 'cover', cx=0.0, cy=0.5)
addb(40, 42, RUN, 1160, 1.0, 'cover', cx=0.1, cy=0.45)
addb(42, 44, ATT, 9100, 1.0, 'cover', cx=0.3, cy=0.5)
addb(44, 46, RUN, 1220, 1.0, 'cover', cx=0.0, cy=0.45)
addb(46, 48, ATT, 9250, 1.0, 'cover', cx=0.0, cy=0.5)
addb(48, 52, ATT, 9930, 1.0, 'pillar')
addb(52, 56, ATT, 10920, 1.0, 'cover', cx=0.0, cy=0.6)
addb(56, 60, ATT, 11370, 1.0, 'cover', cx=0.5, cy=0.5)
addb(60, 64, ATT, 11730, 1.0, 'box')
addb(64, 72, RUN, 1300, 1.0, 'cover', cx=0.0, cy=0.45, cy2=0.3)
addb(72, 76, RUN, 1500, 1.0, 'cover', cx=0.2, cy=0.4)
addb(76, 80, RUN, 1620, 1.0, 'pillar')
addb(80, 84, RUN, 1740, 1.0, 'cover', cx=0.0, cy=0.45)
addb(84, 88, RUN, 1860, 1.0, 'cover', cx=0.3, cy=0.4)
addb(88, 92, RUN, 1980, 1.0, 'box')
addb(92, 96, RUN, 2100, 1.0, 'cover', cx=0.0, cy=0.45)
# spec-screen stutter edit, 1 beat each
spec_frames = [2148, 2328, 2508, 2616, 2724, 2976, 3084, 2112]
for i, f in enumerate(spec_frames):
    addb(96 + i, 97 + i, ATT, f, 1.0, 'cover', cx=0.15 if i % 2 == 0 else 0.6, cy=0.5, split=3)
addb(104, 108, ATT, 2076, 2.0, 'cover', cx=0.12, cy=0.5, cy2=0.3)
addb(108, 112, ATT, 2976, 1.0, 'box')
# title / menu quick cuts
quick = [(ATT, 7400, 'pillar'), (ATT, 15960, 'box'), (ATT, 8490, 'pillar'), (ATT, 16230, 'box'),
         (ATT, 7410, 'pillar'), (ATT, 16410, 'box'), (ATT, 8580, 'pillar'), (ATT, 16500, 'box'),
         (RUN, 1000, 'cover'), (ATT, 12360, 'cover'), (RUN, 1120, 'cover'), (ATT, 13170, 'cover'),
         (RUN, 900, 'cover'), (ATT, 11100, 'cover'), (RUN, 1180, 'cover'), (ATT, 7400, 'pillar')]
for i, (src, f, st) in enumerate(quick):
    addb(112 + i, 113 + i, src, f, 1.0, st, cx=0.0, cy=0.45, split=2 if i % 4 == 3 else 0)
# loop 2 ------------------------------------------------------------- (beats 128..255)
addb(128, 136, RUN, 2200, 1.0, 'cover', cx=0.0, cy=0.45, flash=1.0)
addb(136, 140, RUN, 2400, 1.0, 'cover', cx=0.3, cy=0.4)
addb(140, 144, RUN, 2520, 1.0, 'pillar')
addb(144, 148, RUN, 2640, 1.0, 'cover', cx=0.0, cy=0.45)
addb(148, 152, RUN, 2760, 1.0, 'cover', cx=0.2, cy=0.5)
addb(152, 156, RUN, 2880, 1.0, 'box')
addb(156, 160, RUN, 3000, 1.0, 'cover', cx=0.0, cy=0.45)
addb(160, 168, ATT, 12900, 1.0, 'cover', cx=0.0, cy=0.5, cy2=0.6)   # mine cart ride
addb(168, 176, ATT, 15000, 1.0, 'pillar')                            # drill tank
addb(176, 180, ATT, 13710, 1.0, 'cover', cx=0.6, cy=0.3)
addb(180, 184, ATT, 15420, 1.0, 'cover', cx=0.3, cy=0.6)
addb(184, 188, ATT, 14880, 1.0, 'box')
addb(188, 192, ATT, 16590, 1.0, 'cover', cx=0.0, cy=0.6)
inter = [(RUN, 3120), (ATT, 17850), (RUN, 3180), (ATT, 13260), (RUN, 3240), (ATT, 17130), (RUN, 3300), (ATT, 16860),
         (RUN, 3360), (ATT, 17400), (RUN, 3420), (ATT, 12540), (RUN, 3480), (ATT, 18030), (RUN, 3540), (ATT, 15600)]
for i, (src, f) in enumerate(inter):
    addb(192 + 2 * i, 194 + 2 * i, src, f, 1.0, 'cover', cx=0.0 if src == RUN else 0.3, cy=0.45)
mont = [(ATT, 15960, 'box'), (RUN, 3600, 'cover'), (ATT, 16050, 'box'), (RUN, 3640, 'cover'), (ATT, 16140, 'box'), (RUN, 3680, 'cover'),
        (ATT, 16230, 'box'), (RUN, 3720, 'cover'), (ATT, 9930, 'cover'), (ATT, 11460, 'cover'), (ATT, 12180, 'cover'), (ATT, 13080, 'cover'),
        (ATT, 14430, 'cover'), (ATT, 15240, 'cover'), (ATT, 16680, 'cover'), (ATT, 17220, 'cover'),
        (RUN, 3760, 'cover'), (ATT, 7410, 'pillar'), (RUN, 3800, 'cover'), (ATT, 7410, 'pillar'), (RUN, 3840, 'cover'), (ATT, 7410, 'pillar'),
        (RUN, 3880, 'cover'), (ATT, 7410, 'pillar'), (RUN, 3920, 'cover'), (RUN, 3940, 'cover'), (RUN, 3960, 'cover'), (RUN, 3980, 'cover'),
        (ATT, 2112, 'cover'), (ATT, 2508, 'cover'), (ATT, 2976, 'cover'), (ATT, 7400, 'pillar')]
for i, (src, f, st) in enumerate(mont):
    addb(224 + i, 225 + i, src, f, 1.0, st, cx=0.0, cy=0.45, split=3 if i >= 24 else 0, glitch=(i >= 28))
# loop 3 ------------------------------------------------------------- (beats 256..383)
addb(256, 264, RUN, 3230, 1.0, 'cover', cx=0.0, cy=0.3, flash=1.0)
addb(264, 268, RUN, 4000, 1.0, 'pillar')
addb(268, 272, RUN, 4320, 1.0, 'cover', cx=0.2, cy=0.4)
addb(272, 276, RUN, 4440, 0.5, 'cover', cx=0.0, cy=0.3)              # slow-mo
addb(276, 280, RUN, 4560, 1.0, 'cover', cx=0.0, cy=0.45)
addb(280, 284, RUN, 4680, 1.0, 'box')
addb(284, 288, RUN, 4800, 1.0, 'cover', cx=0.3, cy=0.45)
addb(288, 296, RUN, 4920, 1.0, 'cover', cx=0.0, cy=0.5, cy2=0.2)
addb(296, 300, RUN, 5160, 1.0, 'pillar')
addb(300, 304, RUN, 5280, 1.0, 'cover', cx=0.0, cy=0.45)
addb(304, 308, RUN, 5400, 0.5, 'cover', cx=0.2, cy=0.3)
addb(308, 312, RUN, 5520, 1.0, 'cover', cx=0.0, cy=0.45)
addb(312, 320, RUN, 5640, 1.0, 'pillar')
fast = []
for i in range(32):
    fast.append((RUN, 3400 + i * 80, 'cover') if i % 2 == 0 else (ATT, [9930, 10920, 11370, 11730, 12900, 13710, 15000, 15420, 16590, 17130, 17850, 18030, 12360, 13170, 11100, 14430][i // 2], 'cover'))
for i, (src, f, st) in enumerate(fast):
    addb(320 + i, 321 + i, src, f, 1.0, st, cx=0.0, cy=0.45, split=2 if i % 2 else 0)
addb(352, 356, RUN, 5100, 1.0, 'cover', cx=0.0, cy=0.3, flash=1.0)
addb(356, 360, RUN, 5300, 1.0, 'cover', cx=0.3, cy=0.3)
addb(360, 368, RUN, 5700, 1.0, 'pillar')
addb(368, 372, ATT, 7400, 1.0, 'pillar', flash=1.0)
addb(372, 376, ATT, 7410, 1.0, 'pillar')
addb(376, 384, RUN, 5500, 1.0, 'box')
addb(384, NBEATS, ATT, 2800, 1.0, 'box', fadeout=True)               # end card: X idle

shots.sort(key=lambda s: s['t0'])

# ---------------------------------------------------------------- clip cache
clips = {}
def need(src, f0, n):
    key = (src, f0)
    if key not in clips:
        clips[key] = load_clip(src, f0, f0 + n)
    return clips[key]
for s in shots:
    n = int((s['t1'] - s['t0']) * GAME_FPS * s['speed']) + 4
    s['clip'] = need(s['src'], s['f0'], n)
print('clips loaded', len(clips), file=sys.stderr)

# ---------------------------------------------------------------- text layers
card = text_layer([('MEGA MAN X', (255, 255, 255), 88), ('"Opening Stage"', (255, 255, 255), 58),
                   ('Mega Man X  ·  Super Nintendo', (215, 215, 215), 40), ('Capcom  ·  1993', (215, 215, 215), 40)],
                  FONT_BOLD, 48, (120, 700), spacing=12)
# accent bar for the card
from PIL import ImageDraw
d = ImageDraw.Draw(card); d.rectangle([84, 700, 98, 990], fill=(60, 140, 255, 255))
endcard = text_layer([('MEGA MAN X', (255, 255, 255), 90), ('"Opening Stage"', (255, 255, 255), 54), ('from the Super Nintendo ROM, 1993', (200, 200, 200), 34)],
                     FONT_BOLD, 48, (960, 790), spacing=12, align='center')

def card_alpha(t):
    a = 0.0
    for (ta, tb) in [(bt(16), bt(40)), (bt(376), TOTAL - 0.5)]:
        if ta <= t <= tb:
            a = min(1.0, (t - ta) / 0.5, (tb - t) / 0.5)
    return max(0.0, a)

# ---------------------------------------------------------------- render
rng = np.random.default_rng(7)
out = sys.argv[3] if len(sys.argv) > 3 else S + '/out/megaman_x_opening_stage.mp4'
w = Writer(out, S + '/out/master.wav', FPS)
nframes = int(((PREVIEW if PREVIEW else TOTAL)) * FPS)
si = 0
beat_times = np.array([bt(b) for b in range(NBEATS + 1)])
for fi in range(nframes):
    t = fi / FPS
    while si + 1 < len(shots) and t >= shots[si + 1]['t0']: si += 1
    s = shots[si]; o = s['o']
    local = t - s['t0']; frac = local / max(1e-6, s['t1'] - s['t0'])
    idx = int(local * GAME_FPS * s['speed'])
    if o.get('stutter'):
        idx = int(local * GAME_FPS * 10) % 14
    clip = s['clip']; idx = min(idx, len(clip) - 1)
    img = clip[idx]
    st = s['style']
    if st == 'cover':
        cy = o.get('cy', 0.5); cy2 = o.get('cy2', None)
        if cy2 is not None: cy = cy + (cy2 - cy) * frac
        frame = cover(img, 8, o.get('cx', 0.5), cy).astype(np.float32)
    elif st == 'pillar':
        big = up(img, 5)[20:20 + H]  # 1280x1080
        small = Image.fromarray(img).resize((48, 42), Image.BILINEAR).resize((W, H), Image.BILINEAR)
        frame = np.asarray(small).astype(np.float32) * 0.22
        frame[:, 320:320 + 1280] = big
    else:
        frame = boxed(img, 4).astype(np.float32)
    if o.get('tint'):
        frame *= np.array(o['tint'], np.float32)
    # beat pulse (brightness) and bar flash
    if t >= BEAT0:
        b = (t - BEAT0) / PER; bi = int(b); phase = b - bi
        pulse = max(0.0, 1.0 - phase * 6)             # 1 at the beat, decays over ~1/6 beat
        gain = 1.0 + 0.06 * pulse + (0.10 * pulse if bi % 4 == 0 else 0)
        frame *= gain
    # shot-level effects
    if o.get('split') and local < 0.25:
        frame = rgb_split(frame, int(o['split'] * 3 * (1 - local / 0.25)) + 1)
    if o.get('glitch') and (local < 0.2 or o.get('stutter')):
        frame = glitch_rows(frame, rng, n=5, maxshift=160)
    if o.get('flash'):
        k = max(0.0, 1.0 - local / 0.22)
        frame = frame * (1 - k) + 255 * k * o['flash']
    if o.get('crt'):
        frame = scanlines(frame, 0.35)
    else:
        frame = scanlines(frame, 0.12)
    frame *= VIG
    # cold-open flicker
    if t < COLD:
        frame *= 0.85 + 0.15 * rng.random()
    ca = card_alpha(t)
    if ca > 0:
        frame = blend_layer(frame, card if t < bt(200) else endcard, ca)
    if o.get('fadeout'):
        frame *= max(0.0, min(1.0, (TOTAL - t) / 2.0))
    # global fade in at very start
    if t < 0.4: frame *= t / 0.4
    w.write(frame)
    if fi % 600 == 0: print(f'frame {fi}/{nframes} t={t:.1f}', file=sys.stderr)
w.close()
print('done', out, file=sys.stderr)
