/* =============================================================
 * DK.runes — runas de expedición
 * -------------------------------------------------------------
 * Caen durante las expediciones (cofres, élites y jefes:
 * config.expedition.runes.drop) y se guardan para siempre en
 * state.runes = { id: n }. Al preparar la próxima expedición
 * (Batalla) se engastan en 4 huecos (nextExpedition.runeSlots):
 * como mucho UNA de tamaño (pequeño, mediano, XL) y UNA de tipo
 * (captura, combate, desafío), que los fijan (sin ellas salen al
 * azar), y las de bonificación (oro, saber) que quieras. Se gastan
 * al partir.
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

    /* ---------- Runas engastadas en la próxima expedición ---------- */
    /** Nº de huecos para runas. */
    slotCount() { return cfg().slots || 4; },
    /**
     * Runas engastadas en la próxima expedición: [id, ...] (como mucho slotCount();
     * sólo las que aún tienes; como mucho una de tamaño y una de tipo).
     */
    slots() {
      const n = st() && st().nextExpedition; if (!n) return [];
      let raw = n.runeSlots;
      if (!raw && n.runes) raw = [n.runes.size, n.runes.kind].filter(Boolean); // v4.22.0
      const used = {}, groups = {}, out = [];
      (raw || []).forEach((id) => {
        const r = this.get(id); if (!r || this.locked(id) || out.length >= this.slotCount()) return;
        if ((used[id] || 0) >= this.count(id)) return;
        if (r.group !== 'bonus' && groups[r.group]) return;
        used[id] = (used[id] || 0) + 1; groups[r.group] = 1; out.push(id);
      });
      return out;
    },
    /** Cuántas de esta runa quedan sin engastar. */
    free(id) { return this.count(id) - this.slots().filter((x) => x === id).length; },
    /** { size: id|null, kind: id|null } de las engastadas */
    selected() {
      const sl = this.slots(), find = (g) => sl.find((id) => this.get(id).group === g) || null;
      return { size: find('size'), kind: find('kind') };
    },
    /** ¿Se puede engastar? (la tienes libre, no está bloqueada y hay hueco o reemplaza a la de su grupo) */
    canSocket(id) {
      const r = this.get(id); if (!r || this.locked(id) || this.free(id) <= 0) return false;
      const sl = this.slots();
      return sl.length < this.slotCount() || (r.group !== 'bonus' && sl.some((x) => this.get(x).group === r.group));
    },
    /** Guarda los huecos y recalcula el mapa. */
    setSlots(list) {
      const n = DK.expedition.nextStart();
      n.rolled = n.rolled || { kind: n.kind, size: n.size, free: DK.expedition.pickSize(Math.random) };
      n.runeSlots = list; delete n.runes;
      n.runeSlots = this.slots();
      this.apply(n);
      DK.store.save();
    },
    /** Engasta una runa (una de tamaño/tipo sustituye a la de su grupo). @returns {boolean} */
    socket(id) {
      if (!this.canSocket(id)) return false;
      const r = this.get(id), sl = this.slots();
      const k = r.group === 'bonus' ? -1 : sl.findIndex((x) => this.get(x).group === r.group);
      if (k >= 0) sl[k] = id; else sl.push(id);
      this.setSlots(sl);
      return true;
    },
    /** Quita la runa del hueco i. */
    unsocket(i) { const sl = this.slots(); if (i < 0 || i >= sl.length) return false; sl.splice(i, 1); this.setSlots(sl); return true; },
    /** Engasta o quita (si ya estaba). @returns {boolean} engastada */
    toggle(id) {
      const i = this.slots().indexOf(id);
      if (i >= 0) { this.unsocket(i); return false; }
      return this.socket(id);
    },
    /** Suma de una bonificación ('coins' | 'exp') de las runas de la expedición en curso. */
    bonus(key) {
      const e = DK.expedition.active();
      return ((e && e.runesUsed) || []).reduce((a, id) => a + ((cfg().list[id] || {})[key] || 0), 0);
    },
    /** Tipo y tamaño de la próxima expedición según sus runas (o lo que salió al azar). */
    apply(n) {
      const sel = this.selected(), rolled = n.rolled; if (!rolled) return n;
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
    consume() {
      const used = this.slots();
      used.forEach((id) => { this.all()[id]--; if (!this.all()[id]) delete this.all()[id]; });
      return used;
    },
  };
})();
