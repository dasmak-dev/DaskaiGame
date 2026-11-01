/* =============================================================
 * systems/progress.js — Misiones diarias/semanales, logros y
 * estadísticas del jugador.
 *
 * Funciona escuchando eventos del bus (DK.on). Para que una acción
 * nueva cuente en misiones o logros basta con emitir su evento y
 * añadirla en `EVENT_TO_TYPE`.
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const st = () => DK.store.state;

  /* ======================= MISIONES ======================= */
  DK.missions = {
    /**
     * Devuelve (y genera si cambió el día/semana) las misiones de un periodo.
     * @param {'daily'|'weekly'} period
     */
    list(period) {
      const key = period === 'daily' ? U.today() : U.week();
      const m = st().missions;
      if (!m[period] || m[period].key !== key) m[period] = { key, list: this.generate(period, key) };
      return m[period].list;
    },

    /** Elige plantillas al azar con semilla fija por fecha. */
    generate(period, key) {
      const rnd = U.seeded(period + key + (st().created || ''));
      const pool = D.missions.templates.slice();
      const n = D.missions.config[period];
      const out = [];
      const houses = Object.keys(D.houses);
      while (out.length < n && pool.length) {
        const tpl = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        const idx = period === 'daily' ? 0 : 1;
        const mult = period === 'daily' ? 1 : D.missions.weeklyRewardMult;
        out.push({
          id: tpl.id, type: tpl.type, icon: tpl.icon,
          house: tpl.house ? houses[Math.floor(rnd() * houses.length)] : null,
          target: tpl.target[idx], progress: 0, claimed: false,
          reward: { coins: tpl.reward.coins * mult, item: tpl.reward.item, qty: (tpl.reward.qty || 0) * (period === 'daily' ? 1 : 2) },
        });
      }
      return out;
    },

    /** Avanza las misiones de un tipo. */
    bump(type, amount = 1, ctx = {}) {
      if (!st()) return;
      ['daily', 'weekly'].forEach((p) => this.list(p).forEach((m) => {
        if (m.type !== type || m.claimed || m.progress >= m.target) return;
        if (m.house && ctx.house !== m.house) return;
        m.progress = Math.min(m.target, m.progress + amount);
        if (m.progress >= m.target) DK.emit('mission:ready', { mission: m });
      }));
    },

    /** Cobra la recompensa de una misión completada. */
    claim(m) {
      if (m.claimed || m.progress < m.target) return false;
      m.claimed = true;
      DK.wallet.add(m.reward.coins);
      if (m.reward.item && m.reward.qty) DK.bag.add(m.reward.item, m.reward.qty);
      DK.store.save();
      return true;
    },

    /** Misiones listas para cobrar. */
    claimable() { return ['daily', 'weekly'].reduce((n, p) => n + this.list(p).filter((m) => !m.claimed && m.progress >= m.target).length, 0); },
  };

  /* ======================= LOGROS ======================= */
  DK.achievements = {
    /** [{def, value, unlocked, at}] */
    list() {
      return D.achievements.map((a) => ({ def: a, value: Math.min(a.target, a.value(st())), unlocked: !!st().achievements[a.id], at: st().achievements[a.id] }));
    },
    /** Revisa todos los logros y desbloquea los nuevos (con aviso). */
    check() {
      if (!st()) return [];
      const fresh = [];
      D.achievements.forEach((a) => {
        if (st().achievements[a.id]) return;
        if (a.value(st()) >= a.target) {
          st().achievements[a.id] = Date.now();
          DK.wallet.add(a.reward, { silent: true });
          fresh.push(a);
        }
      });
      fresh.forEach((a) => {
        DK.audio.sfx('achievement');
        DK.ui.toast(DK.t(a.hidden ? 'achievements.unlockedHidden' : 'achievements.unlocked', { name: DK.achievements.name(a), coins: a.reward }), { icon: a.icon, kind: 'good' });
      });
      if (fresh.length) DK.store.save();
      return fresh;
    },
    unlockedCount() { return D.achievements.filter((a) => st().achievements[a.id]).length; },
    /** Nombre y descripción (con las variables de los logros que comparten texto). */
    name(a) { return DK.t(`achievements.${a.text || a.id}.name`, Object.assign({ n: a.target }, a.vars ? a.vars(st()) : {})); },
    desc(a) { return DK.t(`achievements.${a.text || a.id}.desc`, Object.assign({ n: a.target }, a.vars ? a.vars(st()) : {})); },
  };

  /* ======================= DESBLOQUEOS ======================= *
   * Partes del juego que se abren al avanzar. `DK.unlocks.has(id)` dice si
   * ya está abierta; al abrirse por primera vez avisa (state.unlocks[id]).
   *   training: el campo de entrenamiento, tras derrotar al primer jefe.
   */
  const UNLOCKS = {
    training: { icon: 'dumbbell', screen: 'training', when: (s) => Object.values(s.bosses || {}).some((b) => b.defeated > 0) || (s.training && s.training.slots && s.training.slots.length > 0) },
  };
  DK.unlocks = {
    defs: UNLOCKS,
    has(id) { const s = st(); return !!s && !!UNLOCKS[id] && !!UNLOCKS[id].when(s); },
    /** Avisa de lo que se acaba de abrir. `silent` marca sin avisar (partidas cargadas). */
    check(silent = false) {
      const s = st(); if (!s) return;
      s.unlocks = s.unlocks || {};
      Object.entries(UNLOCKS).forEach(([id, u]) => {
        if (s.unlocks[id] || !u.when(s)) return;
        s.unlocks[id] = Date.now();
        if (!silent) {
          DK.audio.sfx('achievement');
          DK.ui.toast(DK.t('unlock.' + id), { icon: u.icon, kind: 'good' });
        }
        DK.emit('unlocked', { id });
        if (DK.app && DK.app.renderNav) DK.app.renderNav();
      });
    },
  };
  ['battle:end', 'expedition:complete'].forEach((ev) => DK.on(ev, () => setTimeout(() => DK.unlocks.check(), 80)));
  DK.on('game:loaded', () => DK.unlocks.check(true));

  /* ============ Conexión de eventos → estadísticas/misiones ============ */
  DK.on('enemy:defeated', (e) => {
    DK.missions.bump('defeat', 1, { house: e.house });
    if (e.boss) DK.missions.bump('boss', 1);
  });
  DK.on('battle:won', () => DK.missions.bump('win'));
  DK.on('captured', () => DK.missions.bump('capture'));
  DK.on('crafted', (e) => DK.missions.bump('craft', e.times || 1));
  DK.on('item:used', () => DK.missions.bump('useItem'));
  DK.on('damage', (e) => {
    if (!st()) return;
    if (e.side === 'enemy') { st().stats.damageDealt += e.amount; DK.missions.bump('damage', e.amount); if (e.crit) st().stats.crits++; }
    else st().stats.damageTaken += e.amount;
  });
  DK.on('levelUp', () => DK.missions.bump('levelUp'));

  /* ---------- Estadísticas del perfil ---------- */
  DK.on('damage', (e) => { if (st() && e.side === 'enemy' && e.amount > st().stats.biggestHit) st().stats.biggestHit = e.amount; });
  DK.on('enemy:defeated', (e) => { if (!st()) return; const dh = st().stats.defeatedHouses; dh[e.house] = (dh[e.house] || 0) + 1; });
  DK.on('battle:end', (e) => {
    const s = st() && st().stats; if (!s) return;
    // Racha: victorias y vínculos la suman; una derrota la corta (huir no cuenta)
    if (e.outcome === 'won' || e.outcome === 'captured') { s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); }
    else if (e.outcome === 'lost') s.streak = 0;
    // Historial de los últimos combates (máx. DK.config.historySize)
    s.history.unshift({ t: Date.now(), outcome: e.outcome, zone: e.zone, turns: e.turns, boss: !!e.boss, elite: !!e.elite, enemy: e.enemy, ally: e.ally });
    s.history.length = Math.min(s.history.length, DK.config.historySize || 30);
  });
  DK.on('expedition:complete', () => DK.missions.bump('expedition'));

  // Revisa logros tras cualquier evento importante
  ['battle:end', 'captured', 'crafted', 'evolved', 'coins', 'expedition:complete', 'bought', 'game:loaded'].forEach((ev) =>
    DK.on(ev, () => setTimeout(() => DK.achievements.check(), 50)));

  // Aviso cuando una misión queda lista
  DK.on('mission:ready', ({ mission }) => DK.ui.toast(DK.t('missions.ready', { name: DK.missionText(mission) }), { icon: 'scroll', kind: 'good' }));

  /** Texto de una misión ("Derrota 5 daskai de Fuego"). */
  DK.missionText = (m) => DK.t(`missions.${m.id}`, { n: m.target, house: m.house ? DK.tr('houses', D.houses[m.house]) : '' });
})();
