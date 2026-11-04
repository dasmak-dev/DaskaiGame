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
 *
 * TIERS (I, II, III): el id lleva el tier detrás de «:» ('oro', 'oro:2',
 * 'oro:3'; sin sufijo = tier I). Tres iguales se funden en una del tier
 * siguiente (DK.runes.fuse, Crafteo → Runas). Bonificaciones × tierMult;
 * tamaño/tipo de tier II-III: + emblemas por jefe; XL III: + cuevas.
 * Runas de final de juego (late): élites y botín maldito.
 * ============================================================= */
(function () {
  const U = DK.util;
  const cfg = () => DK.config.expedition.runes;
  const st = () => DK.store.state;

  DK.runes = {
    /** Todas las runas definidas: [{id, group, value, icon, weight}] */
    defs(group) { return Object.entries(cfg().list).map(([id, r]) => Object.assign({ id, base: id, tier: 1 }, r)).filter((r) => !group || r.group === group); },
    /** Partes de un id: { base, tier } */
    parse(id) { const [base, tt] = String(id || '').split(':'); return { base, tier: Math.min(3, Math.max(1, +tt || 1)) }; },
    withTier(id, tier) { const b = this.parse(id).base; return tier > 1 ? `${b}:${tier}` : b; },
    get(id) { const { base, tier } = this.parse(id); const r = cfg().list[base]; return r ? Object.assign({ id: this.withTier(base, tier), base, tier }, r) : null; },
    /** Multiplicador de una runa de bonificación según su tier. */
    mult(id) { return (cfg().tierMult || [1, 2, 4])[this.parse(id).tier - 1]; },
    /** «II» / «III» (vacío en el tier I). */
    roman(id) { return ['', 'II', 'III'][this.parse(id).tier - 1]; },
    /** Ids que tienes de una runa base (todas sus tiers). */
    tiersOf(base) { return [1, 2, 3].map((tt) => this.withTier(base, tt)); },
    /** Runas que tienes { id: n } */
    all() { const s = st(); if (!s) return {}; return s.runes || (s.runes = {}); },
    count(id) { return this.all()[id] || 0; },
    total() { return Object.values(this.all()).reduce((a, b) => a + b, 0); },
    add(id, n = 1) {
      if (!this.get(id) || n <= 0) return 0;
      id = this.get(id).id;
      this.all()[id] = this.count(id) + n;
      DK.emit('runes', { id, n });
      return n;
    },
    /** Una runa de tipo bloqueado (desafío sin haber vencido a un jefe) no se puede usar. */
    locked(id) {
      const r = this.get(id); if (!r) return false;
      if (r.late && !DK.endgame.late()) return true;
      if (r.group !== 'kind') return false;
      const k = DK.expedition.kinds().find((x) => x.id === r.value);
      return !k || k.locked;
    },
    usable(id) { return this.count(id) > 0 && !this.locked(id); },
    /** n runas al azar según su rareza (sin las de tipos bloqueados). */
    roll(n = 1, rnd = Math.random) {
      const w = {}; this.defs().forEach((r) => { if (!this.locked(r.id) && !(r.late && !DK.endgame.late())) w[r.id] = r.weight || 1; });
      return Array.from({ length: n }, () => U.weightedKey(w, rnd, 'small'));
    },
    /**
     * Runas que caen de una fuente ('treasure' | 'elite' | 'boss' | 'secret').
     * Se guardan ya (no se pierden aunque caigas). @returns {string[]} ids
     */
    drop(source, rnd = Math.random) {
      const p = cfg().drop[source] || 0;
      const n = p >= 1 ? Math.floor(p) : rnd() < p ? 1 : 0;
      // A más profundidad y corrupción, más probable que salga de un tier mayor
      const up = DK.endgame.runeTier() + (source === 'secret' ? 0.2 : 0);
      const ids = this.roll(n, rnd).map((id) => this.withTier(id, rnd() < up ? (rnd() < up / 3 ? 3 : 2) : 1));
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
      const n = st() && st().nextExpedition;
      if (n && n.kind === 'abismo' && r.group !== 'bonus') return false;
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
    /** Suma de una bonificación ('coins' | 'exp' | 'elites' | 'loot') de las runas de la expedición en curso (× tier). */
    bonus(key, list) {
      const e = DK.expedition.active();
      return (list || (e && e.runesUsed) || []).reduce((a, id) => { const r = this.get(id); return a + (r && r[key] ? r[key] * this.mult(id) : 0); }, 0);
    },
    /** Emblemas extra por jefe de las runas de tamaño/tipo de tier II-III. */
    emblemBonus(list) {
      const e = DK.expedition.active();
      return (list || (e && e.runesUsed) || []).reduce((a, id) => { const r = this.get(id); return a + (r && r.group !== 'bonus' ? r.tier - 1 : 0); }, 0);
    },
    /** Lo que cambian en el mapa las runas: élites garantizados, sin hogueras, cuevas extra. */
    mapExtra(list) {
      const out = { minElites: 0, noRest: false, caves: 0 };
      (list || []).forEach((id) => {
        const r = this.get(id); if (!r) return;
        if (r.elites) out.minElites += r.elites * r.tier;
        if (r.noRest) out.noRest = true;
        if (r.group === 'size' && r.value === 'xl' && r.tier === 3) out.caves += 2;
      });
      return out;
    },
    /* ---------- Fundir (Crafteo → Runas) ---------- */
    fuseCost(id) { const tt = this.parse(id).tier; return tt >= 3 ? null : (cfg().fuseCost || [500, 2000])[tt - 1]; },
    /** ¿Se pueden fundir 3 de esta (libres) en una del tier siguiente? */
    canFuse(id) { const c = this.fuseCost(id); return c != null && this.count(id) - this.slots().filter((x) => x === id).length >= 3 && DK.wallet.get() >= c; },
    fuse(id) {
      if (!this.canFuse(id)) return null;
      const cost = this.fuseCost(id), next = this.withTier(id, this.parse(id).tier + 1);
      DK.wallet.spend ? DK.wallet.spend(cost) : DK.wallet.add(-cost, { silent: true });
      this.all()[id] -= 3; if (!this.all()[id]) delete this.all()[id];
      this.add(next);
      DK.store.save();
      return next;
    },
    /** Tipo y tamaño de la próxima expedición según sus runas (o lo que salió al azar). */
    apply(n) {
      if (n.kind === 'abismo') return n; // el Abismo tiene su tipo y tamaño
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
