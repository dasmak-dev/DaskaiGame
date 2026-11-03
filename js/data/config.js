/* =============================================================
 * data/config.js — Reglas generales del juego.
 * Cambia aquí los números para equilibrar la partida.
 * ============================================================= */
(function () {
  DK.config = {
    // --- Límites ---
    maxLevel: 100,
    maxMoves: 4,          // ataques activos por daskai
    maxEquip: 2,          // objetos equipados por daskai
    maxTeam: 5,           // daskai en el equipo de batalla
    starterLevel: 5,
    regenPct: 2,          // % de vida máxima regenerada por turno

    // --- Subida de nivel: puntos ganados por atributo ---
    // level: puntos de nivel (todos los atributos)
    // natureBonus: puntos extra si la naturaleza lo potencia (▲) → total 2-5
    // naturePenalty: puntos que quita si la naturaleza lo reduce (▼)
    // Puntos por nivel: [mín, máx] × ritmo (decimales al azar). Rango estrecho para que el ritmo (▲▲ / ▼▼) se note de verdad
    growth: { level: [2, 3], natureBonus: [1, 2], naturePenalty: [0, 1] },
    // Ritmo de crecimiento de cada atributo al subir de nivel (systems/daskai.js → growthWeight):
    //   especie (sus atributos fuertes crecen más) + pasivas (+/-) → multiplica los puntos por nivel
    growthBias: { species: 0.8, passive: 1.5, min: 0.45, max: 2 },
    evolveBonus: { hp: 6, mp: 3, atk: 2, matk: 2, def: 2, mdef: 2, spd: 2 }, // puntos extra al evolucionar
    // Tónicos (mejora permanente de un atributo): cuánto da cada uno y cuántos admite cada daskai
    tonic: { per: { hp: 6, mp: 4, atk: 2, matk: 2, def: 2, mdef: 2, spd: 2 }, cap: 15 },
    talentEvery: 10,      // cada cuántos niveles se elige un talento
    // Campo de entrenamiento (systems/training.js): entrena en tiempo real mientras no juegas
    training: {
      slots: 2,                                   // huecos base (+ mejora «Instructor»)
      cost: (lv, kind) => Math.round((30 + lv * 10) * (kind === 'stat' ? 1.6 : 1)), // monedas al entrar
      expPerHour: (lv) => Math.round(DK.config.expCurve(lv) * 0.5), // ≈ medio nivel por hora
      fullHours: 2, halfHours: 8, halfRate: 0.5,  // 100% las 2 primeras horas, 50% hasta las 8, luego nada
      levelMargin: 3,                             // nivel recomendado = el más alto de tus daskai − este margen
      overStep: 0.25, overMax: 4,                 // por cada nivel por encima del recomendado: +25% de monedas o de horas (máx. ×4)
      statHours: 1.5,                             // horas efectivas por punto de atributo
      statPer: { hp: 4, mp: 3, atk: 1, matk: 1, def: 1, mdef: 1, spd: 1 },
      statMax: 12,                                // puntos entrenados como mucho por daskai
      // Mejoras del campo (Instructor), se compran con MONEDAS en el propio campo (DK.training.buyLevel):
      // huecos extra, +% de ritmo, +niveles de tope y +puntos de atributo entrenables. Muy buenas y muy caras.
      instructor: [
        { slots: 0, rate: 0, cap: 0, statMax: 0 },
        { slots: 1, rate: 0.5, cap: 3, statMax: 4, cost: 2500 },
        { slots: 1, rate: 1, cap: 6, statMax: 8, cost: 8000 },
        { slots: 2, rate: 2, cap: 10, statMax: 14, cost: 20000 },
        { slots: 3, rate: 3, cap: 15, statMax: 20, cost: 50000 },
      ],
    },

    // --- Casas: atacante fuerte → daño x1.5 ; defensor fuerte → recibe un 25% menos ---
    house: { strongDamage: 1.5, weakDefense: 0.25 },

    // --- Huida según diferencia de nivel (aliado - enemigo) ---
    flee: { alwaysAt: 5, neverBelow: -5, base: 0.5 },

    // --- Experiencia ---
    /** Experiencia necesaria para pasar del nivel `lvl` al siguiente. */
    expCurve: (lvl) => Math.floor(8 * Math.pow(lvl, 1.5) + 12),
    /** Experiencia que da un enemigo derrotado. */
    expGain: (baseExp, enemyLevel) => Math.floor((baseExp * enemyLevel) / 2.5),

    // --- Combate ---
    critChance: 0.0625,
    critMult: 1.5,
    stageStep: 0.25,      // cada mejora/reducción en combate = 25%

    // --- Daskai salvajes, jefes y variocolor ---
    wildStatMult: 0.9,    // los salvajes son un 10% más débiles (al vincularlos pierden la penalización)
    shinyChance: 1 / 200, // probabilidad de variocolor
    shinyStatMult: 1.1,   // +10% atributos
    bossHpMult: 2.4,      // vida de los jefes
    bossStatMult: 1.15,   // resto de atributos de los jefes

    // --- Progreso ---
    // (La muerte permanente y la retirada dependen de la dificultad: data/difficulties.js)
    reviveHpPct: 0.1,     // vida con la que queda un daskai salvado de la muerte
    /** Herencia de un caído: experiencia y puntos de atributo que da su esencia. */
    legacyExp: (level) => Math.round(level * level * 4 + 60),
    legacyStat: (level) => Math.max(1, Math.round(level / 6)),
    freeBattleNeedsBoss: true, // los combates libres de una zona se desbloquean al completar su expedición
    /* Expediciones (systems/expedition.js): mapa de `rows` pisos + descanso + jefe.
       weights = probabilidad relativa de cada tipo de nodo (el piso 1 siempre es combate). */
    expedition: {
      rows: 10, eliteFrom: 2, branchChance: 0.45,
      // Tamaños de mapa (al azar cada vez que se genera uno): `rows` pisos normales
      // + hoguera + jefe → pequeño 12, mediano 20 y XL 31 (30 + jefe).
      // caves / shortcuts / rests = cuevas mínimas, atajos [mín, máx] y hogueras fijas por el camino
      // emblems = multiplicador de emblemas de los jefes (final y ocultos) en ese mapa
      sizes: {
        small: { rows: 10, weight: 45, caves: 1, shortcuts: [1, 2], rests: 1, emblems: 1, icon: 'map' },
        medium: { rows: 18, weight: 35, caves: 2, shortcuts: [2, 3], rests: 2, emblems: 2, icon: 'compass' },
        xl: { rows: 29, weight: 20, caves: 3, shortcuts: [3, 4], rests: 3, emblems: 3, icon: 'mountain' },
        // corto (sólo lo usan algunos tipos de expedición: weight 0 = nunca sale al azar)
        short: { rows: 6, weight: 0, caves: 0, shortcuts: [0, 0], rests: 0, emblems: 1, icon: 'flag' },
      },
      /* Tipos de expedición: salen AL AZAR (chance = peso; las Mejoras «Rumbo de…»
       * lo suben: DK.expedition.kindChances) y duran toda la expedición.
       *   weights   multiplica el peso de cada nodo (como los modificadores de mapa)
       *   sizes     tamaños posibles (si no, cualquiera con su peso)
       *   minRecruits / minElites  nodos garantizados · multiRecruit  puede haber varios reclutas en un piso
       *   capture   + probabilidad de vínculo · recruit  + candidatos en cada nodo de reclutas
       *   coins / exp  +% de monedas / experiencia · levels  + niveles de los rivales
       *   emblems   emblemas extra por cada jefe · needsBoss  hace falta haber vencido a algún jefe */
      kinds: {
        normal: { icon: 'compass', chance: 50, weights: {} },
        captura: { icon: 'paw', chance: 16, sizes: ['short'], weights: { recruit: 6, fight: 1.3, elite: 0.3, event: 0.6, treasure: 0.6, shop: 0.7, shrine: 0.4, cave: 0 }, minRecruits: 6, multiRecruit: true, capture: 0.15, recruit: 1, coins: -0.3 },
        combate: { icon: 'swords', chance: 16, weights: { fight: 2.4, elite: 2, event: 0.3, recruit: 0.4, treasure: 0.5, shop: 0.7, shrine: 0.6 }, minElites: 2, coins: 0.3, exp: 0.25 },
        tesoro: { icon: 'gift', chance: 12, weights: { treasure: 3, event: 1.6, shop: 1.6, cave: 2, fight: 0.6, elite: 0.6 }, coins: 0.2, levels: 1 },
        desafio: { icon: 'skull', chance: 6, sizes: ['short'], weights: { elite: 4, fight: 0.8, event: 0.3, recruit: 0.2, treasure: 0.5, shop: 0.8 }, minElites: 3, levels: 3, emblems: 1, coins: 0.2, needsBoss: true },
      },
      weights: { fight: 36, event: 20, elite: 10, recruit: 9, shop: 7, treasure: 8, rest: 5, shrine: 4, cave: 4 },
      // Atajos: nodos que permiten saltar `shortcutSkip` pisos (a cambio de vida del equipo)
      shortcuts: [1, 2], shortcutSkip: 3, shortcutHpCost: 0.2,
      caveMin: 1,          // cuevas garantizadas por mapa (guarida del jefe oculto de la zona)
      secretFinalChance: 0.35, // si ya venciste al jefe oculto, probabilidad de que sea el jefe final del mapa
      modChance: 0.5,      // probabilidad de que un mapa traiga un modificador (data/mapMods.js)
      campfireKeep: 0.5,   // al volver a casa desde una hoguera te llevas este % del botín (y todos los daskai)
      recruitChoices: 3,   // daskai entre los que eliges en un nodo de reclutamiento
      directToBag: ['batalla', 'mejora'], // categorías que van directas a la bolsa (usables ya); el resto espera al final
      chestRelicChance: 0.25, // probabilidad de reliquia en un cofre
      restHeal: 0.5,       // descanso: cura el 50% de vida y maná
      trainExpBase: 60,    // entrenar: experiencia como un enemigo de este valor base
      shopDiscount: 0,     // descuento del mercader sobre data/shop.js (0 = precio normal)
      // Mochila: lo que te llevas al salir (screens/expPrepare.js)
      packCapacity: 10,    // unidades (más con la Mejora «Equipaje»)
      packCategories: ['batalla', 'mejora', 'equipo'],
      bossDeathLoss: 0.75, // si caes contra el jefe de un mapa pierdes este % del botín y la mochila (no todo)
      // Tónicos (mejora permanente): probabilidad en cofres (sube con la profundidad), mini jefes y jefes
      tonicDrops: { chest: 0.04, chestPerDepth: 0.03, chestMax: 0.3, elite: 0.35, boss: 1, elixirBoss: 0.25 },
      consolation: { relic: ['raro', 'epico'], items: { superpocion: 2 } }, // y la próxima expedición empieza con esto
      curseChoices: 3,     // pactos que se ofrecen al empezar cada mapa (data/curses.js)
      // Pactos y reliquias iniciales se desbloquean con emblemas en el menú de Mejoras (DK.camp.unlock)
      unlockCost: { curse: 2, comun: 1, raro: 2, epico: 4 },
      noFreeHeal: true,    // en expedición no hay regeneración base ni curación al subir de nivel
      // Expediciones infinitas
      depthZoneStep: 0.8,  // cuánto avanza la zona "objetivo" por cada mapa superado (pickZone)
      depthLevel: 1,       // niveles extra de los rivales por cada mapa de profundidad
      depthLevelOver: 3,   // y además, por cada mapa más allá del número de zonas
      depthCoinBonus: 0.25, // +25% de monedas al terminar por cada mapa extra superado
      quest: { sizeMult: { small: 1, medium: 1.5, xl: 2 }, depthMult: 0.25 }, // premio de los encargos (data/quests.js)
      emblemsPerBoss: 1,   // emblemas (moneda de las mejoras permanentes) por jefe derrotado (× sizes[tamaño].emblems)
    },
    weakMult: 1.25,       // daño extra al punto débil de una especie (su defensa más baja)
    autoHeal: { at: 0.3, max: 3 }, // automático: cura con un objeto por debajo de este % de vida (máx. por combate)
    roleChance: 0.2,      // probabilidad de nacer con un RASGO (D.roles); el resto no tienen
    genes: 0.1,           // cada daskai nace con sus atributos base ±10% sobre los de su especie (al azar)
    stab: 1.2,            // ataque de la misma casa que el daskai que lo usa
    // Ruptura (jefes y élites): golpes buenos llenan la barra; al llenarse el rival pierde
    // su acción hasta el final del turno siguiente y recibe ×dmg. Cada ruptura sube la barra ×grow.
    breakGauge: { boss: 100, elite: 70, hit: 6, strong: 30, weak: 22, crit: 12, dmg: 1.5, grow: 1.4 },
    switchMult: 0.7,      // el daskai que entra al cambiar recibe este % del daño ese turno
    revealMovesAt: 2,     // combates contra una especie (en la zona) para ver sus ataques
    revealStatsAt: 3,     // … y para ver sus atributos
    guardMult: 0.5,       // «Defender»: el daño recibido ese turno se multiplica por esto
    guardMana: 0.08,      // y recupera este % de maná
    eliteHpMult: 1.6,     // vida de los rivales de élite
    eliteStatMult: 1.2,   // resto de atributos de élite
    eliteLevelBonus: 2,   // niveles por encima del máximo de la zona
    lossHpPct: 0.25,      // tras perder, tu equipo vuelve con este % de vida
    expShare: 0.3,        // % de experiencia para los demás daskai del equipo (no debilitados)
    captureOnlyInExpedition: true, // los cristales de vínculo sólo funcionan en expediciones
    historySize: 30,      // combates que guarda el historial del perfil
    expHistorySize: 20,   // expediciones que guarda el historial del perfil
    expeditionBonus: 1.5, // multiplicador de monedas al terminar tras un jefe (+depthCoinBonus por mapa extra)

    // --- Economía ---
    startingCoins: 150,
    /** Monedas que suelta un enemigo. */
    coinDrop: (level) => Math.floor(level * 3 + 4 + Math.random() * level * 2),
    sellRatio: 0.4,       // se vende al 40% del precio

    startingBag: { pocion: 3, cristal_vinculo: 1 }, // sólo lo esencial: el resto se consigue jugando

    // --- Objetos: sólo se consiguen en expediciones ---
    freeBattleDrops: false, // los combates libres no sueltan objetos (sólo experiencia y monedas)
    /** Precio de descansar en el campamento (0 = gratis). Cura por completo al equipo. */
    expItemChance: 0.5,    // probabilidad de un objeto de experiencia en cofres y rivales de élite
  };
})();
