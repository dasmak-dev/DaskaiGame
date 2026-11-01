/* =============================================================
 * data/quests.js — Encargos del mapa (objetivo opcional por mapa).
 *
 * Cada mapa de expedición trae un encargo al azar (DK.expedition.pickQuest).
 * Si se cumple, al derrotar al jefe del mapa se cobra el premio.
 *   track: lo que hay que conseguir, `target[tamaño]` veces
 *          (elite, break, strong, capture → DK.expedition.questTrack)
 *   fail:  lo que NO hay que hacer en todo el mapa
 *          (item, rest, faint → DK.expedition.questFail)
 *   coins: monedas base del premio (× tamaño y profundidad, config.expedition.quest)
 * Textos: lang → quest.<id>.{name, desc}
 * ============================================================= */
DK.data.mapQuests = {
  elites: { icon: 'crown', weight: 3, track: 'elite', target: { small: 1, medium: 2, xl: 3 }, coins: 90 },
  breaks: { icon: 'bolt', weight: 3, track: 'break', target: { small: 1, medium: 2, xl: 3 }, coins: 90 },
  strong: { icon: 'target', weight: 3, track: 'strong', target: { small: 5, medium: 9, xl: 14 }, coins: 70 },
  capture: { icon: 'paw', weight: 2, track: 'capture', target: { small: 1, medium: 1, xl: 2 }, coins: 70 },
  noItems: { icon: 'flask', weight: 2, fail: 'item', coins: 110 },
  noRest: { icon: 'campfire', weight: 2, fail: 'rest', coins: 100 },
  noFaint: { icon: 'heart', weight: 2, fail: 'faint', coins: 120 },
};
