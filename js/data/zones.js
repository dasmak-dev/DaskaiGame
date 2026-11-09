/* =============================================================
 * data/zones.js — Zonas de batalla (cargador).
 *
 * Las zonas se editan en data/zones.json (luego: node tools/data.js).
 *  {
 *    "name", "desc", "icon",
 *    "levels":  [mínimo, máximo]     nivel de los salvajes,
 *    "colors":  [claro, oscuro]      degradado de la zona,
 *    "scene":   "meadow"|"forest"|"beach"|"cave"|"volcano"|"temple"|"swamp"|"abyss"|"glacier"|"sky",
 *    "unlock":  zona que hay que superar antes,
 *    "enemies": [[especie, peso], ...]   aparición aleatoria por peso,
 *    "boss":    { species, level, title, coins, drops, phases: [{ at, type }] },
 *    "secretBoss": jefe oculto de las cuevas (mismo formato)
 *  }
 * El orden del archivo es el orden en que se muestran y se desbloquean.
 * Aquí se construyen D.zones, D.secretBosses y D.bossPhases.
 * ============================================================= */
(function () {
  const D = DK.data;
  D.zones = {}; D.secretBosses = {}; D.bossPhases = {};
  Object.entries(DK.raw.zones).forEach(([id, o]) => {
    const z = Object.assign({ id }, o);
    z.enemies = (o.enemies || []).map(([species, weight]) => ({ species, weight }));
    if (o.boss) {
      z.boss = Object.assign({}, o.boss);
      if (o.boss.phases) { D.bossPhases[id] = o.boss.phases; delete z.boss.phases; }
    }
    if (o.secretBoss) D.secretBosses[id] = o.secretBoss;
    delete z.secretBoss;
    D.zones[id] = z;
  });
})();
