/* =============================================================
 * data/missions.js — Plantillas de misiones diarias y semanales.
 *
 * Cada día (y cada semana) se eligen al azar, con semilla fija por
 * fecha, `config.daily` y `config.weekly` plantillas.
 *
 *  { id, type, icon, target: [diaria, semanal], reward: {coins, item, qty} }
 *  type indica qué evento hace avanzar la misión (ver systems/progress.js):
 *    'defeat'       → derrotar daskai (opcionalmente de una casa: house: true)
 *    'win'          → ganar combates
 *    'capture'      → vincular daskai
 *    'craft'        → fusionar objetos
 *    'useItem'      → usar objetos
 *    'damage'       → infligir daño total
 *    'expedition'   → completar expediciones
 *    'boss'         → derrotar jefes
 *    'levelUp'      → subir niveles
 * Los textos están en lang/*.js → missions.<id>
 * ============================================================= */
(function () {
  DK.data.missions = {
    config: { daily: 3, weekly: 3 },
    templates: [
      { id: 'defeatHouse', type: 'defeat', house: true, icon: 'swords', target: [5, 25], reward: { coins: 120, item: 'pocion', qty: 2 } },
      { id: 'defeatAny', type: 'defeat', icon: 'skull', target: [8, 40], reward: { coins: 100, item: 'eter', qty: 2 } },
      { id: 'win', type: 'win', icon: 'trophy', target: [5, 30], reward: { coins: 150 } },
      { id: 'capture', type: 'capture', icon: 'orb', target: [1, 4], reward: { coins: 150, item: 'cristal_vinculo', qty: 1 } },
      { id: 'craft', type: 'craft', icon: 'anvil', target: [2, 10], reward: { coins: 100, item: 'polvo_brillante', qty: 1 } },
      { id: 'useItem', type: 'useItem', icon: 'flask', target: [3, 15], reward: { coins: 80, item: 'superpocion', qty: 1 } },
      { id: 'damage', type: 'damage', icon: 'target', target: [600, 5000], reward: { coins: 130 } },
      { id: 'levelUp', type: 'levelUp', icon: 'star', target: [2, 10], reward: { coins: 120, item: 'supereter', qty: 1 } },
      { id: 'expedition', type: 'expedition', icon: 'flag', target: [1, 3], weeklyOnly: false, reward: { coins: 250, item: 'nucleo_arcano', qty: 1 } },
      { id: 'boss', type: 'boss', icon: 'crown', target: [1, 3], reward: { coins: 300, item: 'cristal_mayor', qty: 1 } },
    ],
    /** Multiplicador de recompensa para las semanales. */
    weeklyRewardMult: 4,
  };
})();
