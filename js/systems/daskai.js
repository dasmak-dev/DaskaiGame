/* =============================================================
 * systems/daskai.js — Lógica de cada daskai y del grupo del jugador.
 *
 * Un daskai guardado es un objeto plano:
 *   { uid, species, nickname, level, exp, nature, passive,
 *     growth: {hp, mp, ...},  // puntos ganados al subir de nivel
 *     cur: {hp, mp},          // vida y maná actuales
 *     moves: [...],           // ataques activos (máx. 6)
 *     learned: [...],         // todos los aprendidos (activos + reserva)
 *     equip: [obj, obj],      // 2 ranuras
 *     status, shiny, wild, boss }
 *
 * DK.daskai → funciones sobre un daskai
 * DK.party  → colección y equipo activo del jugador
 * ============================================================= */
(function () {
  const U = DK.util;
  const D = DK.data;
  const KEYS = () => D.statKeys;

  function zeroStats() { const o = {}; KEYS().forEach((k) => (o[k] = 0)); return o; }

  /**
   * Ritmo de crecimiento de un atributo (1 = normal). Lo suben:
   *  - la especie: sus atributos base más altos crecen más (y los bajos, menos);
   *  - sus pasivas (y las del equipo): +% en un atributo → crece más, -% → menos.
   * La naturaleza se aplica aparte (puntos extra o de menos, ver rollGrowth).
   */
  function growthWeight(d, k) {
    const B = DK.config.growthBias, sp = D.species[d.species];
    const keys = KEYS().filter((x) => x !== 'hp' && x !== 'mp');
    const avg = keys.reduce((a, x) => a + sp.base[x], 0) / keys.length;
    // vida y maná se comparan con su propia escala (vida ≈ 4×, maná ≈ 2.5× un atributo normal)
    const ref = k === 'hp' ? avg * 4 : k === 'mp' ? avg * 2.6 : avg;
    const spBias = (sp.base[k] / ref - 1) * B.species;
    const pasBias = (api.passiveMods(d).mods[k] || 0) * B.passive;
    return U.clamp(1 + spBias + pasBias, B.min, B.max);
  }

  /* v5.18: reparto de la especie (qué parte del total va a cada atributo) y su «fuerza» respecto a las de su etapa */
  const shareCache = {}, factorCache = {};
  function speciesShare(sid) {
    if (shareCache[sid]) return shareCache[sid];
    const b = D.species[sid].base, tot = KEYS().reduce((a, k) => a + (b[k] || 0), 0) || 1, out = {};
    KEYS().forEach((k) => (out[k] = (b[k] || 0) / tot));
    return (shareCache[sid] = out);
  }
  function speciesFactor(sid) {
    if (factorCache[sid] != null) return factorCache[sid];
    const tot = (x) => KEYS().reduce((a, k) => a + (D.species[x].base[k] || 0), 0), evo = !!D.species[sid].evolvedFrom;
    const same = Object.keys(D.species).filter((x) => !!D.species[x].evolvedFrom === evo).map(tot).sort((a, b) => a - b);
    const med = same[same.length >> 1] || tot(sid);
    return (factorCache[sid] = U.clamp(Math.sqrt(tot(sid) / med), 0.88, 1.12));
  }
  /**
   * v5.18: potencial de un atributo (como los IV de Pokémon): sale de cómo ha ido creciendo al subir de nivel
   * (naturaleza, ritmo de su especie y pasivas, y la suerte de cada subida), suavizado. ~0,75 – 1,3.
   */
  function potential(d, k) {
    const n = Math.max(0, (d.level || 1) - 1), g = (d.growth[k] || 0) - ((d.evoBonus && d.evoBonus[k]) || 0);
    return U.clamp((g + 2 * 6) / (2 * n + 12), 0.72, 1.32);
  }
  /** v5.18: atributo «propio» por nivel: fijo + base × nivel × coeficiente × potencial (config.statModel). */
  function levelStat(d, k) {
    const M = DK.config.statModel, L = d.level || 1, c = M.coef[k] != null ? M.coef[k] : M.coef.other, fl = M.flat[k] || M.flat.other;
    // genes y rasgo multiplican todo el atributo (así se notan también a nivel bajo)
    const ind = (1 + ((d.genes && d.genes[k]) || 0)) * (1 + ((api.roleOf(d).mods || {})[k] || 0));
    return (fl[0] + fl[1] * L + api.tierTotal(d) * speciesShare(d.species)[k] * L * c * potential(d, k)) * ind;
  }

  /**
   * Puntos de una subida de nivel.
   * @returns {{total:Object, nature:Object}} total = nivel + naturaleza; nature = parte de la naturaleza
   */
  function rollGrowth(natureId, d) {
    const G = DK.config.growth;
    const total = {}, nature = {};
    for (const k of KEYS()) {
      // Puntos por nivel × ritmo (redondeo al azar para que los decimales cuenten)
      const raw = U.rand(G.level[0], G.level[1]) * (d ? growthWeight(d, k) : 1);
      const lvl = Math.floor(raw) + (Math.random() < raw % 1 ? 1 : 0);
      const eff = D.natureEffect(natureId, k);
      let nat = 0;
      if (eff > 0) nat = U.rand(G.natureBonus[0], G.natureBonus[1]);
      if (eff < 0) nat = -Math.min(lvl, U.rand(G.naturePenalty[0], G.naturePenalty[1]));
      // v4.69: nunca menos de 0 ni más de 5 en una subida
      const sum = U.clamp(lvl + nat, G.min != null ? G.min : 0, G.max != null ? G.max : 99);
      total[k] = sum;
      nature[k] = sum - lvl;
    }
    return { total, nature };
  }

  /** Suma una subida de nivel al daskai (crecimiento total y parte de naturaleza). */
  function applyGrowth(d) {
    const g = rollGrowth(d.nature, d);
    d.natureGrowth = d.natureGrowth || zeroStats();
    // v5.4: en tus daskai una subida de nivel nunca sube un atributo más de config.growth.max (5) EN PANTALLA:
    // antes los % (pasivas, talentos, genes, estrellas…) multiplicaban los puntos y salían +6/+7.
    const mine = !d.wild && !d.boss && DK.store && DK.store.state;
    const s0 = mine ? computeStats(d) : null;
    KEYS().forEach((k) => { d.growth[k] += g.total[k]; d.natureGrowth[k] += g.nature[k]; });
    if (mine) {
      const cap = DK.config.growth.max != null ? DK.config.growth.max : 5;
      let s1 = computeStats(d);
      for (const k of KEYS()) {
        let guard = 8;
        while (s1[k] - s0[k] > cap && g.total[k] > 0 && guard-- > 0) {
          d.growth[k]--; g.total[k]--;
          if (g.nature[k] > 0) { d.natureGrowth[k]--; g.nature[k]--; }
          s1 = computeStats(d);
        }
      }
    }
    api.touch();
    return g.total;
  }

  /** Ataques que la especie conoce hasta cierto nivel (en orden). */
  function movesUpTo(speciesId, level, house2) {
    const out = [];
    for (const [lv, m] of learnList(speciesId, house2)) if (lv <= level && !out.includes(m)) out.push(m);
    return out;
  }

  /* ---------- v4.71: segunda casa (daskai de doble casa) ----------
   * d.house2 = casa secundaria (o nada). La especie da la primera. Un daskai de doble casa:
   *   · se defiende con las dos (systems/battle.js houseMult multiplica ambas) y tiene «misma casa» con las dos;
   *   · aprende además algunos ataques de su segunda casa (H2_LEVELS) y puede nacer con una pasiva de ella;
   *   · se dibuja con los colores de ambas (systems/looks.js, look.h2). Lo conserva al evolucionar.
   */
  const H2_LEVELS = [1, 9, 17, 27, 38];
  const h2Cache = {};
  /** Ataques de una casa que aprende un daskai que la tiene de segunda: [[nivel, ataque]]. */
  function house2Learn(house) {
    if (!house) return [];
    if (h2Cache[house]) return h2Cache[house];
    const min = {};
    Object.values(D.species).forEach((sp) => sp.learn.forEach(([lv, m]) => { const mv = D.moves[m]; if (mv && mv.house === house) min[m] = Math.min(min[m] == null ? 99 : min[m], lv); }));
    // los de daño primero en su nivel, en orden de nivel; uno de cada en los niveles de H2_LEVELS
    const list = Object.keys(min).sort((a, b) => min[a] - min[b] || (D.moves[b].power || 0) - (D.moves[a].power || 0));
    const step = Math.max(1, list.length / H2_LEVELS.length);
    h2Cache[house] = H2_LEVELS.map((lv, i) => [lv, list[Math.min(list.length - 1, Math.floor(i * step))]]).filter(([, m], i, arr) => m && arr.findIndex((x) => x[1] === m) === i);
    return h2Cache[house];
  }
  /** Lista de aprendizaje completa (especie + segunda casa), ordenada por nivel. */
  function learnList(speciesId, house2) {
    const base = D.species[speciesId].learn;
    if (!house2 || house2 === D.species[speciesId].house) return base;
    return base.concat(house2Learn(house2)).sort((a, b) => a[0] - b[0]);
  }
  /** Pasivas típicas de una casa (las de sus especies). */
  const passivesOfHouse = (house) => [...new Set(Object.values(D.species).filter((sp) => sp.house === house).flatMap((sp) => sp.passives || []))].filter((id) => D.passives[id]);
  /** Una casa distinta de `not` (al azar o, con semilla, siempre la misma). */
  function otherHouse(not, seed) {
    const hs = Object.keys(D.houses).filter((h) => h !== not);
    return hs[seed != null ? (seed >>> 0) % hs.length : Math.floor(Math.random() * hs.length)];
  }

  const api = {
    /**
     * Crea un daskai nuevo.
     * @param {string} speciesId
     * @param {number} level
     * @param {Object} [o]  {wild: bool, shiny: bool|undefined (aleatorio si wild), boss: bool}
     */
    create(speciesId, level = 1, o = {}) {
      const sp = D.species[speciesId];
      if (!sp) throw new Error('Especie desconocida: ' + speciesId);
      const d = {
        uid: U.uid(), species: speciesId, level: 1, exp: 0,
        nature: U.pick(Object.keys(D.natures)),
        passive: U.pick(sp.passives),
        genes: api.rollGenes(),    // ±config.genes sobre cada atributo base de la especie: no hay dos iguales
        role: o.boss ? 'equilibrado' : api.rollRole(), // rasgo (raro: config.roleChance)
        growth: zeroStats(),       // puntos ganados al subir de nivel (nivel + naturaleza)
        natureGrowth: zeroStats(), // parte de `growth` que viene de la naturaleza (+ o -)
        cur: { hp: 0, mp: 0 },
        moves: [], learned: [], equip: [null, null], status: null,
      };
      const look = DK.looks ? DK.looks.rollLook(speciesId, o) : null; // aspecto propio (los jefes: el típico)
      if (look) d.look = look;
      // v4.71: segunda casa. o.house2 = una casa concreta · o.dual = true → al azar (los jefes: siempre la misma para cada jefe)
      if (o.house2 && D.houses[o.house2] && o.house2 !== sp.house) d.house2 = o.house2;
      else if (o.dual || o.starter) d.house2 = otherHouse(sp.house, o.boss ? DK.looks.hash('boss2:' + speciesId) : null); // los iniciales siempre: su casa + otra al azar
      if (d.house2 && U.chance(0.5)) { const pool = passivesOfHouse(d.house2); if (pool.length) d.passive = U.pick(pool); }
      // Formas (v4.51): cuántas tendrá (1-4, el inicial 4); los jefes y las especies sin línea siguen como antes
      if (!o.boss && api.lineOf(speciesId).length > 1) d.forms = o.starter ? 4 : +U.weightedKey(DK.config.forms.weights, Math.random, '3');
      if (o.wild) d.wild = true;
      if (o.boss) d.boss = true;
      if (o.elite) d.elite = true;
      if (o.shiny || (o.shiny === undefined && o.wild && !o.boss && U.chance(DK.config.shinyChance))) d.shiny = true;
      for (let l = 2; l <= level; l++) applyGrowth(d);
      d.level = Math.min(level, o.wild || o.boss ? (DK.config.maxEnemyLevel || DK.config.maxLevel) : DK.config.maxLevel); // v5.31: los rivales del Averno llegan a 120
      if (d.forms) d.form = Math.min(d.forms - 1, DK.config.forms.levels[d.forms].filter((lv) => lv <= d.level).length);
      d.learned = movesUpTo(speciesId, d.level, d.house2);
      d.moves = d.learned.slice(-DK.config.maxMoves);
      api.fullHeal(d);
      return d;
    },

    species(d) { return D.species[d.species]; },

    /** Genes al nacer: un % al azar (±config.genes) para cada atributo base. */
    rollGenes() {
      const g = DK.config.genes || 0, out = {};
      KEYS().forEach((k) => (out[k] = Math.round(U.randf(-g, g) * 100) / 100));
      return out;
    },
    /** Rasgo al nacer: casi siempre ninguno; con config.roleChance, uno de D.roles según su peso. */
    rollRole() {
      if (!U.chance(DK.config.roleChance || 0)) return 'equilibrado';
      const w = {}; Object.entries(D.roles).forEach(([id, r]) => { if (r.weight) w[id] = r.weight; });
      return U.weightedKey(w, Math.random, 'equilibrado');
    },
    /** Rasgo de un daskai (las partidas antiguas lo sortean la primera vez). */
    roleOf(d) {
      if (!d.role || !D.roles[d.role]) { d.role = d.boss ? 'equilibrado' : api.rollRole(); api.touch(); }
      return D.roles[d.role];
    },
    /** ¿Tiene rasgo? */
    hasRole(d) { return api.roleOf(d).id !== 'equilibrado'; },
    /** Atributo base de ESTE daskai: el de su especie con sus genes y su rasgo. */
    baseOf(d, k) {
      // v5.18: base «al estilo Pokémon»: el total de su forma (config.statModel.tiers) repartido como su especie
      const role = (api.roleOf(d).mods || {})[k] || 0;
      return Math.max(1, Math.round(api.tierTotal(d) * speciesShare(d.species)[k] * (1 + ((d.genes && d.genes[k]) || 0)) * (1 + role)));
    },
    /**
     * v5.18: total de atributos base de este daskai (como el «BST» de Pokémon): depende de su forma
     * (1.ª ≈ 200, intermedias ≈ 300–400, final ≈ 500; de una sola forma ≈ 450), de su especie (las fuertes
     * un poco más: ±12 %) y de si es jefe (≥ 520) o legendario (600).
     */
    tierTotal(d) {
      const M = DK.config.statModel, f = api.formsOf(d), row = M.tiers[Math.max(1, Math.min(4, f.total))] || M.tiers[4];
      let T = row[Math.min(f.now, row.length - 1)] * speciesFactor(d.species);
      // Rivales: su total va con su nivel (como si hubieran evolucionado a su ritmo): un salvaje de una sola forma
      // a nivel 5 no tiene los 420 de una forma final. Los jefes, al menos lo de su nivel (≈330 al principio → 520).
      const L = d.level || 1, byLevel = M.wildCurve[0] + (M.wildCurve[1] - M.wildCurve[0]) * Math.min(1, L / M.wildCurve[2]);
      if (d.wild || d.boss) T = Math.min(T, byLevel);
      if (d.boss) T = Math.max(T, M.bossCurve[0] + (M.boss - M.bossCurve[0]) * Math.min(1, L / M.bossCurve[1]));
      if (d.legendary) T = M.legendary;
      return T;
    },

    /* ---------- Formas (v4.51) ----------
     * d.forms: cuántas formas tendrá (1-4) · d.form: en cuál está (0…) · d.extra: formas de más que su
     * línea de especies (llevan el mismo nombre + número: «Hojaral II»).
     * Los daskai antiguos y los jefes no tienen d.forms: siguen su línea de especies tal cual. */
    /** Línea evolutiva de una especie (de la primera a la última). */
    lineOf(sid) { let r = sid, i = 0; while (D.species[r].evolvedFrom && i++ < 8) r = D.species[r].evolvedFrom; const out = []; for (let c = r; c && out.length < 8; c = D.species[c].evolve && D.species[c].evolve.into) out.push(c); return out; },
    /** { total, now } formas (las antiguas: según su línea). */
    formsOf(d) {
      if (d.forms) return { total: d.forms, now: d.form || 0 };
      const line = api.lineOf(d.species);
      return { total: Math.min(4, line.length), now: Math.min(3, Math.max(0, line.indexOf(d.species))) };
    },
    /** Multiplicador de la base por su forma: fuerza de la forma ÷ fuerza de su especie en la línea. */
    formMult(d) {
      if (!d.forms) return 1;
      const tot = (sid) => Object.values(D.species[sid].base).reduce((a, b) => a + b, 0);
      const root = api.lineOf(d.species)[0];
      const want = DK.config.forms.power[d.forms][Math.min(d.form || 0, d.forms - 1)];
      const m = want / (tot(d.species) / tot(root));
      // Los rivales salvajes lo notan a medias (para no disparar la dificultad); al reclutarlos, entero
      return d.wild && m > 1 ? Math.sqrt(m) : m;
    },
    /** Etapa del dibujo de una forma: { st, final }. */
    visual(d, form) {
      const f = api.formsOf(d), now = form == null ? f.now : form;
      if (!d.forms) return null; // antiguos: la etapa sale de su especie
      return { st: DK.config.forms.vis[f.total][Math.min(now, f.total - 1)], final: now >= f.total - 1 };
    },
    /** Lo que viene después: { level, into (especie), extra (forma de más con el mismo nombre) } o null. */
    nextForm(d) {
      if (!d.forms) { const e = D.species[d.species].evolve; return e && D.species[e.into] ? { level: e.level, into: e.into, extra: false } : null; }
      if ((d.form || 0) >= d.forms - 1) return null;
      const e = D.species[d.species].evolve, level = DK.config.forms.levels[d.forms][d.form || 0];
      return e && D.species[e.into] ? { level, into: e.into, extra: false } : { level, into: d.species, extra: true };
    },

    /** Ritmo de crecimiento de un atributo (ver growthWeight) y su etiqueta para la interfaz. */
    growthWeight(d, k) { return growthWeight(d, k); },
    /**
     * Puntos que gana de media por nivel en un atributo: nivel × ritmo + naturaleza.
     * La etiqueta (▲▲ ▲ ● ▼ ▼▼) sale de comparar esta media con la normal, así
     * que lo que se ve es lo que de verdad sube.
     */
    growthAvg(d, k) {
      const G = DK.config.growth, eff = D.natureEffect(d.nature, k);
      const lvl = ((G.level[0] + G.level[1]) / 2) * growthWeight(d, k);
      const nat = eff > 0 ? (G.natureBonus[0] + G.natureBonus[1]) / 2 : eff < 0 ? -(G.naturePenalty[0] + G.naturePenalty[1]) / 2 : 0;
      return U.clamp(lvl + nat, G.min || 0, G.max || 99);
    },
    growthRate(d, k) {
      const G = DK.config.growth, normal = (G.level[0] + G.level[1]) / 2;
      const r = api.growthAvg(d, k) / normal;
      return r >= 1.5 ? 'high' : r >= 1.15 ? 'up' : r <= 0.6 ? 'low' : r <= 0.85 ? 'down' : 'normal';
    },

    /* ---------- Mejoras permanentes: tónicos y entrenamiento ---------- */
    /** Puntos permanentes de un atributo (tónicos + campo de entrenamiento). */
    permBonus(d, k) { return ((d.tonics && d.tonics[k]) || 0) * DK.config.tonic.per[k] + ((d.trained && d.trained[k]) || 0); },
    /** Tónicos tomados en total. */
    tonicsUsed(d) { return Object.values(d.tonics || {}).reduce((a, b) => a + b, 0); },
    /** Tomar un tónico: +config.tonic.per[stat] para siempre (hasta config.tonic.cap tónicos). */
    applyTonic(d, stat) {
      if (api.tonicsUsed(d) >= DK.config.tonic.cap) return false;
      api.touch();
      d.tonics = d.tonics || {};
      d.tonics[stat] = (d.tonics[stat] || 0) + 1;
      return true;
    },
    /** Elixir de olvido: devuelve los tónicos a la bolsa para repartirlos de nuevo. */
    resetTonics(d) {
      api.touch();
      const back = {};
      Object.entries(d.tonics || {}).forEach(([k, n]) => { const id = D.tonicFor[k]; if (id && n) back[id] = n; });
      d.tonics = {};
      api.clamp(d);
      return back;
    },

    /* ---------- Talentos (cada config.talentEvery niveles) ---------- */
    /** Niveles en los que se elige talento: 10, 20, 30… */
    talentTiers(d) { const n = Math.floor(d.level / DK.config.talentEvery); return Array.from({ length: n }, (_, i) => (i + 1) * DK.config.talentEvery); },
    /** Las opciones de un nivel de talento (v4.96: tres, fijas para cada daskai y sin repetir las ya elegidas). */
    talentOptions(d, tier) {
      const taken = Object.entries(d.talents || {}).filter(([k]) => Number(k) !== Number(tier)).map(([, v]) => v);
      const ids = Object.keys(D.talents).filter((id) => !taken.includes(id));
      let hsh = 0; for (const ch of d.uid + ':' + tier) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
      const out = [];
      for (let i = 0; out.length < Math.min(DK.config.talentChoices || 3, ids.length) && i < 64; i++) {
        hsh = (Math.imul(hsh ^ (hsh >>> 13), 0x5bd1e995) + i) >>> 0;
        const id = ids[hsh % ids.length]; if (!out.includes(id)) out.push(id);
      }
      return out;
    },
    /**
     * v4.96: perfil del daskai para recomendar talentos (0–1 cada rasgo):
     * phys/mag (por sus ataques y su Ataque frente a su Ataque mágico), tank/frail (defensas),
     * fast (Velocidad frente al resto), status (ataques que causan estados).
     */
    talentProfile(d) {
      const s = api.stats(d), cl = (x) => Math.max(0, Math.min(1, x));
      const dmg = (d.moves || []).map((m) => D.moves[m]).filter((m) => m && m.power > 0);
      const physMoves = dmg.length ? dmg.filter((m) => m.kind === 'fisico').length / dmg.length : 0.5;
      const phys = cl(0.5 * (s.atk / Math.max(1, s.atk + s.matk)) + 0.5 * physMoves);
      const off = (s.atk + s.matk) / 2, dfn = (s.def + s.mdef) / 2;
      const tank = cl((dfn / Math.max(1, off + dfn) - 0.35) / 0.3);
      const fast = cl((s.spd / Math.max(1, (s.atk + s.matk + s.def + s.mdef) / 4) - 0.7) / 0.6);
      const status = cl((d.moves || []).filter((m) => D.moves[m] && D.moves[m].effect && D.moves[m].effect.type === 'status').length / 2);
      return { phys, mag: 1 - phys, tank, frail: 1 - tank, fast, status, all: 0.55, econ: 0.3 };
    },
    /** v4.96: cuánto le conviene un talento (0–1) y el rasgo que más pesa. */
    talentFit(d, id, prof = api.talentProfile(d)) {
      const f = (D.talents[id] || {}).fit || {}, tot = Object.values(f).reduce((a, b) => a + b, 0) || 1;
      let score = 0, top = null, topV = -1;
      Object.entries(f).forEach(([k, w]) => { const v = (prof[k] || 0) * w; score += v; if (v > topV) { topV = v; top = k; } });
      return { score: score / tot, why: top };
    },
    talentsPending(d) { return api.talentTiers(d).filter((tier) => !(d.talents || {})[tier]); },
    /** v5.29: elige al azar entre sus opciones los talentos que le falten (para los que se unen con nivel). */
    autoTalents(d, rnd = Math.random) {
      if (!d || d.boss) return 0;
      const pend = api.talentsPending(d);
      pend.forEach((tier) => { const ops = api.talentOptions(d, tier); if (ops.length) { d.talents = d.talents || {}; d.talents[tier] = ops[Math.floor(rnd() * ops.length)]; } });
      if (pend.length) { d.talentsAuto = pend.slice(); api.clamp(d); }
      return pend.length;
    },
    chooseTalent(d, tier, id) {
      if (!api.talentOptions(d, tier).includes(id) || (d.talents || {})[tier]) return false;
      api.touch();
      d.talents = d.talents || {}; d.talents[tier] = id;
      api.clamp(d); DK.store.save();
      return true;
    },
    /** Nombre visible: apodo, o su nombre propio (systems/names.js, v4.54), o el de su especie. */
    name(d) { return d.nickname || (DK.names && DK.names.of(d)) || api.speciesName(d); },
    /** Nombre de su forma: la especie y, si tiene formas de más, su número («Hojaral II»). */
    speciesName(d) { const ROM = ['', '', 'II', 'III', 'IV', 'V']; return D.species[d.species].name + (d.extra ? ' ' + ROM[d.extra + 1] : ''); },
    /** Protegido (v4.57): no se puede liberar mientras lo esté. */
    setLocked(d, v) { if (v) d.locked = true; else delete d.locked; DK.store.save(); },
    /** Lo marca como visto (quita «Nuevo»). */
    seen(d) { if (d && d.isNew) { delete d.isNew; DK.store.save(); } },
    /**
     * v4.68: guarda el % de vida y maná de tu colección y luego lo vuelve a aplicar con los máximos nuevos.
     * Al empezar una expedición (Vigor del campamento, reliquias grabadas...) o al ganar una reliquia de +PV,
     * el máximo sube: antes la vida se quedaba igual y todos parecían heridos (p. ej. 77/85).
     */
    snapPct() {
      const m = new Map();
      DK.party.all().forEach((d) => { if (!d.cur) return; const s = api.stats(d); m.set(d, [s.hp ? d.cur.hp / s.hp : 1, s.mp ? d.cur.mp / s.mp : 1]); });
      return m;
    },
    applyPct(m) {
      api.touch(); // los máximos se recalculan con lo nuevo
      m.forEach(([hp, mp], d) => {
        if (!d.cur) return; const s = api.stats(d);
        d.cur.hp = d.cur.hp <= 0 ? 0 : Math.max(1, Math.min(s.hp, Math.round(hp * s.hp)));
        d.cur.mp = Math.max(0, Math.min(s.mp, Math.round(mp * s.mp)));
      });
    },
    /** v4.63: ¿sigue siendo «Nuevo»? La marca caduca a los 5 minutos aunque no abras su ficha. */
    isNew(d) {
      if (!d || !d.isNew) return false;
      if (d.isNew === true) d.isNew = Date.now(); // marcas antiguas: cuentan desde ahora
      if (Date.now() - d.isNew > 5 * 60 * 1000) { delete d.isNew; return false; }
      return true;
    },
    /** Cambia el apodo ('' lo elimina). */
    rename(d, nick) { d.nickname = nick ? nick.slice(0, 16) : undefined; DK.store.save(); },

    /** Bonificaciones planas del equipo (objetos). */
    equipBonus(d, equip = d.equip) {
      const b = zeroStats(); b.regen = 0;
      // v4.74: piezas (DK.gear): sus atributos planos y la regeneración de sus sufijos
      (equip || []).forEach((p) => {
        if (!p) return;
        for (const [k, v] of Object.entries(DK.gear.flat(p))) b[k] = (b[k] || 0) + v;
        b.regen += DK.gear.fx(p).regen || 0;
      });
      return b;
    },

    /** Multiplicador extra por ser salvaje, jefe o variocolor. */
    mult(d, k) {
      const C = DK.config;
      let m = 1;
      if (d.wild) m *= C.wildStatMult;
      if (d.shiny) m *= C.shinyStatMult;
      if (d.boss) m *= k === 'hp' ? C.bossHpMult : C.bossStatMult;
      if (d.elite) m *= k === 'hp' ? C.eliteHpMult : C.eliteStatMult;
      // Dificultad: los rivales son más (o menos) fuertes
      if ((d.wild || d.boss) && DK.rules) m *= DK.rules.enemyMult();
      // v5.0: los rivales escalan con su nivel (C.enemyScale)
      if ((d.wild || d.boss) && C.enemyScale) m *= C.enemyScale.base + C.enemyScale.perLevel * (d.level || 1);
      // Final del juego: corrupción, pesadilla y abismo hacen más fuertes a los rivales
      if ((d.wild || d.boss) && DK.endgame) { m *= 1 + DK.endgame.enemyStat(d); if (k === 'hp') m *= DK.endgame.bossHp(d); }
      // Tus daskai: estrellas de ascensión y forma alternativa
      if (!d.wild && !d.boss) {
        if (d.stars && DK.data.endgame) m *= 1 + d.stars * DK.data.endgame.ascension.statPerStar;
        if (d.variant && DK.data.endgame && DK.data.endgame.variants[d.variant]) m *= 1 + DK.data.endgame.variants[d.variant].stat;
      }
      // Reliquias de expedición (sólo tus daskai)
      if (!d.wild && !d.boss && DK.relics && DK.expedition.active()) m *= 1 + DK.relics.statPct(k) + (k === 'hp' ? DK.camp.value('vigor') : 0);
      return m;
    },

    /**
     * Atributos finales: (base + crecimiento + equipo) × (1 + pasiva) × multiplicadores.
     * @param {Object} d
     * @param {Array} [equip] equipo alternativo (para previsualizar cambios)
     */
    stats(d, equip) {
      // Caché: el cálculo completo sólo se repite si cambia algo que lo afecta (statKey)
      if (equip) return computeStats(d, equip);
      const key = statKey(d);
      const c = statCache.get(d);
      if (c && c.key === key) return Object.assign({}, c.val);
      const val = computeStats(d);
      statCache.set(d, { key, val });
      return Object.assign({}, val);
    },
    /** Vacía la caché de atributos. */
    clearStatCache() { statCache = new WeakMap(); rev++; Object.keys(shareCache).forEach((x) => delete shareCache[x]); Object.keys(factorCache).forEach((x) => delete factorCache[x]); },
  };

  /*
   * Caché de atributos. stats() se llama muchísimo (cada barra, cada
   * daño, cada ficha). Se recalcula sólo si cambia la «revisión» o algo
   * barato de comparar (nivel, especie, pasiva, equipo, expedición):
   *  - DK.store.save() sube la revisión (casi todo cambio de la partida guarda);
   *  - las funciones que cambian atributos sin tocar el nivel (tónicos,
   *    talentos, entrenamiento, herencia, reliquias) llaman a DK.daskai.touch().
   * Si cambias a mano growth/tonics/trained/legacy/talents/genes de un
   * daskai, llama tú también a DK.daskai.touch().
   */
  let statCache = new WeakMap(), rev = 0;
  function statKey(d) {
    const st = DK.store.state, e = st && st.expedition;
    const eq = d.equip || [];
    return rev + '|' + d.level + '|' + d.species + '|' + d.passive + '|' + DK.gear.key(eq[0]) + '|' + DK.gear.key(eq[1]) + '|' + (e ? 'x' + (e.relics || []).length + '|' + (e.corruption || 0) + (e.zone || '') + (e.depth || 1) : '-') + '|' + (st ? st.difficulty : '') + '|' + (d.stars || 0) + (d.variant || '') + '|' + (d.form || 0) + '/' + (d.forms || 0) + (d.wild ? 'w' : '') + (d.boss ? 'b' : '') + (d.elite ? 'e' : '') + (d.avernoMult ? '|av' + d.avernoMult : '');
  }
  api.touch = () => { rev++; };

  /** Base (id de items.json) de lo que hay en una ranura: una pieza (v4.74) o un id antiguo. */
  const slotBase = (p) => (!p ? null : typeof p === 'string' ? (D.items[p] ? p : null) : D.items[p.base] ? p.base : null);

  /** Cálculo completo de los atributos (sin caché). */
  function computeStats(d, equip) {
    // v5.45: copia del daskai de otro jugador (duelos): sus atributos tal cual los publicó
    if (d.ghost && d.ghost.st) return Object.assign({ regen: 0 }, d.ghost.st);
    {
      const pas = api.passiveMods(d, equip);
      const eq = api.equipBonus(d, equip);
      const out = {};
      for (const k of KEYS()) {
        // Base de la especie + crecimiento por niveles + equipo + herencia de caídos (d.legacy)
        // + tónicos y entrenamiento (mejoras permanentes, ver api.permBonus)
        const m = (1 + (pas.mods[k] || 0)) * api.mult(d, k);
        // v5.18: base × nivel al estilo Pokémon (levelStat) + herencia de caídos (más modesta) + tónicos/entrenamiento
        const leg = ((d.legacy && d.legacy[k]) || 0) * (k === 'hp' || k === 'mp' ? 1 : DK.config.statModel.legacyMult);
        let own = (levelStat(d, k) + leg + api.permBonus(d, k)) * m;
        // v5.4: la vida propia de tus daskai (sin contar el equipo) tiene un techo por nivel (config.hpCap):
        // Nv. 10 → 150 · Nv. 40 → 300 · Nv. 100 → 600
        if (k === 'hp' && !d.wild && !d.boss && DK.config.hpCap) own = Math.min(own, DK.config.hpCap.base + DK.config.hpCap.perLevel * (d.level || 1));
        out[k] = Math.max(1, Math.round(own + (eq[k] || 0) * m));
      }
      // En expedición no hay regeneración base (config.expedition.noFreeHeal): sólo la de pasivas y equipo
      const noFree = DK.config.expedition.noFreeHeal && DK.store.state && DK.store.state.expedition;
      out.regen = (noFree ? 0 : DK.config.regenPct) + (pas.regen || 0) + (eq.regen || 0);
      return out;
    }
  }

  Object.assign(api, {

    /**
     * Pasivas activas: la propia + las que dan los objetos equipados (grants.passive).
     * @returns {string[]} ids de data/basics.js → D.passives
     */
    passives(d, equip) {
      const ids = [d.passive];
      (equip || d.equip || []).forEach((p) => {
        const g = slotBase(p) && D.items[slotBase(p)].grants;
        if (g && g.passive && !ids.includes(g.passive)) ids.push(g.passive);
        const lp = DK.gear.passive(p); if (lp && !ids.includes(lp)) ids.push(lp); // pasiva exclusiva (legendaria)
      });
      return ids.filter((id) => D.passives[id]);
    },
    /** Suma de los modificadores de todas las pasivas activas: { mods: {k: %}, regen }. */
    passiveMods(d, equip) {
      const out = { mods: {}, regen: 0 };
      api.passives(d, equip).forEach((id) => {
        const p = D.passives[id];
        Object.entries(p.mods || {}).forEach(([k, v]) => (out.mods[k] = (out.mods[k] || 0) + v));
        out.regen += p.regen || 0;
      });
      // Talentos elegidos (D.talents): suman igual que una pasiva
      Object.values(d.talents || {}).forEach((id) => {
        const tl = D.talents[id]; if (!tl) return;
        Object.entries(tl.mods || {}).forEach(([k, v]) => (out.mods[k] = (out.mods[k] || 0) + v));
        out.regen += tl.regen || 0;
      });
      // v4.74: prefijos de % de las piezas equipadas
      (equip || d.equip || []).forEach((p) => Object.entries(DK.gear.pct(p)).forEach(([k, v]) => (out.mods[k] = (out.mods[k] || 0) + v)));
      return out;
    },
    /** Ataques extra que dan los objetos equipados (grants.move), sin repetir los que ya tiene. */
    grantedMoves(d) {
      const out = [];
      (d.equip || []).forEach((p) => { const g = slotBase(p) && D.items[slotBase(p)].grants; if (g && g.move && !d.moves.includes(g.move) && !out.includes(g.move)) out.push(g.move); });
      return out;
    },
    /** Ataques disponibles en combate: los suyos (máx. 4) + los de sus objetos. */
    battleMoves(d) { return d.moves.concat(api.grantedMoves(d)); },

    /**
     * Desglose de un atributo para la ficha.
     * @returns {{base, level, nature, natureEffect, equip, passivePct, bonus, total}}
     *   level  = puntos de nivel (sin naturaleza)
     *   nature = puntos de naturaleza (pueden ser negativos)
     *   bonus  = lo que suman (o restan) los porcentajes: pasiva, variocolor, jefe...
     *   total  = valor final (igual que stats(d)[k])
     */
    breakdown(d, k) {
      const sp = D.species[d.species];
      const pas = api.passiveMods(d);
      const nature = (d.natureGrowth && d.natureGrowth[k]) || 0;
      const equip = api.equipBonus(d)[k] || 0;
      const total = api.stats(d)[k];
      const perm = api.permBonus(d, k), evo = (d.evoBonus && d.evoBonus[k]) || 0;
      // v5.18: «base» = la parte fija; «nivel» = base de su forma × nivel × potencial (lo que más pesa)
      const M = DK.config.statModel, fl = M.flat[k] || M.flat.other, fixed = Math.round(fl[0] + fl[1] * (d.level || 1)), lvPart = Math.round(levelStat(d, k)) - fixed;
      const flat = fixed + lvPart + equip + perm;
      return {
        base: fixed, gene: (d.genes && d.genes[k]) || 0, trait: (api.roleOf(d).mods || {})[k] || 0, level: lvPart, nature: 0, natureEffect: D.natureEffect(d.nature, k), evo: 0, tierBase: api.baseOf(d, k), potential: potential(d, k),
        perm, tonic: ((d.tonics && d.tonics[k]) || 0) * DK.config.tonic.per[k], trained: (d.trained && d.trained[k]) || 0,
        equip, passivePct: pas.mods[k] || 0, bonus: total - flat, total, rate: api.growthRate(d, k),
      };
    },

    expToNext(d) { return d.level >= DK.config.maxLevel ? 0 : DK.config.expCurve(d.level); },
    isFainted(d) { return d.cur.hp <= 0; },
    hpPct(d) { return d.cur.hp / api.stats(d).hp; },

    /** Recupera vida, maná y estado. */
    fullHeal(d) { const s = api.stats(d); d.cur.hp = s.hp; d.cur.mp = s.mp; d.status = null; },
    /** Ajusta vida/maná a los máximos (tras cambiar equipo). */
    clamp(d) { const s = api.stats(d); d.cur.hp = Math.min(d.cur.hp, s.hp); d.cur.mp = Math.min(d.cur.mp, s.mp); },

    /**
     * Otorga experiencia.
     * @returns {{levels:[{level,gains}], learned:[], pending:[], before, after, evolveReady}}
     *   pending = ataques nuevos que no caben (ya tiene 6)
     */
    gainExp(d, amount) {
      const res = { levels: [], learned: [], pending: [], before: api.stats(d), evolveReady: false };
      if (d.level < DK.config.maxLevel) {
        d.exp += amount;
        while (d.level < DK.config.maxLevel && d.exp >= api.expToNext(d)) {
          d.exp -= api.expToNext(d);
          const s0 = api.stats(d);
          d.level++;
          applyGrowth(d);
          const sNow = api.stats(d), shown = {}; KEYS().forEach((k) => { shown[k] = sNow[k] - s0[k]; });
          if (DK.config.expedition.noFreeHeal && DK.store.state && DK.store.state.expedition) {
            // En expedición subir de nivel no cura: sólo se suma lo que crece el máximo
            const s1 = api.stats(d);
            if (d.cur.hp > 0) d.cur.hp = Math.min(s1.hp, d.cur.hp + Math.max(0, s1.hp - s0.hp));
            d.cur.mp = Math.min(s1.mp, d.cur.mp + Math.max(0, s1.mp - s0.mp));
          } else api.fullHeal(d); // fuera de expedición, subir de nivel recupera vida y maná
          res.levels.push({ level: d.level, gains: shown }); // v5.4: lo que sube de verdad en pantalla en ESE nivel
          api.learnAt(d, d.level, res);
          if (d.level % DK.config.talentEvery === 0) res.talent = d.level; // nuevo talento por elegir
          DK.emit('levelUp', { d, level: d.level });
        }
        if (d.level >= DK.config.maxLevel) d.exp = 0;
      }
      res.after = api.stats(d);
      res.evolveReady = api.canEvolve(d);
      return res;
    },

    /** Aprende los ataques de la especie para un nivel concreto. */
    learnAt(d, level, res) {
      for (const [lv, m] of learnList(d.species, d.house2)) {
        if (lv !== level || d.learned.includes(m)) continue;
        d.learned.push(m);
        if (d.moves.length < DK.config.maxMoves) { d.moves.push(m); res && res.learned.push(m); } else res && res.pending.push(m);
      }
    },

    /** ¿Puede evolucionar ahora? */
    canEvolve(d) { const n = api.nextForm(d); return !!(n && d.level >= n.level); },
    /**
     * v5.25: lo que tiene pendiente un daskai (para el «!» del menú Equipo y de su casilla):
     * 'evolve' (puede evolucionar), 'talent' (talento por elegir), 'moves' (hueco de ataque libre y ataques aprendidos sin poner).
     */
    needs(d) {
      if (!d || d.temp) return [];
      const out = [];
      if (api.canEvolve(d)) out.push('evolve');
      if (api.talentsPending(d).length) out.push('talent');
      if ((d.moves || []).length < DK.config.maxMoves && (d.learned || []).some((m) => !d.moves.includes(m))) out.push('moves');
      return out;
    },

    /**
     * Evoluciona al daskai. Conserva nivel, ataques y proporción de vida.
     * @returns {{from, to, learned, pending}} o null si no puede
     */
    evolve(d) {
      if (!api.canEvolve(d)) return null;
      api.touch();
      const before = api.stats(d);
      const from = d.species, ratioHp = d.cur.hp / api.stats(d).hp, ratioMp = d.cur.mp / Math.max(1, api.stats(d).mp);
      const next = api.nextForm(d);
      d.species = next.into;
      if (d.forms) { d.form = (d.form || 0) + 1; if (next.extra) d.extra = (d.extra || 0) + 1; }
      const sp = D.species[d.species];
      if (!sp.passives.includes(d.passive) && sp.passives.length && !(d.house2 && passivesOfHouse(d.house2).includes(d.passive))) d.passive = d.passive || sp.passives[0];
      // Además de la base de la nueva especie, evolucionar da puntos extra (más cuanto más nivel)
      const scale = 1 + d.level / 30, bonus = {};
      KEYS().forEach((k) => { bonus[k] = Math.round(DK.config.evolveBonus[k] * scale); d.growth[k] += bonus[k]; });
      d.evoBonus = d.evoBonus || zeroStats();
      KEYS().forEach((k) => (d.evoBonus[k] += bonus[k]));
      const s = api.stats(d);
      d.cur.hp = Math.max(1, Math.round(s.hp * ratioHp));
      d.cur.mp = Math.round(s.mp * ratioMp);
      const res = { from, to: d.species, extra: !!next.extra, learned: [], pending: [], before, after: s, bonus };
      // ataques que la nueva forma ya debería conocer
      for (const [lv] of learnList(d.species, d.house2)) if (lv <= d.level) api.learnAt(d, lv, res);
      DK.store.state.stats.evolutions++;
      DK.emit('evolved', { d, from, to: d.species });
      DK.store.save();
      return res;
    },

    /** Sustituye un ataque activo por otro aprendido (o lo añade si hay hueco). */
    setMove(d, moveId, replaceIndex) {
      if (!d.learned.includes(moveId) || d.moves.includes(moveId)) return false;
      if (replaceIndex == null || replaceIndex >= d.moves.length) {
        if (d.moves.length >= DK.config.maxMoves) return false;
        d.moves.push(moveId);
      } else d.moves[replaceIndex] = moveId;
      return true;
    },
    removeMove(d, index) { if (d.moves.length > 1) d.moves.splice(index, 1); },

    /** Próximos ataques que aprenderá: [[nivel, ataque]] */
    upcoming(d) { return learnList(d.species, d.house2).filter(([lv]) => lv > d.level); },
    /** v4.71: casas del daskai (1 o 2): [principal, segunda]. */
    houses(d) { const h1 = D.species[d.species].house; return d.house2 && d.house2 !== h1 ? [h1, d.house2] : [h1]; },
    /** ¿Es de doble casa? */
    isDual(d) { return !!(d && d.house2 && d.house2 !== D.species[d.species].house); },
    /** Lista de aprendizaje completa (especie + segunda casa). */
    learnset(d) { return learnList(d.species, d.house2); },
    house2Learn, otherHouse,

    /** Recompensa por liberar un daskai: piezas según su casa + monedas. */
    releaseReward(d) {
      const byHouse = { luz: 'polvo_brillante', oscuridad: 'esencia_sombria', agua: 'gota', fuego: 'brasa', tierra: 'piedra_runica' };
      const piece = byHouse[D.species[d.species].house];
      return { coins: 20 + d.level * 6, items: { [piece]: 1 + Math.floor(d.level / 15), pelaje: 1 } };
    },
    movesUpTo,
  });
  DK.daskai = api;

  /* ---------------- Grupo del jugador ---------------- */
  DK.party = {
    st() { return DK.store.state; },
    /** Todos los daskai del jugador. */
    all() { return this.st().party; },
    get(uid) { return this.all().find((d) => d.uid === uid); },
    /** Equipo activo (en orden; el primero es el líder). */
    active() { return this.st().team.map((u) => this.get(u)).filter(Boolean); },
    aliveActive() { return this.active().filter((d) => !api.isFainted(d)); },
    isActive(uid) { return this.st().team.includes(uid); },
    leader() { return this.active()[0]; },

    /** Añade un daskai a la colección (y al equipo si hay hueco). */
    add(d) {
      // v4.64: quien se une (captura, recluta, suceso...) llega con toda su vida y maná, sin estados
      if (d.cur) { delete d.wild; api.fullHeal(d); }
      if (this.all().length) d.isNew = Date.now(); // v4.57: marca «Nuevo» hasta que abras su ficha
      // v5.29: quien llega ya con nivel trae elegidos (al azar) los talentos de sus niveles anteriores;
      // sólo eliges los que gane subiendo contigo
      api.autoTalents(d);
      if (DK.trainer) DK.trainer.stamp(d); // v5.37: entrenador original
      // v5.39: variocolores conseguidos esta temporada (los recibidos en intercambios no cuentan)
      if (d.shiny && DK.trainer && DK.trainer.isMine(d) && DK.online) { const ss = this.st().seasonShiny, sea = DK.online.season(); this.st().seasonShiny = { season: sea, n: (ss && ss.season === sea ? ss.n : 0) + 1 }; }
      this.all().push(d);
      if (DK.looks) DK.looks.see(d);
      if (this.st().team.length < DK.config.maxTeam) this.st().team.push(d.uid);
      DK.store.save();
    },
    /**
     * ¿Puede entrar en el equipo ahora? Durante una expedición sólo los que
     * salieron con ella (e.members) y sus reclutas: el resto está en casa.
     */
    canJoin(uid) {
      if (DK.training && DK.training.isTraining(uid)) return false; // está de exploración
      if (DK.training && DK.training.isTired && DK.training.isTired(this.get(uid))) return false; // v4.86: vuelve agotado
      const e = DK.expedition && DK.expedition.active();
      if (!e || !e.members) return true;
      const d = this.get(uid);
      return !!d && (d.temp || e.members.includes(uid));
    },
    addToTeam(uid, index) {
      const t = this.st().team;
      if (t.includes(uid) || t.length >= DK.config.maxTeam || !this.canJoin(uid)) return false;
      if (index == null || index > t.length) t.push(uid); else t.splice(index, 0, uid);
      DK.store.save(); return true;
    },
    removeFromTeam(uid) {
      const t = this.st().team;
      if (t.length <= 1 || !t.includes(uid)) return false;
      this.st().team = t.filter((u) => u !== uid); DK.store.save(); return true;
    },
    /** Mueve un daskai activo a otra posición del equipo. */
    moveInTeam(uid, index) {
      const t = this.st().team.filter((u) => u !== uid);
      t.splice(Math.min(index, t.length), 0, uid);
      this.st().team = t; DK.store.save();
    },
    /** Pone un daskai en la posición de otro (si no estaba en el equipo, lo sustituye). */
    placeAt(uid, index) {
      const t = this.st().team;
      if (t.includes(uid)) return this.moveInTeam(uid, index);
      if (!this.canJoin(uid)) return false;
      if (t.length < DK.config.maxTeam) return this.addToTeam(uid, index);
      t[Math.min(index, t.length - 1)] = uid; DK.store.save(); return true;
    },
    setLeader(uid) { this.moveInTeam(uid, 0); },
    /** Cura por completo a todos (descanso). */
    healAll() { this.all().forEach((d) => api.fullHeal(d)); DK.store.save(); },

    /**
     * Libera un daskai y entrega la recompensa.
     * @returns {Object|null} recompensa o null si no se puede
     */
    release(uid) {
      const d = this.get(uid);
      if (!d || d.temp || d.locked || this.all().length <= 1 || (DK.training && DK.training.isTraining(uid))) return null;
      // v4.57: copia para poder deshacerlo (unrelease) mientras sale el aviso
      const snap = { d: JSON.parse(JSON.stringify(d)), at: this.all().indexOf(d), teamAt: this.st().team.indexOf(uid) };
      if (this.isActive(uid) && this.st().team.length <= 1) return null;
      const r = api.releaseReward(d);
      (d.equip || []).forEach((id) => id && DK.bag.add(id));
      DK.wallet.add(r.coins, { silent: true });
      Object.entries(r.items).forEach(([id, n]) => DK.bag.add(id, n));
      this._drop(uid);
      this.st().stats.released++;
      snap.r = r; this._lastRelease = snap;
      DK.store.save();
      return r;
    },
    /**
     * Deshace la última liberación (v4.57): devuelve el daskai a su sitio y retira lo que dio
     * (monedas, piezas y lo que llevaba equipado). false si ya no se puede (lo has gastado).
     */
    unrelease() {
      const s = this._lastRelease; if (!s) return false;
      const st = this.st(), items = Object.assign({}, s.r.items);
      (s.d.equip || []).forEach((id) => { if (id) items[id] = (items[id] || 0) + 1; });
      if ((st.coins || 0) < s.r.coins || Object.entries(items).some(([id, n]) => DK.bag.count(id) < n)) return false;
      this._lastRelease = null;
      st.coins -= s.r.coins; st.stats.coinsEarned = Math.max(0, (st.stats.coinsEarned || 0) - s.r.coins);
      Object.entries(items).forEach(([id, n]) => DK.bag.remove(id, n));
      st.party.splice(Math.min(s.at, st.party.length), 0, s.d);
      if (s.teamAt >= 0 && st.team.length < DK.config.maxTeam) st.team.splice(Math.min(s.teamAt, st.team.length), 0, s.d.uid);
      st.stats.released = Math.max(0, st.stats.released - 1);
      if (DK.boxes && DK.boxes.sync) DK.boxes.sync();
      DK.store.save();
      return s.d;
    },

    /**
     * Quita un daskai temporal (recluta de una expedición no completada).
     * Devuelve a la bolsa lo que llevara equipado.
     */
    /** Saca a un daskai de la colección y del equipo (sin más efectos). */
    _drop(uid) {
      this.st().party = this.all().filter((x) => x.uid !== uid);
      this.st().team = this.st().team.filter((x) => x !== uid);
    },
    removeTemp(uid) {
      const d = this.get(uid);
      if (!d) return;
      (d.equip || []).forEach((id) => id && DK.bag.add(id));
      this._drop(uid);
      if (!this.st().team.length && this.all().length) this.st().team.push(this.all()[0].uid);
      delete this.st().stats.usage[uid];
      DK.store.save();
    },

    /**
     * Muerte permanente (modo difícil): el daskai se va al cementerio.
     * Lo que llevaba equipado vuelve a la bolsa. Si no queda nadie → fin de la partida.
     */
    kill(uid, zoneId) {
      const d = this.get(uid); if (!d) return;
      const st = this.st();
      (d.equip || []).forEach((id) => id && DK.bag.add(id));
      st.graveyard = st.graveyard || [];
      if (!d.temp && DK.legacy) DK.legacy.create(d); // deja su esencia para heredar
      if (!d.temp) st.graveyard.unshift({ name: api.name(d), species: d.species, level: d.level, shiny: !!d.shiny, look: DK.looks.of(d), zone: zoneId, at: Date.now() });
      st.party = this.all().filter((x) => x.uid !== uid);
      st.team = st.team.filter((x) => x !== uid);
      delete st.stats.usage[uid];
      if (st.expedition && st.expedition.recruits) st.expedition.recruits = st.expedition.recruits.filter((x) => x !== uid);
      st.stats.deaths = (st.stats.deaths || 0) + 1;
      // Rellena el equipo con la colección si se ha quedado vacío
      if (!st.team.length) this.all().slice(0, DK.config.maxTeam).forEach((x) => st.team.push(x.uid));
      if (!this.all().length) st.gameOver = { at: Date.now(), zone: zoneId };
      DK.emit('daskai:died', { d, zone: zoneId });
      DK.store.save();
    },

    /** Daskai más usado en combate. */
    mostUsed() {
      const u = this.st().stats.usage || {};
      const best = Object.entries(u).sort((a, b) => b[1] - a[1])[0];
      return best ? { d: this.get(best[0]), battles: best[1] } : null;
    },
    /** Nivel medio del equipo activo. */
    avgLevel() { const a = this.active(); return a.length ? Math.round(a.reduce((s, d) => s + d.level, 0) / a.length) : 1; },
  };
})();
