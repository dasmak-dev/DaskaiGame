/* =============================================================
 * data/upgrades.js — Mejoras permanentes (pantalla Mejoras).
 *
 * Se compran con EMBLEMAS (1 por jefe derrotado) al terminar cada
 * expedición (pantalla expSummary) y hacen que la siguiente sea un poco
 * más fácil: es la progresión «roguelike» entre partidas.
 *   { id, icon, group, levels: [{ cost (emblemas), value }, ...] }
 * `value` es lo que vale la mejora en ese nivel; cada sistema la lee
 * con DK.camp.value(id) (0 si no se ha comprado):
 *
 *  Combate
 *   vigor       +% de vida máxima de tu equipo en expediciones   (daskai.stats)
 *   fuerza      +% de daño que hacen tus daskai                   (battle.damage)
 *   coraza      -% de daño que reciben tus daskai                 (battle.damage)
 *  Progreso
 *   sabiduria   +% de experiencia en todos los combates           (battle.rewards)
 *   mochila     +% de monedas en expediciones                     (expedition.addLoot)
 *   atajo       atajos extra en cada mapa                         (expedition.generate)
 *   instructor  campo de entrenamiento: huecos, ritmo y tope extra (training.instr → config.training.instructor)
 *  Expedición
 *   equipaje    +N unidades en la mochila al salir                (expedition.packCapacity)
 *   provisiones pociones con las que empiezas cada expedición     (expedition.start)
 *   cartografo  1: la reliquia inicial puede ser rara · 2: también
 *               épica y empiezas con una común gratis (siempre entre
 *               las reliquias desbloqueadas)                       (expedition.start)
 *   reclutador  +1 candidato y +N niveles en los reclutas         (expedition.makeCandidates)
 *   hoguera     +% de curación en las hogueras del mapa           (expedition.rest)
 *   comercio    ofertas extra en cada mercader                    (expedition.makeOffers)
 *   fenix       salvaciones extra de la muerte por expedición     (rules.maxRevives)
 *
 * Para añadir una mejora: añádela aquí, escribe sus textos en
 * lang → camp.up.<id>.{name,desc,effect} y lee DK.camp.value('<id>')
 * donde tenga efecto. `node tools/check.js` avisa si faltan textos.
 * ============================================================= */
(function () {
  const L = (...pairs) => pairs.map(([cost, value]) => ({ cost, value }));
  DK.data.upgrades = [
    // Combate
    { id: 'vigor', icon: 'heart', group: 'combat', levels: L([1, 0.08], [2, 0.16], [4, 0.25]) },
    { id: 'fuerza', icon: 'swords', group: 'combat', levels: L([1, 0.06], [3, 0.12], [5, 0.2]) },
    { id: 'coraza', icon: 'shield', group: 'combat', levels: L([1, 0.05], [3, 0.1], [5, 0.15]) },
    // Progreso
    { id: 'sabiduria', icon: 'star', group: 'progress', levels: L([1, 0.2], [2, 0.4], [4, 0.7]) },
    { id: 'mochila', icon: 'coin', group: 'progress', levels: L([1, 0.15], [2, 0.3], [4, 0.5]) },
    { id: 'atajo', icon: 'compass', group: 'progress', levels: L([3, 1], [6, 2]) },
    { id: 'instructor', icon: 'dumbbell', group: 'progress', levels: L([2, 1], [3, 2], [5, 3]) },
    // Expedición
    { id: 'equipaje', icon: 'bag', group: 'expedition', levels: L([1, 4], [2, 8], [3, 14]) },
    { id: 'provisiones', icon: 'flask', group: 'expedition', levels: L([1, 2], [1, 3], [2, 5]) },
    { id: 'cartografo', icon: 'amulet', group: 'expedition', levels: L([2, 1], [4, 2]) },
    { id: 'reclutador', icon: 'paw', group: 'expedition', levels: L([1, 1], [3, 3]) },
    { id: 'hoguera', icon: 'campfire', group: 'expedition', levels: L([1, 0.15], [2, 0.3]) },
    { id: 'comercio', icon: 'shop', group: 'expedition', levels: L([1, 1], [2, 2]) },
    { id: 'fenix', icon: 'sparkles', group: 'expedition', levels: L([4, 1], [8, 2]) },
  ];
  DK.data.upgradeGroups = ['combat', 'progress', 'expedition'];
})();
