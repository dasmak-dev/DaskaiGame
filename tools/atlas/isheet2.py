import sys
from PIL import Image, ImageDraw
from pick import candidates, ITEMS, stats
ids = sys.argv[1].split(','); N = 12; T = 40; pad = 5; lw = 150
sh = Image.new('RGBA', (lw + N*(T+pad), len(ids)*(T+pad)+pad), (40, 32, 26, 255)); d = ImageDraw.Draw(sh)
for i, iid in enumerate(ids):
    y = pad + i*(T+pad); it = ITEMS[iid]
    d.rectangle([4, y+4, 14, y+14], fill=it['color']); d.text((18, y+2), iid, fill=(240, 230, 210))
    for j, r in enumerate(candidates(iid, n=N)): sh.alpha_composite(stats(r)[0].resize((T, T), Image.NEAREST), (lw + j*(T+pad), y))
sh.save('/tmp/it-fix.png')
