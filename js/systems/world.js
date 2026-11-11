/* =============================================================
 * systems/world.js — Códice (bestiario), progreso de zonas,
 * jefes y zona recomendada.
 * ============================================================= */
(function () {
  const D = DK.data;

  DK.codex = {
    raw() { return DK.store.state.codex; },
    zone(zoneId) { return this.raw()[zoneId]; },
    /** Marca una zona como descubierta (aparece su pestaña en el códice). */
    discoverZone(zoneId) {
      if (!this.raw()[zoneId]) this.raw()[zoneId] = { discovered: Date.now(), enemies: {}, items: [] };
      return this.raw()[zoneId];
    },
    discoveredZones() { return Object.keys(D.zones).filter((z) => this.raw()[z]); },
    /** Entrada de un enemigo en una zona (la crea si no existe). */
    entry(zoneId, sp) {
      const z = this.discoverZone(zoneId);
      if (!z.enemies[sp]) z.enemies[sp] = { seen: 0, fought: 0, defeated: 0, captured: 0, moves: [], drops: [] };
      return z.enemies[sp];
    },
    getEntry(zoneId, sp) { const z = this.zone(zoneId); return z && z.enemies[sp]; },
    seeEnemy(zoneId, sp) { this.entry(zoneId, sp).seen++; },
    /** Veces que se ha peleado contra esta especie en esta zona. */
    fought(zoneId, sp) { const e = this.getEntry(zoneId, sp); return e ? e.fought : 0; },
    recordMove(zoneId, sp, moveId) { const e = this.entry(zoneId, sp); if (!e.moves.includes(moveId)) e.moves.push(moveId); },
    recordDrop(zoneId, sp, itemId) {
      const e = this.entry(zoneId, sp); if (!e.drops.includes(itemId)) e.drops.push(itemId);
      const z = this.zone(zoneId); if (!z.items.includes(itemId)) z.items.push(itemId);
    },
    /** Todos los objetos que pueden obtenerse en una zona (incluido el jefe). */
    zoneItems(zoneId) {
      const set = [];
      const add = (id) => { if (!set.includes(id)) set.push(id); };
      D.zones[zoneId].enemies.forEach(({ species }) => D.species[species].drops.forEach(([id]) => add(id)));
      if (D.zones[zoneId].boss) D.zones[zoneId].boss.drops.forEach(([id]) => add(id));
      return set;
    },
    /* ---- Vista global (Códice): especies, objetos y jefes ---- */
    /** Objetos conseguidos alguna vez (state.itemsSeen). */
    markItem(id) { const s = DK.store.state; if (!s) return; s.itemsSeen = s.itemsSeen || {}; s.itemsSeen[id] = 1; },
    itemKnown(id) {
      const s = DK.store.state;
      if (s.itemsSeen && s.itemsSeen[id]) return true;
      if ((s.bag && s.bag[id]) || (s.expedition && s.expedition.pack && s.expedition.pack[id])) return true;
      if (DK.gear && DK.gear.isGear(id) && DK.gear.ownsBase(id)) return true;
      return Object.values(this.raw()).some((z) => (z.items || []).includes(id));
    },
    /**
     * Todo lo que sabes de una especie juntando todas las zonas:
     * { seen, fought, defeated, captured, moves, drops, zones (donde la has visto), spawn (donde aparece),
     *   owned (tus daskai de esa especie), best (el de más nivel), status: 'unknown'|'seen'|'fought'|'captured' }
     */
    species(sid) {
      const out = { seen: 0, fought: 0, defeated: 0, captured: 0, moves: [], drops: [], zones: [] };
      Object.entries(this.raw()).forEach(([zid, z]) => {
        const e = z.enemies && z.enemies[sid]; if (!e) return;
        out.zones.push(zid);
        ['seen', 'fought', 'defeated', 'captured'].forEach((k) => (out[k] += e[k] || 0));
        (e.moves || []).forEach((m) => { if (!out.moves.includes(m)) out.moves.push(m); });
        (e.drops || []).forEach((m) => { if (!out.drops.includes(m)) out.drops.push(m); });
      });
      out.spawn = Object.values(D.zones).filter((z) => z.enemies.some((e) => e.species === sid)).map((z) => z.id);
      out.owned = DK.party.all().filter((d) => d.species === sid && !d.temp);
      out.best = out.owned.slice().sort((a, b) => b.level - a.level)[0] || null;
      const ever = out.captured > 0 || out.owned.length > 0 || (DK.store.state.graveyard || []).some((g) => g.species === sid);
      out.status = ever ? 'captured' : out.fought > 0 ? 'fought' : out.seen > 0 ? 'seen' : 'unknown';
      return out;
    },
    /** Totales del códice: especies descubiertas, objetos conocidos, jefes vencidos. */
    totals() {
      const sp = Object.keys(D.species), it = Object.keys(D.items).filter((id) => !D.isHidden(id));
      const bosses = Object.keys(D.zones).length + Object.keys(D.secretBosses || {}).length;
      const bossesDone = Object.keys(D.zones).filter((z) => DK.world.boss(z).defeated > 0).length + Object.keys(D.secretBosses || {}).filter((z) => DK.world.secret(z).defeated > 0).length;
      return { species: sp.filter((s) => this.species(s).status !== 'unknown').length, speciesTotal: sp.length,
        items: it.filter((i) => this.itemKnown(i)).length, itemsTotal: it.length, bosses: bossesDone, bossesTotal: bosses };
    },

    /** % de enemigos descubiertos en una zona. */
    completion(zoneId) {
      const z = this.zone(zoneId); if (!z) return 0;
      const list = D.zones[zoneId].enemies;
      return list.filter((e) => z.enemies[e.species]).length / list.length;
    },
  };

  DK.world = {
    /** Progreso de una zona {unlocked, wins}. */
    progress(zoneId) {
      const z = DK.store.state.zones;
      if (!z[zoneId]) z[zoneId] = { unlocked: false, wins: 0 };
      return z[zoneId];
    },
    isUnlocked(zoneId) { return !!(DK.store.state.zones[zoneId] && DK.store.state.zones[zoneId].unlocked); },
    unlockedZones() { return Object.values(D.zones).filter((z) => this.isUnlocked(z.id)); },

    /** Suma una victoria en la zona. */
    addWin(zoneId) { this.progress(zoneId).wins++; return null; },

    /** Desbloquea la zona siguiente (al derrotar al jefe). Devuelve la zona nueva o null. */
    unlockNext(zoneId) {
      const next = Object.values(D.zones).find((z) => z.unlock === zoneId);
      if (next && !this.isUnlocked(next.id)) { this.progress(next.id).unlocked = true; DK.emit('zone:unlocked', { zone: next.id }); return next; }
      return null;
    },

    /** ¿Están desbloqueados los combates libres de la zona? (tras completar su expedición) */
    freeUnlocked(zoneId) { return !DK.config.freeBattleNeedsBoss || this.boss(zoneId).defeated > 0; },
    /** ¿Se ha completado la expedición de la zona alguna vez? */
    completed(zoneId) { return this.boss(zoneId).defeated > 0; },

    /** Jefe oculto de una zona (cuevas): { found, defeated }. defeated > 0 = desbloqueado. */
    secret(zoneId) {
      const s = DK.store.state;
      s.secretBosses = s.secretBosses || {};
      if (!s.secretBosses[zoneId]) s.secretBosses[zoneId] = { found: 0, defeated: 0 };
      return s.secretBosses[zoneId];
    },
    /** Jefes ocultos desbloqueados (vencidos al menos una vez). */
    secretsUnlocked() { return Object.keys(D.secretBosses || {}).filter((z) => this.secret(z).defeated > 0); },

    /** Registro de jefes derrotados {defeated}. */
    boss(zoneId) {
      const b = DK.store.state.bosses;
      if (!b[zoneId]) b[zoneId] = { defeated: 0 };
      return b[zoneId];
    },

    /**
     * Zona recomendada según el nivel medio del equipo activo:
     * la desbloqueada cuyo rango contiene ese nivel (o la más alta por debajo).
     */
    recommended() {
      const avg = DK.party.avgLevel();
      const list = this.unlockedZones().filter((z) => !(DK.averno && DK.averno.isZone(z.id))); // v5.31: el Averno nunca es la recomendada
      const inRange = list.filter((z) => avg >= z.levels[0] && avg <= z.levels[1] + 2);
      if (inRange.length) return inRange[inRange.length - 1];
      const below = list.filter((z) => z.levels[0] <= avg);
      return below[below.length - 1] || list[0];
    },

    /**
     * Avisos antes de entrar en una zona.
     * @returns {Array<{kind:'warn'|'bad'|'good', icon, text, action?}>}
     */
    warnings(zoneId) {
      const t = DK.t, z = D.zones[zoneId], out = [];
      const team = DK.party.active(), alive = DK.party.aliveActive();
      const leader = alive[0];
      const maxLv = team.reduce((m, d) => Math.max(m, d.level), 0);
      if (!alive.length) out.push({ kind: 'bad', icon: 'skull', text: t('warn.allFainted') });
      if (team.length - alive.length > 0 && alive.length) out.push({ kind: 'warn', icon: 'skull', text: t('warn.someFainted', { n: team.length - alive.length }) });
      if (leader && DK.daskai.hpPct(leader) < 0.4) out.push({ kind: 'warn', icon: 'heart', text: t('warn.leaderLow', { name: DK.daskai.name(leader) }), action: 'heal' });
      if (z.levels[0] > maxLv + 3) out.push({ kind: 'bad', icon: 'alert', text: t('warn.overLevel', { n: z.levels[0] - maxLv }) });
      else if (z.levels[1] < DK.party.avgLevel() - 8) out.push({ kind: 'warn', icon: 'info', text: t('warn.underLevel') });
      if (!out.length) out.push({ kind: 'good', icon: 'checkCircle', text: t('warn.allGood') });
      return out;
    },
  };
})();
