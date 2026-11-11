import re, io, collections
from PIL import Image, ImageDraw
from load import load
from uiqueries import UQ
from pick import stats, rows, by_subject, subjects
def ucands(name, n=10, used=set()):
    out = []
    for qi, q in enumerate(UQ.get(name, [])):
        for s in subjects:
            if (s == q[1:]) if q.startswith('=') else (s == q or s.startswith(q)):
                for r in by_subject[s]:
                    if (r[0], r[1]) in used: continue
                    im, cov, cols, hue, satr, dark = stats(r)
                    sc = -qi * 1.5 - abs(cov - 0.42) * 4 - max(0, cols - 18) * 0.05 + min(dark, .3) * 3
                    out.append((sc, r))
    out.sort(key=lambda x: -x[0])
    return [r for _, r in out[:n]]
