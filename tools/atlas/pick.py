import json, re, io, colorsys, collections
from PIL import Image, ImageDraw, ImageFont
from load import load
from queries import Q
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ITEMS = json.load(open(os.path.join(ROOT, 'data', 'items.json')))
rows = load()
def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i+2], 16) / 255 for i in (0, 2, 4))
_stats = {}
def stats(r):
    k = (r[0], r[1])
    if k in _stats: return _stats[k]
    im = Image.open(io.BytesIO(r[4])).convert('RGBA'); px = list(im.getdata())
    op = [p for p in px if p[3] > 128]
    cov = len(op) / 256
    cols = len(set(op))
    sat = [p for p in op if max(p[:3]) - min(p[:3]) > 40 and max(p[:3]) > 60]
    if sat:
        # tono medio (vector) de los píxeles con color
        import math
        x = y = 0
        for p in sat:
            h, l, s = colorsys.rgb_to_hls(p[0]/255, p[1]/255, p[2]/255); x += math.cos(h*2*math.pi); y += math.sin(h*2*math.pi)
        hue = (math.atan2(y, x) / (2*math.pi)) % 1; satr = len(sat) / max(1, len(op))
    else: hue, satr = None, 0
    dark = sum(1 for p in op if sum(p[:3]) < 150) / max(1, len(op))
    s = (im, cov, cols, hue, satr, dark); _stats[k] = s; return s
def score(r, item, qi):
    im, cov, cols, hue, satr, dark = stats(r)
    sc = -qi * 1.2
    if cov < 0.18 or cov > 0.85: sc -= 3
    else: sc -= abs(cov - 0.48) * 3
    if cols > 40: sc -= 1.5
    sc += min(dark, 0.25) * 4          # contorno oscuro
    ir, ig, ib = hx(item['color']); ih, il, isat = colorsys.rgb_to_hls(ir, ig, ib)
    if isat > 0.25 and hue is not None:
        dh = min(abs(hue - ih), 1 - abs(hue - ih)); sc += 2.5 - dh * 10 + satr
    elif isat <= 0.25: sc += 1.5 - satr * 2   # objeto grisáceo: mejor icono poco saturado
    return sc
by_subject = collections.defaultdict(list)
for r in rows: by_subject[r[2]].append(r)
subjects = list(by_subject)
def candidates(iid, n=8, used=set()):
    item = ITEMS[iid]; out = []
    for qi, q in enumerate(Q[iid]):
        rx = re.compile('^' + re.escape(q[1:]) + '$') if q.startswith('=') else re.compile(r'\b' + re.escape(q))  # '=x': tema exacto
        for s in subjects:
            if rx.search(s):
                for r in by_subject[s]:
                    if (r[0], r[1]) not in used: out.append((score(r, item, qi), r))
    out.sort(key=lambda x: -x[0])
    return [r for _, r in out[:n]]
