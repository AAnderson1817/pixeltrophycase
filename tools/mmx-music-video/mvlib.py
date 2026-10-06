"""Compositor helpers for the Mega Man X music video."""
import subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont

S = '/tmp/claude-0/-home-user-pixeltrophycase/416eb1b9-85f1-5892-8318-d0d79128932f/scratchpad'
W, H = 1920, 1080
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

_raw = {}
def load_clip(mkv, f0, f1):
    """Frames f0..f1 inclusive as (n,224,256,3) uint8; uses a sibling .raw memmap when present."""
    import os
    raw = mkv.rsplit('.', 1)[0] + '.raw'
    if os.path.exists(raw):
        if raw not in _raw:
            _raw[raw] = np.memmap(raw, dtype=np.uint8, mode='r').reshape(-1, 224, 256, 3)
        m = _raw[raw]
        return np.array(m[min(f0, len(m) - 1):min(f1 + 1, len(m))])
    p = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mkv, '-vf', f'select=between(n\\,{f0}\\,{f1})',
                        '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, 224, 256, 3)

def up(img, k):
    return np.repeat(np.repeat(img, k, axis=0), k, axis=1)

_blur_cache = {}
def cover(img, k=8, cx=0.5, cy=0.5):
    """Nearest-upscale by k and crop a WxH window; cx, cy in 0..1 select the window position."""
    big = up(img, k)
    bh, bw = big.shape[:2]
    x0 = int(round((bw - W) * cx)); y0 = int(round((bh - H) * cy))
    x0 = max(0, min(bw - W, x0)); y0 = max(0, min(bh - H, y0))
    return big[y0:y0 + H, x0:x0 + W]

def boxed(img, k=4, bg_dim=0.25):
    """4x nearest image centered on a dark blurred cover background."""
    small = Image.fromarray(img).resize((48, 42), Image.BILINEAR).resize((W, H), Image.BILINEAR)
    bg = (np.asarray(small).astype(np.float32) * bg_dim).astype(np.uint8)
    fg = up(img, k)
    fh, fw = fg.shape[:2]
    x0 = (W - fw) // 2; y0 = (H - fh) // 2
    bg[y0:y0 + fh, x0:x0 + fw] = fg
    return bg

def scanlines(frame, strength=0.18):
    f = frame.astype(np.float32)
    f[1::4] *= (1 - strength)
    f[3::4] *= (1 - strength * 0.5)
    return f

def vignette_mask():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    return np.clip(1.15 - 0.45 * d ** 2, 0, 1)[..., None]
VIG = vignette_mask()

def rgb_split(frame, dx):
    out = frame.copy()
    out[:, :, 0] = np.roll(frame[:, :, 0], dx, axis=1)
    out[:, :, 2] = np.roll(frame[:, :, 2], -dx, axis=1)
    return out

def glitch_rows(frame, rng, n=6, maxshift=120):
    out = frame.copy()
    for _ in range(n):
        y = rng.integers(0, H - 40); h = rng.integers(6, 60); s = rng.integers(-maxshift, maxshift)
        out[y:y + h] = np.roll(frame[y:y + h], s, axis=1)
    return out

def text_layer(lines, font_path, size, pos, color=(255, 255, 255), spacing=8, align='left', shadow=True):
    """Return an RGBA PIL image WxH with the text drawn."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(font_path, size)
    x, y = pos
    for line in lines:
        if isinstance(line, tuple):
            txt, col, fsz = line
            f = ImageFont.truetype(font_path, fsz)
        else:
            txt, col, f = line, color, font
        bbox = d.textbbox((0, 0), txt, font=f)
        tw = bbox[2] - bbox[0]; th = bbox[3] - bbox[1]
        xx = x if align == 'left' else (x - tw if align == 'right' else x - tw // 2)
        if shadow:
            d.text((xx + 3, y + 3), txt, font=f, fill=(0, 0, 0, 220))
        d.text((xx, y), txt, font=f, fill=col + (255,))
        y += th + spacing
    return layer

def blend_layer(frame, layer, alpha=1.0):
    """Alpha-composite an RGBA PIL layer over an np frame with global alpha."""
    la = np.asarray(layer).astype(np.float32)
    a = la[..., 3:4] / 255.0 * alpha
    return frame * (1 - a) + la[..., :3] * a

class Writer:
    def __init__(self, path, audio, fps=60):
        self.p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                                   '-i', audio, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
                                   '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', path], stdin=subprocess.PIPE)
    def write(self, frame):
        self.p.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
    def close(self):
        self.p.stdin.close(); self.p.wait()
