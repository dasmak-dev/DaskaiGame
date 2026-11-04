/* =============================================================
 * data/difficulties.js — Niveles de dificultad (se eligen al crear
 * la partida y no se pueden cambiar después).
 *
 *   permadeath  un daskai que cae en una expedición muere para siempre
 *   retreat     se puede abandonar una expedición llevándose el botín
 *   fixedRest   hay un descanso fijo justo antes del jefe
 *   enemyMult   multiplicador de atributos de los rivales
 *   revives     salvaciones de la muerte por expedición (además de mejoras)
 *   keepPack    al caer derrotado conservas lo que TÚ metiste en la mochila
 *               (lo que quede sin usar); lo encontrado por el camino se pierde
 *
 * Para añadir una dificultad: un bloque más aquí y sus textos en
 * lang → difficulty.<id>.  Las reglas se leen con DK.rules (systems/rules.js).
 * ============================================================= */
(function () {
  DK.data.difficulties = {
    normal: { id: 'normal', icon: 'heart', permadeath: false, retreat: true, fixedRest: true, enemyMult: 0.95, revives: 1, keepPack: true },
    dificil: { id: 'dificil', icon: 'skull', permadeath: true, retreat: true, fixedRest: true, enemyMult: 1, revives: 1, keepPack: true },
    pesadilla: { id: 'pesadilla', icon: 'flame', permadeath: true, retreat: false, fixedRest: false, enemyMult: 1.12, revives: 0, keepPack: false },
  };
  /** Dificultad por defecto (y la de las partidas antiguas). */
  DK.data.defaultDifficulty = 'dificil';
})();
