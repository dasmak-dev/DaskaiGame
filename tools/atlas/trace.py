# Convierte un sprite de 16×16 en:
#   · tones(img)  → píxeles en 4 tonos de un solo color (para el modo pixel art: fill-opacity sobre currentColor)
#   · glyph(img)  → silueta vectorial suave (modo limpio): forma rellena con los trazos interiores «tallados»,
#                   como path SVG en un viewBox de 24×24 (fill-rule evenodd)
# Sin dependencias: máscara → ampliación ×S con suavizado → marching squares → simplificación.
from PIL import Image, ImageFilter
import math

S = 10          # ampliación para trazar
VB = 24         # viewBox de los iconos del juego

def lum(p): return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255

def tones(img):
    """[(x, y, nivel 0..3)] — 3 = contorno/oscuro (opaco del todo), 0 = brillo (muy suave)."""
    px = img.load(); out = []
    ls = [lum(px[x, y]) for y in range(16) for x in range(16) if px[x, y][3] > 128]
    if not ls: return out
    lo, hi = min(ls), max(ls)
    for y in range(16):
        for x in range(16):
            p = px[x, y]
            if p[3] <= 128: continue
            t = (lum(p) - lo) / (hi - lo + 1e-6)
            out.append((x, y, 3 if t < .2 else 2 if t < .5 else 1 if t < .8 else 0))
    return out

def masks(img):
    """Máscara de la forma y de los trazos interiores (líneas oscuras que no tocan el borde)."""
    px = img.load()
    shape = [[px[x, y][3] > 128 for x in range(16)] for y in range(16)]
    ls = [lum(px[x, y]) for y in range(16) for x in range(16) if shape[y][x]]
    lo, hi = (min(ls), max(ls)) if ls else (0, 1)
    def edge(x, y):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < 16 and 0 <= ny < 16) or not shape[ny][nx]: return True
        return False
    cut = [[shape[y][x] and not edge(x, y) and (lum(px[x, y]) - lo) / (hi - lo + 1e-6) < .3 for x in range(16)] for y in range(16)]
    return shape, cut

def field(mask, blur):
    im = Image.new('L', (16, 16)); im.putdata([255 if v else 0 for row in mask for v in row])
    big = Image.new('L', (16 * S + 2 * S, 16 * S + 2 * S), 0)
    big.paste(im.resize((16 * S, 16 * S), Image.NEAREST), (S, S))
    return big.filter(ImageFilter.GaussianBlur(blur))

def march(f, thr=128):
    """Marching squares sobre una imagen L → lista de contornos cerrados (coordenadas en px de la imagen)."""
    W, H = f.size; a = f.load()
    P = {}; adj = {}
    def v(x, y): return a[x, y] if 0 <= x < W and 0 <= y < H else 0
    def interp(p1, p2, v1, v2):
        t = (thr - v1) / (v2 - v1) if v2 != v1 else .5
        return (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)
    for y in range(-1, H):
        for x in range(-1, W):
            tl, tr, br, bl = v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)
            idx = (tl >= thr) << 3 | (tr >= thr) << 2 | (br >= thr) << 1 | (bl >= thr)
            if idx in (0, 15): continue
            T = ('t', x, y); R = ('r', x, y); B = ('b', x, y); L = ('l', x, y)
            pts = {T: interp((x, y), (x + 1, y), tl, tr), R: interp((x + 1, y), (x + 1, y + 1), tr, br),
                   B: interp((x, y + 1), (x + 1, y + 1), bl, br), L: interp((x, y), (x, y + 1), tl, bl)}
            # cada caso une dos aristas de la celda (la orientación da igual: se rellena con evenodd)
            table = {1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(R, T)], 5: [(L, T), (R, B)], 6: [(B, T)], 7: [(L, T)],
                     8: [(T, L)], 9: [(T, B)], 10: [(T, R), (B, L)], 11: [(T, R)], 12: [(R, L)], 13: [(R, B)], 14: [(B, L)]}
            for e1, e2 in table[idx]:
                k1, k2 = key(e1), key(e2)
                P[k1] = pts[e1]; P[k2] = pts[e2]
                adj.setdefault(k1, []).append(k2); adj.setdefault(k2, []).append(k1)
    loops = []; seen = set()
    for start in list(adj):
        if start in seen: continue
        loop = [P[start]]; seen.add(start); prev, cur = None, start
        while True:
            nxt = [n for n in adj[cur] if n != prev and n not in seen]
            if not nxt: break
            prev, cur = cur, nxt[0]; seen.add(cur); loop.append(P[cur])
        if len(loop) > 3: loops.append(loop)
    return loops

def key(e):
    t, x, y = e
    # aristas compartidas entre celdas vecinas tienen la misma clave
    if t == 't': return ('h', x, y)
    if t == 'b': return ('h', x, y + 1)
    if t == 'l': return ('v', x, y)
    return ('v', x + 1, y)

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax = 0; idx = 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / (math.hypot(b[0] - a[0], b[1] - a[1]) + 1e-9)
        if d > dmax: dmax, idx = d, i
    if dmax > eps: return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [a, b]

def area(l): return sum(l[i][0] * l[(i + 1) % len(l)][1] - l[(i + 1) % len(l)][0] * l[i][1] for i in range(len(l))) / 2

def glyph(img, cut_lines=True):
    shape, cut = masks(img)
    fs = field(shape, S * 0.3)
    if cut_lines and any(any(r) for r in cut):
        fc = field(cut, S * 0.28)
        a = fs.load(); c = fc.load(); W, H = fs.size
        for y in range(H):
            for x in range(W):
                # se talla el trazo interior (más fino que el original para que la forma no se rompa)
                if c[x, y] > 150: a[x, y] = min(a[x, y], 255 - c[x, y])
    loops = march(fs)
    k = VB / (16 * S + 2 * S)  # el lienzo incluye un margen de 1 píxel original
    d = []
    for l in loops:
        if abs(area(l)) < (S * S) * 0.35: continue  # motas
        h = len(l) // 2  # contorno cerrado: se simplifica cada mitad
        l2 = rdp(l[:h + 1], S * 0.18)[:-1] + rdp(l[h:] + [l[0]], S * 0.18)[:-1]
        if len(l2) < 3: continue
        d.append('M' + ' '.join(f'{p[0] * k:.2f} {p[1] * k:.2f}' for p in l2) + 'Z')
    return ''.join(d)

def solid(img):
    """v5.23: versión en POSITIVO para la interfaz en pixel art: toda la forma opaca y los trazos interiores
    tallados (semitransparentes), así se lee bien en pequeño. → [(x, y, alfa 0-255)]"""
    shape, cut = masks(img); px = img.load(); out = []
    ls = [lum(px[x, y]) for y in range(16) for x in range(16) if shape[y][x]]
    lo, hi = (min(ls), max(ls)) if ls else (0, 1)
    for y in range(16):
        for x in range(16):
            if not shape[y][x]: continue
            t = (lum(px[x, y]) - lo) / (hi - lo + 1e-6)
            a = 70 if cut[y][x] else 175 if t < .42 and not (x in (0, 15) or y in (0, 15)) and _inner(shape, x, y) else 255
            out.append((x, y, a))
    return out

def _inner(shape, x, y):
    return all(0 <= x + dx < 16 and 0 <= y + dy < 16 and shape[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

def tones_svg(img):
    """SVG de 16×16 en tonos (rects agrupados por nivel)."""
    op = {3: 1, 2: .72, 1: .45, 0: .22}
    by = {}
    for x, y, t in tones(img): by.setdefault(t, []).append(f'M{x} {y}h1v1h-1z')
    return ''.join(f'<path fill-opacity="{op[t]}" d="{"".join(v)}"/>' for t, v in sorted(by.items(), reverse=True))
