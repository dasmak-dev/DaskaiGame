/* =============================================================
 * systems/inventory.js — Bolsa, monedas, tienda, uso de objetos,
 * equipamiento, fusión (con fusión en cadena y favoritas) y
 * "curar con objetos".
 *
 *   DK.bag       → objetos que tiene el jugador
 *   DK.wallet    → monedas
 *   DK.shop      → compra / venta (sólo con el mercader de las expediciones)
 *   DK.crafting  → fusiones
 *   DK.healer    → plan automático de curación con objetos
 * ============================================================= */
(function () {
  const D = DK.data;
  const { t } = DK;

  /* ======================= BOLSA ======================= */
  DK.bag = {
    /**
     * Objetos con los que se trabaja ahora: durante una expedición es la
     * MOCHILA (lo que te llevaste + lo usable que encuentras); fuera, la
     * bolsa de casa. Así todo el código (combate, curar, mercader, sucesos,
     * equipar) usa automáticamente la mochila mientras estás fuera.
     */
    raw() { const e = DK.store.state.expedition; return e && e.pack ? e.pack : DK.store.state.bag; },
    /** La bolsa de casa (aunque haya una expedición en curso). */
    home() { return DK.store.state.bag; },
    /** ¿Se está usando la mochila de la expedición? */
    inPack() { const e = DK.store.state.expedition; return !!(e && e.pack); },
    /** Pasa objetos { id: n } a la bolsa de casa. */
    addHome(items) { const b = this.home(); Object.entries(items || {}).forEach(([id, n]) => { if (n > 0) { b[id] = (b[id] || 0) + n; DK.codex && DK.codex.markItem(id); } }); },
    /** Cantidad que tienes de un objeto. */
    count(id) { return this.raw()[id] || 0; },
    add(id, n = 1) { if (n > 0) { this.raw()[id] = this.count(id) + n; DK.codex && DK.codex.markItem(id); } },
    /** Quita n unidades. Devuelve false si no hay suficientes. */
    remove(id, n = 1) {
      const c = this.count(id);
      if (c < n) return false;
      if (c - n <= 0) delete this.raw()[id]; else this.raw()[id] = c - n;
      return true;
    },
    /** [{item, qty}] de una categoría, ordenado por rareza y nombre. */
    list(category) {
      return Object.entries(this.raw())
        .filter(([id, q]) => q > 0 && D.items[id] && (!category || D.items[id].category === category))
        .map(([id, qty]) => ({ item: D.items[id], qty }))
        .sort((a, b) => D.rarities[a.item.rarity].order - D.rarities[b.item.rarity].order || a.item.name.localeCompare(b.item.name));
    },
    /** Número total de unidades de una categoría. */
    total(category) { return this.list(category).reduce((s, x) => s + x.qty, 0); },

    /** Motivo por el que NO se puede usar (o null si se puede). */
    cannotUse(itemId, d, { inBattle = false } = {}) {
      const it = D.items[itemId];
      if (it && it.category === 'mejora') {
        if (it.use.guardian) return t('bag.autoItem');
        if (inBattle) return t('bag.notInBattle');
        if (it.use.perm) return DK.daskai.tonicsUsed(d) >= DK.config.tonic.cap ? t('bag.tonicCap', { n: DK.config.tonic.cap }) : null;
        if (it.use.resetPerm) return DK.daskai.tonicsUsed(d) ? null : t('bag.noTonics');
        if (d.level >= DK.config.maxLevel) return t('bag.maxLevel');
        return null;
      }
      if (!it || it.category !== 'batalla') return t('bag.notBattleItem');
      if (it.use.capture) return inBattle ? null : t('bag.onlyInBattle');
      if (DK.daskai.isFainted(d)) return t('bag.fainted');
      const s = DK.daskai.stats(d), u = it.use;
      const helpsHp = (u.heal || u.healPct) && d.cur.hp < s.hp;
      const helpsMp = (u.mana || u.manaPct) && d.cur.mp < s.mp;
      const helpsSt = u.cure && d.status && u.cure.includes(d.status);
      if (!helpsHp && !helpsMp && !helpsSt) return t('bag.noEffect');
      return null;
    },

    /** Cuánto curaría un objeto (sin aplicarlo): {hp, mp} */
    potency(itemId, d) {
      const u = D.items[itemId].use || {}, s = DK.daskai.stats(d);
      const k = DK.curses && DK.expedition.active() ? DK.curses.effect('healMult') : 1; // pacto «Heridas»
      return { hp: Math.round(((u.heal || 0) + (u.healPct || 0) * s.hp) * k), mp: (u.mana || 0) + Math.round((u.manaPct || 0) * s.mp) };
    },

    /** Aplica el efecto de un objeto curativo. Devuelve {hp, mp, cured}. */
    applyTo(itemId, d) {
      const u = D.items[itemId].use, s = DK.daskai.stats(d);
      const p = this.potency(itemId, d), res = { hp: 0, mp: 0, cured: null };
      if (p.hp) { res.hp = Math.min(p.hp, s.hp - d.cur.hp); d.cur.hp += res.hp; }
      if (p.mp) { res.mp = Math.min(p.mp, s.mp - d.cur.mp); d.cur.mp += res.mp; }
      if (u.cure && d.status && u.cure.includes(d.status)) { res.cured = d.status; d.status = null; }
      return res;
    },

    /** Usar fuera de combate. Devuelve {ok, msg}. */
    use(itemId, d) {
      const why = this.cannotUse(itemId, d);
      if (why) return { ok: false, msg: why };
      this.remove(itemId);
      const u = D.items[itemId].use || {};
      if (u.perm || u.resetPerm) {
        // Tónico (mejora permanente) o elixir de olvido (devuelve los tónicos)
        let msg;
        if (u.perm) {
          DK.daskai.applyTonic(d, u.perm);
          msg = t('bag.tonicUsed', { name: DK.daskai.name(d), stat: DK.tr('stats', D.stats[u.perm]), n: DK.config.tonic.per[u.perm], left: DK.config.tonic.cap - DK.daskai.tonicsUsed(d) });
        } else {
          const back = DK.daskai.resetTonics(d);
          Object.entries(back).forEach(([id, n]) => this.add(id, n));
          msg = t('bag.tonicsBack', { name: DK.daskai.name(d), n: Object.values(back).reduce((a, b) => a + b, 0) });
        }
        DK.store.state.stats.itemsUsed++;
        DK.emit('item:used', { id: itemId });
        DK.store.save();
        return { ok: true, msg, d };
      }
      if (u.exp || u.levels) {
        // Objeto de experiencia: devuelve también levelInfo para mostrar subidas de nivel
        const n = u.exp || Math.max(1, DK.daskai.expToNext(d) - d.exp) + (u.levels > 1 ? DK.config.expCurve(d.level + 1) * (u.levels - 1) : 0);
        const levelInfo = DK.daskai.gainExp(d, n);
        DK.store.state.stats.itemsUsed++;
        DK.emit('item:used', { id: itemId });
        DK.store.save();
        return { ok: true, msg: t('bag.gainsExp', { name: DK.daskai.name(d), n }), levelInfo, d };
      }
      const r = this.applyTo(itemId, d);
      DK.store.state.stats.itemsUsed++;
      DK.emit('item:used', { id: itemId });
      DK.store.save();
      return { ok: true, msg: this.describeUse(d, r) };
    },

    /** Texto "X recupera 30 PV y ya no está envenenado". */
    describeUse(d, r) {
      if (!r) return '';
      const n = DK.daskai.name(d), parts = [];
      if (r.hp) parts.push(t('bag.recoversHp', { n: r.hp }));
      if (r.mp) parts.push(t('bag.recoversMp', { n: r.mp }));
      if (r.cured) parts.push(t('bag.curedStatus', { status: DK.tr('statuses', D.statuses[r.cured]).toLowerCase() }));
      return `${n} ${parts.join(t('common.and'))}.`;
    },

    /** Equipa un objeto en una ranura (devuelve a la bolsa el anterior). */
    equip(d, slot, itemId) {
      if (!this.remove(itemId)) return false;
      if (d.equip[slot]) this.add(d.equip[slot]);
      d.equip[slot] = itemId;
      DK.daskai.clamp(d);
      DK.store.save();
      return true;
    },
    unequip(d, slot) {
      if (!d.equip[slot]) return false;
      this.add(d.equip[slot]);
      d.equip[slot] = null;
      DK.daskai.clamp(d);
      DK.store.save();
      return true;
    },

    /**
     * Diferencias de atributos si se equipa `itemId` en `slot`.
     * @returns {Object} { atk: {from, to, diff}, ... } sólo los que cambian
     */
    equipPreview(d, slot, itemId) {
      const before = DK.daskai.stats(d);
      const eq = d.equip.slice(); eq[slot] = itemId;
      const after = DK.daskai.stats(d, eq);
      const out = {};
      [...D.statKeys, 'regen'].forEach((k) => { if (after[k] !== before[k]) out[k] = { from: before[k], to: after[k], diff: after[k] - before[k] }; });
      return out;
    },
  };

  /* ======================= MONEDAS ======================= */
  DK.wallet = {
    get() { return DK.store.state.coins || 0; },
    /** Suma monedas (cuenta para estadísticas y logros). */
    add(n, { silent = false } = {}) {
      if (n <= 0) return;
      DK.store.state.coins = this.get() + n;
      DK.store.state.stats.coinsEarned += n;
      if (!silent) DK.audio.sfx('coin');
      DK.emit('coins', { amount: n });
    },
    /** Gasta monedas. Devuelve false si no hay bastantes. */
    spend(n) {
      if (this.get() < n) return false;
      DK.store.state.coins -= n;
      DK.store.state.stats.coinsSpent += n;
      return true;
    },
  };

  /* ======================= TIENDA ======================= */
  DK.shop = {
    /** Precio de compra (lo usa el mercader de las expediciones). */
    buyPrice(id) { return D.prices[id] || 0; },
    sellPrice(id) { return Math.floor((D.prices[id] || 0) * DK.config.sellRatio); },
    canSell(id) { return !!D.prices[id]; },
    /** Compra n unidades. Devuelve true si se pudo. */
    buy(id, n = 1) {
      const cost = this.buyPrice(id) * n;
      if (!DK.wallet.spend(cost)) return false;
      DK.bag.add(id, n);
      DK.emit('bought', { id, n, cost });
      DK.store.save();
      return true;
    },
    /** Vende n unidades. */
    sell(id, n = 1) {
      if (!this.canSell(id) || !DK.bag.remove(id, n)) return false;
      DK.wallet.add(this.sellPrice(id) * n);
      DK.emit('sold', { id, n });
      DK.store.save();
      return true;
    },
  };

  /* ======================= CRAFTEO ======================= */
  DK.crafting = {
    recipes() { return D.recipes; },

    /* ---- Recetas descubiertas ---- */
    known() { return D.recipes.map((r) => r.id); },
    /** Todas las recetas están a la vista desde el principio. */
    isKnown() { return true; },
    /** (Compatibilidad) Antes las recetas se descubrían; ya no hace nada. */
    discover() { return false; },
    discoverRandom() { return []; },

    /**
     * Compara lo que hay en la mesa de fusión con las recetas.
     * @param {Object} mesa  { objeto: cantidad }
     * @returns {{exact: receta|null, partial: boolean}}
     *   exact: los ingredientes coinciden exactamente (conocida o no)
     *   partial: lo que hay forma parte de alguna receta (vas bien)
     */
    match(mesa) {
      const ids = Object.keys(mesa).filter((id) => mesa[id] > 0);
      if (!ids.length) return { exact: null, partial: false };
      const exact = D.recipes.find((r) => {
        const ing = Object.keys(r.ingredients);
        return ing.length === ids.length && ing.every((id) => mesa[id] === r.ingredients[id]);
      }) || null;
      const partial = !exact && D.recipes.some((r) => ids.every((id) => r.ingredients[id] && mesa[id] <= r.ingredients[id]));
      return { exact, partial };
    },
    /** Pista de una receta sin descubrir: un ingrediente y cuántos lleva. */
    hint(r) {
      const ing = Object.keys(r.ingredients);
      return { count: ing.length, one: ing.slice().sort((a, b) => D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order)[0] };
    },
    get(id) { return D.recipes.find((r) => r.id === id); },
    /** ¿Tienes todos los ingredientes directamente? */
    canCraft(r, times = 1) { return Object.entries(r.ingredients).every(([id, n]) => DK.bag.count(id) >= n * times); },
    /** Cuántas veces puedes fusionar esta receta ahora mismo. */
    maxTimes(r) { return Math.min(...Object.entries(r.ingredients).map(([id, n]) => Math.floor(DK.bag.count(id) / n))); },

    /** Fusiona (directamente). */
    craft(r, times = 1) {
      if (!this.canCraft(r, times)) return false;
      Object.entries(r.ingredients).forEach(([id, n]) => DK.bag.remove(id, n * times));
      DK.bag.add(r.result, r.qty * times);
      this.discover(r.id);
      DK.store.state.stats.crafts += times;
      DK.emit('crafted', { id: r.result, qty: r.qty * times, times });
      DK.store.save();
      return true;
    },

    /**
     * Plan de fusión en cadena: si falta un ingrediente que también se
     * fabrica, lo añade como paso previo.
     * @returns {{ok:boolean, steps:[{recipe, times}], missing:{id:n}}}
     */
    plan(recipe, times = 1) {
      const vb = Object.assign({}, DK.bag.raw());
      const steps = [], missing = {};
      const self = this;
      function need(id, n, depth) {
        const have = vb[id] || 0;
        if (have >= n) { vb[id] = have - n; return; }
        vb[id] = 0;
        const rem = n - have;
        const r = self.recipeFor(id);
        if (!r || !self.isKnown(r.id) || depth > 4) { missing[id] = (missing[id] || 0) + rem; return; }
        const crafts = Math.ceil(rem / r.qty);
        Object.entries(r.ingredients).forEach(([ing, q]) => need(ing, q * crafts, depth + 1));
        steps.push({ recipe: r, times: crafts });
        vb[id] = (vb[id] || 0) + crafts * r.qty - rem;
      }
      Object.entries(recipe.ingredients).forEach(([ing, q]) => need(ing, q * times, 0));
      steps.push({ recipe, times });
      return { ok: Object.keys(missing).length === 0, steps, missing };
    },

    /** Ejecuta un plan de fusión en cadena. */
    runPlan(plan) {
      if (!plan.ok) return false;
      for (const s of plan.steps) if (!this.craft(s.recipe, s.times)) return false;
      return true;
    },

    usesOf(itemId) { return D.recipes.filter((r) => r.ingredients[itemId]); },
    recipeFor(itemId) { return D.recipes.find((r) => r.result === itemId); },

    /* ---- Favoritas ---- */
    isFavorite(id) { return DK.store.state.favorites.includes(id); },
    toggleFavorite(id) {
      const f = DK.store.state.favorites;
      const i = f.indexOf(id);
      if (i >= 0) f.splice(i, 1); else f.push(id);
      DK.store.save();
      return i < 0;
    },
    /* ---- Objetivos (= favoritas, estrella en Crafteo) ---- */
    goals() { return (DK.store.state.favorites || []).map((id) => this.get(id)).filter(Boolean); },
    /** Objetivos que ya se pueden fabricar (directamente o en cadena). */
    goalsReady() { return this.goals().filter((r) => this.plan(r).ok); },
    /**
     * Lo que falta para los objetivos: { material: cuántos faltan } (suma de todos,
     * contando sólo los ingredientes directos).
     */
    goalNeeds() {
      const need = {};
      this.goals().forEach((r) => Object.entries(r.ingredients).forEach(([id, n]) => { need[id] = (need[id] || 0) + n; }));
      const out = {};
      Object.entries(need).forEach(([id, n]) => { const miss = n - DK.bag.count(id); if (miss > 0) out[id] = miss; });
      return out;
    },
    /**
     * Comprueba favoritas que acaban de poder fabricarse.
     * @returns {Array} recetas nuevas listas (para avisar una sola vez)
     */
    newlyReadyFavorites() {
      const st = DK.store.state, out = [];
      st.favorites.forEach((id) => {
        const r = this.get(id);
        const ready = r && this.isKnown(id) && this.plan(r).ok;
        const notified = st.notifiedReady.includes(id);
        if (ready && !notified) { st.notifiedReady.push(id); out.push(r); }
        if (!ready && notified) st.notifiedReady = st.notifiedReady.filter((x) => x !== id);
      });
      return out;
    },
  };

  /* ======================= CURAR CON OBJETOS ======================= */
  DK.healer = {
    /**
     * Calcula qué objetos usar para curar a una lista de daskai,
     * gastando lo mínimo posible (no usa objetos legendarios).
     * @param {Array} list daskai (los debilitados se ignoran)
     * @returns {{uses:[{uid,itemId}], totals:{itemId:n}, hp, mp, cures}}
     */
    plan(list) {
      const vb = Object.assign({}, DK.bag.raw());
      const res = { uses: [], totals: {}, hp: 0, mp: 0, cures: 0 };
      const battleItems = Object.keys(vb).filter((id) => D.items[id] && D.items[id].category === 'batalla' && D.items[id].rarity !== 'legendario' && !D.items[id].use.capture);
      const take = (uid, id) => { vb[id]--; res.uses.push({ uid, itemId: id }); res.totals[id] = (res.totals[id] || 0) + 1; };

      for (const d of list) {
        if (DK.daskai.isFainted(d)) continue;
        const s = DK.daskai.stats(d);
        let hp = d.cur.hp, mp = d.cur.mp, status = d.status;
        if (status) {
          const cure = battleItems.filter((id) => vb[id] > 0 && D.items[id].use.cure && D.items[id].use.cure.includes(status))
            .sort((a, b) => (D.prices[a] || 0) - (D.prices[b] || 0))[0];
          if (cure) { take(d.uid, cure); status = null; res.cures++; hp = Math.min(s.hp, hp + DK.bag.potency(cure, d).hp); }
        }
        const fill = (getMissing, kind) => {
          let guard = 20;
          while (getMissing() > 0 && guard-- > 0) {
            const missing = getMissing();
            const opts = battleItems.filter((id) => vb[id] > 0 && DK.bag.potency(id, d)[kind] > 0 && !(kind === 'mp' && DK.bag.potency(id, d).hp > 0))
              .map((id) => ({ id, amt: DK.bag.potency(id, d)[kind] }));
            if (!opts.length) break;
            const enough = opts.filter((o) => o.amt >= missing).sort((a, b) => a.amt - b.amt)[0];
            const pick = enough || opts.sort((a, b) => b.amt - a.amt)[0];
            take(d.uid, pick.id);
            if (kind === 'hp') { const g = Math.min(pick.amt, missing); hp += g; res.hp += g; } else { const g = Math.min(pick.amt, missing); mp += g; res.mp += g; }
          }
        };
        fill(() => s.hp - hp, 'hp');
        fill(() => s.mp - mp, 'mp');
      }
      return res;
    },

    /** Aplica un plan calculado con plan(). */
    apply(plan) {
      plan.uses.forEach(({ uid, itemId }) => {
        const d = DK.party.get(uid);
        if (d && DK.bag.remove(itemId)) { DK.bag.applyTo(itemId, d); DK.store.state.stats.itemsUsed++; DK.emit('item:used', { id: itemId }); }
      });
      DK.store.save();
    },
  };
})();
