import sys
from PIL import Image, ImageDraw
from uiqueries import UQ
from uipick import ucands
from pick import stats
names = [k for k, v in UQ.items() if v]; part = int(sys.argv[1]); per = 28
chunk = names[part*per:(part+1)*per]
T = 48; pad = 6; lw = 130; N = 10
sh = Image.new('RGBA', (lw + N*(T+pad), len(chunk)*(T+pad)+pad), (40, 32, 26, 255)); d = ImageDraw.Draw(sh)
for i, nm in enumerate(chunk):
    y = pad + i*(T+pad); d.text((6, y+16), f'{i}:{nm}', fill=(240, 230, 210))
    for j, r in enumerate(ucands(nm, N)):
        sh.alpha_composite(stats(r)[0].resize((T, T), Image.NEAREST), (lw + j*(T+pad), y))
sh.save(f'/tmp/ui-{part}.png')
print(len(names), 'iconos con búsqueda')
