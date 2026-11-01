/* =============================================================
 * data/mapMods.js — Modificadores de mapa (clima y sucesos de la zona).
 *
 * Cada mapa nuevo puede traer uno al azar (config.expedition.modChance).
 * Se ve antes de entrar (preparar, Batalla, elección tras el jefe) y en la
 * cabecera del mapa. Lo aplica systems/expedition.js (generate, levelBonus,
 * addLoot, modHouse) y la niebla screens/expedition.js.
 *   { icon, weight,
 *     fog: n            sólo se ven los nodos hasta n pisos por delante
 *     houseDmg: {casa}  +/-% de daño de los ataques de esa casa (ambos bandos)
 *     weights: {tipo}   multiplica el peso de ese tipo de nodo al generar el mapa
 *     levels: n         niveles extra de los rivales
 *     coins: pct        recompensa: +% de monedas del botín }
 * Textos en lang → mod.<id>.{name,desc}.
 * ============================================================= */
(function () {
  DK.data.mapMods = {
    niebla: { icon: 'eye', weight: 3, fog: 3, coins: 0.15 },
    tormenta: { icon: 'bolt', weight: 3, houseDmg: { agua: 0.2, luz: 0.2, tierra: -0.1 }, coins: 0.1 },
    lunallena: { icon: 'moon', weight: 2, weights: { elite: 2.2 }, coins: 0.15 },
    calor: { icon: 'flame', weight: 3, houseDmg: { fuego: 0.2, agua: -0.15 }, coins: 0.1 },
    bonanza: { icon: 'gift', weight: 2, weights: { treasure: 2.5, shop: 1.5 }, levels: 2, coins: 0.2 },
  };
})();
