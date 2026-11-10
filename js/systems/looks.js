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
    saddle: ['saddle', 'saddle', 'saddle', 'wide'], pill: ['pill', 'pill', 'tall', 'tall'], spiky: ['spiky', 'spiky', 'spiky', 'cloud'], acorn: ['acorn', 'acorn', 'acorn', 'egg'], potato: ['potato', 'potato', 'chubby', 'squat'],
    gourd: ['gourd', 'gourd', 'gourd', 'pear'], gem: ['gem', 'gem', 'gem', 'block'], puff: ['puff', 'puff', 'cloud', 'chubby'], bell: ['bell', 'bell', 'bell', 'squat'], bulb: ['bulb', 'bulb', 'blob', 'chubby'],
    heart: ['heart', 'heart', 'heart', 'heart'], star5: ['star5', 'star5', 'star5', 'star5'], mushroom: ['mushroom', 'mushroom', 'mushroom', 'mushroom'], barrel: ['barrel', 'barrel', 'barrel', 'block'], kite: ['kite', 'kite', 'kite', 'gem'],
    // v5.14: siluetas nuevas (más distintas entre sí: lomo alto, jorobas, facetas, triángulos, cometa…)
    loaf: ['loaf', 'loaf', 'loaf', 'wide'], hunch: ['hunch', 'hunch', 'hunch', 'hunch'], hourglass: ['gourd', 'hourglass', 'hourglass', 'hourglass'], peanut: ['bean', 'peanut', 'peanut', 'peanut'],
    shield: ['egg', 'shield', 'shield', 'shield'], pyramid: ['pyramid', 'pyramid', 'pyramid', 'pyramid'], hex: ['hex', 'hex', 'hex', 'hex'], crag: ['potato', 'crag', 'crag', 'crag'],
    tiltegg: ['egg', 'tiltegg', 'tiltegg', 'tiltegg'], comet: ['drop', 'comet', 'comet', 'comet'], camel: ['bean', 'camel', 'camel', 'camel'], brute: ['chubby', 'brute', 'brute', 'brute'],
    dino: ['dino', 'dino', 'dino', 'dino'], scorpion: ['scorpion', 'scorpion', 'scorpion', 'scorpion'], beast: ['beast', 'beast', 'beast', 'beast'], shellb: ['shellb', 'shellb', 'shellb', 'shellb'],
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
  const NEW3_CHANCE = 0.45, NEW3_TAG = 0xa5, NEW4_TAG = 0xa6, NEW5_TAG = 0xa7, NEW6_TAG = 0xa8;
  // v4.62: los aspectos nuevos llevan NEW4_TAG: tienen los rasgos de la v4.56 y además los de la v4.62
  // v4.69: NEW5_TAG = además los rasgos de la v4.69 (brazos, ojos, bocas y accesorios nuevos)
  // v4.71: NEW6_TAG = además cuerpos, patas, bocas y cuernos/orejas nuevos
  // v5.6: NEW8_TAG = además paletas por casa más variadas, degradados en el cuerpo y 4 ojos / 4 bocas nuevos
  const NEW8_TAG = 0xaa;
  // v5.15: NEW9_TAG = además orejas, brazos y dibujos nuevos (los que ya tenías no cambian)
  const NEW9_TAG = 0xab;
  const isNew9 = (seed) => ((seed >>> 0) & 0xff) === NEW9_TAG;
  const isNew8 = (seed) => ((seed >>> 0) & 0xff) === NEW8_TAG || isNew9(seed);
  const isNew7 = (seed) => ((seed >>> 0) & 0xff) === 0xa9 || isNew8(seed);
  const isNew6 = (seed) => ((seed >>> 0) & 0xff) === NEW6_TAG || isNew7(seed);
  const isNew5 = (seed) => ((seed >>> 0) & 0xff) === NEW5_TAG || isNew6(seed);
  const isNew4 = (seed) => ((seed >>> 0) & 0xff) === NEW4_TAG || isNew5(seed);
  const isNew3 = (seed) => ((seed >>> 0) & 0xff) === NEW3_TAG || isNew4(seed);
  const NEW4_CHANCE = 0.35;
  const BODIES4 = { wide: 4, tower: 4, topheavy: 4, bubble: 4, lumpy: 4 };
  const EYES4 = { crosseye: 3, teary: 4, robot: 3, lashes: 5, diamond: 3 };
  const MOUTHS4 = { vampire: 4, zipper: 3, catmouth: 4, lips: 3, frown: 4 };
  const LEGS4 = { peg: [['peg', 'peg', 'peg', 'peg'], 4], webbed: [['stubby', 'webbed', 'webbed', 'webbed'], 4], spring: [['spring', 'spring', 'spring', 'spring'], 3], bigfoot: [['bigfoot', 'bigfoot', 'bigfoot', 'bigfoot'], 4], stilts: [['peg', 'stilts', 'stilts', 'stilts'], 3] };
  const ARMS = { stubby: 4, long: 4, noodle: 3, pincer: 3, mitten: 4 };
  const FINALS4 = { cape: 4, flowercrown: 4, bandana: 4, goggles: 3, collar: 4 };
  // v4.69: más brazos (incluido «sin brazos»), ojos, bocas y accesorios
  const ARMS5 = { none: 6, tentacle: 3, leaf: 3, wingarm: 3, wave: 3, talon: 3, crystal: 2 };
  const EYES5 = { shades: 3, monocle: 3, xeyes: 3, blank: 3, bags: 4 };
  const MOUTHS5 = { snout: 4, gum: 3, grit: 4, mask: 3, kiss: 3 };
  const FINALS5 = { tophat: 3, wizard: 3, headphones: 3, bowtie: 4, beanie: 4 };
  const FINALS9 = { cap: 4, pirate: 3, propeller: 3, necklace: 4, backpack: 3, glasses: 4 }; // v5.19
  // v5.15 (semillas NEW9): orejas, brazos y dibujos nuevos
  const EARS9 = { owl: 4, gills: 4, dish: 3, lop: 4, flameears: 3, shellears: 3 };
  const ARMS9 = { scythe: 3, vine: 3, gauntlet: 3, fluff: 3, hook: 3 };
  const MARKS9 = { dapple: 4, saddlemark: 4, mask: 3, tribal: 3, socks: 3 };
  // v5.18 (también NEW9): 2 ojos, 2 bocas, 2 brazos y 2 tipos de patas más (y 2 alas en la regalía)
  const EYES9 = { compound: 3, ember: 3 };
  const MOUTHS9 = { maw: 3, fishlips: 3 };
  const ARMS9B = { shieldarm: 3, flamearm: 3 };
  const LEGS9 = { pistons: [['peg', 'pistons', 'pistons', 'pistons'], 3], crystal: [['stubby', 'crystallegs', 'crystallegs', 'crystallegs'], 3] };
  const ARMS_ROLL = Object.assign({}, ARMS, ARMS5); // (el sorteo de siempre: los aspectos ya creados no cambian)
  const ARMS_ALL = Object.assign({}, ARMS_ROLL, ARMS9, ARMS9B);
  // v4.71: más formas de cuerpo, patas, bocas y cuernos/orejas
  const BODIES6 = { saddle: 4, pill: 4, spiky: 3, acorn: 4, potato: 5 };
  const LEGS6 = { wheels: [['wheels', 'wheels', 'wheels', 'wheels'], 2], crab: [['stubby', 'crab', 'crab', 'crab'], 3], boots: [['boots', 'boots', 'boots', 'boots'], 4], paddles: [['paddles', 'paddles', 'paddles', 'paddles'], 3], insect: [['insect', 'insect', 'insect', 'insect'], 3] };
  const MOUTHS6 = { hook: 3, trunk: 2, mandible: 3, lick: 4, muzzle: 4 };
  const EARS6 = { curved: 4, nubs: 5, feelers: 4, fan: 3, fox: 5 };
  const BODIES3 = { gourd: 5, gem: 4, puff: 5, bell: 5, bulb: 4 };
  // v4.96 (NEW7_TAG): cuerpos, patas, ojos y bocas nuevos, tamaños extremos y SILUETAS (dinosaurio, escorpión,
  // bestia de cuatro patas y caparazón), que fuerzan cuerpo, patas y brazos y añaden piezas propias
  const NEW7_TAG = 0xa9;
  const BODIES7 = { heart: 3, star5: 3, mushroom: 4, barrel: 4, kite: 3 };
  // v5.14 (semillas NEW8): siluetas nuevas, firma de cada especie y cuerpos que cambian al madurar
  const BODIES9 = { loaf: 4, hunch: 4, hourglass: 3, peanut: 4, shield: 3, pyramid: 3, hex: 3, crag: 4, tiltegg: 3, comet: 4, camel: 3, brute: 4 };
  // Cuerpos de las formas maduras (3.ª y 4.ª): siluetas con más carácter
  const MATURE = { hunch: 5, brute: 5, camel: 3, crag: 4, comet: 3, hex: 3, pyramid: 3, shield: 3, loaf: 3, peanut: 3, topheavy: 3, tower: 3, wide: 3, barrel: 2, block: 2, tiltegg: 3, hourglass: 2, saddle: 2, mound: 2, kite: 1 };
  const MATURE_LATE = { brute: 6, hunch: 5, crag: 4, topheavy: 4, tower: 3, hex: 3, pyramid: 3, camel: 3, comet: 3, shield: 3, wide: 3, barrel: 2, block: 2 };
  const SIG_POOL = Object.assign({}, { round: 2, chubby: 2, egg: 2, bean: 2, tall: 2, blob: 1, drop: 2, squat: 2, pear: 2, mound: 2, cloud: 1, wide: 2, tower: 2, topheavy: 2, saddle: 2, pill: 2, acorn: 2, potato: 2, gourd: 2, gem: 1, bell: 2, bulb: 1, barrel: 1, mushroom: 1 }, BODIES9);
  const LEGS7 = { raptor: [['raptor', 'raptor', 'raptor', 'raptor'], 2], slime: [['slime', 'slime', 'slime', 'slime'], 2], beast: [['quad', 'quad', 'quad', 'pillars'], 0.6] };
  const EYES7 = { void: 3, gemeye: 3, snake: 4, pixel: 2, sclera: 3 };
  const MOUTHS7 = { shark: 4, sucker: 2, goofy: 4, whiskers: 4, underbite: 4 };
  const ARCH = {
    dino: { body: 'dino', legs: 'raptor', arms: 'stubby', w: 1 },
    scorpion: { body: 'scorpion', legs: 'insect', arms: 'pincer', w: 1 },
    beast: { body: 'beast', legs: 'beast', arms: null, w: 1 },
    shell: { body: 'shellb', legs: 'paws', arms: null, w: 1 },
  };
  const ARCH_HOUSE = { fuego: { dino: 3, beast: 1.5 }, tierra: { dino: 2, scorpion: 2.5, shell: 2 }, oscuridad: { scorpion: 3, beast: 2 }, luz: { beast: 3 }, agua: { shell: 3 } };
  const ARCH_CHANCE = 0.1;
  const EYES3 = { sparkle: 5, crescent: 4, squint: 4, bug: 3, ringed: 4 };
  const MOUTHS3 = { stitch: 3, toothy: 4, gaptooth: 4, drool: 4, whistle: 4 };
  const EARS3 = { leafy: 4, plume: 4, devil: 4, bow: 4, crystals: 3 };
  const MARKS3 = { bolt: 4, chevron: 4, ring: 4, bloom: 4, triad: 4 };
  const HAIR3 = { bun: 4, afro: 3, swoop: 4, braids: 3, quiff: 4 };
  const LEGS3 = { hoof: [['stubby', 'hooves', 'hooves', 'hooves'], 5], frog: [['frog', 'frog', 'frog', 'frog'], 4], talon: [['stubby', 'talons', 'talons', 'talons'], 4], root: [['roots', 'roots', 'roots', 'roots'], 3], puff: [['puffs', 'puffs', 'puffs', 'puffs'], 3] };
  const ALL_LEGS = Object.assign({}, LEG_PATHS, LEGS3, LEGS4, LEGS6, LEGS7, LEGS9);
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
  // v5.6: tonos de cada casa (parecidos entre sí pero variados) para la piel y el degradado
  const PAL8 = {
    luz: ['#ffd65a', '#ffe08a', '#fcd34d', '#fde68a', '#f4b942', '#ffcf8a', '#fdba74', '#fff0b8', '#f9c9a0', '#fef3c7', '#facc15', '#f2b84b', '#ffe4a8', '#ffd1dc'],
    oscuridad: ['#6d4bd8', '#4338ca', '#7e22ce', '#86198f', '#312e81', '#a78bfa', '#57536e', '#2e1065', '#5b21b6', '#9d4edd', '#3b2f6e', '#701a75', '#4c1d95', '#6366f1'],
    fuego: ['#f97316', '#dc2626', '#fb7185', '#ef4444', '#fb923c', '#f59e0b', '#b91c1c', '#c2410c', '#ea580c', '#e11d48', '#fca5a5', '#f43f5e', '#d97706', '#ff6b4a'],
    agua: ['#38bdf8', '#14b8a6', '#1e40af', '#67e8f9', '#5eead4', '#2563eb', '#bae6fd', '#06b6d4', '#3b82f6', '#0e7490', '#7dd3fc', '#2dd4bf', '#1d4ed8', '#a5f3fc'],
    tierra: ['#b07a3a', '#65a30d', '#4d7c0f', '#b45309', '#d6b98c', '#78350f', '#84a98c', '#a3a05a', '#8b8378', '#3f6212', '#92400e', '#a16207', '#6b8e23', '#c8a26b'],
  };
  // v5.19: más colores por casa (sólo aspectos nuevos NEW9): perla, oro rosa, obsidiana, cobre, magenta, plata, arena…
  const PAL9 = {
    luz: ['#fdf4ff', '#f5d0fe', '#fbcfe8', '#e9d5a1', '#f8e7c4', '#d8c3a5', '#fff7ed', '#ffe4e6'],
    oscuridad: ['#1f1b2e', '#3f0d12', '#0f3d3e', '#4a044e', '#27272a', '#3730a3', '#831843', '#18181b'],
    fuego: ['#be185d', '#c2410c', '#b87333', '#f472b6', '#7f1d1d', '#fbbf24', '#d946ef', '#9a3412'],
    agua: ['#0c4a6e', '#94a3b8', '#99f6e4', '#134e4a', '#c7d2fe', '#0f766e', '#e0f2fe', '#312e81'],
    tierra: ['#57534e', '#a8a29e', '#c2410c', '#d9c49c', '#365314', '#9a7b4f', '#4b5563', '#e7cfa3'],
  };
  const GRAD_DIRS = { down: [0, 0, 0, 1], up: [0, 1, 0, 0], diag: [0, 0, 1, 1], back: [0, 0, 1, 0.2], side: [1, 0, 0, 0], belly: [0, 1, 0, 0.55] };
  const EYES8 = { twinkle: 4, brows: 4, almond: 4, dewy: 4 };
  const MOUTHS8 = { fang1: 4, blep: 4, ohno: 3, beam: 4 };
  const EYE_COLORS = ['#1b1b2f', '#1b1b2f', '#2b1a0e', '#0f3b57', '#7c3aed', '#16a34a', '#dc2626', '#f59e0b', '#0891b2'];
  const GLOW_COLORS = ['#fde047', '#22d3ee', '#f472b6', '#a3e635', '#f87171', '#c4b5fd'];

  const rare = (table, k) => (table[k] || 99) <= 2;
  const ALL = { body: Object.assign({}, BODIES, BODIES2, BODIES3, BODIES4, BODIES6, BODIES7, BODIES9, { dino: 1, scorpion: 1, beast: 1, shellb: 1 }), eyes: Object.assign({}, EYES, EYES2, EYES3, EYES4, EYES5, EYES7, EYES8, EYES9), mouth: Object.assign({}, MOUTHS, MOUTHS2, MOUTHS3, MOUTHS4, MOUTHS5, MOUTHS6, MOUTHS7, MOUTHS8, MOUTHS9), arms: ARMS_ALL, ears: Object.assign({}, EARS, EARS2, EARS3, EARS6, EARS9), mark: Object.assign({}, MARKS, MARKS2, MARKS3, MARKS9), hair: Object.assign({}, HAIR, HAIR3) };
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
    if (isNew5(seed)) { // v4.69: casi todos con un brazo de tipo propio (o sin brazos) y más ojos, bocas y accesorios
      const R6 = rng(seed ^ 0x2545f491), sw = (key, table, ch) => { if (R6() < ch) ind[key] = pick(table, R6); else R6(); };
      ind.arms = R6() < 0.85 ? pick(ARMS_ROLL, R6) : (R6(), null);
      sw('eyes', EYES5, 0.22); sw('mouth', MOUTHS5, 0.22); sw('final', FINALS5, 0.3);
    }
    if (isNew6(seed)) { // v4.71: cuerpos, patas, bocas y cuernos/orejas nuevos
      const R8 = rng(seed ^ 0x1b873593), sw = (key, table, ch) => { if (R8() < ch) ind[key] = pick(table, R8); else R8(); };
      const solid = !['ghost', 'long'].includes(ind.body);
      if (solid) sw('body', BODIES6, 0.3); else R8();
      if (solid && ind.legs !== 'hover') sw('legs', LEGS6, 0.22); else R8();
      sw('mouth', MOUTHS6, 0.2); sw('ears', EARS6, 0.3);
    }
    if (isNew7(seed)) { // v4.96: siluetas, cuerpos/patas/ojos/bocas nuevos y tamaños extremos
      const R9 = rng(seed ^ 0x68e31da4), sw = (key, table, ch) => { if (R9() < ch) ind[key] = pick(table, R9); else R9(); };
      const solid = !['ghost', 'long'].includes(ind.body);
      if (solid) sw('body', BODIES7, 0.2); else R9();
      if (solid && ind.legs !== 'hover') sw('legs', { raptor: 2, slime: 2 }, 0.14); else R9();
      sw('eyes', EYES7, 0.18); sw('mouth', MOUTHS7, 0.18);
      const z = R9(); if (z < 0.06) ind.size = 0.6 + R9() * 0.14; else if (z < 0.12) ind.size = 1.26 + R9() * 0.16; else R9();
      if (solid && R9() < ARCH_CHANCE) applyArch(ind, pick(Object.fromEntries(Object.keys(ARCH).map((k) => [k, ((ARCH_HOUSE[house] || {})[k] || 1)])), R9)); else R9();
    }
    if (isNew8(seed)) { // v5.6: más colores de su casa, degradados y ojos/bocas nuevos
      const R10 = rng(seed ^ 0x5bd1e995), pal = PAL8[house] || [skin];
      if (R10() < 0.7) ind.skin = hue(pal[Math.floor(R10() * pal.length)], Math.round(R10() * 10 - 5)); else R10();
      if (R10() < 0.6) {
        // otro tono de la misma casa (o el mismo más claro / más oscuro) que se funde con la piel
        const k = R10(), other = pal[Math.floor(R10() * pal.length)];
        ind.grad = { c: k < 0.55 ? other : k < 0.8 ? shade(ind.skin, 0.35) : shade(ind.skin, -0.3), dir: pick({ down: 4, up: 2, diag: 3, back: 2 }, R10), at: 0.25 + R10() * 0.25 };
      } else { R10(); R10(); }
      if (R10() < 0.22) ind.eyes = pick(EYES8, R10); else R10();
      if (R10() < 0.22) ind.mouth = pick(MOUTHS8, R10); else R10();
    }
    if (isNew9(seed)) { // v5.15: orejas, brazos y dibujos nuevos
      const R11 = rng(seed ^ 0x2f6b8a3d), sw = (key, table, ch) => { if (R11() < ch) ind[key] = pick(table, R11); else R11(); };
      sw('ears', EARS9, 0.24); sw('mark', MARKS9, 0.28);
      if (ind.arms && ind.arms !== 'none') sw('arms', ARMS9, 0.28); else R11();
      // v5.18: otro azar aparte (los NEW9 ya creados sólo cambian en estas piezas nuevas, y poco)
      const R12 = rng(seed ^ 0x4c957f2d), sw2 = (key, table, ch) => { if (R12() < ch) ind[key] = pick(table, R12); else R12(); };
      sw2('eyes', EYES9, 0.1); sw2('mouth', MOUTHS9, 0.1);
      if (ind.arms && ind.arms !== 'none') sw2('arms', ARMS9B, 0.12); else R12();
      if (!['ghost', 'long'].includes(ind.body) && ind.legs !== 'hover') sw2('legs', LEGS9, 0.1); else R12();
      // v5.19: accesorios y colores nuevos (al final del mismo azar: lo anterior no cambia)
      sw2('final', FINALS9, 0.26);
      const P9 = PAL9[house] || [];
      if (P9.length && R12() < 0.3) { ind.skin = P9[Math.floor(R12() * P9.length)]; if (ind.grad && R12() < 0.5) ind.grad.c = shade(ind.skin, 0.32); else R12(); } else { R12(); R12(); R12(); }
      if (R12() < 0.18) ind.grad = { c: (P9.length ? P9[Math.floor(R12() * P9.length)] : shade(ind.skin, 0.3)), dir: pick({ side: 2, belly: 2, diag: 1 }, R12), at: 0.3 + R12() * 0.2 }; else { R12(); R12(); R12(); }
    }
    { const R2 = rng(seed ^ 0x9e3779b9); ind.baby = R2() < 0.75 ? 0.82 + R2() * 0.14 : 1 + R2() * 0.12; } // 3 de cada 4 nacen pequeños
    ind.rare = rare(ALL.eyes, ind.eyes) || rare(ALL.mouth, ind.mouth) || rare(ALL.ears, ind.ears) || ind.size > 1.18 || ind.size < 0.82 || rare(ALL.body, ind.body);
    return ind;
  }

  /*
   * v4.96b: CRITERIO. Tras el sorteo se arreglan las combinaciones que se ven mal (siempre) y, a veces,
   * se escogen patas que pegan con el cuerpo (ojos, boca y pelo quedan al azar) (sigue siendo aleatorio: ~la mitad de las veces).
   * Sólo para semillas NEW7 (los aspectos anteriores no cambian).
   */
  const ARCH_EARS = {
    dino: { crest: 4, horns: 3, spikes: 3, nubs: 3, none: 3, trihorn: 2, fins: 1, mohawk: 2, curved: 1 },
    scorpion: { antenna: 4, feelers: 4, none: 3, nubs: 2, horns: 1 },
    beast: { cat: 4, fox: 4, bear: 3, lynx: 3, droopy: 2, tuft: 2, horns: 1, ram: 1, mouse: 1, antlers: 1 },
    shell: { antenna: 4, feelers: 3, nubs: 3, none: 3, sprout: 2, mushroom: 1 },
  };
  // patas de raptor sólo en cuerpos que «se sostienen» sobre ellas; si no, unas de ave
  const RAPTOR_OK = new Set(['round', 'chubby', 'egg', 'bean', 'blob', 'drop', 'squat', 'pear', 'mound', 'potato', 'gourd', 'puff', 'bulb', 'heart', 'bubble', 'wide', 'lumpy', 'acorn', 'saddle', 'cloud', 'dino']);
  const BODY_LEGS = { mushroom: { stubby: 3, paws: 2, root: 3, slime: 2 }, barrel: { stubby: 3, pillar: 3, boots: 3, peg: 2 }, heart: { stubby: 3, paws: 3, hover: 2, slime: 1 }, star5: { stubby: 3, spring: 3, peg: 2, hover: 1 }, kite: { bird: 3, talon: 3, stilts: 2, hover: 2 } };
  const HOUSE7 = { agua: { legs: 'slime', mouth: ['shark', 'sucker'] }, tierra: { mouth: ['underbite'] }, oscuridad: { eyes: ['void', 'snake'] }, luz: { eyes: ['gemeye', 'sclera'] }, fuego: { mouth: ['shark'] } };
  function harmonize(ind) {
    const R = rng((ind.seed >>> 0) ^ 0x2f6b8d33), sometimes = (p) => R() < p, a = ind.arch;
    for (let i = 0; i < 5; i++) R(); // calentar el generador (semillas parecidas daban lo mismo)
    const fix = (k, table) => { if (!table[k]) return pick(table, R); return k; };
    if (a) {
      ind.ears = fix(ind.ears, ARCH_EARS[a]); // siempre: orejas que no tapan las piezas de la silueta
      // ojos, boca y pelo: totalmente al azar (v4.98), para que haya dinosaurios, escorpiones… muy distintos
      if (a === 'dino' && sometimes(0.5)) ind.plateC = (HOUSES[ind.house] || {}).horn || null; else R();
    } else {
      if (ind.legs === 'raptor' && !RAPTOR_OK.has(ind.body)) ind.legs = pick({ bird: 2, talon: 3, digi: 2 }, R);
      // cuerpos acabados en punta (corazón, estrella, cometa): siempre patas que encajan; seta y barril, a veces
      const must = ['heart', 'star5', 'kite'].includes(ind.body) && !BODY_LEGS[ind.body][ind.legs];
      if (BODY_LEGS[ind.body] && (must || sometimes(0.6))) ind.legs = pick(BODY_LEGS[ind.body], R); else R();
      if (ind.legs === 'raptor' && ['long', 'noodle', 'tentacle'].includes(ind.arms) && sometimes(0.7)) ind.arms = 'stubby'; else R();
    }
    const hb = HOUSE7[ind.house];
    if (hb && sometimes(0.15)) {
      if (hb.legs && !a && ind.legs !== 'hover' && !['ghost', 'long'].includes(ind.body) && (!BODY_LEGS[ind.body] || BODY_LEGS[ind.body][hb.legs])) ind.legs = hb.legs;
      if (hb.mouth) ind.mouth = hb.mouth[Math.floor(R() * hb.mouth.length)];
      if (hb.eyes) ind.eyes = hb.eyes[Math.floor(R() * hb.eyes.length)];
    } else R();
    // sombreros con orejas o antenas muy altas: casi siempre se cambian por algo que no vaya en la cabeza
    if (['tophat', 'wizard', 'beanie', 'headphones'].includes(ind.final) && ['bunny', 'antlers', 'unicorn', 'feelers', 'antenna', 'crystals', 'trihorn', 'headwings'].includes(ind.ears) && sometimes(0.8)) ind.final = pick({ scarf: 3, bowtie: 3, aura: 2, mane: 2, runes: 1 }, R); else R();
    // tamaños extremos: los diminutos no llevan ojos de un solo píxel ni bocas mínimas que no se verían
    if (ind.size < 0.75 && ['pixel', 'tiny', 'dot'].includes(ind.eyes)) ind.eyes = 'big';
    return ind;
  }
  /** v4.96: convierte el individuo en una silueta (dinosaurio, escorpión, bestia, caparazón). */
  function applyArch(ind, a) {
    const A = ARCH[a]; if (!A) return ind;
    ind.arch = a; ind.body = A.body; ind.legs = A.legs;
    if (A.arms !== undefined) ind.arms = A.arms;
    if (a === 'scorpion' && ['visor'].includes(ind.eyes)) ind.eyes = 'sharp';
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
    saddle: { w: 1.22, h: 0.88, n: 2.2, waist: 0.15 }, pill: { w: 0.84, h: 1.2, n: 3.4 }, spiky: { w: 1.02, h: 0.98, n: 2, bump: 0.13, k: 12 }, acorn: { w: 1.02, h: 1.06, n: 2.6, pear: -0.2, drop: 0.18 }, potato: { w: 1.14, h: 0.9, n: 2.1, wob: 0.06, k: 3, pear: 0.12 },
    heart: { w: 1.06, h: 1.02, n: 2 }, star5: { w: 1.06, h: 1.04, n: 2, wob: 0.16, k: 5 }, mushroom: { w: 1.12, h: 1.02, n: 2.3, pear: -0.48, waist: 0.3 }, barrel: { w: 0.98, h: 1.12, n: 3.4, waist: -0.12 }, kite: { w: 0.98, h: 1.12, n: 1.3, pear: 0.14 },
    dino: { w: 1.14, h: 0.92, n: 2.2, pear: 0.14 }, scorpion: { w: 1.22, h: 0.74, n: 2.6, pear: 0.05 }, beast: { w: 1.32, h: 0.8, n: 2.4, pear: 0.03 }, shellb: { w: 1.18, h: 0.9, n: 2.1, pear: -0.1 },
    loaf: { w: 1.16, h: 0.86, n: 2.2, nb: 7, hull: 1 }, hunch: { w: 1.14, h: 0.96, n: 2.3, hunch: 0.9, pear: 0.06, hull: 1 }, hourglass: { w: 1, h: 1.14, n: 2.2, waist: 0.42, pear: 0.1, hull: 1 },
    peanut: { w: 1.32, h: 0.9, n: 2.1, waistX: 0.46, hull: 1 }, shield: { w: 1.08, h: 1.1, poly: 3, rot: 90, blend: 0.72, nb: 1, hull: 1 }, pyramid: { w: 1.16, h: 1.1, poly: 3, rot: -90, blend: 0.72, flatB: 0.4, hull: 1 },
    hex: { w: 1.06, h: 1.02, poly: 6, rot: 0, blend: 0.92, hull: 1 }, crag: { w: 1.1, h: 0.98, poly: 7, rot: 12, blend: 0.8, jit: 0.12, hull: 1 }, tiltegg: { w: 0.94, h: 1.14, n: 2, pear: 0.3, tilt: 26, hull: 1 },
    comet: { w: 1.22, h: 0.94, n: 2.1, taper: 0.6, hull: 1 }, camel: { w: 1.22, h: 0.8, n: 2.8, humps: 0.62, hull: 1 }, brute: { w: 1.2, h: 1.02, n: 2.6, pear: -0.26, hunch: 0.22, nb: 4, hull: 1 },
    gourd: { w: 0.98, h: 1.1, n: 2, waist: 0.2, pear: 0.18 }, gem: { w: 1.02, h: 1.1, n: 1.4 }, puff: { w: 1.06, h: 0.96, n: 2, bump: 0.05, k: 16 }, bell: { w: 1.02, h: 1.02, n: 3, pear: 0.5 }, bulb: { w: 1.04, h: 0.98, n: 2, wob: 0.11, k: 3 },
  };
  function bodyPath(kind, cx, cy, W, H, ind, out) {
    const P = PRESET[kind] || PRESET.round, N = 44, pts = [];
    if (kind === 'heart') { // v4.96: corazón (curva clásica)
      for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2, hx = Math.pow(Math.sin(t), 3), hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
        pts.push([cx + W * hx, cy - H * (hy * 1.05 - 0.12)]); }
      return smooth(pts);
    }
    if (kind === 'ghost') { // cabeza redonda y faldón ondulado
      for (let i = 0; i <= 22; i++) { const a = Math.PI + (i / 22) * Math.PI; pts.push([cx + W * Math.cos(a), cy + H * 0.15 + H * 0.95 * Math.sin(a)]); }
      const yb = cy + H * 0.95, n = 4;
      for (let i = 0; i <= n * 2; i++) { const x = cx + W - (i / (n * 2)) * W * 2; pts.push([x, yb + (i % 2 ? 7 : 0)]); }
      return smooth(pts);
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let x, y;
      if (P.poly) { // v5.14: polígono redondeado (triángulo, hexágono, roca facetada)
        const k = P.poly, rot = ((P.rot || 0) + (P.jit ? ind.wob * 9 : 0)) * Math.PI / 180, seg = (2 * Math.PI) / k;
        const rel = (((a - rot) % seg) + seg) % seg, rp = Math.cos(Math.PI / k) / Math.cos(rel - Math.PI / k);
        let r = 1 + (rp - 1) * (P.blend == null ? 0.8 : P.blend);
        if (P.jit) r *= 1 + P.jit * Math.sin(a * 5 + ind.wob * 3) * Math.cos(a * 3 - ind.wob);
        const norm = Math.cos(Math.PI / k) * (P.blend || 0.8) + (1 - (P.blend || 0.8)); // que no encoja
        x = W * Math.cos(a) * r / Math.max(0.6, norm) * 0.92; y = H * Math.sin(a) * r / Math.max(0.6, norm) * 0.92;
        if (P.flatB && y > 0) y *= 1 - P.flatB * 0.4;
      } else {
        x = W * sp(Math.cos(a), 2 / P.n); y = H * sp(Math.sin(a), 2 / (Math.sin(a) > 0 && P.nb ? P.nb : P.n));
      }
      if (P.hunch && y < 0) y *= 1 + P.hunch * Math.max(-0.4, x / W); // lomo alto atrás
      if (P.humps && y < 0) { const u = x / W; y *= 1 + P.humps * (Math.exp(-Math.pow((u + 0.38) / 0.24, 2)) + Math.exp(-Math.pow((u - 0.42) / 0.24, 2))) - P.humps * 0.15; }
      if (P.waistX) y *= 1 - P.waistX * Math.exp(-Math.pow(x / W - 0.05, 2) * 12);
      if (P.taper && x > 0) { const u = x / W; y *= 1 - P.taper * Math.pow(u, 1.4); x *= 1 + 0.18 * u; }
      if (P.pear) x *= 1 + P.pear * (y / H);
      if (P.waist) x *= 1 - P.waist * Math.exp(-Math.pow(y / H + 0.12, 2) * 9);
      if (P.drop && y < 0) { const k = -y / H; x *= Math.pow(1 - k * P.drop, 1.2); y *= 1 + k * 0.18; }
      if (P.wob) { const r = 1 + P.wob * Math.sin(a * P.k + ind.wob); x *= r; y *= r; }
      if (P.bump) { const r = 1 + P.bump * Math.abs(Math.sin((a * P.k) / 2 + ind.wob)); x *= r; y *= r; }
      if (P.tilt) { const t = P.tilt * Math.PI / 180, oy = H * 0.3, yy = y - oy; const nx = x * Math.cos(t) - yy * Math.sin(t), ny = x * Math.sin(t) + yy * Math.cos(t); x = nx; y = ny + oy; }
      pts.push([cx + x, cy + y]);
    }
    if (out) out.pts = pts;
    return smooth(pts);
  }
  /** v5.15: borde de abajo real de un cuerpo (para que las patas salgan del cuerpo, sin huecos). */
  function hullBottom(pts) {
    const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    return (x) => { const q = clamp(x, x0 + 0.5, x1 - 0.5); let best = -Infinity;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[0] - q) * (b[0] - q) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * (q - a[0]) / (b[0] - a[0]); if (y > best) best = y; } }
      return best === -Infinity ? Math.max(...pts.map((p) => p[1])) : best; };
  }
  /** v5.14: borde de arriba real de un cuerpo (para colocar orejas, cuernos y púas en siluetas irregulares). */
  function hullTop(pts) {
    const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    return (x) => { const q = clamp(x, x0 + 0.5, x1 - 0.5); let best = Infinity;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[0] - q) * (b[0] - q) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * (q - a[0]) / (b[0] - a[0]); if (y < best) best = y; } }
      return best === Infinity ? Math.min(...pts.map((p) => p[1])) : best; };
  }

  /* ---------- Piezas ---------- */
  const STROKE = (dk, w = 2.2) => `stroke="${dk}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  /**
   * v5.4: parpadeo. Sólo los ojos que están ABIERTOS de base (BLINK) pueden parpadear: los dormidos, felices,
   * guiños, gafas, visera, cruces… ya están cerrados o tapados y no se tocan. En el parpadeo los dos ojos se
   * dibujan como dos rayitas curvas en su sitio.
   */
  const BLINK = new Set(['big', 'sharp', 'slit', 'glow', 'dot', 'angry', 'button', 'anime', 'crosseye', 'teary', 'lashes', 'diamond', 'bags', 'bug', 'ringed', 'void', 'gemeye', 'snake', 'sclera', 'twinkle', 'brows', 'almond', 'dewy']);
  function blinkSvg(ind, P) {
    const { fx, ey, er, dk } = P, r = er * 0.95;
    return [[fx - er * 1.25, ey + 0.5], [fx + er * 1.25, ey - 0.8]].map(([x, y]) => `<path d="M ${f(x - r)} ${f(y)} Q ${f(x)} ${f(y + r * 0.55)} ${f(x + r)} ${f(y)}" fill="none" stroke="${dk}" stroke-width="${f(Math.max(1.6, er * 0.32))}" stroke-linecap="round"/>`).join('');
  }
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
      case 'shades': { const y = (e1[1] + e2[1]) / 2; return `<path d="M ${f(e1[0] - er * 1.25)} ${f(y - er * 0.7)} H ${f(e2[0] + er * 1.25)}" stroke="${dk}" stroke-width="1.6"/>` + [e1, e2].map(([x]) => `<path d="M ${f(x - er * 1.15)} ${f(y - er * 0.7)} H ${f(x + er * 1.15)} Q ${f(x + er * 1.1)} ${f(y + er * 0.95)} ${f(x)} ${f(y + er * 0.95)} Q ${f(x - er * 1.1)} ${f(y + er * 0.95)} ${f(x - er * 1.15)} ${f(y - er * 0.7)} Z" fill="#111827" ${STROKE(dk, 1.2)}/><path d="M ${f(x - er * 0.7)} ${f(y - er * 0.35)} l ${f(er * 0.5)} ${f(er * 0.5)}" stroke="#fff" stroke-width="1" opacity=".6"/>`).join(''); }
      case 'monocle': return big(e1) + big(e2) + `<circle cx="${f(e2[0])}" cy="${f(e2[1])}" r="${f(er * 1.35)}" fill="#bae6fd" fill-opacity=".18" stroke="#d4a24c" stroke-width="1.6"/><path d="M ${f(e2[0] + er * 1.2)} ${f(e2[1] + er * 0.6)} q ${f(er * 0.8)} ${f(er * 1.4)} ${f(er * 0.2)} ${f(er * 3)}" fill="none" stroke="#d4a24c" stroke-width=".9"/>`;
      case 'xeyes': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er * 0.7)} ${f(y - er * 0.7)} L ${f(x + er * 0.7)} ${f(y + er * 0.7)} M ${f(x + er * 0.7)} ${f(y - er * 0.7)} L ${f(x - er * 0.7)} ${f(y + er * 0.7)}" ${STROKE(dk, 2.2)}/>`).join('');
      case 'blank': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.95)}" ry="${f(er * 1.05)}" fill="#f8fafc" ${STROKE(dk, 1.5)}/><ellipse cx="${f(x - er * 0.3)}" cy="${f(y - er * 0.35)}" rx="${f(er * 0.25)}" ry="${f(er * 0.18)}" fill="#cbd5e1"/>`).join('');
      case 'bags': return [e1, e2].map(([x, y]) => big([x, y], er * 0.85) + `<path d="M ${f(x - er * 0.8)} ${f(y + er * 1.05)} Q ${f(x)} ${f(y + er * 1.6)} ${f(x + er * 0.8)} ${f(y + er * 1.05)}" fill="none" stroke="#7c3aed" stroke-opacity=".55" stroke-width="1.2"/><path d="M ${f(x - er * 0.95)} ${f(y - er * 0.55)} H ${f(x + er * 0.95)}" stroke="${dk}" stroke-width="1.8"/>`).join('');
      case 'robot': return [e1, e2].map(([x, y]) => `<rect x="${f(x - er)}" y="${f(y - er * 0.85)}" width="${f(er * 2)}" height="${f(er * 1.7)}" rx="${f(er * 0.35)}" fill="#1f2937" ${STROKE(dk, 1.4)}/><rect x="${f(x - er * 0.55)}" y="${f(y - er * 0.4)}" width="${f(er * 1.1)}" height="${f(er * 0.8)}" rx="${f(er * 0.15)}" fill="${col === '#1b1b2f' ? '#22d3ee' : col}"/><rect x="${f(x - er * 0.5)}" y="${f(y - er * 0.35)}" width="${f(er * 0.35)}" height="${f(er * 0.25)}" fill="#fff" opacity=".8"/>`).join('');
      case 'lashes': return [e1, e2].map(([x, y], i) => big([x, y]) + `<path d="M ${f(x - er * 0.9)} ${f(y - er * 0.9)} l ${f(-er * 0.35)} ${f(-er * 0.45)} M ${f(x - er * 0.3)} ${f(y - er * 1.1)} l ${f(-er * 0.1)} ${f(-er * 0.55)} M ${f(x + er * 0.35)} ${f(y - er * 1.05)} l ${f(er * 0.15)} ${f(-er * 0.55)} M ${f(x + er * 0.9)} ${f(y - er * 0.8)} l ${f(er * 0.4)} ${f(-er * 0.4)}" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/>`).join('');
      case 'diamond': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><path d="M ${f(x)} ${f(y - er * 0.75)} L ${f(x + er * 0.55)} ${f(y + er * 0.05)} L ${f(x)} ${f(y + er * 0.85)} L ${f(x - er * 0.55)} ${f(y + er * 0.05)} Z" fill="${col === '#1b1b2f' ? '#8b5cf6' : col}"/><path d="M ${f(x)} ${f(y - er * 0.35)} L ${f(x + er * 0.25)} ${f(y + er * 0.05)} L ${f(x)} ${f(y + er * 0.45)} L ${f(x - er * 0.25)} ${f(y + er * 0.05)} Z" fill="#0b0a12"/><circle cx="${f(x - er * 0.35)}" cy="${f(y - er * 0.35)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      case 'sparkle': return [e1, e2].map(([x, y]) => big([x, y], er * 1.08) + star(x + er * 0.32, y - er * 0.3, er * 0.42, er * 0.14, '#fff') + star(x - er * 0.45, y + er * 0.5, er * 0.22, er * 0.08, '#fff')).join('');
      case 'crescent': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><circle cx="${f(x)}" cy="${f(y + er * 0.1)}" r="${f(er * 0.72)}" fill="${col}"/><path d="M ${f(x + er * 0.15)} ${f(y - er * 0.45)} A ${f(er * 0.55)} ${f(er * 0.55)} 0 1 0 ${f(x + er * 0.15)} ${f(y + er * 0.65)} A ${f(er * 0.42)} ${f(er * 0.42)} 0 1 1 ${f(x + er * 0.15)} ${f(y - er * 0.45)} Z" fill="#0b0a12"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.4)}" r="${f(er * 0.2)}" fill="#fff"/>`).join('');
      case 'squint': return [[e1, 1], [e2, -1]].map(([[x, y], d]) => `<path d="M ${f(x - d * er * 0.8)} ${f(y - er * 0.7)} L ${f(x + d * er * 0.6)} ${f(y)} L ${f(x - d * er * 0.8)} ${f(y + er * 0.7)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'bug': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 1.15)}" ry="${f(er * 1.3)}" fill="#1f1a2e" ${STROKE(dk, 1.4)}/>` + [[-0.4, -0.3], [0.25, -0.45], [-0.1, 0.25], [0.45, 0.2], [-0.5, 0.55], [0.1, 0.75]].map(([ox, oy]) => `<circle cx="${f(x + er * ox)}" cy="${f(y + er * oy)}" r="${f(er * 0.18)}" fill="${col === '#1b1b2f' ? '#4ade80' : col}" opacity=".55"/>`).join('') + `<ellipse cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.55)}" rx="${f(er * 0.35)}" ry="${f(er * 0.22)}" fill="#fff" opacity=".85"/>`).join('');
      case 'ringed': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.74)}" fill="${col}"/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.52)}" fill="none" stroke="#fff" stroke-width="${f(er * 0.12)}" opacity=".7"/><circle cx="${f(x - er * 0.08)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.24)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.38)}" cy="${f(y - er * 0.35)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      // v4.96
      case 'void': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 1.05)}" ry="${f(er * 1.15)}" fill="#05040a" stroke="${col === '#1b1b2f' ? '#6d28d9' : col}" stroke-width="1.3"/><circle cx="${f(x + er * 0.15)}" cy="${f(y + er * 0.1)}" r="${f(er * 0.18)}" fill="#fff"/><circle cx="${f(x - er * 0.45)}" cy="${f(y - er * 0.5)}" r="${f(er * 0.12)}" fill="#fff" opacity=".6"/>`).join('');
      case 'gemeye': return [e1, e2].map(([x, y]) => { const c = col === '#1b1b2f' ? '#a855f7' : col, r = er * 1.05; const pts = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return f(x + r * Math.cos(a)) + ',' + f(y + r * Math.sin(a)); }).join(' ');
        return `<polygon points="${pts}" fill="${c}" ${STROKE(dk, 1.4)}/><polygon points="${f(x)},${f(y - r * 0.55)} ${f(x + r * 0.5)},${f(y)} ${f(x)},${f(y + r * 0.55)} ${f(x - r * 0.5)},${f(y)}" fill="${shade(c, 0.45)}" opacity=".85"/><path d="M ${f(x - r * 0.85)} ${f(y - r * 0.5)} L ${f(x)} ${f(y - r * 0.55)} M ${f(x + r * 0.85)} ${f(y + r * 0.5)} L ${f(x)} ${f(y + r * 0.55)}" stroke="#fff" stroke-width=".8" opacity=".6"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.15)}" fill="#fff"/>`; }).join('');
      case 'snake': return [e1, e2].map(([x, y], i) => `<path d="M ${f(x - er * 1.1)} ${f(y + er * 0.1)} Q ${f(x)} ${f(y - er * 1.2)} ${f(x + er * 1.1)} ${f(y - er * 0.1)} Q ${f(x)} ${f(y + er * 1.1)} ${f(x - er * 1.1)} ${f(y + er * 0.1)} Z" fill="${col === '#1b1b2f' ? '#eab308' : col}" ${STROKE(dk, 1.4)}/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.16)}" ry="${f(er * 0.75)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.45)}" cy="${f(y - er * 0.2)}" r="${f(er * 0.14)}" fill="#fff"/><path d="M ${f(x - er * 1.2)} ${f(y - er * (i ? 1.25 : 0.95))} L ${f(x + er * 1.1)} ${f(y - er * (i ? 0.85 : 1.3))}" ${STROKE(dk, 2.2)}/>`).join('');
      case 'pixel': return [e1, e2].map(([x, y]) => { const q = er * 0.62; return `<rect x="${f(x - q)}" y="${f(y - q)}" width="${f(q * 2)}" height="${f(q * 2)}" fill="#0b0a12"/><rect x="${f(x - q)}" y="${f(y - q)}" width="${f(q * 0.8)}" height="${f(q * 0.8)}" fill="#fff"/>`; }).join('');
      case 'sclera': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#111018" ${STROKE(dk, 1.4)}/><circle cx="${f(x - er * 0.1)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.62)}" fill="${col === '#1b1b2f' ? '#f43f5e' : col}"/><circle cx="${f(x - er * 0.1)}" cy="${f(y + er * 0.08)}" r="${f(er * 0.95)}" fill="${col === '#1b1b2f' ? '#f43f5e' : col}" opacity=".18"/><ellipse cx="${f(x - er * 0.1)}" cy="${f(y + er * 0.08)}" rx="${f(er * 0.14)}" ry="${f(er * 0.45)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.3)}" r="${f(er * 0.14)}" fill="#fff"/>`).join('');
      // v5.6
      // v5.18: ojos compuestos (de insecto) y ojos de brasa
      case 'compound': return [e1, e2].map(([x, y]) => { const r = er * 1.15; let o = `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 1.12)}" fill="${col === '#1b1b2f' ? '#7f1d1d' : shade(col, -0.35)}" ${STROKE(dk, 1.5)}/>`;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) o += `<circle cx="${f(x + i * r * 0.48 + (j % 2 ? r * 0.24 : 0))}" cy="${f(y + j * r * 0.45)}" r="${f(r * 0.2)}" fill="${col === '#1b1b2f' ? '#ef4444' : col}" opacity=".85"/>`;
        return o + `<ellipse cx="${f(x - r * 0.38)}" cy="${f(y - r * 0.45)}" rx="${f(r * 0.28)}" ry="${f(r * 0.16)}" fill="#fff" opacity=".7"/>`; }).join('');
      case 'ember': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er * 0.9)} ${f(y + er * 0.5)} Q ${f(x - er * 0.9)} ${f(y - er * 0.7)} ${f(x - er * 0.2)} ${f(y - er * 1.6)} Q ${f(x)} ${f(y - er * 0.7)} ${f(x + er * 0.5)} ${f(y - er * 1.1)} Q ${f(x + er)} ${f(y - er * 0.2)} ${f(x + er * 0.9)} ${f(y + er * 0.5)} Q ${f(x)} ${f(y + er * 1.2)} ${f(x - er * 0.9)} ${f(y + er * 0.5)} Z" fill="#f97316" opacity=".55"/>` +
        `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.8)}" ry="${f(er * 0.85)}" fill="#fde047" ${STROKE(dk, 1.3)}/><ellipse cx="${f(x)}" cy="${f(y + er * 0.05)}" rx="${f(er * 0.22)}" ry="${f(er * 0.6)}" fill="#7c2d12"/>`).join('');
      case 'twinkle': return [e1, e2].map((p) => big(p, er * 1.05) + star(p[0] - er * 0.3, p[1] - er * 0.3, er * 0.42, er * 0.17, '#fff')).join('');
      case 'brows': return big(e1) + big(e2) + [e1, e2].map(([x, y], i) => `<path d="M ${f(x - er * 1.05)} ${f(y - er * (i ? 1.35 : 1.65))} L ${f(x + er * 1.05)} ${f(y - er * (i ? 1.65 : 1.35))}" stroke="${dk}" stroke-width="${f(Math.max(2, er * 0.45))}" stroke-linecap="round"/>`).join('');
      case 'almond': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er * 1.15)} ${f(y + er * 0.15)} Q ${f(x - er * 0.2)} ${f(y - er * 1.05)} ${f(x + er * 1.15)} ${f(y - er * 0.35)} Q ${f(x + er * 0.1)} ${f(y + er * 0.95)} ${f(x - er * 1.15)} ${f(y + er * 0.15)} Z" fill="#fff" ${STROKE(dk, 1.5)}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.55)}" fill="${col}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.26)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.22)}" cy="${f(y - er * 0.22)}" r="${f(er * 0.14)}" fill="#fff"/>`).join('');
      case 'dewy': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 1.05)}" ry="${f(er * 1.18)}" fill="#0b0a12" ${STROKE(dk, 1.3)}/><ellipse cx="${f(x)}" cy="${f(y + er * 0.45)}" rx="${f(er * 0.8)}" ry="${f(er * 0.5)}" fill="${col === '#1b1b2f' ? '#6d5bd0' : col}" opacity=".75"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.42)}" r="${f(er * 0.36)}" fill="#fff"/><circle cx="${f(x + er * 0.38)}" cy="${f(y + er * 0.05)}" r="${f(er * 0.17)}" fill="#fff"/><circle cx="${f(x - er * 0.1)}" cy="${f(y + er * 0.55)}" r="${f(er * 0.1)}" fill="#fff" opacity=".8"/>`).join('');
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
      case 'hook': return `<path d="M ${f(mx - w * 0.9)} ${f(my - w * 0.6)} Q ${f(mx + w * 0.4)} ${f(my - w * 0.9)} ${f(mx + w * 0.6)} ${f(my + w * 0.1)} Q ${f(mx + w * 0.55)} ${f(my + w * 0.9)} ${f(mx + w * 0.05)} ${f(my + w * 1.1)} Q ${f(mx + w * 0.1)} ${f(my + w * 0.3)} ${f(mx - w * 0.9)} ${f(my + w * 0.15)} Z" fill="#f59e0b" ${STROKE(dk, 1.3)}/><path d="M ${f(mx - w * 0.85)} ${f(my - w * 0.2)} Q ${f(mx)} ${f(my - w * 0.15)} ${f(mx + w * 0.45)} ${f(my + w * 0.05)}" stroke="${dk}" stroke-width=".9" fill="none"/>`;
      case 'trunk': return `<path d="M ${f(mx - w * 0.4)} ${f(my - w * 0.8)} Q ${f(mx - w * 0.6)} ${f(my + w * 1.2)} ${f(mx - w * 1.4)} ${f(my + w * 1.6)} Q ${f(mx - w * 1.7)} ${f(my + w * 1.2)} ${f(mx - w * 1.3)} ${f(my + w * 1.1)}" fill="none" stroke="${dk}" stroke-width="${f(w * 1.05)}" stroke-linecap="round"/><path d="M ${f(mx - w * 0.4)} ${f(my - w * 0.8)} Q ${f(mx - w * 0.6)} ${f(my + w * 1.2)} ${f(mx - w * 1.4)} ${f(my + w * 1.6)} Q ${f(mx - w * 1.7)} ${f(my + w * 1.2)} ${f(mx - w * 1.3)} ${f(my + w * 1.1)}" fill="none" stroke="${P.skin2 || P.skin}" stroke-width="${f(w * 0.65)}" stroke-linecap="round"/>`;
      case 'mandible': return `<path d="M ${f(mx - w * 0.6)} ${f(my)} q ${f(-w * 0.7)} ${f(w * 0.9)} ${f(w * 0.1)} ${f(w * 1.3)} q ${f(-w * 0.2)} ${f(-w * 0.5)} ${f(w * 0.25)} ${f(-w * 0.6)} Z M ${f(mx + w * 0.6)} ${f(my)} q ${f(w * 0.7)} ${f(w * 0.9)} ${f(-w * 0.1)} ${f(w * 1.3)} q ${f(w * 0.2)} ${f(-w * 0.5)} ${f(-w * 0.25)} ${f(-w * 0.6)} Z" fill="#78350f" ${STROKE(dk, 1.1)}/><path d="M ${f(mx - w * 0.5)} ${f(my)} H ${f(mx + w * 0.5)}" ${STROKE(dk, 1.6)}/>`;
      case 'lick': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.5)} ${f(my + w * 0.3)} q ${f(w * 0.9)} ${f(-w * 0.1)} ${f(w * 1.1)} ${f(-w * 0.9)} q ${f(-w * 0.6)} ${f(-w * 0.2)} ${f(-w * 0.9)} ${f(w * 0.4)} Z" fill="#f472b6" ${STROKE(dk, 1.1)}/>`;
      case 'muzzle': return `<ellipse cx="${f(mx)}" cy="${f(my + w * 0.2)}" rx="${f(w * 1.15)}" ry="${f(w * 0.8)}" fill="${P.inner}" ${STROKE(dk, 1.3)}/><ellipse cx="${f(mx)}" cy="${f(my - w * 0.15)}" rx="${f(w * 0.45)}" ry="${f(w * 0.3)}" fill="${dk}"/><path d="M ${f(mx)} ${f(my + w * 0.1)} V ${f(my + w * 0.5)} M ${f(mx - w * 0.55)} ${f(my + w * 0.45)} Q ${f(mx)} ${f(my + w * 0.85)} ${f(mx + w * 0.55)} ${f(my + w * 0.45)}" fill="none" ${STROKE(dk, 1.3)}/>`;
      case 'snout': return `<ellipse cx="${f(mx)}" cy="${f(my - 0.5)}" rx="${f(w * 0.85)}" ry="${f(w * 0.6)}" fill="#f9a8d4" ${STROKE(dk, 1.4)}/><ellipse cx="${f(mx - w * 0.3)}" cy="${f(my - 0.5)}" rx="${f(w * 0.14)}" ry="${f(w * 0.22)}" fill="${dk}"/><ellipse cx="${f(mx + w * 0.3)}" cy="${f(my - 0.5)}" rx="${f(w * 0.14)}" ry="${f(w * 0.22)}" fill="${dk}"/><path d="M ${f(mx - w * 0.5)} ${f(my + w * 0.85)} Q ${f(mx)} ${f(my + w * 1.15)} ${f(mx + w * 0.5)} ${f(my + w * 0.85)}" fill="none" ${STROKE(dk, 1.4)}/>`;
      case 'gum': return `<path d="M ${f(mx - w * 0.6)} ${f(my)} Q ${f(mx)} ${f(my + w * 0.5)} ${f(mx + w * 0.6)} ${f(my)}" fill="none" ${STROKE(dk, 1.8)}/><circle cx="${f(mx + w * 0.6)}" cy="${f(my + w * 0.6)}" r="${f(w * 0.85)}" fill="#f9a8d4" fill-opacity=".9" ${STROKE('#be185d', 1.1)}/><circle cx="${f(mx + w * 0.35)}" cy="${f(my + w * 0.35)}" r="${f(w * 0.2)}" fill="#fff" opacity=".8"/>`;
      case 'grit': return `<rect x="${f(mx - w)}" y="${f(my - w * 0.35)}" width="${f(w * 2)}" height="${f(w * 0.9)}" rx="${f(w * 0.25)}" fill="#fff" ${STROKE(dk, 1.5)}/><path d="M ${f(mx - w)} ${f(my + w * 0.1)} H ${f(mx + w)}" stroke="${dk}" stroke-width=".9"/>` + [-0.5, 0, 0.5].map((o) => `<path d="M ${f(mx + w * o)} ${f(my - w * 0.35)} v ${f(w * 0.9)}" stroke="${dk}" stroke-width=".9"/>`).join('');
      case 'mask': return `<path d="M ${f(mx - w * 1.8)} ${f(my - w * 0.9)} Q ${f(mx)} ${f(my - w * 1.3)} ${f(mx + w * 1.8)} ${f(my - w * 0.9)} L ${f(mx + w * 1.2)} ${f(my + w * 1.3)} Q ${f(mx)} ${f(my + w * 2.1)} ${f(mx - w * 1.2)} ${f(my + w * 1.3)} Z" fill="#1e3a8a" ${STROKE(dk, 1.3)}/>` + [-0.6, 0, 0.6].map((o) => `<circle cx="${f(mx + w * o)}" cy="${f(my + w * 0.4)}" r="${f(w * 0.12)}" fill="#fff" opacity=".85"/>`).join('');
      case 'kiss': return `<path d="M ${f(mx - w * 0.3)} ${f(my - w * 0.35)} Q ${f(mx + w * 0.4)} ${f(my - w * 0.2)} ${f(mx)} ${f(my + w * 0.15)} Q ${f(mx + w * 0.45)} ${f(my + w * 0.45)} ${f(mx - w * 0.25)} ${f(my + w * 0.75)}" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(mx + w * 1.1)} ${f(my - w * 0.9)} c ${f(-w * 0.35)} ${f(-w * 0.45)} ${f(-w * 0.9)} 0 ${f(-w * 0.45)} ${f(w * 0.45)} l ${f(w * 0.45)} ${f(w * 0.4)} l ${f(w * 0.45)} ${f(-w * 0.4)} c ${f(w * 0.45)} ${f(-w * 0.45)} ${f(-w * 0.1)} ${f(-w * 0.9)} ${f(-w * 0.45)} ${f(-w * 0.45)} Z" fill="#f43f5e"/>`;
      case 'zipper': return `<path d="M ${f(mx - w)} ${f(my + 0.5)} H ${f(mx + w)}" ${STROKE(dk, 2)}/>` + [-0.7, -0.35, 0, 0.35, 0.7].map((o) => `<path d="M ${f(mx + w * o)} ${f(my - 1.2)} v 3.4" stroke="${dk}" stroke-width="1"/>`).join('') + `<rect x="${f(mx + w * 0.9)}" y="${f(my - 0.8)}" width="${f(w * 0.35)}" height="${f(w * 0.6)}" rx=".8" fill="#d6d3d1" ${STROKE(dk, 0.8)}/>`;
      case 'catmouth': return `<path d="M ${f(mx - w * 0.85)} ${f(my)} q ${f(w * 0.42)} ${f(w * 0.7)} ${f(w * 0.85)} 0 q ${f(w * 0.42)} ${f(w * 0.7)} ${f(w * 0.85)} 0" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(mx - w * 1.2)} ${f(my - 1.5)} l ${f(-w * 1.1)} ${f(-w * 0.25)} M ${f(mx - w * 1.2)} ${f(my)} l ${f(-w * 1.15)} ${f(w * 0.15)} M ${f(mx + w * 1.2)} ${f(my - 1.5)} l ${f(w * 1.1)} ${f(-w * 0.25)} M ${f(mx + w * 1.2)} ${f(my)} l ${f(w * 1.15)} ${f(w * 0.15)}" stroke="${dk}" stroke-width=".8" opacity=".6"/>`;
      case 'lips': return `<path d="M ${f(mx - w * 0.8)} ${f(my + 0.5)} Q ${f(mx - w * 0.4)} ${f(my - w * 0.45)} ${f(mx)} ${f(my)} Q ${f(mx + w * 0.4)} ${f(my - w * 0.45)} ${f(mx + w * 0.8)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx - w * 0.8)} ${f(my + 0.5)} Z" fill="#e11d48" ${STROKE(dk, 1.2)}/><path d="M ${f(mx - w * 0.7)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.25)} ${f(mx + w * 0.7)} ${f(my + 0.5)}" stroke="#881337" stroke-width=".8" fill="none"/>`;
      case 'frown': return `<path d="M ${f(mx - w * 0.9)} ${f(my + w * 0.55)} Q ${f(mx)} ${f(my - w * 0.4)} ${f(mx + w * 0.9)} ${f(my + w * 0.55)}" fill="none" ${STROKE(dk, 2)}/>`;
      case 'stitch': return `<path d="M ${f(mx - w)} ${f(my + 0.5)} Q ${f(mx)} ${f(my + w * 0.45)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 1.8)}/>` + [-0.6, 0, 0.6].map((o) => `<path d="M ${f(mx + w * o - 1.3)} ${f(my - 1.2)} l 2.6 ${f(2.8 + w * 0.15)} M ${f(mx + w * o + 1.3)} ${f(my - 1.2)} l -2.6 ${f(2.8 + w * 0.15)}" stroke="${dk}" stroke-width="1.1" stroke-linecap="round"/>`).join('');
      case 'toothy': return `<rect x="${f(mx - w)}" y="${f(my - 1.5)}" width="${f(w * 2)}" height="${f(w * 0.85)}" rx="${f(w * 0.3)}" fill="#fff" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w)} ${f(my - 1.5 + w * 0.42)} H ${f(mx + w)}" stroke="${dk}" stroke-width=".9"/>` + [-0.5, 0, 0.5].map((o) => `<path d="M ${f(mx + w * o)} ${f(my - 1.5)} v ${f(w * 0.85)}" stroke="${dk}" stroke-width=".9"/>`).join('');
      case 'gaptooth': return `<path d="M ${f(mx - w * 1.1)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.6)} ${f(mx + w * 1.1)} ${f(my - 1)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><rect x="${f(mx - w * 0.5)}" y="${f(my - 0.8)}" width="${f(w * 0.45)}" height="${f(w * 0.55)}" rx=".6" fill="#fff"/><ellipse cx="${f(mx + w * 0.1)}" cy="${f(my + w * 0.85)}" rx="${f(w * 0.5)}" ry="${f(w * 0.25)}" fill="#f472b6"/>`;
      case 'drool': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.85)} ${f(my)} q ${f(w * 0.35)} ${f(w * 0.7)} 0 ${f(w * 1.1)} q ${f(-w * 0.35)} ${f(-w * 0.4)} 0 ${f(-w * 1.1)} Z" fill="#bae6fd" stroke="#38bdf8" stroke-width=".8"/>`;
      case 'whistle': return `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(w * 0.32)}" ry="${f(w * 0.36)}" fill="#4a0f1c" ${STROKE(dk, 1.5)}/><path d="M ${f(mx + w * 0.7)} ${f(my - 0.5)} l ${f(w * 0.6)} ${f(-w * 0.3)} M ${f(mx + w * 0.75)} ${f(my + 1.2)} l ${f(w * 0.7)} 0 M ${f(mx + w * 0.7)} ${f(my + 2.8)} l ${f(w * 0.6)} ${f(w * 0.3)}" stroke="${dk}" stroke-width="1" stroke-linecap="round" opacity=".6"/>`;
      // v4.96
      case 'shark': return `<path d="M ${f(mx - w * 1.4)} ${f(my - 1.5)} Q ${f(mx)} ${f(my + w * 1.6)} ${f(mx + w * 1.4)} ${f(my - 1.5)} Q ${f(mx)} ${f(my + w * 0.2)} ${f(mx - w * 1.4)} ${f(my - 1.5)} Z" fill="#3b0a14" ${STROKE(dk, 1.5)}/>` +
        [-1, -0.5, 0, 0.5, 1].map((o) => `<path d="M ${f(mx + w * o * 1.15 - w * 0.22)} ${f(my - 1 + Math.abs(o) * -0.6 + w * 0.15)} l ${f(w * 0.22)} ${f(w * 0.55)} l ${f(w * 0.22)} ${f(-w * 0.55)} Z" fill="#fff"/>`).join('') +
        [-0.6, 0, 0.6].map((o) => `<path d="M ${f(mx + w * o - w * 0.2)} ${f(my + w * 0.95)} l ${f(w * 0.2)} ${f(-w * 0.45)} l ${f(w * 0.2)} ${f(w * 0.45)} Z" fill="#fff"/>`).join('');
      case 'sucker': return `<circle cx="${f(mx)}" cy="${f(my + w * 0.35)}" r="${f(w * 0.85)}" fill="#f9a8d4" ${STROKE(dk, 1.5)}/><circle cx="${f(mx)}" cy="${f(my + w * 0.35)}" r="${f(w * 0.45)}" fill="#3b0a14"/>` +
        Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<circle cx="${f(mx + Math.cos(a) * w * 0.62)}" cy="${f(my + w * 0.35 + Math.sin(a) * w * 0.62)}" r="${f(w * 0.12)}" fill="#fff"/>`; }).join('');
      case 'goofy': return `<path d="M ${f(mx - w * 1.2)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.8)} ${f(mx + w * 1.2)} ${f(my - 1)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><rect x="${f(mx - w * 0.1)}" y="${f(my - 1)}" width="${f(w * 0.55)}" height="${f(w * 0.6)}" rx=".6" fill="#fff" ${STROKE(dk, 0.7)}/><ellipse cx="${f(mx - w * 0.2)}" cy="${f(my + w * 0.9)}" rx="${f(w * 0.55)}" ry="${f(w * 0.28)}" fill="#f472b6"/>`;
      case 'whiskers': return `<path d="M ${f(mx - w * 0.7)} ${f(my)} q ${f(w * 0.35)} ${f(w * 0.6)} ${f(w * 0.7)} 0 q ${f(w * 0.35)} ${f(w * 0.6)} ${f(w * 0.7)} 0" fill="none" ${STROKE(dk, 1.7)}/><ellipse cx="${f(mx)}" cy="${f(my - w * 0.4)}" rx="${f(w * 0.3)}" ry="${f(w * 0.2)}" fill="${dk}"/>` +
        [[-1, -0.35], [-1, 0.15], [1, -0.35], [1, 0.15]].map(([d, oy]) => `<path d="M ${f(mx + d * w * 0.9)} ${f(my + w * oy)} l ${f(d * w * 1.9)} ${f(w * oy * 0.9 - w * 0.1)}" stroke="${dk}" stroke-width="1" stroke-linecap="round" opacity=".75"/>`).join('');
      case 'underbite': return `<path d="M ${f(mx - w * 1.05)} ${f(my - 0.5)} Q ${f(mx)} ${f(my + w * 1.15)} ${f(mx + w * 1.05)} ${f(my - 0.5)}" fill="none" ${STROKE(dk, 2.2)}/><path d="M ${f(mx - w * 0.8)} ${f(my + w * 0.45)} l ${f(w * 0.12)} ${f(-w * 0.95)} l ${f(w * 0.36)} ${f(w * 0.8)} Z M ${f(mx + w * 0.8)} ${f(my + w * 0.45)} l ${f(-w * 0.12)} ${f(-w * 0.95)} l ${f(-w * 0.36)} ${f(w * 0.8)} Z" fill="#fffaf0" ${STROKE(dk, 0.9)}/>`;
      // v5.6
      // v5.18: fauces y labios de pez
      case 'maw': return `<path d="M ${f(mx - w * 1.5)} ${f(my - 2)} Q ${f(mx)} ${f(my + w * 2.2)} ${f(mx + w * 1.5)} ${f(my - 2)} Q ${f(mx)} ${f(my + w * 0.2)} ${f(mx - w * 1.5)} ${f(my - 2)} Z" fill="#2a0a12" ${STROKE(dk, 1.6)}/>` +
        [-1.1, -0.55, 0, 0.55, 1.1].map((o) => `<path d="M ${f(mx + o * w - w * 0.18)} ${f(my - 1 + Math.abs(o) * w * 0.25)} l ${f(w * 0.18)} ${f(w * 0.6)} l ${f(w * 0.18)} ${f(-w * 0.6)} Z" fill="#fffaf0"/>`).join('') +
        [-0.8, 0, 0.8].map((o) => `<path d="M ${f(mx + o * w - w * 0.16)} ${f(my + w * 1.1 - Math.abs(o) * w * 0.35)} l ${f(w * 0.16)} ${f(-w * 0.5)} l ${f(w * 0.16)} ${f(w * 0.5)} Z" fill="#fffaf0"/>`).join('');
      case 'fishlips': return `<ellipse cx="${f(mx)}" cy="${f(my + w * 0.35)}" rx="${f(w * 0.75)}" ry="${f(w * 0.62)}" fill="#f9a8d4" ${STROKE(dk, 1.6)}/><ellipse cx="${f(mx)}" cy="${f(my + w * 0.38)}" rx="${f(w * 0.35)}" ry="${f(w * 0.26)}" fill="#4a0f1c"/><ellipse cx="${f(mx - w * 0.3)}" cy="${f(my + w * 0.05)}" rx="${f(w * 0.18)}" ry="${f(w * 0.09)}" fill="#fff" opacity=".7"/>`;
      case 'fang1': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.05)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.42)} ${f(my + w * 0.18)} l ${f(w * 0.14)} ${f(w * 0.55)} l ${f(w * 0.2)} ${f(-w * 0.62)} Z" fill="#fffaf0" ${STROKE(dk, 0.9)}/>`;
      case 'blep': return `<path d="M ${f(mx - w * 0.8)} ${f(my)} Q ${f(mx - w * 0.4)} ${f(my + w * 0.45)} ${f(mx)} ${f(my)} Q ${f(mx + w * 0.4)} ${f(my + w * 0.45)} ${f(mx + w * 0.8)} ${f(my)}" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(mx - w * 0.28)} ${f(my + w * 0.18)} Q ${f(mx)} ${f(my + w * 1.05)} ${f(mx + w * 0.28)} ${f(my + w * 0.18)} Z" fill="#f472b6" ${STROKE(dk, 1)}/>`;
      case 'ohno': return `<path d="M ${f(mx - w * 0.75)} ${f(my + w * 0.7)} Q ${f(mx - w * 0.75)} ${f(my - w * 0.15)} ${f(mx)} ${f(my - w * 0.1)} Q ${f(mx + w * 0.75)} ${f(my - w * 0.15)} ${f(mx + w * 0.75)} ${f(my + w * 0.7)} Q ${f(mx + w * 0.4)} ${f(my + w * 0.45)} ${f(mx)} ${f(my + w * 0.72)} Q ${f(mx - w * 0.4)} ${f(my + w * 0.45)} ${f(mx - w * 0.75)} ${f(my + w * 0.7)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/>`;
      case 'beam': return `<path d="M ${f(mx - w * 1.25)} ${f(my - 1.5)} L ${f(mx + w * 1.25)} ${f(my - 1.5)} Q ${f(mx + w * 1.15)} ${f(my + w * 1.6)} ${f(mx)} ${f(my + w * 1.6)} Q ${f(mx - w * 1.15)} ${f(my + w * 1.6)} ${f(mx - w * 1.25)} ${f(my - 1.5)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w * 1.1)} ${f(my - 1)} L ${f(mx + w * 1.1)} ${f(my - 1)} L ${f(mx + w * 0.95)} ${f(my + w * 0.35)} L ${f(mx - w * 0.95)} ${f(my + w * 0.35)} Z" fill="#fff"/><ellipse cx="${f(mx)}" cy="${f(my + w * 1.1)}" rx="${f(w * 0.55)}" ry="${f(w * 0.32)}" fill="#f472b6"/>`;
      default: return `<path d="M ${f(mx - w)} ${f(my)} Q ${f(mx - w / 2)} ${f(my + w * 0.85)} ${f(mx)} ${f(my)} Q ${f(mx + w / 2)} ${f(my + w * 0.85)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 2)}/>`;
    }
  }

  /* ---------- v4.96: piezas de las siluetas (detrás del cuerpo y encima) ---------- */
  function archSvg(ind, P, layer) {
    const a = ind.arch; if (!a) return '';
    const { cx, cy, W, H, skin, dk, s, top, hornC } = P, dark = shade(skin, -0.22), lite = shade(skin, 0.18);
    const stroke = (d, c, w1, w2) => `<path d="${d}" fill="none" stroke="${dk}" stroke-width="${f(w1)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    switch (a) {
      case 'dino': {
        if (layer === 'back') {
          // cola gruesa y afilada que sale por detrás y baja hacia el suelo
          const x0 = cx + W * 0.7, y0 = cy + H * 0.05, tw = Math.min(W, (76 + VIEW_SIDE[P.stage] / 2 - 3 - cx) / 2.05); // v4.96b: la cola no se sale del recuadro
          const tail = `<path d="M ${f(x0)} ${f(y0 - H * 0.35)} Q ${f(cx + tw * 1.55)} ${f(cy - H * 0.05)} ${f(cx + tw * 2.05)} ${f(cy + H * 0.7)} Q ${f(cx + tw * 1.45)} ${f(cy + H * 0.55)} ${f(x0)} ${f(y0 + H * 0.45)} Z" fill="${skin}" ${STROKE(dk, 2.2)}/><path d="M ${f(x0 + W * 0.1)} ${f(y0 + H * 0.25)} Q ${f(cx + tw * 1.4)} ${f(cy + H * 0.42)} ${f(cx + tw * 1.9)} ${f(cy + H * 0.66)}" fill="none" stroke="${dark}" stroke-width="${f(2 * s)}" opacity=".7"/>`;
          // placas dorsales
          // v4.96b: placas sólo en la mitad trasera del lomo (delante chocaban con orejas, pelo y sombreros),
          // inclinadas hacia atrás, del color de la piel y bajando por la cola
          const pc = ind.plateC || shade(skin, -0.2), pl = shade(pc, 0.35);
          const plate = (x, y, hgt, w, tilt) => `<path d="M ${f(x - w)} ${f(y + 2)} Q ${f(x - w * 0.4)} ${f(y - hgt * 0.7)} ${f(x + tilt)} ${f(y - hgt)} Q ${f(x + w * 0.7)} ${f(y - hgt * 0.4)} ${f(x + w)} ${f(y + 2)} Z" fill="${pc}" ${STROKE(dk, 1.5)}/><path d="M ${f(x - w * 0.35)} ${f(y)} Q ${f(x)} ${f(y - hgt * 0.5)} ${f(x + tilt * 0.8)} ${f(y - hgt * 0.85)}" fill="none" stroke="${pl}" stroke-width="${f(1.1 * s)}" stroke-linecap="round" opacity=".8"/>`;
          const plates = [0.2, 0.45, 0.68].map((o, i) => { const x = cx + W * o; return plate(x, top(x) + 2.5, (7.5 - i * 0.8) * s, 4 * s, 2.2 * s); }).join('') +
            [1.0, 1.3, 1.58].map((o, i) => { const x = cx + tw * o, y = cy - H * (0.32 - i * 0.27); return plate(x, y + 1, (5.2 - i * 1.2) * s, 3.2 * s, 2 * s); }).join('');
          return plates + tail;
        }
        return '';
      }
      case 'scorpion': {
        if (layer !== 'back') return '';
        // cola de segmentos que se arquea por encima del lomo y acaba en aguijón
        const pts = Array.from({ length: 7 }, (_, i) => { const t = i / 6, ang = -0.25 + t * 2.75; return [cx + W * 0.75 + Math.cos(ang - Math.PI / 2) * W * 0.62 * (1 - t * 0.15) + W * 0.25 * (1 - t), cy - H * 0.2 - Math.sin(ang) * H * 1.15 - t * H * 0.25]; });
        const segs = pts.map(([x, y], i) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f((7.8 - i * 0.55) * s)}" ry="${f((6.6 - i * 0.45) * s)}" fill="${i % 2 ? skin : lite}" ${STROKE(dk, 1.6)}/>`).reverse().join('');
        const [tx, ty] = pts[pts.length - 1];
        const sting = `<path d="M ${f(tx - 3 * s)} ${f(ty - 2 * s)} Q ${f(tx - 9 * s)} ${f(ty + 2 * s)} ${f(tx - 12 * s)} ${f(ty + 9 * s)} Q ${f(tx - 5 * s)} ${f(ty + 5 * s)} ${f(tx + 2 * s)} ${f(ty + 2 * s)} Z" fill="${hornC}" ${STROKE(dk, 1.5)}/><circle cx="${f(tx - 11.5 * s)}" cy="${f(ty + 8.5 * s)}" r="${f(1.2 * s)}" fill="#a3e635"/>`;
        return segs + sting;
      }
      case 'beast': {
        if (layer !== 'back') return '';
        // cola peluda alzada
        const x0 = cx + W * 0.85, y0 = cy - H * 0.05;
        const d = `M ${f(x0)} ${f(y0 + 4)} Q ${f(x0 + 16 * s)} ${f(y0 + 2)} ${f(x0 + 20 * s)} ${f(y0 - 14 * s)} Q ${f(x0 + 24 * s)} ${f(y0 - 30 * s)} ${f(x0 + 10 * s)} ${f(y0 - 32 * s)} Q ${f(x0 + 16 * s)} ${f(y0 - 22 * s)} ${f(x0 + 8 * s)} ${f(y0 - 10 * s)} Q ${f(x0 + 4 * s)} ${f(y0 - 4)} ${f(x0 - 2)} ${f(y0 - 4)} Z`;
        return `<path d="${d}" fill="${skin}" ${STROKE(dk, 2)}/><path d="M ${f(x0 + 18 * s)} ${f(y0 - 18 * s)} Q ${f(x0 + 19 * s)} ${f(y0 - 27 * s)} ${f(x0 + 11 * s)} ${f(y0 - 30 * s)}" fill="none" stroke="${P.inner}" stroke-width="${f(4 * s)}" stroke-linecap="round" opacity=".9"/>`;
      }
      case 'shell': {
        if (layer !== 'front') return '';
        // caparazón abombado sobre el lomo, con placas
        const x0 = Math.max(cx - W * 0.15, P.fx + P.er * 2.3), x1 = cx + W * 1.08, yb = cy + H * 0.42, yt = cy - H * 1.12;
        const shell = `M ${f(x0)} ${f(yb)} Q ${f(x0 - W * 0.12)} ${f(yt + H * 0.15)} ${f((x0 + x1) / 2)} ${f(yt)} Q ${f(x1 + W * 0.18)} ${f(yt + H * 0.25)} ${f(x1)} ${f(yb)} Q ${f((x0 + x1) / 2)} ${f(yb + H * 0.18)} ${f(x0)} ${f(yb)} Z`;
        const C = hornC, mx2 = (x0 + x1) / 2, my2 = (yb + yt) / 2, sw = x1 - x0;
        const plate = (x, y, r) => `<polygon points="${Array.from({ length: 6 }, (_, i) => { const a2 = (i * Math.PI) / 3; return f(x + r * Math.cos(a2)) + ',' + f(y + r * 0.8 * Math.sin(a2)); }).join(' ')}" fill="${shade(C, 0.18)}" stroke="${shade(C, -0.45)}" stroke-width="1.2"/>`;
        return `<path d="${shell}" fill="${C}" ${STROKE(dk, 2.2)}/>` + plate(mx2, my2 - H * 0.15, sw * 0.19) + plate(mx2 - sw * 0.31, my2 + H * 0.12, sw * 0.13) + plate(mx2 + sw * 0.31, my2 + H * 0.1, sw * 0.13) + plate(mx2, my2 + H * 0.42, sw * 0.12) +
          `<path d="M ${f(x0 + W * 0.05)} ${f(yb - 2)} Q ${f(mx2)} ${f(yb + H * 0.12)} ${f(x1 - W * 0.05)} ${f(yb - 2)}" fill="none" stroke="${shade(C, 0.35)}" stroke-width="${f(2.2 * s)}" opacity=".8"/>`;
      }
      default: return '';
    }
  }

  // Orejas y cabeza (detrás o delante del cuerpo)
  function earsSvg(ind, P, front) {
    const { cx, W, top, skin, inner, dk, hornC, s } = P, k = ind.earScale * s;
    const L = cx - W * 0.45, Rr = cx + W * 0.2, yL = top(L), yR = top(Rr);
    switch (ind.ears) {
      case 'curved': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 4 * k)} ${f(y + 5)} C ${f(x + d * 4 * k)} ${f(y - 14 * k)} ${f(x + d * 18 * k)} ${f(y - 16 * k)} ${f(x + d * 20 * k)} ${f(y - 4 * k)} C ${f(x + d * 14 * k)} ${f(y - 9 * k)} ${f(x + d * 6 * k)} ${f(y - 6 * k)} ${f(x + 4 * k)} ${f(y + 5)} Z" fill="${hornC}" ${STROKE(dk, 1.8)}/>`).join('');
      case 'nubs': return front ? '' : [[L + 2, yL], [Rr - 1, yR]].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y - 2 * k)}" rx="${f(4 * k)}" ry="${f(4.6 * k)}" fill="${hornC}" ${STROKE(dk, 1.6)}/><ellipse cx="${f(x - 1)}" cy="${f(y - 3.5 * k)}" rx="${f(1.4 * k)}" ry="${f(1.6 * k)}" fill="#fff" opacity=".5"/>`).join('');
      case 'feelers': return front ? '' : [[L + 2, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 3)} C ${f(x + d * 2 * k)} ${f(y - 10 * k)} ${f(x - d * 6 * k)} ${f(y - 14 * k)} ${f(x + d * 2 * k)} ${f(y - 22 * k)} S ${f(x + d * 12 * k)} ${f(y - 26 * k)} ${f(x + d * 10 * k)} ${f(y - 32 * k)}" fill="none" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 10 * k)} ${f(y - 32 * k)} l ${f(d * 2.5 * k)} ${f(1.5 * k)}" ${STROKE(dk, 1.8)}/>`).join('');
      case 'fan': { const x0 = cx - W * 0.1, y0 = top(x0) + 3; return front ? '' : [-50, -25, 0, 25, 50].map((a) => `<path d="M ${f(x0)} ${f(y0)} L ${f(x0 - 4 * k)} ${f(y0 - 18 * k)} Q ${f(x0)} ${f(y0 - 21 * k)} ${f(x0 + 4 * k)} ${f(y0 - 18 * k)} Z" fill="${P.skin2 || inner}" ${STROKE(dk, 1.3)} transform="rotate(${a} ${f(x0)} ${f(y0)})"/>`).join(''); }
      case 'fox': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 8 * k)} ${f(y + 6)} L ${f(x + d * 4 * k)} ${f(y - 21 * k)} L ${f(x + 9 * k)} ${f(y + 5)} Z" fill="${skin}" ${STROKE(dk)}/><path d="M ${f(x - 4 * k)} ${f(y + 3)} L ${f(x + d * 3 * k)} ${f(y - 13 * k)} L ${f(x + 5 * k)} ${f(y + 3)} Z" fill="${inner}"/><path d="M ${f(x + d * 1 * k)} ${f(y - 15 * k)} L ${f(x + d * 4 * k)} ${f(y - 21 * k)} L ${f(x + d * 6.5 * k)} ${f(y - 15 * k)} Z" fill="${dk}" opacity=".8"/>`).join('');
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
      // v5.15: orejas nuevas
      case 'owl': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => [0, 1, 2].map((i) => { const a = (d < 0 ? -118 : -62) + d * (i * 16 - 10), r = a * Math.PI / 180, len = (15 - i * 2.5) * k, tx = x + Math.cos(r) * len, ty = y + 3 + Math.sin(r) * len, nx = -Math.sin(r) * 3 * k, ny = Math.cos(r) * 3 * k;
        return `<path d="M ${f(x - nx * .6)} ${f(y + 3 - ny * .6)} Q ${f((x + tx) / 2 + nx)} ${f((y + ty) / 2 + ny)} ${f(tx)} ${f(ty)} Q ${f((x + tx) / 2 - nx * .4)} ${f((y + ty) / 2 - ny * .4)} ${f(x + nx * .6)} ${f(y + 3 + ny * .6)} Z" fill="${i === 1 ? shade(skin, -0.2) : shade(skin, -0.08)}" ${STROKE(dk, 1.4)}/>`; }).join('')).join('');
      case 'gills': return front ? '' : [[cx - W * 0.84, P.ey - 2, -1], [cx + W * 0.6, P.ey - 4, 1]].map(([x, y, d]) => [-1, 0, 1].map((i) => { const tx = x + d * 13 * k, ty = y + i * 8 * k - 3 * k, c = shade(inner, -0.05 * i);
        return `<path d="M ${f(x)} ${f(y + i * 2)} Q ${f(x + d * 7 * k)} ${f(ty - 3 * k)} ${f(tx)} ${f(ty)}" fill="none" stroke="${dk}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y + i * 2)} Q ${f(x + d * 7 * k)} ${f(ty - 3 * k)} ${f(tx)} ${f(ty)}" fill="none" stroke="${c}" stroke-width="${f(2.8 * k)}" stroke-linecap="round"/>` +
          [0.45, 0.75, 1].map((t2) => `<circle cx="${f(x + (tx - x) * t2)}" cy="${f(y + i * 2 + (ty - y - i * 2) * t2 - 1.6 * k)}" r="${f(1.5 * k)}" fill="${shade(c, 0.25)}" ${STROKE(dk, .7)}/>`).join(''); }).join('')).join('');
      case 'dish': return front ? '' : [[L - 2, yL, -1], [Rr + 2, yR, 1]].map(([x, y, d]) => { const ex = x + d * 6 * k, ey = y - 12 * k;
        return `<path d="M ${f(x)} ${f(y + 3)} L ${f(ex)} ${f(ey + 4 * k)}" stroke="${dk}" stroke-width="${f(3 * k)}" stroke-linecap="round"/><ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(9 * k)}" ry="${f(6.4 * k)}" transform="rotate(${d * 24} ${f(ex)} ${f(ey)})" fill="${skin}" ${STROKE(dk, 1.6)}/><ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(5.6 * k)}" ry="${f(3.8 * k)}" transform="rotate(${d * 24} ${f(ex)} ${f(ey)})" fill="${inner}"/><circle cx="${f(ex)}" cy="${f(ey)}" r="${f(1.5 * k)}" fill="${dk}"/>`; }).join('');
      case 'lop': return !front ? '' : [[cx - W * 0.62, top(cx - W * 0.62) + 4, -1], [cx + W * 0.36, top(cx + W * 0.36) + 4, 1]].map(([x, y, d]) => `<path d="M ${f(x - d * 3 * k)} ${f(y)} C ${f(x + d * 12 * k)} ${f(y - 4 * k)} ${f(x + d * 14 * k)} ${f(y + 18 * k)} ${f(x + d * 8 * k)} ${f(y + 26 * k)} C ${f(x + d * 2 * k)} ${f(y + 28 * k)} ${f(x)} ${f(y + 16 * k)} ${f(x - d * 3 * k)} ${f(y + 3 * k)} Z" fill="${shade(skin, -0.1)}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2 * k)} ${f(y + 3 * k)} C ${f(x + d * 9 * k)} ${f(y + 4 * k)} ${f(x + d * 10 * k)} ${f(y + 16 * k)} ${f(x + d * 7 * k)} ${f(y + 22 * k)}" fill="none" stroke="${inner}" stroke-width="${f(2.6 * k)}" stroke-linecap="round" opacity=".8"/>`).join('');
      case 'flameears': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 6 * k)} ${f(y + 5)} Q ${f(x - 7 * k)} ${f(y - 8 * k)} ${f(x + d * 3 * k)} ${f(y - 19 * k)} Q ${f(x + d * 1 * k)} ${f(y - 10 * k)} ${f(x + d * 7 * k)} ${f(y - 9 * k)} Q ${f(x + 8 * k)} ${f(y - 2 * k)} ${f(x + 7 * k)} ${f(y + 5)} Z" fill="#f97316" ${STROKE('#7c2d12', 1.6)}/><path d="M ${f(x - 3 * k)} ${f(y + 3)} Q ${f(x - 3 * k)} ${f(y - 6 * k)} ${f(x + d * 2 * k)} ${f(y - 12 * k)} Q ${f(x + 4 * k)} ${f(y - 3 * k)} ${f(x + 4 * k)} ${f(y + 3)} Z" fill="#fde047"/>`).join('');
      case 'shellears': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => { const r = 8 * k, ex = x + d * 2 * k, ey = y - 6 * k;
        return `<path d="M ${f(ex - r)} ${f(ey + r * .5)} Q ${f(ex - r)} ${f(ey - r)} ${f(ex)} ${f(ey - r)} Q ${f(ex + r)} ${f(ey - r)} ${f(ex + r)} ${f(ey + r * .5)} Z" fill="${shade(hornC, 0.1)}" ${STROKE(dk, 1.6)}/>` + [-0.5, 0, 0.5].map((o) => `<path d="M ${f(ex + o * r * .3)} ${f(ey + r * .45)} L ${f(ex + o * r * 1.2)} ${f(ey - r * .75)}" stroke="${dk}" stroke-width="1" opacity=".5"/>`).join(''); }).join('');
      case 'tuft': { const x = cx - W * 0.2, y = top(x); return front ? '' : `<path d="M ${f(x - 9 * k)} ${f(y + 5)} Q ${f(x - 10 * k)} ${f(y - 12 * k)} ${f(x + 2 * k)} ${f(y - 13 * k)} Q ${f(x - 4 * k)} ${f(y - 7 * k)} ${f(x + 3 * k)} ${f(y - 4 * k)} Q ${f(x + 10 * k)} ${f(y - 10 * k)} ${f(x + 11 * k)} ${f(y - 5 * k)} Q ${f(x + 8 * k)} ${f(y + 1)} ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${shade(skin, -0.12)}" ${STROKE(dk, 1.8)}/>`; }
      default: return '';
    }
  }

  // Manos según la casa
  const Pm2 = (kind) => PRESET[kind] || PRESET.round;
  /**
   * v5.15: cada brazo va en su grupo con el giro en el hombro, para poder moverlo (saludar, levantar los brazos,
   * balancearlos). Algunos individuos los balancean solos de vez en cuando (arm-idle).
   */
  function armSvg(ind, P, side) {
    const shape = armShape(ind, P, side); if (!shape) return '';
    const { cx, cy, W, H } = P, near = side === 'near', edge = Pm2(P.kind).pear ? 1 + Pm2(P.kind).pear * 0.08 : 1;
    const sx = near ? cx - W * 0.9 : cx + W * 0.9 * edge, sy = cy + H * 0.08;
    const idle = ((ind.seed >>> 11) % 3) === 0 ? ' arm-idle' : '';
    return `<g class="dk-arm dk-arm-${side}${idle}" style="transform-origin:${f(sx)}px ${f(sy - 2)}px">${shape}</g>`;
  }
  function armShape(ind, P, side) {
    const { cx, cy, W, H, skin, dk, s, house } = P, k = ind.armScale * s * (0.75 + P.stage * 0.12);
    const near = side === 'near', d = near ? -1 : 1;
    // v4.57: el brazo de detrás sale del borde del cuerpo y la mano asoma (en cuerpos grandes quedaba tapado)
    const edge = Pm2(P.kind).pear ? 1 + Pm2(P.kind).pear * 0.08 : 1;
    const sx = near ? cx - W * 0.9 : cx + W * 0.9 * edge, sy = cy + H * 0.08;
    // v4.62: tipo de brazo del individuo (más cortos, largos, de fideo, pinzas o manoplas)
    const A = ind.arms, reach = A === 'long' ? 1.7 : A === 'stubby' ? 0.55 : 1;
    const hx = sx + d * (near ? 5 : 7) * k * reach, hy = sy + 9 * k * reach;
    if (A === 'none') return ''; // v4.69: sin brazos
    if (A === 'tentacle') { // un tentáculo ondulado con ventosas
      const ex = sx + d * 11 * k, ey = sy + 14 * k;
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} C ${f(sx + d * 9 * k)} ${f(sy - 2 * k)} ${f(sx + d * 1 * k)} ${f(sy + 9 * k)} ${f(ex)} ${f(ey)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.4 * k)}" stroke-linecap="round"/>` +
        [0.35, 0.6, 0.85].map((tt) => `<circle cx="${f(sx + d * (3 + tt * 7) * k)}" cy="${f(sy + (tt * 15 - 2) * k)}" r="${f(1.1 * k)}" fill="${shade(skin, 0.35)}" ${STROKE(dk, 0.6)}/>`).join('');
    }
    if (A === 'leaf') { // brazo-hoja con nervio
      const lx = sx + d * 8 * k, ly = sy + 7 * k;
      return `<path d="M ${f(sx)} ${f(sy - 2 * k)} Q ${f(lx + d * 9 * k)} ${f(ly - 6 * k)} ${f(lx + d * 6 * k)} ${f(ly + 8 * k)} Q ${f(lx - d * 6 * k)} ${f(ly + 4 * k)} ${f(sx)} ${f(sy - 2 * k)} Z" fill="#4ade80" ${STROKE(dk, 1.6)}/><path d="M ${f(sx + d * 1 * k)} ${f(sy - 1 * k)} Q ${f(lx + d * 2 * k)} ${f(ly)} ${f(lx + d * 5 * k)} ${f(ly + 6 * k)}" fill="none" stroke="#166534" stroke-width="${f(1 * k)}"/>`;
    }
    if (A === 'wingarm') { // aletita de plumas
      const w0 = sx + d * 2 * k;
      return [0, 1, 2].map((i) => `<path d="M ${f(w0)} ${f(sy - 3 * k + i * 2 * k)} Q ${f(w0 + d * (12 - i * 2) * k)} ${f(sy + (2 + i * 3) * k)} ${f(w0 + d * (6 - i) * k)} ${f(sy + (9 + i * 3) * k)} Q ${f(w0 + d * 1 * k)} ${f(sy + (5 + i * 2) * k)} ${f(w0)} ${f(sy - 3 * k + i * 2 * k)} Z" fill="${shade(skin, 0.1 + i * 0.12)}" ${STROKE(dk, 1.3)}/>`).join('');
    }
    if (A === 'wave') { // brazo levantado saludando
      const ux = sx + d * 6 * k, uy = sy - 13 * k;
      const pth = `M ${f(sx)} ${f(sy - 2 * k)} Q ${f(sx + d * 8 * k)} ${f(sy - 4 * k)} ${f(ux)} ${f(uy)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/><circle cx="${f(ux)}" cy="${f(uy - 1.5 * k)}" r="${f(4 * k)}" fill="${shade(skin, 0.22)}" ${STROKE(dk, 1.5)}/>` +
        [-1, 0, 1].map((i) => `<path d="M ${f(ux + i * 1.8 * k)} ${f(uy - 4.5 * k)} v ${f(-2.2 * k)}" stroke="${dk}" stroke-width="${f(1.4 * k)}" stroke-linecap="round"/>`).join('');
    }
    if (A === 'talon') { // garras largas
      const tx = sx + d * 6 * k, ty = sy + 9 * k;
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(tx)} ${f(ty - 2 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.2 * k)}" stroke-linecap="round"/>` +
        [-1, 0, 1].map((i) => `<path d="M ${f(tx + i * 2 * k)} ${f(ty - 1 * k)} q ${f(d * 2 * k)} ${f(5 * k)} ${f(d * 5 * k + i * k)} ${f(8 * k)} q ${f(-d * 3 * k)} ${f(-2 * k)} ${f(-d * 4.4 * k)} ${f(-7 * k)} Z" fill="#f5f0e6" ${STROKE(dk, 1)}/>`).join('');
    }
    if (A === 'crystal') { // brazo de cristal facetado
      const cx2 = sx + d * 6 * k, cy2 = sy + 8 * k, col = ({ luz: '#fde68a', oscuridad: '#c4b5fd', fuego: '#fdba74', agua: '#7dd3fc', tierra: '#86efac' })[house] || '#93c5fd';
      return `<path d="M ${f(sx)} ${f(sy - 3 * k)} L ${f(cx2 + d * 4 * k)} ${f(cy2 - 4 * k)} L ${f(cx2 + d * 6 * k)} ${f(cy2 + 4 * k)} L ${f(cx2 - d * 1 * k)} ${f(cy2 + 7 * k)} L ${f(sx - d * 1 * k)} ${f(sy + 3 * k)} Z" fill="${col}" fill-opacity=".85" ${STROKE(dk, 1.5)}/><path d="M ${f(sx)} ${f(sy - 1 * k)} L ${f(cx2 + d * 5 * k)} ${f(cy2)}" stroke="#fff" stroke-width="${f(1 * k)}" opacity=".7"/>`;
    }
    // v5.15: brazos nuevos
    if (A === 'scythe') { // guadaña de mantis
      const ex = sx + d * 5 * k, ey = sy + 6 * k, tx = ex + d * 3 * k, ty = ey - 14 * k;
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} L ${f(ex)} ${f(ey)}`;
      return `<path d="${pth}" stroke="${dk}" stroke-width="${f(6.4 * k)}" stroke-linecap="round"/><path d="${pth}" stroke="${skin}" stroke-width="${f(3.8 * k)}" stroke-linecap="round"/>` +
        `<path d="M ${f(ex - d * 1 * k)} ${f(ey + 1 * k)} Q ${f(ex + d * 9 * k)} ${f(ey - 4 * k)} ${f(tx)} ${f(ty)} Q ${f(ex + d * 3 * k)} ${f(ey - 5 * k)} ${f(ex + d * 1.5 * k)} ${f(ey + 2 * k)} Z" fill="${shade(skin, -0.25)}" ${STROKE(dk, 1.4)}/><path d="M ${f(ex + d * 2 * k)} ${f(ey - 1 * k)} Q ${f(ex + d * 6 * k)} ${f(ey - 5 * k)} ${f(tx)} ${f(ty + 1)}" stroke="#fff" stroke-width=".9" fill="none" opacity=".55"/>`;
    }
    if (A === 'vine') { // enredadera con hojitas
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} C ${f(sx + d * 9 * k)} ${f(sy)} ${f(sx + d * 2 * k)} ${f(sy + 8 * k)} ${f(sx + d * 7 * k)} ${f(sy + 12 * k)} S ${f(sx + d * 12 * k)} ${f(sy + 10 * k)} ${f(sx + d * 10 * k)} ${f(sy + 7 * k)}`;
      return `<path d="${pth}" fill="none" stroke="#1a2e05" stroke-width="${f(4.4 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="#65a30d" stroke-width="${f(2.4 * k)}" stroke-linecap="round"/>` +
        [[3, 3], [5, 10]].map(([ox, oy]) => `<path d="M ${f(sx + d * ox * k)} ${f(sy + oy * k)} q ${f(-d * 5 * k)} ${f(-3 * k)} ${f(-d * 6 * k)} ${f(1 * k)} q ${f(d * 3 * k)} ${f(3 * k)} ${f(d * 6 * k)} ${f(-1 * k)} Z" fill="#84cc16" ${STROKE('#1a2e05', 1)}/>`).join('');
    }
    if (A === 'gauntlet') { // brazo con guantelete de metal
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(8 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(5 * k)}" stroke-linecap="round"/>` +
        `<path d="M ${f(hx - 6 * k)} ${f(hy - 6 * k)} h ${f(12 * k)} l ${f(1 * k)} ${f(8 * k)} q ${f(-7 * k)} ${f(4 * k)} ${f(-14 * k)} 0 Z" fill="#94a3b8" ${STROKE('#0f172a', 1.5)}/><path d="M ${f(hx - 5 * k)} ${f(hy - 3 * k)} h ${f(10 * k)}" stroke="#e2e8f0" stroke-width="1.1" opacity=".8"/><circle cx="${f(hx)}" cy="${f(hy + 1 * k)}" r="${f(1.4 * k)}" fill="#f6c343"/>`;
    }
    if (A === 'fluff') { // manos de algodón
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.4 * k)}" stroke-linecap="round"/>` +
        [[0, 0, 4.4], [-3.4, -2, 3], [3.4, -1.6, 3.2], [0, 3, 3.2]].map(([ox, oy, r]) => `<circle cx="${f(hx + ox * k)}" cy="${f(hy + oy * k)}" r="${f(r * k)}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.1"/>`).join('');
    }
    if (A === 'hook') { // garfio
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>` +
        `<rect x="${f(hx - 3.6 * k)}" y="${f(hy - 3.6 * k)}" width="${f(7.2 * k)}" height="${f(4.4 * k)}" rx="1" fill="#78350f" ${STROKE(dk, 1.2)}/><path d="M ${f(hx)} ${f(hy + 0.8 * k)} v ${f(4 * k)} a ${f(3.4 * k)} ${f(3.4 * k)} 0 1 1 ${f(-d * 6 * k)} ${f(-1.5 * k)}" fill="none" stroke="#1f2937" stroke-width="${f(3.2 * k)}" stroke-linecap="round"/><path d="M ${f(hx)} ${f(hy + 0.8 * k)} v ${f(4 * k)} a ${f(3.4 * k)} ${f(3.4 * k)} 0 1 1 ${f(-d * 6 * k)} ${f(-1.5 * k)}" fill="none" stroke="#cbd5e1" stroke-width="${f(1.6 * k)}" stroke-linecap="round"/>`;
    }
    // v5.18: brazo con escudo redondo y brazo de fuego
    if (A === 'shieldarm') {
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}`, r = 7.5 * k;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>` +
        `<circle cx="${f(hx + d * 1.5 * k)}" cy="${f(hy)}" r="${f(r)}" fill="#a16207" ${STROKE('#1a0f08', 1.6)}/><circle cx="${f(hx + d * 1.5 * k)}" cy="${f(hy)}" r="${f(r * 0.72)}" fill="none" stroke="#fde68a" stroke-width="${f(1.2 * k)}"/><circle cx="${f(hx + d * 1.5 * k)}" cy="${f(hy)}" r="${f(r * 0.25)}" fill="#e5e7eb" ${STROKE('#1a0f08', 0.8)}/>`;
    }
    if (A === 'flamearm') {
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}`;
      return `<path d="${pth}" fill="none" stroke="#7c2d12" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="#f97316" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>` +
        `<path d="M ${f(hx - 4 * k)} ${f(hy + 2 * k)} Q ${f(hx - 5 * k)} ${f(hy - 6 * k)} ${f(hx - 1 * k)} ${f(hy - 10 * k)} Q ${f(hx)} ${f(hy - 5 * k)} ${f(hx + 2 * k)} ${f(hy - 8 * k)} Q ${f(hx + 5 * k)} ${f(hy - 3 * k)} ${f(hx + 4 * k)} ${f(hy + 2 * k)} Q ${f(hx)} ${f(hy + 5 * k)} ${f(hx - 4 * k)} ${f(hy + 2 * k)} Z" fill="#fbbf24" ${STROKE('#7c2d12', 1.2)}/><ellipse cx="${f(hx)}" cy="${f(hy - 1 * k)}" rx="${f(1.8 * k)}" ry="${f(2.6 * k)}" fill="#fff7ed"/>`;
    }
    if (A === 'noodle') {
      const pth = `M ${f(sx)} ${f(sy - 3 * k)} C ${f(sx + d * 10 * k)} ${f(sy - 6 * k)} ${f(sx - d * 2 * k)} ${f(sy + 10 * k)} ${f(sx + d * 8 * k)} ${f(sy + 13 * k)}`;
      return `<path d="${pth}" fill="none" stroke="${dk}" stroke-width="${f(5 * k)}" stroke-linecap="round"/><path d="${pth}" fill="none" stroke="${skin}" stroke-width="${f(2.8 * k)}" stroke-linecap="round"/><circle cx="${f(sx + d * 8 * k)}" cy="${f(sy + 13 * k)}" r="${f(3 * k)}" fill="${shade(skin, 0.2)}" ${STROKE(dk, 1.3)}/>`;
    }
    const arm = `<path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>`;
    const H_ = HOUSES[P.house2 || house]; // v4.71: con doble casa, las manos son de la segunda
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
    // v5.15: cada pata sale del borde de abajo real del cuerpo en su x (sin huecos en cuerpos de escudo, cometa,
    // reloj de arena…), y si en esa x el cuerpo queda muy alto, la pata se acerca al centro hasta tocarlo
    const bot = P.bottom, Yb = (x) => (bot ? Math.min(y0, Math.max(cy, bot(x) - 3.5 * s)) : y0);
    const LX = (x) => { if (!bot) return x; for (let t = 0; t <= 0.61; t += 0.1) { const xx = x + (cx - x) * t; if (bot(xx) >= y0 - H * 0.18) return xx; } return x + (cx - x) * 0.6; };
    const foot = (x, y, rx, ry, c) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${STROKE(dk, 1.8)}/>`;
    const toes = (x, y, r) => [-1, 0, 1].map((i) => `<path d="M ${f(x + i * r * 0.55)} ${f(y + r * 0.2)} v ${f(-r * 0.5)}" stroke="${dk}" stroke-width=".9" opacity=".6"/>`).join('');
    const pillar = (x, w, c) => { const y0 = Yb(x); return `<path d="M ${f(x - w / 2)} ${f(y0 - 4)} C ${f(x - w * 0.62)} ${f((y0 + groundY) / 2)} ${f(x - w * 0.62)} ${f(groundY - 2)} ${f(x - w * 0.3)} ${f(groundY)} L ${f(x + w * 0.3)} ${f(groundY)} C ${f(x + w * 0.62)} ${f(groundY - 2)} ${f(x + w * 0.55)} ${f((y0 + groundY) / 2)} ${f(x + w / 2)} ${f(y0 - 4)} Z" fill="${c}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + w * 0.22)} ${f(y0)} Q ${f(x + w * 0.3)} ${f((y0 + groundY) / 2)} ${f(x + w * 0.2)} ${f(groundY - 3)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="${f(w * 0.25)}" stroke-linecap="round"/>`; };
    switch (kind) {
      case 'stubby': return layer === 'near' ? foot(LX(cx - W * 0.42), groundY - 2.5, 7 * s, 4.6 * s, dark) + foot(LX(cx + W * 0.36), groundY - 2.5, 7 * s, 4.6 * s, dark) : '';
      case 'paws': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.34].map(LX).map((x) => pillar(x, 9 * s, skin) + foot(x - 1.5, groundY - 2.2, 6.5 * s, 4 * s, shade(skin, 0.15)) + toes(x - 1.5, groundY - 2.2, 4 * s)).join('') : '';
      case 'quad': return (layer === 'far' ? [cx - W * 0.2, cx + W * 0.62] : [cx - W * 0.55, cx + W * 0.3]).map((x) => pillar(x, 9 * s, layer === 'far' ? dark : skin) + foot(x - 1, groundY - 2, 6 * s, 3.6 * s, shade(skin, layer === 'far' ? -0.3 : 0.1))).join('');
      case 'pillars': return (layer === 'far' ? [cx - W * 0.15, cx + W * 0.6] : [cx - W * 0.55, cx + W * 0.28]).map((x) => pillar(x, 13 * s, layer === 'far' ? dark : skin) + [-1, 0, 1].map((i) => `<ellipse cx="${f(x + i * 3.6 * s)}" cy="${f(groundY - 1.5)}" rx="${f(1.6 * s)}" ry="${f(1.1 * s)}" fill="#f5f0e6" opacity=".9"/>`).join('')).join('');
      case 'digi': return (layer === 'far' ? [cx + W * 0.5] : [cx - W * 0.42]).map((x) => `<ellipse cx="${f(x)}" cy="${f(Yb(x) - 2)}" rx="${f(8 * s)}" ry="${f(10 * s)}" fill="${layer === 'far' ? dark : skin}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + 2 * s)} ${f(Yb(x) + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(6 * s)}" stroke-linecap="round"/><path d="M ${f(x + 2 * s)} ${f(Yb(x) + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${layer === 'far' ? dark : skin}" stroke-width="${f(3.6 * s)}" stroke-linecap="round"/>` + foot(x - 2, groundY - 2.4, 8 * s, 3.4 * s, shade(skin, -0.25)) + toes(x - 4, groundY - 2.4, 4 * s)).join('');
      case 'tall': return layer === 'near' ? [cx - W * 0.25, cx + W * 0.22].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} L ${f(x)} ${f(groundY - 2)} M ${f(x)} ${f(groundY - 2)} l ${f(-5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(4.5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(-0.5)} ${f(2.4)}" fill="none" stroke="#c2410c" stroke-width="${f(2.6 * s)}" stroke-linecap="round"/>`).join('') : '';
      case 'peg': return layer === 'near' ? [cx - W * 0.3, cx + W * 0.25].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(4.2 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 3)}" stroke="${shade(skin, -0.1)}" stroke-width="${f(2.2 * s)}" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(groundY - 2.5)}" r="${f(3.4 * s)}" fill="${dark}" ${STROKE(dk, 1.4)}/>`).join('') : '';
      case 'stilts': return layer === 'near' ? [cx - W * 0.25, cx + W * 0.2].map((x, i) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} L ${f(x + (i ? 2 : -2))} ${f(groundY - 2)}" stroke="${dk}" stroke-width="${f(3.6 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 3)} L ${f(x + (i ? 2 : -2))} ${f(groundY - 2)}" stroke="${skin}" stroke-width="${f(1.8 * s)}" stroke-linecap="round"/>` + foot(x + (i ? 2 : -2), groundY - 1.8, 4.6 * s, 2.2 * s, dark)).join('') : '';
      case 'webbed': return layer === 'near' ? [cx - W * 0.4, cx + W * 0.32].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 2)} V ${f(groundY - 3)}" stroke="#ea580c" stroke-width="${f(3 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(groundY - 3)} l ${f(-6 * s)} ${f(3)} l ${f(4 * s)} 0 l ${f(2 * s)} -1 l ${f(2 * s)} 1 l ${f(4 * s)} 0 Z" fill="#fb923c" ${STROKE('#9a3412', 1.2)}/>`).join('') : '';
      case 'spring': return layer === 'near' ? [cx - W * 0.28, cx + W * 0.22].map(LX).map((x) => { let d = `M ${f(x)} ${f(Yb(x) - 3)}`; const n = 5, hgt = groundY - 4 - (Yb(x) - 3); for (let i = 1; i <= n; i++) d += ` L ${f(x + (i % 2 ? 4 : -4) * s)} ${f(Yb(x) - 3 + (hgt * i) / n)}`; return `<path d="${d}" fill="none" stroke="#a8a29e" stroke-width="${f(2 * s)}" stroke-linejoin="round"/>` + foot(x, groundY - 2.4, 6 * s, 3 * s, dark); }).join('') : '';
      case 'bigfoot': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.34].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 5)}" stroke="${dk}" stroke-width="${f(7 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 5)}" stroke="${skin}" stroke-width="${f(4.6 * s)}" stroke-linecap="round"/>` + foot(x - 2, groundY - 3, 10 * s, 4.4 * s, shade(skin, 0.12)) + [-1, 0, 1].map((i) => `<circle cx="${f(x - 2 - 7 * s + i * 2.4 * s)}" cy="${f(groundY - 4.5)}" r="${f(1.3 * s)}" fill="#f5f0e6" ${STROKE(dk, 0.7)}/>`).join('')).join('') : '';
      case 'wheels': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.36].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 6 * s)}" stroke="${dk}" stroke-width="${f(3.4 * s)}"/><circle cx="${f(x)}" cy="${f(groundY - 5.5 * s)}" r="${f(5.5 * s)}" fill="#3f3f46" ${STROKE(dk, 1.4)}/><circle cx="${f(x)}" cy="${f(groundY - 5.5 * s)}" r="${f(2.2 * s)}" fill="#d6d3d1" ${STROKE(dk, 0.8)}/>`).join('') : '';
      case 'crab': return (layer === 'far' ? [0.15, 0.5] : [-0.6, -0.3, 0.25]).map((o) => { const x = LX(cx + W * o), d = o < 0 ? -1 : 1; return `<path d="M ${f(x)} ${f(Yb(x) - 4)} Q ${f(x + d * 8 * s)} ${f(Yb(x) - 8 * s)} ${f(x + d * 10 * s)} ${f(groundY - 1)}" fill="none" stroke="${dk}" stroke-width="${f(4.4 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 4)} Q ${f(x + d * 8 * s)} ${f(Yb(x) - 8 * s)} ${f(x + d * 10 * s)} ${f(groundY - 1)}" fill="none" stroke="${layer === 'far' ? dark : shade(skin, -0.08)}" stroke-width="${f(2.4 * s)}" stroke-linecap="round"/>`; }).join('');
      case 'boots': return layer === 'near' ? [cx - W * 0.38, cx + W * 0.3].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 6)}" stroke="${dk}" stroke-width="${f(6 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 3)} V ${f(groundY - 6)}" stroke="${skin}" stroke-width="${f(3.8 * s)}" stroke-linecap="round"/><path d="M ${f(x - 4 * s)} ${f(groundY - 9 * s)} h ${f(7 * s)} v ${f(5 * s)} q ${f(4 * s)} 0 ${f(4.5 * s)} ${f(3.5 * s)} v ${f(0.8 * s)} h ${f(-11.5 * s)} Z" fill="#7c2d12" ${STROKE(dk, 1.3)}/><path d="M ${f(x - 4 * s)} ${f(groundY - 8 * s)} h ${f(7 * s)}" stroke="#fbbf24" stroke-width="1"/>`).join('') : '';
      case 'paddles': return layer === 'near' ? [[cx - W * 0.55, -1], [cx + W * 0.45, 1]].map(([x, d]) => `<path d="M ${f(x)} ${f(groundY - 6)} q ${f(d * 10 * s)} ${f(-1)} ${f(d * 12 * s)} ${f(5)} q ${f(-d * 6 * s)} ${f(2)} ${f(-d * 12 * s)} ${f(1)} Z" fill="${shade(skin, -0.15)}" ${STROKE(dk, 1.4)}/>`).join('') : '';
      case 'insect': return (layer === 'far' ? [0.05, 0.4] : [-0.5, -0.15, 0.3]).map((o) => { const x = LX(cx + W * o), d = o < 0 ? -1 : 1, kx = x + d * 6 * s, ky = Yb(x) - 6 * s; return `<path d="M ${f(x)} ${f(Yb(x) - 4)} L ${f(kx)} ${f(ky)} L ${f(kx + d * 2 * s)} ${f(groundY - 1)}" fill="none" stroke="${layer === 'far' ? shade(dk, 0.2) : dk}" stroke-width="${f(1.8 * s)}" stroke-linejoin="round" stroke-linecap="round"/>`; }).join('');
      case 'hooves': return (layer === 'far' ? [cx - W * 0.18, cx + W * 0.6] : [cx - W * 0.52, cx + W * 0.28]).map((x) => pillar(x, 8 * s, layer === 'far' ? dark : skin) + `<path d="M ${f(x - 4.6 * s)} ${f(groundY - 4 * s)} h ${f(9.2 * s)} l ${f(0.6 * s)} ${f(4 * s)} h ${f(-10.4 * s)} Z" fill="#3f3f46" ${STROKE(dk, 1.4)}/><path d="M ${f(x)} ${f(groundY - 3.6 * s)} v ${f(3.4 * s)}" stroke="#18181b" stroke-width="1"/>`).join('');
      case 'frog': return layer === 'near' ? [[cx - W * 0.5, -1], [cx + W * 0.4, 1]].map(([x, d]) => `<path d="M ${f(x)} ${f(Yb(x) - 2)} Q ${f(x + d * 5 * s)} ${f(groundY - 6)} ${f(x + d * 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${dk}" stroke-width="${f(6.5 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 2)} Q ${f(x + d * 5 * s)} ${f(groundY - 6)} ${f(x + d * 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${skin}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` + [-1, 0, 1].map((i) => `<circle cx="${f(x + d * 2 * s + i * 3.6 * s)}" cy="${f(groundY - 1.6)}" r="${f(2.4 * s)}" fill="${shade(skin, 0.15)}" ${STROKE(dk, 1.2)}/>`).join('')).join('') : '';
      case 'talons': return layer === 'near' ? [cx - W * 0.3, cx + W * 0.25].map(LX).map((x) => `<path d="M ${f(x)} ${f(Yb(x) - 3)} L ${f(x - 1)} ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(6.4 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 3)} L ${f(x - 1)} ${f(groundY - 3)}" stroke="${shade(skin, -0.15)}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` + [-1, 0, 1].map((i) => `<path d="M ${f(x - 1)} ${f(groundY - 3)} q ${f(i * 3 * s)} ${f(1)} ${f(i * 4.5 * s - 0.5)} ${f(3)}" fill="none" stroke="#1c1917" stroke-width="${f(1.8 * s)}" stroke-linecap="round"/>`).join('')).join('') : '';
      case 'roots': return layer === 'near' ? [-0.55, -0.2, 0.15, 0.5].map((o, i) => { const x = LX(cx + W * o), d = o < 0 ? -1 : 1; return `<path d="M ${f(x)} ${f(Yb(x) - 6)} Q ${f(x + d * 2)} ${f(groundY - 4)} ${f(x + d * (5 + i % 2 * 3) * s)} ${f(groundY)}" fill="none" stroke="#3b2414" stroke-width="${f(4.2 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(Yb(x) - 6)} Q ${f(x + d * 2)} ${f(groundY - 4)} ${f(x + d * (5 + i % 2 * 3) * s)} ${f(groundY)}" fill="none" stroke="#8b5a2b" stroke-width="${f(2.4 * s)}" stroke-linecap="round"/>`; }).join('') : '';
      case 'puffs': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.3].map(LX).map((x) => [[-3.5, 0, 3.6], [0, -2.5, 4.4], [3.8, 0, 3.4]].map(([ox, oy, r]) => `<circle cx="${f(x + ox * s)}" cy="${f(groundY - 6 + oy * s)}" r="${f(r * s)}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.1"/>`).join('')).join('') : '';
      case 'raptor': return (layer === 'far' ? [cx + W * 0.5] : [cx + W * 0.04]).map((x) => { const c = layer === 'far' ? dark : skin, d = layer === 'far' ? shade(dk, 0.15) : dk;
        // v4.96b: el muslo de delante va más atrás y nunca sube por encima de la boca (antes la tapaba)
        const ry = 10 * s, ty = layer === 'far' ? y0 - 3 * s : Math.max(y0 - 2 * s, P.my + P.er * 1.3 + ry);
        return `<ellipse cx="${f(x + 2 * s)}" cy="${f(ty)}" rx="${f(8.5 * s)}" ry="${f(ry)}" fill="${c}" ${STROKE(d, 1.8)}/><path d="M ${f(x + 5 * s)} ${f(y0 + 5 * s)} L ${f(x + 9 * s)} ${f(groundY - 9 * s)} L ${f(x + 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${d}" stroke-width="${f(6.4 * s)}" stroke-linecap="round" stroke-linejoin="round"/><path d="M ${f(x + 5 * s)} ${f(y0 + 5 * s)} L ${f(x + 9 * s)} ${f(groundY - 9 * s)} L ${f(x + 2 * s)} ${f(groundY - 2.5)}" fill="none" stroke="${c}" stroke-width="${f(3.8 * s)}" stroke-linecap="round" stroke-linejoin="round"/>` +
          [-1, 0, 1].map((i) => `<path d="M ${f(x + 2 * s)} ${f(groundY - 2.5)} q ${f(-4 * s + i * 3 * s)} ${f(0.5)} ${f(-6 * s + i * 4.5 * s)} ${f(2.4)}" fill="none" stroke="#f5f0e6" stroke-width="${f(1.7 * s)}" stroke-linecap="round"/>`).join(''); }).join('');
      case 'slime': return layer === 'near' ? `<path d="M ${f(cx - W * 0.95)} ${f(groundY)} Q ${f(cx - W * 0.9)} ${f(y0 - 4)} ${f(cx - W * 0.4)} ${f(y0 - 2)} L ${f(cx + W * 0.5)} ${f(y0 - 2)} Q ${f(cx + W * 1)} ${f(y0 - 4)} ${f(cx + W * 1.05)} ${f(groundY)} Q ${f(cx + W * 0.6)} ${f(groundY + 2)} ${f(cx + W * 0.3)} ${f(groundY - 1)} Q ${f(cx)} ${f(groundY + 2.5)} ${f(cx - W * 0.35)} ${f(groundY - 0.5)} Q ${f(cx - W * 0.7)} ${f(groundY + 2)} ${f(cx - W * 0.95)} ${f(groundY)} Z" fill="${shade(skin, 0.12)}" fill-opacity=".92" ${STROKE(dk, 1.6)}/><ellipse cx="${f(cx - W * 0.5)}" cy="${f(groundY - 3)}" rx="${f(W * 0.18)}" ry="${f(1.6 * s)}" fill="#fff" opacity=".45"/>` : '';
      // v5.18: patas de pistón (mecánicas) y patas de cristal
      case 'pistons': return (layer === 'far' ? [cx + W * 0.42] : [cx - W * 0.4, cx + W * 0.22]).map(LX).map((x) => { const y0b = Yb(x), mid = (y0b + groundY) / 2, c = layer === 'far' ? '#57534e' : '#78716c';
        return `<rect x="${f(x - 4 * s)}" y="${f(y0b - 3)}" width="${f(8 * s)}" height="${f(mid - y0b + 3)}" rx="${f(2 * s)}" fill="${c}" ${STROKE('#1c1917', 1.4)}/><rect x="${f(x - 2.4 * s)}" y="${f(mid)}" width="${f(4.8 * s)}" height="${f(groundY - mid - 4 * s)}" fill="#d6d3d1" ${STROKE('#1c1917', 1.2)}/>` +
          `<circle cx="${f(x)}" cy="${f(mid)}" r="${f(2.6 * s)}" fill="#f59e0b" ${STROKE('#1c1917', 1)}/><path d="M ${f(x - 7 * s)} ${f(groundY - 1)} L ${f(x - 5 * s)} ${f(groundY - 5 * s)} L ${f(x + 5 * s)} ${f(groundY - 5 * s)} L ${f(x + 7 * s)} ${f(groundY - 1)} Z" fill="${c}" ${STROKE('#1c1917', 1.4)}/>`; }).join('');
      case 'crystallegs': return layer === 'near' ? [cx - W * 0.42, cx - W * 0.1, cx + W * 0.28].map(LX).map((x, i) => { const y0b = Yb(x), c = ({ luz: '#fde68a', oscuridad: '#c4b5fd', fuego: '#fdba74', agua: '#7dd3fc', tierra: '#86efac' })[P.house] || '#a5f3fc', d2 = (i - 1) * 2 * s;
        return `<path d="M ${f(x - 4 * s)} ${f(y0b - 2)} L ${f(x + 4 * s)} ${f(y0b - 2)} L ${f(x + 2 * s + d2)} ${f(groundY - 4 * s)} L ${f(x + d2)} ${f(groundY)} L ${f(x - 2 * s + d2)} ${f(groundY - 4 * s)} Z" fill="${c}" fill-opacity=".9" ${STROKE(shade(c, -0.6), 1.3)}/><path d="M ${f(x - 1 * s)} ${f(y0b)} L ${f(x + d2 - 0.5 * s)} ${f(groundY - 3 * s)}" stroke="#fff" stroke-width="1" opacity=".7"/>`; }).join('') : '';
      case 'tentacles': return layer === 'near' ? [-0.55, -0.15, 0.25, 0.6].map((o, i) => { const x = LX(cx + W * o); return `<path d="M ${f(x - 3)} ${f(Yb(x) - 6)} Q ${f(x - 6 + (i % 2) * 9)} ${f(groundY - 6)} ${f(x + (i % 2 ? 4 : -5))} ${f(groundY - 1)} Q ${f(x + (i % 2 ? 1 : -1))} ${f(groundY - 6)} ${f(x + 4)} ${f(Yb(x) - 6)} Z" fill="${i % 2 ? dark : skin}" ${STROKE(dk, 1.6)}/>`; }).join('') : '';
      default: return '';
    }
  }
  const LIFT = { pistons: 12, crystallegs: 10, raptor: 13, slime: 3, none: 0, stubby: 0, paws: 4, quad: 9, pillars: 8, digi: 9, tall: 13, tentacles: 7, hover: 9, hooves: 9, frog: 3, talons: 11, roots: 6, puffs: 9, peg: 9, stilts: 16, webbed: 7, spring: 10, bigfoot: 7, wheels: 9, crab: 9, boots: 6, paddles: 2, insect: 12 };

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
      // v5.15: dibujos nuevos
      case 'dapple': return [[0.1, -0.6, 2.6], [0.4, -0.45, 3.4], [0.66, -0.2, 2.4], [0.22, -0.15, 2], [0.5, 0.1, 2.8], [0.78, 0.2, 1.8], [0.3, 0.32, 2.2]].map(([ox, oy, r]) => `<circle cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" r="${f(r)}" fill="${shade(P.skin, 0.4)}" opacity=".75"/>`).join('');
      case 'saddlemark': return `<path d="M ${f(cx - W * 0.05)} ${f(cy - H * 1.1)} Q ${f(cx + W * 0.1)} ${f(cy - H * 0.2)} ${f(cx + W * 0.2)} ${f(cy + H * 0.1)} Q ${f(cx + W * 0.6)} ${f(cy + H * 0.15)} ${f(cx + W * 0.9)} ${f(cy - H * 0.1)} L ${f(cx + W * 1.2)} ${f(cy - H * 1.2)} Z" fill="${shade(P.skin, -0.3)}" opacity=".6"/>`;
      case 'mask': return `<path d="M ${f(P.fx - P.er * 4)} ${f(P.ey - P.er * 1.2)} Q ${f(P.fx)} ${f(P.ey - P.er * 2)} ${f(P.fx + P.er * 4.2)} ${f(P.ey - P.er * 1.2)} L ${f(P.fx + P.er * 4.2)} ${f(P.ey + P.er * 1.1)} Q ${f(P.fx)} ${f(P.ey + P.er * 2.1)} ${f(P.fx - P.er * 4)} ${f(P.ey + P.er * 1.1)} Z" fill="${shade(P.skin, -0.45)}" opacity=".75"/>`;
      case 'tribal': return `<path d="M ${f(cx + W * 0.15)} ${f(cy - H * 0.65)} q ${f(W * 0.2)} ${f(H * 0.1)} ${f(W * 0.12)} ${f(H * 0.35)} q ${f(-W * 0.06)} ${f(H * 0.2)} ${f(W * 0.18)} ${f(H * 0.32)} M ${f(cx + W * 0.4)} ${f(cy - H * 0.7)} q ${f(W * 0.16)} ${f(H * 0.15)} ${f(W * 0.08)} ${f(H * 0.4)} M ${f(cx + W * 0.62)} ${f(cy - H * 0.5)} l ${f(W * 0.1)} ${f(H * 0.12)} l ${f(-W * 0.08)} ${f(H * 0.12)}" fill="none" stroke="${inner}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
      case 'socks': return `<path d="M ${f(cx - W * 1.2)} ${f(cy + H * 0.62)} Q ${f(cx)} ${f(cy + H * 0.5)} ${f(cx + W * 1.2)} ${f(cy + H * 0.62)} L ${f(cx + W * 1.2)} ${f(cy + H * 1.3)} L ${f(cx - W * 1.2)} ${f(cy + H * 1.3)} Z" fill="${shade(P.skin, 0.45)}" opacity=".85"/>`;
      case 'gem': return `<path d="M ${f(x)} ${f(y - 6)} L ${f(x + 5)} ${f(y)} L ${f(x)} ${f(y + 6)} L ${f(x - 5)} ${f(y)} Z" fill="#22d3ee" ${STROKE(dk, 1.3)}/><path d="M ${f(x - 2)} ${f(y - 2)} L ${f(x)} ${f(y - 4)}" stroke="#fff" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  function finalSvg(ind, P, layer) {
    const { cx, cy, W, H, dk, skin, top } = P;
    const hx = cx - W * 0.15, hy = top(hx);
    // v5.19: los sombreros y demás se adaptan al tamaño de la cabeza (antes medían siempre lo mismo y en cuerpos
    // grandes quedaban diminutos o, en los estrechos, flotando a los lados)
    const z = clamp(W / 21, 0.72, 1.55);
    const sc = (svg, ax, ay) => (z === 1 ? svg : `<g transform="translate(${f(ax)} ${f(ay)}) scale(${f(z)}) translate(${f(-ax)} ${f(-ay)})">${svg}</g>`);
    /** Bordes izquierdo y derecho del cuerpo a una altura (para los auriculares). */
    const edges = (y) => { const pts = P.pts; if (!pts) return [cx - W * 0.95, cx + W * 0.95]; let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); lo = Math.min(lo, x); hi = Math.max(hi, x); } }
      return lo === Infinity ? [cx - W * 0.95, cx + W * 0.95] : [lo, hi]; };
    const scaled = ['crown', 'halo', 'tophat', 'wizard', 'beanie', 'goggles', 'cap', 'pirate', 'propeller'];
    if (scaled.includes(ind.final)) { const raw = finalRaw(ind, P, layer, hx, hy, edges); return raw ? sc(raw, hx, ind.final === 'halo' ? hy - 12 : top(hx) + 3) : ''; }
    return finalRaw(ind, P, layer, hx, hy, edges);
  }
  function finalRaw(ind, P, layer, hx, hy, edges) {
    const { cx, cy, W, H, dk, skin, top } = P;
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
      case 'tophat': { if (layer !== 'front') return ''; const y = top(hx) + 3; return `<ellipse cx="${f(hx)}" cy="${f(y)}" rx="13" ry="3.2" fill="#18181b" ${STROKE(dk, 1.3)}/><path d="M ${f(hx - 8)} ${f(y - 1)} L ${f(hx - 7.5)} ${f(y - 17)} Q ${f(hx)} ${f(y - 19)} ${f(hx + 7.5)} ${f(y - 17)} L ${f(hx + 8)} ${f(y - 1)} Z" fill="#27272a" ${STROKE(dk, 1.3)}/><path d="M ${f(hx - 8)} ${f(y - 5)} H ${f(hx + 8)} V ${f(y - 2)} H ${f(hx - 8)} Z" fill="#b91c1c"/>`; }
      case 'wizard': { if (layer !== 'front') return ''; const y = top(hx) + 3, c = hue(skin, 200); return `<path d="M ${f(hx - 12)} ${f(y)} Q ${f(hx - 2)} ${f(y - 8)} ${f(hx + 2)} ${f(y - 24)} Q ${f(hx + 7)} ${f(y - 26)} ${f(hx + 9)} ${f(y - 20)} Q ${f(hx + 4)} ${f(y - 14)} ${f(hx + 12)} ${f(y)} Z" fill="${c}" ${STROKE(dk, 1.3)}/><ellipse cx="${f(hx)}" cy="${f(y)}" rx="13" ry="3" fill="${shade(c, -0.25)}" ${STROKE(dk, 1.2)}/>` + star(hx - 2, y - 9, 2.4, 1, '#fde047') + star(hx + 3, y - 15, 1.6, 0.7, '#fde047'); }
      case 'headphones': { // v5.19: la diadema va de lado a lado del cuerpo y los cascos se apoyan en sus bordes
        if (layer !== 'front') return '';
        const yc = Math.min(P.ey, top(hx) + H * 0.45), [l, r] = edges(yc), cxp = (l + r) / 2, top0 = top(cxp) - 3, rr = Math.max(3.5, Math.min(6, W * 0.2));
        const band = `M ${f(l + 1)} ${f(yc - 2)} Q ${f(l - 1)} ${f(top0 - 4)} ${f(cxp)} ${f(top0 - 6)} Q ${f(r + 1)} ${f(top0 - 4)} ${f(r - 1)} ${f(yc - 2)}`;
        return `<path d="${band}" fill="none" stroke="#27272a" stroke-width="3.2"/><path d="${band}" fill="none" stroke="#f43f5e" stroke-width="1.4"/>` +
          [l, r].map((x) => `<rect x="${f(x - rr * 0.75)}" y="${f(yc - rr)}" width="${f(rr * 1.5)}" height="${f(rr * 2.1)}" rx="${f(rr * 0.6)}" fill="#f43f5e" ${STROKE(dk, 1.3)}/><rect x="${f(x - rr * 0.35)}" y="${f(yc - rr * 0.55)}" width="${f(rr * 0.7)}" height="${f(rr * 1.2)}" rx="${f(rr * 0.3)}" fill="#27272a"/>`).join(''); }
      case 'bowtie': { if (layer !== 'front') return ''; const y = cy - H * 0.02 + 3, x = cx - W * 0.1, c = hue(skin, 150); return `<path d="M ${f(x)} ${f(y)} L ${f(x - 8)} ${f(y - 5)} L ${f(x - 8)} ${f(y + 5)} Z M ${f(x)} ${f(y)} L ${f(x + 8)} ${f(y - 5)} L ${f(x + 8)} ${f(y + 5)} Z" fill="${c}" ${STROKE(dk, 1.3)}/><circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="${shade(c, -0.25)}" ${STROKE(dk, 1)}/>`; }
      case 'beanie': { if (layer !== 'front') return ''; const y = top(hx) + 6, c = hue(skin, 120); return `<path d="M ${f(hx - 13)} ${f(y)} Q ${f(hx - 13)} ${f(y - 15)} ${f(hx)} ${f(y - 15)} Q ${f(hx + 13)} ${f(y - 15)} ${f(hx + 13)} ${f(y)} Z" fill="${c}" ${STROKE(dk, 1.3)}/><rect x="${f(hx - 14)}" y="${f(y - 3)}" width="28" height="5" rx="2" fill="${shade(c, -0.2)}" ${STROKE(dk, 1.2)}/><circle cx="${f(hx)}" cy="${f(y - 16)}" r="3.6" fill="#f5f0e6" ${STROKE(dk, 1.1)}/>`; }
      case 'goggles': { if (layer !== 'front') return ''; const y = top(hx) + 4; return `<path d="M ${f(cx - W * 0.95)} ${f(y + 2)} Q ${f(hx)} ${f(y - 3)} ${f(cx + W * 0.75)} ${f(y + 2)}" fill="none" stroke="#3f2a1d" stroke-width="2.6"/>` + [hx - 6, hx + 6].map((x) => `<circle cx="${f(x)}" cy="${f(y)}" r="4.6" fill="#7dd3fc" stroke="#78716c" stroke-width="2"/><circle cx="${f(x - 1.4)}" cy="${f(y - 1.4)}" r="1.2" fill="#fff"/>`).join(''); }
      case 'collar': { if (layer !== 'front') return ''; const y = cy - H * 0.02; return `<path d="M ${f(cx - W * 0.9)} ${f(y - 2)} Q ${f(cx)} ${f(y + 6)} ${f(cx + W * 0.88)} ${f(y - 3)} L ${f(cx + W * 0.88)} ${f(y + 2)} Q ${f(cx)} ${f(y + 11)} ${f(cx - W * 0.9)} ${f(y + 3)} Z" fill="#292524" ${STROKE(dk, 1.3)}/>` + [-0.6, -0.2, 0.2, 0.6].map((o) => { const x = cx + W * o, yy = y + 5 + (1 - Math.abs(o)) * 2.4; return `<path d="M ${f(x - 2)} ${f(yy)} l 2 4 l 2 -4 Z" fill="#d6d3d1" ${STROKE(dk, 0.6)}/>`; }).join(''); }
      // v5.19: accesorios nuevos
      case 'cap': { if (layer !== 'front') return ''; const y = top(hx) + 4, c = hue(skin, 140); return `<path d="M ${f(hx - 12)} ${f(y)} Q ${f(hx - 12)} ${f(y - 13)} ${f(hx)} ${f(y - 13)} Q ${f(hx + 12)} ${f(y - 13)} ${f(hx + 12)} ${f(y)} Z" fill="${c}" ${STROKE(dk, 1.3)}/><path d="M ${f(hx - 12)} ${f(y)} Q ${f(hx - 20)} ${f(y + 1)} ${f(hx - 22)} ${f(y + 3)} Q ${f(hx - 14)} ${f(y + 4)} ${f(hx - 6)} ${f(y + 1)} Z" fill="${shade(c, -0.25)}" ${STROKE(dk, 1.2)}/><circle cx="${f(hx)}" cy="${f(y - 13)}" r="1.6" fill="${shade(c, -0.3)}"/><path d="M ${f(hx - 1)} ${f(y - 9)} q 3 -1 4 2" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8"/>`; }
      case 'pirate': { if (layer !== 'front') return ''; const y = top(hx) + 4; return `<path d="M ${f(hx - 16)} ${f(y)} Q ${f(hx - 12)} ${f(y - 9)} ${f(hx - 6)} ${f(y - 8)} Q ${f(hx)} ${f(y - 16)} ${f(hx + 6)} ${f(y - 8)} Q ${f(hx + 12)} ${f(y - 9)} ${f(hx + 16)} ${f(y)} Q ${f(hx)} ${f(y - 4)} ${f(hx - 16)} ${f(y)} Z" fill="#1c1917" ${STROKE(dk, 1.3)}/><path d="M ${f(hx - 14)} ${f(y - 1.5)} Q ${f(hx)} ${f(y - 5)} ${f(hx + 14)} ${f(y - 1.5)}" fill="none" stroke="#facc15" stroke-width="1.2"/><circle cx="${f(hx)}" cy="${f(y - 8.5)}" r="2.2" fill="#f5f0e6"/><path d="M ${f(hx - 2)} ${f(y - 5.5)} l 4 0" stroke="#f5f0e6" stroke-width="1.2"/>`; }
      case 'propeller': { if (layer !== 'front') return ''; const y = top(hx) + 5, c1 = hue(skin, 60), c2 = hue(skin, 240); return `<path d="M ${f(hx - 11)} ${f(y)} Q ${f(hx - 11)} ${f(y - 11)} ${f(hx)} ${f(y - 11)} Q ${f(hx + 11)} ${f(y - 11)} ${f(hx + 11)} ${f(y)} Z" fill="${c1}" ${STROKE(dk, 1.3)}/><path d="M ${f(hx)} ${f(y - 11)} Q ${f(hx + 6)} ${f(y - 6)} ${f(hx + 11)} ${f(y)} L ${f(hx)} ${f(y)} Z" fill="${c2}"/><path d="M ${f(hx)} ${f(y - 11)} v -4" stroke="${dk}" stroke-width="1.3"/>` +
        `<g transform="translate(${f(hx)} 0)"><g><path d="M -9 ${f(y - 16)} Q 0 ${f(y - 19)} 9 ${f(y - 16)} Q 0 ${f(y - 14)} -9 ${f(y - 16)} Z" fill="#ef4444" ${STROKE(dk, 1)}/><animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" dur="0.6s" repeatCount="indefinite"/></g></g>`; }
      case 'necklace': { if (layer !== 'front') return ''; const y = Math.min(Math.max(cy - H * 0.04, P.my + 5), cy + H * 0.12); /* debajo de la boca */ return [-0.7, -0.45, -0.2, 0.05, 0.3, 0.55].map((o, i) => { const x = cx + W * o, yy = y + Math.cos(o * 1.4) * 5; return `<circle cx="${f(x)}" cy="${f(yy)}" r="${i === 3 ? 3 : 1.9}" fill="${i === 3 ? '#38bdf8' : '#f8fafc'}" ${STROKE(dk, 0.8)}/>`; }).join(''); }
      case 'backpack': { if (layer !== 'back') return ''; const y = cy - H * 0.35, x = edges(y + H * 0.3)[1] - W * 0.3, /* asoma por la espalda */ c = '#b45309'; return `<rect x="${f(x)}" y="${f(y)}" width="${f(W * 0.62)}" height="${f(H * 0.85)}" rx="${f(W * 0.15)}" fill="${c}" ${STROKE(dk, 1.5)}/><rect x="${f(x + W * 0.08)}" y="${f(y + H * 0.42)}" width="${f(W * 0.46)}" height="${f(H * 0.28)}" rx="2" fill="${shade(c, -0.2)}" ${STROKE(dk, 1)}/><path d="M ${f(x + W * 0.06)} ${f(y + 4)} h ${f(W * 0.5)}" stroke="#fde68a" stroke-width="1.4"/>`; }
      case 'glasses': { if (layer !== 'front') return ''; const r = P.er * 1.55, e1 = [P.fx - P.er * 1.25, P.ey + 0.5], e2 = [P.fx + P.er * 1.25, P.ey - 0.8]; return [e1, e2].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#bae6fd" fill-opacity=".18" stroke="#3f2a1d" stroke-width="1.6"/>`).join('') + `<path d="M ${f(e1[0] + r)} ${f(e1[1] - 0.5)} Q ${f((e1[0] + e2[0]) / 2)} ${f(e1[1] - r * 0.6)} ${f(e2[0] - r)} ${f(e2[1] - 0.5)}" fill="none" stroke="#3f2a1d" stroke-width="1.4"/>`; }
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

  /* ---------- v5.12b: «regalía» de las formas avanzadas ----------
   * Cada individuo tira (con su semilla) un juego de piezas, sesgado por su casa:
   *   back    → lomo (rango 3 y 4): púas, placas, cristales, vela, vértebras, llamas, hojas, púas finas
   *   head3   → cabeza en la 3.ª forma: cuernitos, cuerno único, antenas, cresta, gema, cuernos de carnero
   *   head4   → cabeza en la 4.ª (suele ser la evolución de head3): cuernos de dragón, de demonio, halo,
   *             corona de llamas, astas, cuerno único grande, corona de cuernos, tercer ojo, carnero grande
   *   wings   → 4.ª forma: ángel, dragón, demonio, mariposa, cristal, fuego, hueso, cuervo, espectrales o ninguna
   *   extra   → 4.ª forma: orbes, círculo rúnico, capa, humo, hombrera, brasas
   *   pattern → dibujo en la piel: runas, rayas, escamas o grietas brillantes (o nada)
   *   glow    → color de los brillos (según la casa)
   */
  const GLOW = { luz: ['#fde68a', '#f9a8d4', '#fef9c3'], fuego: ['#fb923c', '#f43f5e', '#fbbf24'], agua: ['#67e8f9', '#a5b4fc', '#5eead4'], tierra: ['#86efac', '#facc15', '#bef264'], oscuridad: ['#c084fc', '#ef4444', '#a78bfa'] };
  const CAPE = { luz: '#f1f5f9', fuego: '#7f1d1d', agua: '#1e3a8a', tierra: '#365314', oscuridad: '#2e1065' };
  const REG = {
    back: { spikes: 1.2, plates: 1, crystals: 1, sail: 1, bones: .8, flames: .8, leaves: .8, quills: .9 },
    head3: { horns: 1.2, unihorn: .6, antennae: 1, crest: 1, gem: 1, curls: .9 },
    head4: { bighorns: 1.1, demonhorns: 1, halo: 1, flamecrown: 1, antlers: 1, unihorn: .55, hornCrown: 1, thirdEye: 1, curls: .8 },
    wings: { angel: 1, dragon: 1.2, demon: 1, butterfly: .9, crystal: .9, flame: .9, bone: .8, raven: .9, ethereal: .8, dragonfly: .8, leaf: .7, finwing: .7, phoenix: .8, cosmic: .8, shadow: .7, mecha: .6, storm: .7, none: .6 },
    extra: { orbs: 1, runeCircle: 1, cape: 1, wisps: .9, pauldron: .9, embers: 1 },
    pattern: { none: 2.2, runes: 1, stripes: 1, scales: 1, cracks: 1 },
  };
  const REG_BIAS = {
    luz: { back: { crystals: 2, quills: 1.5, flames: .4 }, head3: { gem: 2, antennae: 1.6, crest: 1.5 }, head4: { halo: 3, unihorn: 2, thirdEye: 1.4, demonhorns: .15 }, wings: { angel: 3.2, butterfly: 2, ethereal: 1.6, crystal: 1.3, phoenix: 1.4, dragonfly: 1.4, demon: .15, bone: .2, raven: .3, shadow: .2 , storm: 1.6, mecha: .8 }, extra: { orbs: 2, runeCircle: 1.5, wisps: .4 }, pattern: { runes: 2, cracks: .5 } },
    fuego: { back: { flames: 3, spikes: 1.6, plates: 1.3, leaves: .3 }, head3: { horns: 2, crest: 1.6 }, head4: { flamecrown: 3, bighorns: 2, demonhorns: 1.3, halo: .3 }, wings: { dragon: 2.6, flame: 3, phoenix: 3, demon: 1.2, angel: .3, butterfly: .4, finwing: .2 , storm: .8, mecha: 1.2 }, extra: { embers: 3, runeCircle: 1.2 }, pattern: { cracks: 2.5, stripes: 1.5 } },
    agua: { back: { sail: 3, crystals: 1.5, quills: 1.4, flames: .3 }, head3: { antennae: 2, crest: 1.6, gem: 1.4 }, head4: { unihorn: 1.8, halo: 1.5, thirdEye: 1.4, antlers: 1.3 }, wings: { ethereal: 2.4, angel: 1.6, butterfly: 1.6, crystal: 1.3, finwing: 3, dragonfly: 1.6, flame: .3, bone: .3, phoenix: .2 , storm: 2.2 }, extra: { orbs: 2, wisps: 1.3, embers: .4 }, pattern: { scales: 3, runes: 1.2 } },
    tierra: { back: { plates: 2.4, crystals: 2.2, leaves: 2.6, bones: 1.2 }, head3: { horns: 1.6, curls: 2.2, antennae: 1.2 }, head4: { antlers: 3, curls: 2, hornCrown: 1.6, bighorns: 1.3 }, wings: { crystal: 2.6, dragon: 1.6, butterfly: 1.6, bone: 1.1, leaf: 3, dragonfly: 1.4, angel: .5 , mecha: 2.4 }, extra: { pauldron: 2, runeCircle: 1.3, cape: 1.2 }, pattern: { cracks: 1.6, scales: 1.4 } },
    oscuridad: { back: { bones: 2.6, spikes: 2, quills: 1.4, flames: 1.2, leaves: .3 }, head3: { horns: 2.2, gem: 1.4, curls: 1.2 }, head4: { demonhorns: 3, hornCrown: 2.2, thirdEye: 2.2, halo: .2 }, wings: { demon: 3, bone: 2.4, raven: 2.6, ethereal: 1.3, cosmic: 2.6, shadow: 3, angel: .15, butterfly: .4 , storm: 1.4 }, extra: { wisps: 3, cape: 1.8, runeCircle: 1.3 }, pattern: { runes: 1.6, cracks: 1.6, stripes: 1.2 } },
  };
  const UPGRADE = { horns: ['bighorns', 'demonhorns'], unihorn: ['unihorn'], antennae: ['antlers', 'thirdEye'], crest: ['flamecrown', 'halo'], gem: ['thirdEye', 'halo'], curls: ['curls', 'bighorns'] };
  const HORNY = new Set(['horns', 'bighorns', 'demonhorns', 'curls', 'unihorn', 'antlers', 'hornCrown']);
  const HAT = new Set(['crown', 'halo', 'thorns', 'tophat', 'wizard', 'beanie', 'headphones']);
  function regalia(ind) {
    if (ind._reg) return ind._reg;
    const R = rng(((ind.seed >>> 0) ^ 0x7e9a11c3) >>> 0), B = REG_BIAS[ind.house] || {}, B2 = REG_BIAS[ind.house2] || {};
    const mix = (k) => { const a = B[k] || {}, b = B2[k] || {}, o = Object.assign({}, a); for (const [x, w] of Object.entries(b)) o[x] = (o[x] || 1) * Math.sqrt(w); return o; };
    const p = (k) => pick(REG[k], R, mix(k));
    const r = { back: p('back'), head3: p('head3'), wings: p('wings'), extra: p('extra'), pattern: p('pattern') };
    const up = UPGRADE[r.head3];
    r.head4 = up && R() < 0.65 ? up[Math.floor(R() * up.length)] : p('head4');
    const g = GLOW[ind.house2 && R() < 0.4 ? ind.house2 : ind.house] || GLOW.luz; r.glow = g[Math.floor(R() * g.length)];
    // Lo que ya trae puesto: si tiene cuernos u orejas de cuerno, la cabeza lleva algo que flota (gema, halo, corona…)
    const hornEars = ['horns', 'ram', 'trihorn', 'antlers'].includes(ind.ears);
    const FLOAT3 = ['gem', 'antennae', 'crest'], FLOAT4 = ['halo', 'flamecrown', 'thirdEye'];
    if (hornEars && HORNY.has(r.head3)) r.head3 = FLOAT3[Math.floor(R() * 3)];
    if (hornEars && HORNY.has(r.head4)) r.head4 = FLOAT4[Math.floor(R() * 3)];
    if (HAT.has(ind.final) && ['halo', 'flamecrown'].includes(r.head4)) r.head4 = hornEars ? 'thirdEye' : 'bighorns';
    if (r.wings === 'none' && r.extra !== 'cape') r.extra = R() < 0.5 ? 'cape' : r.extra; // sin alas: casi siempre capa
    r.wings3 = r.wings !== 'none' && R() < 0.32 ? r.wings : 'none'; // v5.15: alitas en la 3.ª forma (las mismas que tendrá)
    ind._reg = r;
    return r;
  }
  const EPIC = { // colores de las alas de plumas (y su aura)
    angel: { aura: '#fde68a', a: '#fffdf5', b: '#fde68a', edge: '#a16207' },
    raven: { aura: '#6d28d9', a: '#1f1b2e', b: '#3b2f5c', edge: '#05030a' },
    dragon: { aura: '#f97316' }, demon: { aura: '#7f1d1d' },
  };
  /** Alas grandes desde el hombro: la de atrás (más oscura) y la cercana. */
  function epicWingsSvg(kind, P, layer, glow, scale = 1) {
    const { id, cx, cy, W, H, skin, dk, s } = P, x = cx + W * 0.18, y = cy - H * 0.45, k = s * 1.35 * scale;
    if (layer === 'front') return '';
    const one = (mx, dark) => {
      const X = (dx) => f(x + mx * dx * k), Y = (dy) => f(y + dy * k);
      const at = (deg, len, w = 0) => { const a = deg * Math.PI / 180; return [x + mx * (Math.cos(a) * len - Math.sin(a) * w) * k, y + (Math.sin(a) * len + Math.cos(a) * w) * k]; };
      const pt = (q) => `${f(q[0])} ${f(q[1])}`;
      if (kind === 'angel' || kind === 'raven' || kind === 'ethereal') {
        const E = kind === 'ethereal' ? { a: glow, b: glow, edge: shade(glow, -0.35) } : EPIC[kind], rows = [[0, 1], [6, .86], [12, .7]];
        const op = kind === 'ethereal' ? ` fill-opacity="${dark ? .18 : .32}"` : '';
        return rows.map(([o, sc], i) => `<path d="M ${X(0)} ${Y(4 + o * .3)} Q ${X(16 * sc)} ${Y(-40 * sc)} ${X(44 * sc)} ${Y(-34 * sc + o)} Q ${X(40 * sc)} ${Y(-22 * sc + o)} ${X(46 * sc)} ${Y(-14 * sc + o)} Q ${X(36 * sc)} ${Y(-8 * sc + o)} ${X(40 * sc)} ${Y(0 + o)} Q ${X(26 * sc)} ${Y(2 + o)} ${X(28 * sc)} ${Y(10 + o)} Q ${X(12)} ${Y(10 + o * .5)} ${X(0)} ${Y(6 + o * .3)} Z" fill="${dark ? shade(i ? E.b : E.a, -0.12) : i ? E.b : E.a}"${op} ${STROKE(E.edge, 1.5)}/>`).join('') +
          (kind === 'raven' && !dark ? `<path d="M ${X(10)} ${Y(-12)} Q ${X(22)} ${Y(-30)} ${X(38)} ${Y(-30)}" stroke="#a78bfa" stroke-width="1.4" fill="none" opacity=".6"/>` : '');
      }
      if (kind === 'butterfly') {
        const c1 = dark ? shade(glow, -0.25) : glow, c2 = shade(glow, -0.55);
        return `<path d="M ${X(0)} ${Y(0)} C ${X(8)} ${Y(-42)} ${X(52)} ${Y(-50)} ${X(48)} ${Y(-22)} C ${X(46)} ${Y(-8)} ${X(22)} ${Y(-4)} ${X(0)} ${Y(2)} Z" fill="${c1}" fill-opacity=".88" ${STROKE(c2, 1.6)}/>` +
          `<path d="M ${X(0)} ${Y(3)} C ${X(30)} ${Y(2)} ${X(38)} ${Y(22)} ${X(24)} ${Y(27)} C ${X(12)} ${Y(30)} ${X(4)} ${Y(16)} ${X(0)} ${Y(5)} Z" fill="${shade(c1, 0.15)}" fill-opacity=".88" ${STROKE(c2, 1.6)}/>` +
          `<circle cx="${X(34)}" cy="${Y(-28)}" r="${f(5.5 * k)}" fill="${c2}" opacity=".8"/><circle cx="${X(34)}" cy="${Y(-28)}" r="${f(2.4 * k)}" fill="#fff" opacity=".85"/><circle cx="${X(21)}" cy="${Y(15)}" r="${f(3.4 * k)}" fill="${c2}" opacity=".7"/>` +
          `<path d="M ${X(0)} ${Y(1)} L ${X(30)} ${Y(-36)} M ${X(0)} ${Y(1)} L ${X(42)} ${Y(-14)} M ${X(0)} ${Y(4)} L ${X(24)} ${Y(22)}" stroke="${c2}" stroke-width="1" opacity=".55"/>`;
      }
      if (kind === 'crystal') {
        return [[-80, 40, 5], [-60, 50, 6.5], [-40, 46, 6], [-20, 36, 5], [0, 26, 4]].map(([a, l, w]) => {
          const tip = at(a, l), b1 = at(a, 4, w * .6), b2 = at(a, 4, -w * .6), m1 = at(a, l * .35, w * 1.25), m2 = at(a, l * .35, -w * 1.25);
          const c = dark ? shade(glow, -0.35) : glow;
          return `<path d="M ${pt(b1)} L ${pt(m1)} L ${pt(tip)} L ${pt(m2)} L ${pt(b2)} Z" fill="${c}" ${STROKE(shade(glow, -0.65), 1.4)}/><path d="M ${pt(b1)} L ${pt(m1)} L ${pt(tip)} Z" fill="#fff" opacity="${dark ? .12 : .35}"/>`;
        }).join('');
      }
      if (kind === 'flame') { // lenguas de fuego onduladas, con el corazón más claro
        return [[-84, 40, 7], [-60, 52, 9], [-36, 46, 8], [-12, 34, 6]].map(([a, l, w], i) => {
          const b1 = at(a, 2, w * .5), b2 = at(a, 2, -w * .5), tip = at(a + (i % 2 ? 8 : -8), l);
          const outer = `M ${pt(b1)} C ${pt(at(a, l * .35, w * 1.5))} ${pt(at(a, l * .7, -w * .4))} ${pt(tip)} C ${pt(at(a, l * .62, -w * 1.3))} ${pt(at(a, l * .3, -w * .2))} ${pt(b2)} Z`;
          const inner = `M ${pt(at(a, 4, w * .2))} C ${pt(at(a, l * .3, w * .7))} ${pt(at(a, l * .55, -w * .2))} ${pt(at(a + (i % 2 ? 6 : -6), l * .7))} C ${pt(at(a, l * .45, -w * .6))} ${pt(at(a, l * .25, -w * .1))} ${pt(at(a, 4, -w * .2))} Z`;
          return `<path d="${outer}" fill="url(#fw${id})" opacity="${dark ? .7 : .95}" ${STROKE(shade(glow, -0.6), 1.2)}/><path d="${inner}" fill="#fffbe8" opacity="${dark ? .25 : .5}"/>`;
        }).join('');
      }
      if (kind === 'bone') {
        const kn = at(-75, 38), tips = [at(-40, 58), at(-20, 52), at(0, 44), at(20, 34)];
        const bone = dark ? '#a89c84' : '#e8dfc8', memC = dark ? shade(skin, -0.62) : shade(skin, -0.48);
        // membrana hecha jirones entre los dedos (con mordiscos en el borde)
        let d = `M ${X(0)} ${Y(4)} L ${pt(kn)}`;
        tips.forEach((t, i) => { const nx = tips[i + 1] || [x + mx * 6 * k, y + 10 * k], mxp = [(t[0] + nx[0]) / 2, (t[1] + nx[1]) / 2], c = [x + (mxp[0] - x) * 0.72, y + (mxp[1] - y) * 0.72];
          d += ` L ${pt(t)} Q ${pt([(t[0] + c[0]) / 2 + mx * 2 * k, (t[1] + c[1]) / 2])} ${pt(c)} L ${pt([c[0] + mx * 2 * k, c[1] + 2 * k])} Q ${pt([(c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2 + 2 * k])} ${pt(nx)}`; });
        const mem = `<path d="${d} Z" fill="${memC}" fill-opacity="${dark ? .85 : .9}" ${STROKE('#120a0e', 1.3)}/>`;
        const lines = `M ${X(0)} ${Y(4)} L ${pt(kn)} ` + tips.map((t) => `M ${pt(kn)} L ${pt(t)}`).join(' ');
        return mem + `<path d="${lines}" stroke="#1a0f08" stroke-width="${f(3.6 * k)}" stroke-linecap="round" fill="none"/><path d="${lines}" stroke="${bone}" stroke-width="${f(1.9 * k)}" stroke-linecap="round" fill="none"/>` +
          tips.map((t) => `<path d="M ${pt(t)} l ${f(mx * 3 * k)} ${f(-1.5 * k)} l ${f(-mx * 1.4 * k)} ${f(2.6 * k)} Z" fill="${bone}" ${STROKE('#1a0f08', .9)}/>`).join('') + `<circle cx="${f(kn[0])}" cy="${f(kn[1])}" r="${f(2.3 * k)}" fill="${bone}" ${STROKE('#1a0f08', 1)}/>`;
      }
      // v5.15: membranas con brazo (húmero → codo → dedos) y borde festoneado entre los dedos
      const membrane = (elbow, tips, depth, memC, boneC, o = {}) => {
        let d = `M ${X(0)} ${Y(5)} L ${pt(elbow)} L ${pt(tips[0])}`;
        for (let i = 0; i < tips.length - 1; i++) { const a2 = tips[i], b2 = tips[i + 1], m = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], c = [m[0] + (elbow[0] - m[0]) * depth, m[1] + (elbow[1] - m[1]) * depth];
          // demonio: festón hondo con un pincho en medio (borde rasgado, pero se lee como ala)
          d += o.jag ? ` Q ${pt([m[0] + (c[0] - m[0]) * 1.25, m[1] + (c[1] - m[1]) * 1.25])} ${pt([m[0] + (c[0] - m[0]) * .55, m[1] + (c[1] - m[1]) * .55])} L ${pt([m[0] + (c[0] - m[0]) * .2 + mx * 1.5 * k, m[1] + (c[1] - m[1]) * .2 + 2 * k])} L ${pt([m[0] + (c[0] - m[0]) * .62 + mx * 2 * k, m[1] + (c[1] - m[1]) * .62])} Q ${pt([m[0] + (c[0] - m[0]) * .9 + (b2[0] - m[0]) * .4, m[1] + (c[1] - m[1]) * .9 + (b2[1] - m[1]) * .4])} ${pt(b2)}` : ` Q ${pt(c)} ${pt(b2)}`; }
        const last = tips[tips.length - 1];
        d += ` Q ${pt([x + (last[0] - x) * .45, y + 14 * k])} ${X(4)} ${Y(12)} Z`;
        const fingers = `M ${X(0)} ${Y(5)} L ${pt(elbow)} ` + tips.map((t) => `M ${pt(elbow)} L ${pt(t)}`).join(' ');
        return `<path d="${d}" fill="${memC}" ${STROKE(boneC, 1.7)}/>` + (o.glow ? `<path d="${d}" fill="url(#ea${id})" opacity=".35"/>` : '') +
          `<path d="${fingers}" stroke="${boneC}" stroke-width="${f(2.6 * k)}" stroke-linecap="round" fill="none"/>` + (o.hi ? `<path d="${fingers}" stroke="${o.hi}" stroke-width="${f(1 * k)}" stroke-linecap="round" fill="none" opacity=".7"/>` : '');
      };
      if (kind === 'dragon') {
        const elbow = at(-78, 30), tips = [at(-52, 60), at(-28, 58), at(-6, 50), at(16, 38)];
        const memC = shade(skin, dark ? -0.52 : -0.3), boneC = dk;
        return membrane(elbow, tips, .32, memC, boneC, { hi: shade(skin, 0.1) }) + (dark ? '' : tips.slice(0, 3).map((t, i) => `<path d="M ${pt(elbow)} L ${pt([elbow[0] + (t[0] - elbow[0]) * .55, elbow[1] + (t[1] - elbow[1]) * .55])}" stroke="${shade(skin, 0.25)}" stroke-width="${f(3.2 * k)}" opacity=".18" stroke-linecap="round"/>`).join('')) +
          `<path d="M ${pt(elbow)} l ${f(mx * 2 * k)} ${f(-6 * k)} l ${f(mx * 2.6 * k)} ${f(5 * k)} Z" fill="#f5f0e6" ${STROKE(boneC, 1)}/>`;
      }
      if (kind === 'demon') {
        const elbow = at(-82, 34), tips = [at(-56, 66), at(-30, 62), at(-8, 56), at(14, 44), at(32, 30)];
        const memC = dark ? '#1a070e' : '#3b0d1c';
        return membrane(elbow, tips, .36, memC, '#0b0306', { jag: true, hi: '#7f1d1d' }) +
          `<path d="M ${pt(elbow)} q ${f(mx * 1 * k)} ${f(-9 * k)} ${f(mx * 7 * k)} ${f(-11 * k)} q ${f(-mx * 3 * k)} ${f(4 * k)} ${f(-mx * 3 * k)} ${f(10 * k)} Z" fill="#e5e7eb" ${STROKE('#0b0306', 1)}/>` +
          (dark ? '' : [[.35, .4], [.55, .62]].map(([t1, t2]) => { const p1 = [elbow[0] + (tips[1][0] - elbow[0]) * t1 + (tips[2][0] - elbow[0]) * t1 * .2, elbow[1] + (tips[1][1] - elbow[1]) * t2]; return `<ellipse cx="${f(p1[0])}" cy="${f(p1[1])}" rx="${f(2.2 * k)}" ry="${f(1.4 * k)}" fill="#05020a" opacity=".85"/>`; }).join(''));
      }
      if (kind === 'cosmic') { // membrana de noche con estrellas y borde que brilla
        const elbow = at(-76, 30), tips = [at(-50, 58), at(-26, 56), at(-4, 48), at(18, 36)];
        const stars = [[-50, 34], [-38, 46], [-24, 30], [-14, 44], [-2, 30], [8, 34], [-32, 20]].map(([a2, l], i) => { const q = at(a2, l); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f((i % 3 ? .9 : 1.5) * k)}" fill="#fff" opacity="${dark ? .4 : .9}"/>`; }).join('');
        return membrane(elbow, tips, .3, dark ? '#0b1026' : '#1e1b4b', '#020617', { hi: glow }) + stars;
      }
      // v5.18: alas mecánicas (placas de metal remachadas) y alas de tormenta (rayos y nubes)
      if (kind === 'mecha') {
        return [[-80, 46, 6], [-56, 54, 7], [-32, 50, 7], [-8, 40, 6], [14, 28, 5]].map(([a2, l, w], i) => { const tip = at(a2, l), b1 = at(a2, 4, w * .7), b2 = at(a2, 4, -w * .7), t1 = at(a2, l * .9, w * .6), t2 = at(a2, l * .9, -w * .6), c = dark ? '#57534e' : i % 2 ? '#a8a29e' : '#d6d3d1';
          return `<path d="M ${pt(b1)} L ${pt(t1)} L ${pt(tip)} L ${pt(t2)} L ${pt(b2)} Z" fill="${c}" ${STROKE('#1c1917', 1.3)}/><circle cx="${f(at(a2, l * .35)[0])}" cy="${f(at(a2, l * .35)[1])}" r="${f(1.1 * k)}" fill="#1c1917"/><circle cx="${f(at(a2, l * .7)[0])}" cy="${f(at(a2, l * .7)[1])}" r="${f(1.1 * k)}" fill="${dark ? '#1c1917' : glow}"/>`; }).join('') +
          `<circle cx="${X(0)}" cy="${Y(3)}" r="${f(4 * k)}" fill="#78716c" ${STROKE('#1c1917', 1.4)}/>`;
      }
      if (kind === 'storm') {
        const cloud = [[-60, 40], [-34, 46], [-10, 38]].map(([a2, l]) => { const q = at(a2, l); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(10 * k)}" fill="${dark ? '#334155' : '#64748b'}" opacity=".9"/>`; }).join('');
        const bolt = (a2, l) => { const p0 = at(a2, 8), p1 = at(a2 + 6, l * .4), p2 = at(a2 - 6, l * .55), p3 = at(a2 + 4, l); return `<path d="M ${pt(p0)} L ${pt(p1)} L ${pt(p2)} L ${pt(p3)}" fill="none" stroke="${dark ? '#a5b4fc' : '#fde047'}" stroke-width="${f(2.4 * k)}" stroke-linejoin="round" stroke-linecap="round"/>`; };
        return `<path d="M ${X(0)} ${Y(4)} Q ${pt(at(-70, 40))} ${pt(at(-50, 50))} Q ${pt(at(-20, 56))} ${pt(at(0, 42))} Q ${pt(at(18, 30))} ${X(4)} ${Y(10)} Z" fill="${dark ? '#1e293b' : '#475569'}" ${STROKE('#0f172a', 1.4)}/>` + cloud + bolt(-50, 54) + bolt(-18, 50) + (dark ? '' : bolt(8, 36));
      }
      if (kind === 'dragonfly') { // dos pares de alas finas y transparentes con nervios
        return [[-58, 54, 7], [-28, 50, 6.5]].map(([a2, l, w]) => { const tip = at(a2, l), c1 = at(a2, l * .5, w), c2 = at(a2, l * .5, -w);
          const veins = [0.25, 0.45, 0.65, 0.85].map((t) => { const q1 = at(a2, l * t, w * .9), q2 = at(a2, l * t, -w * .9); return `M ${pt(q1)} L ${pt(q2)}`; }).join(' ');
          return `<path d="M ${X(0)} ${Y(2)} Q ${pt(c1)} ${pt(tip)} Q ${pt(c2)} ${X(0)} ${Y(4)} Z" fill="${glow}" fill-opacity="${dark ? .18 : .3}" ${STROKE(shade(glow, -0.55), 1.2)}/><path d="M ${X(0)} ${Y(3)} L ${pt(tip)} ${veins}" stroke="${shade(glow, -0.5)}" stroke-width=".8" opacity=".55" fill="none"/><circle cx="${f(at(a2, l * .82)[0])}" cy="${f(at(a2, l * .82)[1])}" r="${f(1.6 * k)}" fill="${shade(glow, -0.4)}" opacity=".8"/>`; }).join('');
      }
      if (kind === 'leaf') { // hojas grandes en abanico (otoñales en las casas de fuego y oscuridad)
        const cols = P.house === 'fuego' ? ['#ea580c', '#f59e0b', '#b45309'] : P.house === 'oscuridad' ? ['#7c2d12', '#9f1239', '#4c1d95'] : ['#16a34a', '#65a30d', '#15803d'];
        return [[-74, 44, 9], [-46, 52, 11], [-18, 44, 10], [8, 32, 8]].map(([a2, l, w], i) => { const tip = at(a2, l), c1 = at(a2, l * .5, w), c2 = at(a2, l * .5, -w), c = dark ? shade(cols[i % 3], -0.3) : cols[i % 3];
          return `<path d="M ${X(0)} ${Y(3)} Q ${pt(c1)} ${pt(tip)} Q ${pt(c2)} ${X(0)} ${Y(5)} Z" fill="${c}" ${STROKE('#1a2e05', 1.3)}/><path d="M ${X(0)} ${Y(4)} L ${pt(tip)}" stroke="${shade(c, 0.4)}" stroke-width="1" opacity=".8"/>` +
            [0.35, 0.6].map((t) => `<path d="M ${pt(at(a2, l * t))} L ${pt(at(a2 + 12, l * (t + .12)))} M ${pt(at(a2, l * t))} L ${pt(at(a2 - 12, l * (t + .12)))}" stroke="${shade(c, 0.4)}" stroke-width=".7" opacity=".6"/>`).join(''); }).join('');
      }
      if (kind === 'finwing') { // aleta de agua con radios y borde festoneado
        const rays = [-80, -60, -40, -20, 0, 18].map((a2, i) => at(a2, 44 + (i % 2 ? -6 : 4) - Math.abs(a2 + 30) * .15));
        let d = `M ${X(0)} ${Y(4)} L ${pt(rays[0])}`; for (let i = 1; i < rays.length; i++) { const m = [(rays[i - 1][0] + rays[i][0]) / 2, (rays[i - 1][1] + rays[i][1]) / 2]; d += ` Q ${pt([m[0] + (x - m[0]) * .18, m[1] + (y - m[1]) * .18])} ${pt(rays[i])}`; }
        d += ` Q ${X(14)} ${Y(14)} ${X(2)} ${Y(8)} Z`;
        return `<path d="${d}" fill="${shade(glow, dark ? -0.3 : 0)}" fill-opacity=".72" ${STROKE(shade(glow, -0.6), 1.4)}/>` + rays.map((r) => `<path d="M ${X(0)} ${Y(4)} L ${pt(r)}" stroke="${shade(glow, -0.55)}" stroke-width="1.1" opacity=".6"/>`).join('');
      }
      if (kind === 'phoenix') { // plumas largas de fuego con la punta curvada
        return [[-84, 38], [-66, 48], [-46, 52], [-26, 46], [-6, 37], [12, 27]].map(([a2, l], i) => { const tip = at(a2 + 10, l), c1 = at(a2, l * .55, 5), c2 = at(a2, l * .55, -4), curl = at(a2 + 22, l * .92);
          return `<path d="M ${X(0)} ${Y(3)} Q ${pt(c1)} ${pt(tip)} Q ${pt(curl)} ${pt(at(a2 + 16, l * .8))} Q ${pt(c2)} ${X(0)} ${Y(5)} Z" fill="url(#fw${id})" opacity="${dark ? .65 : .95}" ${STROKE(shade(glow, -0.6), 1.1)}/>` + (i % 2 || dark ? '' : `<circle cx="${f(tip[0])}" cy="${f(tip[1])}" r="${f(1.4 * k)}" fill="#fffbe8"/>`); }).join('');
      }
      if (kind === 'shadow') { // jirones de humo
        const c = P.house === 'luz' ? '#94a3b8' : '#1e1030';
        return [[-70, 46, 7], [-46, 54, 8], [-22, 48, 7], [2, 36, 6]].map(([a2, l, w], i) => { const tip = at(a2 + (i % 2 ? 8 : -6), l), c1 = at(a2, l * .4, w * 1.4), c2 = at(a2, l * .7, -w), c3 = at(a2, l * .5, -w * 1.2);
          return `<path d="M ${X(0)} ${Y(3)} C ${pt(c1)} ${pt(c2)} ${pt(tip)} C ${pt(at(a2, l * .8, w * .4))} ${pt(c3)} ${X(1)} ${Y(6)} Z" fill="${c}" opacity="${dark ? .45 : .7}"/><path d="M ${pt(at(a2, l * .3))} C ${pt(c1)} ${pt(c2)} ${pt(tip)}" stroke="${glow}" stroke-width="1" fill="none" opacity=".55"/>`; }).join('');
      }
      return '';
    };
    return one(-0.7, true) + one(1, false);
  }
  /** Cabeza: cuernos, halo, antenas, cresta, gema, carnero, corona de llamas, astas, corona de cuernos, tercer ojo. */
  function headSvg(kind, P, tier, layer, glow) {
    const { id, cx, W, top, s, dk, hornC, fx, ey, er } = P, big = tier === 4, k = s * (big ? 1.2 : 0.85);
    const onTop = kind === 'gem' || kind === 'thirdEye';
    if ((layer === 'top') !== onTop) return '';
    const glowDot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.1)}" fill="${glow}" opacity=".3"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${glow}" ${STROKE(shade(glow, -0.6), 1)}/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .35)}" r="${f(r * .35)}" fill="#fff"/>`;
    switch (kind) {
      case 'horns': case 'bighorns': case 'demonhorns': {
        const demon = kind === 'demonhorns', kk = s * (kind === 'horns' ? 0.8 : 1.2);
        const c = demon ? '#1a0b10' : '#e7dcc0', c2 = demon ? '#7f1d1d' : '#a8977a';
        return [-0.42, 0.18].map((o, i) => { const hx = cx + W * o, hy = top(hx) + 2, d = i ? 1 : -1;
          return `<path d="M ${f(hx - 4 * kk)} ${f(hy)} Q ${f(hx - 2 * kk)} ${f(hy - 20 * kk)} ${f(hx + d * 14 * kk)} ${f(hy - 26 * kk)} Q ${f(hx + d * 6 * kk)} ${f(hy - 16 * kk)} ${f(hx + 5 * kk)} ${f(hy)} Z" fill="${c}" ${STROKE(dk, 1.6)}/><path d="M ${f(hx - 2 * kk)} ${f(hy - 6 * kk)} Q ${f(hx)} ${f(hy - 16 * kk)} ${f(hx + d * 9 * kk)} ${f(hy - 21 * kk)}" stroke="${c2}" stroke-width="1.2" fill="none" opacity=".7"/>`; }).join('');
      }
      case 'halo': { const hx = cx - W * 0.15, hy = top(hx) - 10 * k; return `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(15 * k)}" ry="${f(4.5 * k)}" fill="none" stroke="${glow === '#f9a8d4' ? '#fde047' : glow}" stroke-width="${f(3.2 * k)}"/><ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(15 * k)}" ry="${f(4.5 * k)}" fill="none" stroke="#fff" stroke-width="1" opacity=".8"/>`; }
      case 'unihorn': { // cuerno único, fino y algo curvo, con espiral (nacarado; dorado en la 4.ª)
        const hx = cx - W * 0.3, hy = top(hx) + 3, L = big ? 28 : 19, tx = hx - 9 * k * (L / 20), ty = hy - L * k, c = big ? '#fde68a' : '#f5f0e6', w = 3 * k;
        const qx = hx + 2 * k, qy = hy - L * k * 0.55;
        const rings = [0.22, 0.42, 0.6, 0.76].map((t) => { const a = (1 - t) * (1 - t) * hx + 2 * (1 - t) * t * qx + t * t * tx, b = (1 - t) * (1 - t) * hy + 2 * (1 - t) * t * qy + t * t * ty, ww = w * (1 - t) + .6; return `<path d="M ${f(a - ww)} ${f(b + ww * .5)} Q ${f(a)} ${f(b - ww * .2)} ${f(a + ww)} ${f(b - ww * .5)}" stroke="${shade(c, -0.5)}" stroke-width="1" fill="none"/>`; }).join('');
        return `<path d="M ${f(hx - w)} ${f(hy)} Q ${f(qx - w * .6)} ${f(qy)} ${f(tx)} ${f(ty)} Q ${f(qx + w * .9)} ${f(qy + 1)} ${f(hx + w)} ${f(hy)} Z" fill="${c}" ${STROKE(dk, 1.4)}/>${rings}` + (big ? glowDot(tx, ty, 1.8 * k) : '');
      }
      case 'antennae': return [-0.4, -0.05].map((o, i) => { const hx = cx + W * o, hy = top(hx) + 2, tx = hx + (i ? 6 : -8) * k, ty = hy - 20 * k;
        return `<path d="M ${f(hx)} ${f(hy)} Q ${f(hx + (i ? -2 : 2) * k)} ${f(hy - 12 * k)} ${f(tx)} ${f(ty)}" stroke="${dk}" stroke-width="${f(2.2 * s)}" fill="none" stroke-linecap="round"/>` + glowDot(tx, ty, 2.6 * k); }).join('');
      case 'crest': { const hx = cx - W * 0.12, hy = top(hx) + 3;
        return [[-120, 18], [-100, 24], [-80, 20], [-60, 14]].map(([a, l], i) => { const r = a * Math.PI / 180, tx = hx + Math.cos(r) * l * k, ty = hy + Math.sin(r) * l * k, nx = -Math.sin(r) * 3.6 * k, ny = Math.cos(r) * 3.6 * k;
          return `<path d="M ${f(hx)} ${f(hy)} Q ${f((hx + tx) / 2 + nx)} ${f((hy + ty) / 2 + ny)} ${f(tx)} ${f(ty)} Q ${f((hx + tx) / 2 - nx)} ${f((hy + ty) / 2 - ny)} ${f(hx)} ${f(hy)} Z" fill="${i % 2 ? glow : shade(glow, -0.3)}" ${STROKE(dk, 1.3)}/>`; }).join(''); }
      case 'flamecrown': { const hx = cx - W * 0.15, hy = top(hx) - 9 * k;
        return [-12, -6, 0, 6, 12].map((dx, i) => { const h = (i === 2 ? 16 : i % 2 ? 12 : 9) * k, x = hx + dx * k;
          return `<path d="M ${f(x - 3 * k)} ${f(hy)} Q ${f(x - 3 * k)} ${f(hy - h * .6)} ${f(x + 1 * k)} ${f(hy - h)} Q ${f(x + 1 * k)} ${f(hy - h * .45)} ${f(x + 3 * k)} ${f(hy)} Z" fill="url(#fw${id})" ${STROKE(shade(glow, -0.6), 1)}/>`; }).join('') +
          `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(15 * k)}" ry="${f(3.6 * k)}" fill="none" stroke="#1a0f08" stroke-width="${f(3.6 * k)}"/><ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(15 * k)}" ry="${f(3.6 * k)}" fill="none" stroke="#f6c343" stroke-width="${f(2 * k)}"/>`; }
      case 'antlers': return [-0.4, 0.1].map((o, i) => { const hx = cx + W * o, hy = top(hx) + 2, d = i ? 1 : -1;
        const p = `M ${f(hx)} ${f(hy)} Q ${f(hx + d * 2 * k)} ${f(hy - 14 * k)} ${f(hx + d * 10 * k)} ${f(hy - 26 * k)} M ${f(hx + d * 1.5 * k)} ${f(hy - 9 * k)} L ${f(hx - d * 6 * k)} ${f(hy - 17 * k)} M ${f(hx + d * 5 * k)} ${f(hy - 18 * k)} L ${f(hx + d * 1 * k)} ${f(hy - 27 * k)} M ${f(hx + d * 7 * k)} ${f(hy - 22 * k)} L ${f(hx + d * 15 * k)} ${f(hy - 24 * k)}`;
        return `<path d="${p}" stroke="${dk}" stroke-width="${f(4.4 * k)}" stroke-linecap="round" fill="none"/><path d="${p}" stroke="${hornC}" stroke-width="${f(2.4 * k)}" stroke-linecap="round" fill="none"/>` + glowDot(hx + d * 10 * k, hy - 26 * k, 1.6 * k) + glowDot(hx + d * 1 * k, hy - 27 * k, 1.3 * k); }).join('');
      case 'hornCrown': return [-0.55, -0.32, -0.1, 0.12, 0.34].map((o, i) => { const hx = cx + W * o, hy = top(hx) + 2, h = [9, 14, 18, 14, 10][i] * k, d = o < -0.1 ? -1 : o > -0.1 ? 1 : 0;
        return `<path d="M ${f(hx - 3.4 * k)} ${f(hy)} Q ${f(hx - 1 * k)} ${f(hy - h * .7)} ${f(hx + d * 3 * k)} ${f(hy - h)} Q ${f(hx + 1.6 * k)} ${f(hy - h * .5)} ${f(hx + 3.4 * k)} ${f(hy)} Z" fill="#2a1a12" ${STROKE('#0b0604', 1.2)}/><path d="M ${f(hx + d * 3 * k)} ${f(hy - h)} l ${f(-d * 1 * k - 1)} ${f(h * .3)}" stroke="${glow}" stroke-width="1.4" opacity=".9"/>`; }).join('');
      case 'curls': return [-0.6, 0.16].map((o) => { const hx = cx + W * o, hy = top(hx) + 4 * k, r = (big ? 8 : 6) * k;
        return `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(r)}" fill="${hornC}" ${STROKE(dk, 1.6)}/><path d="M ${f(hx + r * .7)} ${f(hy)} A ${f(r * .7)} ${f(r * .7)} 0 1 0 ${f(hx)} ${f(hy + r * .7)} A ${f(r * .4)} ${f(r * .4)} 0 1 0 ${f(hx - r * .3)} ${f(hy + r * .1)}" stroke="${dk}" stroke-width="1.2" fill="none" opacity=".7"/>`; }).join('');
      case 'gem': { const gx = fx + er * 0.4, gy = ey - er * 2.1, r = 3.4 * k;
        return `<path d="M ${f(gx)} ${f(gy - r)} L ${f(gx + r * .8)} ${f(gy)} L ${f(gx)} ${f(gy + r)} L ${f(gx - r * .8)} ${f(gy)} Z" fill="${glow}" ${STROKE(shade(glow, -0.65), 1.3)}/><path d="M ${f(gx)} ${f(gy - r)} L ${f(gx - r * .8)} ${f(gy)} L ${f(gx)} ${f(gy)} Z" fill="#fff" opacity=".55"/>`; }
      case 'thirdEye': { const gx = fx + er * 0.4, gy = ey - er * 2.2, rx = 4.2 * k, ry = 2.6 * k;
        return `<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(rx * 1.9)}" ry="${f(ry * 2)}" fill="${glow}" opacity=".25"/><path d="M ${f(gx - rx)} ${f(gy)} Q ${f(gx)} ${f(gy - ry * 1.6)} ${f(gx + rx)} ${f(gy)} Q ${f(gx)} ${f(gy + ry * 1.6)} ${f(gx - rx)} ${f(gy)} Z" fill="#fff8e7" ${STROKE(dk, 1.4)}/><circle cx="${f(gx)}" cy="${f(gy)}" r="${f(ry * .85)}" fill="${glow}"/><ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(ry * .22)}" ry="${f(ry * .7)}" fill="#120509"/>`; }
    }
    return '';
  }
  /** Lomo (rango 3 y 4). */
  function backSvg(kind, P, tier, glow) {
    const { id, cx, W, top, dk, hornC, skin, s } = P, t4 = tier === 4, k = s * (t4 ? 1.5 : 1.3);
    const xs = (n, a = 0.02, b = 0.8) => Array.from({ length: n }, (_, i) => cx + W * (a + i * (b / n)));
    switch (kind) {
      case 'plates': return xs(t4 ? 5 : 4, 0.0, 0.85).map((x, i) => { const y = top(x) + 4, hh = (i % 2 ? 9 : 12) * k * (1 - i * .06), c = shade(hornC, -0.15);
        return `<path d="M ${f(x - 5 * k)} ${f(y)} Q ${f(x - 6 * k)} ${f(y - hh * .8)} ${f(x)} ${f(y - hh)} Q ${f(x + 6 * k)} ${f(y - hh * .8)} ${f(x + 5 * k)} ${f(y)} Z" fill="${c}" ${STROKE(dk, 1.4)}/><path d="M ${f(x - 3 * k)} ${f(y - hh * .35)} Q ${f(x)} ${f(y - hh * .8)} ${f(x + 3 * k)} ${f(y - hh * .35)}" stroke="#fff" stroke-width="1" fill="none" opacity=".4"/>`; }).join('');
      case 'crystals': return xs(t4 ? 4 : 3, 0.06, 0.8).map((x, i) => { const y = top(x) + 4, hh = [14, 19, 12, 16][i] * k * .9, tilt = (i - 1) * 3 * k;
        return `<path d="M ${f(x - 3.6 * k)} ${f(y)} L ${f(x - 3 * k + tilt)} ${f(y - hh * .7)} L ${f(x + tilt)} ${f(y - hh)} L ${f(x + 3 * k + tilt)} ${f(y - hh * .7)} L ${f(x + 3.6 * k)} ${f(y)} Z" fill="${glow}" ${STROKE(shade(glow, -0.65), 1.3)}/><path d="M ${f(x - 3.6 * k)} ${f(y)} L ${f(x - 3 * k + tilt)} ${f(y - hh * .7)} L ${f(x + tilt)} ${f(y - hh)} L ${f(x)} ${f(y)} Z" fill="#fff" opacity=".35"/>`; }).join('');
      case 'sail': { const pts = xs(t4 ? 6 : 5, 0.0, 0.85), hs = pts.map((x, i) => [x, top(x) + 3, (10 + Math.sin(i / (pts.length - 1) * Math.PI) * 9) * k]);
        const mem = `M ${f(hs[0][0] - 3 * k)} ${f(hs[0][1])} ` + hs.map(([x, y, h]) => `L ${f(x)} ${f(y - h)}`).join(' ') + ` L ${f(hs[hs.length - 1][0] + 3 * k)} ${f(hs[hs.length - 1][1])} Z`;
        return `<path d="${mem}" fill="${shade(glow, -0.15)}" fill-opacity=".75" ${STROKE(dk, 1.4)}/>` + hs.map(([x, y, h]) => `<path d="M ${f(x)} ${f(y)} L ${f(x)} ${f(y - h)}" stroke="${dk}" stroke-width="1.6" stroke-linecap="round"/>`).join(''); }
      case 'bones': return xs(t4 ? 6 : 5, 0.0, 0.85).map((x, i) => { const y = top(x) + 2, r = (4.2 - i * .3) * k * .8;
        return `<path d="M ${f(x - r * .6)} ${f(y)} L ${f(x - r * .4)} ${f(y - r * 2.2)} L ${f(x + r * .4)} ${f(y - r * 2.2)} L ${f(x + r * .6)} ${f(y)} Z" fill="#e7dcc0" ${STROKE('#1a0f08', 1.2)}/><circle cx="${f(x)}" cy="${f(y - r * 2.4)}" r="${f(r * .75)}" fill="#f5efdf" ${STROKE('#1a0f08', 1.2)}/>`; }).join('');
      case 'flames': return xs(t4 ? 5 : 4, 0.02, 0.8).map((x, i) => { const y = top(x) + 4, hh = (i % 2 ? 11 : 15) * k * (1 - i * .05);
        return `<path d="M ${f(x - 4 * k)} ${f(y)} Q ${f(x - 5 * k)} ${f(y - hh * .6)} ${f(x + 2 * k)} ${f(y - hh)} Q ${f(x + 1 * k)} ${f(y - hh * .5)} ${f(x + 4.5 * k)} ${f(y)} Z" fill="url(#fw${id})" ${STROKE(shade(glow, -0.6), 1.1)}/>`; }).join('');
      case 'leaves': return xs(t4 ? 5 : 4, 0.0, 0.8).map((x, i) => { const y = top(x) + 3, hh = (12 - i) * k, d = i % 2 ? 1 : -1, c = i % 2 ? '#65a30d' : '#4d7c0f';
        return `<path d="M ${f(x)} ${f(y)} Q ${f(x + d * 7 * k)} ${f(y - hh * .6)} ${f(x + d * 3 * k)} ${f(y - hh)} Q ${f(x - d * 3 * k)} ${f(y - hh * .5)} ${f(x)} ${f(y)} Z" fill="${c}" ${STROKE('#1a2e05', 1.2)}/><path d="M ${f(x)} ${f(y)} Q ${f(x + d * 2 * k)} ${f(y - hh * .5)} ${f(x + d * 3 * k)} ${f(y - hh)}" stroke="#d9f99d" stroke-width=".9" fill="none" opacity=".7"/>`; }).join('');
      case 'quills': return xs(t4 ? 9 : 7, 0.0, 0.9).map((x, i) => { const y = top(x) + 3, L = (14 + (i % 3) * 3) * k, a = (-60 + i * 4) * Math.PI / 180;
        return `<path d="M ${f(x)} ${f(y)} L ${f(x + Math.cos(a) * L)} ${f(y + Math.sin(a) * L)}" stroke="${dk}" stroke-width="${f(2.8 * s)}" stroke-linecap="round"/><path d="M ${f(x)} ${f(y)} L ${f(x + Math.cos(a) * L * .96)} ${f(y + Math.sin(a) * L * .96)}" stroke="${i % 2 ? hornC : shade(skin, 0.3)}" stroke-width="${f(1.3 * s)}" stroke-linecap="round"/>`; }).join('');
      default: { const n = t4 ? 6 : 5; // púas
        return xs(n).map((x, i) => { const y = top(x) + 3, hh = (12 - i * 1.1) * k;
          return `<path d="M ${f(x - 4.5 * k)} ${f(y)} L ${f(x + 2 * k)} ${f(y - hh)} L ${f(x + 5.5 * k)} ${f(y)} Z" fill="${hornC}" ${STROKE(dk, 1.4)}/><path d="M ${f(x + 2 * k)} ${f(y - hh)} L ${f(x + 0.5 * k)} ${f(y - hh * 0.45)}" stroke="${dk}" stroke-width="1" opacity=".5"/>`; }).join(''); }
    }
  }
  /** Dibujo en la piel (dentro del recorte del cuerpo). */
  function patternSvg(kind, P, glow) {
    const { cx, cy, W, H, dk, s } = P;
    const glowLine = (d) => `<path d="${d}" stroke="${glow}" stroke-width="${f(3.4 * s)}" fill="none" opacity=".3" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${glow}" stroke-width="${f(1.3 * s)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    switch (kind) {
      case 'runes': return [[0.3, -0.25], [0.62, 0.05], [0.25, 0.3]].map(([ox, oy], i) => { const x = cx + W * ox, y = cy + H * oy, r = 3.4 * s;
        return glowLine([`M ${f(x)} ${f(y - r)} L ${f(x)} ${f(y + r)} M ${f(x)} ${f(y - r)} L ${f(x + r)} ${f(y - r * .3)} L ${f(x)} ${f(y + r * .2)}`, `M ${f(x - r)} ${f(y + r)} L ${f(x)} ${f(y - r)} L ${f(x + r)} ${f(y + r)} M ${f(x - r * .5)} ${f(y)} L ${f(x + r * .5)} ${f(y)}`, `M ${f(x - r)} ${f(y - r)} L ${f(x + r)} ${f(y + r)} M ${f(x + r)} ${f(y - r)} L ${f(x - r)} ${f(y + r)}`][i]); }).join('');
      case 'stripes': return [0.05, 0.3, 0.55, 0.8].map((o) => { const x = cx + W * o; return `<path d="M ${f(x - 3 * s)} ${f(cy - H * 1.1)} Q ${f(x + 5 * s)} ${f(cy - H * .5)} ${f(x - 1 * s)} ${f(cy + H * .05)}" stroke="${dk}" stroke-width="${f(3.2 * s)}" fill="none" opacity=".38" stroke-linecap="round"/>`; }).join('');
      case 'scales': { let o = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = cx + W * (0.12 + c * 0.2 + (r % 2) * 0.1), y = cy - H * (0.55 - r * 0.28), w = 3.6 * s; o += `<path d="M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * 1.3)} ${f(x + w)} ${f(y)}" stroke="${dk}" stroke-width="1.2" fill="none" opacity=".4"/>`; } return o; }
      case 'cracks': return glowLine(`M ${f(cx + W * .1)} ${f(cy - H * .8)} L ${f(cx + W * .2)} ${f(cy - H * .45)} L ${f(cx + W * .1)} ${f(cy - H * .2)} L ${f(cx + W * .28)} ${f(cy + H * .1)} M ${f(cx + W * .2)} ${f(cy - H * .45)} L ${f(cx + W * .45)} ${f(cy - H * .38)} L ${f(cx + W * .6)} ${f(cy - H * .55)} M ${f(cx + W * .45)} ${f(cy - H * .38)} L ${f(cx + W * .55)} ${f(cy - H * .05)}`);
    }
    return '';
  }
  /** Extra de la 4.ª forma: capa y círculo (detrás) · orbes, humo, hombrera y brasas (delante). */
  function extraSvg(kind, P, layer, glow) {
    const { cx, cy, W, H, s, dk, groundY, house } = P;
    const anim = (attr, vals, dur) => `<animate attributeName="${attr}" values="${vals}" dur="${dur}s" repeatCount="indefinite"/>`;
    if (layer === 'back') {
      if (kind === 'cape') { const c = CAPE[house] || '#3b0d1c', x0 = cx - W * 0.35, y0 = cy - H * 0.55, x1 = cx + W * 0.4, y1 = cy - H * 0.7;
        const d = `M ${f(x0)} ${f(y0)} Q ${f(cx)} ${f(y1 - 4 * s)} ${f(x1)} ${f(y1)} Q ${f(cx + W * 1.2)} ${f(cy)} ${f(cx + W * 1.35)} ${f(groundY - 2)} Q ${f(cx + W * 1.1)} ${f(groundY - 7)} ${f(cx + W * .9)} ${f(groundY - 1)} Q ${f(cx + W * .6)} ${f(groundY - 6)} ${f(cx + W * .3)} ${f(groundY - 2)} Q ${f(cx)} ${f(cy + H * .3)} ${f(x0)} ${f(y0)} Z`;
        return `<path d="${d}" fill="${c}" ${STROKE('#0b0604', 1.8)}/><path d="M ${f(x1)} ${f(y1)} Q ${f(cx + W * 1.2)} ${f(cy)} ${f(cx + W * 1.35)} ${f(groundY - 2)}" stroke="#f6c343" stroke-width="1.6" fill="none" opacity=".85"/><path d="M ${f(cx + W * .55)} ${f(cy - H * .4)} Q ${f(cx + W * .8)} ${f(cy + H * .2)} ${f(cx + W * .75)} ${f(groundY - 4)}" stroke="#000" stroke-width="1.4" fill="none" opacity=".3"/>`; }
      if (kind === 'runeCircle') { const rx = W * 1.55, ry = 7 + W * 0.05;
        return `<ellipse cx="${f(cx)}" cy="${groundY + 1}" rx="${f(rx)}" ry="${f(ry)}" fill="${glow}" opacity=".14"/><ellipse cx="${f(cx)}" cy="${groundY + 1}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${glow}" stroke-width="1.6" stroke-dasharray="5 3" opacity=".9">${anim('stroke-dashoffset', '0;16', 1.6)}</ellipse><ellipse cx="${f(cx)}" cy="${groundY + 1}" rx="${f(rx * .72)}" ry="${f(ry * .7)}" fill="none" stroke="${glow}" stroke-width="1" opacity=".6"/>`; }
      if (kind === 'wisps') return [-0.7, -0.1, 0.5, 1.0].map((o, i) => { const x = cx + W * o, y = cy - H * (0.2 + (i % 2) * 0.3);
        return `<path d="M ${f(x)} ${f(y + 8 * s)} Q ${f(x - 6 * s)} ${f(y - 4 * s)} ${f(x + 2 * s)} ${f(y - 14 * s)} Q ${f(x + 8 * s)} ${f(y - 22 * s)} ${f(x + 1 * s)} ${f(y - 30 * s)}" stroke="${house === 'oscuridad' ? '#2e1065' : glow}" stroke-width="${f(4 * s)}" fill="none" stroke-linecap="round" opacity=".45">${anim('opacity', '.15;.55;.15', 2.4 + i * .5)}</path>`; }).join('');
      return '';
    }
    if (kind === 'orbs') return [[-1.15, -1.0], [1.2, -0.95], [1.35, -0.1]].map(([ox, oy], i) => { const x = cx + W * ox, y = cy + H * oy, r = 3.2 * s;
      return `<g><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.1)}" fill="${glow}" opacity=".28"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${glow}" ${STROKE(shade(glow, -0.6), 1)}/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .35)}" r="${f(r * .35)}" fill="#fff"/><animateTransform attributeName="transform" type="translate" values="0 0;0 ${f(-3 * s)};0 0" dur="${2.2 + i * .4}s" repeatCount="indefinite"/></g>`; }).join('');
    if (kind === 'pauldron') { const x = cx + W * 0.12, y = cy - H * 0.42, r = W * 0.36;
      return `<path d="M ${f(x - r)} ${f(y + r * .35)} Q ${f(x - r)} ${f(y - r * .7)} ${f(x)} ${f(y - r * .75)} Q ${f(x + r)} ${f(y - r * .7)} ${f(x + r)} ${f(y + r * .35)} Q ${f(x)} ${f(y + r * .05)} ${f(x - r)} ${f(y + r * .35)} Z" fill="#94a3b8" ${STROKE('#0f172a', 1.8)}/>` +
        `<path d="M ${f(x - r * .7)} ${f(y - r * .1)} Q ${f(x)} ${f(y - r * .55)} ${f(x + r * .7)} ${f(y - r * .1)}" stroke="#f8fafc" stroke-width="1.4" fill="none" opacity=".6"/><path d="M ${f(x - r * .2)} ${f(y - r * .72)} L ${f(x)} ${f(y - r * 1.25)} L ${f(x + r * .2)} ${f(y - r * .72)} Z" fill="#cbd5e1" ${STROKE('#0f172a', 1.2)}/>` +
        [-0.6, 0, 0.6].map((o) => `<circle cx="${f(x + r * o)}" cy="${f(y + r * (o ? .12 : .02))}" r="${f(1.3 * s)}" fill="${glow}"/>`).join(''); }
    if (kind === 'embers') return Array.from({ length: 7 }, (_, i) => { const x = cx + W * (-1.2 + i * 0.42), y = cy - H * (0.3 + (i % 3) * 0.35), r = (1.2 + (i % 2) * .6) * s;
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${glow}">${anim('opacity', '0;1;0', 1.6 + (i % 4) * .4)}${anim('cy', `${f(y)};${f(y - 10 * s)}`, 1.6 + (i % 4) * .4)}</circle>`; }).join('');
    return '';
  }

  function draw(ind, st, o = {}) {
    const id = 'lk' + (++SEQ), H_ = HOUSES[ind.house] || HOUSES.luz;
    const tier = o.tier || 0, boss = !!o.boss;
    const grow = GROWTH[st] * ind.size * (st === 0 ? ind.baby : 1) * (boss ? Math.max(1.2, 1.62 / GROWTH[st]) : tier === 4 ? 1.2 : tier === 3 ? 1.12 : 1), s = clamp(0.85 + (grow - 1) * 0.55, 0.62, tier ? 1.45 : 1.25); // v5.12: los jefes, siempre de tamaño de forma final grande
    const kind = ind.bodyFixed || (ind.path && ind.path[st]) || (BODY_PATH[ind.body] || BODY_PATH.round)[st];
    const legKind = ind.legs === 'slither' ? 'none' : ind.legs === 'hover' ? 'hover' : (ALL_LEGS[ind.legs] ? ALL_LEGS[ind.legs][0][st] : ['stubby', 'paws', 'quad', 'quad'][st]);
    const Pm = PRESET[kind] || PRESET.round;
    const W = clamp(23 * grow * Pm.w, 11, boss ? 60 : tier ? 54 : 47), H = clamp(21 * grow * Pm.h, 10, boss ? 52 : tier ? 47 : 41);
    const groundY = 112, lift = LIFT[legKind] || 0;
    const cx = kind === 'long' ? 60 : 70, cy = groundY - H * (kind === 'ghost' ? 1.1 : 1) - lift - (kind === 'ghost' ? 6 : 0);
    const skin = shade(o.shiny ? hue(ind.skin, 150) : ind.skin, tier === 4 ? -0.16 : tier === 3 ? -0.08 : 0), dk = shade(skin, tier === 4 ? -0.68 : -0.58), inner = H_.belly, hornC = ind.house2 ? HOUSES[ind.house2].horn : H_.horn;
    const skin2 = ind.skin2 ? (o.shiny ? hue(ind.skin2, 150) : ind.skin2) : null; // v4.71: color de la segunda casa
    const top = (x) => { const u = clamp((x - cx) / W, -0.98, 0.98); return cy - H * Math.pow(1 - Math.pow(Math.abs(u), Pm.n || 2), 1 / (Pm.n || 2)) * (1 + (Pm.pear || 0) * -0.1); };
    const fx = cx - W * 0.3, er = clamp(W * 0.16, 3.6, 7) * ind.eyeScale;
    const ey = cy - H * 0.22, mx = fx + 0.5, my = ey + er * 1.6 + 2;
    const P = { id, cx, cy, W, H, skin, skin2, dk, inner, hornC, house: ind.house, house2: ind.house2, stage: st, s, fx, ey, er, mx, my, top, groundY, kind };
    const bo = {}, body = bodyPath(kind, cx, cy, W, H, ind, bo);
    if (Pm.hull && bo.pts) P.top = hullTop(bo.pts); // v5.14: siluetas irregulares → el borde real
    if (bo.pts && !ind.arch && !['ghost', 'long'].includes(kind)) P.bottom = hullBottom(bo.pts);
    if (bo.pts) P.pts = bo.pts; // v5.19: el borde del cuerpo, para encajar accesorios (auriculares) // v5.15: las patas salen del borde real
    const plain = !!o.plain;
    const fur = plain ? { back: '', clip: '' } : furSvg(ind, P);
    // v5.12b: piezas según su «regalía» (cada individuo tira las suyas, sesgadas por su casa)
    const reg = !plain && tier >= 3 ? regalia(ind) : null, glow = reg ? reg.glow : null;
    // v5.19: si ya tiene sus propias alas (de nacimiento, alitas en la cabeza o brazos de plumas), no le salen otras encima
    const ownWings = (ind.winged && (o.final || o.wingsIcon)) || ind.ears === 'headwings' || ind.arms === 'wingarm';
    const epic = ownWings ? null : reg && tier === 4 && reg.wings !== 'none' ? reg.wings : reg && tier === 3 && reg.wings3 && reg.wings3 !== 'none' ? reg.wings3 : null;
    const wings = epic ? epicWingsSvg(epic, P, 'back', glow, tier === 3 ? 0.62 : 1) : (!plain || o.wingsIcon) && ind.winged && (o.final || o.wingsIcon) ? wingsSvg(ind, P) : '';
    const spikes = reg && kind !== 'ghost' && !ind.arch ? backSvg(reg.back, P, tier, glow) : '';
    const headK = reg ? (tier === 4 ? reg.head4 : reg.head3) : null, headOk = headK && !(ind.arch && HORNY.has(headK));
    const horns = headOk ? headSvg(headK, P, tier, 'mid', glow) : '', headTop = headOk ? headSvg(headK, P, tier, 'top', glow) : '';
    const extra = reg && tier === 4 ? reg.extra : null;
    const auraC = reg && tier === 4 ? (EPIC[epic] && EPIC[epic].aura) || glow : null;
    const auraT = auraC ? `<ellipse cx="${f(cx)}" cy="${f(cy - H * 0.2)}" rx="${f(W * 2)}" ry="${f(H * 1.9)}" fill="url(#ea${id})"/>` : '';
    const patt = reg && reg.pattern !== 'none' && (tier === 4 || (reg.pattern !== 'cracks' && reg.pattern !== 'runes')) ? patternSvg(reg.pattern, P, glow) : '';
    const isFinal = !!o.final;
    const segs = kind === 'long' ? [[0.95, 0.66, 0.2], [1.45, 0.48, 0.38]].map(([ox, r, oy]) => `<ellipse cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" rx="${f(H * r * 1.15)}" ry="${f(H * r)}" fill="${skin2 || `url(#b${id})`}" ${STROKE(dk)}/><ellipse cx="${f(cx + W * ox - 2)}" cy="${f(cy + H * oy + H * r * 0.35)}" rx="${f(H * r * 0.6)}" ry="${f(H * r * 0.32)}" fill="${inner}" opacity=".8"/>`).reverse().join('') : '';
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
        let side = Math.max(VIEW_SIDE[st], boss ? 150 : 0) + (tier === 4 ? 30 : tier === 3 ? 8 : 0);
        const extraTop = (ind.ears && ind.ears !== 'none' ? 16 : 6) * s + (tier === 4 ? 46 * s : tier === 3 ? 10 * s : 0) + (o.final ? ({ crown: 8, halo: 8, thorns: 8, tophat: 16, wizard: 18, beanie: 8, headphones: 6 })[ind.final] || 0 : 0) + (ind.hair === 'afro' || ind.hair === 'bun' ? 6 : 0);
        // v5.15: las alas grandes llegan hasta ~92·s por encima del hombro: la caja crece hasta que quepan
        const wingTop = epic ? cy - H * 0.45 - (tier === 3 ? 58 : 92) * s : Infinity;
        const cTop = Math.min(cy - H - extraTop, wingTop), cBot = groundY + 6, cH = cBot - cTop;
        if (epic && cH + 6 > side) side = cH + 6;
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
      (ind.grad && !skin2 ? (() => { const g = GRAD_DIRS[ind.grad.dir] || GRAD_DIRS.down, gc = o.shiny ? hue(ind.grad.c, 150) : ind.grad.c; return `<linearGradient id="g8${id}" x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}"><stop offset="${f(ind.grad.at)}" stop-color="${gc}" stop-opacity="0"/><stop offset="${f(Math.min(0.95, ind.grad.at + 0.4))}" stop-color="${gc}" stop-opacity=".8"/><stop offset="1" stop-color="${shade(gc, -0.15)}" stop-opacity=".95"/></linearGradient>`; })() : '') +
      (skin2 ? `<linearGradient id="d2${id}" x1="0" y1="0.15" x2="1" y2="0.45"><stop offset="${f(ind.split)}" stop-color="${skin2}" stop-opacity="0"/><stop offset="${f(ind.split + 0.1)}" stop-color="${skin2}" stop-opacity=".95"/><stop offset="1" stop-color="${shade(skin2, -0.25)}" stop-opacity="1"/></linearGradient>` : '') +
      (auraC ? `<radialGradient id="ea${id}"><stop offset="35%" stop-color="${auraC}" stop-opacity=".45"/><stop offset="100%" stop-color="${auraC}" stop-opacity="0"/></radialGradient>` : '') +
      (glow ? `<linearGradient id="fw${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${shade(glow, -0.45)}"/><stop offset=".55" stop-color="${glow}"/><stop offset="1" stop-color="#fffbe8"/></linearGradient>` : '') +
      `<clipPath id="c${id}"><path d="${body}"/></clipPath></defs>` +
      `<g ${flip}><g class="sprite-body">` +
      (o.focus ? '' : `<ellipse class="sprite-shadow" cx="${f(cx + (kind === 'long' ? W * 0.5 : 0))}" cy="${groundY + 1}" rx="${f(shadowRx)}" ry="5" fill="#000" opacity="${legKind === 'hover' ? 0.12 : 0.22}"/>`) +
      (isFinal ? finalSvg(ind, P, 'back') : '') + auraT + (extra ? extraSvg(extra, P, 'back', glow) : '') +
      `<g transform="rotate(${f(ind.lean * 10)} ${f(cx)} ${groundY})">` +
      (plain || ['dino', 'scorpion', 'beast'].includes(ind.arch) ? '' : tailSvg(o.tail, skin2 ? Object.assign({}, P, { skin: skin2 }) : P)) + archSvg(ind, P, 'back') + wings + spikes + fur.back + hairSvg(ind, P, 'back') + earsSvg(ind, P, false) + segs +
      legsSvg(legKind, P, 'far') + (plain ? '' : armSvg(ind, P, 'far')) +
      `<path d="${body}" fill="url(#b${id})"/>` +
      `<g clip-path="url(#c${id})">${skin2 ? `<path d="${body}" fill="url(#d2${id})"/>` : ''}${ind.grad && !skin2 ? `<path d="${body}" fill="url(#g8${id})"/>` : ''}${belly}${fur.clip}${markSvg(ind, P)}${patt}<path d="${body}" fill="url(#ao${id})"/><ellipse cx="${f(cx - W * 0.35)}" cy="${f(cy - H * 0.55)}" rx="${f(W * 0.42)}" ry="${f(H * 0.28)}" fill="url(#hl${id})"/></g>` +
      `<path d="${body}" fill="none" ${STROKE(dk, 2.4)}/>` +
      (ind.arch === 'scorpion' ? [0.15, 0.45, 0.75].map((o) => `<path d="M ${f(cx + W * o)} ${f(top(cx + W * o) + 1.5)} Q ${f(cx + W * (o + 0.12))} ${f(cy)} ${f(cx + W * o)} ${f(cy + H * 0.9)}" fill="none" stroke="${dk}" stroke-width="1.4" opacity=".55"/>`).join('') : '') +
      archSvg(ind, P, 'front') +
      legsSvg(legKind, P, 'near') + (plain ? '' : armSvg(ind, P, 'near')) + shinyMark + earsSvg(ind, P, true) + horns + (extra ? extraSvg(extra, P, 'front', glow) : '') +
      hairSvg(ind, P, 'front') + headTop + (o.blink ? blinkSvg(ind, P) : eyesSvg(ind, P)) + cheeks + mouthSvg(ind, P) + (isFinal ? finalSvg(ind, P, 'front') : '') +
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
  /**
   * v4.71: doble casa. Sobre el aspecto de su casa principal, la segunda pone su color (la mitad trasera
   * del cuerpo en degradado, el pelo, los cuernos y las manos) y a veces sus orejas u ojos típicos.
   */
  function withHouse2(r, h2) {
    const H2 = HOUSES[h2]; if (!H2 || h2 === r.house) return r;
    const R7 = rng((r.seed >>> 0) ^ 0x48325b1d), B2 = HOUSE_BIAS[h2] || {};
    const o = Object.assign({}, r, { house2: h2 });
    o.skin2 = hue(H2.skins[Math.floor(R7() * H2.skins.length)], Math.round(R7() * 14 - 7));
    o.hairColor = R7() < 0.7 ? shade(o.skin2, -0.12) : r.hairColor;
    if (B2.ears && R7() < 0.45) o.ears = pick(Object.fromEntries(Object.keys(B2.ears).filter((k) => EARS[k]).map((k) => [k, B2.ears[k]])), R7); else R7();
    if (B2.eyes && R7() < 0.3) o.eyes = pick(Object.fromEntries(Object.keys(B2.eyes).filter((k) => EYES[k]).map((k) => [k, B2.eyes[k]])), R7); else R7();
    o.split = 0.42 + R7() * 0.2; // dónde empieza el color de la segunda casa (de delante a atrás)
    return o;
  }
  function ind(sid, look) {
    const sp = D.species[sid], root = rootOf(sid);
    const seed = look && look.s != null ? look.s >>> 0 : hash('typ:' + root);
    const h2 = look && look.h2 && HOUSES[look.h2] && look.h2 !== sp.house ? look.h2 : null;
    const key = root + ':' + seed + (h2 ? ':' + h2 : '');
    if (indCache.has(key)) return indCache.get(key);
    const r = roll(sp.house || 'luz', seed);
    // La especie fija su cola y, en algunas, el cuerpo (fantasmas, serpientes sin patas)
    const sprite = (D.species[root] && D.species[root].sprite) || sp.sprite || {};
    r.tail = sprite.tail || 'none';
    if (sprite.arch && ARCH[sprite.arch]) applyArch(r, sprite.arch); // v4.96: especies con silueta fija
    else if (sprite.body === 'ghost') { r.body = 'ghost'; r.legs = 'hover'; r.arch = null; } // v4.96b: sin silueta (salía la cola de dinosaurio en un fantasma)
    else if (sprite.body === 'long' && sprite.legs === 'none') { r.body = 'long'; r.legs = 'slither'; r.arch = null; }
    if (isNew7(seed) || sprite.arch) harmonize(r);
    evolveBody(r, root, sprite);
    const out = h2 ? withHouse2(r, h2) : r;
    if (indCache.size > 600) indCache.clear();
    indCache.set(key, out);
    return out;
  }
  /**
   * v5.14: cuerpos más variados.
   *  · Firma de la especie: cada línea evolutiva tiene una silueta propia; los aspectos nuevos (NEW8) la llevan
   *    la mitad de las veces, para que las especies se distingan más entre sí.
   *  · Cuerpos que cambian al madurar: la 3.ª y la 4.ª etapa pueden tomar una silueta distinta (con más carácter:
   *    jorobado, bruto, rocoso, cometa…) en vez de acabar todas en «rechoncho» o «achaparrado».
   *  Los fantasmas, los alargados y las siluetas fijas (dinosaurio, escorpión…) no cambian.
   */
  function evolveBody(r, root, sprite) {
    if (r.arch || r.bodyFixed || ['ghost', 'long'].includes(r.body)) return r;
    const SR = rng(hash('sig:' + root)), sigBody = pick(SIG_POOL, SR), sigMature = pick(MATURE, SR), sigLate = pick(MATURE_LATE, SR);
    const R = rng(((r.seed >>> 0) ^ 0x6d2b79f5) >>> 0);
    for (let i = 0; i < 3; i++) R();
    if (isNew8(r.seed)) {
      r.body0 = r.body; // (el nombre automático sale del cuerpo original: no cambia)
      const z = R();
      if (z < 0.5) r.body = sigBody; else if (z < 0.72) r.body = pick(BODIES9, R); else R();
      if (r.legs === 'raptor' && !RAPTOR_OK.has(r.body) && !BODIES9[r.body]) r.legs = 'talon';
      if (BODY_LEGS[r.body] && !BODY_LEGS[r.body][r.legs] && ['heart', 'star5', 'kite'].includes(r.body)) r.legs = pick(BODY_LEGS[r.body], R); else R();
    } else { R(); R(); }
    const base = BODY_PATH[r.body] || BODY_PATH.round, path = base.slice();
    const sameLine = R() < 0.5; // la mitad sigue la madurez típica de su especie
    const m = R();
    if (m < 0.7) path[2] = sameLine ? sigMature : pick(MATURE, R); else R();
    const l = R();
    if (l < 0.75) path[3] = l < 0.25 ? path[2] : sameLine ? sigLate : pick(MATURE_LATE, R); else R();
    r.path = path;
    return r;
  }
  /** Aspecto nuevo al nacer (los jefes: el típico). */
  // v4.56: las semillas nuevas llevan la marca NEW3 en su byte bajo (pueden tener los rasgos nuevos)
  function rollLook(sid, o = {}) { return o.boss ? null : { s: ((Math.floor(Math.random() * 16777216) << 8) | NEW9_TAG) >>> 0 }; }
  /** Aspecto de un daskai (las partidas antiguas: sale fijo de su uid). */
  function lookOf(d, form) {
    if (!d) return null;
    if (d.boss || d.legendary) return d.house2 ? { h2: d.house2, boss: 1 } : { boss: 1 }; // v5.18: un legendario que se une se ve como cuando lo venciste // v4.71: jefe de doble casa → su aspecto típico con los colores de las dos · v5.12: imponente
    if (!d.look) d.look = { s: hash('uid:' + (d.uid || d.species)) };
    // Con formas (v4.51) la etapa del dibujo sale de su forma, no de la especie
    const v = DK.daskai && DK.daskai.visual ? DK.daskai.visual(d, form) : null;
    // v5.12: tot = cuántas formas tiene su línea (las 3.ª y 4.ª evoluciones se dibujan más grandes e imponentes)
    const tot = DK.daskai && DK.daskai.formsOf ? DK.daskai.formsOf(d).total : 0;
    const out = v ? { s: d.look.s, st: v.st, fin: v.final, tot } : Object.assign({}, d.look, { tot });
    return d.house2 ? Object.assign({}, out, { h2: d.house2 }) : out;
  }
  /** SVG para la interfaz. */
  function svg(sid, look, { flip = false, shiny = false, blink = false } = {}) {
    const g = stageOf(sid), i = ind(sid, look);
    const st = look && look.st != null ? look.st : g.st, fin = look && look.fin != null ? look.fin : g.final;
    return draw(i, st, { tail: i.tail, final: fin, flip, shiny, blink, tier: tierOf(look, st, fin, g), boss: !!(look && look.boss) });
  }
  /**
   * v5.12: «rango» del dibujo. 4 = forma final de una línea de 4 formas (o un jefe): alas especiales (ángel,
   * dragón o demonio), cuernos y aura · 3 = 3.ª forma de una línea de 4, o la final de una de 3: más grande,
   * púas en el lomo y más oscuro · 0 = el resto (sin cambios).
   */
  function tierOf(look, st, fin, g) {
    if (look && look.boss) return 4;
    const tot = (look && look.tot) || (g && g.length) || 0;
    if (tot >= 4 && fin) return 4;
    if ((tot >= 4 && st >= 2) || (tot === 3 && fin)) return 3;
    return 0;
  }
  /** v5.4: ¿puede parpadear? (sus ojos están abiertos de base) */
  function canBlink(sid, look) { try { return BLINK.has(ind(sid, look).eyes); } catch (e) { return false; } }

  /* ---------- Pixel art (bordes duros, pocos colores, contorno) ---------- */
  const PAD = 0.25, PIX_H = 64, PIX_W = Math.round(PIX_H * (1 + PAD * 2)), LEVELS = 8;
  const pxCache = new Map(), pxPending = new Map();
  const pxKey = (sid, look, shiny, blink) => sid + ':' + (look && look.s != null ? look.s : 't') + (look && look.h2 ? '/' + look.h2 : '') + (look && look.boss ? 'B' : '') + (look && look.tot ? 'T' + look.tot : '') + (look && look.st != null ? '@' + look.st + (look.fin ? 'f' : '') : '') + (shiny ? '*' : '') + (blink ? '~' : '');
  function pixelCached(sid, look, { shiny = false, blink = false } = {}) { return pxCache.get(pxKey(sid, look, shiny, blink)) || null; }
  function pixel(sid, look, { shiny = false, blink = false } = {}) {
    const key = pxKey(sid, look, shiny, blink);
    if (pxCache.has(key)) return Promise.resolve(pxCache.get(key));
    if (pxPending.has(key)) return pxPending.get(key);
    let text = svg(sid, look, { shiny, blink });
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
  const CATS = { hair: Object.fromEntries(Object.entries(HAIR).filter(([k]) => k !== 'none')), wings: WINGS, body: ALL.body, legs: Object.fromEntries(Object.entries(ALL_LEGS).map(([k, v]) => [k, v[1]])), eyes: ALL.eyes, mouth: ALL.mouth, ears: ALL.ears, mark: ALL.mark, final: Object.assign({}, FINALS, FINALS4, FINALS5, FINALS9), arms: Object.fromEntries(Object.entries(ARMS_ALL).filter(([k]) => k !== 'none')), arch: { dino: 1, scorpion: 1, beast: 1, shell: 1 } };
  const CAT_ICON = { arch: 'paw', arms: 'hand', hair: 'sparkles', wings: 'feather', size: 'maximize', body: 'paw', legs: 'footprints', eyes: 'eye', mouth: 'smile', ears: 'sparkles', mark: 'star', final: 'crown' };
  const sizeKey = (z) => (z < 0.76 ? 'xxs' : z < 0.86 ? 'xs' : z < 0.95 ? 's' : z <= 1.06 ? 'm' : z <= 1.15 ? 'l' : z <= 1.24 ? 'xl' : 'xxl');
  /** Rasgos de un individuo, para pintarlos como iconos. */
  function traits(i, { final = true } = {}) {
    const out = [{ cat: 'size', key: sizeKey(i.size), rare: i.size > 1.18 || i.size < 0.82 }];
    if (i.arch) out.push({ cat: 'arch', key: i.arch, rare: true }); // v4.96: silueta
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
      case 'arch': out = draw(applyArch(Object.assign(t, { eyes: 'sharp' }), key), 2, { focus: 'full', plain: false }); break;
      case 'wings': out = draw(Object.assign(t, { winged: true, eyes: 'dot', house: WING_HOUSE[key] || 'luz', skin: (HOUSES[WING_HOUSE[key]] || HOUSES.luz).skins[0] }), 2, { focus: 'full', plain: true, wingsIcon: true }); break;
      case 'size': { const z = { xxs: 0.34, xs: 0.45, s: 0.6, m: 0.75, l: 0.88, xl: 1, xxl: 1.1 }[key] || 0.75; out = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 22h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/><ellipse cx="12" cy="${f(21 - 9 * z)}" rx="${f(10 * z)}" ry="${f(9 * z)}" fill="currentColor" opacity=".85"/><circle cx="${f(12 - 4 * z)}" cy="${f(19 - 11 * z)}" r="${f(1.3 * z + 0.5)}" fill="#0b0a12"/></svg>`; break; }
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
    const cats = ['arch', 'body', 'legs', 'arms', 'eyes', 'mouth', 'ears', 'hair', 'mark', 'final', 'wings'];
    const list = cats.map((cat) => ({ cat, keys: allKeys(cat).map((key) => ({ key, seen: traitSeen(cat, key), rare: rare(CATS[cat], key) })) }));
    const total = list.reduce((a, c) => a + c.keys.length, 0), got = list.reduce((a, c) => a + c.keys.filter((k) => k.seen).length, 0);
    return { list, total, got };
  }
  /** Texto del rasgo para el tooltip: «Ojos: de gato». */
  function label(cat, key) {
    const t = DK.t;
    return `${t('look.cat.' + cat)}: ${t(`look.${cat}.${key}`)}`;
  }

  /**
   * v4.73: el dibujo como imagen para pintarlo en un <canvas> (tarjeta para compartir, favicon, iconos).
   * Igual que en pantalla: pixel art si el ajuste «pixelArt» está activo (o pixel: true/false).
   * @returns {Promise<{img: HTMLCanvasElement, w: number, h: number, pixel: boolean}|null>}
   *   recortado a lo que ocupa el dibujo; w/h: su tamaño (para encajarlo sin deformar)
   */
  function image(sid, look, { shiny = false, pixel: px } = {}) {
    const usePx = px != null ? px : DK.settings.get('pixelArt') !== false;
    const load = (src) => new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
    // El dibujo trae mucho margen (sitio para todas sus formas): se recorta a lo que ocupa de verdad
    const trim = (im, W, H, isPx) => {
      if (!im) return null;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      try {
        const a = g.getImageData(0, 0, W, H).data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      } catch (e) { return { img: im, w: W, h: H, pixel: isPx }; }
      if (x1 < 0) return null;
      const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return { img: out, w: out.width, h: out.height, pixel: isPx };
    };
    if (usePx) return pixel(sid, look, { shiny }).then((url) => url ? load(url).then((im) => trim(im, PIX_W, PIX_H, true)) : null);
    const text = svg(sid, look, { shiny });
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(text);
    const W = m ? Math.round(512 * +m[3] / +m[4]) : 512;
    // Tamaño explícito para que el navegador lo rasterice nítido
    const sized = m ? text.replace(m[0], m[0] + ` width="${W}" height="512"`) : text;
    return load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized)).then((im) => trim(im, W, 512, false));
  }
  /** Pinta la imagen de image() encajada en la caja (x, y, w, h), centrada y apoyada abajo si foot. */
  function paint(ctx, pic, x, y, w, h, { foot = false } = {}) {
    if (!pic) return;
    const k = Math.min(w / pic.w, h / pic.h), dw = pic.w * k, dh = pic.h * k;
    ctx.save(); ctx.imageSmoothingEnabled = !pic.pixel;
    ctx.drawImage(pic.img, x + (w - dw) / 2, foot ? y + h - dh : y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }

  DK.looks = {
    image, paint,
    rarityScore, isFresh, freshCount, clearFresh,
    svg, pixel, pixelCached, canBlink, ind, regalia, stageOf, lineOf, rootOf, rollLook, of: lookOf, see, seenOf, traitSeen, collection, traits, icon, label,
    typical: (sid) => ind(sid, null), houses: HOUSES, rng, catIcon: CAT_ICON, allKeys, draw, hash,
    /** Para pruebas: genera el aspecto de una casa con una semilla. */
    roll,
  };
})();
