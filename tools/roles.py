#!/usr/bin/env python3
"""tools/roles.py — Reparto de atributos según el papel (una sola vez, v4.15.0).

Cada especie base recibe un papel (data/basics.js → D.roles) y sus atributos
base se reparten según él, manteniendo su poder total (vida y maná cuentan
1/4). Las evoluciones usan el papel de su línea. También añade la cuarta
forma de los iniciales, cambia los niveles de evolución y da a cada especie
una silueta propia (sprite.body / legs / extra).

Uso:  python3 tools/roles.py   (reescribe data/species.json; luego node tools/data.js)
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'data', 'species.json')
d = json.load(open(P, encoding='utf-8'))
K = ['hp', 'mp', 'atk', 'matk', 'def', 'mdef', 'spd']
ROLES = {
  'tanque':      [1.25, .80, 1.00, .65, 1.40, 1.05, .60],
  'muro':        [1.20, 1.10, .70, .95, .95, 1.40, .70],
  'fisico':      [1.00, .75, 1.45, .60, 1.00, .85, 1.05],
  'mago':        [.90, 1.35, .55, 1.50, .80, 1.15, 1.00],
  'veloz':       [.85, .90, 1.20, .90, .75, .80, 1.60],
  'soporte':     [1.10, 1.40, .70, 1.10, 1.00, 1.20, .95],
  'cristal':     [.75, 1.10, 1.35, 1.35, .60, .60, 1.35],
  'equilibrado': [1, 1, 1, 1, 1, 1, 1],
}
ROLE = {
  # iniciales: cada uno un estilo de juego
  'lumino': 'soporte', 'umbrix': 'veloz', 'pyrex': 'fisico', 'aquelo': 'muro', 'terron': 'tanque',
  'brotin': 'muro', 'chispon': 'cristal', 'gotin': 'soporte', 'plumin': 'veloz', 'musguin': 'tanque',
  'sombrilo': 'cristal', 'lucibicho': 'soporte', 'cangrejon': 'fisico', 'salpicon': 'veloz',
  'lavagusano': 'fisico', 'cenizon': 'cristal', 'ignisaurio': 'fisico', 'aurelion': 'fisico',
  'guardian_solar': 'tanque', 'esfinxa': 'muro', 'llamasanta': 'mago', 'abisalto': 'tanque',
  'espectron': 'mago', 'celestor': 'cristal', 'tempestis': 'mago', 'ratonchi': 'veloz',
  'charquito': 'muro', 'setabruja': 'soporte', 'ardillama': 'veloz', 'medusina': 'mago',
  'tortuarena': 'tanque', 'topazio': 'muro', 'aranuria': 'veloz', 'salamandrox': 'veloz',
  'geyseron': 'mago', 'sacerdon': 'soporte', 'golemar': 'tanque', 'kraknoir': 'fisico',
  'fuegofatuo': 'mago', 'auroris': 'soporte', 'petrodraco': 'fisico',
}
# Siluetas: forma del cuerpo, patas y añadidos (systems/sprites.js)
LOOK = {
  'lumino': {'extra': ['whiskers']}, 'luminar': {'extra': ['whiskers', 'scarf']}, 'solaris': {'legs': 'quad', 'extra': ['mane', 'whiskers']},
  'umbrix': {'extra': ['whiskers']}, 'umbrakat': {'legs': 'quad', 'extra': ['whiskers', 'fangs']}, 'noctyrion': {'legs': 'quad', 'extra': ['mane', 'fangs']},
  'pyrex': {'body': 'long'}, 'pyrosaur': {'body': 'long', 'legs': 'quad', 'extra': ['fangs']}, 'infernyx': {'body': 'long', 'legs': 'quad', 'extra': ['fangs', 'horn']},
  'aquelo': {'extra': ['whiskers']}, 'aqualutra': {'body': 'long', 'extra': ['whiskers']}, 'tidaleon': {'legs': 'quad', 'extra': ['mane', 'whiskers']},
  'terron': {'extra': ['claws']}, 'terragor': {'legs': 'quad', 'extra': ['shell']}, 'gaiadon': {'body': 'block', 'legs': 'quad', 'extra': ['shell', 'horn']},
  'brotin': {'body': 'egg'}, 'hojaral': {'body': 'egg', 'extra': ['arms']}, 'chispon': {'body': 'ghost'}, 'magmon': {'body': 'block', 'extra': ['arms']},
  'gotin': {'body': 'egg', 'legs': 'none'}, 'coralin': {'body': 'block'}, 'plumin': {'legs': 'tall', 'extra': ['beak']}, 'gaviolux': {'legs': 'tall', 'extra': ['beak']},
  'musguin': {'body': 'block', 'legs': 'quad'}, 'rocadon': {'body': 'block', 'extra': ['arms']}, 'obsidiano': {'body': 'block', 'extra': ['arms', 'horn']},
  'titanor': {'body': 'block', 'legs': 'quad', 'extra': ['horn', 'shell']}, 'sombrilo': {'body': 'ghost'}, 'murcisombra': {'legs': 'none', 'extra': ['fangs']},
  'lucibicho': {'legs': 'none'}, 'gemolito': {'body': 'block', 'legs': 'none'}, 'cangrejon': {'legs': 'quad', 'extra': ['claws']},
  'salpicon': {'body': 'long', 'legs': 'none'}, 'leviatan': {'body': 'long', 'legs': 'none', 'extra': ['fangs']}, 'lavagusano': {'body': 'long', 'legs': 'none'},
  'cenizon': {'body': 'ghost'}, 'nocturnis': {'body': 'ghost', 'extra': ['crown']}, 'ignisaurio': {'body': 'long', 'legs': 'quad', 'extra': ['fangs']},
  'draconyx': {'body': 'long', 'legs': 'quad', 'extra': ['fangs', 'horn']}, 'aurelion': {'legs': 'quad', 'extra': ['mane', 'whiskers']},
  'guardian_solar': {'body': 'block', 'extra': ['arms']}, 'esfinxa': {'legs': 'quad', 'extra': ['mane']}, 'llamasanta': {'body': 'ghost', 'extra': ['crown']},
  'abisalto': {'body': 'long', 'legs': 'none', 'extra': ['fangs']}, 'espectron': {'body': 'ghost'}, 'vacuo': {'body': 'ghost', 'extra': ['crown']},
  'celestor': {'legs': 'none', 'extra': ['crown']}, 'tempestis': {'body': 'ghost'}, 'ratonchi': {'extra': ['whiskers']}, 'ratonix': {'extra': ['whiskers', 'fangs']},
  'charquito': {'legs': 'quad'}, 'setabruja': {'extra': ['cap']}, 'hongoscuro': {'extra': ['cap', 'arms']}, 'ardillama': {'legs': 'tall'},
  'fogardilla': {'legs': 'quad', 'extra': ['fangs']}, 'medusina': {'body': 'ghost'}, 'tortuarena': {'legs': 'quad', 'extra': ['shell']},
  'tortumonte': {'legs': 'quad', 'extra': ['shell', 'horn']}, 'topazio': {'body': 'egg', 'legs': 'none'}, 'aranuria': {'legs': 'quad', 'extra': ['fangs']},
  'salamandrox': {'body': 'long', 'legs': 'quad'}, 'geyseron': {'body': 'egg', 'extra': ['arms']}, 'sacerdon': {'legs': 'tall', 'extra': ['beak']},
  'golemar': {'body': 'block', 'extra': ['arms']}, 'kraknoir': {'body': 'ghost'}, 'fuegofatuo': {'body': 'ghost'}, 'auroris': {'legs': 'tall', 'extra': ['beak']},
  'petrodraco': {'body': 'long', 'legs': 'quad', 'extra': ['horn', 'fangs']},
}
# Cuarta forma de los iniciales (tercera evolución)
FOURTH = {
  'solaris': ('astrelion', 'Astrelion', 'Dicen que es el sol del amanecer hecho criatura. Su luz cura cualquier herida.',
              {'c1': '#f59e0b', 'c2': '#fffbeb', 'rx': 38, 'ry': 32, 'ears': 'halo', 'tail': 'orb', 'eyes': 'glow', 'eyeColor': '#fde047', 'mark': 'star', 'wings': True, 'body': 'egg', 'legs': 'quad', 'extra': ['mane', 'crown']}, [[54, 'velo_aurora']]),
  'noctyrion': ('eclipsar', 'Eclipsar', 'Cuando abre las alas, el día se vuelve noche. Nadie lo ve llegar.',
                {'c1': '#1e1b4b', 'c2': '#8b5cf6', 'rx': 34, 'ry': 28, 'ears': 'horns', 'tail': 'curl', 'eyes': 'glow', 'eyeColor': '#fde047', 'mark': 'moon', 'wings': True, 'body': 'long', 'legs': 'quad', 'extra': ['fangs', 'mane']}, [[54, 'telarana']]),
  'infernyx': ('volcanor', 'Volcanor', 'Un volcán con patas. Cada paso suyo deja la tierra en llamas.',
               {'c1': '#991b1b', 'c2': '#fb923c', 'rx': 36, 'ry': 30, 'ears': 'horns', 'tail': 'flame', 'eyes': 'sharp', 'eyeColor': '#fde047', 'mark': 'stripes', 'wings': True, 'body': 'long', 'legs': 'quad', 'extra': ['fangs', 'mane']}, [[54, 'mordisco_brasa']]),
  'tidaleon': ('oceanyx', 'Oceanyx', 'El rey de los mares. Las olas se calman cuando habla.',
               {'c1': '#1e3a8a', 'c2': '#7dd3fc', 'rx': 36, 'ry': 30, 'ears': 'crest', 'tail': 'fin', 'eyes': 'sharp', 'eyeColor': '#fde047', 'mark': 'spots', 'body': 'long', 'legs': 'quad', 'extra': ['mane', 'crown']}, [[54, 'vapor']]),
  'gaiadon': ('titanterra', 'Titanterra', 'Tan antiguo como las montañas. Sobre su caparazón nacen ríos.',
              {'c1': '#57534e', 'c2': '#84cc16', 'rx': 40, 'ry': 31, 'ears': 'spikes', 'tail': 'spike', 'eyes': 'cyclops', 'eyeColor': '#fbbf24', 'mark': 'gem', 'body': 'block', 'legs': 'quad', 'extra': ['shell', 'horn', 'crown']}, [[54, 'muralla']]),
}
LEVELS = [16, 34, 54]   # nivel de cada evolución de los iniciales
# Ataques propios de cada inicial según su papel (sustituye los que compartían)
SWAP = {
  'lumino': {27: 'velo_aurora', 34: 'aguas_curativas'},
  'umbrix': {42: 'telarana'},
  'pyrex': {27: 'mordisco_brasa'},
  'aquelo': {34: 'vapor', 55: 'velo_aurora'},
  'terron': {34: 'muralla'},
}

def score(b): return b['hp'] / 4 + b['mp'] / 4 + sum(b[k] for k in K[2:])
def root(k):
  while d[k].get('from'): k = d[k]['from']
  return k

if all('role' not in v for v in d.values()):
  # 1) Atributos según el papel (sólo la primera vez)
  for k, v in d.items():
    role = ROLE.get(root(k), 'equilibrado')
    b = v['base']; m = ROLES[role]
    nb = {x: b[x] * m[i] for i, x in enumerate(K)}
    f = score(b) / score(nb)
    v['base'] = {x: max(18 if x in ('hp', 'mp') else 4, round(nb[x] * f)) for x in K}
    if not v.get('from'): v['role'] = role
  # 2) Cuarta forma de los iniciales
  out = {}
  for k, v in d.items():
    out[k] = v
    if k in FOURTH:
      nid, name, desc, sprite, extra = FOURTH[k]
      v['evolves'] = {'to': nid, 'level': LEVELS[2]}
      out[nid] = {'name': name, 'from': k, 'base': {x: round(v['base'][x] * 1.16) for x in K}, 'learnExtra': extra, 'desc': desc, 'sprite': sprite}
  d = out
  # 3) Niveles de evolución de los iniciales y ataques propios
  for k, v in d.items():
    if v.get('starter'):
      a = k
      for lv in LEVELS:
        if not d[a].get('evolves'): break
        d[a]['evolves']['level'] = lv
        a = d[a]['evolves']['to']
      sw = SWAP.get(k, {})
      v['learn'] = [[lv, sw.get(lv, mv)] for lv, mv in v['learn']]
# 4) Siluetas
for k, look in LOOK.items():
  if k in d: d[k]['sprite'].update(look)

# Escribe con el mismo estilo compacto del archivo
def compact(x): return json.dumps(x, ensure_ascii=False, separators=(',', ':'))
lines = ['{']
items = list(d.items())
for n, (k, v) in enumerate(items):
  lines.append(f'  "{k}": {{')
  keys = list(v.keys())
  for i, key in enumerate(keys):
    val = v[key]; end = ',' if i < len(keys) - 1 else ''
    if key in ('learn', 'learnExtra') and len(val) > 5:
      rows = [', '.join(compact(e) for e in val[j:j + 5]) for j in range(0, len(val), 5)]
      lines.append(f'    "{key}": [')
      lines.append(',\n'.join('      ' + r for r in rows))
      lines.append(f'    ]{end}')
    elif isinstance(val, (dict, list)):
      lines.append(f'    "{key}": {compact(val)}{end}')
    else:
      lines.append(f'    "{key}": {json.dumps(val, ensure_ascii=False)}{end}')
  lines.append('  }' + (',' if n < len(items) - 1 else ''))
lines.append('}')
open(P, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('ok', len(d), 'especies')
