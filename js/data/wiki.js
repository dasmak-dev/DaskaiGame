/* =============================================================
 * data/wiki.js — Wiki del Códice (pestaña «Guía» de screens/codex.js).
 *
 * Cada entrada explica una parte del juego y sólo se muestra cuando la
 * has descubierto (`when()`); las demás salen como «???» en su grupo.
 *   { id, group, icon, when(state) → bool, vars() → {…} para el texto,
 *     stat() → texto corto para el perfil (Funciones desbloqueadas) }
 * Textos: lang → wiki.e.<id>.{t, b} (b admite varios párrafos con \n).
 * Grupos: lang → wiki.g.<grupo>.
 * ============================================================= */
(function () {
  const D = DK.data;
  const C = () => DK.config;
  const S = () => DK.store.state || {};
  const st = () => S().stats || {};
  const bossesDone = () => Object.keys(D.zones).filter((z) => DK.world.boss(z).defeated > 0).length;
  const num = (n) => Math.round(n).toLocaleString(DK.i18n.lang);

  DK.data.wikiGroups = ['basics', 'expedition', 'progress', 'bosses', 'endgame'];
  DK.data.wiki = [
    // --- Lo básico ---
    { id: 'combat', group: 'basics', icon: 'swords', when: () => true },
    { id: 'houses', group: 'basics', icon: 'sparkles', when: () => true,
      vars: () => ({ x: C().house.strongDamage, p: Math.round(C().house.weakDefense * 100) }) },
    { id: 'levels', group: 'basics', icon: 'star', when: () => true, vars: () => ({ max: C().maxLevel }) },
    { id: 'talents', group: 'basics', icon: 'award', when: () => DK.party.all().some((d) => d.level >= C().talentEvery), vars: () => ({ n: C().talentEvery }) },
    { id: 'evolution', group: 'basics', icon: 'evolve', when: () => (st().evolutions || 0) > 0 || DK.party.all().some((d) => d.level >= 10),
      stat: () => num(st().evolutions || 0) },
    { id: 'recruits', group: 'basics', icon: 'paw', when: () => DK.party.all().length > 1, stat: () => num(DK.party.all().length) },
    { id: 'shiny', group: 'basics', icon: 'sparkles', when: () => (st().shinies || 0) > 0 || DK.endgame.late(), stat: () => num(st().shinies || 0) },
    // --- Expediciones ---
    { id: 'expedition', group: 'expedition', icon: 'map', when: () => true },
    { id: 'nodes', group: 'expedition', icon: 'compass', when: () => (st().expeditions || 0) > 0 || !!S().expedition },
    { id: 'defeat', group: 'expedition', icon: 'skull', when: () => true },
    { id: 'difficulty', group: 'expedition', icon: 'gauge', when: () => true },
    { id: 'relics', group: 'expedition', icon: 'gem', when: () => (st().expeditions || 0) > 0 || !!S().expedition },
    { id: 'kinds', group: 'expedition', icon: 'flag', when: () => (st().expeditions || 0) > 0 },
    { id: 'runes', group: 'expedition', icon: 'gem', when: () => DK.runes.enabled() || DK.runes.total() > 0 || DK.endgame.late(),
      stat: () => DK.t('wiki.s.runes', { n: num(DK.runes.total()) }) },
    { id: 'runeTiers', group: 'expedition', icon: 'anvil', when: () => Object.keys(DK.runes.all()).some((id) => DK.runes.parse(id).tier > 1) || DK.endgame.late() },
    // --- Progreso ---
    { id: 'emblems', group: 'progress', icon: 'emblem', when: () => bossesDone() > 0 || DK.camp.emblems() > 0,
      stat: () => num(DK.camp.emblems()) },
    { id: 'training', group: 'progress', icon: 'dumbbell', when: () => DK.unlocks.has('training'),
      stat: () => DK.t('wiki.s.training', { n: DK.training.level(), max: C().training.instructor.length - 1, s: DK.training.slotCount() }) },
    { id: 'craft', group: 'progress', icon: 'craftCog', when: () => (S().recipesKnown || []).length > 0 || (st().crafts || 0) > 0,
      stat: () => DK.t('wiki.s.craft', { n: (S().recipesKnown || []).length }) },
    { id: 'missions', group: 'progress', icon: 'target', when: () => true },
    { id: 'pass', group: 'progress', icon: 'award', when: () => true, stat: () => DK.t('wiki.s.level', { n: DK.pass.level() }) },
    { id: 'codex', group: 'progress', icon: 'book', when: () => true },
    { id: 'weekly', group: 'progress', icon: 'trophy', when: () => DK.weekly.unlocked(), stat: () => DK.t('wiki.s.best', { n: DK.weekly.best().toLocaleString(DK.i18n.lang) }) },
    // --- Jefes ---
    { id: 'bosses', group: 'bosses', icon: 'crown', when: () => (st().expeditions || 0) > 0 || bossesDone() > 0,
      stat: () => `${bossesDone()}/${Object.keys(D.zones).length}` },
    { id: 'secretBosses', group: 'bosses', icon: 'cave', when: () => Object.keys(D.secretBosses || {}).some((z) => DK.world.secret(z).found > 0 || DK.world.secret(z).defeated > 0) },
    // --- Final del juego ---
    { id: 'corruption', group: 'endgame', icon: 'skull', when: () => DK.corruption.visible(),
      stat: () => DK.t('wiki.s.level', { n: `${DK.corruption.max()}/${DK.corruption.levels().length}` }), vars: () => ({ n: DK.corruption.levels().length }) },
    { id: 'nightmare', group: 'endgame', icon: 'demon', when: () => Object.keys(D.zones).some((z) => DK.nightmare.available(z)),
      stat: () => DK.t('wiki.s.zones', { n: Object.keys(D.zones).filter((z) => DK.nightmare.available(z)).length }) },
    { id: 'abyss', group: 'endgame', icon: 'cave', when: () => DK.abyss.unlocked(),
      stat: () => DK.t('wiki.s.floor', { n: DK.abyss.best() }), vars: () => ({ n: D.endgame.abyss.every }) },
    { id: 'ascension', group: 'endgame', icon: 'arrowUp', when: () => DK.party.all().some((d) => d.level >= C().maxLevel || (d.stars || 0) > 0),
      stat: () => DK.t('wiki.s.stars', { n: DK.party.all().reduce((a, d) => a + (d.stars || 0), 0) }), vars: () => ({ max: C().maxLevel, n: D.endgame.ascension.maxStars, p: Math.round(D.endgame.ascension.statPerStar * 100) }) },
    { id: 'variants', group: 'endgame', icon: 'evolve', when: () => DK.bag.count('fragmento_abisal') > 0 || DK.party.all().some((d) => d.variant),
      stat: () => num(DK.party.all().filter((d) => d.variant).length) },
    { id: 'tracking', group: 'endgame', icon: 'eye', when: () => DK.endgame.late(),
      vars: () => ({ cap: Math.round(D.endgame.tracking.cap * 100) }) },
    { id: 'engrave', group: 'endgame', icon: 'gem', when: () => DK.endgame.late(),
      stat: () => `${DK.engrave.list().length}/${DK.engrave.slots()}`, vars: () => ({ n: D.endgame.engrave.cost }) },
    { id: 'finalZone', group: 'endgame', icon: 'map', when: () => DK.world.isUnlocked(D.endgame.finalZone) },
  ];

  /** Helpers del wiki: entradas desbloqueadas y textos. */
  DK.wiki = {
    all() { return D.wiki; },
    known(e) { try { return !!DK.store.state && !!e.when(); } catch (_) { return false; } },
    unlocked() { return D.wiki.filter((e) => this.known(e)); },
    title(e) { return DK.t(['wiki', 'e', e.id, 't'].join('.')); },
    body(e) { return DK.t(['wiki', 'e', e.id, 'b'].join('.'), e.vars ? e.vars() : {}); },
  };
})();
