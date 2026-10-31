/* =============================================================
 * systems/rules.js — Reglas de la partida que dependen de la
 * dificultad y de las mejoras del campamento.
 *
 *   DK.rules     → dificultad elegida y lo que implica
 *   DK.camp      → mejoras permanentes del campamento (data/upgrades.js)
 *   DK.legacy    → esencias que dejan los daskai caídos (herencia)
 *
 * Regla de oro: el resto del juego NO lee la dificultad directamente,
 * siempre pregunta aquí (DK.rules.permadeath(), DK.rules.canRetreat()...).
 * Así, para cambiar una regla basta con tocar data/ o este archivo.
 * ============================================================= */
(function () {
  const D = DK.data;
  const st = () => DK.store.state;

  /* ======================= DIFICULTAD ======================= */
  DK.rules = {
    /** Id de la dificultad de la partida actual. */
    difficulty() { return (st() && st().difficulty) || D.defaultDifficulty; },
    /** Datos de la dificultad actual. */
    def() { return D.difficulties[this.difficulty()] || D.difficulties[D.defaultDifficulty]; },

    /** ¿Mueren para siempre los daskai que caen en una expedición? */
    permadeath() { return this.def().permadeath; },
    /** ¿Se puede abandonar una expedición? */
    canRetreat() { return this.def().retreat; },
    /** ¿Hay un descanso fijo antes del jefe? */
    fixedRest() { return this.def().fixedRest; },
    /** Multiplicador de atributos de los rivales. */
    enemyMult() { return this.def().enemyMult; },
    /** Salvaciones de la muerte por expedición (dificultad + Altar del fénix). */
    maxRevives() { return this.def().revives + DK.camp.value('fenix'); },
  };

  /* ======================= CAMPAMENTO ======================= */
  DK.camp = {
    raw() { return (st() && st().camp) || {}; },
    /** Datos de una mejora. */
    get(id) { return D.upgrades.find((u) => u.id === id); },
    /** Nivel comprado (0 = ninguno). */
    level(id) { return this.raw()[id] || 0; },
    /** Valor de la mejora en su nivel actual (0 si no se ha comprado). */
    value(id) {
      const u = this.get(id), lv = this.level(id);
      return u && lv ? u.levels[lv - 1].value : 0;
    },
    /** Siguiente nivel a la venta (o null si está al máximo). */
    next(id) { const u = this.get(id); return u ? u.levels[this.level(id)] || null : null; },
    /* Emblemas: la moneda de las mejoras permanentes. 1 por jefe derrotado
       (config.expedition.emblemsPerBoss); se gastan al terminar cada expedición. */
    emblems() { return (st() && st().emblems) || 0; },
    addEmblems(n) {
      if (!st() || !n) return 0;
      st().emblems = this.emblems() + n;
      const e = DK.expedition && DK.expedition.active();
      if (e && e.log) e.log.emblems = (e.log.emblems || 0) + n;
      DK.emit('emblems', { n, total: st().emblems });
      return n;
    },
    /** ¿Hay alguna mejora que se pueda pagar con los emblemas que tienes? */
    affordable() { return D.upgrades.filter((u) => { const n = this.next(u.id); return n && this.emblems() >= n.cost; }).length; },
    /**
     * Compra el siguiente nivel de una mejora con emblemas.
     * @returns {boolean} false si no hay emblemas o ya está al máximo
     */
    buy(id) {
      const n = this.next(id);
      if (!n || this.emblems() < n.cost) return false;
      st().emblems -= n.cost;
      st().camp = st().camp || {};
      st().camp[id] = this.level(id) + 1;
      DK.emit('camp:upgraded', { id, level: st().camp[id] });
      DK.store.save();
      return true;
    },
  };

  /* ======================= HERENCIA ======================= */
  DK.legacy = {
    /** Esencias pendientes de heredar. */
    list() { return (st() && st().essences) || []; },

    /**
     * Crea la esencia de un daskai que acaba de morir.
     * Guarda su mejor atributo para transmitirlo.
     */
    create(d) {
      const s = DK.daskai.stats(d);
      const best = D.statKeys.filter((k) => k !== 'hp' && k !== 'mp').sort((a, b) => s[b] - s[a])[0];
      st().essences = this.list();
      st().essences.unshift({ id: DK.util.uid(), name: DK.daskai.name(d), species: d.species, level: d.level, stat: best, at: Date.now() });
    },

    /** Lo que daría una esencia: { exp, stat, points }. */
    preview(es) { return { exp: DK.config.legacyExp(es.level), stat: es.stat, points: DK.config.legacyStat(es.level) }; },

    /**
     * Hereda una esencia en un daskai: experiencia y puntos permanentes
     * en el mejor atributo del caído (d.legacy).
     * @returns {Object|null} { d, exp, stat, points, levelInfo }
     */
    inherit(essenceId, uid) {
      const list = this.list();
      const es = list.find((x) => x.id === essenceId);
      const d = DK.party.get(uid);
      if (!es || !d) return null;
      const p = this.preview(es);
      d.legacy = d.legacy || {};
      d.legacy[p.stat] = (d.legacy[p.stat] || 0) + p.points;
      const levelInfo = DK.daskai.gainExp(d, p.exp);
      st().essences = list.filter((x) => x.id !== essenceId);
      DK.emit('legacy:inherited', { d, essence: es });
      DK.store.save();
      return Object.assign({ d, levelInfo }, p);
    },
  };
})();
