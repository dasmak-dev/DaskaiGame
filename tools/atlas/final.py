# Elige el icono de cada objeto (índice P = posición entre sus candidatos ordenados) y genera
# icons/items-px.png, docs/assets/items-px.json (procedencia) y js/data/gen/itemsPx.js.
# Uso: python3 tools/atlas/final.py   (con los .parquet del dataset en _dataset/)
import json, hashlib
from PIL import Image
import os
from pick import candidates, ITEMS, stats, ROOT
from load import F as FILES
P = dict(
 pocion=3, superpocion=6, hiperpocion=1, eter=0, supereter=2, antidoto=4, balsamo=0, panacea=3, elixir=1, pocion_media=0,
 pocion_total=4, eter_medio=9, eter_total=1, restaurador=1, tonico_vigor=0, cristal_vinculo=11, cristal_mayor=2, baya_saber=1,
 tonico_exp=8, cristal_sabio=0, pluma_fenix=0, tonico_fuerza=4, tonico_magia=0, tonico_hierro=4, tonico_espiritu=4,
 tonico_viento=1, tonico_vida=6, tonico_mana=2, elixir_olvido=0,
 esencia_ancestral=2, garra_afilada=0, colmillo_umbrio=1, amuleto_arcano=5, orbe_solar=0, escama_dura=1, coraza_obsidiana=1,
 velo_mistico=0, pluma_veloz=0, botas_viento=3, corazon_roca=10, anillo_brasas=2, perla_marina=2, amuleto_vida=0,
 corona_celeste=1, amuleto_curativo=1, tambor_guerra=0, pluma_huracan=1, raiz_maestra=0, colmillo_vampiro=0, ascua_eterna=1,
 caracola_marea=3, prisma_juicio=0, martillo_tierra=0, corazon_musgo=4, emblema_furia=0, caparazon_viejo=1, pluma_ligera=0, cristal_vital=1,
 pendiente_arcano=3, sello_equilibrio=2, brasero_vivo=2, pelaje=4, fragmento_garra=4, escama=1, pluma=0, hilo=0, gota=1, brasa=0,
 coral=3, polvo_brillante=0, esencia_sombria=0, piedra_runica=1, obsidiana=0, nucleo_arcano=6, lagrima_estelar=2,
 fragmento_abisal=0, fragmento_vacio=0, corazon_vacio=1, filo_vacio=3, egida_vacio=0, corona_vacio=1, fragmento_forja=6,
 piedra_transmutacion=0, piedra_alteracion=0, piedra_purga=0, piedra_regia=0, piedra_caos=0,
 piedra_divina=3, esquirla_jefe=2, corazon_jefe=3, piedra_alquimia=4, piedra_aumento=1, piedra_exaltacion=1, piedra_anulacion=6,
 piedra_templado=1, sello_forja=1, eco_legendario=3, piedra_cambio=0, piedra_nucleo=3, racion_viaje=0, tiza_runica=0,
 savia_runica=4, perla_runica=1, cuarzo_eco=1, ceniza_runica=0, tinta_sagrada=0, tinta_abisal=0, escarcha_celeste=0,
 polvo_vacio=2, glifo_ascenso=5, corazon_runico=1, ambar_fosil=1, lagrima_glaciar=2,
)
# Iconos de la interfaz (DK.icon): posición entre los candidatos de uipick.ucands.
# Flechas y controles (atrás, siguiente, play…) se quedan con su dibujo de trazo: son más claros así.
# CLEAN_SKIP: en el estilo limpio su silueta no se lee bien → ahí se queda el trazo (en pixel art sí usan el sprite)
CLEAN_SKIP = {'wind', 'hand', 'orb', 'pearl', 'coin', 'flame', 'droplet', 'mountain', 'poison', 'dust', 'earring', 'shell', 'potion', 'elixir', 'leaf'}
UP = dict(
 bell=0, power=3, exit=3, bag=3, book=2, book2=9, tome=9,
 swords=3, sword=4, dagger=7, wand=0, staff=8, shield=2, shieldStar=3, wind=0, heart=7, regen=0, sparkle=2, sparkles=1, star=8, sun=0,
 moon=1, flame=0, droplet=0, mountain=0, leaf=0, flee=8, chart=0, flask=2, gem=0, anvil=3, fur=8, scales=0, scale=1, thread=3,
 coral=1, cave=3, emblem=0, campfire=1, dumbbell=1, hammer=1, amulet=1, chalice=0, rune=9, fang=0, feather=0, pouch=3, crystal=1, potion=1,
 potionLarge=5, etherBottle=9, pill=0, jar=0, elixir=2, berry=3, vial=3, claw=1, ring=3, boot=1, boots=4, pearl=1, drum=1, prism=1,
 armor=4, cloak=3, earring=1, brazier=9, sprout=0, carapace=0, dust=1, starTear=4, shell=1, cube=1, lock=1, map=0, bed=0, save=4,
 edit=1, refresh=1, repeat=7, home=1, crown=4, helmet=3, helm=2, forgeRune=9, info=4, orb=5, trophy=3, target=3, gift=8, skull=1,
 footprints=7, paw=1, smile=7, dna=7, craftCog=3, settings=3, demon=2, poison=0,
 hand=4, compass=4, dice=7, music=1, coin=4, shop=1, scroll=3, award=4, bolt=3, snowflake=0, folder=5,
 trash=0, search=1, globe=1, flag=2, clock=4, smartphone=4,
 # v5.23: Ajustes y menú principal (volumeOff y users se componen abajo, en COMPOSE)
 accessibility=1, contrast=0, gauge=1, help=3, image=3, keyboard=4, layers=3, maximize=3, type=2, vibrate=1, volume=0,
 eye=4, play=5, pause=0, skip=9, download=1, upload=5, user=1,
)
assert set(P) == set(ITEMS), set(ITEMS) ^ set(P)
used, chosen, moved = set(), {}, []
for iid in ITEMS:
    cands = candidates(iid, n=24); j = P[iid]
    while (cands[j][0], cands[j][1]) in used: j += 1
    if j != P[iid]: moved.append((iid, P[iid], j))
    used.add((cands[j][0], cands[j][1])); chosen[iid] = cands[j]
COLS = 16; ids = list(ITEMS); rows = (len(ids) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * 16, rows * 16), (0, 0, 0, 0))
F = [os.path.basename(f) for f in FILES]
meta = {'source': 'https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m', 'license': 'CC0-1.0', 'retrieved': '2026-11-10', 'tile': 16, 'cols': COLS, 'icons': {}}
for i, iid in enumerate(ids):
    r = chosen[iid]; im = stats(r)[0]
    sheet.alpha_composite(im, ((i % COLS) * 16, (i // COLS) * 16))
    meta['icons'][iid] = {'i': i, 'file': F[r[0]], 'row_id': r[1], 'subject': r[2], 'caption': r[3], 'sha1': hashlib.sha1(r[4]).hexdigest()[:12]}
sheet.save(os.path.join(ROOT, 'icons', 'items-px.png'), optimize=True)
json.dump(meta, open(os.path.join(ROOT, 'docs', 'assets', 'items-px.json'), 'w'), ensure_ascii=False, indent=1)
# ---- siluetas (estilo limpio) de los objetos ----
from trace import glyph, tones, solid
def short(d):  # 1 decimal basta a 24 unidades
    import re as _re
    return _re.sub(r'(\d+\.\d)\d', r'\1', d)
glyphs = {iid: short(glyph(stats(chosen[iid])[0])) for iid in ids}
rowsN = (len(ids) + COLS - 1) // COLS
GEN = os.path.join(ROOT, 'js', 'data', 'gen', 'itemsPx.js')
head = open(GEN).read().split('DK.itemsPx')[0] if os.path.exists(GEN) else ''
open(GEN, 'w').write(head + 'DK.itemsPx = { src: %r, tile: 16, cols: %d, rows: %d, ids: %s,\n  /** silueta de cada objeto (viewBox 24, evenodd) para el estilo limpio */\n  glyphs: %s };\n' % (
    'icons/items-px.png?v=5230', COLS, rowsN, json.dumps({k: v['i'] for k, v in meta['icons'].items()}, separators=(',', ':')), json.dumps(glyphs, separators=(',', ':'))))

# ---- iconos de la interfaz: máscara en tonos (pixel art) + silueta (limpio) ----
from uipick import ucands
names = list(UP); UC = 16
base_img = {}
# Iconos compuestos (el dataset no los trae): grupo = dos personas; silenciado = altavoz con una X
COMPOSE = ['users', 'volumeOff', 'eyeOff']
names = names + COMPOSE
mask = Image.new('RGBA', (UC * 16, ((len(names) + UC - 1) // UC) * 16), (0, 0, 0, 0))
OP = {3: 255, 2: 190, 1: 125, 0: 70}
umeta = {'source': meta['source'], 'license': 'CC0-1.0', 'retrieved': meta['retrieved'], 'icons': {}}
ug = {}
for i, nm in enumerate(names):
    if nm in COMPOSE: continue
    r = ucands(nm, 12)[UP[nm]]; im = stats(r)[0]
    if nm in ('user', 'volume', 'eye', 'paw'): base_img[nm] = (im, r)
    for x, y, a in solid(im): mask.putpixel(((i % UC) * 16 + x, (i // UC) * 16 + y), (255, 255, 255, a))  # en positivo (v5.23)
    if nm not in CLEAN_SKIP: ug[nm] = short(glyph(im))
    umeta['icons'][nm] = {'i': i, 'file': F[r[0]], 'row_id': r[1], 'subject': r[2], 'caption': r[3], 'sha1': hashlib.sha1(r[4]).hexdigest()[:12]}
def shift(im, dx, dy):
    o = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); o.alpha_composite(im, (max(0, dx), max(0, dy)), (max(0, -dx), max(0, -dy))); return o
def compose(nm):
    if nm == 'users':  # v5.27: zarpa de oso (almohadilla, cuatro dedos y sus garras), dibujada a mano
        p, r = base_img['paw']
        PAW = ["................", "................", ".....#....#.....", ".....#....#.....", "....###..###....", ".#..###..###..#.",
               ".#............#.", "###..........###", "###..........###", "....########....", "...##########...", "..############..",
               "..############..", "..############..", "...##########...", "....###..###...."]
        out = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); px = out.load()
        for y, row in enumerate(PAW):
            for x, ch in enumerate(row):
                if ch == '#': px[x, y] = (235, 235, 235, 255)
        px[4, 9] = (200, 200, 200, 255)  # un píxel de borde algo más oscuro: todo el dibujo sale opaco (ver trace.solid)
        return out, r
    if nm == 'eyeOff':
        p, r = base_img['eye']; out = p.copy(); px = out.load()
        for k in range(14):  # barra diagonal con un hueco transparente a cada lado
            x, y = 1 + k, 14 - k
            for dx, dy, c in ((0, 0, (235, 235, 235, 255)), (1, 0, (235, 235, 235, 255)), (-1, -1, (0, 0, 0, 0)), (2, 1, (0, 0, 0, 0))):
                if 0 <= x + dx < 16 and 0 <= y + dy < 16: px[x + dx, y + dy] = c
        return out, r
    if nm == 'volumeOff':
        p, r = base_img['volume']; out = p.copy(); px = out.load()
        for y in range(16):
            for x in range(10, 16): px[x, y] = (0, 0, 0, 0)
        for k in range(5):  # X de 5×5 con borde oscuro
            for (x, y) in ((11 + k, 5 + k), (15 - k, 5 + k)):
                px[x, y] = (235, 235, 235, 255)
        return out, r
for i, nm in enumerate(names):
    if nm not in COMPOSE: continue
    im, r = compose(nm)
    for x, y, a in solid(im): mask.putpixel(((i % UC) * 16 + x, (i // UC) * 16 + y), (255, 255, 255, a))
    if nm not in CLEAN_SKIP: ug[nm] = short(glyph(im))
    umeta['icons'][nm] = {'i': i, 'composed': True, 'file': F[r[0]], 'row_id': r[1], 'subject': r[2], 'caption': r[3], 'sha1': hashlib.sha1(r[4]).hexdigest()[:12]}
mask.save(os.path.join(ROOT, 'icons', 'ui-px.png'), optimize=True)
json.dump(umeta, open(os.path.join(ROOT, 'docs', 'assets', 'icons-px.json'), 'w'), ensure_ascii=False, indent=1)
UGEN = os.path.join(ROOT, 'js', 'data', 'gen', 'iconsPx.js')
uhead = open(UGEN).read().split('DK.iconsPx')[0] if os.path.exists(UGEN) else '''/* =============================================================
 * js/data/gen/iconsPx.js — GENERADO por tools/atlas/final.py (v5.22): iconos de la interfaz (DK.icon)
 * hechos a partir del dataset «pixel-art-atlas-1.4m» (CC0 1.0). Procedencia: docs/assets/icons-px.json.
 *   mask   → hoja icons/ui-px.png: un icono de 16×16 en tonos (la transparencia guarda el tono) que se pinta
 *            con el color del texto (mask-image) cuando el ajuste «Pixel art» está activo
 *   glyphs → silueta suave (viewBox 24, evenodd) para el estilo limpio
 * Los iconos que no están aquí siguen con su dibujo de trazo de core/icons.js.
 * ============================================================= */
'''
import base64
mask_uri = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'icons', 'ui-px.png'), 'rb').read()).decode()
# la máscara va incrustada: las máscaras CSS de otro archivo se bloquean al abrir el juego como archivo local (CORS)
open(UGEN, 'w').write(uhead + 'DK.iconsPx = { src: %r, cols: %d, rows: %d, ids: %s,\n  glyphs: %s };\n' % (
    mask_uri, UC, (len(names) + UC - 1) // UC, json.dumps({n: i for i, n in enumerate(names)}, separators=(',', ':')), json.dumps(ug, separators=(',', ':'))))
print('movidos por repetición:', moved, '· iconos de interfaz:', len(names))
