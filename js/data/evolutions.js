/* =============================================================
 * data/evolutions.js — Evoluciones.
 *
 * Una especie evoluciona cuando alcanza `evolve.level`:
 *   SP.brotin.evolve = { level: 14, into: 'hojaral' };
 * Al evolucionar se conservan nivel, crecimiento, ataques y equipo;
 * cambian los atributos base y la lista de ataques que aprende.
 *
 * Aquí también se definen las formas evolucionadas de los iniciales.
 * ============================================================= */
(function () {
  const SP = DK.data.species;

  /** Define una especie evolucionada copiando datos de su forma previa. */
  function evo(id, name, from, b, o) {
    const base = SP[from];
    SP[id] = Object.assign({
      id, name, house: base.house,
      base: { hp: b[0], mp: b[1], atk: b[2], matk: b[3], def: b[4], mdef: b[5], spd: b[6] },
      exp: base.exp + 25, drops: [], passives: base.passives, learn: base.learn.slice(), evolvedFrom: from,
    }, o);
    SP[from].evolve = SP[from].evolve || { level: o.atLevel, into: id };
  }

  /* ---------- Iniciales: nivel 20 y nivel 45 ---------- */
  evo('luminar', 'Luminar', 'lumino', [72, 52, 15, 21, 15, 19, 19], { atLevel: 20,
    desc: 'Su cola brilla como un pequeño sol. Protege a los suyos con luz curativa.',
    sprite: { c1: '#ffcc33', c2: '#fff6d5', rx: 33, ry: 29, ears: 'long', tail: 'orb', eyes: 'big', mark: 'star' } });
  evo('solaris', 'Solaris', 'luminar', [90, 64, 18, 28, 18, 24, 24], { atLevel: 45,
    desc: 'Una leyenda dice que su luz guió a los primeros aventureros.',
    learn: SP.lumino.learn.concat([[60, 'curacion']]),
    sprite: { c1: '#fbbf24', c2: '#fffbeb', rx: 36, ry: 32, ears: 'halo', tail: 'orb', eyes: 'sharp', eyeColor: '#b45309', mark: 'star', wings: true } });

  evo('umbrakat', 'Umbrakat', 'umbrix', [68, 44, 21, 18, 14, 15, 22], { atLevel: 20,
    desc: 'Se funde con cualquier sombra y ataca sin hacer ruido.',
    sprite: { c1: '#5b3cc4', c2: '#c4b5fd', rx: 31, ry: 27, ears: 'cat', tail: 'curl', eyes: 'sharp', eyeColor: '#facc15', mark: 'moon' } });
  evo('noctyrion', 'Noctyrion', 'umbrakat', [84, 54, 28, 24, 18, 19, 28], { atLevel: 45,
    desc: 'Señor felino de la noche. Sus ojos ven a través de la oscuridad absoluta.',
    sprite: { c1: '#3b1f8f', c2: '#a78bfa', rx: 34, ry: 30, ears: 'horns', tail: 'curl', eyes: 'glow', eyeColor: '#fde047', mark: 'moon', wings: true } });

  evo('pyrosaur', 'Pyrosaur', 'pyrex', [70, 44, 22, 19, 15, 14, 18], { atLevel: 20,
    desc: 'Su cuerpo desprende tanto calor que derrite la roca a su paso.',
    sprite: { c1: '#ea580c', c2: '#fed7aa', rx: 33, ry: 27, ears: 'crest', tail: 'flame', eyes: 'sharp', eyeColor: '#7c2d12', mark: 'stripes' } });
  evo('infernyx', 'Infernyx', 'pyrosaur', [88, 54, 30, 26, 19, 17, 22], { atLevel: 45,
    desc: 'Dragón de fuego. Cuando ruge, el cielo se tiñe de rojo.',
    sprite: { c1: '#c2410c', c2: '#fdba74', rx: 36, ry: 30, ears: 'horns', tail: 'flame', eyes: 'sharp', eyeColor: '#fde047', mark: 'stripes', wings: true } });

  evo('aqualutra', 'Aqualutra', 'aquelo', [78, 48, 17, 19, 17, 20, 15], { atLevel: 20,
    desc: 'Nada a gran velocidad y cura a sus aliados con agua pura.',
    sprite: { c1: '#0ea5e9', c2: '#e0f2fe', rx: 33, ry: 29, ears: 'fins', tail: 'fin', eyes: 'big', mark: 'spots' } });
  evo('tidaleon', 'Tidaleón', 'aqualutra', [98, 58, 22, 26, 22, 26, 18], { atLevel: 45,
    desc: 'Guardián de las mareas. Puede invocar olas gigantescas.',
    sprite: { c1: '#0369a1', c2: '#bae6fd', rx: 37, ry: 31, ears: 'crest', tail: 'fin', eyes: 'sharp', eyeColor: '#0f172a', mark: 'spots' } });

  evo('terragor', 'Terragor', 'terron', [86, 34, 20, 14, 22, 17, 11], { atLevel: 20,
    desc: 'Su caparazón es tan duro como el granito.',
    sprite: { c1: '#92400e', c2: '#fde68a', rx: 36, ry: 28, ears: 'horns', tail: 'spike', eyes: 'big', mark: 'gem' } });
  evo('gaiadon', 'Gaiadón', 'terragor', [108, 42, 27, 18, 30, 22, 13], { atLevel: 45,
    desc: 'Una montaña viviente. Sobre su espalda crecen bosques enteros.',
    sprite: { c1: '#78350f', c2: '#a3e635', rx: 40, ry: 31, ears: 'spikes', tail: 'spike', eyes: 'sleepy', mark: 'gem' } });

  /* ---------- Cadenas de especies salvajes ---------- */
  const link = (from, level, into) => { SP[from].evolve = { level, into }; SP[into].evolvedFrom = SP[into].evolvedFrom || from; };
  link('brotin', 14, 'hojaral');
  link('gotin', 16, 'coralin');
  link('plumin', 14, 'gaviolux');
  link('lucibicho', 20, 'gemolito');
  link('chispon', 26, 'magmon');
  link('sombrilo', 18, 'murcisombra');
  link('musguin', 22, 'rocadon');
  link('rocadon', 30, 'obsidiano');
  link('obsidiano', 62, 'titanor');
  link('ignisaurio', 60, 'draconyx');
  link('salpicon', 46, 'leviatan');
  link('cenizon', 50, 'nocturnis');
  link('espectron', 64, 'vacuo');

  // Añade `id` a todas las especies (para DK.tr)
  Object.entries(SP).forEach(([id, s]) => (s.id = id));
})();
