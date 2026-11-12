import sys
from relicq import RQ
from pick import stats, by_subject, subjects
def rcands(name, n=10, used=set()):
    out, seen = [], set()
    for qi, q in enumerate(RQ.get(name, [])):
        for s in subjects:
            if (s == q[1:]) if q.startswith('=') else (s == q or s.startswith(q)):
                for r in by_subject[s]:
                    k = (r[0], r[1])
                    if k in used or k in seen: continue
                    seen.add(k)
                    im, cov, cols, hue, satr, dark = stats(r)
                    sc = -qi * 1.2 - abs(cov - 0.45) * 4 - max(0, cols - 24) * 0.05 + min(dark, .3) * 3 + min(satr, .6)
                    out.append((sc, r))
    out.sort(key=lambda x: -x[0])
    return [r for _, r in out[:n]]
if __name__ == '__main__':
    from PIL import Image, ImageDraw
    names = [k for k, v in RQ.items() if v]; part = int(sys.argv[1]); per = 16
    chunk = sys.argv[2].split(',') if len(sys.argv) > 2 else names[part*per:(part+1)*per]; T = 48; pad = 6; lw = 150; N = 10
    sh = Image.new('RGBA', (lw + N*(T+pad), len(chunk)*(T+pad)+pad), (40, 32, 26, 255)); d = ImageDraw.Draw(sh)
    for i, nm in enumerate(chunk):
        y = pad + i*(T+pad); d.text((6, y+16), f'{i}:{nm}', fill=(240, 230, 210))
        for j, r in enumerate(rcands(nm, N)):
            sh.alpha_composite(stats(r)[0].resize((T, T), Image.NEAREST), (lw + j*(T+pad), y)); d.text((lw + j*(T+pad)+2, y+36), str(j), fill=(255,255,0))
    sh.save(f'/home/claude/scratch/shots/rel-{part}.png')
