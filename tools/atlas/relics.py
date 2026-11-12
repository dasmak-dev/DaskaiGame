# v5.46: genera icons/relics-px.png (iconos en color de las reliquias), docs/assets/relics-px.json (procedencia)
# y js/data/gen/relicsPx.js (posiciones + silueta para el estilo limpio).
# Uso: DASKAI_DATASET=/ruta/_dataset python3 tools/atlas/relics.py
import json, hashlib, os, re
from PIL import Image
from relicq import RQ
from relicpick import rcands
from pick import stats, ROOT
from load import F as FILES
from trace import glyph
RP = dict(piedra_afilada=9, trebol=2, bolsa_vieja=8, libro_notas=1, cantimplora=3, corteza=7, ascua_eterna=6, caracola=2, raiz_antigua=3,
          prisma_solar=3, velo_noche=3, pluma_rapida=2, cristal_eco=0, anzuelo=3, musgo_vivo=2, colmillo_rey=0, mapa_tesoro=0, caliz_vida=2,
          egida=5, cuerno_guerra=1, daga_alba=7, cristal_almas=9, ojo_cazador=9, reloj_arena=2, copa_carmesi=4, caparazon_espinas=8,
          corazon_ira=0, festin=0, sello_matarreyes=3, ultimo_aliento=3, corona_espinas=6)
assert set(RP) == set(k for k, v in RQ.items() if v), set(RP) ^ set(RQ)
F = [os.path.basename(f) for f in FILES]
ids = list(RP); COLS = 8; rows = (len(ids) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * 16, rows * 16), (0, 0, 0, 0))
meta = {'source': 'https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m', 'license': 'CC0-1.0', 'retrieved': '2026-11-10', 'tile': 16, 'cols': COLS, 'icons': {}}
glyphs, used = {}, set()
short = lambda d: re.sub(r'(\d+\.\d)\d', r'\1', d)
for i, rid in enumerate(ids):
    r = rcands(rid, 12)[RP[rid]]; used.add((r[0], r[1])); im = stats(r)[0]
    sheet.alpha_composite(im, ((i % COLS) * 16, (i // COLS) * 16))
    glyphs[rid] = short(glyph(im))
    meta['icons'][rid] = {'i': i, 'file': F[r[0]], 'row_id': r[1], 'subject': r[2], 'caption': r[3], 'sha1': hashlib.sha1(r[4]).hexdigest()[:12]}
sheet.save(os.path.join(ROOT, 'icons', 'relics-px.png'), optimize=True)
json.dump(meta, open(os.path.join(ROOT, 'docs', 'assets', 'relics-px.json'), 'w'), ensure_ascii=False, indent=1)
open(os.path.join(ROOT, 'js', 'data', 'gen', 'relicsPx.js'), 'w').write('''/* =============================================================
 * js/data/gen/relicsPx.js — GENERADO por tools/atlas/relics.py (v5.46): iconos en color de las reliquias,
 * del dataset «pixel-art-atlas-1.4m» (CC0 1.0). Procedencia: docs/assets/relics-px.json.
 *   src/cols/rows/ids → hoja icons/relics-px.png (16×16 por icono) · glyphs → silueta (viewBox 24) para el estilo limpio
 * ============================================================= */
DK.relicsPx = { src: %r, cols: %d, rows: %d, ids: %s,
  glyphs: %s };
''' % ('icons/relics-px.png?v=546', COLS, rows, json.dumps({k: v['i'] for k, v in meta['icons'].items()}, separators=(',', ':')), json.dumps(glyphs, separators=(',', ':'))))
print('reliquias:', len(ids))
