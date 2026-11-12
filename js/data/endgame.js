/* =============================================================
 * data/endgame.js — Contenido para el final del juego (systems/endgame.js).
 *
 *  corruption  Niveles de Corrupción (1-5): se ven tras vencer al jefe de la
 *              3ª zona del mapa del mundo; el nivel n+1 se abre al vencer al
 *              jefe de un mapa con el n activo. Son acumulativos.
 *                levels/stat  rivales: + niveles y +% de atributos
 *                rule         regla nueva de ese nivel (se suman las anteriores)
 *                emblems/coins/shiny/tier  premios: + emblemas por jefe, +% de
 *                monedas, + variocolor en reclutas, + prob. de runa de tier más alto
 *  abyss       El Abismo (v5.1): jefes de la zona y de las anteriores seguidos (boss rush), por rondas cada vez más duras.
 *  nightmare   Versión pesadilla de una zona con el códice al 100%.
 *  ascension   Ascender al nivel máximo: vuelve al 1 con una estrella.
 *  variants    Formas alternativas (objeto que transforma una forma final).
 *  tracking    Rastreo de variocolores por especie.
 *  engrave     Reliquias grabadas (salen siempre al empezar la expedición).
 *  seasons     Temporadas de la Senda del aventurero.
 * ============================================================= */
(function () {
  DK.data.endgame = {
    corruption: {
      zoneIndex: 2, // jefe de la 3ª zona
      // v5.46: la corrupción se nota de verdad: cada nivel sube MUCHO los atributos (stat) y además la vida (hp)
      // de todos los rivales; a cambio, premios bastante mejores (emblemas, monedas, variocolor, runas y reliquias raras)
      levels: [
        { levels: 4, stat: 0.25, hp: 0.20, rule: null, emblems: 1, coins: 0.25, shiny: 0.01, tier: 0.20, relic: 0.10 },
        { levels: 8, stat: 0.50, hp: 0.45, rule: 'restHalf', emblems: 2, coins: 0.55, shiny: 0.02, tier: 0.30, relic: 0.20 },
        { levels: 12, stat: 0.80, hp: 0.70, rule: 'bossHp', emblems: 4, coins: 0.90, shiny: 0.03, tier: 0.45, relic: 0.30 },
        { levels: 16, stat: 1.10, hp: 1.00, rule: 'shopDouble', emblems: 6, coins: 1.30, shiny: 0.05, tier: 0.55, relic: 0.40 },
        { levels: 20, stat: 1.45, hp: 1.30, rule: 'noShortcuts', emblems: 8, coins: 1.80, shiny: 0.07, tier: 0.70, relic: 0.55 },
      ],
      bossHp: 1.5, restMult: 0.5, shopMult: 2,
    },
    abyss: {
      // v5.1: el Abismo es un «boss rush» de cada zona: sus jefes y los de las zonas anteriores, seguidos,
      // con una hoguera o un mercader entre jefe y jefe; al acabar la serie puedes seguir con otra ronda más dura.
      bosses: 5,          // jefes de zona vencidos para abrirlo (y además hay que haber vencido al de esa zona)
      series: 5,          // jefes por ronda: los de las (series - 1) zonas anteriores y, al final, el de la zona
      baseLevel: 4,       // + niveles sobre el jefe de la zona para todos los jefes de la serie
      roundLevel: 2,      // + niveles por cada jefe de la serie (el último, el más duro)
      depthLevel: 6,      // + niveles por cada ronda superada (DK.expedition.levelBonus)
      depthStat: 0.06,    // +% de atributos por ronda
      every: 1,           // premio de ronda: cada ronda completa
      perBoss: (round) => ({ emblems: 1, coins: 150 * round }),
      reward: (round) => ({ emblems: 3 + round, rune: Math.min(3, 1 + Math.floor(round / 2)), coins: 800 * round, abisal: round % 3 === 0 }),
    },
    nightmare: { levels: 8, stat: 0.2, coins: 0.4, emblems: 1 },
    ascension: { maxStars: 5, statPerStar: 0.06 },
    variants: { abisal: { stat: 0.08, item: 'fragmento_abisal' } },
    tracking: { perDefeat: 0.001, cap: 0.03 },
    engrave: { cost: 8, rarities: ['epico'], slots: 1, extraSlotAt: 3 },
    // Temporadas de la Senda: duran `days` días desde `start` (lunes)
    seasons: { start: '2026-11-02', days: 42 },
    // Drops extra para el final: fragmento abisal
    abisalDrop: { secret: 0.5, finalZone: 1, corruption: 0.25 },
    finalZone: 'vacio',
    /* v5.31: EL AVERNO (DK.averno). Se abre al vencer al jefe de la ÚLTIMA zona del mapa del mundo (la que sea, aunque
     * se añadan más) en Pesadilla y con la Corrupción al máximo. Bajada sin fin: no se vuelve desde las hogueras, sólo
     * se sale al caer (y entonces te llevas todo el botín); no hay reclutas ni daskai nuevos.
     *   level   nivel de los rivales = start + pisos × perFloor + jefes × perBoss (+ elite / boss), hasta cap
     *   adapt   los rivales se adaptan a tu equipo: su poder (atributos) es, como mínimo, ratio × el de tu equipo
     *           ratio = base + pisos × perFloor + jefes × perBoss (× boss / elite); y además +flat% por piso y jefe */
    averno: {
      zone: 'averno',
      level: { start: 90, cap: 120, perFloor: 0.3, perBoss: 1.5, elite: 2, boss: 4 },
      adapt: { base: 0.82, perFloor: 0.01, perBoss: 0.07, boss: 1.3, elite: 1.12, flatFloor: 0.006, flatBoss: 0.04 },
      // (monedas y emblemas extra: config.expedition.kinds.averno)
    },
  };
})();
