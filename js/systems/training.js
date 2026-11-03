/* =============================================================
 * systems/training.js — Campo de entrenamiento (DK.training).
 *
 * Dejas daskai entrenando en tiempo real (aunque cierres el juego) y al
 * volver recoges lo ganado. Mientras entrenan no pueden ir de expedición
 * (DK.party.canJoin los bloquea y salen del equipo).
 *
 *   Estado: state.training.slots = [{ uid, kind: 'exp'|'stat', stat, start, cost }]
 *   Rendimiento decreciente (config.training): 100% las primeras horas,
 *   luego 50%, luego nada → effHours().
 *   Experiencia: siempre se puede. Por encima del nivel recomendado
 *   (levelCap()) cuesta más: o pagas ×mult (plan 'coins') o tarda ×mult
 *   horas (plan 'time'). Slot: { ..., plan, mult }.
 *   Las mejoras del campo («Instructor», niveles en config.training.instructor)
 *   se compran con MONEDAS aquí mismo (buyLevel) y dan huecos, ritmo, tope de
 *   nivel y puntos de atributo extra (instr()). Estado: state.training.level.
 * ============================================================= */
(function () {
  const C = () => DK.config.training;
  const st = () => { const s = DK.store.state; s.training = s.training || { slots: [] }; return s.training; };

  DK.training = {
    /** Nivel de las mejoras del campo (las partidas antiguas conservan el Instructor comprado con emblemas). */
    level() { const s = st(); const old = (DK.camp.raw() || {}).instructor || 0; if (old > (s.level || 0)) s.level = old; return Math.min(C().instructor.length - 1, s.level || 0); },
    /** Bonificación del nivel actual. */
    instr() { return C().instructor[this.level()]; },
    /** Siguiente nivel a la venta (o null si está al máximo). */
    nextLevel() { return C().instructor[this.level() + 1] || null; },
    /** Compra el siguiente nivel con monedas. @returns {boolean} */
    buyLevel() {
      const n = this.nextLevel(); if (!n || !DK.wallet.spend(n.cost)) return false;
      st().level = this.level() + 1;
      DK.emit('training:upgraded', { level: st().level }); DK.store.save();
      return true;
    },
    /** Puntos de atributo que se pueden entrenar como mucho por daskai. */
    statMax() { return C().statMax + (this.instr().statMax || 0); },
    /** Huecos disponibles. */
    slotCount() { return C().slots + this.instr().slots; },
    /** Huecos máximos posibles (con el Instructor al máximo). */
    slotMax() { return C().slots + Math.max(...C().instructor.map((i) => i.slots)); },
    slots() { return st().slots; },
    get(uid) { return st().slots.find((s) => s.uid === uid) || null; },
    isTraining(uid) { return !!(DK.store.state && DK.store.state.training && DK.store.state.training.slots.some((s) => s.uid === uid)); },

    /** Nivel recomendado: por encima, la experiencia cuesta más monedas o más horas. */
    levelCap() {
      const others = DK.party.all().filter((d) => !d.temp && !this.isTraining(d.uid));
      const top = Math.max(1, ...others.map((d) => d.level), ...st().slots.map((s) => s.startLevel || 1));
      return Math.min(DK.config.maxLevel, Math.max(1, top - C().levelMargin + this.instr().cap));
    },
    /** Horas efectivas tras `hours` reales (rendimiento decreciente). */
    effHours(hours) {
      const T = C();
      return Math.min(hours, T.fullHours) + Math.max(0, Math.min(hours, T.halfHours) - T.fullHours) * T.halfRate;
    },
    /** Horas efectivas máximas. */
    maxEff() { return this.effHours(C().halfHours); },
    /** Penalización por estar por encima del nivel recomendado (1 = ninguna). Sólo experiencia. */
    overMult(d, kind = 'exp') {
      if (kind !== 'exp' || !d) return 1;
      const over = d.level - this.levelCap() + 1;
      return over > 0 ? Math.min(C().overMax, 1 + over * C().overStep) : 1;
    },
    /** Monedas al entrar. plan 'coins' paga la penalización; 'time' paga lo normal. */
    cost(d, kind, plan = 'coins') {
      const base = C().cost(d.level, kind);
      return plan === 'time' ? base : Math.round(base * this.overMult(d, kind));
    },
    /** Horas reales que equivalen a `h` horas normales con ese plan. */
    stretch(slot) { return slot && slot.plan === 'time' ? (slot.mult || 1) : 1; },

    /** ¿Por qué no puede entrar? (null si puede) */
    cannot(d, kind = 'exp', plan = 'coins') {
      const { t } = DK;
      if (!DK.unlocks.has('training')) return t('unlock.trainingLocked');
      if (DK.expedition.active()) return t('train.inExpedition');
      if (!d || d.temp) return t('train.notThis');
      if (this.isTraining(d.uid)) return t('train.already');
      if (st().slots.length >= this.slotCount()) return t('train.full');
      if (DK.party.isActive(d.uid) && DK.store.state.team.length <= 1) return t('train.lastOne');
      if (kind === 'exp' && d.level >= DK.config.maxLevel) return t('train.atCap', { n: DK.config.maxLevel });
      if (kind === 'stat' && this.trainedTotal(d) >= this.statMax()) return t('train.statMax', { n: this.statMax() });
      if (DK.wallet.get() < this.cost(d, kind, plan)) return t('train.noMoney');
      return null;
    },
    /** Puntos de atributo ya entrenados por un daskai. */
    trainedTotal(d) { return Object.entries(d.trained || {}).reduce((a, [k, v]) => a + v / C().statPer[k], 0); },

    /** Mete un daskai a entrenar. kind: 'exp' (experiencia) o 'stat' (un atributo). */
    start(uid, kind, stat, plan = 'coins') {
      const d = DK.party.get(uid);
      if (this.cannot(d, kind, plan)) return false;
      const cost = this.cost(d, kind, plan), mult = this.overMult(d, kind);
      DK.wallet.spend(cost);
      if (DK.party.isActive(uid)) DK.store.state.team = DK.store.state.team.filter((u) => u !== uid);
      st().slots.push({ uid, kind, stat: kind === 'stat' ? stat : null, start: Date.now(), cost, startLevel: d.level, plan: mult > 1 ? plan : null, mult });
      DK.emit('training:start', { d, kind });
      DK.store.save();
      return true;
    },

    /** Lo ganado hasta ahora (sin aplicarlo). */
    progress(slot, now = Date.now()) {
      const d = DK.party.get(slot.uid);
      const hours = Math.max(0, (now - slot.start) / 3600000);
      const k = this.stretch(slot), norm = hours / k;   // horas «normales» (el plan lento las estira)
      const eff = this.effHours(norm) * (1 + this.instr().rate);
      const out = { d, hours, norm, stretch: k, eff, pct: Math.min(1, this.effHours(norm) / this.maxEff()), done: norm >= C().halfHours };
      if (!d) return out;
      if (slot.kind === 'exp') {
        // Experiencia, limitada a lo que falta para el tope de nivel
        const want = Math.floor(eff * C().expPerHour(slot.startLevel || d.level));
        const cap = DK.config.maxLevel;
        let room = 0;
        for (let lv = d.level; lv < cap; lv++) room += DK.config.expCurve(lv);
        room = Math.max(0, room - d.exp);
        out.exp = Math.min(want, room); out.capped = want >= room;
      } else {
        const left = Math.max(0, this.statMax() - this.trainedTotal(d));
        const pts = Math.floor(eff / C().statHours);
        out.points = Math.min(pts, left); out.capped = pts >= left;
        out.gain = out.points * C().statPer[slot.stat];
        out.nextIn = out.capped ? 0 : C().statHours - (eff % C().statHours); // horas efectivas para el siguiente
      }
      return out;
    },

    /**
     * Recoge al daskai: aplica lo ganado y libera el hueco. Vuelve al equipo si cabe.
     * @returns {{d, exp, points, gain, stat, levelInfo}}
     */
    collect(uid) {
      const slot = this.get(uid); if (!slot) return null;
      const p = this.progress(slot);
      st().slots = st().slots.filter((s) => s !== slot);
      const d = p.d;
      const res = { d, kind: slot.kind, stat: slot.stat, exp: 0, points: 0, gain: 0, levelInfo: null };
      if (d) {
        if (slot.kind === 'exp' && p.exp > 0) { res.exp = p.exp; res.levelInfo = DK.daskai.gainExp(d, p.exp); }
        if (slot.kind === 'stat' && p.points > 0) {
          d.trained = d.trained || {};
          d.trained[slot.stat] = (d.trained[slot.stat] || 0) + p.gain;
          DK.daskai.touch();
          res.points = p.points; res.gain = p.gain;
        }
        DK.daskai.fullHeal(d);
        if (DK.store.state.team.length < DK.config.maxTeam) DK.store.state.team.push(d.uid);
      }
      DK.emit('training:collect', res);
      DK.store.save();
      return res;
    },

    /** Cuántos tienen ya el máximo (para el aviso del menú). */
    readyCount() { return DK.store.state && DK.store.state.training ? st().slots.filter((s) => this.progress(s).done || this.progress(s).capped).length : 0; },
  };
})();
