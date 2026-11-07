/* =============================================================
 * systems/looks.js — Aspecto de cada daskai (DK.looks, v4.47).
 *
 * Cada daskai nace con su propio aspecto, sorteado UNA vez (d.look = { s: semilla }):
 *   · La CASA fija el tono de piel, las manos y el pelo (se reconoce de un vistazo):
 *       Luz: almohadillas + pelusa · Oscuridad: garras de sombra + humo ·
 *       Fuego: garras de brasa + llamas · Agua: aletas + escamas · Tierra: puños de piedra + musgo
 *   · La ESPECIE fija su cola (y algunas su cuerpo: fantasmas, serpientes).
 *   · El INDIVIDUO sortea tamaño (0,78–1,22×), cuerpo, camino de patas, ojos, boca,
 *     orejas/cuernos, marca, si tendrá alas (y cuándo) y su adorno final.
 *   · Al EVOLUCIONAR conserva la cara y la piel; el cuerpo crece y madura, cambian las
 *     patas, pueden salir alas y la última forma luce su adorno.
 * Los jefes no se sortean: usan la «forma típica» de su especie (la del Códice), que
 * sale de una semilla fija por línea evolutiva.
 *
 *   DK.looks.svg(speciesId, look|null, { flip, shiny }) → texto SVG
 *   DK.looks.pixel(...) / pixelCached(...)              → pixel art (caché)
 *   DK.looks.of(d) · typical(sid) · ind(sid, look)       → aspecto resuelto
 *   DK.looks.traits(ind) → [{ cat, key, rare }] · icon(cat, key, o) → SVG pequeño del rasgo
 *   DK.looks.see(d) → apunta en el Códice la variante y sus rasgos
 * Textos: lang look.cat.*, look.<cat>.<clave>, look.hands.*, look.fur.*
 * ============================================================= */
(function () {
  const D = DK.data;
  const f = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* ---------- Color ---------- */
  function hex2rgb(h) { h = h.replace('#', ''); const n = parseInt(h, 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function shade(h, a) { const [r, g, b] = hex2rgb(h); const t = a < 0 ? 0 : 255, k = Math.abs(a); return rgb2hex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); }
  function mix(h1, h2, k) { const a = hex2rgb(h1), b = hex2rgb(h2); return rgb2hex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k); }
  function hue(h, deg) {
    let [r, g, b] = hex2rgb(h).map((x) => x / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; }
    hh = ((hh + deg / 360) % 1 + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const c = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return s ? rgb2hex(c(hh + 1 / 3) * 255, c(hh) * 255, c(hh - 1 / 3) * 255) : h;
  }

  /* ---------- Casas: piel, manos, pelo ---------- */
  const HOUSES = {
    luz: { skins: ['#ffd65a', '#ffe08a', '#f6c453', '#ffcf8a', '#fff0b8', '#f2b84b'], belly: '#fff7dc', hands: 'paw', fur: 'fluff', horn: '#fff3c4', wing: 'feather', name: 'Luz' },
    oscuridad: { skins: ['#6d4bd8', '#5a3fb8', '#7d5fd1', '#46378a', '#8e6fe0', '#3a2f66'], belly: '#c9b8ff', hands: 'claw', fur: 'smoke', horn: '#2b2140', wing: 'bat', name: 'Oscuridad' },
    fuego: { skins: ['#f97316', '#ef5a3c', '#fb923c', '#e2552b', '#f59e0b', '#dc4a1a'], belly: '#ffe1b8', hands: 'ember', fur: 'flame', horn: '#3b1d10', wing: 'bat', name: 'Fuego' },
    agua: { skins: ['#38bdf8', '#2aa6e8', '#22d3ee', '#4f8df5', '#2dd4bf', '#60a5fa'], belly: '#e0f7ff', hands: 'flipper', fur: 'scales', horn: '#e6fbff', wing: 'fin', name: 'Agua' },
    tierra: { skins: ['#b07a3a', '#7c9a3a', '#8b5a2b', '#a68a5b', '#6b8e23', '#9a7448'], belly: '#f1e3bf', hands: 'fist', fur: 'moss', horn: '#e8dcc0', wing: 'crystal', name: 'Tierra' },
  };

  /* ---------- Catálogo (peso; ≤ 2 = raro) ---------- */
  const BODIES = { round: 10, chubby: 9, egg: 8, bean: 7, block: 6, tall: 6, blob: 5, drop: 5, squat: 6, ghost: 3, long: 4 };
  const BODY_PATH = { // cómo madura el cuerpo en cada etapa
    round: ['round', 'chubby', 'chubby', 'squat'], chubby: ['chubby', 'chubby', 'squat', 'squat'], egg: ['egg', 'egg', 'tall', 'tall'],
    bean: ['bean', 'bean', 'long', 'long'], block: ['block', 'block', 'block', 'block'], tall: ['tall', 'tall', 'tall', 'egg'],
    blob: ['blob', 'blob', 'chubby', 'squat'], drop: ['drop', 'egg', 'tall', 'tall'], squat: ['squat', 'squat', 'block', 'block'],
    ghost: ['ghost', 'ghost', 'ghost', 'ghost'], long: ['long', 'long', 'long', 'long'],
    cloud: ['cloud', 'cloud', 'chubby', 'squat'], pear: ['pear', 'pear', 'pear', 'tall'], mound: ['mound', 'mound', 'mound', 'block'],
    wide: ['wide', 'wide', 'squat', 'squat'], tower: ['tower', 'tower', 'tall', 'tall'], topheavy: ['topheavy', 'topheavy', 'topheavy', 'block'], bubble: ['bubble', 'bubble', 'cloud', 'chubby'], lumpy: ['lumpy', 'lumpy', 'blob', 'chubby'],
    gourd: ['gourd', 'gourd', 'gourd', 'pear'], gem: ['gem', 'gem', 'gem', 'block'], puff: ['puff', 'puff', 'cloud', 'chubby'], bell: ['bell', 'bell', 'bell', 'squat'], bulb: ['bulb', 'bulb', 'blob', 'chubby'],
  };
  const LEG_PATHS = { // patas en cada etapa
    stubby: [['stubby', 'paws', 'quad', 'quad'], 9], digi: [['stubby', 'digi', 'digi', 'pillars'], 6], paws: [['paws', 'paws', 'quad', 'pillars'], 8],
    bird: [['tall', 'tall', 'tall', 'digi'], 5], tent: [['tentacles', 'tentacles', 'tentacles', 'tentacles'], 3], hover: [['hover', 'hover', 'hover', 'hover'], 3],
    late: [['stubby', 'stubby', 'paws', 'quad'], 6], pillar: [['paws', 'pillars', 'pillars', 'pillars'], 4],
  };
  const SLITHER = ['none', 'none', 'none', 'none'];
  // v4.52: más variedad. Se sortean con un azar aparte (los aspectos ya creados casi no cambian):
  // cada rasgo tiene una probabilidad NEW_CHANCE de cambiarse por uno de estas tablas nuevas.
  const NEW_CHANCE = 0.4;
  const BODIES2 = { cloud: 6, pear: 6, mound: 6 };
  const EYES2 = { spiral: 2, heart: 3, wink: 4, anime: 5, halflid: 5 };
  const MOUTHS2 = { oh: 4, jagged: 3, bubble: 2, mustache: 3, biggrin: 4 };
  const EARS2 = { elf: 5, mouse: 5, headwings: 3, trihorn: 3, lynx: 4 };
  const MARKS2 = { freckles: 5, patch: 4, band: 4, swirl: 3, blaze: 4 };
  const HAIR = { none: 6, fringe: 4, curl: 4, spiky: 4, ponytail: 3, cheektufts: 4, beard: 3 };
  // v4.56: 5 rasgos nuevos de cada tipo. Sólo los tienen los aspectos nuevos (semilla con la marca NEW3:
  // los daskai que ya tenías no cambian); cada rasgo tiene NEW3_CHANCE de cambiarse por uno de estas tablas.
  const NEW3_CHANCE = 0.45, NEW3_TAG = 0xa5, NEW4_TAG = 0xa6;
  // v4.62: los aspectos nuevos llevan NEW4_TAG: tienen los rasgos de la v4.56 y además los de la v4.62
  const isNew4 = (seed) => ((seed >>> 0) & 0xff) === NEW4_TAG;
  const isNew3 = (seed) => ((seed >>> 0) & 0xff) === NEW3_TAG || isNew4(seed);
  const NEW4_CHANCE = 0.35;
  const BODIES4 = { wide: 4, tower: 4, topheavy: 4, bubble: 4, lumpy: 4 };
  const EYES4 = { crosseye: 3, teary: 4, robot: 3, lashes: 5, diamond: 3 };
  const MOUTHS4 = { vampire: 4, zipper: 3, catmouth: 4, lips: 3, frown: 4 };
  const LEGS4 = { peg: [['peg', 'peg', 'peg', 'peg'], 4], webbed: [['stubby', 'webbed', 'webbed', 'webbed'], 4], spring: [['spring', 'spring', 'spring', 'spring'], 3], bigfoot: [['bigfoot', 'bigfoot', 'bigfoot', 'bigfoot'], 4], stilts: [['peg', 'stilts', 'stilts', 'stilts'], 3] };
  const ARMS = { stubby: 4, long: 4, noodle: 3, pincer: 3, mitten: 4 };
  const FINALS4 = { cape: 4, flowercrown: 4, bandana: 4, goggles: 3, collar: 4 };
  const BODIES3 = { gourd: 5, gem: 4, puff: 5, bell: 5, bulb: 4 };
  const EYES3 = { sparkle: 5, crescent: 4, squint: 4, bug: 3, ringed: 4 };
  const MOUTHS3 = { stitch: 3, toothy: 4, gaptooth: 4, drool: 4, whistle: 4 };
  const EARS3 = { leafy: 4, plume: 4, devil: 4, bow: 4, crystals: 3 };
  const MARKS3 = { bolt: 4, chevron: 4, ring: 4, bloom: 4, triad: 4 };
  const HAIR3 = { bun: 4, afro: 3, swoop: 4, braids: 3, quiff: 4 };
  const LEGS3 = { hoof: [['stubby', 'hooves', 'hooves', 'hooves'], 5], frog: [['frog', 'frog', 'frog', 'frog'], 4], talon: [['stubby', 'talons', 'talons', 'talons'], 4], root: [['roots', 'roots', 'roots', 'roots'], 3], puff: [['puffs', 'puffs', 'puffs', 'puffs'], 3] };
  const ALL_LEGS = Object.assign({}, LEG_PATHS, LEGS3, LEGS4);
  const EYES = { big: 10, sharp: 9, slit: 6, sleepy: 5, happy: 5, glow: 5, dot: 6, angry: 6, star: 3, button: 3, uneven: 2, cyclops: 1.5, three: 1.2, visor: 1.2 };
  const MOUTHS = { w: 7, smile: 8, open: 6, grin: 5, tiny: 6, flat: 4, fangs: 6, tusks: 3, buck: 3, tongue: 4, beak: 2, smirk: 4, wavy: 3, cat3: 4, sabre: 2, pout: 3 };
  const EARS = { cat: 9, bunny: 6, bear: 7, droopy: 5, horns: 7, unicorn: 2, antenna: 4, crest: 6, sprout: 4, fins: 5, spikes: 5, tuft: 6, none: 3, antlers: 3, ram: 3, mushroom: 2, flower: 3, mohawk: 4 };
  const MARKS = { none: 9, star: 4, moon: 4, heart: 3, spots: 6, stripes: 6, zigzag: 3, gem: 3 };
  const FINALS = { mane: 6, crown: 3, halo: 3, aura: 4, gemstone: 3, none: 3, orbit: 3, runes: 3, scarf: 4, thorns: 3 };
  // Alas: rasgo MUY raro que sólo aparece en la última evolución (v4.48)
  const WING_CHANCE = 0.07;
  const WINGS = { feather: 1, bat: 1, fin: 1, crystal: 1 };
  const WING_HOUSE = { feather: 'luz', bat: 'oscuridad', fin: 'agua', crystal: 'tierra' };
  // La casa tira un poco de algunos rasgos
  const HOUSE_BIAS = {
    luz: { ears: { bunny: 2, cat: 1.5, tuft: 1.5, flower: 2 }, eyes: { big: 1.6, star: 2 }, finals: { halo: 4, crown: 2 }, mark: { star: 3 } },
    oscuridad: { ears: { horns: 2, cat: 1.6, spikes: 1.5, ram: 2 }, eyes: { slit: 2, glow: 2, sharp: 1.5 }, finals: { aura: 3 }, mark: { moon: 3 } },
    fuego: { ears: { horns: 2, crest: 1.6, tuft: 1.5, mohawk: 2 }, eyes: { angry: 2, sharp: 1.5 }, mouths: { fangs: 2 }, finals: { mane: 2 } },
    agua: { ears: { fins: 3, crest: 1.5, droopy: 1.3 }, eyes: { big: 1.5, dot: 1.5 }, mark: { spots: 2 }, bodies: { long: 2, drop: 2 } },
    tierra: { ears: { sprout: 2.5, horns: 1.6, bear: 1.6, antlers: 2, mushroom: 2.5 }, eyes: { sleepy: 2, dot: 1.5 }, mark: { gem: 2.5 }, bodies: { block: 2, squat: 1.6 }, mouths: { tusks: 2.5 } },
  };
  const EYE_COLORS = ['#1b1b2f', '#1b1b2f', '#2b1a0e', '#0f3b57', '#7c3aed', '#16a34a', '#dc2626', '#f59e0b', '#0891b2'];
  const GLOW_COLORS = ['#fde047', '#22d3ee', '#f472b6', '#a3e635', '#f87171', '#c4b5fd'];

  const rare = (table, k) => (table[k] || 99) <= 2;
  const ALL = { body: Object.assign({}, BODIES, BODIES2, BODIES3, BODIES4), eyes: Object.assign({}, EYES, EYES2, EYES3, EYES4), mouth: Object.assign({}, MOUTHS, MOUTHS2, MOUTHS3, MOUTHS4), arms: ARMS, ears: Object.assign({}, EARS, EARS2, EARS3), mark: Object.assign({}, MARKS, MARKS2, MARKS3), hair: Object.assign({}, HAIR, HAIR3) };
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function pick(table, R, bias = {}) {
    const e = Object.entries(table).map(([k, w]) => [k, (Array.isArray(w) ? w[1] : w) * (bias[k] || 1)]);
    let t = e.reduce((a, [, w]) => a + w, 0) * R();
    for (const [k, w] of e) if ((t -= w) <= 0) return k;
    return e[0][0];
  }

  /** Sortea un daskai de una casa. */
  function roll(house, seed) {
    const R = rng(seed), H = HOUSES[house], B = HOUSE_BIAS[house] || {};
    const skin = hue(H.skins[Math.floor(R() * H.skins.length)], Math.round(R() * 14 - 7));
    const size = 0.78 + R() * 0.44; // 0,78 – 1,22
    const body = pick(BODIES, R, B.bodies);
    const legs = body === 'ghost' ? 'hover' : body === 'long' ? pick({ stubby: 3, tent: 2, hover: 2, paws: 3 }, R) : pick(LEG_PATHS, R);
    const eyes = pick(EYES, R, B.eyes);
    let mouth = pick(MOUTHS, R, B.mouths);
    if (eyes === 'visor' && mouth === 'beak') mouth = 'smile';
    const ind = {
      house, seed, skin, size, body, legs, eyes, mouth,
      ears: pick(EARS, R, B.ears), mark: pick(MARKS, R, B.mark), final: pick(FINALS, R, B.finals),
      eyeColor: eyes === 'glow' || eyes === 'visor' ? GLOW_COLORS[Math.floor(R() * GLOW_COLORS.length)] : EYE_COLORS[Math.floor(R() * EYE_COLORS.length)],
      eyeScale: 0.85 + R() * 0.4, earScale: 0.8 + R() * 0.45, armScale: 0.8 + R() * 0.4,
      winged: R() < WING_CHANCE, wingStage: (R(), 3), // (se sigue gastando el mismo azar: los aspectos ya creados no cambian)
      cheeks: R() < 0.7, furAmt: 0.6 + R() * 0.8, // v4.52: estaban dentro del comentario → nadie tenía coloretes ni pelo de su casa
      wob: R() * 6.28, lean: R() * 0.12 - 0.06,
      code: (seed >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, '0'),
    };
    {
      const R3 = rng(seed ^ 0x51ed2705), swap = (key, table) => { if (R3() < NEW_CHANCE) ind[key] = pick(table, R3); else R3(); };
      if (!['ghost', 'long'].includes(ind.body)) swap('body', BODIES2); else R3();
      swap('eyes', EYES2); swap('mouth', MOUTHS2); swap('ears', EARS2); swap('mark', MARKS2);
      ind.hair = pick(HAIR, R3);
      const HC = [shade(skin, -0.32), shade(skin, 0.4), H.belly, '#3b2a20', '#f5f0e6', hue(skin, 40)];
      ind.hairColor = HC[Math.floor(R3() * HC.length)];
      if (ind.mouth === 'beak' && ['beard'].includes(ind.hair)) ind.hair = 'none';
    }
    if (isNew3(seed)) { // v4.56: rasgos nuevos (sólo aspectos nuevos)
      const R4 = rng(seed ^ 0x3c6ef372), sw = (key, table) => { if (R4() < NEW3_CHANCE) ind[key] = pick(table, R4); else R4(); };
      const solid = !['ghost', 'long'].includes(ind.body);
      if (solid) sw('body', BODIES3); else R4();
      sw('eyes', EYES3); sw('mouth', MOUTHS3); sw('ears', EARS3); sw('mark', MARKS3); sw('hair', HAIR3);
      if (solid && ind.legs !== 'hover' && R4() < 0.4) ind.legs = pick(LEGS3, R4);
    }
    if (isNew4(seed)) { // v4.62: más rasgos (cuerpos, ojos, bocas, patas, brazos y adornos finales)
      const R5 = rng(seed ^ 0x7f4a7c15), sw = (key, table) => { if (R5() < NEW4_CHANCE) ind[key] = pick(table, R5); else R5(); };
      const solid = !['ghost', 'long'].includes(ind.body);
      if (solid) sw('body', BODIES4); else R5();
      sw('eyes', EYES4); sw('mouth', MOUTHS4); sw('final', FINALS4);
      if (solid && ind.legs !== 'hover' && R5() < 0.35) ind.legs = pick(LEGS4, R5); else R5();
      ind.arms = R5() < 0.5 ? pick(ARMS, R5) : null;
    }
    { const R2 = rng(seed ^ 0x9e3779b9); ind.baby = R2() < 0.75 ? 0.82 + R2() * 0.14 : 1 + R2() * 0.12; } // 3 de cada 4 nacen pequeños
    ind.rare = rare(ALL.eyes, ind.eyes) || rare(ALL.mouth, ind.mouth) || rare(ALL.ears, ind.ears) || ind.size > 1.18 || ind.size < 0.82 || rare(ALL.body, ind.body);
    return ind;
  }

  /* ---------- Formas ---------- */
  function smooth(pts) { // Catmull-Rom cerrada → Bézier
    const n = pts.length; let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + ' Z';
  }
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const PRESET = {
    round: { w: 1, h: 1, n: 2 }, chubby: { w: 1.08, h: 0.95, n: 2.2, pear: 0.2 }, egg: { w: 0.9, h: 1.1, n: 2, pear: 0.24 },
    bean: { w: 1.22, h: 0.84, n: 2.5, wob: 0.03, k: 2 }, block: { w: 1.05, h: 0.95, n: 3.8, pear: 0.04 }, tall: { w: 0.8, h: 1.24, n: 2.3, pear: 0.1 },
    blob: { w: 1.05, h: 0.96, n: 2, wob: 0.07, k: 5 }, drop: { w: 0.92, h: 1.12, n: 2, drop: 0.6 }, squat: { w: 1.25, h: 0.8, n: 2.8, pear: 0.06 },
    ghost: { w: 0.95, h: 1.05, n: 2 }, long: { w: 1.02, h: 0.86, n: 2.4 },
    cloud: { w: 1.08, h: 0.94, n: 2, bump: 0.075, k: 9 }, pear: { w: 0.94, h: 1.06, n: 2.1, pear: 0.42 }, mound: { w: 1.16, h: 0.9, n: 2.2, drop: 0.34 },
    wide: { w: 1.38, h: 0.76, n: 2.6, pear: 0.05 }, tower: { w: 0.72, h: 1.32, n: 2.4, pear: 0.06 }, topheavy: { w: 1.02, h: 1.04, n: 2.2, pear: -0.32 },
    bubble: { w: 1.04, h: 0.98, n: 2, bump: 0.09, k: 5 }, lumpy: { w: 1.06, h: 0.96, n: 2, wob: 0.09, k: 7 },
    gourd: { w: 0.98, h: 1.1, n: 2, waist: 0.2, pear: 0.18 }, gem: { w: 1.02, h: 1.1, n: 1.4 }, puff: { w: 1.06, h: 0.96, n: 2, bump: 0.05, k: 16 }, bell: { w: 1.02, h: 1.02, n: 3, pear: 0.5 }, bulb: { w: 1.04, h: 0.98, n: 2, wob: 0.11, k: 3 },
  };
  function bodyPath(kind, cx, cy, W, H, ind) {
    const P = PRESET[kind] || PRESET.round, N = 44, pts = [];
    if (kind === 'ghost') { // cabeza redonda y faldón ondulado
      for (let i = 0; i <= 22; i++) { const a = Math.PI + (i / 22) * Math.PI; pts.push([cx + W * Math.cos(a), cy + H * 0.15 + H * 0.95 * Math.sin(a)]); }
      const yb = cy + H * 0.95, n = 4;
      for (let i = 0; i <= n * 2; i++) { const x = cx + W - (i / (n * 2)) * W * 2; pts.push([x, yb + (i % 2 ? 7 : 0)]); }
      return smooth(pts);
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let x = W * sp(Math.cos(a), 2 / P.n), y = H * sp(Math.sin(a), 2 / P.n);
      if (P.pear) x *= 1 + P.pear * (y / H);
      if (P.waist) x *= 1 - P.waist * Math.exp(-Math.pow(y / H + 0.12, 2) * 9);
      if (P.drop && y < 0) { const k = -y / H; x *= Math.pow(1 - k * P.drop, 1.2); y *= 1 + k * 0.18; }
      if (P.wob) { const r = 1 + P.wob * Math.sin(a * P.k + ind.wob); x *= r; y *= r; }
      if (P.bump) { const r = 1 + P.bump * Math.abs(Math.sin((a * P.k) / 2 + ind.wob)); x *= r; y *= r; }
      pts.push([cx + x, cy + y]);
    }
    return smooth(pts);
  }

  /* ---------- Piezas ---------- */
  const STROKE = (dk, w = 2.2) => `stroke="${dk}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  function eyesSvg(ind, P) {
    const { fx, ey, er, dk } = P, col = ind.eyeColor;
    const e1 = [fx - er * 1.25, ey + 0.5], e2 = [fx + er * 1.25, ey - 0.8];
    const shine = (x, y, r) => `<circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.38)}" r="${f(r * 0.3)}" fill="#fff"/><circle cx="${f(x + r * 0.3)}" cy="${f(y + r * 0.3)}" r="${f(r * 0.13)}" fill="#fff" opacity=".85"/>`;
    const big = ([x, y], r = er) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/>` +
      `<circle cx="${f(x - r * 0.12)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.7)}" fill="${col}"/><circle cx="${f(x - r * 0.12)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.36)}" fill="#0b0a12"/>` + shine(x - r * 0.12, y + r * 0.1, r * 0.7);
    switch (ind.eyes) {
      case 'sharp': return [e1, e2].map(([x, y], i) => `<path d="M ${f(x - er)} ${f(y + 1)} Q ${f(x)} ${f(y - er * 1.15)} ${f(x + er)} ${f(y - (i ? 2.4 : 1))} Q ${f(x)} ${f(y + er * 0.85)} ${f(x - er)} ${f(y + 1)} Z" fill="#fff" ${STROKE(dk, 1.5)}/>` +
        `<circle cx="${f(x - 0.6)}" cy="${f(y)}" r="${f(er * 0.45)}" fill="${col}"/><circle cx="${f(x - 0.6)}" cy="${f(y)}" r="${f(er * 0.22)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.35)}" cy="${f(y - er * 0.25)}" r="${f(er * 0.15)}" fill="#fff"/>`).join('');
      case 'slit': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.05)}" fill="${col === '#1b1b2f' ? '#facc15' : col}" ${STROKE(dk, 1.4)}/><ellipse cx="${f(x - 0.4)}" cy="${f(y)}" rx="${f(er * 0.2)}" ry="${f(er * 0.85)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.4)}" r="${f(er * 0.2)}" fill="#fff"/>`).join('');
      case 'sleepy': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er)} ${f(y)} Q ${f(x)} ${f(y + er * 0.9)} ${f(x + er)} ${f(y)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'happy': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er)} ${f(y + 2)} Q ${f(x)} ${f(y - er * 1.1)} ${f(x + er)} ${f(y + 2)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'glow': return [e1, e2].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 1.5)}" fill="${col}" opacity=".28"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.85)}" ry="${f(er * 0.95)}" fill="${col}" ${STROKE(dk, 1.2)}/><ellipse cx="${f(x - er * 0.25)}" cy="${f(y - er * 0.3)}" rx="${f(er * 0.3)}" ry="${f(er * 0.2)}" fill="#fff" opacity=".9"/>`).join('');
      case 'dot': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.42)}" ry="${f(er * 0.55)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.15)}" cy="${f(y - er * 0.22)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      case 'angry': return big(e1) + big(e2) + `<path d="M ${f(e1[0] - er * 1.1)} ${f(e1[1] - er * 1.45)} L ${f(e1[0] + er * 0.9)} ${f(e1[1] - er * 0.8)} M ${f(e2[0] - er * 0.9)} ${f(e2[1] - er * 0.8)} L ${f(e2[0] + er * 1.1)} ${f(e2[1] - er * 1.5)}" ${STROKE(dk, 2.6)}/>`;
      case 'star': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/>` + star(x - er * 0.08, y + er * 0.1, er * 0.72, er * 0.32, col === '#1b1b2f' ? '#f59e0b' : col)).join('');
      case 'button': return [e1, e2].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.95)}" fill="#0b0a12"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.6)}" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="${f(x - er * 0.3)}" cy="${f(y - er * 0.3)}" r="${f(er * 0.18)}" fill="#fff"/>`).join('');
      case 'uneven': return big(e1, er * 1.3) + big(e2, er * 0.75);
      case 'cyclops': return big([fx, ey - 0.5], er * 1.7);
      case 'three': return big(e1, er * 0.9) + big(e2, er * 0.9) + big([fx, ey - er * 2.1], er * 0.65);
      case 'visor': return `<rect x="${f(e1[0] - er * 1.3)}" y="${f(ey - er * 0.75)}" width="${f(e2[0] - e1[0] + er * 2.6)}" height="${f(er * 1.4)}" rx="${f(er * 0.7)}" fill="#120f1d" ${STROKE(dk, 1.4)}/><rect x="${f(e1[0] - er * 0.6)}" y="${f(ey - er * 0.2)}" width="${f(e2[0] - e1[0] + er * 1.2)}" height="${f(er * 0.4)}" rx="${f(er * 0.2)}" fill="${col}"/><rect x="${f(e1[0] - er * 0.6)}" y="${f(ey - er * 0.55)}" width="${f(e2[0] - e1[0] + er * 1.2)}" height="${f(er * 1.1)}" rx="${f(er * 0.5)}" fill="${col}" opacity=".25"/>`;
      case 'spiral': return [e1, e2].map(([x, y]) => { let d = `M ${f(x)} ${f(y)}`; for (let i = 1; i <= 4; i++) { const r = (i * er * 0.85) / 4; d += ` A ${f(r)} ${f(r)} 0 0 1 ${f(x + (i % 2 ? r : -r))} ${f(y)}`; } return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er)}" fill="#fff" ${STROKE(dk, 1.4)}/><path d="${d}" fill="none" stroke="${dk}" stroke-width="1.3"/>`; }).join('');
      case 'heart': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><path d="M ${f(x)} ${f(y + er * 0.55)} C ${f(x - er * 0.95)} ${f(y)} ${f(x - er * 0.5)} ${f(y - er * 0.75)} ${f(x)} ${f(y - er * 0.25)} C ${f(x + er * 0.5)} ${f(y - er * 0.75)} ${f(x + er * 0.95)} ${f(y)} ${f(x)} ${f(y + er * 0.55)} Z" fill="#ec4899"/><circle cx="${f(x - er * 0.3)}" cy="${f(y - er * 0.3)}" r="${f(er * 0.15)}" fill="#fff"/>`).join('');
      case 'wink': return big(e1) + `<path d="M ${f(e2[0] - er)} ${f(e2[1] + 1)} Q ${f(e2[0])} ${f(e2[1] - er * 0.9)} ${f(e2[0] + er)} ${f(e2[1] + 1)}" fill="none" ${STROKE(dk, 2.4)}/>`;
      case 'anime': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.95)}" ry="${f(er * 1.35)}" fill="#fff" ${STROKE(dk, 1.5)}/><ellipse cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.2)}" rx="${f(er * 0.72)}" ry="${f(er * 1.02)}" fill="${col}"/><ellipse cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.3)}" rx="${f(er * 0.36)}" ry="${f(er * 0.55)}" fill="#0b0a12"/><ellipse cx="${f(x - er * 0.38)}" cy="${f(y - er * 0.35)}" rx="${f(er * 0.3)}" ry="${f(er * 0.36)}" fill="#fff"/><circle cx="${f(x + er * 0.3)}" cy="${f(y + er * 0.6)}" r="${f(er * 0.16)}" fill="#fff"/><path d="M ${f(x - er)} ${f(y - er * 1.15)} Q ${f(x)} ${f(y - er * 1.75)} ${f(x + er)} ${f(y - er * 1.2)}" fill="none" ${STROKE(dk, 1.6)}/>`).join('');
      case 'halflid': return [e1, e2].map(([x, y]) => big([x, y]) + `<path d="M ${f(x - er * 1.05)} ${f(y + 0.3)} A ${f(er * 1.05)} ${f(er * 1.12)} 0 0 1 ${f(x + er * 1.05)} ${f(y + 0.3)} Z" fill="${P.skin}"/><path d="M ${f(x - er * 1.05)} ${f(y + 0.3)} L ${f(x + er * 1.05)} ${f(y + 0.3)}" ${STROKE(dk, 2)}/>`).join('');
      case 'crosseye': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><path d="M ${f(x - er * 0.5)} ${f(y)} H ${f(x + er * 0.5)} M ${f(x)} ${f(y - er * 0.5)} V ${f(y + er * 0.5)}" stroke="${col === '#1b1b2f' ? '#0b0a12' : col}" stroke-width="${f(er * 0.32)}" stroke-linecap="round"/>`).join('');
      case 'teary': return [e1, e2].map(([x, y], i) => big([x, y], er * 1.1) + (i ? '' : `<path d="M ${f(x - er * 0.6)} ${f(y + er * 0.9)} q ${f(-er * 0.35)} ${f(er * 0.8)} 0 ${f(er * 1.1)} q ${f(er * 0.35)} ${f(-er * 0.3)} 0 ${f(-er * 1.1)} Z" fill="#7dd3fc" stroke="#0ea5e9" stroke-width=".7"/>`)).join('');
      case 'robot': return [e1, e2].map(([x, y]) => `<rect x="${f(x - er)}" y="${f(y - er * 0.85)}" width="${f(er * 2)}" height="${f(er * 1.7)}" rx="${f(er * 0.35)}" fill="#1f2937" ${STROKE(dk, 1.4)}/><rect x="${f(x - er * 0.55)}" y="${f(y - er * 0.4)}" width="${f(er * 1.1)}" height="${f(er * 0.8)}" rx="${f(er * 0.15)}" fill="${col === '#1b1b2f' ? '#22d3ee' : col}"/><rect x="${f(x - er * 0.5)}" y="${f(y - er * 0.35)}" width="${f(er * 0.35)}" height="${f(er * 0.25)}" fill="#fff" opacity=".8"/>`).join('');
      case 'lashes': return [e1, e2].map(([x, y], i) => big([x, y]) + `<path d="M ${f(x - er * 0.9)} ${f(y - er * 0.9)} l ${f(-er * 0.35)} ${f(-er * 0.45)} M ${f(x - er * 0.3)} ${f(y - er * 1.1)} l ${f(-er * 0.1)} ${f(-er * 0.55)} M ${f(x + er * 0.35)} ${f(y - er * 1.05)} l ${f(er * 0.15)} ${f(-er * 0.55)} M ${f(x + er * 0.9)} ${f(y - er * 0.8)} l ${f(er * 0.4)} ${f(-er * 0.4)}" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/>`).join('');
      case 'diamond': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><path d="M ${f(x)} ${f(y - er * 0.75)} L ${f(x + er * 0.55)} ${f(y + er * 0.05)} L ${f(x)} ${f(y + er * 0.85)} L ${f(x - er * 0.55)} ${f(y + er * 0.05)} Z" fill="${col === '#1b1b2f' ? '#8b5cf6' : col}"/><path d="M ${f(x)} ${f(y - er * 0.35)} L ${f(x + er * 0.25)} ${f(y + er * 0.05)} L ${f(x)} ${f(y + er * 0.45)} L ${f(x - er * 0.25)} ${f(y + er * 0.05)} Z" fill="#0b0a12"/><circle cx="${f(x - er * 0.35)}" cy="${f(y - er * 0.35)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      case 'sparkle': return [e1, e2].map(([x, y]) => big([x, y], er * 1.08) + star(x + er * 0.32, y - er * 0.3, er * 0.42, er * 0.14, '#fff') + star(x - er * 0.45, y + er * 0.5, er * 0.22, er * 0.08, '#fff')).join('');
      case 'crescent': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><circle cx="${f(x)}" cy="${f(y + er * 0.1)}" r="${f(er * 0.72)}" fill="${col}"/><path d="M ${f(x + er * 0.15)} ${f(y - er * 0.45)} A ${f(er * 0.55)} ${f(er * 0.55)} 0 1 0 ${f(x + er * 0.15)} ${f(y + er * 0.65)} A ${f(er * 0.42)} ${f(er * 0.42)} 0 1 1 ${f(x + er * 0.15)} ${f(y - er * 0.45)} Z" fill="#0b0a12"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.4)}" r="${f(er * 0.2)}" fill="#fff"/>`).join('');
      case 'squint': return [[e1, 1], [e2, -1]].map(([[x, y], d]) => `<path d="M ${f(x - d * er * 0.8)} ${f(y - er * 0.7)} L ${f(x + d * er * 0.6)} ${f(y)} L ${f(x - d * er * 0.8)} ${f(y + er * 0.7)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'bug': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 1.15)}" ry="${f(er * 1.3)}" fill="#1f1a2e" ${STROKE(dk, 1.4)}/>` + [[-0.4, -0.3], [0.25, -0.45], [-0.1, 0.25], [0.45, 0.2], [-0.5, 0.55], [0.1, 0.75]].map(([ox, oy]) => `<circle cx="${f(x + er * ox)}" cy="${f(y + er * oy)}" r="${f(er * 0.18)}" fill="${col === '#1b1b2f' ? '#4ade80' : col}" opacity=".55"/>`).join('') + `<ellipse cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.55)}" rx="${f(er * 0.35)}" ry="${f(er * 0.22)}" fill="#fff" opacity=".85"/>`).join('');
      case 'ringed': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.74)}" fill="${col}"/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.52)}" fill="none" stroke="#fff" stroke-width="${f(er * 0.12)}" opacity=".7"/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.24)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.38)}" cy="${f(y - er * 0.35)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      default: return big(e1) + big(e2);
    }
  }
  function star(x, y, R, r, fill) {
    return `<polygon points="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; return f(x + q * Math.cos(a)) + ',' + f(y + q * Math.sin(a)); }).join(' ')}" fill="${fill}"/>`;
  }

  function mouthSvg(ind, P) {
    const { mx, my, dk, s } = P, w = 4.2 * s;
    switch (ind.mouth) {
      case 'smile': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/>`;
      case 'open': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 2)} ${f(mx + w)} ${f(my - 1)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><ellipse cx="${f(mx)}" cy="${f(my + w * 0.75)}" rx="${f(w * 0.55)}" ry="${f(w * 0.32)}" fill="#f472b6"/>`;
      case 'grin': return `<path d="M ${f(mx - w * 1.3)} ${f(my - 1.5)} Q ${f(mx)} ${f(my + w * 1.5)} ${f(mx + w * 1.3)} ${f(my - 1.5)} Z" fill="#fff" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w * 0.45)} ${f(my - 1)} v ${f(w * 0.8)} M ${f(mx + w * 0.45)} ${f(my - 1)} v ${f(w * 0.8)}" stroke="${dk}" stroke-width="1"/>`;
      case 'tiny': return `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(w * 0.4)}" ry="${f(w * 0.36)}" fill="${dk}"/>`;
      case 'flat': return `<path d="M ${f(mx - w * 0.9)} ${f(my + 1)} L ${f(mx + w * 0.9)} ${f(my)}" fill="none" ${STROKE(dk, 2.2)}/>`;
      case 'fangs': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.75)} ${f(my)} l ${f(w * 0.3)} ${f(w * 0.75)} l ${f(w * 0.3)} ${f(-w * 0.65)} Z M ${f(mx + w * 0.15)} ${f(my + 0.4)} l ${f(w * 0.3)} ${f(w * 0.75)} l ${f(w * 0.3)} ${f(-w * 0.75)} Z" fill="#fff" ${STROKE(dk, 0.8)}/>`;
      case 'tusks': return `<path d="M ${f(mx - w)} ${f(my)} Q ${f(mx)} ${f(my + w * 0.6)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.9)} ${f(my + 0.5)} q ${f(-w * 0.4)} ${f(-w * 0.9)} ${f(-w * 0.1)} ${f(-w * 1.5)} q ${f(w * 0.25)} ${f(w * 0.7)} ${f(w * 0.45)} ${f(w * 1.4)} Z M ${f(mx + w * 0.9)} ${f(my + 0.5)} q ${f(w * 0.4)} ${f(-w * 0.9)} ${f(w * 0.1)} ${f(-w * 1.5)} q ${f(-w * 0.25)} ${f(w * 0.7)} ${f(-w * 0.45)} ${f(w * 1.4)} Z" fill="#fffaf0" ${STROKE(dk, 1)}/>`;
      case 'buck': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.8)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><rect x="${f(mx - w * 0.5)}" y="${f(my + w * 0.15)}" width="${f(w)}" height="${f(w * 0.75)}" rx="1" fill="#fff" ${STROKE(dk, 1)}/><path d="M ${f(mx)} ${f(my + w * 0.15)} v ${f(w * 0.75)}" stroke="${dk}" stroke-width=".8"/>`;
      case 'tongue': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.05)} ${f(my + w * 0.45)} q ${f(w * 0.2)} ${f(w * 1.1)} ${f(w * 0.75)} ${f(w * 0.5)} q ${f(w * 0.1)} ${f(-w * 0.5)} ${f(-w * 0.05)} ${f(-w * 0.75)} Z" fill="#f472b6" ${STROKE(dk, 1)}/>`;
      case 'smirk': return `<path d="M ${f(mx - w)} ${f(my + 1)} Q ${f(mx + w * 0.1)} ${f(my + w * 0.7)} ${f(mx + w * 1.1)} ${f(my - w * 0.6)}" fill="none" ${STROKE(dk, 2)}/>`;
      case 'wavy': return `<path d="M ${f(mx - w * 1.1)} ${f(my + 0.5)} q ${f(w * 0.28)} ${f(-w * 0.45)} ${f(w * 0.55)} 0 t ${f(w * 0.55)} 0 t ${f(w * 0.55)} 0 t ${f(w * 0.55)} 0" fill="none" ${STROKE(dk, 1.8)}/>`;
      case 'cat3': return `<path d="M ${f(mx - 1.6)} ${f(my - w * 0.55)} h 3.2 l -1.6 1.8 Z" fill="#f472b6" ${STROKE(dk, 0.9)}/><path d="M ${f(mx - w * 0.9)} ${f(my + 0.4)} q ${f(w * 0.45)} ${f(w * 0.75)} ${f(w * 0.9)} 0 q ${f(w * 0.45)} ${f(w * 0.75)} ${f(w * 0.9)} 0" fill="none" ${STROKE(dk, 1.8)}/>`;
      case 'sabre': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.7)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.8)} ${f(my)} l ${f(w * 0.25)} ${f(w * 1.5)} l ${f(w * 0.3)} ${f(-w * 1.35)} Z M ${f(mx + w * 0.25)} ${f(my + 0.3)} l ${f(w * 0.25)} ${f(w * 1.5)} l ${f(w * 0.3)} ${f(-w * 1.45)} Z" fill="#fffaf0" ${STROKE(dk, 0.9)}/>`;
      case 'pout': return `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(w * 0.6)}" ry="${f(w * 0.42)}" fill="#f472b6" ${STROKE(dk, 1.4)}/><path d="M ${f(mx - w * 0.45)} ${f(my + 1)} h ${f(w * 0.9)}" stroke="${dk}" stroke-width=".9"/>`;
      case 'oh': return `<ellipse cx="${f(mx)}" cy="${f(my + w * 0.3)}" rx="${f(w * 0.45)}" ry="${f(w * 0.6)}" fill="#4a0f1c" ${STROKE(dk, 1.6)}/>`;
      case 'jagged': return `<path d="M ${f(mx - w * 1.1)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.3)} ${f(mx + w * 1.1)} ${f(my - 1)} Z" fill="#2a0a12" ${STROKE(dk, 1.5)}/><path d="M ${f(mx - w)} ${f(my - 0.5)} l ${f(w * 0.33)} ${f(w * 0.5)} l ${f(w * 0.33)} ${f(-w * 0.5)} l ${f(w * 0.33)} ${f(w * 0.5)} l ${f(w * 0.33)} ${f(-w * 0.5)} l ${f(w * 0.33)} ${f(w * 0.5)} l ${f(w * 0.33)} ${f(-w * 0.5)} Z" fill="#fff"/>`;
      case 'bubble': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><circle cx="${f(mx - w * 1.5)}" cy="${f(my + w * 0.6)}" r="${f(w * 0.75)}" fill="#bae6fd" opacity=".75" stroke="#7dd3fc" stroke-width="1"/><circle cx="${f(mx - w * 1.75)}" cy="${f(my + w * 0.35)}" r="${f(w * 0.18)}" fill="#fff"/>`;
      case 'mustache': return `<path d="M ${f(mx - w * 0.7)} ${f(my + 1.5)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx + w * 0.7)} ${f(my + 1.5)}" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(mx)} ${f(my - 1)} q ${f(-w * 0.6)} ${f(-w * 0.55)} ${f(-w * 1.3)} ${f(w * 0.05)} q ${f(-w * 0.35)} ${f(w * 0.3)} ${f(-w * 0.1)} ${f(-w * 0.45)} q ${f(w * 0.55)} ${f(w * 0.5)} ${f(w * 1.4)} ${f(w * 0.4)} Z M ${f(mx)} ${f(my - 1)} q ${f(w * 0.6)} ${f(-w * 0.55)} ${f(w * 1.3)} ${f(w * 0.05)} q ${f(w * 0.35)} ${f(w * 0.3)} ${f(w * 0.1)} ${f(-w * 0.45)} q ${f(-w * 0.55)} ${f(w * 0.5)} ${f(-w * 1.4)} ${f(w * 0.4)} Z" fill="#3b2a20"/>`;
      case 'biggrin': return `<path d="M ${f(mx - w * 1.4)} ${f(my - 1.5)} Q ${f(mx)} ${f(my + w * 2)} ${f(mx + w * 1.4)} ${f(my - 1.5)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w * 1.25)} ${f(my - 1)} L ${f(mx + w * 1.25)} ${f(my - 1)} L ${f(mx + w * 1.05)} ${f(my + w * 0.35)} L ${f(mx - w * 1.05)} ${f(my + w * 0.35)} Z" fill="#fff"/><ellipse cx="${f(mx)}" cy="${f(my + w * 1.05)}" rx="${f(w * 0.6)}" ry="${f(w * 0.32)}" fill="#f472b6"/>`;
      case 'beak': return `<path d="M ${f(mx + w * 0.6)} ${f(my - w * 0.9)} L ${f(mx - w * 2.3)} ${f(my + w * 0.1)} L ${f(mx + w * 0.6)} ${f(my + w * 0.8)} Z" fill="#f59e0b" ${STROKE(dk, 1.4)}/><path d="M ${f(mx + w * 0.6)} ${f(my)} L ${f(mx - w * 2.1)} ${f(my + w * 0.1)}" stroke="${dk}" stroke-width="1"/>`;
      case 'vampire': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.8)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.55)} ${f(my + w * 0.05)} l ${f(w * 0.2)} ${f(w * 0.55)} l ${f(w * 0.2)} ${f(-w * 0.5)} Z M ${f(mx + w * 0.15)} ${f(my + w * 0.12)} l ${f(w * 0.2)} ${f(w * 0.55)} l ${f(w * 0.2)} ${f(-w * 0.52)} Z" fill="#fff" ${STROKE(dk, 0.7)}/>`;
      case 'zipper': return `<path d="M ${f(mx - w)} ${f(my + 0.5)} H ${f(mx + w)}" ${STROKE(dk, 2)}/>` + [-0.7, -0.35, 0, 0.35, 0.7].map((o) => `<path d="M ${f(mx + w * o)} ${f(my - 1.2)} v 3.4" stroke="${dk}" stroke-width="1"/>`).join('') + `<rect x="${f(mx + w * 0.9)}" y="${f(my - 0.8)}" width="${f(w * 0.35)}" height="${f(w * 0.6)}" rx=".8" fill="#d6d3d1" ${STROKE(dk, 0.8)}/>`;
      case 'catmouth': return `<path d="M ${f(mx - w * 0.85)} ${f(my)} q ${f(w * 0.42)} ${f(w * 0.7)} ${f(w * 0.85)} 0 q ${f(w * 0.42)} ${f(w * 0.7)} ${f(w * 0.85)} 0" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(mx - w * 1.2)} ${f(my - 1.5)} l ${f(-w * 1.1)} ${f(-w * 0.25)} M ${f(mx - w * 1.2)} ${f(my)} l ${f(-w * 1.15)} ${f(w * 0.15)} M ${f(mx + w * 1.2)} ${f(my - 1.5)} l ${f(w * 1.1)} ${f(-w * 0.25)} M ${f(mx + w * 1.2)} ${f(my)} l ${f(w * 1.15)} ${f(w * 0.15)}" stroke="${dk}" stroke-width=".8" opacity=".6"/>`;
      case 'lips': return `<path d="M ${f(mx - w * 0.8)} ${f(my + 0.5)} Q ${f(mx - w * 0.4)} ${f(my - w * 0.45)} ${f(mx)} ${f(my)} Q ${f(mx + w * 0.4)} ${f(my - w * 0.45)} ${f(mx + w * 0.8)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx - w * 0.8)} ${f(my + 0.5)} Z" fill="#e11d48" ${STROKE(dk, 1.2)}/><path d="M ${f(mx - w * 0.7)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.25)} ${f(mx + w * 0.7)} ${f(my + 0.5)}" stroke="#881337" stroke-width=".8" fill="none"/>`;
      case 'frown': return `<path d="M ${f(mx - w * 0.9)} ${f(my + w * 0.55)} Q ${f(mx)} ${f(my - w * 0.4)} ${f(mx + w * 0.9)} ${f(my + w * 0.55)}" fill="none" ${STROKE(dk, 2)}/>`;
      case 'stitch': return `<path d="M ${f(mx - w)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.45)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 1.8)}/>` + [-0.6, 0, 0.6].map((o) => `<path d="M ${f(mx + w * o - 1.3)} ${f(my - 1.2)} l 2.6 ${f(2.8 + w * 0.15)} M ${f(mx + w * o + 1.3)} ${f(my - 1.2)} l -2.6 ${f(2.8 + w * 0.15)}" stroke="${dk}" stroke-width="1.1" stroke-linecap="round"/>`).join('');
      case 'toothy': return `<rect x="${f(mx - w)}" y="${f(my - 1.5)}" width="${f(w * 2)}" height="${f(w * 0.85)}" rx="${f(w * 0.3)}" fill="#fff" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w)} ${f(my - 1.5 + w * 0.42)} H ${f(mx + w)}" stroke="${dk}" stroke-width=".9"/>` + [-0.5, 0, 0.5].map((o) => `<path d="M ${f(mx + w * o)} ${f(my - 1.5)} v ${f(w * 0.85)}" stroke="${dk}" stroke-width=".9"/>`).join('');
      case 'gaptooth': return `<path d="M ${f(mx - w * 1.1)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.6)} ${f(mx + w * 1.1)} ${f(my - 1)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><rect x="${f(mx - w * 0.5)}" y="${f(my - 0.8)}" width="${f(w * 0.45)}" height="${f(w * 0.55)}" rx=".6" fill="#fff"/><ellipse cx="${f(mx + w * 0.1)}" cy="${f(my + w * 0.85)}" rx="${f(w * 0.5)}" ry="${f(w * 0.25)}" fill="#f472b6"/>`;
      case 'drool': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.85)} ${f(my)} q ${f(w * 0.35)} ${f(w * 0.7)} 0 ${f(w * 1.1)} q ${f(-w * 0.35)} ${f(-w * 0.4)} 0 ${f(-w * 1.1)} Z" fill="#bae6fd" stroke="#38bdf8" stroke-width=".8"/>`;
      case 'whistle': return `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(w * 0.32)}" ry="${f(w * 0.36)}" fill="#4a0f1c" ${STROKE(dk, 1.5)}/><path d="M ${f(mx + w * 0.7)} ${f(my - 0.5)} l ${f(w * 0.6)} ${f(-w * 0.3)} M ${f(mx + w * 0.75)} ${f(my + 1.2)} l ${f(w * 0.7)} 0 M ${f(mx + w * 0.7)} ${f(my + 2.8)} l ${f(w * 0.6)} ${f(w * 0.3)}" stroke="${dk}" stroke-width="1" stroke-linecap="round" opacity=".6"/>`;
      default: return `<path d="M ${f(mx - w)} ${f(my)} Q ${f(mx - w / 2)} ${f(my + w * 0.85)} ${f(mx)} ${f(my)} Q ${f(mx + w / 2)} ${f(my + w * 0.85)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 2)}/>`;
    }
  }

  // Orejas y cabeza (detrás o delante del cuerpo)
  function earsSvg(ind, P, front) {
    const { cx, W, top, skin, inner, dk, hornC, s } = P, k = ind.earScale * s;
    const L = cx - W * 0.45, Rr = cx + W * 0.2, yL = top(L), yR = top(Rr);
    switch (ind.ears) {
      case 'cat': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 7 * k)} ${f(y + 6)} L ${f(x + d * 2 * k)} ${f(y - 15 * k)} L ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${skin}" ${STROKE(dk)}/><path d="M ${f(x - 3.5 * k)} ${f(y + 3)} L ${f(x + d * 1.5 * k)} ${f(y - 8 * k)} L ${f(x + 4 * k)} ${f(y + 3)} Z" fill="${inner}"/>`).join('');
      case 'bunny': return front ? '' : [[L, yL, -14], [Rr, yR, 12]].map(([x, y, r]) => `<g transform="rotate(${r} ${f(x)} ${f(y + 4)})"><ellipse cx="${f(x)}" cy="${f(y - 12 * k)}" rx="${f(6 * k)}" ry="${f(17 * k)}" fill="${skin}" ${STROKE(dk)}/><ellipse cx="${f(x)}" cy="${f(y - 11 * k)}" rx="${f(2.8 * k)}" ry="${f(11 * k)}" fill="${inner}"/></g>`).join('');
      case 'bear': return front ? '' : [[L, yL], [Rr, yR]].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(7 * k)}" fill="${skin}" ${STROKE(dk)}/><circle cx="${f(x)}" cy="${f(y + 0.5)}" r="${f(3.6 * k)}" fill="${inner}"/>`).join('');
      case 'droopy': return !front ? '' : [[cx - W * 0.82, P.ey - 2, 1], [cx + W * 0.55, P.ey - 3, -1]].map(([x, y, d]) => `<path d="M ${f(x + d * 3)} ${f(y - 6)} q ${f(-d * 9 * k)} ${f(2 * k)} ${f(-d * 7 * k)} ${f(17 * k)} q ${f(d * 5 * k)} ${f(3 * k)} ${f(d * 9 * k)} ${f(-6 * k)} Z" fill="${shade(skin, -0.18)}" ${STROKE(dk, 2)}/>`).join('');
      case 'horns': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 4 * k)} ${f(y + 5)} Q ${f(x + d * 9 * k)} ${f(y - 4 * k)} ${f(x + d * 5 * k)} ${f(y - 17 * k)} Q ${f(x + d * 1 * k)} ${f(y - 6 * k)} ${f(x + 4 * k)} ${f(y + 5)} Z" fill="${hornC}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2 * k)} ${f(y - 4 * k)} l ${f(d * 3)} -1 M ${f(x + d * 3.5 * k)} ${f(y - 9 * k)} l ${f(d * 2.5)} -1" stroke="${dk}" stroke-width="1" opacity=".5"/>`).join('');
      case 'unicorn': { const x = cx - W * 0.18, y = top(x); return front ? '' : `<path d="M ${f(x - 5 * k)} ${f(y + 4)} L ${f(x - 1 * k)} ${f(y - 22 * k)} L ${f(x + 5 * k)} ${f(y + 4)} Z" fill="${hornC}" ${STROKE(dk, 1.8)}/><path d="M ${f(x - 3.5 * k)} ${f(y - 2)} l ${f(6 * k)} -3 M ${f(x - 2.6 * k)} ${f(y - 8 * k)} l ${f(4.5 * k)} -2.5 M ${f(x - 1.8 * k)} ${f(y - 14 * k)} l ${f(3 * k)} -2" stroke="${dk}" stroke-width="1" opacity=".55"/>`; }
      case 'antenna': return front ? '' : [[L + 3, yL, -1], [Rr - 2, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 3)} Q ${f(x + d * 6 * k)} ${f(y - 10 * k)} ${f(x + d * 3 * k)} ${f(y - 18 * k)}" fill="none" ${STROKE(dk, 2)}/><circle cx="${f(x + d * 3 * k)}" cy="${f(y - 19 * k)}" r="${f(3.6 * k)}" fill="${inner}" ${STROKE(dk, 1.6)}/>`).join('');
      case 'crest': { const xs = [-0.5, -0.18, 0.14]; return front ? '' : xs.map((o, i) => { const x = cx + W * o, y = top(x); const h = (14 - i * 2.5) * k; return `<path d="M ${f(x - 5 * k)} ${f(y + 5)} Q ${f(x - 2)} ${f(y - h)} ${f(x + 5 * k)} ${f(y - h * 0.9)} Q ${f(x + 2)} ${f(y - 2)} ${f(x + 5 * k)} ${f(y + 5)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/>`; }).join(''); }
      case 'sprout': { const x = cx - W * 0.12, y = top(x); return front ? '' : `<path d="M ${f(x)} ${f(y + 3)} q -1 ${f(-8 * k)} 1 ${f(-12 * k)}" fill="none" ${STROKE('#3f6212', 2.2)}/><path d="M ${f(x + 1)} ${f(y - 9 * k)} q ${f(-12 * k)} ${f(-8 * k)} ${f(-14 * k)} ${f(2 * k)} q ${f(8 * k)} ${f(5 * k)} ${f(14 * k)} ${f(-2 * k)} Z" fill="#65a30d" ${STROKE('#365314', 1.5)}/><path d="M ${f(x + 1)} ${f(y - 11 * k)} q ${f(10 * k)} ${f(-9 * k)} ${f(13 * k)} ${f(0)} q ${f(-6 * k)} ${f(5 * k)} ${f(-13 * k)} ${f(0)} Z" fill="#84cc16" ${STROKE('#365314', 1.5)}/>`; }
      case 'fins': return front ? '' : [[cx - W * 0.86, P.ey - 4, -1], [cx + W * 0.62, P.ey - 6, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 6)} L ${f(x + d * 13 * k)} ${f(y - 10 * k)} Q ${f(x + d * 8 * k)} ${f(y - 1)} ${f(x + d * 11 * k)} ${f(y + 8 * k)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2)} ${f(y + 4)} L ${f(x + d * 9 * k)} ${f(y - 5 * k)} M ${f(x + d * 2)} ${f(y + 6)} L ${f(x + d * 9 * k)} ${f(y + 3 * k)}" stroke="${dk}" stroke-width=".9" opacity=".5"/>`).join('');
      case 'spikes': return front ? '' : [-0.3, 0.05, 0.38, 0.68].map((o, i) => { const x = cx + W * o, y = top(x); const h = (11 - Math.abs(i - 1.2) * 2) * k; return `<path d="M ${f(x - 5 * k)} ${f(y + 4)} L ${f(x + 1.5 * k)} ${f(y - h)} L ${f(x + 6 * k)} ${f(y + 4)} Z" fill="${hornC}" ${STROKE(dk, 1.6)}/>`; }).join('');
      case 'antlers': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => { const pth = `M ${f(x)} ${f(y + 3)} L ${f(x + d * 4 * k)} ${f(y - 10 * k)} L ${f(x + d * 9 * k)} ${f(y - 18 * k)} M ${f(x + d * 4 * k)} ${f(y - 10 * k)} L ${f(x + d * 11 * k)} ${f(y - 11 * k)} M ${f(x + d * 6.5 * k)} ${f(y - 14 * k)} L ${f(x + d * 3 * k)} ${f(y - 21 * k)}`; return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(5 * k)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${pth}" fill="none" stroke="${hornC}" stroke-width="${f(2.8 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`; }).join('');
      case 'ram': return front ? '' : [[L - 2, yL + 4, -1], [Rr + 2, yR + 4, 1]].map(([x, y, d]) => { const pth = `M ${f(x)} ${f(y)} C ${f(x + d * 12 * k)} ${f(y - 12 * k)} ${f(x + d * 17 * k)} ${f(y + 4 * k)} ${f(x + d * 9 * k)} ${f(y + 7 * k)} C ${f(x + d * 4 * k)} ${f(y + 8 * k)} ${f(x + d * 4 * k)} ${f(y + 2 * k)} ${f(x + d * 8 * k)} ${f(y + 1.5 * k)}`; return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${hornC}" stroke-width="${f(4.4 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${dk}" stroke-width=".8" stroke-dasharray="1.5 2.5" opacity=".45"/>`; }).join('');
      case 'mushroom': { const x = cx - W * 0.15, y = top(x) + 3; return front ? `<path d="M ${f(x - 15 * k)} ${f(y)} Q ${f(x - 15 * k)} ${f(y - 15 * k)} ${f(x)} ${f(y - 15 * k)} Q ${f(x + 15 * k)} ${f(y - 15 * k)} ${f(x + 15 * k)} ${f(y)} Q ${f(x)} ${f(y + 3)} ${f(x - 15 * k)} ${f(y)} Z" fill="#dc2626" ${STROKE(dk, 1.8)}/>` + [[-7, -8, 2.6], [2, -11, 2.2], [8, -5, 2], [-1, -4, 1.6]].map(([ox, oy, r]) => `<circle cx="${f(x + ox * k)}" cy="${f(y + oy * k)}" r="${f(r * k)}" fill="#fff7ed"/>`).join('') : ''; }
      case 'flower': { const x = cx - W * 0.32, y = top(x) + 1; return front ? [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; return `<ellipse cx="${f(x + Math.cos(a) * 4.6 * k)}" cy="${f(y - 4 + Math.sin(a) * 4.6 * k)}" rx="${f(3.4 * k)}" ry="${f(2.6 * k)}" transform="rotate(${f((a * 180) / Math.PI)} ${f(x + Math.cos(a) * 4.6 * k)} ${f(y - 4 + Math.sin(a) * 4.6 * k)})" fill="#f9a8d4" ${STROKE(dk, 1.1)}/>`; }).join('') + `<circle cx="${f(x)}" cy="${f(y - 4)}" r="${f(2.6 * k)}" fill="#facc15" ${STROKE(dk, 1)}/>` : ''; }
      case 'mohawk': return front ? '' : [-0.5, -0.3, -0.1, 0.1, 0.3].map((o, i) => { const x = cx + W * o, y = top(x) + 3, hh = (9 + (i === 1 || i === 2 ? 4 : 0)) * k; return `<path d="M ${f(x - 4 * k)} ${f(y)} L ${f(x + 2 * k)} ${f(y - hh)} L ${f(x + 5 * k)} ${f(y)} Z" fill="${shade(skin, -0.3)}" ${STROKE(dk, 1.5)}/>`; }).join('');
      case 'elf': return front ? '' : [[cx - W * 0.86, P.ey - 1, -1], [cx + W * 0.62, P.ey - 2, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y - 5 * k)} L ${f(x + d * 17 * k)} ${f(y - 9 * k)} L ${f(x)} ${f(y + 5 * k)} Z" fill="${skin}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2)} ${f(y - 2 * k)} L ${f(x + d * 11 * k)} ${f(y - 6 * k)} L ${f(x + d * 2)} ${f(y + 2 * k)} Z" fill="${inner}"/>`).join('');
      case 'mouse': return front ? '' : [[L - 3, yL + 2], [Rr + 3, yR + 2]].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y - 5 * k)}" r="${f(10.5 * k)}" fill="${skin}" ${STROKE(dk, 1.8)}/><circle cx="${f(x)}" cy="${f(y - 4.5 * k)}" r="${f(6.5 * k)}" fill="${inner}" opacity=".9"/>`).join('');
      case 'headwings': return front ? '' : [[cx - W * 0.8, P.ey - 6, -1], [cx + W * 0.55, P.ey - 8, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 4)} Q ${f(x + d * 6 * k)} ${f(y - 14 * k)} ${f(x + d * 17 * k)} ${f(y - 12 * k)} Q ${f(x + d * 12 * k)} ${f(y - 6 * k)} ${f(x + d * 15 * k)} ${f(y - 3 * k)} Q ${f(x + d * 9 * k)} ${f(y)} ${f(x + d * 11 * k)} ${f(y + 3 * k)} Q ${f(x + d * 4 * k)} ${f(y + 3)} ${f(x)} ${f(y + 4)} Z" fill="#fffdf5" ${STROKE(dk, 1.5)}/>`).join('');
      case 'trihorn': return front ? '' : [-0.42, -0.12, 0.18].map((o, i) => { const x = cx + W * o, y = top(x) + 3, hh = (i === 1 ? 13 : 9) * k; return `<path d="M ${f(x - 3.5 * k)} ${f(y)} Q ${f(x - 1)} ${f(y - hh * 0.6)} ${f(x + (i - 1) * 2)} ${f(y - hh)} Q ${f(x + 2)} ${f(y - hh * 0.5)} ${f(x + 3.5 * k)} ${f(y)} Z" fill="${hornC}" ${STROKE(dk, 1.5)}/>`; }).join('');
      case 'lynx': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 7 * k)} ${f(y + 6)} L ${f(x + d * 2 * k)} ${f(y - 15 * k)} L ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${skin}" ${STROKE(dk)}/><path d="M ${f(x - 3.5 * k)} ${f(y + 3)} L ${f(x + d * 1.5 * k)} ${f(y - 8 * k)} L ${f(x + 4 * k)} ${f(y + 3)} Z" fill="${inner}"/><path d="M ${f(x + d * 2 * k)} ${f(y - 14 * k)} l ${f(d * 1.5)} ${f(-7 * k)} M ${f(x + d * 2 * k)} ${f(y - 14 * k)} l ${f(d * -1.5)} ${f(-5 * k)}" stroke="#1c1917" stroke-width="${f(2 * k)}" stroke-linecap="round"/>`).join('');
      case 'leafy': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 4)} Q ${f(x + d * 14 * k)} ${f(y - 4 * k)} ${f(x + d * 9 * k)} ${f(y - 18 * k)} Q ${f(x - d * 3 * k)} ${f(y - 8 * k)} ${f(x)} ${f(y + 4)} Z" fill="#65a30d" ${STROKE('#365314', 1.6)}/><path d="M ${f(x)} ${f(y + 3)} Q ${f(x + d * 6 * k)} ${f(y - 6 * k)} ${f(x + d * 8.5 * k)} ${f(y - 16 * k)}" fill="none" stroke="#365314" stroke-width="1" opacity=".7"/>`).join('');
      case 'plume': { const x = cx - W * 0.1, y = top(x) + 3, c = hue(skin, 60); return front ? '' : `<path d="M ${f(x)} ${f(y)} Q ${f(x - 4 * k)} ${f(y - 16 * k)} ${f(x + 10 * k)} ${f(y - 26 * k)} Q ${f(x + 6 * k)} ${f(y - 14 * k)} ${f(x + 4 * k)} ${f(y)} Z" fill="${c}" ${STROKE(dk, 1.6)}/><path d="M ${f(x + 2 * k)} ${f(y - 1)} Q ${f(x + 1 * k)} ${f(y - 14 * k)} ${f(x + 9 * k)} ${f(y - 24 * k)}" fill="none" stroke="${dk}" stroke-width="1" opacity=".55"/>`; }
      case 'devil': return front ? '' : [[L + 2, yL, -1], [Rr - 1, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 3.5 * k)} ${f(y + 4)} Q ${f(x + d * 2 * k)} ${f(y - 6 * k)} ${f(x + d * 7 * k)} ${f(y - 11 * k)} Q ${f(x + d * 2 * k)} ${f(y - 3 * k)} ${f(x + 3.5 * k)} ${f(y + 4)} Z" fill="#b91c1c" ${STROKE(dk, 1.6)}/>`).join('');
      case 'bow': { const x = cx - W * 0.42, y = top(x) + 2; return front ? `<path d="M ${f(x)} ${f(y)} L ${f(x - 9 * k)} ${f(y - 6 * k)} L ${f(x - 9 * k)} ${f(y + 5 * k)} Z M ${f(x)} ${f(y)} L ${f(x + 9 * k)} ${f(y - 6 * k)} L ${f(x + 9 * k)} ${f(y + 5 * k)} Z" fill="#ec4899" ${STROKE(dk, 1.5)}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(2.6 * k)}" fill="#f9a8d4" ${STROKE(dk, 1.2)}/>` : ''; }
      case 'crystals': return front ? '' : [[-0.35, 11, -2], [-0.08, 17, 0], [0.2, 10, 2]].map(([o, hh, r]) => { const x = cx + W * o, y = top(x) + 4; return `<path d="M ${f(x - 4 * k)} ${f(y)} L ${f(x - 1 * k + r)} ${f(y - hh * k)} L ${f(x + 4 * k)} ${f(y)} Z" fill="#a5f3fc" ${STROKE('#0e7490', 1.4)}/><path d="M ${f(x - 1 * k + r)} ${f(y - hh * k)} L ${f(x + 0.5)} ${f(y)}" stroke="#fff" stroke-width=".9" opacity=".75"/>`; }).join('');
      case 'tuft': { const x = cx - W * 0.2, y = top(x); return front ? '' : `<path d="M ${f(x - 9 * k)} ${f(y + 5)} Q ${f(x - 10 * k)} ${f(y - 12 * k)} ${f(x + 2 * k)} ${f(y - 13 * k)} Q ${f(x - 4 * k)} ${f(y - 7 * k)} ${f(x + 3 * k)} ${f(y - 4 * k)} Q ${f(x + 10 * k)} ${f(y - 10 * k)} ${f(x + 11 * k)} ${f(y - 5 * k)} Q ${f(x + 8 * k)} ${f(y + 1)} ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${shade(skin, -0.12)}" ${STROKE(dk, 1.8)}/>`; }
      default: return '';
    }
  }

  // Manos según la casa
  const Pm2 = (kind) => PRESET[kind] || PRESET.round;
  function armSvg(ind, P, side) {
    const { cx, cy, W, H, skin, dk, s, house } = P, k = ind.armScale * s * (0.75 + P.stage * 0.12);
    const near = side === 'near', d = near ? -1 : 1;
    // v4.57: el brazo de detrás sale del borde del cuerpo y la mano asoma (en cuerpos grandes quedaba tapado)
    const edge = Pm2(P.kind).pear ? 1 + Pm2(P.kind).pear * 0.08 : 1;
    const sx = near ? cx - W * 0.9 : cx + W * 0.9 * edge, sy = cy + H * 0.08;
    // v4.62: tipo de brazo del individuo (más cortos, largos, de fideo, pinzas o manoplas)
    const A = ind.arms, reach = A === 'long' ? 1.7 : A === 'stubby' ? 0.55 : 1;
    const hx = sx + d * (near ? 5 : 7) * k * reach, hy = sy + 9 * k * reach;
    if (A === 'noodle') {
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} C ${f(sx + d * 10 * k)} ${f(sy - 6 * k)} ${f(sx - d * 2 * k)} ${f(sy + 10 * k)} ${f(sx + d * 8 * k)} ${f(sy + 13 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(2.8 * k)}" stroke-linecap="round"/><circle cx="${f(sx + d * 8 * k)}" cy="${f(sy + 13 * k)}" r="${f(3 * k)}" fill="${shade(skin, 0.2)}" ${STROKE(dk, 1.3)}/>`;
    }
    const arm = `<path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>`;
    const H_ = HOUSES[house];
    if (A === 'pincer') return arm + `<path d="M ${f(hx)} ${f(hy - 1 * k)} q ${f(d * 7 * k)} ${f(-6 * k)} ${f(d * 8 * k)} ${f(1 * k)} l ${f(-d * 4 * k)} ${f(-0.5 * k)} q ${f(d * 3 * k)} ${f(5 * k)} ${f(-d * 5 * k)} ${f(5 * k)} q ${f(-d * 3 * k)} ${f(-2 * k)} ${f(-d * 1 * k)} ${f(-5.5 * k)} Z" fill="${shade(skin, -0.12)}" ${STROKE(dk, 1.5)}/>`;
    if (A === 'mitten') return arm + `<ellipse cx="${f(hx)}" cy="${f(hy + 0.5 * k)}" rx="${f(6 * k)}" ry="${f(5.2 * k)}" fill="#f5f0e6" ${STROKE(dk, 1.6)}/><ellipse cx="${f(hx - d * 4.5 * k)}" cy="${f(hy - 2 * k)}" rx="${f(2.2 * k)}" ry="${f(2.8 * k)}" fill="#f5f0e6" ${STROKE(dk, 1.3)}/><path d="M ${f(hx - 5 * k)} ${f(hy + 3 * k)} h ${f(10 * k)}" stroke="#ef4444" stroke-width="${f(1.6 * k)}"/>`;
    switch (H_.hands) {
      case 'paw': return arm + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(4.8 * k)}" ry="${f(4.2 * k)}" fill="${shade(skin, 0.25)}" ${STROKE(dk, 1.6)}/>` + [-1, 0, 1].map((i) => `<circle cx="${f(hx + i * 1.9 * k)}" cy="${f(hy + 1.6 * k)}" r="${f(0.9 * k)}" fill="#f9a8d4"/>`).join('');
      case 'claw': return arm.replace(`stroke-width="${f(4.6 * k)}"`, `stroke-width="${f(3.6 * k)}"`) + [-1, 0, 1].map((i) => `<path d="M ${f(hx + i * 1.6 * k)} ${f(hy - 1 * k)} q ${f(d * 1.5 * k + i * k)} ${f(4 * k)} ${f(d * -1 * k + i * 1.5 * k)} ${f(6 * k)}" fill="none" stroke="#1a1430" stroke-width="${f(1.8 * k)}" stroke-linecap="round"/>`).join('');
      case 'ember': return arm + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(4.2 * k)}" ry="${f(3.8 * k)}" fill="${skin}" ${STROKE(dk, 1.6)}/>` + [-1, 0, 1].map((i) => `<path d="M ${f(hx + i * 2.2 * k - 1)} ${f(hy + 2.5 * k)} l ${f(1 * k)} ${f(3.4 * k)} l ${f(1 * k)} ${f(-3.4 * k)} Z" fill="#fde047" ${STROKE('#7c2d12', 0.8)}/>`).join('');
      case 'flipper': return arm + `<path d="M ${f(hx - 3 * k)} ${f(hy - 3 * k)} Q ${f(hx + d * 9 * k)} ${f(hy)} ${f(hx + d * 3 * k)} ${f(hy + 8 * k)} Q ${f(hx - d * 2 * k)} ${f(hy + 4 * k)} ${f(hx - 3 * k)} ${f(hy - 3 * k)} Z" fill="${shade(skin, 0.2)}" ${STROKE(dk, 1.6)}/><path d="M ${f(hx)} ${f(hy - 1 * k)} L ${f(hx + d * 3 * k)} ${f(hy + 5 * k)} M ${f(hx - d * 1 * k)} ${f(hy)} L ${f(hx + d * 0.5 * k)} ${f(hy + 5.5 * k)}" stroke="${dk}" stroke-width=".8" opacity=".55"/>`;
      case 'fist': return arm.replace(`stroke-width="${f(7.5 * k)}"`, `stroke-width="${f(9 * k)}"`).replace(`stroke-width="${f(4.6 * k)}"`, `stroke-width="${f(6 * k)}"`) + `<rect x="${f(hx - 5.5 * k)}" y="${f(hy - 4.5 * k)}" width="${f(11 * k)}" height="${f(9 * k)}" rx="${f(2.6 * k)}" fill="#a8a29e" ${STROKE('#44403c', 1.6)}/><path d="M ${f(hx - 3 * k)} ${f(hy - 4.5 * k)} v ${f(4 * k)} M ${f(hx)} ${f(hy - 4.5 * k)} v ${f(4 * k)} M ${f(hx + 3 * k)} ${f(hy - 4.5 * k)} v ${f(4 * k)}" stroke="#57534e" stroke-width="1"/>`;
      default: return arm;
    }
  }

  // Patas (detrás = far, delante = near)
  function legsSvg(kind, P, layer) {
    const { cx, cy, W, H, skin, dk, groundY, s } = P, y0 = cy + H * 0.78, dark = shade(skin, -0.22);
    const foot = (x, y, rx, ry, c) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${STROKE(dk, 1.8)}/>`;
    const toes = (x, y, r) => [-1, 0, 1].map((i) => `<path d="M ${f(x + i * r * 0.55)} ${f(y + r * 0.2)} v ${f(-r * 0.5)}" stroke="${dk}" stroke-width=".9" opacity=".6"/>`).join('');
    const pillar = (x, w, c) => `<path d="M ${f(x - w / 2)} ${f(y0 - 4)} C ${f(x - w * 0.62)} ${f((y0 + groundY) / 2)} ${f(x - w * 0.62)} ${f(groundY - 2)} ${f(x - w * 0.3)} ${f(groundY)} L ${f(x + w * 0.3)} ${f(groundY)} C ${f(x + w * 0.62)} ${f(groundY - 2)} ${f(x + w * 0.55)} ${f((y0 + groundY) / 2)} ${f(x + w / 2)} ${f(y0 - 4)} Z" fill="${c}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + w * 0.22)} ${f(y0)} Q ${f(x + w * 0.3)} ${f((y0 + groundY) / 2)} ${f(x + w * 0.2)} ${f(groundY - 3)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="${f(w * 0.25)}" stroke-linecap="round"/>`;
    switch (kind) {
      case 'stubby': return layer === 'near' ? foot(cx - W * 0.42, groundY - 2.5, 7 * s, 4.6 * s, dark) + foot(cx + W * 0.36, groundY - 2.5, 7 * s, 4.6 * s, dark) : '';
      case 'paws': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.34].map((x) => pillar(x, 9 * s, skin) + foot(x - 1.5, groundY - 2.2, 6.5 * s, 4 * s, shade(skin, 0.15)) + toes(x - 1.5, groundY - 2.2, 4 * s)).join('') : '';
      case 'quad': return (layer === 'far' ? [cx - W * 0.2, cx + W * 0.62] : [cx - W * 0.55, cx + W * 0.3]).map((x) => pillar(x, 9 * s, layer === 'far' ? dark : skin) + foot(x - 1, groundY - 2, 6 * s, 3.6 * s, shade(skin, layer === 'far' ? -0.3 : 0.1))).join('');
      case 'pillars': return (layer === 'far' ? [cx - W * 0.15, cx + W * 0.6] : [cx - W * 0.55, cx + W * 0.28]).map((x) => pillar(x, 13 * s, layer === 'far' ? dark : skin) + [-1, 0, 1].map((i) => `<ellipse cx="${f(x + i * 3.6 * s)}" cy="${f(groundY - 1.5)}" rx="${f(1.6 * s)}" ry="${f(1.1 * s)}" fill="#f5f0e6" opacity=".9"/>`).join('')).join('');
      case 'digi': return (layer === 'far' ? [cx + W * 0.5] : [cx - W * 0.42]).map((x) => `<ellipse cx="${f(x)}" cy="${f(y0 - 2)}" rx="${f(8 * s)}" ry="${f(10 * s)}" fill="${layer === 'far' ? dark : skin}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + 2 * s)} ${f(y0 + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(6 * s)}" stroke-linecap="round"/><path d="M ${f(x + 2 * s)} ${f(y0 + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${layer === 'far' ? dark : skin}" stroke-width="${f(3.6 * s)}" stroke-linecap="round"/>` + foot(x - 2, groundY - 2.4, 8 * s, 3.4 * s, shade(skin, -0.25)) + toes(x - 4, groundY - 2.4, 4 * s)).join('');
      case 'tall': return layer === 'near' ? [cx - W * 0.25, cx + W * 0.22].map((x) => `<path d="M ${f(x)} ${f(y0 - 3)} L ${f(x)} ${f(groundY - 2)} M ${f(x)} ${f(groundY - 2)} l ${f(-5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(4.5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(-0.5)} ${f(2.4)}" fill="none" stroke="#c2410c" stroke-width="${f(2.6 * s)}" stroke-linecap="round"/>`).join('') : '';
      case 'peg': return layer === 'near' ? [cx - W * 0.3, cx + W * 0.25].map((x) => `<path d="M ${f(x)} ${f(y0 - 3)} V ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(4.2 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 3)} V ${f(groundY - 3)}" stroke="${shade(skin, -0.1)}" stroke-width="${f(2.2 * s)}" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(groundY - 2.5)}" r="${f(3.4 * s)}" fill="${dark}" ${STROKE(dk, 1.4)}/>`).join('') : '';
      case 'stilts': return layer === 'near' ? [cx - W * 0.25, cx + W * 0.2].map((x, i) => `<path d="M ${f(x)} ${f(y0 - 3)} L ${f(x + (i ? 2 : -2))} ${f(groundY - 2)}" stroke="${dk}" stroke-width="${f(3.6 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 3)} L ${f(x + (i ? 2 : -2))} ${f(groundY - 2)}" stroke="${skin}" stroke-width="${f(1.8 * s)}" stroke-linecap="round"/>` + foot(x + (i ? 2 : -2), groundY - 1.8, 4.6 * s, 2.2 * s, dark)).join('') : '';
      case 'webbed': return layer === 'near' ? [cx - W * 0.4, cx + W * 0.32].map((x) => `<path d="M ${f(x)} ${f(y0 - 2)} V ${f(groundY - 3)}" stroke="#ea580c" stroke-width="${f(3 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(groundY - 3)} l ${f(-6 * s)} ${f(3)} l ${f(4 * s)} 0 l ${f(2 * s)} -1 l ${f(2 * s)} 1 l ${f(4 * s)} 0 Z" fill="#fb923c" ${STROKE('#9a3412', 1.2)}/>`).join('') : '';
      case 'spring': return layer === 'near' ? [cx - W * 0.28, cx + W * 0.22].map((x) => { let d = `M ${f(x)} ${f(y0 - 3)}`; const n = 5, hgt = groundY - 4 - (y0 - 3); for (let i = 1; i <= n; i++) d += ` L ${f(x + (i % 2 ? 4 : -4) * s)} ${f(y0 - 3 + (hgt * i) / n)}`; return `<path d="${d}" fill="none" stroke="#a8a29e" stroke-width="${f(2 * s)}" stroke-linejoin="round"/>` + foot(x, groundY - 2.4, 6 * s, 3 * s, dark); }).join('') : '';
      case 'bigfoot': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.34].map((x) => `<path d="M ${f(x)} ${f(y0 - 3)} V ${f(groundY - 5)}" stroke="${dk}" stroke-width="${f(7 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 3)} V ${f(groundY - 5)}" stroke="${skin}" stroke-width="${f(4.6 * s)}" stroke-linecap="round"/>` + foot(x - 2, groundY - 3, 10 * s, 4.4 * s, shade(skin, 0.12)) + [-1, 0, 1].map((i) => `<circle cx="${f(x - 2 - 7 * s + i * 2.4 * s)}" cy="${f(groundY - 4.5)}" r="${f(1.3 * s)}" fill="#f5f0e6" ${STROKE(dk, 0.7)}/>`).join('')).join('') : '';
      case 'hooves': return (layer === 'far' ? [cx - W * 0.18, cx + W * 0.6] : [cx - W * 0.52, cx + W * 0.28]).map((x) => pillar(x, 8 * s, layer === 'far' ? dark : skin) + `<path d="M ${f(x - 4.6 * s)} ${f(groundY - 4 * s)} h ${f(9.2 * s)} l ${f(0.6 * s)} ${f(4 * s)} h ${f(-10.4 * s)} Z" fill="#3f3f46" ${STROKE(dk, 1.4)}/><path d="M ${f(x)} ${f(groundY - 3.6 * s)} v ${f(3.4 * s)}" stroke="#18181b" stroke-width="1"/>`).join('');
      case 'frog': return layer === 'near' ? [[cx - W * 0.5, -1], [cx + W * 0.4, 1]].map(([x, d]) => `<path d="M ${f(x)} ${f(y0 - 2)} Q ${f(x + d * 5 * s)} ${f(groundY - 6)} ${f(x + d * 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${dk}" stroke-width="${f(6.5 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 2)} Q ${f(x + d * 5 * s)} ${f(groundY - 6)} ${f(x + d * 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${skin}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` + [-1, 0, 1].map((i) => `<circle cx="${f(x + d * 2 * s + i * 3.6 * s)}" cy="${f(groundY - 1.6)}" r="${f(2.4 * s)}" fill="${shade(skin, 0.15)}" ${STROKE(dk, 1.2)}/>`).join('')).join('') : '';
      case 'talons': return layer === 'near' ? [cx - W * 0.3, cx + W * 0.25].map((x) => `<path d="M ${f(x)} ${f(y0 - 3)} L ${f(x - 1)} ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(6.4 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 3)} L ${f(x - 1)} ${f(groundY - 3)}" stroke="${shade(skin, -0.15)}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` + [-1, 0, 1].map((i) => `<path d="M ${f(x - 1)} ${f(groundY - 3)} q ${f(i * 3 * s)} ${f(1)} ${f(i * 4.5 * s - 0.5)} ${f(3)}" fill="none" stroke="#1c1917" stroke-width="${f(1.8 * s)}" stroke-linecap="round"/>`).join('')).join('') : '';
      case 'roots': return layer === 'near' ? [-0.55, -0.2, 0.15, 0.5].map((o, i) => { const x = cx + W * o, d = o < 0 ? -1 : 1; return `<path d="M ${f(x)} ${f(y0 - 6)} Q ${f(x + d * 2)} ${f(groundY - 4)} ${f(x + d * (5 + i % 2 * 3) * s)} ${f(groundY)}" fill="none" stroke="#3b2414" stroke-width="${f(4.2 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y0 - 6)} Q ${f(x + d * 2)} ${f(groundY - 4)} ${f(x + d * (5 + i % 2 * 3) * s)} ${f(groundY)}" fill="none" stroke="#8b5a2b" stroke-width="${f(2.4 * s)}" stroke-linecap="round"/>`; }).join('') : '';
      case 'puffs': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.3].map((x) => [[-3.5, 0, 3.6], [0, -2.5, 4.4], [3.8, 0, 3.4]].map(([ox, oy, r]) => `<circle cx="${f(x + ox * s)}" cy="${f(groundY - 6 + oy * s)}" r="${f(r * s)}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.1"/>`).join('')).join('') : '';
      case 'tentacles': return layer === 'near' ? [-0.55, -0.15, 0.25, 0.6].map((o, i) => { const x = cx + W * o; return `<path d="M ${f(x - 3)} ${f(y0 - 6)} Q ${f(x - 6 + (i % 2) * 9)} ${f(groundY - 6)} ${f(x + (i % 2 ? 4 : -5))} ${f(groundY - 1)} Q ${f(x + (i % 2 ? 1 : -1))} ${f(groundY - 6)} ${f(x + 4)} ${f(y0 - 6)} Z" fill="${i % 2 ? dark : skin}" ${STROKE(dk, 1.6)}/>`; }).join('') : '';
      default: return '';
    }
  }
  const LIFT = { none: 0, stubby: 0, paws: 4, quad: 9, pillars: 8, digi: 9, tall: 13, tentacles: 7, hover: 9, hooves: 9, frog: 3, talons: 11, roots: 6, puffs: 9, peg: 9, stilts: 16, webbed: 7, spring: 10, bigfoot: 7 };

  // Pelo / textura según la casa (recortado al cuerpo)
  function furSvg(ind, P, clip) {
    const { cx, cy, W, H, skin, dk, stage, house, top } = P, amt = ind.furAmt * (0.7 + stage * 0.25);
    const R = rng(ind.seed + 7);
    switch (HOUSES[house].fur) {
      case 'fluff': { // mechones suaves en la cabeza y mejillas
        const n = Math.round(3 + amt * 2), out = [];
        for (let i = 0; i < n; i++) { const x = cx - W * 0.6 + (i / (n - 1)) * W * 1.1, y = top(x) + 2; out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(3.4 + R() * 2.2)}" fill="${shade(skin, 0.35)}" ${STROKE(dk, 1.4)}/>`); }
        out.push(`<path d="M ${f(cx - W * 0.98)} ${f(cy + 2)} q -4 3 0 6 q -3 3 1 5" fill="${shade(skin, 0.3)}" ${STROKE(dk, 1.3)}/>`);
        return { back: out.join(''), clip: [0, 1, 2].map(() => `<path d="M ${f(cx - W + R() * W * 1.6)} ${f(cy - H * 0.2 + R() * H * 0.9)} l 1.5 -2.5 l 1.5 2.5 l -1.5 2.5 Z" fill="#fff" opacity=".7"/>`).join('') };
      }
      case 'smoke': { // volutas que suben de la espalda
        const out = [];
        for (let i = 0; i < Math.round(2 + amt); i++) { const x = cx + W * (0.1 + i * 0.25), y = top(x); out.push(`<path d="M ${f(x)} ${f(y + 3)} q ${f(-6 + R() * 4)} ${f(-6)} 0 ${f(-11 - i * 2)} q ${f(6)} ${f(-5)} ${f(-1)} ${f(-11)}" fill="none" stroke="${shade(skin, -0.45)}" stroke-width="${f(3.4 - i * 0.6)}" stroke-linecap="round" opacity=".55"/>`); }
        return { back: out.join(''), clip: `<path d="M ${f(cx + W * 0.1)} ${f(cy - H)} Q ${f(cx + W * 1.2)} ${f(cy - H * 0.3)} ${f(cx + W)} ${f(cy + H)} L ${f(cx + W * 1.3)} ${f(cy + H)} L ${f(cx + W * 1.3)} ${f(cy - H)} Z" fill="#0b0716" opacity=".28"/>` };
      }
      case 'flame': { // llamitas en la cabeza y brasas
        const out = [], n = Math.round(1 + amt * 1.5);
        for (let i = 0; i < n; i++) { const x = cx - W * 0.35 + i * W * 0.32, y = top(x) + 3, h = 12 + R() * 6 + stage * 2; out.push(`<path d="M ${f(x - 5)} ${f(y)} Q ${f(x - 6)} ${f(y - h * 0.6)} ${f(x + 1)} ${f(y - h)} Q ${f(x - 1)} ${f(y - h * 0.5)} ${f(x + 5)} ${f(y - h * 0.65)} Q ${f(x + 7)} ${f(y - h * 0.2)} ${f(x + 5)} ${f(y)} Z" fill="#fb923c" ${STROKE('#9a3412', 1.5)}/><path d="M ${f(x - 2)} ${f(y)} Q ${f(x - 2)} ${f(y - h * 0.4)} ${f(x + 1)} ${f(y - h * 0.6)} Q ${f(x + 3)} ${f(y - h * 0.3)} ${f(x + 2.5)} ${f(y)} Z" fill="#fde047"/>`); }
        return { back: out.join(''), clip: [0, 1, 2, 3].map(() => `<circle cx="${f(cx - W * 0.2 + R() * W * 1.1)}" cy="${f(cy - H * 0.1 + R() * H * 0.8)}" r="${f(1.2 + R() * 1.3)}" fill="#fde68a" opacity=".75"/>`).join('') };
      }
      case 'scales': { // escamas en la espalda y brillo húmedo
        let sc = '';
        for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = cx + W * 0.05 + c * 6 + (r % 2) * 3, y = cy - H * 0.75 + r * 6.5; sc += `<path d="M ${f(x - 3.5)} ${f(y)} q 3.5 4.5 7 0" fill="none" stroke="${shade(skin, -0.3)}" stroke-width="1.2" opacity=".6"/>`; }
        return { back: '', clip: sc + `<path d="M ${f(cx - W * 0.7)} ${f(cy - H * 0.55)} q ${f(W * 0.3)} ${f(-H * 0.3)} ${f(W * 0.7)} ${f(-H * 0.25)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>` };
      }
      case 'moss': { // musgo arriba y piedrecitas
        const pts = []; for (let i = 0; i <= 10; i++) { const x = cx - W * 1.1 + i * W * 0.22; pts.push(`${f(x)} ${f(cy - H * 0.66 + (i % 2 ? 4 : 0) + R() * 3)}`); }
        const moss = `<path d="M ${f(cx - W * 1.2)} ${f(cy - H * 1.3)} L ${pts.join(' L ')} L ${f(cx + W * 1.2)} ${f(cy - H * 1.3)} Z" fill="#4d7c0f" opacity=".85"/>`;
        const stones = [0, 1, 2].map((i) => `<ellipse cx="${f(cx + W * (0.15 + i * 0.25))}" cy="${f(cy + H * (-0.05 + (i % 2) * 0.3))}" rx="${f(3.4 + R() * 2)}" ry="${f(2.6 + R())}" fill="#a8a29e" stroke="#57534e" stroke-width="1.1"/>`).join('');
        return { back: '', clip: moss + stones };
      }
      default: return { back: '', clip: '' };
    }
  }

  function wingsSvg(ind, P) {
    const { cx, cy, W, H, skin, dk, house, s } = P, x = cx + W * 0.2, y = cy - H * 0.55, k = s * 1.05;
    switch (HOUSES[house].wing) {
      case 'feather': return [0, 1].map((i) => `<path d="M ${f(x - i * 6)} ${f(y + 6)} Q ${f(x + 18 * k)} ${f(y - 30 * k)} ${f(x + 34 * k - i * 8)} ${f(y - 20 * k + i * 4)} Q ${f(x + 26 * k)} ${f(y - 10 * k)} ${f(x + 30 * k - i * 6)} ${f(y - 4 * k)} Q ${f(x + 20 * k)} ${f(y)} ${f(x + 24 * k - i * 4)} ${f(y + 8 * k)} Q ${f(x + 10)} ${f(y + 8)} ${f(x - i * 6)} ${f(y + 6)} Z" fill="${i ? '#fff7dc' : '#fffdf5'}" ${STROKE(dk, 1.8)}/>`).join('');
      case 'bat': return `<path d="M ${f(x)} ${f(y + 6)} L ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 34 * k)} ${f(y - 16 * k)} Q ${f(x + 28 * k)} ${f(y - 6 * k)} ${f(x + 30 * k)} ${f(y + 2 * k)} Q ${f(x + 22 * k)} ${f(y - 2 * k)} ${f(x + 20 * k)} ${f(y + 8 * k)} Q ${f(x + 12 * k)} ${f(y + 2 * k)} ${f(x + 6)} ${f(y + 10)} Z" fill="${shade(skin, -0.35)}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 20 * k)} ${f(y + 8 * k)} M ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 30 * k)} ${f(y + 2 * k)}" stroke="${dk}" stroke-width="1.1" opacity=".6"/>`;
      case 'fin': return `<path d="M ${f(x)} ${f(y + 8)} Q ${f(x + 10 * k)} ${f(y - 26 * k)} ${f(x + 32 * k)} ${f(y - 18 * k)} Q ${f(x + 22 * k)} ${f(y - 4 * k)} ${f(x + 26 * k)} ${f(y + 8 * k)} Q ${f(x + 14 * k)} ${f(y + 2)} ${f(x)} ${f(y + 8)} Z" fill="${shade(skin, 0.35)}" opacity=".95" ${STROKE(dk, 1.8)}/>` + [0, 1, 2].map((i) => `<path d="M ${f(x + 3)} ${f(y + 6)} L ${f(x + (16 + i * 6) * k)} ${f(y - (18 - i * 7) * k)}" stroke="${dk}" stroke-width=".9" opacity=".45"/>`).join('');
      case 'crystal': return [[0.0, 20, -10], [0.3, 26, 6], [0.6, 18, 18]].map(([o, h, r]) => { const xx = cx + W * o, yy = P.top(xx) + 4; return `<path d="M ${f(xx - 5)} ${f(yy)} L ${f(xx - 1 + r * 0.15)} ${f(yy - h * k)} L ${f(xx + 5)} ${f(yy)} Z" fill="#a5f3fc" ${STROKE('#0e7490', 1.6)}/><path d="M ${f(xx - 1 + r * 0.15)} ${f(yy - h * k)} L ${f(xx + 0.5)} ${f(yy)}" stroke="#fff" stroke-width="1" opacity=".7"/>`; }).join('');
      default: return '';
    }
  }

  function tailSvg(tail, P) {
    const { cx, cy, W, H, skin, inner, dk, s, kind } = P, x = cx + W * (kind === 'long' ? 1.75 : 0.88), y = cy + H * (kind === 'long' ? 0.35 : 0.2), k = s;
    switch (tail) {
      case 'orb': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 12 * k)} ${f(y - 2)} ${f(x + 14 * k)} ${f(y - 18 * k)}" fill="none" stroke="${dk}" stroke-width="${f(6.5 * k)}" stroke-linecap="round"/><path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 12 * k)} ${f(y - 2)} ${f(x + 14 * k)} ${f(y - 18 * k)}" fill="none" stroke="${skin}" stroke-width="${f(3.8 * k)}" stroke-linecap="round"/><circle cx="${f(x + 14 * k)}" cy="${f(y - 21 * k)}" r="${f(6.5 * k)}" fill="#fff6c2" opacity=".5"/><circle cx="${f(x + 14 * k)}" cy="${f(y - 21 * k)}" r="${f(4.4 * k)}" fill="#fffbe8" ${STROKE(dk, 1.6)}/>`;
      case 'curl': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 18 * k)} ${f(y + 2)} ${f(x + 16 * k)} ${f(y - 16 * k)} Q ${f(x + 14 * k)} ${f(y - 26 * k)} ${f(x + 6 * k)} ${f(y - 20 * k)} Q ${f(x + 2 * k)} ${f(y - 14 * k)} ${f(x + 9 * k)} ${f(y - 12 * k)}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 18 * k)} ${f(y + 2)} ${f(x + 16 * k)} ${f(y - 16 * k)} Q ${f(x + 14 * k)} ${f(y - 26 * k)} ${f(x + 6 * k)} ${f(y - 20 * k)} Q ${f(x + 2 * k)} ${f(y - 14 * k)} ${f(x + 9 * k)} ${f(y - 12 * k)}" fill="none" stroke="${skin}" stroke-width="${f(4.2 * k)}" stroke-linecap="round"/>`;
      case 'flame': return `<path d="M ${f(x - 5)} ${f(y + 4)} Q ${f(x + 10 * k)} ${f(y + 2)} ${f(x + 12 * k)} ${f(y - 6 * k)}" fill="none" stroke="${skin}" stroke-width="${f(5 * k)}" stroke-linecap="round"/><path d="M ${f(x + 6 * k)} ${f(y - 2 * k)} Q ${f(x + 2 * k)} ${f(y - 18 * k)} ${f(x + 14 * k)} ${f(y - 30 * k)} Q ${f(x + 14 * k)} ${f(y - 20 * k)} ${f(x + 22 * k)} ${f(y - 18 * k)} Q ${f(x + 24 * k)} ${f(y - 4 * k)} ${f(x + 6 * k)} ${f(y - 2 * k)} Z" fill="#fb923c" ${STROKE('#9a3412', 1.6)}/><path d="M ${f(x + 9 * k)} ${f(y - 4 * k)} Q ${f(x + 8 * k)} ${f(y - 14 * k)} ${f(x + 15 * k)} ${f(y - 20 * k)} Q ${f(x + 19 * k)} ${f(y - 9 * k)} ${f(x + 9 * k)} ${f(y - 4 * k)} Z" fill="#fde047"/>`;
      case 'fin': return `<path d="M ${f(x - 5)} ${f(y + 2)} Q ${f(x + 8 * k)} ${f(y)} ${f(x + 12 * k)} ${f(y - 4 * k)} L ${f(x + 24 * k)} ${f(y - 16 * k)} Q ${f(x + 20 * k)} ${f(y - 2 * k)} ${f(x + 25 * k)} ${f(y + 10 * k)} L ${f(x + 12 * k)} ${f(y + 2 * k)} Q ${f(x + 4 * k)} ${f(y + 8 * k)} ${f(x - 5)} ${f(y + 6)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/>`;
      case 'spike': return `<path d="M ${f(x - 5)} ${f(y - 4)} Q ${f(x + 14 * k)} ${f(y - 6 * k)} ${f(x + 22 * k)} ${f(y - 12 * k)} Q ${f(x + 16 * k)} ${f(y + 2 * k)} ${f(x - 5)} ${f(y + 6)} Z" fill="${skin}" ${STROKE(dk, 1.8)}/>` + [0, 1, 2].map((i) => `<path d="M ${f(x + (2 + i * 6) * k)} ${f(y - (3 + i * 2.5) * k)} l ${f(2 * k)} ${f(-7 * k)} l ${f(3 * k)} ${f(6 * k)} Z" fill="#e7e5e4" ${STROKE(dk, 1.2)}/>`).join('');
      case 'leaf': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 10 * k)} ${f(y)} ${f(x + 12 * k)} ${f(y - 8 * k)}" fill="none" stroke="#3f6212" stroke-width="${f(3 * k)}" stroke-linecap="round"/><path d="M ${f(x + 12 * k)} ${f(y - 8 * k)} Q ${f(x + 4 * k)} ${f(y - 26 * k)} ${f(x + 24 * k)} ${f(y - 30 * k)} Q ${f(x + 28 * k)} ${f(y - 12 * k)} ${f(x + 12 * k)} ${f(y - 8 * k)} Z" fill="#84cc16" ${STROKE('#365314', 1.6)}/><path d="M ${f(x + 12 * k)} ${f(y - 8 * k)} L ${f(x + 22 * k)} ${f(y - 26 * k)}" stroke="#365314" stroke-width="1"/>`;
      default: return '';
    }
  }

  // Pelo (v4.52): flequillo, rizo, pinchos, coleta (detrás), mechones en las mejillas, barbita
  function hairSvg(ind, P, layer) {
    const { cx, cy, W, H, dk, top, fx, er, mx, my, s } = P, c = ind.hairColor || shade(P.skin, -0.3), st = STROKE(dk, 1.5);
    switch (ind.hair) {
      case 'fringe': { if (layer !== 'front') return ''; const x0 = fx - W * 0.42, x1 = fx + W * 0.42, y = top(fx) + 1; return `<path d="M ${f(x0)} ${f(top(x0) + 4)} Q ${f(fx)} ${f(y - 6)} ${f(x1)} ${f(top(x1) + 4)} L ${f(x1 - 2)} ${f(y + 8)} L ${f(fx + W * 0.2)} ${f(y + 5)} L ${f(fx + 2)} ${f(y + 9)} L ${f(fx - W * 0.18)} ${f(y + 5)} L ${f(x0 + 2)} ${f(y + 8)} Z" fill="${c}" ${st}/>`; }
      case 'curl': { if (layer !== 'front') return ''; const x = cx - W * 0.2, y = top(x) + 2; return `<path d="M ${f(x)} ${f(y)} q -2 -9 5 -11 q 6 -1 5 5 q -1 4 -5 3 q -3 -1 -1 -3" fill="none" stroke="${dk}" stroke-width="${f(4.2 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y)} q -2 -9 5 -11 q 6 -1 5 5 q -1 4 -5 3 q -3 -1 -1 -3" fill="none" stroke="${c}" stroke-width="${f(2.4 * s)}" stroke-linecap="round"/>`; }
      case 'spiky': { if (layer !== 'front') return ''; return [-0.5, -0.32, -0.14, 0.04].map((o, i) => { const x = cx + W * o, y = top(x) + 4, hh = (8 + (i % 2) * 4) * s; return `<path d="M ${f(x - 5)} ${f(y)} L ${f(x - 3 + i)} ${f(y - hh)} L ${f(x + 4)} ${f(y)} Z" fill="${c}" ${st}/>`; }).join(''); }
      case 'ponytail': { if (layer !== 'back') return ''; const x = cx + W * 0.45, y = top(x) + 4; return `<path d="M ${f(x)} ${f(y)} Q ${f(x + 16 * s)} ${f(y - 6)} ${f(x + 18 * s)} ${f(y + 10 * s)} Q ${f(x + 12 * s)} ${f(y + 6 * s)} ${f(x + 4)} ${f(y + 6)} Z" fill="${c}" ${st}/><circle cx="${f(x + 3)}" cy="${f(y + 2)}" r="${f(2.6 * s)}" fill="#ef4444" ${STROKE(dk, 1)}/>`; }
      case 'cheektufts': { if (layer !== 'front') return ''; return [[cx - W * 0.98, cy + H * 0.1, -1], [cx + W * 0.95, cy + H * 0.05, 1]].map(([x, y, d]) => `<path d="M ${f(x - d * 3)} ${f(y - 6)} l ${f(d * 7)} 2 l ${f(-d * 4)} 3 l ${f(d * 6)} 3 l ${f(-d * 5)} 2 l ${f(d * 3)} 4 l ${f(-d * 7)} -3 Z" fill="${c}" ${st}/>`).join(''); }
      case 'bun': { if (layer !== 'back') return ''; const x = cx - W * 0.05, y = top(x) - 2; return `<circle cx="${f(x)}" cy="${f(y - 4 * s)}" r="${f(7 * s)}" fill="${c}" ${st}/><path d="M ${f(x - 6 * s)} ${f(y + 1)} h ${f(12 * s)}" stroke="#ef4444" stroke-width="${f(2.4 * s)}" stroke-linecap="round"/>`; }
      case 'afro': { if (layer !== 'back') return ''; return [-0.75, -0.4, -0.05, 0.3, 0.62, -0.55, -0.15, 0.25].map((o, i) => { const x = cx + W * o, y = top(x) + (i > 4 ? -7 : 1) * s; return `<circle cx="${f(x)}" cy="${f(y)}" r="${f((i > 4 ? 8 : 7) * s)}" fill="${c}" ${st}/>`; }).join(''); }
      case 'swoop': { if (layer !== 'front') return ''; const x0 = fx - W * 0.5, x1 = fx + W * 0.55, y = top(fx); return `<path d="M ${f(x0)} ${f(top(x0) + 5)} Q ${f(fx - W * 0.1)} ${f(y - 9)} ${f(x1)} ${f(top(x1) + 2)} Q ${f(fx + W * 0.2)} ${f(y + 2)} ${f(fx - W * 0.35)} ${f(y + 10)} Q ${f(fx - W * 0.2)} ${f(y + 3)} ${f(x0)} ${f(top(x0) + 5)} Z" fill="${c}" ${st}/>`; }
      case 'braids': { if (layer !== 'back') return ''; return [[cx - W * 0.92, -1], [cx + W * 0.85, 1]].map(([x, d]) => [0, 1, 2, 3].map((i) => `<ellipse cx="${f(x + d * i * 0.6)}" cy="${f(cy - H * 0.35 + i * 5.2 * s)}" rx="${f(3.4 * s)}" ry="${f(3 * s)}" fill="${c}" ${STROKE(dk, 1.2)}/>`).join('') + `<circle cx="${f(x + d * 2.4)}" cy="${f(cy - H * 0.35 + 19 * s)}" r="${f(2 * s)}" fill="#ef4444" ${STROKE(dk, 1)}/>`).join(''); }
      case 'quiff': { if (layer !== 'front') return ''; const x = fx - W * 0.05, y = top(x) + 4; return `<path d="M ${f(x - 8 * s)} ${f(y)} Q ${f(x - 8 * s)} ${f(y - 16 * s)} ${f(x + 6 * s)} ${f(y - 15 * s)} Q ${f(x + 12 * s)} ${f(y - 14 * s)} ${f(x + 9 * s)} ${f(y - 8 * s)} Q ${f(x + 3 * s)} ${f(y - 11 * s)} ${f(x + 1 * s)} ${f(y - 4 * s)} Q ${f(x + 6 * s)} ${f(y - 1)} ${f(x + 7 * s)} ${f(y + 1)} Z" fill="${c}" ${st}/>`; }
      case 'beard': { if (layer !== 'front') return ''; return `<path d="M ${f(mx - 5 * s)} ${f(my + 3)} Q ${f(mx)} ${f(my + 13 * s)} ${f(mx + 5 * s)} ${f(my + 3)} Q ${f(mx)} ${f(my + 6)} ${f(mx - 5 * s)} ${f(my + 3)} Z" fill="${c}" ${st}/>`; }
      default: return '';
    }
  }

  function markSvg(ind, P) {
    const { cx, cy, W, H, inner, dk } = P, x = cx + W * 0.28, y = cy - H * 0.18;
    switch (ind.mark) {
      case 'star': return star(x, y, 5.5, 2.4, inner);
      case 'moon': return `<path d="M ${f(x + 2)} ${f(y - 5.5)} A 5.5 5.5 0 1 0 ${f(x + 2)} ${f(y + 5.5)} A 4.2 4.2 0 1 1 ${f(x + 2)} ${f(y - 5.5)} Z" fill="${inner}"/>`;
      case 'heart': return `<path d="M ${f(x)} ${f(y + 4.5)} C ${f(x - 8)} ${f(y - 1)} ${f(x - 4)} ${f(y - 7)} ${f(x)} ${f(y - 3)} C ${f(x + 4)} ${f(y - 7)} ${f(x + 8)} ${f(y - 1)} ${f(x)} ${f(y + 4.5)} Z" fill="#f472b6"/>`;
      case 'spots': return [[0.35, -0.5, 3.6], [0.62, -0.1, 2.8], [0.2, 0.1, 2.2], [0.55, 0.35, 2]].map(([ox, oy, r]) => `<circle cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" r="${f(r)}" fill="${shade(P.skin, -0.25)}" opacity=".7"/>`).join('');
      case 'stripes': return [0, 1, 2].map((i) => `<path d="M ${f(cx + W * 0.2 + i * 7)} ${f(cy - H * 0.95)} q 4 ${f(H * 0.4)} 0 ${f(H * 0.75)}" fill="none" stroke="${shade(P.skin, -0.35)}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`).join('');
      case 'zigzag': return `<path d="M ${f(cx + W * 0.15)} ${f(cy - H * 0.55)} l 4 4 l 4 -4 l 4 4 l 4 -4 l 4 4" fill="none" stroke="${inner}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      case 'freckles': return [[-0.62, 0.1], [-0.52, 0.18], [-0.7, 0.2], [0.05, 0.05], [0.14, 0.13], [0.0, 0.15]].map(([ox, oy]) => `<circle cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" r="1.2" fill="${shade(P.skin, -0.4)}" opacity=".75"/>`).join('');
      case 'patch': return `<ellipse cx="${f(P.fx - P.er * 1.25)}" cy="${f(P.ey)}" rx="${f(P.er * 2)}" ry="${f(P.er * 1.8)}" fill="${shade(P.skin, -0.35)}" opacity=".85"/>`;
      case 'band': return `<path d="M ${f(cx - W * 1.2)} ${f(cy + H * 0.05)} Q ${f(cx)} ${f(cy + H * 0.25)} ${f(cx + W * 1.2)} ${f(cy + H * 0.02)} L ${f(cx + W * 1.2)} ${f(cy + H * 0.24)} Q ${f(cx)} ${f(cy + H * 0.46)} ${f(cx - W * 1.2)} ${f(cy + H * 0.27)} Z" fill="${shade(P.skin, -0.3)}" opacity=".7"/>`;
      case 'swirl': { const sx = cx + W * 0.45, sy = cy - H * 0.1; return `<path d="M ${f(sx)} ${f(sy)} a 2 2 0 1 1 3 -1 a 4 4 0 1 1 -6 -3 a 6.5 6.5 0 1 1 10 4" fill="none" stroke="${inner}" stroke-width="2" stroke-linecap="round"/>`; }
      case 'blaze': return `<path d="M ${f(P.fx - 3)} ${f(cy - H * 1.05)} Q ${f(P.fx)} ${f(cy - H * 0.55)} ${f(P.fx - 1)} ${f(P.ey - P.er * 0.4)} Q ${f(P.fx + 3)} ${f(cy - H * 0.55)} ${f(P.fx + 6)} ${f(cy - H * 1.05)} Z" fill="${inner}" opacity=".9"/>`;
      case 'bolt': return `<path d="M ${f(x + 1)} ${f(y - 7)} L ${f(x - 4)} ${f(y + 1)} L ${f(x)} ${f(y + 1)} L ${f(x - 2)} ${f(y + 8)} L ${f(x + 5)} ${f(y - 1)} L ${f(x + 1)} ${f(y - 1)} Z" fill="#facc15" ${STROKE(dk, 1)}/>`;
      case 'chevron': return [0, 1].map((i) => `<path d="M ${f(cx - W * 0.42)} ${f(cy + H * (0.15 + i * 0.22))} L ${f(cx - W * 0.18)} ${f(cy + H * (0.3 + i * 0.22))} L ${f(cx + W * 0.06)} ${f(cy + H * (0.15 + i * 0.22))}" fill="none" stroke="${shade(P.skin, -0.32)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`).join('');
      case 'ring': return `<circle cx="${f(x)}" cy="${f(y)}" r="5.2" fill="none" stroke="${inner}" stroke-width="2.2"/><circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="${inner}"/>`;
      case 'bloom': return [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${f(x + Math.cos(a) * 3.4)}" cy="${f(y + Math.sin(a) * 3.4)}" r="2.4" fill="${inner}"/>`; }).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="1.9" fill="#facc15"/>`;
      case 'triad': return [[0, -4], [-4, 3], [4, 3]].map(([ox, oy]) => `<circle cx="${f(x + ox)}" cy="${f(y + oy)}" r="2.1" fill="${shade(P.skin, -0.35)}" opacity=".8"/>`).join('');
      case 'gem': return `<path d="M ${f(x)} ${f(y - 6)} L ${f(x + 5)} ${f(y)} L ${f(x)} ${f(y + 6)} L ${f(x - 5)} ${f(y)} Z" fill="#22d3ee" ${STROKE(dk, 1.3)}/><path d="M ${f(x - 2)} ${f(y - 2)} L ${f(x)} ${f(y - 4)}" stroke="#fff" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  function finalSvg(ind, P, layer) {
    const { cx, cy, W, H, dk, skin, top } = P;
    const hx = cx - W * 0.15, hy = top(hx);
    switch (ind.final) {
      case 'mane': if (layer !== 'back') return ''; return `<path d="${smooth(Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2, r = (i % 2 ? 1.0 : 1.22); return [cx - W * 0.25 + Math.cos(a) * W * 0.85 * r, cy - H * 0.2 + Math.sin(a) * H * 0.85 * r]; }))}" fill="${shade(skin, -0.3)}" ${STROKE(dk, 1.8)}/>`;
      case 'crown': if (layer !== 'front') return ''; return `<path d="M ${f(hx - 11)} ${f(hy + 3)} L ${f(hx - 12)} ${f(hy - 9)} L ${f(hx - 5.5)} ${f(hy - 3)} L ${f(hx)} ${f(hy - 13)} L ${f(hx + 5.5)} ${f(hy - 3)} L ${f(hx + 12)} ${f(hy - 9)} L ${f(hx + 11)} ${f(hy + 3)} Z" fill="#facc15" ${STROKE('#713f12', 1.6)}/><circle cx="${f(hx)}" cy="${f(hy - 2)}" r="2.3" fill="#ef4444"/>`;
      case 'halo': if (layer !== 'back') return ''; return `<ellipse cx="${f(hx)}" cy="${f(hy - 12)}" rx="13" ry="4" fill="none" stroke="#fde047" stroke-width="3"/><ellipse cx="${f(hx)}" cy="${f(hy - 12)}" rx="13" ry="4" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>`;
      case 'aura': if (layer !== 'back') return ''; return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(W * 1.55)}" ry="${f(H * 1.5)}" fill="url(#aura${P.id})"/>`;
      case 'orbit': if (layer !== 'front') return ''; return `<ellipse cx="${f(cx)}" cy="${f(cy - H * 0.1)}" rx="${f(W * 1.35)}" ry="${f(H * 0.42)}" fill="none" stroke="${shade(skin, 0.4)}" stroke-width="1.2" opacity=".45" stroke-dasharray="3 3"/>` + [[-0.9, 0.2], [0.95, -0.15], [0.2, 0.45]].map(([ox, oy]) => `<circle cx="${f(cx + W * 1.35 * ox)}" cy="${f(cy - H * 0.1 + H * 0.42 * oy * 2)}" r="3.6" fill="${shade(skin, 0.55)}" ${STROKE(dk, 1.2)}/><circle cx="${f(cx + W * 1.35 * ox - 1)}" cy="${f(cy - H * 0.1 + H * 0.42 * oy * 2 - 1)}" r="1.1" fill="#fff"/>`).join('');
      case 'runes': if (layer !== 'front') return ''; return [[-1.1, -0.9], [0.95, -1.05], [1.25, 0.1]].map(([ox, oy], i) => { const x = cx + W * ox, y = cy + H * oy; const g = ['M -3 -4 L 0 4 L 3 -4', 'M -3 -4 V 4 M -3 0 L 3 -4 M -3 0 L 3 4', 'M 0 -4 V 4 M -3 -1 H 3'][i]; return `<g transform="translate(${f(x)} ${f(y)})"><circle r="6" fill="${shade(skin, 0.5)}" opacity=".18"/><path d="${g}" fill="none" stroke="${shade(skin, 0.6)}" stroke-width="1.6" stroke-linecap="round"/></g>`; }).join('');
      case 'scarf': { if (layer !== 'front') return ''; const y = cy - H * 0.02, c = hue(skin, 170); return `<path d="M ${f(cx - W * 0.92)} ${f(y - 3)} Q ${f(cx)} ${f(y + 6)} ${f(cx + W * 0.9)} ${f(y - 4)} L ${f(cx + W * 0.9)} ${f(y + 3)} Q ${f(cx)} ${f(y + 13)} ${f(cx - W * 0.92)} ${f(y + 4)} Z" fill="${c}" ${STROKE(dk, 1.6)}/><path d="M ${f(cx + W * 0.5)} ${f(y + 5)} l 4 14 l 6 -2 l -3 -13 Z" fill="${shade(c, -0.15)}" ${STROKE(dk, 1.4)}/>`; }
      case 'thorns': if (layer !== 'back') return ''; return [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((o) => { const x = cx + W * o, y = top(x) + 4, hh = 10 + (1 - Math.abs(o)) * 6; return `<path d="M ${f(x - 4)} ${f(y)} L ${f(x + o * 4)} ${f(y - hh)} L ${f(x + 4)} ${f(y)} Z" fill="${shade(skin, -0.55)}" ${STROKE(dk, 1.4)}/>`; }).join('');
      case 'cape': { if (layer !== 'back') return ''; const c = hue(skin, 180), c2 = shade(c, -0.25); return `<path d="M ${f(cx - W * 0.75)} ${f(cy - H * 0.75)} Q ${f(cx + W * 0.3)} ${f(cy - H * 0.95)} ${f(cx + W * 1.15)} ${f(cy - H * 0.55)} Q ${f(cx + W * 1.6)} ${f(cy + H * 0.3)} ${f(cx + W * 1.5)} ${f(cy + H * 1.05)} Q ${f(cx + W * 1.1)} ${f(cy + H * 0.85)} ${f(cx + W * 0.7)} ${f(cy + H * 1.1)} Q ${f(cx)} ${f(cy + H * 0.9)} ${f(cx - W * 0.6)} ${f(cy + H * 1.1)} Q ${f(cx - W * 1.0)} ${f(cy + H * 0.9)} ${f(cx - W * 1.35)} ${f(cy + H * 1.0)} Q ${f(cx - W * 1.35)} ${f(cy - H * 0.2)} ${f(cx - W * 0.75)} ${f(cy - H * 0.75)} Z" fill="${c2}" ${STROKE(dk, 1.6)}/><path d="M ${f(cx + W * 1.15)} ${f(cy - H * 0.5)} Q ${f(cx + W * 1.45)} ${f(cy + H * 0.3)} ${f(cx + W * 1.4)} ${f(cy + H * 0.95)}" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/>`; }
      case 'flowercrown': if (layer !== 'front') return ''; return [-0.55, -0.3, -0.05, 0.2].map((o, i) => { const x = cx + W * o, y = top(x) + 2; const pc = ['#f9a8d4', '#fde047', '#c4b5fd', '#fdba74'][i]; return [0, 1, 2, 3, 4].map((j) => { const a = (j / 5) * Math.PI * 2; return `<circle cx="${f(x + Math.cos(a) * 2.6)}" cy="${f(y + Math.sin(a) * 2.6)}" r="2.1" fill="${pc}" ${STROKE(dk, 0.7)}/>`; }).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="#f59e0b"/>`; }).join('');
      case 'bandana': { if (layer !== 'front') return ''; const y = top(hx) + 5, c = '#dc2626'; return `<path d="M ${f(cx - W * 0.92)} ${f(y + 3)} Q ${f(hx)} ${f(y - 4)} ${f(cx + W * 0.7)} ${f(y + 2)} L ${f(cx + W * 0.72)} ${f(y + 7)} Q ${f(hx)} ${f(y + 1)} ${f(cx - W * 0.9)} ${f(y + 8)} Z" fill="${c}" ${STROKE(dk, 1.4)}/><path d="M ${f(cx + W * 0.7)} ${f(y + 3)} l 9 -3 l -2 6 Z M ${f(cx + W * 0.7)} ${f(y + 5)} l 8 5 l -6 2 Z" fill="${c}" ${STROKE(dk, 1.2)}/>` + [-0.5, -0.1, 0.3].map((o) => `<circle cx="${f(cx + W * o)}" cy="${f(y + 3)}" r="1" fill="#fff"/>`).join(''); }
      case 'goggles': { if (layer !== 'front') return ''; const y = top(hx) + 4; return `<path d="M ${f(cx - W * 0.95)} ${f(y + 2)} Q ${f(hx)} ${f(y - 3)} ${f(cx + W * 0.75)} ${f(y + 2)}" fill="none" stroke="#3f2a1d" stroke-width="2.6"/>` + [hx - 6, hx + 6].map((x) => `<circle cx="${f(x)}" cy="${f(y)}" r="4.6" fill="#7dd3fc" stroke="#78716c" stroke-width="2"/><circle cx="${f(x - 1.4)}" cy="${f(y - 1.4)}" r="1.2" fill="#fff"/>`).join(''); }
      case 'collar': { if (layer !== 'front') return ''; const y = cy - H * 0.02; return `<path d="M ${f(cx - W * 0.9)} ${f(y - 2)} Q ${f(cx)} ${f(y + 6)} ${f(cx + W * 0.88)} ${f(y - 3)} L ${f(cx + W * 0.88)} ${f(y + 2)} Q ${f(cx)} ${f(y + 11)} ${f(cx - W * 0.9)} ${f(y + 3)} Z" fill="#292524" ${STROKE(dk, 1.3)}/>` + [-0.6, -0.2, 0.2, 0.6].map((o) => { const x = cx + W * o, yy = y + 5 + (1 - Math.abs(o)) * 2.4; return `<path d="M ${f(x - 2)} ${f(yy)} l 2 4 l 2 -4 Z" fill="#d6d3d1" ${STROKE(dk, 0.6)}/>`; }).join(''); }
      case 'gemstone': if (layer !== 'front') return ''; return `<path d="M ${f(cx - W * 0.2)} ${f(cy - H * 0.62)} l 5 -6 h 8 l 5 6 l -9 10 Z" fill="#c084fc" ${STROKE('#581c87', 1.5)}/><path d="M ${f(cx - W * 0.2 + 3)} ${f(cy - H * 0.62 - 3)} l 3 -2" stroke="#fff" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  let SEQ = 0;
  // v4.51: el crecimiento entre etapas se nota (antes el encuadre crecía casi igual que el cuerpo y
  // las 4 formas se veían del mismo tamaño). Las primeras formas suelen ser pequeñas.
  const GROWTH = [0.68, 0.94, 1.17, 1.38];
  const VIEW_SIDE = [112, 118, 126, 136];

  /**
   * Dibuja un individuo en una etapa visual (0..3).
   * o: { tail, final (¿forma final?), flip, shiny, focus ('eyes'|'mouth'|'ears'|'legs'|'mark'|'full'), plain (sin pelo/brazos/cola) }
   */
  /** v4.63: distintivo del variocolor. Cada uno lleva una marca propia pegada al cuerpo:
   * la forma, el color, el sitio, el tamaño y el giro salen de su semilla (no hay dos iguales). */
  const SHINY_COLORS = ['#fde047', '#f8fafc', '#67e8f9', '#f9a8d4', '#bef264', '#c4b5fd', '#fdba74'];
  const SHINY_SHAPES = ['sparkle', 'star', 'diamond', 'crescent', 'heart', 'bolt', 'ring', 'constellation', 'flower', 'comet'];
  function shinyMarkSvg(ind, P) {
    const R = rng(((ind.seed >>> 0) ^ 0x5b1e7) || 7);
    const shape = SHINY_SHAPES[Math.floor(R() * SHINY_SHAPES.length)], col = SHINY_COLORS[Math.floor(R() * SHINY_COLORS.length)];
    const { cx, cy, W, H, dk } = P;
    const x = cx + W * (0.14 + R() * 0.3), y = cy + H * (-0.25 + R() * 0.45), r = clamp(W * (0.27 + R() * 0.1), 5.5, 12.5), rot = Math.round(R() * 70 - 35);
    const st = `stroke="${dk}" stroke-width="1.4" stroke-linejoin="round"`;
    const sp4 = (X, Y, q) => `<path d="M ${f(X)} ${f(Y - q)} Q ${f(X + q * 0.18)} ${f(Y - q * 0.18)} ${f(X + q)} ${f(Y)} Q ${f(X + q * 0.18)} ${f(Y + q * 0.18)} ${f(X)} ${f(Y + q)} Q ${f(X - q * 0.18)} ${f(Y + q * 0.18)} ${f(X - q)} ${f(Y)} Q ${f(X - q * 0.18)} ${f(Y - q * 0.18)} ${f(X)} ${f(Y - q)} Z" fill="${col}" ${st}/>`;
    let g;
    switch (shape) {
      case 'sparkle': g = sp4(x, y, r * 1.15); break;
      case 'star': g = star(x, y, r, r * 0.45, col).replace('/>', ` ${st}/>`); break;
      case 'diamond': g = `<path d="M ${f(x)} ${f(y - r * 1.1)} L ${f(x + r * 0.7)} ${f(y)} L ${f(x)} ${f(y + r * 1.1)} L ${f(x - r * 0.7)} ${f(y)} Z" fill="${col}" ${st}/><path d="M ${f(x - r * 0.7)} ${f(y)} L ${f(x + r * 0.7)} ${f(y)}" stroke="#fff" stroke-width=".8" opacity=".7"/>`; break;
      case 'crescent': g = `<path d="M ${f(x + r * 0.3)} ${f(y - r)} A ${f(r)} ${f(r)} 0 1 0 ${f(x + r * 0.3)} ${f(y + r)} A ${f(r * 0.75)} ${f(r * 0.75)} 0 1 1 ${f(x + r * 0.3)} ${f(y - r)} Z" fill="${col}" ${st}/>`; break;
      case 'heart': g = `<path d="M ${f(x)} ${f(y + r * 0.9)} C ${f(x - r * 1.4)} ${f(y - r * 0.1)} ${f(x - r * 0.7)} ${f(y - r * 1.2)} ${f(x)} ${f(y - r * 0.4)} C ${f(x + r * 0.7)} ${f(y - r * 1.2)} ${f(x + r * 1.4)} ${f(y - r * 0.1)} ${f(x)} ${f(y + r * 0.9)} Z" fill="${col}" ${st}/>`; break;
      case 'bolt': g = `<path d="M ${f(x + r * 0.2)} ${f(y - r * 1.1)} L ${f(x - r * 0.55)} ${f(y + r * 0.1)} L ${f(x)} ${f(y + r * 0.1)} L ${f(x - r * 0.25)} ${f(y + r * 1.1)} L ${f(x + r * 0.6)} ${f(y - r * 0.2)} L ${f(x + r * 0.05)} ${f(y - r * 0.2)} Z" fill="${col}" ${st}/>`; break;
      case 'ring': g = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.8)}" fill="none" stroke="${dk}" stroke-width="${f(r * 0.5)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.8)}" fill="none" stroke="${col}" stroke-width="${f(r * 0.3)}"/>`; break;
      case 'constellation': { const pts = [[0, 0], [r * 1.1, -r * 0.6], [r * 0.4, r * 0.9]].map(([a, b]) => [x - r * 0.4 + a, y + b]);
        g = `<path d="M ${pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L ')}" fill="none" stroke="${col}" stroke-width=".8" opacity=".75"/>` + pts.map((p, i) => sp4(p[0], p[1], r * (i ? 0.48 : 0.7))).join(''); break; }
      case 'flower': g = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${f(x)}" cy="${f(y - r * 0.55)}" rx="${f(r * 0.36)}" ry="${f(r * 0.55)}" fill="${col}" ${st} transform="rotate(${a} ${f(x)} ${f(y)})"/>`).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="#fff" ${st}/>`; break;
      default: g = `<path d="M ${f(x + r * 0.3)} ${f(y - r * 0.3)} Q ${f(x - r * 0.9)} ${f(y + r * 0.2)} ${f(x - r * 1.5)} ${f(y + r * 1.1)} Q ${f(x - r * 0.4)} ${f(y + r * 0.7)} ${f(x + r * 0.6)} ${f(y + r * 0.3)} Z" fill="${col}" opacity=".7"/>` + star(x + r * 0.4, y - r * 0.2, r * 0.8, r * 0.36, col).replace('/>', ` ${st}/>`);
    }
    // Un brillo que va y viene sobre la marca
    const glint = `<circle cx="${f(x - r * 0.25)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.22)}" fill="#fff"><animate attributeName="opacity" values="0;.95;0" dur="${(2.2 + R() * 1.6).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
    const halo = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.45)}" fill="${col}" opacity=".22"/>`;
    return `<g class="shiny-mark" transform="rotate(${rot} ${f(x)} ${f(y)})">${halo}${g}${glint}</g>`;
  }

  function draw(ind, st, o = {}) {
    const id = 'lk' + (++SEQ), H_ = HOUSES[ind.house] || HOUSES.luz;
    const grow = GROWTH[st] * ind.size * (st === 0 ? ind.baby : 1), s = clamp(0.85 + (grow - 1) * 0.55, 0.62, 1.25);
    const kind = ind.bodyFixed || (BODY_PATH[ind.body] || BODY_PATH.round)[st];
    const legKind = ind.legs === 'slither' ? 'none' : ind.legs === 'hover' ? 'hover' : (ALL_LEGS[ind.legs] ? ALL_LEGS[ind.legs][0][st] : ['stubby', 'paws', 'quad', 'quad'][st]);
    const Pm = PRESET[kind] || PRESET.round;
    const W = clamp(23 * grow * Pm.w, 11, 47), H = clamp(21 * grow * Pm.h, 10, 41);
    const groundY = 112, lift = LIFT[legKind] || 0;
    const cx = kind === 'long' ? 60 : 70, cy = groundY - H * (kind === 'ghost' ? 1.1 : 1) - lift - (kind === 'ghost' ? 6 : 0);
    const skin = o.shiny ? hue(ind.skin, 150) : ind.skin, dk = shade(skin, -0.58), inner = H_.belly, hornC = H_.horn;
    const top = (x) => { const u = clamp((x - cx) / W, -0.98, 0.98); return cy - H * Math.pow(1 - Math.pow(Math.abs(u), Pm.n || 2), 1 / (Pm.n || 2)) * (1 + (Pm.pear || 0) * -0.1); };
    const fx = cx - W * 0.3, er = clamp(W * 0.16, 3.6, 7) * ind.eyeScale;
    const ey = cy - H * 0.22, mx = fx + 0.5, my = ey + er * 1.6 + 2;
    const P = { id, cx, cy, W, H, skin, dk, inner, hornC, house: ind.house, stage: st, s, fx, ey, er, mx, my, top, groundY, kind };
    const body = bodyPath(kind, cx, cy, W, H, ind);
    const plain = !!o.plain;
    const fur = plain ? { back: '', clip: '' } : furSvg(ind, P);
    const wings = (!plain || o.wingsIcon) && ind.winged && (o.final || o.wingsIcon) ? wingsSvg(ind, P) : '';
    const isFinal = !!o.final;
    const segs = kind === 'long' ? [[0.95, 0.66, 0.2], [1.45, 0.48, 0.38]].map(([ox, r, oy]) => `<ellipse cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" rx="${f(H * r * 1.15)}" ry="${f(H * r)}" fill="url(#b${id})" ${STROKE(dk)}/><ellipse cx="${f(cx + W * ox - 2)}" cy="${f(cy + H * oy + H * r * 0.35)}" rx="${f(H * r * 0.6)}" ry="${f(H * r * 0.32)}" fill="${inner}" opacity=".8"/>`).reverse().join('') : '';
    const shadowRx = W * (legKind === 'hover' ? 0.7 : 1.05) * (kind === 'long' ? 1.6 : 1);
    const cheeks = ind.cheeks && !['glow', 'visor'].includes(ind.eyes) ? `<ellipse cx="${f(fx - er * 2.1)}" cy="${f(ey + er * 1.4)}" rx="${f(er * 0.75)}" ry="${f(er * 0.5)}" fill="#ff6b9a" opacity=".38"/><ellipse cx="${f(fx + er * 2.3)}" cy="${f(ey + er * 1.2)}" rx="${f(er * 0.7)}" ry="${f(er * 0.45)}" fill="#ff6b9a" opacity=".32"/>` : '';
    const belly = kind === 'ghost' ? '' : `<ellipse cx="${f(cx - W * 0.18)}" cy="${f(cy + H * 0.42)}" rx="${f(W * 0.58)}" ry="${f(H * 0.52)}" fill="${inner}" opacity=".9"/>`;
    // Encuadre: cuadrado por etapa, o un recorte para los iconos de rasgos
    let vb;
    const sq = (x, y, side) => [x - side / 2, y - side / 2, side, side];
    switch (o.focus) {
      case 'eyes': vb = sq(fx, ey, Math.max(er * 6.2, 24)); break;
      case 'mouth': vb = sq(mx, my + 1, Math.max(er * 4, 18)); break;
      case 'ears': vb = sq(cx - W * 0.12, cy - H * 0.92, W * 2.3); break;
      case 'legs': vb = sq(cx, groundY - 12, W * 2.6); break;
      case 'mark': vb = sq(cx + W * 0.25, cy - H * 0.2, W * 1.3); break;
      case 'full': { const side = Math.max(W, H) * 2.9; vb = [74 - side / 2, groundY + 6 - side, side, side]; break; }
      default: {
        // v4.58: centrado en vertical según lo que ocupa de verdad (antes iba pegado abajo y en
        // las formas pequeñas sobraba mucho arriba: se veían desplazados hacia abajo). Un poco
        // más de aire abajo que arriba para que «pise» el suelo.
        const side = VIEW_SIDE[st];
        const extraTop = (ind.ears && ind.ears !== 'none' ? 16 : 6) * s + (o.final && ['crown', 'halo', 'thorns'].includes(ind.final) ? 8 : 0) + (ind.hair === 'afro' || ind.hair === 'bun' ? 6 : 0);
        const cTop = cy - H - extraTop, cBot = groundY + 6, cH = cBot - cTop;
        const y0 = Math.max(118 - side, Math.min(cTop - (side - cH) * 0.42, cBot - side * 0.62));
        vb = [76 - side / 2, y0, side, side];
      }
    }
    const flip = o.flip ? `transform="translate(${f(vb[0] * 2 + vb[2])} 0) scale(-1 1)"` : '';
    // v4.62 quitó las 3 estrellitas sueltas (parecían puntos flotando); v4.63: una marca propia pegada al cuerpo
    const shinyMark = o.shiny && !o.focus ? shinyMarkSvg(ind, P) : '';
    return `<svg viewBox="${vb.map(f).join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img">` +
      `<defs><radialGradient id="b${id}" cx="34%" cy="26%" r="85%"><stop offset="0%" stop-color="${shade(skin, 0.42)}"/><stop offset="50%" stop-color="${skin}"/><stop offset="100%" stop-color="${shade(skin, -0.3)}"/></radialGradient>` +
      `<linearGradient id="ao${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/></linearGradient>` +
      `<radialGradient id="hl${id}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity=".55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="aura${id}"><stop offset="40%" stop-color="${H_.skins[0]}" stop-opacity=".0"/><stop offset="75%" stop-color="${H_.skins[0]}" stop-opacity=".35"/><stop offset="100%" stop-color="${H_.skins[0]}" stop-opacity="0"/></radialGradient>` +
      `<clipPath id="c${id}"><path d="${body}"/></clipPath></defs>` +
      `<g ${flip}><g class="sprite-body">` +
      (o.focus ? '' : `<ellipse class="sprite-shadow" cx="${f(cx + (kind === 'long' ? W * 0.5 : 0))}" cy="${groundY + 1}" rx="${f(shadowRx)}" ry="5" fill="#000" opacity="${legKind === 'hover' ? 0.12 : 0.22}"/>`) +
      (isFinal ? finalSvg(ind, P, 'back') : '') +
      `<g transform="rotate(${f(ind.lean * 10)} ${f(cx)} ${groundY})">` +
      (plain ? '' : tailSvg(o.tail, P)) + wings + fur.back + hairSvg(ind, P, 'back') + earsSvg(ind, P, false) + segs +
      legsSvg(legKind, P, 'far') + (plain ? '' : armSvg(ind, P, 'far')) +
      `<path d="${body}" fill="url(#b${id})"/>` +
      `<g clip-path="url(#c${id})">${belly}${fur.clip}${markSvg(ind, P)}<path d="${body}" fill="url(#ao${id})"/><ellipse cx="${f(cx - W * 0.35)}" cy="${f(cy - H * 0.55)}" rx="${f(W * 0.42)}" ry="${f(H * 0.28)}" fill="url(#hl${id})"/></g>` +
      `<path d="${body}" fill="none" ${STROKE(dk, 2.4)}/>` +
      legsSvg(legKind, P, 'near') + (plain ? '' : armSvg(ind, P, 'near')) + shinyMark + earsSvg(ind, P, true) +
      hairSvg(ind, P, 'front') + eyesSvg(ind, P) + cheeks + mouthSvg(ind, P) + (isFinal ? finalSvg(ind, P, 'front') : '') +
      `</g></g></g></svg>`;
  }

  /* ======================= API del juego ======================= */
  const hash = (str) => { let x = 2166136261; for (const ch of String(str)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  const rootOf = (sid) => { let r = sid, i = 0; while (D.species[r] && D.species[r].evolvedFrom && i++ < 8) r = D.species[r].evolvedFrom; return r; };
  const lineOf = (sid) => { const out = []; for (let c = rootOf(sid), i = 0; c && i < 8; i++) { out.push(c); c = D.species[c].evolve && D.species[c].evolve.into; } return out; };
  const VIS = { 1: [1], 2: [0, 2], 3: [0, 1, 3], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 3] };
  /** Etapa visual de una especie dentro de su línea: { st, final } */
  function stageOf(sid) {
    const line = lineOf(sid), i = Math.max(0, line.indexOf(sid)), n = Math.min(5, line.length);
    return { st: (VIS[n] || VIS[4])[Math.min(i, 4)], final: n > 1 && i === line.length - 1, index: i, length: line.length };
  }
  const indCache = new Map();
  /** Individuo resuelto para una especie y una semilla (cacheado). */
  function ind(sid, look) {
    const sp = D.species[sid], root = rootOf(sid);
    const seed = look && look.s != null ? look.s >>> 0 : hash('typ:' + root);
    const key = root + ':' + seed;
    if (indCache.has(key)) return indCache.get(key);
    const r = roll(sp.house || 'luz', seed);
    // La especie fija su cola y, en algunas, el cuerpo (fantasmas, serpientes sin patas)
    const sprite = (D.species[root] && D.species[root].sprite) || sp.sprite || {};
    r.tail = sprite.tail || 'none';
    if (sprite.body === 'ghost') { r.body = 'ghost'; r.legs = 'hover'; }
    else if (sprite.body === 'long' && sprite.legs === 'none') { r.body = 'long'; r.legs = 'slither'; }
    if (indCache.size > 600) indCache.clear();
    indCache.set(key, r);
    return r;
  }
  /** Aspecto nuevo al nacer (los jefes: el típico). */
  // v4.56: las semillas nuevas llevan la marca NEW3 en su byte bajo (pueden tener los rasgos nuevos)
  function rollLook(sid, o = {}) { return o.boss ? null : { s: ((Math.floor(Math.random() * 16777216) << 8) | NEW4_TAG) >>> 0 }; }
  /** Aspecto de un daskai (las partidas antiguas: sale fijo de su uid). */
  function lookOf(d, form) {
    if (!d) return null;
    if (d.boss) return null;
    if (!d.look) d.look = { s: hash('uid:' + (d.uid || d.species)) };
    // Con formas (v4.51) la etapa del dibujo sale de su forma, no de la especie
    const v = DK.daskai && DK.daskai.visual ? DK.daskai.visual(d, form) : null;
    return v ? { s: d.look.s, st: v.st, fin: v.final } : d.look;
  }
  /** SVG para la interfaz. */
  function svg(sid, look, { flip = false, shiny = false } = {}) {
    const g = stageOf(sid), i = ind(sid, look);
    const st = look && look.st != null ? look.st : g.st, fin = look && look.fin != null ? look.fin : g.final;
    return draw(i, st, { tail: i.tail, final: fin, flip, shiny });
  }

  /* ---------- Pixel art (bordes duros, pocos colores, contorno) ---------- */
  const PAD = 0.25, PIX_H = 64, PIX_W = Math.round(PIX_H * (1 + PAD * 2)), LEVELS = 8;
  const pxCache = new Map(), pxPending = new Map();
  const pxKey = (sid, look, shiny) => sid + ':' + (look && look.s != null ? look.s : 't') + (look && look.st != null ? '@' + look.st + (look.fin ? 'f' : '') : '') + (shiny ? '*' : '');
  function pixelCached(sid, look, { shiny = false } = {}) { return pxCache.get(pxKey(sid, look, shiny)) || null; }
  function pixel(sid, look, { shiny = false } = {}) {
    const key = pxKey(sid, look, shiny);
    if (pxCache.has(key)) return Promise.resolve(pxCache.get(key));
    if (pxPending.has(key)) return pxPending.get(key);
    let text = svg(sid, look, { shiny });
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(text);
    const [x, y, w, hh] = m.slice(1).map(Number);
    text = text.replace(m[0], `viewBox="${f(x - w * PAD)} ${f(y)} ${f(w * (1 + PAD * 2))} ${f(hh)}" width="${PIX_W}" height="${PIX_H}"`);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = PIX_W; c.height = PIX_H;
          const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, PIX_W, PIX_H);
          const data = ctx.getImageData(0, 0, PIX_W, PIX_H), px = data.data, step = 255 / (LEVELS - 1), solid = new Uint8Array(PIX_W * PIX_H);
          for (let i = 0; i < px.length; i += 4) {
            const a = px[i + 3], dark = px[i] + px[i + 1] + px[i + 2] < 90;
            if (a >= 120) { for (let k = 0; k < 3; k++) px[i + k] = Math.round(Math.round(px[i + k] / step) * step); px[i + 3] = 255; solid[i / 4] = 1; }
            else if (a >= 25 && dark) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 70; } else px[i + 3] = 0;
          }
          for (let yy = 0; yy < PIX_H; yy++) for (let xx = 0; xx < PIX_W; xx++) {
            const j = yy * PIX_W + xx; if (solid[j]) continue;
            if ((xx > 0 && solid[j - 1]) || (xx < PIX_W - 1 && solid[j + 1]) || (yy > 0 && solid[j - PIX_W]) || (yy < PIX_H - 1 && solid[j + PIX_W])) { const i = j * 4; px[i] = 12; px[i + 1] = 9; px[i + 2] = 22; px[i + 3] = 255; }
          }
          ctx.putImageData(data, 0, 0);
          const url = c.toDataURL('image/png');
          if (pxCache.size > 400) pxCache.delete(pxCache.keys().next().value);
          pxCache.set(key, url); resolve(url);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    }).finally(() => pxPending.delete(key));
    pxPending.set(key, p);
    return p;
  }

  /* ---------- Rasgos: lista, iconos y colección del Códice ---------- */
  const CATS = { hair: Object.fromEntries(Object.entries(HAIR).filter(([k]) => k !== 'none')), wings: WINGS, body: ALL.body, legs: Object.fromEntries(Object.entries(ALL_LEGS).map(([k, v]) => [k, v[1]])), eyes: ALL.eyes, mouth: ALL.mouth, ears: ALL.ears, mark: ALL.mark, final: Object.assign({}, FINALS, FINALS4), arms: ARMS };
  const CAT_ICON = { arms: 'hand', hair: 'sparkles', wings: 'feather', size: 'maximize', body: 'paw', legs: 'footprints', eyes: 'eye', mouth: 'smile', ears: 'sparkles', mark: 'star', wings: 'feather', final: 'crown' };
  const sizeKey = (z) => (z < 0.86 ? 'xs' : z < 0.95 ? 's' : z <= 1.06 ? 'm' : z <= 1.15 ? 'l' : 'xl');
  /** Rasgos de un individuo, para pintarlos como iconos. */
  function traits(i, { final = true } = {}) {
    const out = [{ cat: 'size', key: sizeKey(i.size), rare: i.size > 1.18 || i.size < 0.82 }];
    ['body', 'legs', 'arms', 'eyes', 'mouth', 'ears', 'hair', 'mark', 'final'].forEach((cat) => {
      const key = cat === 'body' ? i.body : i[cat];
      if ((cat === 'mark' || cat === 'final' || cat === 'hair' || cat === 'arms') && (key === 'none' || !key)) return;
      if (cat === 'legs' && (key === 'slither' || (key === 'hover' && i.body === 'ghost'))) return;
      out.push({ cat, key, rare: rare(CATS[cat] || {}, key) });
    });
    if (i.winged && final) out.push({ cat: 'wings', key: (HOUSES[i.house] || HOUSES.luz).wing, rare: true });
    return out;
  }
  // Modelo neutro para dibujar un rasgo suelto
  const TEMPLATE = { hair: 'none', house: 'luz', seed: 1, skin: '#d9c3a5', size: 1, body: 'round', legs: 'stubby', eyes: 'big', mouth: 'w', ears: 'none', mark: 'none', final: 'none', eyeColor: '#1b1b2f', eyeScale: 1, earScale: 1, armScale: 1, winged: false, wingStage: 2, cheeks: true, furAmt: 0.5, wob: 1, lean: 0 };
  const iconCache = new Map();
  /** Icono (SVG) de un rasgo. o.house/o.skin para teñirlo como su dueño. */
  function icon(cat, key, o = {}) {
    const ck = [cat, key, o.house, o.skin].join('|');
    if (iconCache.has(ck)) return iconCache.get(ck);
    const t = Object.assign({}, TEMPLATE, o.house ? { house: o.house } : null, o.skin ? { skin: o.skin } : null);
    let out;
    switch (cat) {
      case 'eyes': out = draw(Object.assign(t, { eyes: key, eyeColor: ['glow', 'visor'].includes(key) ? '#22d3ee' : t.eyeColor }), 1, { focus: 'eyes', plain: true }); break;
      case 'mouth': out = draw(Object.assign(t, { mouth: key, eyes: 'dot', eyeScale: 0.6, cheeks: false }), 1, { focus: 'mouth', plain: true }); break;
      case 'hair': out = draw(Object.assign(t, { hair: key, hairColor: '#6b4a2f', eyes: 'dot' }), 1, { focus: 'ears', plain: true }); break;
      case 'ears': out = draw(Object.assign(t, { ears: key, eyes: 'dot' }), 1, { focus: 'ears', plain: true }); break;
      case 'mark': out = draw(Object.assign(t, { mark: key, eyes: 'dot' }), 1, { focus: 'mark', plain: true }); break;
      case 'legs': out = draw(Object.assign(t, { legs: key, eyes: 'dot' }), key === 'bird' ? 0 : 2, { focus: 'legs', plain: true }); break;
      case 'arms': out = draw(Object.assign(t, { arms: key, eyes: 'dot' }), 2, { focus: 'full', plain: false, armsIcon: true }); break;
      case 'body': out = draw(Object.assign(t, { body: key, bodyFixed: key, eyes: 'dot', legs: key === 'ghost' ? 'hover' : 'stubby' }), 1, { focus: 'full', plain: true }); break;
      case 'final': out = draw(Object.assign(t, { final: key, eyes: 'dot' }), 3, { focus: 'full', plain: true, final: true }); break;
      case 'wings': out = draw(Object.assign(t, { winged: true, eyes: 'dot', house: WING_HOUSE[key] || 'luz', skin: (HOUSES[WING_HOUSE[key]] || HOUSES.luz).skins[0] }), 2, { focus: 'full', plain: true, wingsIcon: true }); break;
      case 'size': { const z = { xs: 0.45, s: 0.6, m: 0.75, l: 0.88, xl: 1 }[key] || 0.75; out = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 22h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/><ellipse cx="12" cy="${f(21 - 9 * z)}" rx="${f(10 * z)}" ry="${f(9 * z)}" fill="currentColor" opacity=".85"/><circle cx="${f(12 - 4 * z)}" cy="${f(19 - 11 * z)}" r="${f(1.3 * z + 0.5)}" fill="#0b0a12"/></svg>`; break; }
      default: out = '';
    }
    iconCache.set(ck, out);
    return out;
  }
  /** Todas las claves de una categoría (para la colección del Códice). */
  const allKeys = (cat) => Object.keys(CATS[cat] || {}).filter((k) => !(cat === 'mark' || cat === 'final' || cat === 'hair') || k !== 'none');

  /* ---------- Códice: variantes vistas y rasgos descubiertos ---------- */
  const MAX_SEEN = 18;
  const book = () => { const s = DK.store.state; s.looks = s.looks || { seen: {}, traits: {} }; return s.looks; };
  /** Apunta un daskai visto (en combate, reclutado, tuyo). */
  function see(d) {
    if (!d || !DK.store.state || !D.species[d.species]) return;
    const lk = lookOf(d), b = book(), root = rootOf(d.species);
    if (lk) { const arr = (b.seen[root] = b.seen[root] || []); if (!arr.includes(lk.s)) { arr.unshift(lk.s); if (arr.length > MAX_SEEN) arr.length = MAX_SEEN; } b.count = b.count || {}; b.count[root] = (b.count[root] || 0) + (arr[0] === lk.s ? 1 : 0); }
    const had = Object.keys(b.traits).length > 0; // (los rasgos del primer daskai no cuentan como «nuevos»)
    traits(ind(d.species, lk), { final: lk && lk.fin != null ? lk.fin : stageOf(d.species).final }).forEach(({ cat, key }) => {
      if (cat === 'size') return; const t = (b.traits[cat] = b.traits[cat] || {});
      if (!t[key] && had) { b.fresh = b.fresh || {}; b.fresh[cat + ':' + key] = 1; } // v4.57: rasgo recién descubierto («Nuevo» en el Códice)
      t[key] = (t[key] || 0) + 1;
    });
  }
  /** Rareza de un daskai para ordenar (v4.57): rasgos raros, alas, tamaño extremo y brillo. */
  function rarityScore(d) {
    if (!d || d.boss) return 0;
    const lk = lookOf(d), i = ind(d.species, lk);
    return traits(i, { final: true }).filter((x) => x.rare).length * 2 + (i.winged ? 3 : 0) + (d.shiny ? 5 : 0) + (d.variant ? 2 : 0);
  }
  const isFresh = (cat, key) => { const b = DK.store.state && DK.store.state.looks; return !!(b && b.fresh && b.fresh[cat + ':' + key]); };
  const freshCount = () => { const b = DK.store.state && DK.store.state.looks; return b && b.fresh ? Object.keys(b.fresh).length : 0; };
  const clearFresh = () => { const b = DK.store.state && DK.store.state.looks; if (b && b.fresh) { delete b.fresh; DK.store.save(); } };
  const seenOf = (sid) => { const b = DK.store.state && DK.store.state.looks; return (b && b.seen[rootOf(sid)]) || []; };
  const traitSeen = (cat, key) => { const b = DK.store.state && DK.store.state.looks; return !!(b && b.traits[cat] && b.traits[cat][key]); };
  function collection() {
    const cats = ['body', 'legs', 'arms', 'eyes', 'mouth', 'ears', 'hair', 'mark', 'final', 'wings'];
    const list = cats.map((cat) => ({ cat, keys: allKeys(cat).map((key) => ({ key, seen: traitSeen(cat, key), rare: rare(CATS[cat], key) })) }));
    const total = list.reduce((a, c) => a + c.keys.length, 0), got = list.reduce((a, c) => a + c.keys.filter((k) => k.seen).length, 0);
    return { list, total, got };
  }
  /** Texto del rasgo para el tooltip: «Ojos: de gato». */
  function label(cat, key) {
    const t = DK.t;
    return `${t('look.cat.' + cat)}: ${t(`look.${cat}.${key}`)}`;
  }

  DK.looks = {
    rarityScore, isFresh, freshCount, clearFresh,
    svg, pixel, pixelCached, ind, stageOf, lineOf, rootOf, rollLook, of: lookOf, see, seenOf, traitSeen, collection, traits, icon, label,
    typical: (sid) => ind(sid, null), houses: HOUSES, rng, catIcon: CAT_ICON, allKeys, draw, hash,
    /** Para pruebas: genera el aspecto de una casa con una semilla. */
    roll,
  };
})();
