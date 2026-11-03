/* =============================================================
 * DK.runes — runas de expedición
 * -------------------------------------------------------------
 * Caen durante las expediciones (cofres, élites y jefes:
 * config.expedition.runes.drop) y se guardan para siempre en
 * state.runes = { id: n }. Al preparar la próxima expedición
 * (Batalla) puedes poner UNA runa de tamaño (pequeño, mediano, XL)
 * y/o UNA de tipo (captura, combate, desafío) para fijarlos; sin
 * runas salen al azar como siempre. Se gastan al partir.
 *
 * La próxima expedición guarda lo que salió al azar (n.rolled) para
 * poder quitar la runa sin volver a sortear.
 * ============================================================= */
(function () {
  const U = DK.util;
  const cfg = () => DK.config.expedition.runes;
  const st = () => DK.store.state;

  DK.runes = {
    /** Todas las runas definidas: [{id, group, value, icon, weight}] */
    defs(group) { return Object.entries(cfg().list).map(([id, r]) => Object.assign({ id }, r)).filter((r) => !group || r.group === group); },
    get(id) { const r = cfg().list[id]; return r ? Object.assign({ id }, r) : null; },
    /** Runas que tienes { id: n } */
    all() { const s = st(); if (!s) return {}; return s.runes || (s.runes = {}); },
    count(id) { return this.all()[id] || 0; },
    total() { return Object.values(this.all()).reduce((a, b) => a + b, 0); },
    add(id, n = 1) {
      if (!cfg().list[id] || n <= 0) return 0;
      this.all()[id] = this.count(id) + n;
      DK.emit('runes', { id, n });
      return n;
    },
    /** Una runa de tipo bloqueado (desafío sin haber vencido a un jefe) no se puede usar. */
    locked(id) {
      const r = this.get(id); if (!r || r.group !== 'kind') return false;
      const k = DK.expedition.kinds().find((x) => x.id === r.value);
      return !k || k.locked;
    },
    usable(id) { return this.count(id) > 0 && !this.locked(id); },
    /** n runas al azar según su rareza (sin las de tipos bloqueados). */
    roll(n = 1, rnd = Math.random) {
      const w = {}; this.defs().forEach((r) => { if (!this.locked(r.id)) w[r.id] = r.weight || 1; });
      return Array.from({ length: n }, () => U.weightedKey(w, rnd, 'small'));
    },
    /**
     * Runas que caen de una fuente ('treasure' | 'elite' | 'boss' | 'secret').
     * Se guardan ya (no se pierden aunque caigas). @returns {string[]} ids
     */
    drop(source, rnd = Math.random) {
      const p = cfg().drop[source] || 0;
      const n = p >= 1 ? Math.floor(p) : rnd() < p ? 1 : 0;
      const ids = this.roll(n, rnd);
      ids.forEach((id) => this.add(id));
      const e = DK.expedition.active();
      if (ids.length && e && e.log) e.log.runes = (e.log.runes || []).concat(ids);
      return ids;
    },

    /* ---------- Runas puestas en la próxima expedición ---------- */
    /** { size: id|null, kind: id|null } (sólo las que aún tienes) */
    selected() {
      const n = st() && st().nextExpedition; const r = (n && n.runes) || {};
      const ok = (id) => (id && this.usable(id) ? id : null);
      return { size: ok(r.size), kind: ok(r.kind) };
    },
    /** Pone o quita una runa (si ya estaba puesta, la quita). @returns {boolean} puesta */
    toggle(id) {
      const r = this.get(id); if (!r) return false;
      const n = DK.expedition.nextStart();
      const sel = this.selected();
      const on = sel[r.group] !== id;
      if (on && !this.usable(id)) return false;
      n.rolled = n.rolled || { kind: n.kind, size: n.size, free: DK.expedition.pickSize(Math.random) };
      sel[r.group] = on ? id : null;
      n.runes = sel;
      this.apply(n);
      DK.store.save();
      return on;
    },
    /** Tipo y tamaño de la próxima expedición según sus runas (o lo que salió al azar). */
    apply(n) {
      const sel = n.runes || {}, rolled = n.rolled; if (!rolled) return n;
      const kind = sel.kind ? this.get(sel.kind).value : rolled.kind;
      const kd = DK.config.expedition.kinds[kind] || {};
      const size = sel.size ? this.get(sel.size).value
        : kind === rolled.kind ? rolled.size
          : kd.sizes ? kd.sizes[0]
            : (DK.config.expedition.kinds[rolled.kind] || {}).sizes ? rolled.free : rolled.size;
      if (kind !== n.kind || size !== n.size) { n.kind = kind; n.size = size; n.seed = `${n.zone}-${Date.now()}`; }
      return n;
    },
    /** Al partir: gasta las runas puestas. @returns {string[]} gastadas */
    consume(n) {
      const used = [];
      const sel = (n && n.runes) || {};
      ['size', 'kind'].forEach((g) => { const id = sel[g]; if (id && this.count(id) > 0) { this.all()[id]--; if (!this.all()[id]) delete this.all()[id]; used.push(id); } });
      return used;
    },
  };
})();
