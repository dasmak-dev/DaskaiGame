/* =============================================================
 * systems/endgame.js — Final del juego (data/endgame.js).
 *
 *   DK.corruption  Niveles de Corrupción (state.corruption = { max })
 *   DK.abyss       El Abismo (v5.1, boss rush por zona): series de jefes, récords y premios (state.abyss)
 *   DK.nightmare   Versión pesadilla de una zona con el códice completo
 *   DK.ascension   Ascender (d.stars) · DK.variants (d.variant)
 *   DK.tracking    Rastreo de variocolores (state.tracking = { especie: derrotas })
 *   DK.engrave     Reliquias grabadas (state.vault.engraved = [id])
 *   DK.endgame     Efectos combinados que leen expedición, combate y daskai
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const G = () => D.endgame;
  const st = () => DK.store.state;
  const exp = () => (st() && st().expedition) || null;
  const t = (...a) => DK.t(...a);

  /* ---------------- Corrupción ---------------- */
  DK.corruption = {
    levels() { return G().corruption.levels; },
    max() { return st() ? ((st().corruption || {}).max || 0) : 0; },
    /** ¿Ya se ve? (jefe de la 3ª zona vencido) */
    visible() {
      if (!st()) return false;
      const z = Object.keys(D.zones).filter((id) => !D.zones[id].secretZone)[G().corruption.zoneIndex];
      return !!z && DK.world.boss(z).defeated > 0;
    },
    /** Nivel de la expedición en curso (o de la próxima). */
    current() { const e = exp(); if (e) return e.corruption || 0; const n = st() && st().nextExpedition; return (n && n.corruption) || 0; },
    def(lv = this.current()) { return lv > 0 ? this.levels()[lv - 1] : null; },
    /** Suma de un valor de los niveles 1..lv (los niveles se acumulan en reglas; los números son los del nivel). */
    has(rule, lv = this.current()) { return this.levels().slice(0, lv).some((l) => l.rule === rule); },
    /** Elige el nivel de la próxima expedición (0 = sin corrupción, sólo antes de desbloquearla). */
    set(lv) {
      lv = Math.max(this.max() > 0 ? 1 : 0, Math.min(this.max(), lv | 0)); // v5.0: desbloqueada, como mínimo el nivel I
      const n = DK.expedition.nextStart();
      if ((n.corruption || 0) === lv) return lv;
      n.corruption = lv; n.seed = `${n.zone}-${Date.now()}`;
      DK.store.save();
      return lv;
    },
    /** Al vencer al jefe de un mapa: si iba con el nivel máximo, se abre el siguiente. */
    onBoss() {
      const e = exp(); if (!e || !st()) return null;
      st().corruption = st().corruption || { max: 0 };
      const lv = e.corruption || 0;
      if (lv === st().corruption.max && lv < this.levels().length && this.visible()) {
        st().corruption.max = lv + 1;
        DK.ui.toast(t('corruption.unlocked', { n: lv + 1 }), { icon: 'skull', kind: 'good' });
        return lv + 1;
      }
      return null;
    },
    /** Al hacerse visible por primera vez se abre el nivel 1. */
    check() {
      if (!st() || !this.visible()) return;
      st().corruption = st().corruption || { max: 0 };
      if (!st().corruption.max) { st().corruption.max = 1; DK.ui.toast(t('corruption.revealed'), { icon: 'skull', kind: 'good' }); DK.store.save(); }
    },
  };

  /* ---------------- Versión pesadilla de una zona ---------------- */
  DK.nightmare = {
    available(zone) { return !!st() && DK.world.isUnlocked(zone) && DK.codex.completion(zone) >= 1; },
    /** ¿Afecta al mapa actual? (sólo en la zona elegida) */
    on() { const e = exp(); return !!(e && e.nightmare && e.zone === e.nightmare); },
    toggle() {
      const n = DK.expedition.nextStart();
      n.nightmare = n.nightmare ? null : (this.available(n.zone) ? n.zone : null);
      n.seed = `${n.zone}-${Date.now()}`; DK.store.save();
      return !!n.nightmare;
    },
  };

  /* ---------------- El Abismo (v5.1: boss rush de cada zona) ----------------
   * state.abyss = { best, rewarded, zones: { zona: { best, rounds, done } } }
   *   best   → más jefes seguidos en una sola bajada (de cualquier zona)
   *   zones  → por zona: récord de jefes seguidos, rondas completas y si ya diste el premio de la primera ronda
   * La expedición en curso apunta en e.abyssKills los jefes vencidos en esta bajada. */
  const order = () => Object.keys(D.zones).filter((z) => !D.zones[z].secretZone);
  DK.abyss = {
    unlocked() { return !!st() && Object.keys(D.zones).filter((z) => DK.world.boss(z).defeated > 0).length >= G().abyss.bosses; },
    /** ¿Se puede bajar al Abismo de esta zona? (Abismo abierto y su jefe vencido) */
    available(zoneId) { return this.unlocked() && !!D.zones[zoneId] && !!D.zones[zoneId].boss && DK.world.boss(zoneId).defeated > 0; },
    on() { const e = exp(); return !!(e && e.kind === 'abismo'); },
    rec() { const s = st(); s.abyss = s.abyss || { best: 0, rewarded: 0 }; s.abyss.zones = s.abyss.zones || {}; return s.abyss; },
    best(zoneId) { if (!st()) return 0; const r = this.rec(); return zoneId ? ((r.zones[zoneId] || {}).best || 0) : (r.best || 0); },
    rounds(zoneId) { return st() ? ((this.rec().zones[zoneId] || {}).rounds || 0) : 0; },
    /** Ronda actual (1, 2, 3…): cada mapa del Abismo es una ronda. */
    floor() { const e = exp(); return e && e.kind === 'abismo' ? (e.depth || 1) : 0; },
    /** Jefes de la serie de una zona, del primero al último (el último es el de la propia zona). */
    series(zoneId) {
      const all = order(), i = all.indexOf(zoneId);
      if (i < 0) return [zoneId];
      return all.slice(Math.max(0, i - G().abyss.series + 1), i + 1).filter((z) => D.zones[z].boss);
    },
    /** Nivel de un jefe de la serie (antes de la bonificación por ronda de la expedición). */
    bossLevel(zoneId, idx) {
      const A = G().abyss, top = (D.zones[zoneId] && D.zones[zoneId].boss.level) || 1;
      const n = this.series(zoneId).length, i = idx == null ? n - 1 : Math.max(0, Math.min(n - 1, idx));
      return top + A.baseLevel - (n - 1 - i) * A.roundLevel;
    },
    /** Prepara la próxima expedición como Abismo de su zona (o la devuelve a normal). */
    set(on) {
      const n = DK.expedition.nextStart();
      if (on && !this.available(n.zone)) return false;
      if (on) {
        n.abyssPrev = n.abyssPrev || { kind: n.kind, size: n.size };
        n.kind = 'abismo'; n.size = 'abyss'; n.abyssMod = n.mod; n.mod = null; // sin clima en el Abismo
        n.runeSlots = DK.runes.slots().filter((id) => DK.runes.get(id).group === 'bonus');
      } else if (n.kind === 'abismo') {
        const p = n.abyssPrev || {}; n.kind = p.kind && p.kind !== 'abismo' ? p.kind : 'normal'; n.size = p.size && p.size !== 'abyss' ? p.size : 'small'; delete n.abyssPrev;
        if (n.abyssMod !== undefined) { n.mod = n.abyssMod; delete n.abyssMod; }
        DK.runes.apply(n);
      }
      n.seed = `${n.zone}-${Date.now()}`; DK.store.save();
      return on;
    },
    /** Tras vencer a un jefe en el Abismo: premio pequeño y récords. */
    onBoss() {
      const e = exp(); if (!e || e.kind !== 'abismo') return null;
      e.abyssKills = (e.abyssKills || 0) + 1;
      const r = this.rec(), z = e.startZone || e.zone, zr = r.zones[z] = r.zones[z] || { best: 0, rounds: 0 };
      if (e.abyssKills > zr.best) zr.best = e.abyssKills;
      if (e.abyssKills > (r.best || 0)) r.best = e.abyssKills;
      const pb = G().abyss.perBoss(e.depth || 1);
      DK.camp.addEmblems(pb.emblems);
      DK.expedition.addLoot([], pb.coins);
      DK.ui.toast(t('abyss.bossKill', { n: e.abyssKills, e: pb.emblems }), { icon: 'crown', kind: 'good' });
      DK.store.save();
      return { kills: e.abyssKills, emblems: pb.emblems, coins: pb.coins };
    },
    /** Tras completar una ronda (el jefe de la zona, al final del mapa): premio grande. */
    onFloor(round) {
      const e = exp(), r = this.rec(), z = (e && (e.startZone || e.zone)) || '', zr = r.zones[z] = r.zones[z] || { best: 0, rounds: 0 };
      zr.rounds = (zr.rounds || 0) + 1;
      if (round > (r.rewarded || 0)) r.rewarded = round;
      const A = G().abyss, rw = A.reward(round), first = !zr.done;
      zr.done = true;
      const got = { floor: round, emblems: rw.emblems, coins: rw.coins, runes: [], abisal: !!rw.abisal || first };
      DK.camp.addEmblems(rw.emblems);
      DK.expedition.addLoot([], rw.coins);
      for (let i = 0; i < 2 && DK.runes.enabled(); i++) { const id = DK.runes.roll1(DK.runes.roll(1)[0], rw.rune); DK.runes.add(id); got.runes.push(id); }
      // Fragmento abisal: la primera ronda completa de cada zona y luego cada 3 rondas
      if (got.abisal) DK.bag.addHome({ fragmento_abisal: 1 });
      DK.ui.toast(t('abyss.reward', { n: round }), { icon: 'gift', kind: 'good' });
      return got;
    },
  };

  /* ---------------- Ascensión y formas alternativas ---------------- */
  DK.ascension = {
    max() { return G().ascension.maxStars; },
    stars(d) { return d.stars || 0; },
    can(d) { return d.level >= DK.config.maxLevel && this.stars(d) < this.max(); },
    /** Vuelve al nivel 1 con una estrella más (+% de atributos). Conserva ataques, talentos, tónicos y evoluciones. */
    ascend(d) {
      if (!this.can(d)) return false;
      d.stars = this.stars(d) + 1;
      d.level = 1; d.exp = 0;
      const evo = d.evoBonus || {};
      D.statKeys.forEach((k) => { d.growth[k] = evo[k] || 0; if (d.natureGrowth) d.natureGrowth[k] = 0; });
      DK.daskai.touch();
      DK.daskai.fullHeal(d);
      DK.emit('ascended', { d });
      DK.store.save();
      return true;
    },
  };
  DK.variants = {
    def(id) { return G().variants[id] || null; },
    isFinal(d) { return !D.species[d.species].evolve; },
  };

  /* ---------------- Rastreo de variocolores ---------------- */
  DK.tracking = {
    count(sp) { return (st() && st().tracking && st().tracking[sp]) || 0; },
    bonus(sp) { const c = G().tracking; return Math.min(c.cap, this.count(sp) * c.perDefeat); },
  };
  DK.on('enemy:defeated', (e) => { if (!st() || !e.species) return; st().tracking = st().tracking || {}; st().tracking[e.species] = (st().tracking[e.species] || 0) + 1; });

  /* ---------------- Reliquias grabadas ---------------- */
  DK.engrave = {
    list() { const v = st() && st().vault; return (v && v.engraved) || []; },
    slots() { const c = G().engrave; return c.slots + (DK.corruption.max() >= c.extraSlotAt ? 1 : 0); },
    can(id) { const r = D.relics[id]; return !!r && G().engrave.rarities.includes(r.rarity) && DK.camp.isUnlocked('relic', id); },
    has(id) { return this.list().includes(id); },
    engrave(id) {
      if (!this.can(id) || this.has(id) || this.list().length >= this.slots() || DK.camp.emblems() < G().engrave.cost) return false;
      st().emblems -= G().engrave.cost;
      st().vault.engraved = this.list().concat(id);
      DK.store.save(); return true;
    },
    remove(id) { if (!this.has(id)) return false; st().vault.engraved = this.list().filter((x) => x !== id); DK.store.save(); return true; },
  };

  /* ---------------- Zona secreta final ---------------- */
  const finalZone = () => G().finalZone;
  DK.endgame = {
    /** Contenido de final de juego a la vista (para enseñar runas nuevas, etc.) */
    late() { return DK.corruption.visible(); },
    /** +% de atributos de los rivales (corrupción, pesadilla, abismo). */
    enemyStat(d) {
      const e = exp(); if (!e) return 0;
      const c = DK.corruption.def(e.corruption || 0);
      let m = (c ? c.stat : 0) + (DK.nightmare.on() ? G().nightmare.stat : 0) + (e.kind === 'abismo' ? ((e.depth || 1) - 1) * G().abyss.depthStat : 0);
      return m;
    },
    bossHp(d) { const e = exp(); return e && d.boss && DK.corruption.has('bossHp', e.corruption || 0) ? G().corruption.bossHp : 1; },
    /** + niveles de los rivales. */
    levels(n) {
      const lv = n ? n.corruption || 0 : DK.corruption.current();
      const c = DK.corruption.def(lv);
      const e = n ? null : exp();
      const night = n ? !!(n.nightmare && n.nightmare === n.zone) : DK.nightmare.on();
      const abyss = n ? 0 : (e && e.kind === 'abismo' ? (e.depth || 1) - 1 : 0); // v5.1: la 1.ª ronda sin extra (los jefes ya van subidos)
      return (c ? c.levels : 0) + (night ? G().nightmare.levels : 0) + abyss * G().abyss.depthLevel;
    },
    coins() { const c = DK.corruption.def(); return (c ? c.coins : 0) + (DK.nightmare.on() ? G().nightmare.coins : 0); },
    emblems(n) { const c = DK.corruption.def(n ? n.corruption || 0 : undefined); return (c ? c.emblems : 0) + ((n ? n.nightmare && n.nightmare === n.zone : DK.nightmare.on()) ? G().nightmare.emblems : 0); },
    shiny(sp) { const c = DK.corruption.def(); return (c ? c.shiny : 0) + (sp ? DK.tracking.bonus(sp) : 0); },
    /** Probabilidad de que una runa caída suba de tier. */
    runeTier() { const e = exp(); const c = DK.corruption.def(); return Math.min(0.8, (c ? c.tier : 0) + (e ? Math.min(0.3, ((e.depth || 1) - 1) * 0.05) : 0)); },
    /** Probabilidad de fragmento abisal al vencer a un jefe. */
    abisalChance(battle) {
      const A = G().abisalDrop;
      if (battle.secret) return A.secret;
      if (battle.boss && battle.zoneId === finalZone()) return A.finalZone;
      if (battle.boss && battle.final !== false && DK.corruption.current() >= 3) return A.corruption;
      return 0;
    },
    /** Zona secreta final: se abre al vencer a todos los jefes ocultos. */
    checkFinalZone() {
      const z = finalZone(); if (!st() || !D.zones[z] || DK.world.isUnlocked(z)) return false;
      const secrets = Object.keys(D.secretBosses || {});
      if (!secrets.length || !secrets.every((id) => DK.world.secret(id).defeated > 0)) return false;
      DK.world.progress(z).unlocked = true;
      DK.emit('zone:unlocked', { zone: z });
      DK.ui.toast(t('endgame.finalZone', { zone: D.zones[z].name }), { icon: 'moon', kind: 'good' });
      DK.store.save();
      return true;
    },
  };
  DK.on('secret:defeated', () => setTimeout(() => DK.endgame.checkFinalZone(), 60));
  ['battle:end', 'game:loaded', 'expedition:complete'].forEach((ev) => DK.on(ev, () => setTimeout(() => { DK.corruption.check(); DK.endgame.checkFinalZone(); }, 70)));
})();
