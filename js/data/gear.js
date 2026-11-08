/* =============================================================
 * data/gear.js — Equipamiento con rareza (v4.74, estilo Path of Exile).
 *
 * Cada objeto de equipo de items.json ("category": "equipo") es una BASE.
 * Lo que tienes son PIEZAS de esa base (systems/gear.js), cada una con:
 *   · rareza: normal · mágico · raro · legendario (rarities)
 *   · atributos: bonificaciones planas del pool de su base (+9 ataque, +50 maná…)
 *   · afijos: prefijos (% a un atributo, % de daño) y sufijos (crítico, robo de
 *     vida, esquiva…), cada uno con un nivel (tier) del 1 al 5 según el nivel
 *     del objeto (ilvl)
 *   · legendario: además, la pasiva exclusiva de su base (legendary)
 *
 * Para añadir un afijo: una entrada en affixes { kind, fx|pct, tiers } y sus
 * textos en lang → gear.affix.<id> (name = adjetivo o «de …», text = efecto).
 * Para la pasiva legendaria de una base nueva: una entrada en legendary.
 * ============================================================= */
(function () {
  const G = (DK.data.gear = {});

  /**
   * Rarezas. attrs/affixes: [mín, máx] · maxP/maxS: tope de prefijos/sufijos
   * power: multiplica los atributos · drop: peso al salir de un combate normal,
   * de un mini jefe (elite) y de un jefe (boss) · salvage: fragmentos al desguazar
   */
  G.rarities = {
    normal: { order: 1, color: '#d4d7e2', attrs: [1, 2], affixes: [1, 1], maxP: 1, maxS: 1, maxTier: 2, basicOnly: true, power: 0.85, salvage: 1, drop: { fight: 70, elite: 30, boss: 0 } },
    magico: { order: 2, color: '#7b9bff', attrs: [2, 4], affixes: [1, 2], maxP: 2, maxS: 2, maxTier: 4, power: 1.1, salvage: 2, drop: { fight: 25, elite: 50, boss: 47 } },
    raro: { order: 3, color: '#f2c94c', attrs: [4, 5], affixes: [2, 4], maxP: 2, maxS: 2, power: 1.2, salvage: 4, drop: { fight: 5, elite: 20, boss: 50 } },
    legendario: { order: 4, color: '#ff8a3d', attrs: [4, 5], affixes: [2, 4], maxP: 2, maxS: 2, power: 1.4, salvage: 8, drop: { fight: 0, elite: 0, boss: 3 } },
  };
  G.rarityOrder = ['normal', 'magico', 'raro', 'legendario'];
  /**
   * v4.85: los normales sólo pueden llevar estos afijos «básicos» (basicOnly) y como mucho tier N2 (maxTier);
   * los mágicos llegan a N4 y con todo el pool; raros y legendarios, a N5. Los normales, además, pesan menos (power 0.85).
   */
  G.basicAffixes = ['p_atk', 'p_matk', 'p_def', 'p_mdef', 'p_spd', 'p_hp', 'p_mp', 'p_dmg', 's_crit', 's_critDmg', 's_leech', 's_guard', 's_dodge', 's_thorns', 's_mana', 's_regen'];

  /**
   * v4.76: tipo de cada base (lo que es: daga, corona, yelmo…). Da su icono, su nombre
   * en las piezas («Daga de Velmir») y el filtro de la pestaña Equipo de Crafteo.
   * Nombres en lang → gear.type.<tipo> (one / many).
   */
  G.types = {'garra': 'claw', 'daga': 'dagger', 'espada': 'sword', 'martillo': 'hammer', 'baculo': 'staff', 'orbe': 'orb', 'escudo': 'shield', 'coraza': 'armor', 'yelmo': 'helmet', 'capa': 'cloak', 'botas': 'boots', 'anillo': 'ring', 'amuleto': 'amulet', 'corona': 'crown'};
  G.typeOf = {'garra_afilada': 'garra', 'colmillo_umbrio': 'daga', 'amuleto_arcano': 'amuleto', 'orbe_solar': 'orbe', 'escama_dura': 'escudo', 'coraza_obsidiana': 'coraza', 'velo_mistico': 'capa', 'pluma_veloz': 'botas', 'botas_viento': 'botas', 'corazon_roca': 'yelmo', 'anillo_brasas': 'anillo', 'perla_marina': 'anillo', 'amuleto_vida': 'amuleto', 'corona_celeste': 'corona', 'amuleto_curativo': 'amuleto', 'tambor_guerra': 'yelmo', 'pluma_huracan': 'capa', 'raiz_maestra': 'baculo', 'colmillo_vampiro': 'daga', 'ascua_eterna': 'baculo', 'caracola_marea': 'orbe', 'prisma_juicio': 'espada', 'martillo_tierra': 'martillo', 'corazon_musgo': 'amuleto', 'emblema_furia': 'espada', 'caparazon_viejo': 'escudo', 'pluma_ligera': 'botas', 'cristal_vital': 'anillo', 'pendiente_arcano': 'anillo', 'sello_equilibrio': 'anillo', 'brasero_vivo': 'baculo', 'filo_vacio': 'espada', 'egida_vacio': 'escudo', 'corona_vacio': 'corona'};
  /**
   * v4.78: atributo PRINCIPAL de cada tipo: toda pieza lo lleva siempre (el primero, y
   * más fuerte: × primaryBoost). Dagas, garras y martillos → ataque; espadas, báculos
   * y orbes → ataque mágico; escudos y corazas → defensa; capas y amuletos → defensa
   * mágica; yelmos → vida; botas → velocidad; anillos y coronas → maná.
   */
  G.primary = { garra: 'atk', daga: 'atk', martillo: 'atk', espada: 'matk', baculo: 'matk', orbe: 'matk', escudo: 'def', coraza: 'def',
    capa: 'mdef', amuleto: 'mdef', yelmo: 'hp', botas: 'spd', anillo: 'mp', corona: 'mp' };
  G.primaryBoost = 1.3;
  /**
   * v4.78: prefijos y sufijos que puede tener cada objeto, según su atributo principal
   * (cada familia tiene los suyos; al menos 2 de cada para que quepan los de un raro).
   */
  G.affixPools = {
    // v4.81: más afijos por familia (6-7 prefijos y 6 sufijos) y menos solapados entre familias
    atk: ['p_atk', 'p_dmg', 'p_spd', 'p_hp', 'p_phys', 'p_pierce', 'p_full', 'p_fast', 'p_weak', 'p_brave', 's_crit', 's_critDmg', 's_leech', 's_dodge', 's_swift', 's_vigor', 's_critRes'],
    matk: ['p_matk', 'p_dmg', 'p_mp', 'p_spd', 'p_mag', 'p_pierce', 'p_full', 'p_weak', 'p_fresh', 's_crit', 's_critDmg', 's_mana', 's_regen', 's_heal', 's_swift', 's_exp'],
    def: ['p_def', 'p_hp', 'p_mdef', 'p_atk', 'p_full', 'p_phys', 'p_brave', 's_guard', 's_thorns', 's_regen', 's_leech', 's_vigor', 's_heal', 's_critRes', 's_critGuard'],
    mdef: ['p_mdef', 'p_mp', 'p_hp', 'p_matk', 'p_mag', 'p_def', 'p_sure', 's_guard', 's_mana', 's_regen', 's_dodge', 's_heal', 's_vigor', 's_lastGuard', 's_critRes', 's_exp'],
    hp: ['p_hp', 'p_def', 'p_mdef', 'p_dmg', 'p_full', 'p_atk', 'p_brave', 's_regen', 's_guard', 's_thorns', 's_leech', 's_vigor', 's_heal', 's_critGuard', 's_lastGuard'],
    spd: ['p_spd', 'p_atk', 'p_matk', 'p_dmg', 'p_pierce', 'p_full', 'p_fast', 'p_fresh', 'p_sure', 's_dodge', 's_crit', 's_critDmg', 's_mana', 's_swift', 's_leech', 's_gold'],
    mp: ['p_mp', 'p_matk', 'p_mdef', 'p_spd', 'p_mag', 'p_dmg', 'p_sure', 'p_fresh', 's_mana', 's_regen', 's_crit', 's_guard', 's_heal', 's_swift', 's_gold', 's_exp'],
  };
  /**
   * v4.81: afijo EXCLUSIVO de cada tipo de objeto (sólo puede salir en ese tipo; pesa el doble).
   * Es lo que hace distinta una daga de un martillo aunque compartan atributo principal.
   */
  G.typeAffix = { garra: 's_execute', daga: 'p_toxic', martillo: 'p_crush', espada: 'p_kin', baculo: 's_wisdom', orbe: 'p_surge', escudo: 's_endure',
    coraza: 'p_plate', capa: 'p_veil', amuleto: 's_ward', yelmo: 's_rage', botas: 'p_ambush', anillo: 's_feast', corona: 'p_regal' };


  /** Sílabas de los nombres propios de las piezas (como los de los daskai, pero de forja). */
  G.syl = {
    a: ['Vel', 'Kar', 'Mor', 'Ys', 'Thal', 'Ren', 'Dra', 'Ul', 'Syl', 'Gor', 'Ae', 'Nim', 'Zar', 'Ost', 'Bri', 'Ka', 'Lu', 'Fen', 'Or', 'Quel', 'Tor', 'Ash', 'Mal', 'Ery', 'Vor', 'Il', 'Sar', 'Hel'],
    b: ['mir', 'dris', 'thos', 'vane', 'gorn', 'lith', 'ra', 'nor', 'eth', 'ion', 'ur', 'dal', 'zek', 'wyn', 'a', 'ys', 'iel', 'oth', 'mar', 'ak', 'en', 'is', 'una', 'rath'],
    c: ['', '', '', '', 'ar', 'el', 'is', 'on', 'eth', 'ul'],
  };

  /** Valor base de un atributo plano (nivel de objeto 0, base «raro»). Se escala con el ilvl. */
  G.units = { hp: 18, mp: 15, atk: 5, matk: 5, def: 5, mdef: 5, spd: 4, regen: 1 };
  /** Calidad de la base según su rareza en items.json (las épicas y legendarias dan más). */
  G.baseTier = { comun: 0.9, raro: 1, epico: 1.25, legendario: 1.45 };
  /** Escala por nivel de objeto: × (1 + ilvl / ilvlScale). */
  G.ilvlScale = 40;
  /** Margen de la tirada de un atributo: valor × [roll[0], roll[1]]. */
  G.roll = [0.75, 1.25];
  /** Atributos afines: completan el pool de una base hasta poolSize. */
  G.affinity = {
    atk: ['spd', 'hp', 'def'], matk: ['mp', 'mdef', 'spd'], def: ['hp', 'mdef', 'atk'], mdef: ['mp', 'def', 'matk'],
    spd: ['atk', 'hp', 'matk'], hp: ['def', 'mdef', 'regen'], mp: ['matk', 'mdef', 'hp'], regen: ['hp', 'def', 'mdef'],
  };
  G.poolSize = 6;

  /** Nivel de objeto mínimo de cada tier (1 = el peor, 5 = el mejor) y su peso al tirar. */
  G.tiers = { ilvl: [0, 10, 25, 45, 65], weight: [10, 8, 6, 4, 2] };

  /**
   * Afijos. pct: % a un atributo (suma como una pasiva) · fx: efecto en combate
   *   dmg: +% daño · crit: +% prob. de crítico · critDmg: +% daño crítico
   *   leech: % del daño hecho que recupera · guard: -% daño recibido
   *   dodge: % de esquivar · thorns: % del daño recibido que devuelve
   *   mana: % del maná máximo que recupera al golpear · regen: % de regeneración
   *   v4.81: physDmg/magDmg (+% daño físico/mágico) · pierce (ignora % de la defensa) · fullDmg (con la vida llena)
   *   healBoost (+% curación) · execute (rival < 35% vida) · statusDmg (rival con estado) · breakPow (+% ruptura)
   *   stabDmg (ataques de su casa) · mpCost (-% maná) · strongDmg (golpes eficaces) · endure (aguantar a 1 PV, 1 vez)
   *   guardPhys/guardMag · statusRes (evitar estados) · rageDmg (< 50% vida) · opener (primer golpe) · killHeal · bossDmg
   *   only: tipo de objeto en el que es exclusivo (G.typeAffix)
   * tiers: [mín, máx] de cada tier (en %); boost: atributos de base que lo hacen más probable.
   */
  G.affixes = {
    // Prefijos
    p_atk: { kind: 'prefix', pct: 'atk', boost: ['atk'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    p_matk: { kind: 'prefix', pct: 'matk', boost: ['matk'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    p_def: { kind: 'prefix', pct: 'def', boost: ['def'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    p_mdef: { kind: 'prefix', pct: 'mdef', boost: ['mdef'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    p_spd: { kind: 'prefix', pct: 'spd', boost: ['spd'], tiers: [[2, 4], [5, 7], [8, 10], [11, 13], [14, 18]] },
    p_hp: { kind: 'prefix', pct: 'hp', boost: ['hp', 'def'], tiers: [[4, 6], [7, 10], [11, 14], [15, 19], [20, 26]] },
    p_mp: { kind: 'prefix', pct: 'mp', boost: ['mp', 'matk'], tiers: [[5, 8], [9, 13], [14, 18], [19, 24], [25, 32]] },
    p_dmg: { kind: 'prefix', fx: 'dmg', boost: ['atk', 'matk'], tiers: [[2, 3], [4, 6], [7, 9], [10, 13], [14, 18]] },
    // Sufijos
    s_crit: { kind: 'suffix', fx: 'crit', boost: ['atk', 'spd'], tiers: [[1, 2], [3, 4], [5, 6], [7, 9], [10, 12]] },
    s_critDmg: { kind: 'suffix', fx: 'critDmg', boost: ['atk', 'matk'], tiers: [[5, 9], [10, 15], [16, 22], [23, 30], [31, 40]] },
    s_leech: { kind: 'suffix', fx: 'leech', boost: ['atk', 'hp'], tiers: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 11]] },
    s_guard: { kind: 'suffix', fx: 'guard', boost: ['def', 'mdef', 'hp'], tiers: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 11]] },
    s_dodge: { kind: 'suffix', fx: 'dodge', boost: ['spd'], tiers: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]] },
    s_thorns: { kind: 'suffix', fx: 'thorns', boost: ['def'], tiers: [[3, 6], [7, 11], [12, 16], [17, 23], [24, 32]] },
    s_mana: { kind: 'suffix', fx: 'mana', boost: ['mp', 'matk'], tiers: [[1, 2], [2, 3], [3, 5], [5, 7], [7, 10]] },
    s_regen: { kind: 'suffix', fx: 'regen', boost: ['hp', 'regen'], tiers: [[1, 1], [1, 2], [2, 2], [2, 3], [3, 4]] },
    // v4.81: nuevos (compartidos por varias familias)
    p_phys: { kind: 'prefix', fx: 'physDmg', boost: ['atk'], tiers: [[3, 5], [6, 9], [10, 13], [14, 18], [19, 25]] },
    p_mag: { kind: 'prefix', fx: 'magDmg', boost: ['matk'], tiers: [[3, 5], [6, 9], [10, 13], [14, 18], [19, 25]] },
    p_pierce: { kind: 'prefix', fx: 'pierce', boost: ['atk', 'matk', 'spd'], tiers: [[2, 4], [5, 7], [8, 10], [11, 14], [15, 20]] },
    p_full: { kind: 'prefix', fx: 'fullDmg', boost: ['hp', 'def'], tiers: [[4, 6], [7, 10], [11, 15], [16, 21], [22, 30]] },
    s_vigor: { kind: 'suffix', pct: 'hp', boost: ['hp'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    s_swift: { kind: 'suffix', pct: 'spd', boost: ['spd'], tiers: [[2, 3], [4, 6], [7, 9], [10, 12], [13, 16]] },
    s_heal: { kind: 'suffix', fx: 'healBoost', boost: ['hp', 'mdef'], tiers: [[5, 9], [10, 15], [16, 22], [23, 30], [31, 40]] },
    // v4.82: cinco prefijos y cinco sufijos más
    p_fast: { kind: 'prefix', fx: 'fastDmg', boost: ['spd'], tiers: [[4, 6], [7, 10], [11, 15], [16, 21], [22, 28]] },
    p_brave: { kind: 'prefix', fx: 'underdog', boost: ['hp', 'def'], tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    p_sure: { kind: 'prefix', fx: 'acc', boost: ['spd', 'mp'], tiers: [[2, 3], [4, 5], [6, 8], [9, 11], [12, 15]] },
    p_weak: { kind: 'prefix', fx: 'weakDmg', boost: ['atk', 'matk'], tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    p_fresh: { kind: 'prefix', fx: 'freshDmg', boost: ['matk', 'spd'], tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    s_critRes: { kind: 'suffix', fx: 'critRes', boost: ['def', 'mdef'], tiers: [[2, 3], [4, 5], [6, 8], [9, 11], [12, 15]] },
    s_critGuard: { kind: 'suffix', fx: 'critGuard', boost: ['def', 'hp'], tiers: [[5, 9], [10, 15], [16, 22], [23, 30], [31, 40]] },
    s_lastGuard: { kind: 'suffix', fx: 'lastGuard', boost: ['hp', 'mdef'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    s_gold: { kind: 'suffix', fx: 'goldFind', boost: ['mp'], tiers: [[4, 6], [7, 10], [11, 15], [16, 21], [22, 30]] },
    s_exp: { kind: 'suffix', fx: 'expFind', boost: ['mp', 'matk'], tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    // v4.81: exclusivos de un tipo (only)
    s_execute: { kind: 'suffix', fx: 'execute', only: 'garra', tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    p_toxic: { kind: 'prefix', fx: 'statusDmg', only: 'daga', tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    p_crush: { kind: 'prefix', fx: 'breakPow', only: 'martillo', tiers: [[8, 12], [13, 19], [20, 27], [28, 36], [37, 50]] },
    p_kin: { kind: 'prefix', fx: 'stabDmg', only: 'espada', tiers: [[3, 5], [6, 9], [10, 13], [14, 18], [19, 25]] },
    s_wisdom: { kind: 'suffix', fx: 'mpCost', only: 'baculo', tiers: [[4, 6], [7, 10], [11, 14], [15, 19], [20, 25]] },
    p_surge: { kind: 'prefix', fx: 'strongDmg', only: 'orbe', tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    s_endure: { kind: 'suffix', fx: 'endure', only: 'escudo', tiers: [[4, 6], [7, 10], [11, 15], [16, 21], [22, 30]] },
    p_plate: { kind: 'prefix', fx: 'guardPhys', only: 'coraza', tiers: [[2, 4], [5, 7], [8, 10], [11, 14], [15, 18]] },
    p_veil: { kind: 'prefix', fx: 'guardMag', only: 'capa', tiers: [[2, 4], [5, 7], [8, 10], [11, 14], [15, 18]] },
    s_ward: { kind: 'suffix', fx: 'statusRes', only: 'amuleto', tiers: [[6, 10], [11, 16], [17, 23], [24, 31], [32, 40]] },
    s_rage: { kind: 'suffix', fx: 'rageDmg', only: 'yelmo', tiers: [[5, 8], [9, 13], [14, 19], [20, 26], [27, 35]] },
    p_ambush: { kind: 'prefix', fx: 'opener', only: 'botas', tiers: [[10, 15], [16, 24], [25, 34], [35, 46], [47, 60]] },
    s_feast: { kind: 'suffix', fx: 'killHeal', only: 'anillo', tiers: [[3, 5], [6, 8], [9, 12], [13, 16], [17, 22]] },
    p_regal: { kind: 'prefix', fx: 'bossDmg', only: 'corona', tiers: [[4, 6], [7, 10], [11, 15], [16, 21], [22, 28]] },
  };

  /** Topes de los efectos de combate sumando todo el equipo (en tanto por uno). */
  G.caps = { crit: 0.4, dodge: 0.3, guard: 0.4, leech: 0.3, thorns: 0.6, mana: 0.2, dmg: 0.8, critDmg: 1.5,
    physDmg: 0.6, magDmg: 0.6, pierce: 0.4, fullDmg: 0.6, healBoost: 1, execute: 0.8, statusDmg: 0.6, breakPow: 1, stabDmg: 0.6, mpCost: 0.5,
    strongDmg: 0.6, endure: 0.5, guardPhys: 0.4, guardMag: 0.4, statusRes: 0.6, rageDmg: 0.6, opener: 1, killHeal: 0.4, bossDmg: 0.6,
    fastDmg: 0.6, underdog: 0.6, acc: 0.3, weakDmg: 0.6, freshDmg: 0.6, critRes: 0.3, critGuard: 0.4, lastGuard: 0.4, goldFind: 1, expFind: 1 };

  /**
   * Pasiva exclusiva de cada base al ser legendaria. Se registra en D.passives
   * como «leg_<base>» (legendary: true) y funciona como cualquier pasiva
   * (mods, regen, entry); fx suma efectos de combate como los sufijos.
   * [nombre, descripción, efecto]
   */
  const all = (v) => ({ hp: v, mp: v, atk: v, matk: v, def: v, mdef: v, spd: v });
  G.legendary = {
    garra_afilada: ['Desgarro', '+10% crítico y +30% daño crítico.', { fx: { crit: 0.1, critDmg: 0.3 } }],
    colmillo_umbrio: ['Hambre umbría', '+10% ataque físico y recupera un 8% del daño que hace.', { mods: { atk: 0.1 }, fx: { leech: 0.08 } }],
    amuleto_arcano: ['Mente desbordada', '+15% ataque mágico y +20% maná.', { mods: { matk: 0.15, mp: 0.2 } }],
    orbe_solar: ['Mediodía', '+18% ataque mágico y +6% daño.', { mods: { matk: 0.18 }, fx: { dmg: 0.06 } }],
    escama_dura: ['Piel de dragón', '+10% defensa y -10% daño recibido.', { mods: { def: 0.1 }, fx: { guard: 0.1 } }],
    coraza_obsidiana: ['Muralla negra', '+25% defensa y devuelve un 15% del daño; -5% velocidad.', { mods: { def: 0.25, spd: -0.05 }, fx: { thorns: 0.15 } }],
    velo_mistico: ['Velo de niebla', '+12% defensa mágica y 10% de esquivar.', { mods: { mdef: 0.12 }, fx: { dodge: 0.1 } }],
    pluma_veloz: ['Viento a favor', '+18% velocidad. Al entrar: +25% velocidad durante 3 turnos.', { mods: { spd: 0.18 }, entry: { target: 'self', stats: ['spd'], pct: 0.25, turns: 3 } }],
    botas_viento: ['Paso de tormenta', '+15% velocidad y 8% de esquivar.', { mods: { spd: 0.15 }, fx: { dodge: 0.08 } }],
    corazon_roca: ['Latido de montaña', '+20% vida y +2% de regeneración.', { mods: { hp: 0.2 }, regen: 2 }],
    anillo_brasas: ['Ascuas gemelas', '+10% ataque físico y mágico y +5% crítico.', { mods: { atk: 0.1, matk: 0.1 }, fx: { crit: 0.05 } }],
    perla_marina: ['Marea interior', '+15% maná y recupera un 6% del maná al golpear.', { mods: { mp: 0.15 }, fx: { mana: 0.06 } }],
    amuleto_vida: ['Fuente eterna', '+10% vida y +4% de regeneración.', { mods: { hp: 0.1 }, regen: 4 }],
    corona_celeste: ['Corona del alba', '+6% a todos los atributos.', { mods: all(0.06) }],
    amuleto_curativo: ['Manos sanadoras', '+3% de regeneración y recupera un 4% del daño que hace.', { regen: 3, fx: { leech: 0.04 } }],
    tambor_guerra: ['Grito de guerra', '+8% ataque físico. Al entrar: el rival -20% ataque físico durante 3 turnos.', { mods: { atk: 0.08 }, entry: { target: 'enemy', stats: ['atk'], pct: -0.2, turns: 3 } }],
    pluma_huracan: ['Ojo del huracán', '12% de esquivar.', { fx: { dodge: 0.12 } }],
    raiz_maestra: ['Raíces profundas', '+12% defensas y +2% de regeneración.', { mods: { def: 0.12, mdef: 0.12 }, regen: 2 }],
    colmillo_vampiro: ['Sed eterna', 'Recupera un 12% del daño que hace.', { fx: { leech: 0.12 } }],
    ascua_eterna: ['Hoguera viva', '+8% ataque mágico y +10% daño.', { mods: { matk: 0.08 }, fx: { dmg: 0.1 } }],
    caracola_marea: ['Canto de marea', '+12% defensa mágica y recupera un 8% del maná al golpear.', { mods: { mdef: 0.12 }, fx: { mana: 0.08 } }],
    prisma_juicio: ['Juicio final', '+8% crítico y +40% daño crítico.', { fx: { crit: 0.08, critDmg: 0.4 } }],
    martillo_tierra: ['Temblor', '+12% daño; -5% velocidad.', { mods: { spd: -0.05 }, fx: { dmg: 0.12 } }],
    corazon_musgo: ['Musgo eterno', '+8% defensa y +3% de regeneración.', { mods: { def: 0.08 }, regen: 3 }],
    emblema_furia: ['Furia desatada', '+18% ataque físico y +20% daño crítico.', { mods: { atk: 0.18 }, fx: { critDmg: 0.2 } }],
    caparazon_viejo: ['Caparazón milenario', '-14% daño recibido; -8% velocidad.', { mods: { spd: -0.08 }, fx: { guard: 0.14 } }],
    pluma_ligera: ['Pluma de viento', '+20% velocidad y 5% de esquivar.', { mods: { spd: 0.2 }, fx: { dodge: 0.05 } }],
    cristal_vital: ['Cristal de vida', '+18% vida y +1% de regeneración.', { mods: { hp: 0.18 }, regen: 1 }],
    pendiente_arcano: ['Eco arcano', '+22% ataque mágico y +4% crítico.', { mods: { matk: 0.22 }, fx: { crit: 0.04 } }],
    sello_equilibrio: ['Equilibrio perfecto', '+5% a todos los atributos y -5% daño recibido.', { mods: all(0.05), fx: { guard: 0.05 } }],
    brasero_vivo: ['Brasero voraz', '+8% daño y recupera un 5% del daño que hace.', { fx: { dmg: 0.08, leech: 0.05 } }],
    filo_vacio: ['Filo del vacío', '+12% crítico, +50% daño crítico y +8% daño.', { fx: { crit: 0.12, critDmg: 0.5, dmg: 0.08 } }],
    egida_vacio: ['Égida del vacío', '+10% vida, -15% daño recibido y devuelve un 20% del daño.', { mods: { hp: 0.1 }, fx: { guard: 0.15, thorns: 0.2 } }],
    corona_vacio: ['Corona del vacío', '+10% a todos los atributos y +6% daño.', { mods: all(0.1), fx: { dmg: 0.06 } }],
  };
  // Se registran como pasivas (fuera de los sorteos: legendary = true)
  Object.entries(G.legendary).forEach(([base, [name, desc, fx]]) => {
    const id = 'leg_' + base;
    DK.data.passives[id] = Object.assign({ id, name, desc, legendary: true, base }, fx);
  });

  /**
   * Piedras de forja que se pueden encontrar al ganar combates de expedición
   * (además del botín normal). [objeto, probabilidad] por tipo de combate.
   */
  // v4.85: las piedras salen bastante menos (≈ 1,5–2 por expedición); los fragmentos, igual
  G.drops = {
    fight: [['fragmento_forja', 0.5], ['racion_viaje', 0.08], ['piedra_transmutacion', 0.018], ['piedra_alteracion', 0.0144], ['piedra_aumento', 0.009], ['piedra_cambio', 0.0072], ['piedra_nucleo', 0.0072], ['piedra_purga', 0.0072], ['piedra_regia', 0.0045],
      ['piedra_alquimia', 0.0022], ['piedra_caos', 0.0054], ['piedra_anulacion', 0.0018], ['piedra_divina', 0.0018], ['piedra_templado', 0.0014], ['sello_forja', 0.0014]],
    elite: [['fragmento_forja', 1], ['fragmento_forja', 0.5], ['racion_viaje', 0.3], ['piedra_transmutacion', 0.072], ['piedra_alteracion', 0.06], ['piedra_aumento', 0.036], ['piedra_cambio', 0.036], ['piedra_nucleo', 0.036], ['piedra_regia', 0.024], ['piedra_alquimia', 0.012],
      ['piedra_caos', 0.0288], ['piedra_anulacion', 0.012], ['piedra_exaltacion', 0.0072], ['piedra_divina', 0.0072], ['piedra_templado', 0.0072], ['sello_forja', 0.0072], ['esquirla_jefe', 0.0192]],
    // Jefes: lo exclusivo (esquirla, eco y el corazón, muy raro)
    boss: [['fragmento_forja', 1], ['fragmento_forja', 1], ['piedra_regia', 0.168], ['piedra_alquimia', 0.084], ['piedra_caos', 0.126], ['piedra_exaltacion', 0.0252], ['piedra_divina', 0.0504],
      ['piedra_templado', 0.042], ['sello_forja', 0.042], ['esquirla_jefe', 0.21], ['esquirla_jefe', 0.063], ['eco_legendario', 0.0126], ['corazon_jefe', 0.021]],
  };
})();
