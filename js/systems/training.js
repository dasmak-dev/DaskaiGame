/* =============================================================
 * systems/training.js — Exploraciones (DK.training, alias DK.explore). v4.86
 *
 * Sustituye al antiguo campo de entrenamiento: mandas un GRUPO de 1-3 daskai
 * a una zona ya desbloqueada durante un tiempo (corta / media / larga) y, al
 * volver, traen experiencia y botín de esa zona (materiales de sus salvajes,
 * monedas, fragmentos de forja y, a veces, una piedra común o equipo normal
 * o mágico; nunca raro). El tiempo corre aunque cierres el juego.
 *
 *   Coste al salir: monedas (cost) + raciones de viaje (racion_viaje).
 *   Riesgo: según el nivel medio del grupo frente al de la zona, su casa
 *     (la casa de la zona protege), naturalezas (Firme, Valiente) y la
 *     duración. Si sale mal vuelven AGOTADOS: la mitad de botín y experiencia
 *     y no pueden ir de expedición ni de exploración durante un rato (d.tired).
 *   Naturalezas: cada una da un pequeño bonus (config.explore.natures).
 *   Mejoras (Puesto de exploradores = el antiguo Instructor): más grupos,
 *     +% de botín y experiencia, y menos coste y riesgo. Emblemas + monedas.
 *
 *   Estado: state.training = { slots: [{ id, uids, zone, dur, start, v: 3 }], level, reports }
 *   (Se sigue llamando «training» por compatibilidad con partidas y pantallas.)
 * ============================================================= */
(function () {
  const C = () => DK.config.explore;
  const LEG = () => DK.config.training;   // ajustes del antiguo entrenamiento (sólo para convertir partidas viejas)
  const MIN = 60000;
  const D = DK.data, U = DK.util;
  const { t } = DK;

  /** Experiencia que habría ganado un daskai en el entrenamiento antiguo (para no perderla al convertir). */
  function legacyExp(d, minutes, boost = 1) {
    const T = LEG(); if (!T || !d) return 0;
    let lv = d.level, exp = d.exp || 0, gained = 0;
    const total = Math.min(minutes, T.maxHours * 60);
    for (let m = 0; m < total && lv < DK.config.maxLevel; m++) {
      const r = Math.min(T.ramp.max, 1 + T.ramp.perHour * ((m + 0.5) / 60));
      const add = T.pct(lv) * r * boost * DK.config.expCurve(lv);
      exp += add; gained += add;
      while (lv < DK.config.maxLevel && exp >= DK.config.expCurve(lv)) { exp -= DK.config.expCurve(lv); lv++; }
    }
    return Math.max(0, Math.floor(gained));
  }

  const st = () => {
    const s = DK.store.state; s.training = s.training || { slots: [] };
    const tr = s.training;
    // v4.86: los que estaban entrenando (sistema antiguo) vuelven con la experiencia ganada, gratis
    if (tr.slots.some((x) => x.v !== 3)) {
      const back = [];
      tr.slots = tr.slots.filter((x) => {
        if (x.v === 3) return true;
        const d = DK.party.get(x.uid);
        if (x.cost) DK.wallet.add(x.cost, { silent: true });
        if (d) {
          const exp = legacyExp(d, Math.max(0, (Date.now() - (x.start || Date.now())) / MIN), x.boost || 1);
          if (exp > 0) DK.daskai.gainExp(d, exp);
          DK.daskai.fullHeal(d);
          if (s.team.length < DK.config.maxTeam && !s.team.includes(d.uid)) s.team.push(d.uid);
          back.push({ name: DK.daskai.name(d), exp });
        }
        return false;
      });
      if (back.length) tr.legacy = back;
    }
    return tr;
  };

  /** Casa «de la zona»: la más común entre sus salvajes. */
  function zoneHouse(z) {
    const n = {};
    z.enemies.forEach((e) => { const sp = e.species || e[0], w = e.weight || e[1]; const hs = D.species[sp] && D.species[sp].house; if (hs) n[hs] = (n[hs] || 0) + (w || 1); });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
  }
  /** Materiales de la zona (lo que sueltan sus salvajes), con su peso. */
  function zoneMats(z) {
    const w = {};
    z.enemies.forEach((e) => { const sp = e.species || e[0], ew = e.weight || e[1]; (D.species[sp] && D.species[sp].drops || []).forEach(([id, p]) => {
      if (!D.items[id] || (D.isHidden && D.isHidden(id))) return;
      w[id] = (w[id] || 0) + p * (ew || 1);
    }); });
    return w;
  }
  const zoneLevel = (z) => Math.round((z.levels[0] + z.levels[1]) / 2);
  const natureOf = (d) => (d && d.nature) || 'equilibrada';
  const NAT = (d) => C().natures[natureOf(d)] || {};
  const sum = (ds, k) => ds.reduce((a, d) => a + (NAT(d)[k] || 0), 0);

  DK.training = {
    /* ---------- Mejoras (Puesto de exploradores; antes Instructor) ---------- */
    level() { const s = st(); const old = (DK.camp.raw() || {}).instructor || 0; if (old > (s.level || 0)) s.level = old; return Math.min(C().post.length - 1, s.level || 0); },
    instr() { return C().post[this.level()]; },
    nextLevel() { return C().post[this.level() + 1] || null; },
    cannotBuy() {
      const n = this.nextLevel(); if (!n) return 'max';
      if (DK.camp.emblems() < (n.emblems || 0)) return 'emblems';
      if (DK.wallet.get() < n.cost) return 'coins';
      return null;
    },
    buyLevel() {
      const n = this.nextLevel(); if (this.cannotBuy() || !DK.wallet.spend(n.cost)) return false;
      DK.store.state.emblems = DK.camp.emblems() - (n.emblems || 0);
      st().level = this.level() + 1;
      DK.emit('training:upgraded', { level: st().level }); DK.store.save();
      return true;
    },
    /** (Antiguo) puntos de atributo entrenados en versiones viejas: se conservan. */
    statMax() { return LEG().statMax; },
    trainedTotal(d) { const per = { hp: 4, mp: 3 }; return Object.entries(d.trained || {}).reduce((a, [k, v]) => a + v / (per[k] || 1), 0); },

    /* ---------- Grupos ---------- */
    slotCount() { return C().slots + this.instr().slots; },
    slotMax() { return C().slots + Math.max(...C().post.map((i) => i.slots)); },
    slots() { return st().slots; },
    groupOf(uid) { return st().slots.find((g) => g.uids.includes(uid)) || null; },
    get(id) { return st().slots.find((g) => g.id === id) || null; },
    /** ¿Está fuera explorando? (nombre antiguo: isTraining) */
    isTraining(uid) { return !!(DK.store.state && DK.store.state.training && (DK.store.state.training.slots || []).some((g) => (g.uids || [g.uid]).includes(uid))); },
    isExploring(uid) { return this.isTraining(uid); },
    /** Minutos que le quedan agotado (0 si está bien). */
    tiredLeft(d) { return d && d.tired ? Math.max(0, Math.ceil((d.tired - Date.now()) / MIN)) : 0; },
    isTired(d) { return this.tiredLeft(d) > 0; },
    /** Avisos de partidas antiguas (los que volvieron del entrenamiento al convertir). */
    takeLegacy() { const s = st(), l = s.legacy; delete s.legacy; return l || null; },

    /* ---------- Zonas ---------- */
    zones() { return DK.world.unlockedZones().filter((z) => z.enemies && z.enemies.length); },
    zoneInfo(zoneId) {
      const z = D.zones[zoneId]; if (!z) return null;
      const mats = zoneMats(z);
      return { z, lv: zoneLevel(z), house: zoneHouse(z), mats: Object.keys(mats).sort((a, b) => mats[b] - mats[a]), w: mats };
    },
    dur(id) { return C().durations.find((x) => x.id === id) || C().durations[0]; },
    /** v4.89: lo propio de una zona (reactivo, piedra favorita, tipos de equipo, hallazgo raro) o null. */
    finds(zoneId) { return (C().finds || {})[zoneId] || null; },
    /** v4.89: probabilidad de que el equipo encontrado sea mágico (sube con el nivel de la zona). */
    magicChance(lv) { return Math.min(0.75, C().loot.magic + lv * (C().findRates.magicPerLv || 0)); },
    /**
     * v4.87: todo lo que puede salir en una zona con una duración (para la lista «Posibles objetos»).
     * @returns {{mats:[{id, chance}], rolls, fragment, ration, coins:[min,max], stones:{list, chance}, gear:{chance, magic}, cache:{chance, rare}, total}}
     */
    zoneLoot(zoneId, durId, uids = []) {
      const info = this.zoneInfo(zoneId), du = this.dur(durId); if (!info) return null;
      const ds = uids.map((u) => DK.party.get(u)).filter(Boolean), L = C().loot, i = Math.min(2, C().durations.indexOf(du));
      const tot = Object.values(info.w).reduce((a, b) => a + b, 0) || 1, rolls = du.rolls + sum(ds, 'rolls'), rare = 1 + sum(ds, 'rare');
      const mats = info.mats.map((id) => ({ id, chance: 1 - Math.pow(1 - info.w[id] / tot, rolls) })); // prob. de que salga al menos uno
      const coinsMid = L.coins(info.lv) * du.k * (1 + sum(ds, 'coins')) * (1 + (this.instr().rate || 0));
      const out = {
        mats, rolls, fragment: L.fragment, ration: Math.min(1, L.ration * du.k), coins: [Math.round(coinsMid * C().hurt), Math.round(coinsMid)],
        stones: { list: L.stones, chance: Math.min(0.9, L.stone[i] * rare) }, gear: { chance: Math.min(0.9, L.gear[i] * rare), magic: L.magic },
        cache: { chance: Math.min(0.5, L.cache[i] * rare), rare: L.cacheRare },
      };
      // v4.89: lo propio de la zona
      const F = this.finds(zoneId), FR = C().findRates;
      if (F) {
        out.own = {
          reagent: F.reagent && D.items[F.reagent] ? { id: F.reagent, n: FR.reagent[i], locked: !DK.runes.enabled() } : null,
          stone: F.stone && D.items[F.stone] ? { id: F.stone, chance: out.stones.chance * FR.favStone } : null,
          gear: { types: F.gear || [], chance: out.gear.chance * FR.favGear },
          rare: F.rare && D.items[F.rare] ? { id: F.rare, chance: Math.min(0.5, FR.rare[i] * rare) } : null,
          rune: info.lv >= FR.runeFrom && FR.rune[i] ? { chance: Math.min(0.5, FR.rune[i] * rare), locked: !DK.runes.enabled() } : null,
          glyph: info.lv >= FR.runeFrom && (FR.glyph || [])[i] ? { chance: Math.min(0.5, FR.glyph[i] * rare), locked: !DK.runes.enabled() } : null,
          heart: info.lv >= (FR.heartFrom || 99) && (FR.heart || [])[i] ? { chance: Math.min(0.5, FR.heart[i] * rare), locked: !DK.runes.enabled() } : null,
        };
        out.gear.magic = this.magicChance(info.lv);
      }
      // Objetos que traerán más o menos (si todo va bien)
      out.total = Math.round(rolls * (1 + L.fragment) + out.ration + out.stones.chance + out.gear.chance + out.cache.chance * 5 + (out.own && out.own.reagent && !out.own.reagent.locked ? out.own.reagent.n : 0));
      return out;
    },

    /* ---------- Previsión ---------- */
    /** Riesgo (0–1) de que algo salga mal (agotados o desastre). */
    risk(ds, zoneId, durId) { return this.riskInfo(ds, zoneId, durId).risk; },
    /**
     * v4.89: riesgo desglosado (para la pantalla y el informe).
     * @returns {{risk, disaster, gap, parts:[{k, v}]}}  disaster = probabilidad de desastre (ya incluida en risk)
     */
    riskInfo(ds, zoneId, durId) {
      const R = C().risk, info = this.zoneInfo(zoneId), du = this.dur(durId), parts = [];
      if (!info || !ds.length) return { risk: 0, disaster: 0, gap: 0, parts };
      const lv = ds.reduce((a, d) => a + d.level, 0) / ds.length + sum(ds, 'riskLv');
      const gap = info.lv - lv; // > 0: van por debajo del nivel de la zona
      let r = R.base + gap * R.perLevel;
      parts.push({ k: 'level', v: Math.round(gap) });
      const mul = (k, v) => { if (v !== 1) { r *= v; parts.push({ k, v }); } };
      mul('house', ds.some((d) => DK.daskai.species(d).house === info.house) ? R.house : 1);
      // Débiles contra la casa de la zona (la casa de la zona es fuerte contra la suya)
      const weak = info.house && D.houses[info.house] ? ds.filter((d) => D.houses[info.house].strongVs === DK.daskai.species(d).house).length : 0;
      mul('weak', Math.pow(R.weak || 1, weak));
      mul('size', (R.size || [])[Math.min(3, ds.length) - 1] || 1);
      mul('firme', Math.pow(R.firme, ds.filter((d) => NAT(d).risk).length));
      mul('dur', du.risk || 1);
      mul('post', 1 - (this.instr().safety || 0));
      const risk = Math.max(R.min, Math.min(R.max, r));
      const share = Math.min(R.disasterMax || 0.7, (R.disaster || 0) + Math.max(0, gap) * (R.gap || 0));
      return { risk, disaster: risk * share, gap, parts };
    },
    /** Lo que cuesta salir: monedas y raciones. */
    cost(ds, zoneId, durId) {
      const info = this.zoneInfo(zoneId), du = this.dur(durId);
      if (!info) return { coins: 0, rations: 0 };
      const coins = Math.round(C().coins(info.lv, du.k, ds.length) * (1 - (this.instr().discount || 0)));
      return { coins, rations: du.rations };
    },
    /** Duración real en minutos (las Impetuosas la acortan). */
    minutes(ds, durId) { const du = this.dur(durId); return Math.round(du.min * Math.max(0.7, 1 - sum(ds, 'time'))); },
    /** Experiencia que trae cada uno (si todo va bien). */
    expFor(d, zoneId, durId) {
      const info = this.zoneInfo(zoneId), du = this.dur(durId); if (!info || d.level >= DK.config.maxLevel) return 0;
      // Si va muy por encima del nivel de la zona aprende menos
      const over = Math.max(0, d.level - (info.lv + 4)), damp = 1 / (1 + over * 0.25);
      return Math.round(DK.config.expCurve(d.level) * C().exp * du.k * damp * (1 + (NAT(d).exp || 0) + (this.instr().rate || 0)));
    },
    /** Resumen para la pantalla: riesgo, coste, experiencia, botín y bonus de naturalezas y casa. */
    preview(uids, zoneId, durId) {
      const ds = uids.map((u) => DK.party.get(u)).filter(Boolean), info = this.zoneInfo(zoneId), du = this.dur(durId);
      if (!info) return null;
      const L = C().loot, i = Math.min(2, C().durations.indexOf(du));
      const rare = 1 + sum(ds, 'rare');
      return {
        info, du, minutes: this.minutes(ds, durId), risk: this.risk(ds, zoneId, durId), riskInfo: this.riskInfo(ds, zoneId, durId), cost: this.cost(ds, zoneId, durId),
        exp: ds.map((d) => ({ d, n: this.expFor(d, zoneId, durId) })),
        rolls: du.rolls + sum(ds, 'rolls'), stone: Math.min(0.9, L.stone[i] * rare), gear: Math.min(0.9, L.gear[i] * rare),
        houseMatch: ds.some((d) => DK.daskai.species(d).house === info.house),
        bonuses: ds.filter((d) => C().natures[natureOf(d)] && C().natures[natureOf(d)].key).map((d) => ({ d, key: C().natures[natureOf(d)].key })),
      };
    },

    /* ---------- Enviar / volver ---------- */
    /** ¿Por qué no puede ir este daskai? */
    cannotMember(d) {
      if (!d || d.temp) return t('explore.why.notThis');
      if (this.isTraining(d.uid)) return t('explore.why.already');
      if (this.isTired(d)) return t('explore.why.tired', { t: U.duration(this.tiredLeft(d) * 60) });
      return null;
    },
    /** ¿Por qué no puede salir este grupo? */
    cannot(uids, zoneId, durId) {
      if (!Array.isArray(uids)) uids = uids ? [uids.uid || uids] : []; // compatibilidad: cannot(d)
      if (!DK.unlocks.has('training')) return t('unlock.trainingLocked');
      if (DK.expedition.active()) return t('explore.why.inExpedition');
      if (st().slots.length >= this.slotCount()) return t('explore.why.full');
      if (!uids.length) return t('explore.why.noOne');
      if (uids.length > C().partyMax) return t('explore.why.tooMany', { n: C().partyMax });
      const ds = uids.map((u) => DK.party.get(u));
      for (const d of ds) { const w = this.cannotMember(d); if (w) return w; }
      const team = DK.store.state.team, left = team.filter((u) => !uids.includes(u));
      if (!left.length && team.length) return t('explore.why.lastOne');
      if (!zoneId || !this.zoneInfo(zoneId) || !DK.world.isUnlocked(zoneId)) return t('explore.why.zone');
      const c = this.cost(ds, zoneId, durId);
      if (DK.wallet.get() < c.coins) return t('explore.why.noCoins', { n: c.coins });
      if (DK.bag.count('racion_viaje') < c.rations) return t('explore.why.noRations', { n: c.rations });
      return null;
    },
    send(uids, zoneId, durId) {
      if (this.cannot(uids, zoneId, durId)) return false;
      const ds = uids.map((u) => DK.party.get(u)), c = this.cost(ds, zoneId, durId);
      if (c.coins && !DK.wallet.spend(c.coins)) return false;
      DK.bag.remove('racion_viaje', c.rations);
      const s = DK.store.state;
      s.team = s.team.filter((u) => !uids.includes(u));
      const g = { id: 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), uids: uids.slice(), zone: zoneId, dur: this.dur(durId).id, min: this.minutes(ds, durId), start: Date.now(), v: 3 };
      st().slots.push(g);
      DK.emit('training:start', { g });
      DK.store.save();
      return g;
    },
    progress(g, now = Date.now()) {
      const total = g.min || this.dur(g.dur).min, elapsed = Math.max(0, (now - g.start) / MIN);
      return { total, elapsed, left: Math.max(0, total - elapsed), frac: Math.min(1, elapsed / total), done: elapsed >= total, ds: g.uids.map((u) => DK.party.get(u)).filter(Boolean) };
    },
    /** Hacerlos volver antes de tiempo: vuelven sin nada (lo pagado no se devuelve). */
    recall(id) {
      const g = this.get(id); if (!g) return false;
      st().slots = st().slots.filter((x) => x !== g);
      g.uids.forEach((u) => this.rejoin(u));
      DK.emit('training:collect', { g, recalled: true }); DK.store.save();
      return true;
    },
    rejoin(uid) { const s = DK.store.state, d = DK.party.get(uid); if (!d) return; DK.daskai.fullHeal(d); if (s.team.length < DK.config.maxTeam && !s.team.includes(uid) && !this.isTired(d)) s.team.push(uid); },

    /**
     * Recoger un grupo que ya ha vuelto: tira el riesgo y el botín, lo aplica
     * y devuelve el informe (con el diario del viaje).
     * @returns {{ok, hurt, zone, exp:[{d,n,levelInfo}], items:Object, coins, gear:[], log:[]}|null}
     */
    collect(id, rnd = Math.random) {
      const g = this.get(id) || this.groupOf(id); if (!g) return null;
      const p = this.progress(g); if (!p.done) return null;
      const ds = p.ds, info = this.zoneInfo(g.zone), du = this.dur(g.dur), L = C().loot, i = Math.min(2, C().durations.indexOf(du));
      const names = () => DK.daskai.name(U.pick(ds, rnd));
      const log = [t('explore.log.set', { names: ds.map((d) => DK.daskai.name(d)).join(', '), zone: info.z.name })];
      // v4.89: tres desenlaces: bien, agotados (mitad de todo) o DESASTRE (sin botín, poca experiencia, el doble de agotados)
      const RI = this.riskInfo(ds, g.zone, g.dur), roll = rnd();
      const outcome = roll < RI.disaster ? 'disaster' : roll < RI.risk ? 'hurt' : 'ok', hurt = outcome !== 'ok', lost = outcome === 'disaster';
      const mult = (hurt ? C().hurt : 1) * (1 + (this.instr().rate || 0));
      const F = this.finds(g.zone) || {}, FR = C().findRates;
      const items = {}, add = (id, n = 1) => (items[id] = (items[id] || 0) + n);
      // Materiales de la zona
      const rolls = Math.max(1, Math.round((du.rolls + sum(ds, 'rolls')) * mult));
      for (let k = 0; k < rolls; k++) { const id = U.weightedKey(info.w, rnd); if (id) add(id); }
      Object.keys(items).slice(0, 2).forEach((id) => log.push(t('explore.log.found', { name: names(), item: D.items[id].name })));
      // Fragmentos de forja y raciones
      for (let k = 0; k < rolls; k++) if (rnd() < L.fragment) add('fragmento_forja');
      if (rnd() < L.ration * du.k) add('racion_viaje');
      // Algo raro: piedra común o equipo (normal o mágico)
      const rare = 1 + sum(ds, 'rare'), gear = [];
      if (rnd() < L.stone[i] * rare * (hurt ? 0.5 : 1)) {
        // v4.89: la piedra favorita de la zona sale más
        const s = F.stone && D.items[F.stone] && rnd() < FR.favStone ? F.stone : U.pick(L.stones, rnd);
        add(s); log.push(t('explore.log.rare', { name: names(), item: D.items[s].name }));
      }
      // v4.89: reactivo de runas de la zona (sólo con el Taller de runas)
      if (F.reagent && D.items[F.reagent] && DK.runes.enabled()) {
        const avg = FR.reagent[i] * (hurt ? 0.5 : 1), n = Math.floor(avg) + (rnd() < avg % 1 ? 1 : 0);
        if (n) { add(F.reagent, n); log.push(t('explore.log.reagent', { name: names(), item: D.items[F.reagent].name })); }
      }
      // v4.89: hallazgo raro de la zona (un tónico)
      if (F.rare && D.items[F.rare] && rnd() < FR.rare[i] * rare * (hurt ? 0.5 : 1)) { add(F.rare); log.push(t('explore.log.rare', { name: names(), item: D.items[F.rare].name })); }
      if (rnd() < L.gear[i] * rare * (hurt ? 0.5 : 1)) {
        // v4.89: sobre todo de los tipos de la zona; más mágico cuanto más alta
        const bases = Object.keys(D.gear.typeOf).filter((b) => D.items[b]), fav = bases.filter((b) => (F.gear || []).includes(D.gear.typeOf[b]));
        const base = U.pick(fav.length && rnd() < FR.favGear ? fav : bases, rnd);
        const pc = DK.gear.create(base, { rarity: rnd() < this.magicChance(info.lv) ? 'magico' : 'normal', ilvl: info.lv });
        gear.push(pc); log.push(t('explore.log.gear', { name: names(), item: DK.gear.name(pc) }));
      }
      // v4.90: glifo de ascenso y corazón rúnico (para mejorar runas), en zonas altas
      if (DK.runes.enabled() && info.lv >= FR.runeFrom && rnd() < (FR.glyph || [])[i] * rare * (hurt ? 0.5 : 1)) { add('glifo_ascenso'); log.push(t('explore.log.rare', { name: names(), item: D.items.glifo_ascenso.name })); }
      if (DK.runes.enabled() && info.lv >= (FR.heartFrom || 99) && rnd() < (FR.heart || [])[i] * rare * (hurt ? 0.5 : 1)) { add('corazon_runico'); log.push(t('explore.log.rare', { name: names(), item: D.items.corazon_runico.name })); }
      // v4.89: una runa (zonas altas, con el Taller de runas)
      const runes = [];
      if (DK.runes.enabled() && info.lv >= FR.runeFrom && rnd() < FR.rune[i] * rare * (hurt ? 0.5 : 1)) {
        const r = DK.runes.roll(1, rnd)[0]; if (r) { const id = DK.runes.roll1(r, 1, rnd); runes.push(id); log.push(t('explore.log.rune', { name: names() })); }
      }
      // v4.87: hallazgo exclusivo: un alijo de explorador
      let cache = null;
      if (rnd() < (L.cache[i] || 0) * rare * (hurt ? 0.5 : 1)) {
        cache = { racion_viaje: 2, fragmento_forja: 3 };
        const s1 = U.pick(L.stones, rnd), s2 = rnd() < 0.3 ? U.pick(L.cacheRare, rnd) : U.pick(L.stones, rnd);
        cache[s1] = (cache[s1] || 0) + 1; cache[s2] = (cache[s2] || 0) + 1;
        Object.entries(cache).forEach(([id, n]) => add(id, n));
        log.push(t('explore.log.cache', { name: names() }));
      }
      // Monedas
      const coins = Math.round(L.coins(info.lv) * du.k * mult * (1 + sum(ds, 'coins')));
      // Un suceso de ambiente
      log.push(t('explore.log.ev.' + U.pick(C().events, rnd), { name: names(), zone: info.z.name }));
      // v4.89: desastre: lo pierden todo por el camino
      let lostN = 0;
      if (lost) {
        lostN = Object.values(items).reduce((a, b) => a + b, 0) + gear.length + runes.length;
        Object.keys(items).forEach((k) => delete items[k]); gear.length = 0; runes.length = 0; cache = null;
        log.push(t('explore.log.disaster', { name: names(), n: lostN }));
      }
      const coinsGot = lost ? 0 : coins;
      // Aplicar
      Object.entries(items).forEach(([id, n]) => DK.bag.addHome({ [id]: n }));
      gear.forEach((pc) => { DK.gear.home().push(pc); if (DK.codex) DK.codex.markItem(pc.base); DK.emit('gear:gained', { p: pc }); });
      runes.forEach((id) => DK.runes.add(id));
      if (coinsGot) DK.wallet.add(coinsGot, { silent: true });
      const exp = ds.map((d) => {
        const n = Math.round(this.expFor(d, g.zone, g.dur) * (lost ? C().disasterExp : hurt ? C().hurt : 1));
        const levelInfo = n > 0 ? DK.daskai.gainExp(d, n) : null;
        return { d, n, levelInfo };
      });
      if (hurt) {
        const fat = du.fatigue * (lost ? C().disasterFatigue : 1) * Math.max(0.3, 1 - sum(ds, 'fatigue'));
        ds.forEach((d) => (d.tired = Date.now() + fat * MIN));
        log.push(t('explore.log.hurt', { name: names(), t: U.duration(fat * 60) }));
      } else log.push(t('explore.log.back'));
      st().slots = st().slots.filter((x) => x !== g);
      ds.forEach((d) => this.rejoin(d.uid));
      const rep = { ok: true, hurt, outcome, lost: lostN, zone: g.zone, dur: g.dur, exp, items, coins: coinsGot, gear, runes, log, cache, at: Date.now() };
      rep.done = this.checkRequests(rep, ds);
      const s = st(); s.reports = [{ zone: g.zone, hurt, outcome, names: ds.map((d) => DK.daskai.name(d)), items, coins: coinsGot, gear: gear.length, at: rep.at }].concat(s.reports || []).slice(0, 8);
      DK.emit('training:collect', rep);
      DK.store.save();
      return rep;
    },
    /* ---------- Encargos del día (v4.87) ---------- */
    /** Los encargos de hoy (se generan una vez al día a partir de la fecha). */
    requests() {
      const s = st(), day = new Date().toISOString().slice(0, 10);
      if (!s.req || s.req.day !== day) {
        let seed = 0; for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        const zones = this.zones(), houses = [...new Set(DK.party.all().filter((d) => !d.temp).map((d) => DK.daskai.species(d).house))];
        const pool = [];
        if (zones.length) pool.push(() => { const z = zones[Math.floor(rnd() * zones.length)]; return { type: 'zone', zone: z.id }; });
        pool.push(() => ({ type: 'long' }));
        if (houses.length) pool.push(() => ({ type: 'house', house: houses[Math.floor(rnd() * houses.length)] }));
        pool.push(() => ({ type: 'items', n: 8 }));
        if (zones.length > 1) pool.push(() => ({ type: 'safe', lv: this.zoneInfo(zones[zones.length - 1].id).lv }));
        const n = C().requests.base + (this.level() >= C().requests.extraAt ? 1 : 0), list = [], used = new Set();
        for (let k = 0; k < 20 && list.length < n; k++) { const r = pool[Math.floor(rnd() * pool.length)](); if (used.has(r.type)) continue; used.add(r.type); list.push(Object.assign(r, { id: r.type, done: false, claimed: false, stone: rnd() < C().requests.stoneChance })); }
        s.req = { day, list };
      }
      return s.req.list;
    },
    requestText(r) {
      switch (r.type) {
        case 'zone': return t('explore.req.zone', { zone: D.zones[r.zone] ? D.zones[r.zone].name : r.zone });
        case 'long': return t('explore.req.long');
        case 'house': return t('explore.req.house', { house: D.houses[r.house] ? DK.tr('houses', D.houses[r.house]) : r.house });
        case 'items': return t('explore.req.items', { n: r.n });
        case 'safe': return t('explore.req.safe', { n: r.lv });
        default: return '';
      }
    },
    requestReward(r) {
      const lv = Math.max(1, ...this.zones().map((z) => this.zoneInfo(z.id).lv)), rw = C().requests.reward(Math.min(lv, 60));
      const items = Object.assign({}, rw.items); if (r.stone) items[C().loot.stones[(r.type.length * 7) % C().loot.stones.length]] = 1;
      return { coins: rw.coins, items };
    },
    /** Marca los encargos que cumple esta exploración. */
    checkRequests(rep, ds) {
      const done = [];
      this.requests().forEach((r) => {
        if (r.done) return;
        const n = Object.values(rep.items).reduce((a, b) => a + b, 0) + rep.gear.length;
        const ok = r.type === 'zone' ? rep.zone === r.zone : r.type === 'long' ? rep.dur === 'long' : r.type === 'house' ? ds.some((d) => DK.daskai.species(d).house === r.house)
          : r.type === 'items' ? n >= r.n : r.type === 'safe' ? !rep.hurt && this.zoneInfo(rep.zone).lv >= r.lv : false;
        if (ok) { r.done = true; done.push(r); }
      });
      return done;
    },
    claimRequest(id) {
      const r = this.requests().find((x) => x.id === id); if (!r || !r.done || r.claimed) return null;
      const rw = this.requestReward(r); r.claimed = true;
      DK.wallet.add(rw.coins, { silent: true }); DK.bag.addHome(rw.items); DK.store.save();
      return rw;
    },
    /** Raciones de regalo la primera vez (también a partidas que ya tenían el campo). */
    takeGift() { const s = st(); if (s.gift || !DK.unlocks.has('training')) return 0; s.gift = true; DK.bag.addHome({ racion_viaje: C().gift }); DK.store.save(); return C().gift; },
    /** Grupos que ya han vuelto (para el aviso del menú). */
    readyCount() { return DK.store.state && DK.store.state.training ? st().slots.filter((g) => this.progress(g).done).length : 0; },
  };
  DK.explore = DK.training;
})();
