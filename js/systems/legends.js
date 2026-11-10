/* =============================================================
 * systems/legends.js — v5.18: jefes legendarios.
 *
 * Muy de vez en cuando (config.legends.chance), en lugar del jefe de la zona aparece un LEGENDARIO
 * (config.legends.list): más nivel, total de atributos 600 (DK.daskai.tierTotal → d.legendary), el
 * doble de monedas y su propio título. La primera vez sólo se le puede vencer; a partir de la segunda
 * victoria puede querer unirse a tu equipo (config.legends.join[n.º de victorias], en tanto por uno).
 * Si aceptas, se une para siempre (en expedición, como recluta que se queda: ya has vencido al jefe).
 *
 *   DK.legends.roll(zoneId, o)        → { species, title } o null (al empezar un combate de jefe)
 *   DK.legends.defeated(species)      → { n, offer } (al vencerlo; offer = ¿quiere unirse?)
 *   DK.legends.join(species, level)   → el daskai nuevo
 *   DK.legends.state(species)         → { met, defeated, joined }
 * Estado: DK.store.state.legends = { [species]: { met, defeated, joined } }
 * ============================================================= */
(function () {
  const C = () => DK.config.legends, U = DK.util;
  const st = () => { const s = DK.store.state; s.legends = s.legends || {}; return s.legends; };
  DK.legends = {
    list: () => C().list.filter((x) => DK.data.species[x.species]),
    state(species) { const s = st(); return (s[species] = s[species] || { met: 0, defeated: 0, joined: 0 }); },
    /** ¿Sale un legendario en este combate de jefe? (nunca en cuevas secretas ni en el Abismo) */
    roll(zoneId, o = {}) {
      if (!o.boss || o.secret || o.abyssRound != null || o.noLegend) return null;
      const ex = DK.expedition.active(); if (!ex) return null;
      const pool = DK.legends.list(); if (!pool.length) return null;
      const chance = o.forceLegend ? 1 : C().chance;
      if (!U.chance(chance)) return null;
      // los que ya tienes salen menos
      const w = pool.map((x) => ({ x, weight: DK.legends.state(x.species).joined ? 0.35 : 1 }));
      const pick = U.weighted(w).x;
      DK.legends.state(pick.species).met++;
      return pick;
    },
    /** Al vencerlo: ¿quiere unirse? (desde la segunda victoria; si ya lo tienes, no) */
    defeated(species) {
      const s = DK.legends.state(species); s.defeated++;
      const J = C().join, p = s.joined ? 0 : J[Math.min(s.defeated, J.length - 1)] || 0;
      return { n: s.defeated, offer: U.chance(p) };
    },
    /** Se une a tu equipo (para siempre). */
    join(species, level) {
      const d = DK.daskai.create(species, level, { shiny: false });
      d.legendary = true; d.forms = 1; d.form = 0;
      DK.daskai.touch(); DK.daskai.fullHeal(d);
      DK.legends.state(species).joined++;
      if (DK.expedition.active()) DK.expedition.addRecruit(d); else DK.party.add(d);
      DK.store.state.stats.captures = (DK.store.state.stats.captures || 0) + 1;
      DK.emit('captured', { d, legendary: true });
      DK.store.save();
      return d;
    },
  };
})();
