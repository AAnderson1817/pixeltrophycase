"""Cut armor pieces out of the concept sheets and turn them into game sprites.

For each piece: crop -> remove the white sheet background (flood fill from the crop border) -> keep the piece's
connected component(s) -> optional rotation -> premultiplied area downscale to the card size (and 16/10 px icons)
-> binary alpha -> colour-reduce -> 1px near-black outline (the game's 'k'). Everything is packed into one PNG atlas.
"""
import json
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'sheets') + os.sep
FILES = {'solar': 'solar.png', 'eclipse': 'eclipse.jpg', 'anubis': 'anubis.jpg',
         'quetzal': 'quetzal.jpg', 'lunar': 'lunar.jpg', 'tidal': 'tidal.jpg'}
ATLAS_PNG = os.path.join(ROOT, 'src', 'assets', 'armor-atlas.png')
ATLAS_JSON = os.path.join(ROOT, 'src', 'data', 'armor-atlas.json')
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), 'out')
SETS = ['solar', 'eclipse', 'anubis', 'quetzal', 'lunar', 'tidal']
OUTLINE = (7, 6, 15)

# rarity: 0 common, 1 rare, 2 epic, 3 legendary.  box = (x0,y0,x1,y1) in sheet pixels.
# keep: 'largest' | 'all' | int (n largest components).  rot: degrees counter-clockwise.
PIECES = [
  # SOLAR (crimson sun)
  dict(set='solar', r=0, name='SOLAR BOOTS',  box=(1252, 500, 1380, 632), keep='largest'),
  dict(set='solar', r=0, name='SUN GAUNTLET', box=(18, 738, 142, 932), keep='largest'),
  dict(set='solar', r=1, name='SUN SCEPTER',  box=(1098, 665, 1232, 995), keep='largest', rot=-40),
  dict(set='solar', r=2, name='HALO HELM',    box=(8, 72, 298, 368), keep='all'),
  dict(set='solar', r=3, name='SUN CUIRASS',  box=(318, 78, 542, 352), keep='largest'),
  # ECLIPSE (celestial raven)
  dict(set='eclipse', r=0, name='RAVEN BOOTS',  box=(143, 362, 288, 578), keep='largest'),
  dict(set='eclipse', r=0, name='STAR GREAVES', box=(648, 182, 875, 580), keep=2),
  dict(set='eclipse', r=1, name='NIGHT BLADE',  box=(252, 185, 350, 568), keep='largest', rot=-40),
  dict(set='eclipse', r=2, name='ECLIPSE HELM', box=(168, 12, 318, 182), keep='largest'),
  dict(set='eclipse', r=3, name='ECLIPSE MAIL', box=(330, 8, 642, 305), keep='largest', cut=True),
  # ANUBIS (turquoise jackal)
  dict(set='anubis', r=0, name='DUAT GREAVES', box=(1058, 540, 1288, 1004), keep='largest'),
  dict(set='anubis', r=0, name='SCARAB CREST', box=(302, 15, 558, 388), keep='largest'),
  dict(set='anubis', r=1, name='JACKAL AXE',   box=(448, 345, 608, 1008), keep='largest', rot=-40),
  dict(set='anubis', r=2, name='ANUBIS HELM',  box=(1092, 262, 1288, 528), keep='largest'),
  dict(set='anubis', r=3, name='DUAT MANTLE',  box=(548, 0, 1122, 470), keep='largest', cut=True),
  # QUETZAL (feathered)
  dict(set='quetzal', r=0, name='PLUME BOOTS',   box=(192, 522, 508, 990), keep='largest'),
  dict(set='quetzal', r=0, name='FEATHER WARD',  box=(488, 588, 634, 958), keep='largest'),
  dict(set='quetzal', r=1, name='SUN TOTEM',     box=(1118, 572, 1308, 978), keep='largest', rot=-30),
  dict(set='quetzal', r=2, name='EAGLE HELM',    box=(712, 2, 1012, 246), keep='all', erase=[(700, 182, 818, 260), (938, 182, 1030, 260)]),
  dict(set='quetzal', r=3, name='QUETZAL WINGS', box=(0, 0, 1792, 1010), keep='largest', sat=1.35),
  # LUNAR (silver moon)
  dict(set='lunar', r=0, name='MOON BOOTS',  box=(278, 336, 498, 998), keep='largest'),
  dict(set='lunar', r=0, name='WOLF MASK',   box=(1252, 22, 1502, 308), keep='largest'),
  dict(set='lunar', r=1, name='MOON SCYTHE', box=(1098, 410, 1290, 975), keep='largest'),
  dict(set='lunar', r=2, name='LUNAR HELM',  box=(502, 26, 664, 294), keep='largest'),
  dict(set='lunar', r=3, name='LUNAR ROBE',  box=(600, 0, 1132, 560), keep='largest', cut=True),
  # TIDAL (ocean)
  dict(set='tidal', r=0, name='TIDE GREAVES', box=(248, 272, 508, 998), keep='largest'),
  dict(set='tidal', r=0, name='OSPREY GUARD', box=(262, 22, 503, 258), keep='largest'),
  dict(set='tidal', r=1, name='WAVE SHIELD',  box=(468, 586, 634, 930), keep='largest'),
  dict(set='tidal', r=2, name='TIDE HELM',    box=(1092, 12, 1263, 308), keep='largest'),
  dict(set='tidal', r=3, name='TIDAL PLATE',  box=(608, 0, 1066, 565), keep='largest', cut=True),
]

CARD = (48, 36)       # content box on the card (outline adds 1px each side)
ICON16 = (14, 14)
ICON10 = (8, 8)
_sheets = {}

def sheet(s):
    if s not in _sheets: _sheets[s] = np.asarray(Image.open(SRC + FILES[s]).convert('RGB')).astype(np.int16)
    return _sheets[s]

def cutout(p):
    a = sheet(p['set']); x0, y0, x1, y1 = p['box']; c = a[y0:y1, x0:x1]
    mx, mn = c.max(2), c.min(2); lum = c.mean(2)
    bgish = (mn >= 205) & ((mx - mn) <= 34)          # near-white, low saturation
    lab, _ = ndimage.label(bgish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # enclosed pockets of sheet-white (e.g. inside a halo ring) are background too, if they are pure white and not tiny
    pure = (mn >= 244) & ((mx - mn) <= 14)
    lab_p, npure = ndimage.label(pure)
    if npure:
        ps = ndimage.sum(pure, lab_p, range(1, npure + 1))
        big = [i + 1 for i, v in enumerate(ps) if v >= 0.004 * pure.size]
        bg |= ndimage.binary_dilation(np.isin(lab_p, big), iterations=2) & bgish
    fg = ~bg
    for ex0, ey0, ex1, ey1 in p.get('erase', []):   # sheet-space rectangles to drop (neighbouring parts)
        fg[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = False
    fg = ndimage.binary_opening(fg, iterations=1)
    fg = ndimage.binary_erosion(fg, iterations=1)      # trims the light JPEG halo
    lab2, n = ndimage.label(fg)
    if n == 0: raise SystemExit('empty ' + p['name'])
    sizes = ndimage.sum(fg, lab2, range(1, n + 1)); order = np.argsort(sizes)[::-1]
    keep = p.get('keep', 'largest')
    if keep == 'all': ids = [i + 1 for i in order if sizes[i] > sizes[order[0]] * 0.01]
    elif keep == 'largest': ids = [order[0] + 1]
    else: ids = [i + 1 for i in order[:keep]]
    fg = np.isin(lab2, ids)
    fg = ndimage.binary_fill_holes(fg) if p.get('fill') else fg
    rgba = np.zeros(c.shape[:2] + (4,), np.uint8); rgba[..., :3] = np.clip(c, 0, 255); rgba[..., 3] = fg * 255
    im = Image.fromarray(rgba, 'RGBA')
    if p.get('rot'): im = im.rotate(p['rot'], resample=Image.BICUBIC, expand=True)
    bb = im.getbbox(); im = im.crop(bb)
    return im

def shrink(im, box, colors, sat=1.12):
    w, h = im.size; k = min(box[0] / w, box[1] / h); tw, th = max(1, round(w * k)), max(1, round(h * k))
    small = im.convert('RGBa').resize((tw, th), Image.BOX).convert('RGBA')
    a = np.asarray(small).astype(np.float32)
    alpha = a[..., 3] >= 110
    rgb = a[..., :3]
    # small downscales average away contrast; restore a little saturation
    g = rgb.mean(2, keepdims=True); rgb = np.clip(g + (rgb - g) * sat, 0, 255)
    # colour reduction on the opaque pixels only
    pix = rgb[alpha].reshape(-1, 1, 3).astype(np.uint8)
    if len(pix):
        q = Image.fromarray(pix, 'RGB').quantize(colors=min(colors, len(pix)), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        rgb2 = rgb.copy(); rgb2[alpha] = np.asarray(q).reshape(-1, 3); rgb = rgb2
    out = np.zeros((th + 2, tw + 2, 4), np.uint8)
    out[1:-1, 1:-1, :3] = rgb.astype(np.uint8); out[1:-1, 1:-1, 3] = alpha * 255
    m = out[..., 3] > 0
    ring = ndimage.binary_dilation(m, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~m
    out[ring, :3] = OUTLINE; out[ring, 3] = 255
    # darken the art pixels touching the outline slightly? no: keep the source shading intact
    return Image.fromarray(out, 'RGBA')

def build(preview=True):
    cards, i16, i10 = [], [], []
    for p in PIECES:
        im = cutout(p)
        sp = p.get('sat', 1.12); cards.append(shrink(im, CARD, 24, sp)); i16.append(shrink(im, ICON16, 14, sp + .06)); i10.append(shrink(im, ICON10, 10, sp + .1))
    # atlas: 6 cols of 44x38 cells, then icons16 (15 per row), then icons10 (30 in a row)
    CW, CH = CARD[0] + 2, CARD[1] + 2
    W = max(5 * CW, 15 * 16, 30 * 10); H = 6 * CH + 2 * 16 + 10
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = []
    for k, p in enumerate(PIECES):
        c = cards[k]; cx, cy = (k % 5) * CW, (k // 5) * CH; atlas.paste(c, (cx, cy))
        a16 = i16[k]; x16, y16 = (k % 15) * 16, 6 * CH + (k // 15) * 16; atlas.paste(a16, (x16 + (16 - a16.width) // 2, y16 + (16 - a16.height) // 2))
        a10 = i10[k]; x10, y10 = k * 10, 6 * CH + 32; atlas.paste(a10, (x10 + (10 - a10.width) // 2, y10 + (10 - a10.height) // 2))
        meta.append(dict(set=SETS.index(p['set']), r=p['r'], name=p['name'], c=[cx, cy, c.width, c.height], i16=[x16, y16], i10=[x10, y10]))
    atlas.save(ATLAS_PNG, optimize=True)
    with open(ATLAS_JSON, 'w') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps(m, separators=(', ', ': ')) for m in meta) + '\n]\n')
    if preview:
        bgc = (30, 26, 60, 255)
        sheetw = max(5 * (CW * 4 + 8), 30 * 34 + 8); sheeth = 6 * (CH * 4 + 8) + 60
        pv = Image.new('RGBA', (sheetw, sheeth), bgc)
        for k in range(len(PIECES)):
            c = cards[k].resize((cards[k].width * 4, cards[k].height * 4), Image.NEAREST)
            pv.alpha_composite(c, ((k % 5) * (CW * 4 + 8) + 4, (k // 5) * (CH * 4 + 8) + 4))
        for k in range(len(PIECES)):
            c = i16[k].resize((i16[k].width * 2, i16[k].height * 2), Image.NEAREST)
            pv.alpha_composite(c, (4 + k * 34, 6 * (CH * 4 + 8) + 4))
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        pv.convert('RGB').save(os.path.join(PREVIEW_DIR, 'preview.png'))
    return meta

if __name__ == '__main__':
    m = build()
    print(f"{len(m)} pieces -> {os.path.relpath(ATLAS_PNG, ROOT)} {Image.open(ATLAS_PNG).size}, "
          f"{os.path.relpath(ATLAS_JSON, ROOT)}; preview in {os.path.relpath(PREVIEW_DIR, ROOT)}/preview.png")
