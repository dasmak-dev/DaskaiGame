/* =============================================================
 * systems/training.js — Campo de entrenamiento (DK.training).
 *
 * Dejas un daskai entrenando en tiempo real (aunque cierres el juego) y
 * SÓLO gana experiencia. Mientras entrena no puede ir de expedición
 * (DK.party.canJoin lo bloquea y sale del equipo).
 *
 *   Estado: state.training = { slots: [{ uid, start, boost, paid, v: 2 }], level }
 *   Ritmo: cada minuto gana config.training.pct(nivel actual) de lo que
 *     le falta para el siguiente nivel × aceleración por tiempo (ramp)
 *     × acelerador pagado al dejarlo (boost) × Instructor.
 *   Cobro: NO se paga al entrar (salvo el acelerador). Al sacarlo se cobra
 *     fee(nivel) monedas por minuto × la misma aceleración por tiempo.
 *     Sin monedas suficientes puedes sacarlo gratis, pero sin la experiencia.
 *   Tope: config.training.maxHours (deja de ganar y de cobrar) y nivel máximo.
 *   Las mejoras del campo («Instructor») cuestan EMBLEMAS de jefe + MONEDAS (buyLevel):
 *   huecos (2 de base, 4 como mucho), +% de ritmo y descuento en el cobro.
 * ============================================================= */
(function () {
  const C = () => DK.config.training;
  const MIN = 60000;
  const st = () => {
    const s = DK.store.state; s.training = s.training || { slots: [] };
    // Partidas antiguas (entrenamiento de atributos / pago por adelantado): devuelve lo pagado y empieza de cero
    if (s.training.slots.some((x) => x.v !== 2)) {
      s.training.slots = s.training.slots.map((x) => {
        if (x.v === 2) return x;
        if (x.cost) DK.wallet.add(x.cost, { silent: true });
        return { uid: x.uid, start: Date.now(), boost: 1, paid: 0, v: 2 };
      });
    }
    return s.training;
  };

  DK.training = {
    /** Nivel de las mejoras del campo (las partidas antiguas conservan el Instructor comprado con emblemas). */
    level() { const s = st(); const old = (DK.camp.raw() || {}).instructor || 0; if (old > (s.level || 0)) s.level = old; return Math.min(C().instructor.length - 1, s.level || 0); },
    instr() { return C().instructor[this.level()]; },
    nextLevel() { return C().instructor[this.level() + 1] || null; },
    /** ¿Por qué no se puede comprar el siguiente nivel? ('max' | 'emblems' | 'coins' | null) */
    cannotBuy() {
      const n = this.nextLevel(); if (!n) return 'max';
      if (DK.camp.emblems() < (n.emblems || 0)) return 'emblems';
      if (DK.wallet.get() < n.cost) return 'coins';
      return null;
    },
    /** Compra el siguiente nivel (emblemas de jefe + monedas). @returns {boolean} */
    buyLevel() {
      const n = this.nextLevel(); if (this.cannotBuy() || !DK.wallet.spend(n.cost)) return false;
      DK.store.state.emblems = DK.camp.emblems() - (n.emblems || 0);
      st().level = this.level() + 1;
      DK.emit('training:upgraded', { level: st().level }); DK.store.save();
      return true;
    },
    /** (Antiguo) puntos de atributo entrenados como mucho. Se conservan los de partidas viejas. */
    statMax() { return C().statMax; },
    trainedTotal(d) { const per = { hp: 4, mp: 3 }; return Object.entries(d.trained || {}).reduce((a, [k, v]) => a + v / (per[k] || 1), 0); },
    slotCount() { return C().slots + this.instr().slots; },
    slotMax() { return C().slots + Math.max(...C().instructor.map((i) => i.slots)); },
    slots() { return st().slots; },
    get(uid) { return st().slots.find((s) => s.uid === uid) || null; },
    isTraining(uid) { return !!(DK.store.state && DK.store.state.training && DK.store.state.training.slots.some((s) => s.uid === uid)); },

    /** Aceleración por tiempo tras `min` minutos (1 → ramp.max). */
    ramp(min) { const R = C().ramp; return Math.min(R.max, 1 + R.perHour * (min / 60)); },
    /** % del nivel por minuto a ese nivel (sin aceleraciones). */
    pct(lv) { return C().pct(lv); },
    /** Coste del acelerador ×m al dejarlo. */
    boostCost(d, m) { return m > 1 ? C().boostCost(d.level, m) : 0; },

    /**
     * Simula `minutes` minutos desde el estado actual del daskai.
     * @returns {{level, exp, gained, levels, fee, capped}}
     */
    simulate(d, minutes, boost = 1) {
      const T = C(), cap = DK.config.maxLevel, mult = boost * (1 + this.instr().rate), disc = 1 - (this.instr().discount || 0);
      let lv = d.level, exp = d.exp || 0, gained = 0, fee = 0;
      const total = Math.min(minutes, T.maxHours * 60);
      for (let m = 0; m < total && lv < cap; m++) {
        const step = Math.min(1, total - m), r = this.ramp(m + step / 2);
        const add = T.pct(lv) * r * mult * DK.config.expCurve(lv) * step;
        exp += add; gained += add; fee += T.fee(lv) * r * step;
        while (lv < cap && exp >= DK.config.expCurve(lv)) { exp -= DK.config.expCurve(lv); lv++; }
      }
      if (lv >= cap) { gained -= exp; exp = 0; }
      return { level: lv, exp: Math.floor(exp), gained: Math.max(0, Math.floor(gained)), levels: lv - d.level, fee: Math.ceil(fee * disc), capped: lv >= cap };
    },

    /** ¿Por qué no puede entrar? (null si puede) */
    cannot(d, boost = 1) {
      const { t } = DK;
      if (!DK.unlocks.has('training')) return t('unlock.trainingLocked');
      if (DK.expedition.active()) return t('train.inExpedition');
      if (!d || d.temp) return t('train.notThis');
      if (this.isTraining(d.uid)) return t('train.already');
      if (st().slots.length >= this.slotCount()) return t('train.full');
      if (DK.party.isActive(d.uid) && DK.store.state.team.length <= 1) return t('train.lastOne');
      if (d.level >= DK.config.maxLevel) return t('train.atCap', { n: DK.config.maxLevel });
      if (DK.wallet.get() < this.boostCost(d, boost)) return t('train.noMoney');
      return null;
    },

    /** Deja un daskai entrenando. boost: acelerador (×1, ×2…), se paga ya. */
    start(uid, boost = 1) {
      const d = DK.party.get(uid);
      if (!C().boosts.includes(boost)) boost = 1;
      if (this.cannot(d, boost)) return false;
      const paid = this.boostCost(d, boost);
      if (paid) DK.wallet.spend(paid);
      if (DK.party.isActive(uid)) DK.store.state.team = DK.store.state.team.filter((u) => u !== uid);
      st().slots.push({ uid, start: Date.now(), boost, paid, v: 2 });
      DK.emit('training:start', { d, boost });
      DK.store.save();
      return true;
    },

    /** Lo ganado hasta ahora (sin aplicarlo) y lo que costaría sacarlo. */
    progress(slot, now = Date.now()) {
      const d = DK.party.get(slot.uid);
      const minutes = Math.max(0, (now - slot.start) / MIN);
      const out = { d, minutes, hours: minutes / 60, ramp: this.ramp(Math.min(minutes, C().maxHours * 60)), boost: slot.boost || 1, done: minutes >= C().maxHours * 60 };
      if (!d) return out;
      const sim = this.simulate(d, minutes, out.boost);
      out.rate = this.pct(sim.level) * out.ramp * out.boost * (1 + this.instr().rate); // fracción de nivel por minuto ahora
      return Object.assign(out, sim, { exp: sim.gained, levelExp: sim.exp });
    },
    /** ¿Te alcanza para sacarlo con su experiencia? */
    canPay(slot) { const p = this.progress(slot); return DK.wallet.get() >= p.fee; },

    /**
     * Saca al daskai. pay=true: cobra y aplica la experiencia; false: gratis y sin experiencia.
     * @returns {{d, exp, fee, levelInfo}|null}
     */
    collect(uid, pay = true) {
      const slot = this.get(uid); if (!slot) return null;
      const p = this.progress(slot);
      if (pay && p.fee > 0 && !DK.wallet.spend(p.fee)) return null;
      st().slots = st().slots.filter((s) => s !== slot);
      const d = p.d;
      const res = { d, exp: 0, fee: pay ? p.fee : 0, levelInfo: null };
      if (d) {
        if (pay && p.exp > 0) { res.exp = p.exp; res.levelInfo = DK.daskai.gainExp(d, p.exp); }
        DK.daskai.fullHeal(d);
        if (DK.store.state.team.length < DK.config.maxTeam) DK.store.state.team.push(d.uid);
      }
      DK.emit('training:collect', res);
      DK.store.save();
      return res;
    },

    /** Cuántos han llegado al tope de horas o de nivel (para el aviso del menú). */
    readyCount() { return DK.store.state && DK.store.state.training ? st().slots.filter((s) => { const p = this.progress(s); return p.done || p.capped; }).length : 0; },
  };
})();
