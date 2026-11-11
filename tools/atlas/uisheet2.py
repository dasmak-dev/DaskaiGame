import sys
from PIL import Image, ImageDraw
from uipick import ucands
from pick import stats
names = sys.argv[1].split(','); T=48; pad=6; lw=130; N=10
sh = Image.new('RGBA', (lw+N*(T+pad), len(names)*(T+pad)+pad), (40,32,26,255)); d = ImageDraw.Draw(sh)
for i, nm in enumerate(names):
    y = pad+i*(T+pad); d.text((6,y+16), f'{nm}', fill=(240,230,210))
    for j, r in enumerate(ucands(nm, N)): sh.alpha_composite(stats(r)[0].resize((T,T), Image.NEAREST), (lw+j*(T+pad), y))
sh.save('/tmp/ui-fix.png')
