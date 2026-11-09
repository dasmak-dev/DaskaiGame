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
    maxTeam: 6,           // daskai en el equipo de batalla
    starterLevel: 5,
    regenPct: 2,          // % de vida máxima regenerada por turno

    // --- Subida de nivel: puntos ganados por atributo ---
    // level: puntos de nivel (todos los atributos)
    // natureBonus: puntos extra si la naturaleza lo potencia (▲) → total 2-5
    // naturePenalty: puntos que quita si la naturaleza lo reduce (▼)
    // Puntos por nivel: [mín, máx] × ritmo (decimales al azar). Rango estrecho para que el ritmo (▲▲ / ▼▼) se note de verdad
    // v4.69: crecimiento más contenido. Cada nivel da entre 0 y 5 puntos por atributo (media ≈ 2):
    //   puntos = azar(level) × ritmo (especie y pasivas, growthBias) ± naturaleza, limitado a [min, max].
    //   Llegar a 5 sólo pasa con un atributo muy favorecido (especie fuerte en él + pasivas + naturaleza).
    // v4.71: daskai de doble casa. Los iniciales siempre; los jefes siempre (cada uno con su segunda casa fija);
    // en sitios especiales a menudo (élite, reclutas) y casi nunca en un combate normal. En total ≈ 1 de cada 10.
    dual: { wild: 0.04, elite: 0.5, recruit: 0.15, secret: 1, boss: 1 },
    growth: { level: [1, 3], natureBonus: [0, 1], naturePenalty: [0, 1], min: 0, max: 5 },
    // Ritmo de crecimiento de cada atributo al subir de nivel (systems/daskai.js → growthWeight):
    //   especie (sus atributos fuertes crecen más) + pasivas (+/-) → multiplica los puntos por nivel
    // v5.4: techo de la vida propia de tus daskai (sin el equipo): base + perLevel × nivel (Nv. 40 → 300 · Nv. 100 → 600; sube 5 por nivel como mucho)
    hpCap: { base: 100, perLevel: 5 },
    growthBias: { species: 0.7, passive: 1.5, min: 0.5, max: 1.4 }, // v5.4: máx. 1.4 (antes 1.6; la vida crecía demasiado)
    // Formas (v4.51): cada daskai sortea al nacer cuántas formas tendrá (1-4); el inicial siempre 4.
    //   levels: niveles para pasar a la forma siguiente · power: fuerza base de cada forma respecto a la
    //   primera de su línea (todas acaban igual; con menos formas empiezas más fuerte) · vis: etapa del dibujo.
    forms: {
      weights: { 1: 18, 2: 27, 3: 30, 4: 25 },
      levels: { 1: [], 2: [30], 3: [22, 44], 4: [16, 34, 54] },
      power: { 1: [1.7], 2: [1.32, 1.84], 3: [1.12, 1.48, 1.84], 4: [1, 1.26, 1.58, 1.84] },
      vis: { 1: [2], 2: [1, 3], 3: [0, 2, 3], 4: [0, 1, 2, 3] },
    },
    evolveBonus: { hp: 6, mp: 3, atk: 2, matk: 2, def: 2, mdef: 2, spd: 2 }, // puntos extra al evolucionar
    // Tónicos (mejora permanente de un atributo): cuánto da cada uno y cuántos admite cada daskai
    tonic: { per: { hp: 6, mp: 4, atk: 2, matk: 2, def: 2, mdef: 2, spd: 2 }, cap: 15 },
    talentEvery: 25,      // v4.96: cada cuántos niveles se elige un talento (25, 50, 75 y 100; antes 10)
    talentChoices: 3,     // v4.96: entre cuántos se elige (antes 2)
    // Campo de entrenamiento (systems/training.js): entrena en tiempo real mientras no juegas
    training: {
      slots: 2,                                   // huecos base (+ mejora «Instructor»)
      // Sólo experiencia. Cada minuto gana un % del nivel actual (cuanto más nivel, menos %):
      pct: (lv) => 0.008 / (1 + lv / 10),         // Nv 3 ≈ 0,6%/min · Nv 30 ≈ 0,2%/min · Nv 60 ≈ 0,1%/min (proceso lento)
      ramp: { perHour: 0.125, max: 2 },           // cuanto más tiempo, más rápido: ×(1 + 0,125·horas), hasta ×2 (8 h)
      fee: (lv) => 0.3 + lv * 0.04,               // monedas por minuto (× la misma aceleración) · se paga AL SACARLO
      maxHours: 24,                               // a partir de aquí ya no gana ni cobra más
      boosts: [1, 2, 3],                          // acelerar al dejarlo (se paga al dejarlo)
      boostCost: (lv, m) => Math.round((m - 1) * (60 + lv * 12)),
      statMax: 12,                                // (antiguo) puntos de atributo entrenados en versiones anteriores
      // Mejoras del campo (Instructor), en el propio campo (DK.training.buyLevel): cuestan EMBLEMAS de jefe + monedas.
      // Huecos extra (2 de base, 4 como mucho), +% de ritmo y descuento en lo que se cobra al sacarlo.
      instructor: [
        { slots: 0, rate: 0, discount: 0 },
        { slots: 1, rate: 0.1, discount: 0.05, emblems: 3, cost: 3000 },
        { slots: 1, rate: 0.2, discount: 0.1, emblems: 6, cost: 10000 },
        { slots: 2, rate: 0.35, discount: 0.15, emblems: 10, cost: 25000 },
        { slots: 2, rate: 0.5, discount: 0.2, emblems: 15, cost: 60000 },
      ],
    },

    // v4.86: Exploraciones (systems/training.js, DK.explore): sustituyen al campo de entrenamiento
    explore: {
      slots: 2,                 // grupos fuera a la vez (+ mejoras del Puesto de exploradores)
      partyMax: 3,              // daskai por grupo
      // k: multiplicador de botín y experiencia · rolls: materiales · rations: raciones de viaje · fatigue: min agotado si sale mal · risk: × riesgo
      durations: [
        { id: 'short', min: 30, k: 0.5, rolls: 2, rations: 1, fatigue: 60, risk: 0.8 },
        { id: 'mid', min: 120, k: 1, rolls: 4, rations: 2, fatigue: 120, risk: 1 },
        { id: 'long', min: 480, k: 2.6, rolls: 9, rations: 4, fatigue: 240, risk: 1.3 },
      ],
      coins: (zoneLv, k, n) => Math.round((20 + zoneLv * 3) * (0.5 + k * 0.5) * (0.7 + 0.3 * n)), // monedas al salir
      exp: 0.24,                // fracción de su nivel actual que gana por cada k (si no va muy sobrado)
      /* Riesgo de que algo salga mal (v4.89, más peligroso):
       *   base + (nivel de la zona − nivel medio del grupo) × perLevel
       *   × house si alguno es de la casa de la zona · × weak por cada uno débil contra ella
       *   × size según cuántos van (solo 1, 2 o 3) · × firme por cada Firme · × la duración · × (1 − Puesto)
       *   entre min y max. De lo que sale mal, una parte es DESASTRE: disaster + gap × (niveles por debajo), hasta disasterMax */
      risk: { base: 0.3, perLevel: 0.03, min: 0.08, max: 0.92, house: 0.75, weak: 1.15, firme: 0.8, size: [1.3, 1.1, 1], disaster: 0.3, gap: 0.04, disasterMax: 0.7 },
      hurt: 0.5,                // si vuelven agotados, traen la mitad de botín y experiencia
      // v4.89: DESASTRE: pierden todo el botín (monedas, objetos y equipo), traen esta parte de la experiencia y el agotamiento × disasterFatigue
      disasterExp: 0.2, disasterFatigue: 2,
      loot: {
        fragment: 0.22,         // por cada tirada de materiales
        ration: 0.25,           // × k: a veces encuentran una ración
        stone: [0.04, 0.1, 0.25],   // piedra común (corta / media / larga)
        gear: [0.03, 0.08, 0.2],    // equipo normal o mágico (nunca raro)
        magic: 0.25,
        stones: ['piedra_transmutacion', 'piedra_alteracion', 'piedra_aumento', 'piedra_cambio', 'piedra_nucleo'],
        coins: (lv) => 12 + lv * 4,
        // v4.87: hallazgo exclusivo de las exploraciones: un alijo con piedras (a veces raras), fragmentos y raciones
        cache: [0.01, 0.03, 0.08],
        cacheRare: ['piedra_regia', 'piedra_caos', 'piedra_templado', 'sello_forja'],
      },
      /* v4.89: lo PROPIO de cada zona (sólo explorándola): su REACTIVO de runas (forja de runas), su piedra de
       * forja favorita (sale el 40% de las veces que sale piedra), los tipos de equipo que más traen (70%)
       * y su hallazgo raro (un tónico). Las cantidades, por duración (corta / media / larga). */
      finds: {
        pradera: { reagent: 'tiza_runica', stone: 'piedra_transmutacion', gear: ['botas', 'capa'], rare: 'baya_saber' },
        bosque: { reagent: 'savia_runica', stone: 'piedra_alteracion', gear: ['baculo', 'amuleto'], rare: 'tonico_vida' },
        costa: { reagent: 'perla_runica', stone: 'piedra_aumento', gear: ['anillo', 'orbe'], rare: 'tonico_mana' },
        cavernas: { reagent: 'cuarzo_eco', stone: 'piedra_cambio', gear: ['daga', 'yelmo'], rare: 'tonico_hierro' },
        volcan: { reagent: 'ceniza_runica', stone: 'piedra_nucleo', gear: ['garra', 'martillo'], rare: 'tonico_fuerza' },
        templo: { reagent: 'tinta_sagrada', stone: 'piedra_regia', gear: ['espada', 'corona'], rare: 'tonico_espiritu' },
        pantano: { reagent: null, stone: 'piedra_alteracion', gear: ['daga', 'capa'], rare: 'ambar_fosil' }, // v5.0: zonas intermedias (sin reactivo propio)
        abismo: { reagent: 'tinta_abisal', stone: 'piedra_caos', gear: ['anillo', 'capa'], rare: 'tonico_magia' },
        glaciar: { reagent: null, stone: 'piedra_templado', gear: ['escudo', 'coraza'], rare: 'lagrima_glaciar' },
        cumbre: { reagent: 'escarcha_celeste', stone: 'piedra_templado', gear: ['escudo', 'botas'], rare: 'tonico_viento' },
        vacio: { reagent: 'polvo_vacio', stone: 'sello_forja', gear: ['espada', 'coraza'], rare: 'esencia_ancestral' },
      },
      findRates: {
        reagent: [0.5, 1.1, 2.6],     // reactivos de media (la parte entera seguro, el resto al azar); sólo con el Taller de runas
        favStone: 0.4,                // de las piedras, la favorita de la zona
        favGear: 0.7,                 // del equipo, de sus tipos
        rare: [0.02, 0.05, 0.12],     // su hallazgo raro
        rune: [0, 0.05, 0.15],        // una runa (zonas de nivel ≥ runeFrom; con el Taller de runas)
        runeFrom: 13,
        magicPerLv: 0.004,            // + probabilidad de equipo mágico por nivel de zona
        glyph: [0.01, 0.03, 0.08],    // v4.90: glifo de ascenso (zonas de nivel ≥ runeFrom)
        heart: [0, 0.006, 0.02], heartFrom: 50, // v4.90: corazón rúnico (zonas de nivel ≥ heartFrom)
      },
      gift: 6,                  // raciones de regalo al desbloquear las exploraciones
      // v4.87: encargos del día (se cumplen al recoger una exploración)
      requests: { base: 2, extraAt: 2, reward: (lv) => ({ coins: 40 + lv * 8, items: { racion_viaje: 2, fragmento_forja: 2 } }), stoneChance: 0.35 },
      // Bonus por naturaleza (key = texto de explore.nat.*)
      natures: {
        feroz: { key: 'feroz', exp: 0.2 },
        astuta: { key: 'astuta', rolls: 1 },
        sabia: { key: 'sabia', rare: 0.35 },
        firme: { key: 'firme', risk: true },
        valiente: { key: 'valiente', riskLv: 3 },
        serena: { key: 'serena', fatigue: 0.5 },
        tranquila: { key: 'tranquila', coins: 0.25 },
        impetuosa: { key: 'impetuosa', time: 0.12 },
        equilibrada: { key: 'equilibrada', exp: 0.05, coins: 0.05 },
      },
      events: ['rest', 'river', 'tracks', 'storm', 'ruins', 'wild', 'stars', 'lost'],
      // Puesto de exploradores (antes Instructor): grupos extra, +% botín y experiencia, −coste y −riesgo
      post: [
        { slots: 0, rate: 0, discount: 0, safety: 0 },
        { slots: 1, rate: 0.1, discount: 0.05, safety: 0.05, emblems: 3, cost: 3000 },
        { slots: 1, rate: 0.2, discount: 0.1, safety: 0.1, emblems: 6, cost: 10000 },
        { slots: 2, rate: 0.35, discount: 0.15, safety: 0.15, emblems: 10, cost: 25000 },
        { slots: 2, rate: 0.5, discount: 0.2, safety: 0.25, emblems: 15, cost: 60000 },
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
    bossStatMult: 1.2,    // resto de atributos de los jefes (v5.0: antes 1.15)
    // v5.0: los rivales crecen con su nivel para compensar lo que acumula tu equipo (equipo, talentos, tónicos…):
    // ×(base + perLevel × nivel) → Nv. 5 ×1.05 · Nv. 30 ×1.13 · Nv. 60 ×1.23 · Nv. 90 ×1.33 (el principio casi igual)
    enemyScale: { base: 1.03, perLevel: 0.0033 },

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
      /**
       * v5.5: pisos especiales (probabilidad por nodo desde `fromRow`):
       *   fight → 'chain' (oleada: al caer uno entra otro, 3 seguidos) o 'swap' (relevo: a media vida se cambia por
       *           otro con la vida llena; luego vuelve el primero) · recompensa ×`rewardMult`
       *   event → 'rare' (personaje especial que regala uno de 3 objetos especiales)
       *   shop  → 'curio' (mercader de rarezas: vende objetos especiales) o 'gift' (te regala uno a elegir)
       */
      specialItems: ['tonico_fuerza', 'tonico_magia', 'tonico_hierro', 'tonico_espiritu', 'tonico_viento', 'tonico_vida', 'tonico_mana', 'cristal_sabio', 'esencia_ancestral', 'pluma_fenix', 'elixir',
        'piedra_divina', 'piedra_exaltacion', 'piedra_alquimia', 'piedra_templado', 'sello_forja', 'ambar_fosil', 'lagrima_glaciar', 'hiperpocion'],
      specials: { fromRow: 2, fight: 0.14, event: 0.22, shop: 0.4, chainSize: 3, rewardMult: { chain: 2.2, swap: 1.8 } },
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
        // piso del Abismo (DK.abyss): corto y sin atajos
        abyss: { rows: 4, weight: 0, caves: 0, shortcuts: [0, 0], rests: 0, emblems: 1, icon: 'skull' },
      },
      /* Tipos de expedición: salen AL AZAR (chance = peso: DK.expedition.kindChances)
       * salvo que gastes una runa de tipo (DK.runes), y duran toda la expedición.
       *   weights   multiplica el peso de cada nodo (como los modificadores de mapa)
       *   sizes     tamaños posibles (si no, cualquiera con su peso)
       *   minRecruits / minElites  nodos garantizados · multiRecruit  puede haber varios reclutas en un piso
       *   capture   + probabilidad de vínculo · recruit  + candidatos en cada nodo de reclutas
       *   coins / exp  +% de monedas / experiencia · levels  + niveles de los rivales
       *   emblems   emblemas extra por cada jefe · needsBoss  hace falta haber vencido a algún jefe */
      // Curar al equipo con monedas antes de salir (Batalla): caro a propósito
      //   coste = Σ (vida que falta × perHp + maná que falta × perMp + fainted si está debilitado) × (1 + nivel × perLevel)
      healCoins: { perHp: 3, perMp: 1.5, fainted: 200, perLevel: 0.03, round: 10 },
      kinds: {
        normal: { icon: 'compass', chance: 50, weights: {} },
        captura: { icon: 'paw', chance: 16, sizes: ['short'], weights: { recruit: 6, fight: 1.3, elite: 0.3, event: 0.6, treasure: 0.6, shop: 0.7, shrine: 0.4, cave: 0 }, minRecruits: 6, multiRecruit: true, recruit: 1, shiny: 0.04, coins: -0.3 },
        combate: { icon: 'swords', chance: 16, weights: { fight: 2.4, elite: 2, event: 0.3, recruit: 0.4, treasure: 0.5, shop: 0.7, shrine: 0.6 }, minElites: 2, coins: 0.3, exp: 0.25 },
        // Tesoro: MUY rara (1%) pero muy buena: mínimo 5 cofres, cofres con +2 objetos, raros, reliquias épicas,
        // ×2,5 monedas y runa extra; +100% monedas en todo el mapa y +1 emblema por jefe
        tesoro: { icon: 'gift', chance: 1, weights: { treasure: 5, event: 1.2, shop: 1.4, cave: 2.5, fight: 0.5, elite: 0.5 }, minTreasures: 5, coins: 1, levels: 1, emblems: 1,
          chest: { items: 2, rare: 0.8, relic: 0.35, rune: 0.5, coins: 2.5 } },
        // El Abismo (DK.abyss): no sale al azar; se elige en Batalla
        abismo: { icon: 'moon', chance: 0, special: true, sizes: ['abyss'], weights: { elite: 2, fight: 1.4, event: 0.6, recruit: 0.4, treasure: 0.8, shop: 0.8, cave: 0 }, minElites: 1 },
        desafio: { icon: 'skull', chance: 6, sizes: ['short'], weights: { elite: 4, fight: 0.8, event: 0.3, recruit: 0.2, treasure: 0.5, shop: 0.8 }, minElites: 3, levels: 3, emblems: 1, coins: 0.2, needsBoss: true },
      },
      /* Runas de expedición (DK.runes): caen en cofres, élites y jefes y se guardan
       * para siempre. Antes de salir puedes gastar una de tamaño y/o una de tipo
       * para fijar el mapa (sin runas salen al azar) y runas de bonificación.
       * Se engastan en `slots` huecos.
       *   drop   probabilidad de runa en cofre / élite; jefe y jefe oculto: nº seguro
       *   list   runas: group 'size' | 'kind' (value = tamaño o tipo) | 'bonus' (coins / exp);
       *          weight = rareza al caer */
      runes: {
        drop: { treasure: 0.3, elite: 0.35, boss: 1, secret: 2 },
        list: {
          small: { group: 'size', value: 'small', icon: 'map', weight: 26 },
          medium: { group: 'size', value: 'medium', icon: 'compass', weight: 22 },
          xl: { group: 'size', value: 'xl', icon: 'mountain', weight: 12 },
          captura: { group: 'kind', value: 'captura', icon: 'paw', weight: 16 },
          combate: { group: 'kind', value: 'combate', icon: 'swords', weight: 16 },
          desafio: { group: 'kind', value: 'desafio', icon: 'skull', weight: 8 },
          // De bonificación: se pueden repetir (+% que se suma por cada una engastada)
          oro: { group: 'bonus', coins: 0.25, icon: 'coin', weight: 14 },
          saber: { group: 'bonus', exp: 0.25, icon: 'star', weight: 14 },
          // De final de juego (late: tras ver la Corrupción)
          elite: { group: 'bonus', elites: 1, icon: 'crown', weight: 8, late: true },
          maldito: { group: 'bonus', loot: 0.3, noRest: true, icon: 'skull', weight: 6, late: true },
        },
        tierMult: [1, 2, 4],     // bonificaciones × esto en los tiers I, II y III
        // Pisos del mapa según la runa de tamaño y su tier (I, II, III). Sin runa: el tamaño normal (sizes).
        tierFloors: { small: [8, 14, 18], medium: [14, 20, 26], xl: [20, 28, 36] },
        // Rareza al caer: normal (sin modificadores), mágica o rara. + DK.endgame.runeTier()/2
        rarity: { magic: 0.3, rare: 0.08 },
        // v4.89: como el equipo: mágica 1–2 modificadores (1 prefijo + 1 sufijo como mucho), rara 2–4 (2 + 2)
        // v4.90: LEGENDARIA (sólo mejorando una rara con el corazón rúnico): 3–4 modificadores, valores × 1,3 y +1 emblema por jefe
        rarities: { m: { mods: [1, 2], maxP: 1, maxS: 1 }, r: { mods: [2, 4], maxP: 2, maxS: 2 }, l: { mods: [3, 4], maxP: 2, maxS: 2, valueMult: 1.3, emblems: 1 } },
        // Modificadores (valor al azar entre min y max × tierScale). PREFIJOS: cambian el MAPA; SUFIJOS: las RECOMPENSAS
        affixes: {
          elitePct: { kind: 'prefix', min: 8, max: 15 },   // % de combates normales del mapa que pasan a ser élites (minijefes)
          treasures: { kind: 'prefix', min: 1, max: 1 },   // tesoros extra en el mapa
          recruits: { kind: 'prefix', min: 1, max: 1 },    // reclutas extra en el mapa
          caves: { kind: 'prefix', min: 1, max: 1 },       // cuevas extra
          shops: { kind: 'prefix', min: 1, max: 1 },       // v4.89: mercaderes extra
          shrines: { kind: 'prefix', min: 1, max: 1 },     // v4.89: santuarios extra
          coins: { kind: 'suffix', min: 8, max: 18 },      // +% monedas
          exp: { kind: 'suffix', min: 8, max: 18 },        // +% experiencia
          shiny: { kind: 'suffix', min: 1, max: 2 },       // +% variocolor en los reclutas
          relicFind: { kind: 'suffix', min: 8, max: 15 },  // v4.89: +% de reliquia en los cofres
          runeFind: { kind: 'suffix', min: 15, max: 30 },  // v4.89: +% de que caigan runas
          stoneFind: { kind: 'suffix', min: 15, max: 30 }, // v4.89: +% piedras de forja en los combates
        },
        /* v4.89: FORJA DE RUNAS (Crafteo → Runas): cada reactivo sale SÓLO explorando su zona (explore.finds).
         *   up: normal → mágica · alter: re-tira los de una mágica · add: añade uno (elige prefijo/sufijo)
         *   change: cambia uno elegido · rare: mágica → rara · values: re-tira los valores · chaos: re-tira los de una rara
         *   max: lleva uno elegido a su valor máximo · remove: quita uno elegido */
        reagents: {
          tiza_runica: 'up', savia_runica: 'alter', perla_runica: 'add', cuarzo_eco: 'change', ceniza_runica: 'rare',
          tinta_sagrada: 'values', tinta_abisal: 'chaos', escarcha_celeste: 'max', polvo_vacio: 'remove',
          glifo_ascenso: 'tier', corazon_runico: 'legend',   // v4.90: sustituyen a fundir (élites, jefes y exploraciones altas)
        },
        tierScale: [1, 1.5, 2],
        fuseCost: [500, 2000],   // monedas por subir de tier con el glifo de ascenso (a tier II, a tier III); fundir ya no está en pantalla
        slots: 5,   // huecos para engastar runas antes de partir (como mucho 1 de tamaño y 1 de tipo; v5.0: 5, antes 4)
      },
      weights: { fight: 36, event: 20, elite: 10, recruit: 9, shop: 7, treasure: 8, rest: 5, shrine: 4, cave: 4 },
      // Atajos: nodos que permiten saltar `shortcutSkip` pisos (a cambio de vida del equipo)
      shortcuts: [1, 2], shortcutSkip: 3, shortcutHpCost: 0.2,
      caveMin: 1,          // cuevas garantizadas por mapa (guarida del jefe oculto de la zona)
      secretFinalChance: 0.35, // si ya venciste al jefe oculto, probabilidad de que sea el jefe final del mapa
      modChance: 0.5,      // probabilidad de que un mapa traiga un modificador (data/mapMods.js)
      campfireKeep: 0.5,   // al volver a casa desde una hoguera te llevas este % del botín (y todos los daskai)
      recruitChoices: 3,   // daskai entre los que eliges en un nodo de reclutamiento
      recruitShinyChance: 0.04, // probabilidad de que un candidato a recluta sea variocolor
      directToBag: ['batalla', 'mejora'], // categorías que van directas a la bolsa (usables ya); el resto espera al final
      chestRelicChance: 0.25, // probabilidad de reliquia en un cofre
      restHeal: 0.5,       // descanso: cura el 50% de vida y maná
      trainExpBase: 60,    // entrenar: experiencia como un enemigo de este valor base
      shopDiscount: 0,     // descuento del mercader sobre data/shop.js (0 = precio normal)
      // Mochila: lo que te llevas al salir (screens/expPrepare.js)
      packCapacity: 10,    // unidades (más con la Mejora «Equipaje»)
      packCategories: ['batalla', 'mejora'], // v4.74: el equipo va puesto (las piezas sueltas se quedan en la armería)
      bossDeathLoss: 0.75, // si caes contra el jefe pierdes este % de las MONEDAS del botín (los objetos encontrados se pierden; la mochila, según difficulties.keepPack)
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
    eliteHpMult: 1.75,    // vida de los rivales de élite (v5.0: antes 1.6)
    eliteStatMult: 1.22,  // resto de atributos de élite (v5.0: antes 1.2)
    eliteLevelBonus: 2,   // niveles por encima del máximo de la zona
    lossHpPct: 0.25,      // tras perder, tu equipo vuelve con este % de vida
    expShare: 0.3,        // % de experiencia para los demás daskai del equipo (no debilitados)
    captureEnabled: false,         // vincular en combate (con cristales): desactivado por ahora; los daskai se consiguen en los nodos de reclutas
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
