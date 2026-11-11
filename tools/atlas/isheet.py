import sys
from PIL import Image, ImageDraw
from pick import candidates, ITEMS, stats
ids = list(ITEMS); part = int(sys.argv[1]); per = 29; N = 12
chunk = ids[part*per:(part+1)*per]
T = 40; pad = 5; lw = 150
sh = Image.new('RGBA', (lw + N*(T+pad), len(chunk)*(T+pad)+pad), (40, 32, 26, 255)); d = ImageDraw.Draw(sh)
for i, iid in enumerate(chunk):
    y = pad + i*(T+pad); it = ITEMS[iid]
    d.rectangle([4, y+4, 14, y+14], fill=it['color']); d.text((18, y+2), f"{i}:{iid}", fill=(240, 230, 210)); d.text((18, y+18), it['name'][:22], fill=(170, 150, 130))
    for j, r in enumerate(candidates(iid, n=N)):
        sh.alpha_composite(stats(r)[0].resize((T, T), Image.NEAREST), (lw + j*(T+pad), y))
sh.save(f'/tmp/it-{part}.png')
