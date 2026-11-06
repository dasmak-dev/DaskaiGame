/* =============================================================
 * systems/names.js — Nombre propio de cada daskai (DK.names, v4.54).
 *
 * Cada daskai nace con un nombre suyo, sacado de su aspecto
 * (systems/looks.js) con sílabas que encajan entre sí:
 *
 *   [inicio de su CASA] + [sílaba de un RASGO llamativo] + [final de su CUERPO]
 *      Lu (luz)        +   ste (ojos de estrella)       +   bo (cuerpo redondo)  → «Lustebo»
 *
 *   · El rasgo se elige entre ojos, orejas, marca, boca y pelo; los raros
 *     ganan casi siempre (y siempre salen). Los corrientes, sólo a veces.
 *   · El tamaño cambia el final: pequeñito → «-ín», enorme → «-ón».
 *   · Es estable: sale de la semilla del aspecto, no cambia al evolucionar,
 *     y se guarda en d.gname la primera vez.
 *   · El apodo (d.nickname) manda sobre él; los jefes y los daskai sin
 *     aspecto usan el nombre de su especie.
 *
 * DK.names.of(d) → nombre propio o null · DK.names.make(ind) → nombre de un aspecto.
 * ============================================================= */
(function () {
  const D = DK.data;

  // Sílabas de inicio de cada casa (acaban en vocal)
  const HOUSE = {
    luz: ['Lu', 'So', 'Au', 'Cla', 'Fe', 'Bri', 'Ce', 'Ra', 'Seli', 'Albi', 'Iri', 'Dora'],
    oscuridad: ['No', 'Ve', 'Ny', 'Mo', 'Za', 'Gri', 'Ume', 'Sa', 'Noxi', 'Mala', 'Escu', 'Vela'],
    fuego: ['Py', 'Bra', 'Fla', 'Ca', 'Ru', 'Vo', 'Che', 'Ti', 'Igna', 'Cha', 'Ascu', 'Pyra'],
    agua: ['Ma', 'Ne', 'Co', 'Hi', 'Bu', 'Na', 'Ri', 'Oa', 'Mare', 'Ondi', 'Peli', 'Aqua'],
    tierra: ['Te', 'Ro', 'Gle', 'Mu', 'Ba', 'Tu', 'Gra', 'Bo', 'Gea', 'Rupi', 'Musgo', 'Tro'],
  };
  // v4.62: prefijos que a veces van delante (por un rasgo de carácter) y sufijos que a veces cierran el nombre
  const PREFIX = { arms: { pincer: 'Kra', long: 'Lan', noodle: 'Fi', mitten: 'Pom', stubby: 'Pi' }, final: { cape: 'Sir', flowercrown: 'Flor', goggles: 'Avi', collar: 'Bru', bandana: 'Ban', crown: 'Rey', halo: 'Sa' } };
  const SUFFIX = { luz: ['el', 'ia', 'ino'], oscuridad: ['ix', 'os', 'ra'], fuego: ['ax', 'or', 'ito'], agua: ['ina', 'eo', 'is'], tierra: ['ok', 'ur', 'ote'] };
  // Sílaba de un rasgo (empiezan por consonante)
  const TRAIT = {
    eyes: { big: 'mi', sharp: 'ri', slit: 'si', sleepy: 'mu', happy: 'pi', glow: 'lu', dot: 'ti', angry: 'gru', star: 'ste', button: 'bo', uneven: 'tu', cyclops: 'mon', three: 'tri', visor: 'vi', spiral: 'gi', heart: 'cor', wink: 'gui', anime: 'ki', halflid: 'pa', sparkle: 'chis', crescent: 'lu', squint: 'gui', bug: 'zum', ringed: 'ri', crosseye: 'cru', teary: 'la', robot: 'tron', lashes: 'pes', diamond: 'dia' },
    ears: { cat: 'mi', bunny: 'co', bear: 'bo', droopy: 'do', horns: 'cor', unicorn: 'ni', antenna: 'te', crest: 'cre', sprout: 'bro', fins: 'ma', spikes: 'pu', tuft: 'pe', antlers: 'cer', ram: 'ca', mushroom: 'se', flower: 'flo', mohawk: 'cres', elf: 'le', mouse: 'ra', headwings: 've', trihorn: 'tri', lynx: 'lin', leafy: 'fo', plume: 'plu', devil: 'dia', bow: 'la', crystals: 'cris' },
    mark: { star: 'sta', moon: 'lu', heart: 'co', spots: 'pin', stripes: 'ra', zigzag: 'zi', gem: 'ge', freckles: 'pe', patch: 'pa', band: 'ba', swirl: 'ri', blaze: 'fla', bolt: 'zas', chevron: 'ga', ring: 'ro', bloom: 'flo', triad: 'tri' },
    mouth: { fangs: 'dra', tusks: 'co', beak: 'pi', tongue: 'le', mustache: 'bi', sabre: 'sa', grin: 'ri', jagged: 'cra', bubble: 'bu', buck: 'ro', oh: 'lo', biggrin: 'ji', stitch: 'co', toothy: 'dien', gaptooth: 'me', drool: 'ba', whistle: 'fi', vampire: 'vam', zipper: 'zip', catmouth: 'mia', lips: 'bes', frown: 'gru' },
    hair: { spiky: 'pu', curl: 'ri', beard: 'bar', ponytail: 'co', fringe: 'fle', cheektufts: 'pe', bun: 'mo', afro: 'fro', swoop: 'tu', braids: 'tren', quiff: 'co' },
  };
  // Final según la forma del cuerpo (dos opciones)
  const BODY = {
    round: ['bo', 'bi'], chubby: ['pon', 'chi'], egg: ['vo', 'vi'], bean: ['jin', 'ji'], block: ['rok', 'tok'], tall: ['ris', 'tal'],
    blob: ['gel', 'lup'], drop: ['gu', 'dro'], squat: ['tuk', 'pa'], ghost: ['mbra', 'fan'], long: ['sio', 'lio'],
    cloud: ['nim', 'fu'], pear: ['pe', 'ra'], mound: ['mon', 'du'],
    wide: ['plas', 'ancho'], tower: ['lon', 'tor'], topheavy: ['gor', 'cabo'], bubble: ['bur', 'pop'], lumpy: ['gru', 'mo'],
    gourd: ['ba', 'zo'], gem: ['dax', 'tis'], puff: ['fus', 'mi'], bell: ['lin', 'dan'], bulb: ['bul', 'tre'],
  };
  const RARE = { eyes: ['star', 'button', 'uneven', 'cyclops', 'three', 'visor', 'spiral'], ears: ['unicorn', 'mushroom'], mouth: ['beak', 'sabre', 'bubble', 'stitch'], mark: [], hair: [] };
  const VOW = /[aeiouyáéíóú]$/i;

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pickOf = (arr, R) => arr[Math.floor(R() * arr.length)];

  /** Une dos trozos sin grupos de consonantes imposibles. */
  function join(a, b) {
    if (!a) return b;
    const endC = !VOW.test(a), startC = !/^[aeiouy]/i.test(b);
    if (endC && startC) {
      // n/r/l/s + una consonante y vocal se lee bien («Lin-bo», «Cor-tal»); si no, fuera la consonante
      const ok = /[nrls]$/i.test(a) && /^[^aeiouy][aeiouy]/i.test(b) && !(/n$/i.test(a) && /^[bp]/i.test(b));
      if (!ok) a = a.slice(0, -1);
      else if (/n$/i.test(a) && /^[bp]/i.test(b)) a = a.slice(0, -1) + 'm';
    }
    if (!endC && !startC) b = b.slice(1);
    return a + b;
  }
  /** Final con el tamaño: pequeñito → -ín, enorme → -ón. */
  function sized(end, size) {
    const stem = end.replace(/[aeiouy]+[^aeiouy]*$/i, '') || end.charAt(0);
    if (size < 0.86) return stem + 'ín';
    if (size > 1.15) return stem + 'ón';
    return end;
  }

  /** Nombre a partir de un aspecto (DK.looks.ind / roll). */
  function make(i) {
    if (!i) return null;
    const R = rng((i.seed >>> 0) ^ 0x6e616d65);
    const start = pickOf(HOUSE[i.house] || HOUSE.luz, R);
    // Rasgo llamativo: los raros primero; si no, uno corriente a veces
    const cands = Object.keys(TRAIT).filter((cat) => TRAIT[cat][i[cat]]).map((cat) => ({ cat, key: i[cat], rare: RARE[cat].includes(i[cat]) }));
    const rares = cands.filter((c) => c.rare);
    const pool = rares.length ? rares : cands;
    const c = pool.length ? pool[Math.floor(R() * pool.length)] : null;
    let mid = c && (rares.length || R() < 0.55) ? TRAIT[c.cat][c.key] : '';
    const end = sized(pickOf(BODY[i.body] || BODY.round, R), i.size || 1);
    const s2 = (x) => x.toLowerCase().slice(0, 2);
    if (mid && (s2(end) === s2(mid) || start.toLowerCase().endsWith(s2(mid)))) mid = ''; // «Monmon», «Lulu»
    let name = join(join(start, mid), end);
    if (name.length > 9 && mid) name = join(start, end); // sin rasgo si queda demasiado largo
    // v4.62: sufijo de la casa (a veces) y prefijo por brazos o adorno (pocas veces). Azar aparte:
    // los nombres que ya salían antes no cambian por esto (y además se guardan en d.gname).
    const R2 = rng((i.seed >>> 0) ^ 0x5f3759df);
    if (R2() < 0.22 && name.length <= 7 && !/[íó]n$/i.test(name)) { const suf = pickOf(SUFFIX[i.house] || SUFFIX.luz, R2); name = name.replace(/[aeiouyáéíóú]+$/i, '') + suf; }
    const preTable = (i.arms && PREFIX.arms[i.arms]) || (i.final && PREFIX.final[i.final]);
    if (preTable && R2() < 0.18 && name.length <= 6) name = preTable + name.charAt(0).toLowerCase() + name.slice(1);
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /** Nombre propio de un daskai (se guarda en d.gname); null si no tiene. */
  function of(d) {
    if (!d || d.boss || !D.species[d.species] || !DK.looks) return null;
    if (d.gname) return d.gname;
    const lk = DK.looks.of(d); if (!lk) return null;
    const n = make(DK.looks.ind(d.species, lk));
    if (n) d.gname = n;
    return n;
  }

  DK.names = { of, make };
})();
