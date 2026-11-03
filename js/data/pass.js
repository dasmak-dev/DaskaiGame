/* =============================================================
 * data/pass.js — Senda del aventurero (DK.pass, systems/pass.js).
 *
 * Las misiones cobradas y los logros dan puntos de senda (`points`).
 * Cada nivel pide xpFor(nivel) puntos y da su premio (se cobra en
 * Progreso). Tras el último nivel, cada `levelXp` puntos dan un
 * cofre repetible (`after`).
 *
 * Premios: { coins } · { item, qty } · { rune: id | 'random', n } ·
 *          { emblems } · { frame } (marco de perfil) · { title } (título)
 * ============================================================= */
(function () {
  DK.data.pass = {
    points: { daily: 25, weekly: 80, achievement: 40, hidden: 80 },
    xpFor: (level) => 100 + (level - 1) * 10,
    levels: [
      { coins: 200 }, { item: 'pocion', qty: 3 }, { rune: 'random' }, { coins: 400 }, { emblems: 1 },
      { item: 'superpocion', qty: 2 }, { rune: 'oro' }, { coins: 600 }, { item: 'baya_saber', qty: 2 }, { frame: 'senda_bronce' },
      { coins: 800 }, { rune: 'random' }, { item: 'tonico_exp', qty: 1 }, { emblems: 2 }, { title: 'senda15' },
      { coins: 1000 }, { item: 'supereter', qty: 2 }, { rune: 'xl' }, { item: 'esencia_ancestral', qty: 1 }, { frame: 'senda_plata' },
      { coins: 1500 }, { rune: 'random', n: 2 }, { item: 'cristal_sabio', qty: 1 }, { emblems: 3 }, { item: 'pluma_fenix', qty: 1 },
      { coins: 2500 }, { rune: 'saber' }, { item: 'elixir', qty: 1 }, { emblems: 5 }, { frame: 'senda_oro', title: 'senda30' },
    ],
    after: { levelXp: 400, reward: { coins: 500, rune: 'random' } },
  };

  /* Categorías de los logros (Progreso → Logros) y pistas de los ocultos. */
  const CAT = {
    combat: ['firstWin', 'wins50', 'wins250', 'crits100', 'breaks25'],
    collection: ['firstCapture', 'captures15', 'collector', 'shiny', 'codex20', 'firstEvolution', 'level30', 'level60', 'level90'],
    expedition: ['firstExpedition', 'expeditions10', 'depth5', 'depth10', 'xlClear', 'quests10'],
    bosses: ['boss1', 'allBosses', 'secretFirst', 'secretFoundAll', 'secretAll'],
    craft: ['firstCraft', 'crafts30', 'rich'],
  };
  DK.data.achievementCats = Object.keys(CAT);
  DK.data.achievements.forEach((a) => { a.cat = Object.keys(CAT).find((c) => CAT[c].includes(a.id)) || (a.id.startsWith('boss_') ? 'bosses' : 'combat'); });
})();
