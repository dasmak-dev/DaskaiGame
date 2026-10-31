/* =============================================================
 * systems/curses.js — Pactos de expedición (data/curses.js).
 *
 *   DK.curses.offer()        → los 3 que se ofrecen al empezar un mapa
 *   DK.curses.accept([ids])  → acepta (y transforma el mapa si hace falta)
 *   DK.curses.active()       → pactos del mapa actual
 *   DK.curses.effect('clave')→ valor del efecto (suma / producto / true)
 *   DK.curses.coinBonus()    → +% de monedas de los pactos activos
 *   DK.curses.relicReward()  → reliquias extra al vencer al jefe
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const exp = () => DK.expedition.active();

  DK.curses = {
    /** Pactos aceptados en el mapa actual. */
    active() { const e = exp(); return e && e.curses ? e.curses.filter((id) => D.curses[id]) : []; },
    /** Valor de un efecto: healMult se multiplica, los números se suman, el resto es true/false. */
    effect(key) {
      const list = this.active().map((id) => D.curses[id].effect[key]).filter((v) => v != null);
      if (key === 'healMult') return list.reduce((a, b) => a * b, 1);
      if (!list.length) return 0;
      return typeof list[0] === 'number' ? list.reduce((a, b) => a + b, 0) : true;
    },
    coinBonus() { return this.active().reduce((a, id) => a + (D.curses[id].reward.coins || 0), 0); },
    relicReward() { return this.active().reduce((a, id) => a + (D.curses[id].reward.relic || 0), 0); },

    /** n pactos al azar para ofrecer. */
    roll(n = 3) { const pool = Object.keys(D.curses); const out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; },
    /** Ofrece pactos para el mapa que empieza. */
    offer() { const e = exp(); if (!e) return; e.curseOffer = this.roll(DK.config.expedition.curseChoices); e.curses = []; },

    /**
     * Acepta los pactos elegidos (puede ser ninguno) y aplica los que
     * cambian el mapa: sin descansos, más élites.
     */
    accept(ids = []) {
      const e = exp(); if (!e || !e.curseOffer) return;
      e.curses = ids.filter((id) => e.curseOffer.includes(id));
      e.curseOffer = null;
      const done = new Set(e.cleared);
      const nodes = e.map.rows.flat().filter((n) => !done.has(n.id));
      if (this.effect('noRest')) nodes.forEach((n) => { if (n.type === 'rest') n.type = 'fight'; });
      const elite = this.effect('moreElites');
      if (elite) nodes.forEach((n) => { if (n.type === 'fight' && n.row >= 1 && U.chance(elite)) n.type = 'elite'; });
      DK.emit('curses:accepted', { ids: e.curses });
      DK.store.save();
    },
  };
})();
