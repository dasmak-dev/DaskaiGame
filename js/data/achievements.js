/* =============================================================
 * data/achievements.js — Logros.
 *
 *  { id, icon, target, reward (monedas), value: (state) => número actual }
 *  El logro se desbloquea cuando value(state) >= target.
 *  Los textos están en lang/*.js → achievements.<id>.name / .desc
 * ============================================================= */
(function () {
  const S = (k) => (st) => st.stats[k] || 0;
  const maxLevel = (st) => st.party.reduce((m, d) => Math.max(m, d.level), 0);
  const codexSeen = (st) => Object.values(st.codex).reduce((n, z) => n + Object.keys(z.enemies).length, 0);

  DK.data.achievements = [
    { id: 'firstWin', icon: 'trophy', target: 1, reward: 50, value: S('wins') },
    { id: 'wins50', icon: 'trophy', target: 50, reward: 300, value: S('wins') },
    { id: 'wins250', icon: 'trophy', target: 250, reward: 1000, value: S('wins') },
    { id: 'firstCapture', icon: 'orb', target: 1, reward: 80, value: S('captures') },
    { id: 'captures15', icon: 'orb', target: 15, reward: 500, value: S('captures') },
    { id: 'collector', icon: 'paw', target: 20, reward: 600, value: (st) => st.party.length },
    { id: 'firstCraft', icon: 'anvil', target: 1, reward: 50, value: S('crafts') },
    { id: 'crafts30', icon: 'anvil', target: 30, reward: 400, value: S('crafts') },
    { id: 'firstExpedition', icon: 'flag', target: 1, reward: 200, value: S('expeditions') },
    { id: 'expeditions10', icon: 'flag', target: 10, reward: 800, value: S('expeditions') },
    { id: 'boss1', icon: 'crown', target: 1, reward: 200, value: S('bossesDefeated') },
    { id: 'allBosses', icon: 'crown', target: 8, reward: 3000, value: (st) => Object.keys(st.bosses).filter((z) => st.bosses[z].defeated > 0).length },
    { id: 'level30', icon: 'star', target: 30, reward: 300, value: maxLevel },
    { id: 'level60', icon: 'star', target: 60, reward: 800, value: maxLevel },
    { id: 'level90', icon: 'star', target: 90, reward: 2500, value: maxLevel },
    { id: 'firstEvolution', icon: 'evolve', target: 1, reward: 150, value: S('evolutions') },
    { id: 'shiny', icon: 'sparkles', target: 1, reward: 500, value: S('shinies') },
    { id: 'rich', icon: 'coin', target: 5000, reward: 500, value: S('coinsEarned') },
    { id: 'crits100', icon: 'bolt', target: 100, reward: 300, value: S('crits') },
    { id: 'codex20', icon: 'book', target: 20, reward: 400, value: codexSeen },
  ];
})();
