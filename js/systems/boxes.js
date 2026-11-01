/* =============================================================
 * systems/boxes.js — Cajas de daskai (DK.boxes), al estilo del PC de
 * los Pokémon clásicos.
 *
 * Los daskai que no están en el equipo viven en cajas de SIZE huecos.
 * Cada caja tiene nombre y fondo (los colores de una zona u otros temas).
 *
 *   Estado: state.boxes = { cur, list: [{ name, bg, slots: [uid | null] }] }
 *
 * La colocación es «perezosa»: sync() quita de las cajas a quien ya no
 * existe o está en el equipo, y mete a quien no está en ninguna (en la
 * caja actual si cabe; si no, en la primera con sitio, creando otra si
 * hace falta). Así no hay que tocar cada sitio donde un daskai entra o
 * sale del equipo: basta con llamar a sync() antes de pintar.
 * ============================================================= */
(function () {
  const SIZE = 30, MAX = 16, START = 2;
  // Fondos extra (además de los de cada zona)
  const EXTRA = { noche: ['#6366f1', '#0f172a'], nieve: ['#e0f2fe', '#64748b'], arena: ['#fde68a', '#a16207'], cristal: ['#f0abfc', '#6d28d9'], lava: ['#fb923c', '#7f1d1d'] };

  const st = () => {
    const s = DK.store.state;
    if (!s.boxes || !Array.isArray(s.boxes.list)) s.boxes = { cur: 0, list: [] };
    while (s.boxes.list.length < START) s.boxes.list.push(newBox(s.boxes.list.length));
    s.boxes.list.forEach((b) => { if (!Array.isArray(b.slots)) b.slots = []; while (b.slots.length < SIZE) b.slots.push(null); });
    s.boxes.cur = Math.max(0, Math.min(s.boxes.cur || 0, s.boxes.list.length - 1));
    return s.boxes;
  };
  function newBox(i) {
    const bgs = Object.keys(DK.data.zones);
    return { name: '', bg: bgs[i % bgs.length], slots: Array(SIZE).fill(null) };
  }

  DK.boxes = {
    SIZE, MAX,
    list() { return st().list; },
    cur() { return st().cur; },
    setCur(i) { const s = st(); s.cur = (i + s.list.length) % s.list.length; DK.store.save(); },
    box(i = this.cur()) { return st().list[i]; },
    /** Nombre (el propio o «Caja N»). */
    name(i = this.cur()) { const b = this.box(i); return (b && b.name) || DK.t('box.name', { n: i + 1 }); },
    /** Fondos disponibles: { id: { colors, label } }. */
    backgrounds() {
      const out = {};
      Object.values(DK.data.zones).forEach((z) => (out[z.id] = { colors: z.colors, label: z.name }));
      Object.entries(EXTRA).forEach(([id, colors]) => (out[id] = { colors, label: DK.t('box.bgName.' + id) }));
      return out;
    },
    colors(bg) { const all = this.backgrounds(); return (all[bg] || Object.values(all)[0]).colors; },
    /** ¿Cuántos daskai hay en una caja? */
    count(i = this.cur()) { return this.box(i).slots.filter(Boolean).length; },

    /** ¿Dónde está un daskai? → { b, i } o null. */
    locate(uid) {
      const list = st().list;
      for (let b = 0; b < list.length; b++) { const i = list[b].slots.indexOf(uid); if (i >= 0) return { b, i }; }
      return null;
    },
    /** Primer hueco libre (empezando por la caja `from`). Crea una caja nueva si no hay sitio. */
    free(from = this.cur()) {
      const list = st().list;
      for (let k = 0; k < list.length; k++) { const b = (from + k) % list.length; const i = list[b].slots.indexOf(null); if (i >= 0) return { b, i }; }
      list.push(newBox(list.length));
      return { b: list.length - 1, i: 0 };
    },

    /** Ordena las cajas con la colección: quita a los que sobran y guarda a los que falten. */
    sync() {
      const s = DK.store.state; if (!s) return;
      const party = new Set(s.party.map((d) => d.uid)), team = new Set(s.team);
      const seen = new Set();
      st().list.forEach((b) => { b.slots = b.slots.map((u) => (u && party.has(u) && !team.has(u) && !seen.has(u) ? (seen.add(u), u) : null)); });
      s.party.forEach((d) => { if (!team.has(d.uid) && !seen.has(d.uid)) { const p = this.free(); st().list[p.b].slots[p.i] = d.uid; seen.add(d.uid); } });
    },

    /**
     * Mueve un daskai a un hueco de una caja. Si viene del equipo, sale de
     * él (y si el hueco tenía a otro, ése ocupa su sitio en el equipo).
     * @returns {boolean}
     */
    moveTo(uid, b, i) {
      this.sync();
      const list = st().list, target = list[b]; if (!target || i < 0 || i >= SIZE) return false;
      const other = target.slots[i];
      if (other === uid) return true;
      const team = DK.store.state.team, ti = team.indexOf(uid);
      if (ti >= 0) {
        // Del equipo a la caja: el que estaba en el hueco (si lo hay) pasa al equipo en su lugar
        if (other) { if (!DK.party.canJoin(other)) return false; team[ti] = other; }
        else if (team.length <= 1) return false;
        else team.splice(ti, 1);
        target.slots[i] = uid;
      } else {
        const from = this.locate(uid); if (!from) return false;
        list[from.b].slots[from.i] = other || null;   // intercambio entre huecos
        target.slots[i] = uid;
      }
      DK.store.save();
      return true;
    },
    /**
     * Saca un daskai de su caja y lo pone en el equipo en la posición `index`.
     * Si el equipo está lleno, el que ocupaba esa posición vuelve al hueco que queda libre.
     */
    toTeam(uid, index) {
      this.sync();
      const team = DK.store.state.team;
      if (team.includes(uid)) { DK.party.moveInTeam(uid, index); return true; }
      if (!DK.party.canJoin(uid)) return false;
      const from = this.locate(uid);
      const full = team.length >= DK.config.maxTeam;
      const replaced = full ? team[Math.min(index, team.length - 1)] : null;
      if (DK.party.placeAt(uid, index) === false) return false;
      if (from) st().list[from.b].slots[from.i] = replaced || null;
      DK.store.save();
      return true;
    },

    rename(i, name) { this.box(i).name = String(name || '').trim().slice(0, 24); DK.store.save(); },
    setBg(i, bg) { if (this.backgrounds()[bg]) { this.box(i).bg = bg; DK.store.save(); } },
    /** Caja nueva (al final). Devuelve su índice o -1 si ya hay el máximo. */
    add() { const list = st().list; if (list.length >= MAX) return -1; list.push(newBox(list.length)); st().cur = list.length - 1; DK.store.save(); return list.length - 1; },
    /** Ordena una caja (los vacíos al final). by: 'level' | 'house' | 'name' | 'species' */
    sort(i, by = 'level') {
      const b = this.box(i);
      const ds = b.slots.filter(Boolean).map((u) => DK.party.get(u)).filter(Boolean);
      const cmp = {
        level: (x, y) => y.level - x.level,
        house: (x, y) => DK.daskai.species(x).house.localeCompare(DK.daskai.species(y).house) || y.level - x.level,
        name: (x, y) => DK.daskai.name(x).localeCompare(DK.daskai.name(y)),
        species: (x, y) => DK.daskai.species(x).name.localeCompare(DK.daskai.species(y).name) || y.level - x.level,
      }[by];
      ds.sort(cmp);
      b.slots = ds.map((d) => d.uid).concat(Array(SIZE - ds.length).fill(null));
      DK.store.save();
    },
  };
})();
