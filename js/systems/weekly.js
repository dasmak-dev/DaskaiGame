/* =============================================================
 * systems/weekly.js — Desafío semanal (DK.weekly).
 *
 * Cada semana (lunes a domingo) hay un mapa FIJO: la misma semilla, el
 * mismo tamaño, tipo y modificador, y dos pactos obligatorios. Se juega
 * con tu equipo y tu mochila, pero sin runas, corrupción ni pesadilla,
 * para que todos los intentos sean comparables. Puedes repetirlo cuanto
 * quieras: se guarda una tabla de récords local con cada intento.
 *
 *   Puntos = pisos superados × 100 + emblemas × 150 + monedas / 10
 *            + 1000 si vences al jefe + 500 por cada mapa extra.
 *   Premio la primera vez que vences al jefe en la semana: emblemas y una
 *   runa mágica de tier II (config abajo).
 *
 * Estado: state.weekly = { [id]: { tries, best, rewarded, runs: [{score, floors, outcome, depth, at}] } }
 * (se guardan las últimas KEEP semanas). Lo registra expedition.snapshot().
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const CFG = { start: '2026-01-05', size: ['medium', 'xl'], curses: 2, reward: { emblems: 3, runeTier: 2 }, keep: 8, top: 10 };
  const WEEK = 7 * 864e5;
  const st = () => { const s = DK.store.state; s.weekly = s.weekly || {}; return s.weekly; };

  DK.weekly = {
    /** Nº de semana desde CFG.start (lunes). */
    weekNo(now = Date.now()) { return Math.floor((now - new Date(CFG.start + 'T00:00:00').getTime()) / WEEK) + 1; },
    /** Id de la semana: 'w42'. */
    id(now) { return 'w' + this.weekNo(now); },
    /** Días que quedan para el siguiente desafío. */
    daysLeft(now = Date.now()) { const end = new Date(CFG.start + 'T00:00:00').getTime() + this.weekNo(now) * WEEK; return Math.max(1, Math.ceil((end - now) / 864e5)); },
    /** ¿Disponible? (tras vencer al primer jefe) */
    unlocked() { return !!DK.store.state && Object.keys(D.zones).some((z) => DK.world.boss(z).defeated > 0); },

    /** Cómo es el desafío de esta semana (fijo para la semana). */
    def(now) {
      const id = this.id(now), rnd = U.seeded('weekly-' + id);
      const zones = Object.keys(D.zones).filter((z) => !D.zones[z].secretZone && DK.world.isUnlocked(z));
      const kinds = DK.expedition.kinds().filter((k) => !k.locked).map((k) => k.id);
      const curses = Object.keys(D.curses);
      const pickN = (arr, n) => { const a = arr.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
      return {
        id, week: this.weekNo(now),
        zone: zones[Math.floor(rnd() * zones.length)] || 'pradera',
        size: CFG.size[Math.floor(rnd() * CFG.size.length)],
        kind: kinds[Math.floor(rnd() * kinds.length)] || 'normal',
        mod: Object.keys(D.mapMods)[Math.floor(rnd() * Object.keys(D.mapMods).length)],
        curses: pickN(curses, CFG.curses),
        seed: 'weekly-' + id,
      };
    },

    /** Registro de una semana. */
    rec(id = this.id()) { const s = st(); return s[id] || (s[id] = { tries: 0, best: 0, rewarded: false, runs: [] }); },
    best(id) { return (st()[id || this.id()] || {}).best || 0; },
    tries(id) { return (st()[id || this.id()] || {}).tries || 0; },
    /** Intentos de la semana ordenados por puntos. */
    board(id) { return ((st()[id || this.id()] || {}).runs || []).slice().sort((a, b) => b.score - a.score).slice(0, CFG.top); },
    /** Mejor puntuación de cada semana anterior: [{id, week, best, tries}] */
    past() { return Object.entries(st()).filter(([id]) => id !== this.id()).map(([id, r]) => ({ id, week: +id.slice(1), best: r.best, tries: r.tries })).sort((a, b) => b.week - a.week); },
    reward() { return CFG.reward; },

    /**
     * Empieza el desafío. Guarda y luego devuelve la vista previa que tenías
     * preparada (no gasta tus runas).
     */
    start(pack = {}) {
      if (DK.expedition.active() || !this.unlocked()) return null;
      const w = this.def(), s = DK.store.state;
      const prev = s.nextExpedition ? JSON.parse(JSON.stringify(s.nextExpedition)) : null;
      s.nextExpedition = { zone: w.zone, seed: w.seed, size: w.size, kind: w.kind, mod: w.mod, runeSlots: [], corruption: 0, nightmare: null };
      const e = DK.expedition.start(pack);
      s.nextExpedition = prev;
      e.weekly = w.id;
      // Pactos obligatorios de la semana (sin elegir)
      e.curseOffer = w.curses.slice();
      DK.curses.accept(w.curses);
      this.rec(w.id).tries++;
      DK.emit('weekly:start', { id: w.id });
      DK.store.save();
      return e;
    },

    /** Puntos de una expedición (en curso o terminada). */
    score(e, outcome) {
      const floors = (e.cleared || []).length, emblems = (e.log && e.log.emblems) || 0, coins = (e.loot && e.loot.coins) || 0;
      return floors * 100 + emblems * 150 + Math.round(coins / 10) + (outcome === 'completed' ? 1000 : 0) + Math.max(0, (e.depth || 1) - 1) * 500;
    },

    /**
     * Al terminar (lo llama expedition.snapshot): guarda el intento, el récord
     * y da el premio la primera vez que se vence al jefe en la semana.
     * @returns {{score, best, isBest, reward}}
     */
    record(e, outcome) {
      const r = this.rec(e.weekly), score = this.score(e, outcome);
      const isBest = score > r.best;
      if (isBest) r.best = score;
      r.runs.push({ score, floors: (e.cleared || []).length, outcome, depth: e.depth || 1, at: Date.now() });
      r.runs = r.runs.sort((a, b) => b.score - a.score).slice(0, 25);
      let reward = null;
      if ((outcome === 'completed' || (e.depth || 1) > 1) && !r.rewarded) {
        r.rewarded = true;
        DK.store.state.emblems = DK.camp.emblems() + CFG.reward.emblems;
        const rune = DK.runes.roll1(DK.runes.roll(1)[0], CFG.reward.runeTier, Math.random, 'm');
        DK.runes.add(rune);
        reward = { emblems: CFG.reward.emblems, rune };
      }
      // Sólo las últimas semanas
      const ids = Object.keys(st()).sort((a, b) => +b.slice(1) - +a.slice(1));
      ids.slice(CFG.keep).forEach((id) => delete st()[id]);
      DK.emit('weekly:end', { id: e.weekly, score, isBest });
      return { id: e.weekly, score, best: r.best, isBest, reward };
    },
  };
})();
