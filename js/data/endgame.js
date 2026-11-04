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
 *  abyss       El Abismo: mapas cortos encadenados sin fin, cada uno más duro.
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
      levels: [
        { levels: 3, stat: 0.10, rule: null, emblems: 1, coins: 0.15, shiny: 0.01, tier: 0.15 },
        { levels: 6, stat: 0.20, rule: 'restHalf', emblems: 2, coins: 0.30, shiny: 0.02, tier: 0.25 },
        { levels: 9, stat: 0.30, rule: 'bossHp', emblems: 3, coins: 0.45, shiny: 0.03, tier: 0.35 },
        { levels: 12, stat: 0.40, rule: 'shopDouble', emblems: 4, coins: 0.60, shiny: 0.04, tier: 0.45 },
        { levels: 15, stat: 0.50, rule: 'noShortcuts', emblems: 5, coins: 0.80, shiny: 0.05, tier: 0.60 },
      ],
      bossHp: 1.3, restMult: 0.5, shopMult: 2,
    },
    abyss: {
      bosses: 5,          // jefes de zona vencidos para abrirlo
      depthLevel: 4,      // + niveles de los rivales por cada piso del abismo (además de lo normal)
      depthStat: 0.04,    // +% de atributos por piso
      every: 5,           // premio cada N pisos
      reward: (floor) => ({ emblems: 2 + Math.floor(floor / 5), rune: Math.min(3, 1 + Math.floor(floor / 10)), coins: 400 * floor, abisal: floor % 10 === 0 }),
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
  };
})();
