/* =============================================================
 * systems/battle.js — Motor de combate (sin interfaz).
 *
 * La pantalla de combate llama a:
 *   const st = DK.battle.start(zona, uidLider, {boss})
 *   const eventos = DK.battle.turn(st, {type:'move', moveId})
 *                                     {type:'item', itemId}
 *                                     {type:'switch', uid}
 *                                     {type:'flee'}
 *                                     {type:'guard'}   (defenderse)
 * y reproduce los eventos devueltos con animaciones y texto.
 *
 * INTENCIÓN: el rival decide su acción ANTES de tu turno (st.intent) y la
 * pantalla la enseña (DK.battle.intentInfo), así puedes reaccionar:
 * atacar, defenderte o cambiar a un daskai que la resista.
 *
 * FASES DE JEFE (data/bossPhases.js): al bajar de cierto % de vida el
 * jefe entra en una fase (furia, regeneración, escudo, frenesí).
 *
 * Evento: { text?, kind?, cat?, anim?, side?, amount?, crit?, eff?, house?, snap }
 *   cat:  'dmg' | 'item' | 'sys' | 'reward'  (filtros del registro)
 *   snap: vida/maná de ambos tras el evento (para actualizar barras)
 * ============================================================= */
(function () {
  const U = DK.util, D = DK.data, C = () => DK.config;
  const { t } = DK;
  const other = (s) => (s === 'ally' ? 'enemy' : 'ally');
  const zeroStages = () => ({ atk: 0, matk: 0, def: 0, mdef: 0, spd: 0 });
  const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const statusName = (id) => DK.tr('statuses', D.statuses[id]).toLowerCase();

  const B = {
    /**
     * Prepara un combate.
     * @param {string} zoneId
     * @param {string} leaderUid  daskai del jugador que empieza
     * @param {Object} [o]        {boss: true} jefe · {secret: true} el jefe oculto de la zona (cuevas)
     *                            · {final: true} es el jefe del final del mapa · {elite: true} rival de élite
     */
    start(zoneId, leaderUid, o = {}) {
      if (o.duel) return this.startDuel(zoneId, leaderUid, o.duel); // v5.45: duelo contra el equipo de otro jugador
      const zone = D.zones[zoneId];
      // En expediciones profundas los rivales tienen más nivel (DK.expedition.levelBonus)
      const plus = DK.expedition.active() ? DK.expedition.levelBonus() : 0;
      // v5.31: en el Averno el nivel no sale de la zona: sube con los pisos y los jefes (DK.averno.level), hasta 120
      const av = DK.averno && DK.averno.on();
      const wk = !av && DK.expedition.active() && DK.expedition.active().weekly ? DK.expedition.active().weeklyLv || DK.weekly.teamLevel() : 0; // v5.40: desafío semanal: según tu equipo
      const lv = (n, kind = 'wild') => (av ? DK.averno.level(kind) - (kind === 'wild' ? U.rand(0, 2) : 0) : wk ? Math.min(DK.config.maxLevel, DK.weekly.levelFor(n, zoneId, wk) + plus) : Math.min(DK.config.maxLevel, n + plus));
      let enemy;
      // Datos del jefe: el de la zona o, en las cuevas, el oculto (D.secretBosses)
      const secret = o.secret && D.secretBosses ? D.secretBosses[zoneId] : null;
      let bossInfo = secret || (o.boss ? (av ? DK.averno.bossInfo() : zone.boss) : null);
      // v5.18: muy de vez en cuando, en lugar del jefe de la zona aparece un legendario (systems/legends.js)
      const legend = bossInfo && !secret && !av && DK.legends ? DK.legends.roll(zoneId, o) : null;
      if (legend) bossInfo = Object.assign({}, zone.boss, { species: legend.species, level: zone.boss.level + DK.config.legends.levelBonus, title: t('legend.title', { name: D.species[legend.species].name }),
        coins: Math.round(zone.boss.coins * DK.config.legends.coinMult), drops: zone.boss.drops.concat([['tonico_vida', 0.5], ['restaurador', 0.5], ['elixir', 0.25]]).filter(([id]) => D.items[id]) });
      if (o.boss && bossInfo) {
        // v5.1: en el Abismo todos los jefes de la serie van al nivel de la zona elegida (y suben jefe a jefe)
        const ex = DK.expedition.active(), abyssLv = !secret && o.abyssRound != null && ex && ex.kind === 'abismo' ? DK.abyss.bossLevel(ex.startZone || ex.zone, o.abyssRound) : 0;
        enemy = DK.daskai.create(bossInfo.species, lv(Math.max(bossInfo.level, abyssLv), 'boss'), { boss: true, shiny: false, dual: U.chance(secret ? C().dual.secret : C().dual.boss) });
        if (legend) { enemy.legendary = true; DK.daskai.touch(); DK.daskai.fullHeal(enemy); }
      } else if (o.elite) {
        const pick = U.weighted(zone.enemies);
        enemy = DK.daskai.create(pick.species, lv(zone.levels[1] + C().eliteLevelBonus, 'elite'), { wild: true, elite: true, dual: U.chance(C().dual.elite) });
      } else enemy = wildOne();
      function wildOne() {
        const pick = U.weighted(zone.enemies);
        // Variocolor: la probabilidad base + el rastreo de esa especie (DK.tracking) y la corrupción
        const w = DK.daskai.create(pick.species, lv(U.rand(zone.levels[0], zone.levels[1])), { wild: true, dual: U.chance(C().dual.wild), shiny: U.chance(DK.config.shinyChance + (DK.expedition.active() ? DK.expedition.kindDef().wildShiny || 0 : 0) + (DK.endgame ? DK.endgame.shiny(pick.species) : 0)) });
        DK.daskai.fullHeal(w);
        if (av) DK.averno.adapt(w, 'wild');
        return w;
      }
      DK.daskai.fullHeal(enemy);
      if (av && (o.boss || o.elite)) DK.averno.adapt(enemy, o.boss ? 'boss' : 'elite'); // v5.31: se adaptan a tu equipo
      const known = DK.codex.fought(zoneId, enemy.species) > 0; // ¿hemos peleado antes contra él?
      DK.codex.seeEnemy(zoneId, enemy.species);
      DK.looks.see(enemy);
      const stt = DK.store.state.stats;
      stt.usage[leaderUid] = (stt.usage[leaderUid] || 0) + 1;
      DK.store.save();
      DK.emit('battle:start', { zone: zoneId, boss: !!o.boss, elite: !!o.elite });
      const st = {
        zoneId, enemy, allyUid: leaderUid, known, boss: !!o.boss, elite: !!o.elite && !o.boss, expedition: !!DK.expedition.active(),
        secret: !!secret, final: o.final != null ? !!o.final : !!o.boss && !secret,
        bossInfo: bossInfo ? { title: bossInfo.title, coins: bossInfo.coins, drops: bossInfo.drops } : null, legend: legend ? legend.species : null,
        stages: { ally: zeroStages(), enemy: zeroStages() }, turn: 0, outcome: null, needSwitch: false, finished: false, lastMove: null,
        phases: o.boss ? (secret ? secret.phases.map((p) => Object.assign({}, p)) : this.bossPhases(av ? DK.averno.bossZone() : zoneId)) : [], phase: 0, shield: 0, frenzy: false, bossRegen: 0, guarding: false,
        breakMax: o.boss ? C().breakGauge.boss : o.elite ? C().breakGauge.elite : 0, breakVal: 0, broken: 0, brokeAt: 0, breaks: 0,
      };
      // v5.5: combates especiales. 'chain' = oleada (al caer uno entra el siguiente) · 'swap' = relevo
      // (a media vida el rival se retira y entra otro con la vida llena; a media vida de éste vuelve el primero)
      if (o.wave && !o.boss && !o.elite) {
        const SP = DK.config.expedition.specials || {};
        const n = o.wave === 'chain' ? Math.max(2, SP.chainSize || 3) : 2;
        const others = Array.from({ length: n - 1 }, () => wildOne());
        others.forEach((x) => { DK.codex.seeEnemy(zoneId, x.species); DK.looks.see(x); });
        st.wave = { kind: o.wave, total: n, queue: others, beaten: 0, all: [enemy].concat(others), swapped: {}, mult: (SP.rewardMult || {})[o.wave] || 1.5 };
      }
      // Pacto «Frenesí»: el rival empieza más rápido
      if (st.expedition && DK.curses.effect('enemySpd')) st.stages.enemy.spd = Math.min(3, DK.curses.effect('enemySpd'));
      // Pasivas «al entrar» (mirada fiera, arranque…): efectos temporales de los dos
      st.timed = { ally: [], enemy: [] }; st.entryLog = [];
      this.applyEntry(st, 'ally', null); this.applyEntry(st, 'enemy', null);
      // v5.46: Cuerno de guerra: empiezas con más ataque y ataque mágico
      const horn = this.relic(st, 'startStage');
      if (horn) { const n = horn.effect.n || 1; st.stages.ally.atk = Math.min(3, st.stages.ally.atk + n); st.stages.ally.matk = Math.min(3, st.stages.ally.matk + n); st.entryLog.push({ text: t('relics.proc.startStage', { relic: horn.name, name: DK.daskai.name(this.ally(st)) }), kind: 'good' }); }
      st.intent = this.enemyChoice(st);
      return st;
    },

    /**
     * v5.45: duelo. El rival es una copia del equipo público de otro jugador (DK.duels.ghost): entran uno tras otro
     * (como una oleada). No hay botín, ni vínculo, ni objetos; tu equipo vuelve como estaba al terminar.
     * @param {Object} duel { token, tid, name, team: [snapD…] }
     */
    startDuel(zoneId, leaderUid, duel) {
      const foes = (duel.team || []).map((x) => DK.duels.ghost(x)).filter(Boolean);
      if (!foes.length) foes.push(DK.daskai.create(Object.keys(D.species)[0], 5, { wild: true }));
      const saved = DK.party.active().map((d) => ({ uid: d.uid, hp: d.cur.hp, mp: d.cur.mp, status: d.status || null }));
      // todos empiezan con la vida llena (el duelo no depende de cómo vengas de la expedición)
      DK.party.active().forEach((d) => DK.daskai.fullHeal(d));
      DK.emit('battle:start', { zone: zoneId, duel: true });
      const st = {
        zoneId, enemy: foes[0], allyUid: leaderUid, known: true, boss: false, elite: false, expedition: false, secret: false, final: false,
        duel: { token: duel.token, tid: duel.tid, name: duel.name, rating: duel.rating, saved }, bossInfo: null, legend: null,
        stages: { ally: zeroStages(), enemy: zeroStages() }, turn: 0, outcome: null, needSwitch: false, finished: false, lastMove: null,
        phases: [], phase: 0, shield: 0, frenzy: false, bossRegen: 0, guarding: false, breakMax: 0, breakVal: 0, broken: 0, brokeAt: 0, breaks: 0,
        wave: { kind: 'chain', total: foes.length, queue: foes.slice(1), beaten: 0, all: foes, swapped: {}, mult: 1 },
      };
      st.timed = { ally: [], enemy: [] }; st.entryLog = [];
      this.applyEntry(st, 'ally', null); this.applyEntry(st, 'enemy', null);
      st.intent = this.enemyChoice(st);
      return st;
    },

    /* ---------------- v5.46: reliquias con mecánica propia ---------------- */
    /** La reliquia de ese tipo (sólo en expedición y para tu equipo) o null. */
    relic(st, type) { return st.expedition && DK.relics ? DK.relics.get(type) : null; },
    /** Texto corto cuando una reliquia hace algo (registro del combate). */
    relicLog(st, ev, key, r, o = {}, kind = 'good') { this.push(st, ev, { text: t('relics.proc.' + key, Object.assign({ relic: r.name }, o)), kind, cat: 'dmg' }); },

    /* ---------------- Fases de jefe ---------------- */
    /** Fases del jefe de una zona (más una de furia con el pacto «Jefe furioso»). */
    bossPhases(zoneId) {
      const list = (D.bossPhases[zoneId] || [{ at: 0.5, type: 'enrage' }]).map((p) => Object.assign({}, p));
      if (DK.expedition.active() && DK.curses.effect('bossPhase')) list.push({ at: 0.2, type: 'enrage' });
      return list.sort((a, b) => b.at - a.at);
    },
    /** Siguiente fase pendiente (o null). */
    nextPhase(st) { return st.phases && st.phases[st.phase] || null; },
    /** Entra en las fases cuyo umbral se ha cruzado. */
    checkPhase(st, ev) {
      const e = st.enemy;
      if (!st.boss || e.cur.hp <= 0) return;
      let p;
      while ((p = this.nextPhase(st)) && e.cur.hp / DK.daskai.stats(e).hp <= p.at) { st.phase++; this.enterPhase(st, p.type, ev); }
    },
    enterPhase(st, type, ev) {
      const e = st.enemy, s = DK.daskai.stats(e), stg = st.stages.enemy;
      const name = cap(this.name(st, 'enemy'));
      if (type === 'enrage') { stg.atk = Math.min(3, stg.atk + 2); stg.matk = Math.min(3, stg.matk + 2); stg.spd = Math.min(3, stg.spd + 1); }
      if (type === 'regen') { const heal = Math.round(s.hp * 0.25); e.cur.hp = Math.min(s.hp, e.cur.hp + heal); e.status = null; st.bossRegen = 4; }
      if (type === 'shield') st.shield = 3;
      if (type === 'frenzy') st.frenzy = true;
      this.push(st, ev, { text: t('phase.' + type, { name }), kind: 'warn', anim: type === 'regen' ? 'heal' : 'buff', side: 'enemy', amount: type === 'regen' ? Math.round(s.hp * 0.25) : undefined, phase: type, cat: 'dmg' });
    },

    /** Daño previsto de la intención del rival contra otro daskai tuyo si entrase ahora (con el colchón del cambio). */
    intentVs(st, d) {
      const m = st.intent && D.moves[st.intent];
      if (!m || !m.power || st.broken) return null;
      const prev = st.switchCushion; st.switchCushion = true;
      const max = this.damage(st, 'enemy', m, { random: false, ignoreHouse: !st.known, target: d }).dmg;
      st.switchCushion = prev;
      return [Math.max(1, Math.round(max * 0.88)), max];
    },

    /* ---------------- Intención del rival ---------------- */
    /**
     * Qué va a hacer el rival este turno y cuánto haría al aliado actual.
     * @returns {{move, type:'attack'|'heavy'|'heal'|'buff'|'debuff'|'status', dmg:[min,max]|null, twice:boolean}}
     */
    intentInfo(st) {
      if (st.broken) return { move: null, type: 'stunned', dmg: null, twice: false, acc: 100, priority: 0 };
      const id = st.intent; if (!id || !D.moves[id]) return null;
      const m = D.moves[id], a = this.ally(st);
      let type = 'attack', dmg = null;
      if (m.power > 0) {
        const max = this.damage(st, 'enemy', m, { random: false, ignoreHouse: !st.known }).dmg;
        dmg = [Math.max(1, Math.round(max * 0.88)), max];
        if (max >= DK.daskai.stats(a).hp * 0.3) type = 'heavy';
      } else if (m.effect) type = m.effect.type === 'heal' ? 'heal' : m.effect.type === 'buff' ? 'buff' : m.effect.type === 'debuff' ? 'debuff' : 'status';
      return { move: id, type, dmg, twice: !!st.frenzy && (st.turn + 1) % 2 === 0, acc: m.acc, priority: this.priority(id) };
    },

    /** Daskai aliado en combate (si ha muerto al terminar, se usa la copia guardada para pintar el final). */
    ally(st) { return DK.party.get(st.allyUid) || st.allyCache; },
    get(st, side) { return side === 'ally' ? this.ally(st) : st.enemy; },
    /** Nombre para el registro ("Gotín salvaje", "Jefe: Rey de la Marea"...) */
    name(st, side) {
      const d = this.get(st, side), n = DK.daskai.name(d);
      if (side === 'ally') return n;
      if (st.boss) return t('battle.bossName', { name: n });
      if (st.elite) return t('battle.eliteName', { name: n });
      return t('battle.wildName', { name: n });
    },

    /** Multiplicador de una mejora/reducción de atributo (-3..+3). */
    stageMult(stage) { const s = C().stageStep; return stage >= 0 ? 1 + s * stage : 1 / (1 + s * -stage); },
    /** Atributo en combate (con mejoras/reducciones y efectos temporales de pasivas). */
    stat(st, side, k) {
      const dd = this.get(st, side), sm = k === 'spd' && dd.status && D.statuses[dd.status] && D.statuses[dd.status].spdMult ? D.statuses[dd.status].spdMult : 1; // v5.4: parálisis
      const base = DK.daskai.stats(dd)[k] * this.timedMult(st, side, k) * sm;
      return st.stages[side][k] != null ? base * this.stageMult(st.stages[side][k]) : base;
    },

    /* ---------------- Pasivas «al entrar» (v4.40) ---------------- */
    /** Multiplicador de los efectos temporales activos en un lado para un atributo. */
    timedMult(st, side, k) { return Math.max(0.1, ((st.timed && st.timed[side]) || []).reduce((m, x) => (x.stat === k ? m * (1 + x.pct) : m), 1)); }, // v4.66: nunca 0 ni negativo
    /** Efectos temporales activos de un lado: [{stat, pct, left, src}] */
    timedOf(st, side) { return (st.timed && st.timed[side]) || []; },
    /**
     * Aplica la pasiva «al entrar» del daskai que está en `side` (al empezar o al cambiar).
     * @param ev  lista de eventos (o null al empezar: el texto va a st.entryLog)
     */
    applyEntry(st, side, ev) {
      const d = this.get(st, side), P = d && D.passives[d.passive], E = P && P.entry;
      if (!E) return;
      st.timed = st.timed || { ally: [], enemy: [] };
      const tgt = E.target === 'self' ? side : other(side);
      E.stats.forEach((k) => {
        st.timed[tgt] = st.timed[tgt].filter((x) => !(x.stat === k && x.src === d.passive)); // no se acumula consigo misma
        st.timed[tgt].push({ stat: k, pct: E.pct, left: E.turns, src: d.passive, owner: d.uid || side });
      });
      const stats = E.stats.map((k) => DK.tr('stats', D.stats[k]).toLowerCase()).join(' / ');
      const text = t(E.pct > 0 ? 'battle.entryBuff' : 'battle.entryDebuff', { name: this.name(st, side), passive: DK.tr('passives', P), stat: stats, target: this.name(st, tgt), n: Math.round(Math.abs(E.pct) * 100), turns: E.turns });
      if (ev) this.push(st, ev, { text, kind: E.pct > 0 === (side === 'ally') ? 'good' : 'warn', anim: E.pct > 0 ? 'buff' : 'debuff', side: tgt, cat: 'dmg' });
      else (st.entryLog = st.entryLog || []).push({ text, kind: E.pct > 0 === (side === 'ally') ? 'good' : 'warn' });
    },
    /** Al empezar cada turno: cuenta atrás de los efectos temporales. */
    tickTimed(st, ev) {
      if (!st.timed) return;
      ['ally', 'enemy'].forEach((side) => {
        const keep = [];
        st.timed[side].forEach((x) => {
          if (x.ticked) x.left--;
          x.ticked = true;
          if (x.left > 0) keep.push(x);
          else this.push(st, ev, { text: t('battle.entryEnd', { passive: DK.tr('passives', D.passives[x.src]), name: this.name(st, side) }), kind: 'muted', cat: 'dmg' });
        });
        st.timed[side] = keep;
      });
    },

    /** Multiplicador por casas: atacante fuerte x1.5, defensor fuerte -25%. */
    houseMult(attHouse, defHouse) {
      // v4.71: el defensor puede tener dos casas (lista): se multiplican las dos. Si una te favorece y
      // la otra te resiste, se compensan (×1,5 × 0,75 ≈ ×1,13 → «fuerte» por poco).
      if (Array.isArray(defHouse)) {
        const parts = defHouse.map((hh) => this.houseMult(attHouse, hh));
        const mult = parts.reduce((m, x) => m * x.mult, 1);
        return { mult, eff: mult > 1.001 ? 'strong' : mult < 0.999 ? 'weak' : null };
      }
      const H = D.houses;
      if (H[attHouse] && H[attHouse].strongVs === defHouse) return { mult: C().house.strongDamage, eff: 'strong' };
      if (H[defHouse] && H[defHouse].strongVs === attHouse) return { mult: 1 - C().house.weakDefense, eff: 'weak' };
      return { mult: 1, eff: null };
    },
    /** v4.71: casas de un daskai en combate (1 o 2). */
    housesOf(d) { return DK.daskai.houses(d); },
    /** v4.71: lo mejor que puede hacer A (con cualquiera de sus casas) contra todas las casas de B. */
    bestHouseMult(A, Bd) { return DK.daskai.houses(A).map((hh) => this.houseMult(hh, DK.daskai.houses(Bd))).sort((x, y) => y.mult - x.mult)[0]; },

    /**
     * Casa de un ataque: la suya si la tiene; los ataques sin casa (Placaje…)
     * usan la del daskai que los lanza.
     */
    moveHouse(d, move) { return (move && move.house) || D.species[d.species].house; },
    /** ¿Misma casa que el daskai? (+stab de daño; sólo ataques con casa propia) */
    isStab(d, move) { return !!(move && move.house && DK.daskai.houses(d).includes(move.house)); }, // v4.71: cualquiera de sus casas

    /** Eficacia de un ataque del aliado contra el enemigo (null si aún no se conoce su casa). */
    effOf(st, moveId) {
      if (!st.known) return null;
      const a = this.ally(st), m = moveId ? D.moves[moveId] : null;
      return this.houseMult(this.moveHouse(a, m), DK.daskai.houses(st.enemy)).eff;
    },

    /** Fórmula de daño (también se usa fuera de combate para estimaciones). */
    rawDamage({ power, kind, attLevel, atk, def, mult = 1, roll = 1, crit = false, burned = false }) {
      if (!power) return 0;
      let a = atk;
      if (kind === 'fisico' && burned) a *= D.statuses.quemadura.atkMult;
      // v4.66: sin NaN si ataque y defensa llegan a 0 (o vienen mal): se cuenta como 1
      a = Math.max(1, +a || 0); def = Math.max(0, +def || 0);
      const dmg = power * (a / (a + def)) * (1 + attLevel / 100) * 1.15 * mult * roll * (crit ? C().critMult : 1);
      return Number.isFinite(dmg) ? Math.max(1, Math.round(dmg)) : 1;
    },

    /** Calcula el daño de un ataque de `side` contra el otro. */
    /**
     * Todos los factores de un golpe (también para el desglose que ve el jugador).
     * @param {Object} o  ignoreHouse (casa aún desconocida) · target (daskai que recibe, por defecto el rival)
     *                    hideWeak (no aplicar el punto débil si el jugador no lo conoce)
     * @returns {{power, atk, def, level, house, eff, bonus, weak, guard, switchIn, shield, mult, critP, parts:[{k, v}]}}
     */
    factors(st, side, move, { ignoreHouse = false, target, hideWeak = false } = {}) {
      const A = this.get(st, side), T = target || this.get(st, other(side));
      const phys = move.kind === 'fisico';
      // Casas: la del ATAQUE contra la del que recibe, y bonus si es de la misma casa que quien lo lanza
      const atkHouse = this.moveHouse(A, move);
      const h = ignoreHouse ? { mult: 1, eff: null } : this.houseMult(atkHouse, DK.daskai.houses(T));
      const stab = this.isStab(A, move) ? C().stab : 1;
      const broken = side === 'ally' && st.broken && T === st.enemy ? C().breakGauge.dmg : 1; // rival roto
      // Reliquias y Mejoras de expedición: más daño para ti, menos daño recibido
      let bonus = 1, critP = C().critChance;
      if (st.expedition) {
        if (side === 'ally') {
          const hpA = A.cur ? A.cur.hp / Math.max(1, DK.daskai.stats(A).hp) : 1;
          // v5.46: Daga del alba (primer golpe), Corazón de la ira (poca vida), Sello del matarreyes (jefes y mini jefes)
          const extra = (!(st.opened && st.opened.ally) ? DK.relics.sum('firstStrike') : 0) + (hpA < 0.4 ? DK.relics.sum('lowHpDmg') : 0) + ((st.boss || st.elite) && T === st.enemy ? DK.relics.sum('bossDmg') : 0);
          bonus *= 1 + DK.relics.sum('dmg') + DK.daskai.houses(A).reduce((a, hh) => a + DK.relics.houseDmg(hh), 0) + DK.camp.value('fuerza') + extra; critP += DK.relics.sum('crit') + DK.camp.value('punteria');
        }
        else bonus *= Math.max(0.3, 1 - DK.relics.sum('defense') - DK.camp.value('coraza'));
      }
      // v4.74: equipamiento: +% daño (prefijos, legendarias) y -% daño recibido (sufijos)
      const gA = DK.gear.fxOf(A), gT = DK.gear.fxOf(T);
      // v4.81: afijos condicionales (físico/mágico, vida llena o baja, rival tocado o con estado, eficaz, jefe, primer golpe, su casa)
      const hpOf = (d) => (d && d.cur ? d.cur.hp / Math.max(1, DK.daskai.stats(d).hp) : 1);
      const isBoss = (st.boss || st.elite) && T === st.enemy;
      const dmgUp = (gA.dmg || 0) + ((phys ? gA.physDmg : gA.magDmg) || 0) + (hpOf(A) >= 1 ? gA.fullDmg || 0 : 0) + (hpOf(A) < 0.5 ? gA.rageDmg || 0 : 0)
        + (hpOf(T) < 0.35 ? gA.execute || 0 : 0) + (T.status ? gA.statusDmg || 0 : 0) + (isBoss ? gA.bossDmg || 0 : 0)
        + (!(st.opened && st.opened[side]) ? gA.opener || 0 : 0) + (this.isStab(A, move) ? gA.stabDmg || 0 : 0) + (h.eff === 'strong' ? gA.strongDmg || 0 : 0)
        // v4.82: más rápido que el rival, rival de más nivel, rival con la vida llena
        + (gA.fastDmg && T.cur && this.stat(st, side, 'spd') > (T === this.get(st, other(side)) ? this.stat(st, other(side), 'spd') : DK.daskai.stats(T).spd) ? gA.fastDmg : 0)
        + ((T.level || 0) > (A.level || 0) ? gA.underdog || 0 : 0) + (hpOf(T) >= 1 ? gA.freshDmg || 0 : 0);
      // v4.89: + resistencia a la casa del ataque (anillos, armaduras, dagas…)
      const dmgDown = Math.min(0.8, (gT.guard || 0) + ((phys ? gT.guardPhys : gT.guardMag) || 0) + (hpOf(T) < 0.5 ? gT.lastGuard || 0 : 0) + (atkHouse ? gT['res_' + atkHouse] || 0 : 0));
      const gear = (1 + dmgUp) * (1 - dmgDown);
      critP = Math.max(0, critP + (gA.crit || 0) - (gT.critRes || 0)); // v4.82: resistencia a críticos
      // Punto débil de la especie (ver weakness): más daño de ese tipo de ataque
      const wk = this.weakness(T.species) === move.kind && !(hideWeak && !this.weakKnown(T.species)) ? C().weakMult : 1;
      const guard = side === 'enemy' && st.guarding ? C().guardMult : 1;            // te estás defendiendo
      const switchIn = side === 'enemy' && st.switchCushion ? C().switchMult : 1;  // acaba de entrar al cambiar
      const shield = side === 'ally' && st.shield > 0 && h.eff !== 'strong' ? 0.35 : 1; // escudo del jefe
      const weather = st.expedition && move.house ? 1 + DK.expedition.modHouse(move.house) : 1; // modificador del mapa (tormenta, calor…)
      const atk = this.stat(st, side, phys ? 'atk' : 'matk');
      const tSide = T === this.get(st, other(side)) ? other(side) : null;
      const def = (tSide ? this.stat(st, tSide, phys ? 'def' : 'mdef') : DK.daskai.stats(T)[phys ? 'def' : 'mdef']) * (1 - (gA.pierce || 0)); // v4.81: perforar
      const weakUp = wk !== 1 ? 1 + (gA.weakDmg || 0) : 1; // v4.82: más daño al punto débil
      const mult = h.mult * stab * bonus * wk * weakUp * guard * switchIn * shield * weather * broken * gear;
      const parts = [
        { k: 'power', v: move.power }, { k: 'atkdef', v: `${Math.round(atk)} / ${Math.round(def)}` }, { k: 'level', v: 1 + A.level / 100 },
        stab !== 1 ? { k: 'stab', v: stab } : null, h.mult !== 1 ? { k: 'house', v: h.mult } : null, broken !== 1 ? { k: 'broken', v: broken } : null, bonus !== 1 ? { k: 'bonus', v: bonus } : null, gear !== 1 ? { k: 'gear', v: gear } : null, wk !== 1 ? { k: 'weak', v: wk } : null,
        guard !== 1 ? { k: 'guard', v: guard } : null, switchIn !== 1 ? { k: 'switchIn', v: switchIn } : null, shield !== 1 ? { k: 'shield', v: shield } : null, weather !== 1 ? { k: 'weather', v: weather } : null,
        A.status === 'quemadura' && phys ? { k: 'burn', v: D.statuses.quemadura.atkMult } : null,
      ].filter(Boolean);
      return { power: move.power, atk, def, level: A.level, eff: h.eff, house: atkHouse, stab: stab !== 1, mult, critP, critDmg: gA.critDmg || 0, critGuard: gT.critGuard || 0, parts, weak: wk !== 1, burned: A.status === 'quemadura' };
    },

    /** Calcula el daño de un ataque de `side` contra el otro (o contra `o.target`). */
    damage(st, side, move, { random = true, ignoreHouse = false, target, hideWeak = false, forceCrit = false } = {}) {
      const A = this.get(st, side);
      const f = this.factors(st, side, move, { ignoreHouse, target, hideWeak });
      const crit = forceCrit || (random && U.chance(f.critP));
      const dmg = this.rawDamage({
        power: move.power, kind: move.kind, attLevel: A.level, atk: f.atk, def: f.def,
        mult: f.mult * (crit ? (1 + (f.critDmg || 0)) * (1 - (f.critGuard || 0)) : 1), roll: random ? U.randf(0.88, 1) : 1, crit, burned: f.burned,
      });
      return { dmg, crit, eff: f.eff, weak: f.weak, stab: f.stab };
    },

    /* ---------------- Ruptura (jefes y élites) ---------------- */
    /** Cuánto llenaría la barra de ruptura un golpe (sin contar críticos si `r` no se da). */
    breakGain(st, move, r) {
      if (!st.breakMax || st.broken || !move || !move.power) return 0;
      const G = C().breakGauge;
      const eff = r ? r.eff : this.effOf(st, move.id);
      if (eff === 'weak') return 0;
      const weak = r ? r.weak : this.weakKnown(st.enemy.species) && this.weakness(st.enemy.species) === move.kind;
      const pow = 1 + (DK.gear.fxOf(this.get(st, 'ally')).breakPow || 0); // v4.81: martillos
      return Math.round((G.hit + (eff === 'strong' ? G.strong : 0) + (weak ? G.weak : 0) + (r && r.crit ? G.crit : 0)) * pow);
    },
    /** Suma a la barra y rompe al rival si se llena. */
    addBreak(st, n, ev) {
      if (!n || !st.breakMax || st.broken || st.enemy.cur.hp <= 0) return;
      st.breakVal = Math.min(st.breakMax, st.breakVal + n);
      if (st.breakVal < st.breakMax) return;
      st.broken = 1; st.brokeAt = st.turn; st.breakVal = 0; st.breaks++;
      DK.store.state.stats.breaks = (DK.store.state.stats.breaks || 0) + 1;
      st.breakMax = Math.round(st.breakMax * C().breakGauge.grow);
      this.push(st, ev, { text: t('battle.broken', { name: cap(this.name(st, 'enemy')), n: Math.round((C().breakGauge.dmg - 1) * 100) }), kind: 'level', anim: 'broken', side: 'enemy', cat: 'dmg' });
      if (st.expedition) DK.expedition.questTrack('break');
    },
    /** El rival actúa (salvo si está roto). */
    enemyAct(st, moveId, ev) {
      if (st.broken) {
        if (st._stunMsg !== st.turn) { st._stunMsg = st.turn; this.push(st, ev, { text: t('battle.stunned', { name: cap(this.name(st, 'enemy')) }), kind: 'muted', anim: 'stunned', side: 'enemy', cat: 'dmg' }); }
        return;
      }
      this.act(st, 'enemy', moveId, ev);
    },

    /* ---------------- Punto débil e información del rival ---------------- */
    /** Tipo de ataque que más daño hace a una especie: el de su defensa más baja ('fisico'|'magico'|null). */
    weakness(speciesId) {
      const b = D.species[speciesId].base;
      if (Math.abs(b.def - b.mdef) < 2) return null;
      return b.def < b.mdef ? 'fisico' : 'magico';
    },
    weakKnown(speciesId) { return !!((DK.store.state.weakKnown || {})[speciesId]); },
    /**
     * Cuánto sabes del rival según los combates contra su especie en esta zona:
     * 0 = nada · 1 = su casa · 2 = también sus ataques · 3+ = también sus atributos.
     */
    knowledge(st) { return st.duel ? 99 : DK.codex.fought(st.zoneId, st.enemy.species); },

    /* ---------------- Orden de actuación ---------------- */
    /** Prioridad de un ataque (+1 rápido, -1 lento, 0 normal). */
    priority(moveId) { return (D.moves[moveId] && D.moves[moveId].priority) || 0; },
    /**
     * Quién actúa primero si tú usas `allyMove` y el rival `enemyMove`.
     * Primero manda la prioridad del ataque; con la misma, la velocidad.
     * @returns {{first:'ally'|'enemy'|'tie', by:'priority'|'speed'}}
     */
    orderFor(st, allyMove, enemyMove = st.intent) {
      const pa = this.priority(allyMove), pe = this.priority(enemyMove);
      if (pa !== pe) return { first: pa > pe ? 'ally' : 'enemy', by: 'priority' };
      const o = this.turnOrder(st);
      return { first: o.first, by: 'speed' };
    },

    /** Rango estimado [mín, máx] del aliado contra el enemigo actual. */
    estimate(st, moveId) {
      const m = D.moves[moveId];
      if (!m.power) return null;
      const max = this.damage(st, 'ally', m, { random: false, ignoreHouse: !st.known, hideWeak: true }).dmg;
      return [Math.max(1, Math.round(max * 0.88)), max];
    },

    /** Probabilidad de huida: +5 niveles = 100%, mismo nivel = 50%, más de 5 por debajo = 0%. Jefes: 0%. */
    fleeChance(st) {
      if (st.duel) return 1; // (en un duelo, huir es rendirse)
      if (st.boss) return 0;
      if (st.expedition && DK.curses.effect('noFlee')) return 0; // pacto «Sin huida»
      const diff = this.ally(st).level - st.enemy.level;
      const f = C().flee;
      if (diff >= f.alwaysAt) return 1;
      if (diff < f.neverBelow) return 0;
      if (diff >= 0) return f.base + (1 - f.base) * (diff / f.alwaysAt);
      return Math.max(0.05, f.base * (1 + diff / -f.neverBelow));
    },

    /** Orden de actuación previsto: ['ally','enemy'] o al revés; 'tie' si empatan. */
    turnOrder(st) {
      const a = this.stat(st, 'ally', 'spd'), e = this.stat(st, 'enemy', 'spd');
      return { first: a > e ? 'ally' : e > a ? 'enemy' : 'tie', a: Math.round(a), e: Math.round(e) };
    },

    /** Maná que cuesta un ataque (las reliquias pueden abaratarlo). */
    mpCost(d, moveId) {
      const m = D.moves[moveId];
      if (m.kind === 'fisico' || !m.mp) return 0;
      const save = (!d.wild && !d.boss && DK.expedition.active() ? DK.relics.sum('mpSave') : 0) + (DK.gear.fxOf(d).mpCost || 0); // v4.81: báculos
      return Math.max(1, Math.round(m.mp * (1 - Math.min(0.7, save))));
    },
    canUseMove(d, moveId) { return d.cur.mp >= this.mpCost(d, moveId); },
    hasUsableMove(d) { return DK.daskai.battleMoves(d).some((m) => this.canUseMove(d, m)); },

    /**
     * Objeto curativo para el automático cuando tu daskai está en zona crítica:
     * el más barato que recupere al menos la mitad de lo que le falta (o el que más cure).
     * Nunca usa objetos legendarios. Devuelve el id o null.
     */
    autoHealItem(st) {
      if (st.duel) return null; // sin objetos en los duelos
      const a = this.ally(st), s = DK.daskai.stats(a);
      const missing = s.hp - a.cur.hp;
      if (missing <= 0) return null;
      const opts = DK.bag.list('batalla').map(({ item }) => item)
        .filter((it) => it.use && !it.use.capture && it.rarity !== 'legendario' && DK.bag.potency(it.id, a).hp > 0)
        .map((it) => ({ id: it.id, hp: DK.bag.potency(it.id, a).hp, price: D.prices[it.id] || 0 }));
      if (!opts.length) return null;
      const enough = opts.filter((o) => o.hp >= missing * 0.5).sort((x, y) => x.price - y.price || x.hp - y.hp)[0];
      return (enough || opts.sort((x, y) => y.hp - x.hp)[0]).id;
    },
    /** ¿Debe el automático curar ahora? (zona crítica, ajuste activo, sin pasarse del máximo) */
    autoShouldHeal(st) {
      const a = this.ally(st);
      return !!DK.settings.get('autoHeal') && DK.daskai.hpPct(a) < C().autoHeal.at && (st.autoHeals || 0) < C().autoHeal.max;
    },

    /** Mejor ataque para el combate automático. */
    bestMove(st) {
      const a = this.ally(st);
      const usable = DK.daskai.battleMoves(a).filter((m) => this.canUseMove(a, m));
      if (!usable.length) return 'forcejeo';
      const hp = DK.daskai.hpPct(a);
      const heal = usable.find((m) => D.moves[m].effect && D.moves[m].effect.type === 'heal');
      if (hp < 0.35 && heal) return heal;
      const dmg = usable.filter((m) => D.moves[m].power > 0)
        .map((m) => ({ m, v: this.damage(st, 'ally', D.moves[m], { random: false, ignoreHouse: !st.known }).dmg * (D.moves[m].acc / 100) }))
        .sort((x, y) => y.v - x.v);
      return dmg.length ? dmg[0].m : usable[0];
    },

    /** Foto de vida/maná/estado para la interfaz. */
    snap(st) {
      const a = this.ally(st), e = st.enemy;
      return { aHp: a.cur.hp, aMp: a.cur.mp, aStatus: a.status, eHp: e.cur.hp, eMp: e.cur.mp, eStatus: e.status, aUid: a.uid, eUid: e.uid, bVal: st.breakVal || 0, bMax: st.breakMax || 0, broken: st.broken || 0 };
    },
    push(st, ev, o) { ev.push(Object.assign({ cat: 'sys' }, o, { snap: this.snap(st) })); },

    /* ---------------- IA del enemigo ---------------- */
    enemyChoice(st) {
      const d = st.enemy;
      const usable = DK.daskai.battleMoves(d).filter((m) => this.canUseMove(d, m));
      if (!usable.length) return 'forcejeo';
      const hpPct = DK.daskai.hpPct(d);
      const heals = usable.filter((m) => D.moves[m].effect && D.moves[m].effect.type === 'heal');
      if (hpPct < 0.4 && heals.length && U.chance(0.6)) return U.pick(heals);
      const opts = usable.map((m) => {
        const mv = D.moves[m];
        let w = mv.power > 0 ? 2 + mv.power / 35 : 1;
        if (mv.effect && mv.effect.type === 'heal') w = hpPct < 0.7 ? 1.5 : 0.05;
        if (mv.effect && mv.effect.type === 'buff' && st.stages.enemy[mv.effect.stat] >= 2) w = 0.1;
        if (mv.effect && mv.effect.type === 'status' && !mv.power && this.ally(st).status) w = 0.05;
        return { m, weight: w };
      });
      return U.weighted(opts).m;
    },

    /* ---------------- Ejecutar un ataque ---------------- */
    /**
     * v5.4: ¿el estado le impide actuar este turno? (congelado, dormido, paralizado).
     * Congelado/dormido: cada turno puede pasarse (thaw) y como mucho maxTurns; paralizado: skip de probabilidad.
     */
    blockedBy(st, side, ev) {
      const A = this.get(st, side), S = A.status && D.statuses[A.status];
      if (!S || !S.skip) return false;
      const name = this.name(st, side);
      if (S.thaw != null) {
        A.statusT = (A.statusT || 0) + 1;
        if (A.statusT > (S.maxTurns || 3) || U.chance(S.thaw)) {
          const was = A.status; A.status = null; A.statusT = 0;
          this.push(st, ev, { text: t(was === 'sueno' ? 'battle.woke' : 'battle.thawed', { name: cap(name) }), kind: 'good', anim: 'cured', side, cat: 'dmg' });
          return false;
        }
      } else if (!U.chance(S.skip)) return false;
      this.push(st, ev, { text: t('battle.blocked.' + A.status, { name: cap(name) }), kind: 'warn', anim: 'blocked', side, status: A.status, cat: 'dmg' });
      return true;
    },

    act(st, side, moveId, ev) {
      const A = this.get(st, side), T = this.get(st, other(side));
      const m = D.moves[moveId];
      if (this.blockedBy(st, side, ev)) return;
      const house = m.house || (m.kind === 'fisico' ? null : D.species[A.species].house);
      st.rc = st.rc || { atk: 0, mag: 0 }; // v5.46: cuenta de ataques de tu equipo en este combate (reliquias)
      let freeMp = false;
      if (side === 'ally' && m.kind === 'magico' && m.mp) { const hg = this.relic(st, 'freeEvery'); st.rc.mag++; if (hg && st.rc.mag % (hg.effect.n || 2) === 0) { freeMp = true; this.relicLog(st, ev, 'free', hg, {}, 'muted'); } }
      if (m.kind === 'magico' && m.mp && !freeMp) A.cur.mp = Math.max(0, A.cur.mp - this.mpCost(A, moveId));
      if (side === 'enemy') DK.codex.recordMove(st.zoneId, A.species, moveId);
      else st.lastMove = moveId;
      this.push(st, ev, { text: t('battle.uses', { name: this.name(st, side), move: m.name }), anim: 'attack', side, cat: 'dmg', move: moveId, house, kind: m.kind });

      const blind = A.status && D.statuses[A.status] && D.statuses[A.status].accMult ? D.statuses[A.status].accMult : 1; // v5.4: cegado
      if (!U.chance((m.acc / 100 + (DK.gear.fxOf(A).acc || 0)) * blind)) { // v4.82: precisión del equipo
        // v5.17: que se entienda que ha fallado por la precisión (no es un error del juego)
        this.push(st, ev, { text: t('battle.missedAcc', { move: m.name, acc: Math.round(U.clamp((m.acc / 100 + (DK.gear.fxOf(A).acc || 0)) * blind, 0, 1) * 100) }), kind: 'muted', anim: 'miss', side: other(side), cat: 'dmg' }); return; }

      let dealt = 0;
      const gA = DK.gear.fxOf(A), gT = DK.gear.fxOf(T);
      // v4.74: esquiva (equipamiento del que recibe)
      if (m.power > 0 && gT.dodge && U.chance(gT.dodge)) { this.push(st, ev, { text: t('battle.dodged', { name: this.name(st, other(side)) }), kind: 'muted', anim: 'miss', side: other(side), cat: 'dmg' }); return; }
      if (m.power > 0) {
        // v5.46: Ojo del cazador: cada n-ésimo ataque de tu equipo en este combate es crítico seguro
        let sure = false;
        if (side === 'ally') { st.rc.atk++; const eye = this.relic(st, 'critEvery'); if (eye && st.rc.atk % (eye.effect.n || 3) === 0) { sure = true; this.relicLog(st, ev, 'crit', eye, {}, 'warn'); } }
        const r = this.damage(st, side, m, { forceCrit: sure });
        // v4.81: aguantar un golpe mortal con 1 PV (escudos; una vez por combate)
        st.endured = st.endured || {};
        if (r.dmg >= T.cur.hp && T.cur.hp > 1 && gT.endure && !st.endured[T.uid] && U.chance(gT.endure)) {
          st.endured[T.uid] = true; r.dmg = T.cur.hp - 1;
          this.push(st, ev, { text: t('battle.endure', { name: this.name(st, other(side)) }), kind: 'warn', cat: 'dmg' });
        }
        // v5.46: Relicario del último aliento: una vez por combate, tu daskai aguanta un golpe mortal con 1 PV
        if (side === 'enemy' && r.dmg >= T.cur.hp && T.cur.hp > 1 && !st.lastBreath) { const lb = this.relic(st, 'survive'); if (lb) { st.lastBreath = true; r.dmg = T.cur.hp - 1; this.relicLog(st, ev, 'survive', lb, { name: this.name(st, 'ally') }, 'level'); } }
        (st.opened = st.opened || {})[side] = true; // ya dio su primer golpe (botas)
        dealt = Math.min(r.dmg, T.cur.hp);
        T.cur.hp = Math.max(0, T.cur.hp - r.dmg);
        DK.emit('damage', { side: other(side), amount: dealt, crit: r.crit });
        this.push(st, ev, { anim: 'hit', side: other(side), amount: r.dmg, crit: r.crit, eff: r.eff, house, kind: m.kind, cat: 'dmg' });
        // v5.4: un golpe despierta al dormido; el fuego descongela
        if (T.cur.hp > 0 && T.status && ((T.status === 'sueno' && D.statuses.sueno.wakeOnHit) || (T.status === 'congelacion' && house === 'fuego'))) {
          const was = T.status; T.status = null; T.statusT = 0;
          this.push(st, ev, { text: t(was === 'sueno' ? 'battle.woke' : 'battle.thawed', { name: cap(this.name(st, other(side))) }), kind: 'muted', anim: 'cured', side: other(side), cat: 'dmg' });
        }
        if (r.crit) this.push(st, ev, { text: t('battle.crit'), kind: 'warn', cat: 'dmg' });
        if (r.eff === 'strong') this.push(st, ev, { text: t('battle.strong'), kind: 'good', cat: 'dmg' });
        if (r.eff === 'weak') this.push(st, ev, { text: t('battle.weak'), kind: 'muted', cat: 'dmg' });
        // Descubrir el punto débil del rival al golpearle con ese tipo de ataque
        if (side === 'ally' && r.weak) {
          const wk = (DK.store.state.weakKnown = DK.store.state.weakKnown || {});
          if (!wk[T.species]) { wk[T.species] = true; this.push(st, ev, { text: t('battle.weakFound', { name: D.species[T.species].name, kind: (m.kind === 'fisico' ? t('common.physical') : t('common.magical')).toLowerCase() }), kind: 'level', cat: 'dmg' }); }
          else this.push(st, ev, { text: t('battle.weakHit'), kind: 'good', cat: 'dmg' });
        }
        // Escudo del jefe: un golpe eficaz lo rompe; los demás quitan una carga
        if (side === 'ally' && st.shield > 0 && T.cur.hp > 0) {
          st.shield = r.eff === 'strong' ? 0 : st.shield - 1;
          this.push(st, ev, { text: st.shield ? t('phase.shieldHit', { n: st.shield }) : t('phase.shieldBroken'), kind: st.shield ? 'muted' : 'good', cat: 'dmg' });
        }
        if (side === 'ally' && st.expedition && r.eff === 'strong') DK.expedition.questTrack('strong');
        if (side === 'ally') this.addBreak(st, this.breakGain(st, m, r), ev);
        if (side === 'ally') this.checkPhase(st, ev);
        // v4.74: robo de vida, maná al golpear (quien ataca) y espinas (quien recibe; nunca deja a 0)
        if (dealt > 0) {
          const sA = DK.daskai.stats(A);
          const leech = gA.leech ? Math.min(Math.round(dealt * gA.leech), sA.hp - A.cur.hp) : 0;
          if (leech > 0 && A.cur.hp > 0) { A.cur.hp += leech; this.push(st, ev, { text: t('battle.leech', { name: this.name(st, side), n: leech }), anim: 'heal', side, amount: leech, cat: 'dmg' }); }
          const mana = gA.mana ? Math.min(Math.round(sA.mp * gA.mana), sA.mp - A.cur.mp) : 0;
          if (mana > 0) A.cur.mp += mana;
          const thorns = gT.thorns ? Math.min(Math.round(dealt * gT.thorns), A.cur.hp - 1) : 0;
          if (thorns > 0) { A.cur.hp -= thorns; this.push(st, ev, { text: t('battle.thorns', { name: this.name(st, other(side)), n: thorns }), kind: 'warn', anim: 'hit', side, amount: thorns, cat: 'dmg' }); }
          // v5.46: reliquias: Copa carmesí (robo de vida), Rodela de espinas (devuelve daño), Cristal de almas y Hueso del festín (al derrotar)
          if (side === 'ally' && A.cur.hp > 0) {
            const cup = this.relic(st, 'lifesteal'), ls = cup ? Math.min(Math.round(dealt * cup.effect.pct), sA.hp - A.cur.hp) : 0;
            if (ls > 0) { A.cur.hp += ls; this.push(st, ev, { text: t('relics.proc.lifesteal', { relic: cup.name, name: this.name(st, side), n: ls }), anim: 'heal', side, amount: ls, cat: 'dmg' }); }
            if (T.cur.hp <= 0) {
              const cm = this.relic(st, 'killMana'), mp = cm ? Math.min(Math.round(sA.mp * cm.effect.pct), sA.mp - A.cur.mp) : 0;
              if (mp > 0) { A.cur.mp += mp; this.push(st, ev, { text: t('relics.proc.killMana', { relic: cm.name, n: mp }), anim: 'mana', side, amount: mp, cat: 'dmg' }); }
              const kh = this.relic(st, 'killHeal'), hl = kh ? Math.min(Math.round(sA.hp * kh.effect.pct), sA.hp - A.cur.hp) : 0;
              if (hl > 0) { A.cur.hp += hl; this.push(st, ev, { text: t('relics.proc.killHeal', { relic: kh.name, name: this.name(st, side), n: hl }), anim: 'heal', side, amount: hl, cat: 'dmg' }); }
            }
          }
          if (side === 'enemy' && T.cur.hp > 0) {
            const sp = this.relic(st, 'thorns'), th = sp ? Math.min(Math.round(dealt * sp.effect.pct), A.cur.hp - 1) : 0;
            if (th > 0) { A.cur.hp -= th; this.push(st, ev, { text: t('relics.proc.thorns', { relic: sp.name, n: th }), kind: 'good', anim: 'hit', side, amount: th, cat: 'dmg' }); }
          }
          // v4.81: festín (anillos): cura al derrotar al rival
          const feast = T.cur.hp <= 0 && gA.killHeal && A.cur.hp > 0 ? Math.min(Math.round(sA.hp * gA.killHeal), sA.hp - A.cur.hp) : 0;
          if (feast > 0) { A.cur.hp += feast; this.push(st, ev, { text: t('battle.feast', { name: this.name(st, side), n: feast }), anim: 'heal', side, amount: feast, cat: 'dmg' }); }
        }
      }

      const e = m.effect;
      if (!e) return;
      const lucky = e.chance == null || U.chance(e.chance);
      const s = DK.daskai.stats(A);
      if (e.type === 'drain' && dealt > 0) {
        const heal = Math.min(Math.round(dealt * e.pct * (1 + (gA.healBoost || 0))), s.hp - A.cur.hp);
        if (heal > 0) { A.cur.hp += heal; this.push(st, ev, { text: t('battle.drains', { name: this.name(st, side), n: heal }), anim: 'heal', side, amount: heal, cat: 'dmg' }); }
      } else if (e.type === 'heal') {
        const heal = Math.min(Math.round(s.hp * e.pct * (1 + (gA.healBoost || 0))), s.hp - A.cur.hp);
        if (heal > 0) { A.cur.hp += heal; this.push(st, ev, { text: t('battle.heals', { name: this.name(st, side), n: heal }), anim: 'heal', side, amount: heal, cat: 'dmg' }); }
        else this.push(st, ev, { text: t('battle.alreadyFull'), kind: 'muted', cat: 'dmg' });
      } else if (e.type === 'status' && lucky && T.cur.hp > 0) {
        // v4.81: amuletos: pueden evitar el estado
        if (!T.status && gT.statusRes && U.chance(gT.statusRes)) this.push(st, ev, { text: t('battle.warded', { name: this.name(st, other(side)) }), kind: 'muted', cat: 'dmg' });
        else if (!T.status) { T.status = e.status; T.statusT = 0; this.push(st, ev, { text: t('battle.gotStatus', { name: this.name(st, other(side)), status: statusName(e.status) }), kind: 'warn', anim: 'status', status: e.status, side: other(side), cat: 'dmg' }); }
        else if (!m.power) this.push(st, ev, { text: t('battle.noEffect'), kind: 'muted', cat: 'dmg' });
      } else if ((e.type === 'buff' || e.type === 'debuff') && lucky) {
        const tgt = e.type === 'buff' ? side : other(side);
        if (this.get(st, tgt).cur.hp <= 0) return;
        const stg = st.stages[tgt];
        const delta = e.type === 'buff' ? e.stages : -e.stages;
        const before = stg[e.stat];
        stg[e.stat] = U.clamp(before + delta, -3, 3);
        const sname = DK.tr('stats', D.stats[e.stat]).toLowerCase();
        if (stg[e.stat] === before) this.push(st, ev, { text: t(delta > 0 ? 'battle.cantRise' : 'battle.cantFall', { stat: sname }), kind: 'muted', cat: 'dmg' });
        else this.push(st, ev, { text: t(delta > 1 ? 'battle.statRiseMuch' : delta > 0 ? 'battle.statRise' : 'battle.statFall', { stat: sname, name: this.name(st, tgt) }), anim: delta > 0 ? 'buff' : 'debuff', side: tgt, cat: 'dmg' });
      }
    },

    /* ---------------- Objetos en combate ---------------- */
    useItem(st, itemId, ev) {
      const it = D.items[itemId];
      DK.bag.remove(itemId);
      DK.store.state.stats.itemsUsed++;
      DK.emit('item:used', { id: itemId });
      if (it.use.capture) return this.tryCapture(st, it, ev);
      const a = this.ally(st);
      this.push(st, ev, { text: t('battle.useItem', { item: it.name, name: DK.daskai.name(a) }), anim: 'item', side: 'ally', cat: 'item' });
      const r = DK.bag.applyTo(itemId, a);
      this.push(st, ev, { text: DK.bag.describeUse(a, r), kind: 'good', anim: r.hp ? 'heal' : r.mp ? 'mana' : 'status', side: 'ally', amount: r.hp || r.mp, mana: !r.hp && !!r.mp, cat: 'item' });
      return false;
    },

    /** ¿Por qué no se puede vincular? (null si se puede) */
    cannotCapture(st) {
      if (st.duel) return t('duel.noItems');
      if (!C().captureEnabled) return t('battle.captureOff');
      if (st.boss) return t('battle.bossNoCapture');
      if (C().captureOnlyInExpedition && !st.expedition) return t('battle.captureExpOnly');
      if (st.expedition && DK.curses.effect('noCapture')) return t('curse.noCaptureMsg');
      return null;
    },

    /** Probabilidad de vínculo con un cristal. */
    captureChance(st, it) {
      if (st.boss) return 0;
      const e = st.enemy, a = this.ally(st);
      let p = it.use.capture * (1 - 0.7 * DK.daskai.hpPct(e)) + (e.status ? 0.1 : 0) + (st.expedition ? DK.relics.sum('capture') + (DK.expedition.kindDef().capture || 0) : 0);
      const diff = e.level - a.level;
      if (diff > 0) p *= Math.max(0.25, 1 - 0.06 * diff);
      return U.clamp(p, 0.02, 0.95);
    },

    tryCapture(st, it, ev) {
      const e = st.enemy;
      this.push(st, ev, { text: t('battle.throw', { item: it.name }), anim: 'capture', side: 'enemy', cat: 'item' });
      if (U.chance(this.captureChance(st, it))) {
        this.push(st, ev, { text: t('battle.captured', { name: DK.daskai.name(e) }), kind: 'good', anim: 'captured', side: 'enemy', cat: 'item' });
        st.outcome = 'captured';
        return true;
      }
      this.push(st, ev, { text: t('battle.captureFail', { name: DK.daskai.name(e) }), kind: 'muted', anim: 'captureFail', side: 'enemy', cat: 'item' });
      return false;
    },

    /* ---------------- Turno completo ---------------- */
    turn(st, action) {
      const ev = [];
      if (st.outcome) return ev;
      st.turn++;
      this.tickTimed(st, ev);
      // El rival hace lo que anunció (si aún puede); si no, elige otra cosa
      const enemyMove = st.intent && this.canUseMove(st.enemy, st.intent) ? st.intent : this.enemyChoice(st);

      if (action.type === 'flee') {
        if (U.chance(this.fleeChance(st))) {
          this.push(st, ev, { text: t('battle.fled'), kind: 'good', anim: 'flee' });
          st.outcome = 'fled';
          return ev;
        }
        this.push(st, ev, { text: t('battle.fleeFail'), kind: 'warn' });
        this.enemyAct(st, enemyMove, ev);
      } else if (action.type === 'item') {
        if (this.useItem(st, action.itemId, ev)) return ev;
        this.enemyAct(st, enemyMove, ev);
      } else if (action.type === 'switch') {
        // Cambio táctico: el que entra recibe menos daño este turno
        ev.push(...this.switchTo(st, action.uid, { voluntary: true }));
        st.switchCushion = true;
        this.enemyAct(st, enemyMove, ev);
      } else if (action.type === 'guard') {
        // Defenderse: actúa siempre primero, recibe menos daño y recupera algo de maná
        const a = this.ally(st), s = DK.daskai.stats(a);
        st.guarding = true;
        const mp = Math.min(Math.round(s.mp * C().guardMana), s.mp - a.cur.mp);
        a.cur.mp += mp;
        this.push(st, ev, { text: t('battle.guarding', { name: DK.daskai.name(a), n: mp }), kind: 'good', anim: mp ? 'mana' : 'buff', side: 'ally', amount: mp || undefined, cat: 'dmg' });
        this.enemyAct(st, enemyMove, ev);
      } else if (action.type === 'move') {
        const order = this.orderFor(st, action.moveId, enemyMove);
        const allyFirst = order.first === 'ally' || (order.first === 'tie' && U.chance(0.5));
        const seq = allyFirst ? [['ally', action.moveId], ['enemy', enemyMove]] : [['enemy', enemyMove], ['ally', action.moveId]];
        for (const [side, mv] of seq) {
          if (this.get(st, side).cur.hp <= 0 || this.get(st, other(side)).cur.hp <= 0) break;
          if (side === 'enemy') this.enemyAct(st, mv, ev); else this.act(st, side, mv, ev);
        }
      }
      // Frenesí del jefe: uno de cada dos turnos ataca otra vez
      if (st.frenzy && !st.broken && st.turn % 2 === 0 && st.enemy.cur.hp > 0 && this.ally(st).cur.hp > 0 && !st.outcome) {
        this.push(st, ev, { text: t('phase.again', { name: cap(this.name(st, 'enemy')) }), kind: 'warn', cat: 'dmg' });
        this.act(st, 'enemy', this.enemyChoice(st), ev);
      }
      st.guarding = false; st.switchCushion = false;
      if (!this.resolve(st, ev)) this.endOfTurn(st, ev);
      // La ruptura dura hasta el final del turno siguiente al que se rompió
      if (st.broken && st.turn > st.brokeAt && !st.outcome) { st.broken = 0; this.push(st, ev, { text: t('battle.recovered', { name: cap(this.name(st, 'enemy')) }), kind: 'warn', cat: 'dmg' }); }
      if (!st.outcome) st.intent = this.enemyChoice(st);
      return ev;
    },

    /** Daño por estados alterados y regeneración al final del turno. */
    endOfTurn(st, ev) {
      for (const side of ['ally', 'enemy']) {
        const d = this.get(st, side);
        if (d.cur.hp <= 0) continue;
        const s = DK.daskai.stats(d);
        // v5.4: la ceguera se pasa sola (maxTurns); los estados sin daño no hacen nada más aquí
        if (d.status && !D.statuses[d.status].dot) {
          const info = D.statuses[d.status];
          if (!info.skip && info.maxTurns) { d.statusT = (d.statusT || 0) + 1; if (d.statusT >= info.maxTurns) { d.status = null; d.statusT = 0; this.push(st, ev, { text: t('battle.cured', { name: cap(this.name(st, side)), status: DK.tr('statuses', info).toLowerCase() }), kind: 'good', anim: 'cured', side, cat: 'dmg' }); } }
        } else if (d.status) {
          const info = D.statuses[d.status];
          const dmg = Math.max(1, Math.round(s.hp * info.dot));
          d.cur.hp = Math.max(0, d.cur.hp - dmg);
          this.push(st, ev, { text: t(d.status === 'veneno' ? 'battle.poisonDmg' : 'battle.burnDmg', { name: this.name(st, side), n: dmg }), kind: 'warn', anim: 'hit', side, amount: dmg, dot: true, cat: 'dmg' });
        }
        if (d.cur.hp > 0 && d.cur.hp < s.hp) {
          const regen = s.regen + (side === 'ally' && st.expedition ? DK.relics.sum('regen') : 0) + (side === 'enemy' ? st.bossRegen || 0 : 0);
          if (regen > 0) {
            const r = Math.min(Math.max(1, Math.round((s.hp * regen) / 100)), s.hp - d.cur.hp);
            d.cur.hp += r;
            this.push(st, ev, { anim: 'regen', side, amount: r });
          }
        }
      }
      this.resolve(st, ev);
    },

    /** Comprueba derrotas. Devuelve true si el turno debe pararse. */
    resolve(st, ev) {
      const a = this.ally(st), e = st.enemy;
      if (e.cur.hp <= 0) {
        this.push(st, ev, { text: t('battle.enemyFainted', { name: this.name(st, 'enemy') }), kind: 'good', anim: 'faint', side: 'enemy' });
        // v5.5: oleada / relevo: si queda otro rival, entra sin salir del combate
        const W = st.wave;
        if (W && a.cur.hp > 0) {
          W.beaten++;
          const next = W.queue.shift();
          if (next) { this.enemyIn(st, next, ev, W.kind === 'swap' ? 'back' : 'next'); return true; }
        }
        st.outcome = 'won';
        return true;
      }
      // v5.5: relevo: a media vida el rival se retira y entra el otro (cada uno se retira una sola vez)
      const W = st.wave;
      if (W && W.kind === 'swap' && a.cur.hp > 0 && W.queue.length && !W.swapped[e.uid] && e.cur.hp / DK.daskai.stats(e).hp <= 0.5) {
        W.swapped[e.uid] = true;
        const next = W.queue.shift();
        W.queue.push(e);
        this.push(st, ev, { text: t('battle.wave.retreat', { name: cap(this.name(st, 'enemy')) }), kind: 'warn', anim: 'enemyOut', side: 'enemy', cat: 'dmg' });
        this.enemyIn(st, next, ev, W.swapped[next.uid] ? 'back' : 'swap');
        return true;
      }
      if (a.cur.hp <= 0) {
        if (st.expedition) DK.expedition.questFail('faint');
        this.push(st, ev, { text: t('battle.allyFainted', { name: DK.daskai.name(a) }), kind: 'bad', anim: 'faint', side: 'ally' });
        st.stages.ally = zeroStages();
        if (DK.party.aliveActive().length) st.needSwitch = true;
        else { st.outcome = 'lost'; this.push(st, ev, { text: t('battle.noneLeft'), kind: 'bad' }); }
        return true;
      }
      return false;
    },

    /** v5.5: entra un rival nuevo (oleada o relevo): sus mejoras/efectos empiezan de cero. */
    enemyIn(st, d, ev, how = 'next') {
      st.enemy = d; st.stages.enemy = zeroStages(); if (st.timed) st.timed.enemy = [];
      st.known = st.duel ? true : DK.codex.fought(st.zoneId, d.species) > 0;
      const W = st.wave, n = W ? W.all.indexOf(d) + 1 : 1;
      this.push(st, ev, { text: t('battle.wave.' + how, { name: cap(this.name(st, 'enemy')), n, total: W ? W.total : 1 }), kind: 'warn', anim: 'enemyIn', side: 'enemy', uid: d.uid, cat: 'dmg' });
      this.applyEntry(st, 'enemy', ev);
      st.intent = this.enemyChoice(st);
    },

    /** Cambia el daskai aliado. */
    switchTo(st, uid, { voluntary = false } = {}) {
      const ev = [];
      const prev = this.ally(st);
      st.allyUid = uid; st.needSwitch = false; st.stages.ally = zeroStages();
      // Las mejoras propias del que sale se van con él (lo que le hizo al rival se queda)
      if (st.timed && prev) st.timed.ally = st.timed.ally.filter((x) => x.owner !== prev.uid);
      const stt = DK.store.state.stats; stt.usage[uid] = (stt.usage[uid] || 0) + 1;
      if (voluntary && prev) this.push(st, ev, { text: t('battle.comeBack', { name: DK.daskai.name(prev) }) });
      this.push(st, ev, { text: t('battle.go', { name: DK.daskai.name(this.ally(st)) }), anim: 'switch', side: 'ally' });
      this.applyEntry(st, 'ally', ev);
      return ev;
    },

    /* ---------------- Recompensas ---------------- */
    /**
     * Reparte experiencia, monedas y botín tras ganar o vincular.
     * En una expedición el botín se guarda aparte hasta terminarla.
     */
    rewards(st) {
      if (st.duel) return DK.duels.rewards(st);
      const ally = this.ally(st), e = st.enemy, sp = D.species[e.species], zone = D.zones[st.zoneId];
      const out = { exp: 0, coins: 0, drops: [], unlocked: null, captured: st.outcome === 'captured', boss: st.boss, toLoot: st.expedition };
      const gF = DK.gear.fxOf(ally); // v4.82: sufijos de experiencia y monedas
      out.exp = Math.round(C().expGain(sp.exp, e.level) * (st.boss ? 2 : st.elite ? 1.5 : 1) * (st.wave && st.outcome === 'won' ? st.wave.mult : 1) * (1 + DK.camp.value('sabiduria') + (gF.expFind || 0) + (st.expedition ? DK.relics.sum('exp') + (DK.expedition.kindDef().exp || 0) + DK.runes.bonus('exp') : 0)));
      out.levelInfo = DK.daskai.gainExp(ally, out.exp);
      // Experiencia compartida con el resto del equipo (no debilitados)
      out.shared = DK.party.active().filter((d) => d.uid !== ally.uid && !DK.daskai.isFainted(d) && d.level < DK.config.maxLevel).map((d) => {
        const n = Math.max(1, Math.round(out.exp * C().expShare));
        const before = d.level;
        const info = DK.daskai.gainExp(d, n);
        return { uid: d.uid, name: DK.daskai.name(d), exp: n, from: before, to: d.level, evolveReady: info.evolveReady };
      });
      const bi = st.bossInfo || zone.boss;
      out.coins = Math.round((st.boss ? bi.coins : C().coinDrop(e.level) * (st.elite ? 2 : 1)) * (1 + (gF.goldFind || 0)) * (st.wave && st.outcome === 'won' ? st.wave.mult : 1));
      if (st.wave) out.wave = { kind: st.wave.kind, n: st.wave.total, mult: st.wave.mult };

      const entry = DK.codex.entry(st.zoneId, e.species);
      entry.defeated++;
      if (out.captured) {
        entry.captured++;
        e.uid = U.uid();
        delete e.wild; delete e.elite;
        DK.daskai.clamp(e);
        if (st.expedition) {
          // En expedición es temporal: sólo se queda si derrotas al jefe
          DK.expedition.addRecruit(e);
          out.temp = true;
        } else {
          DK.store.state.stats.captures++;
          if (e.shiny) DK.store.state.stats.shinies++;
          DK.party.add(e);
          DK.emit('captured', { d: e });
        }
      } else {
        const table = !st.expedition && !C().freeBattleDrops ? [] : st.boss ? bi.drops : sp.drops;
        for (const [itemId, p] of table) {
          if (U.chance(p)) { out.drops.push(itemId); DK.codex.recordDrop(st.zoneId, e.species, itemId); }
        }
        // Élite: siempre suelta su objeto más raro y a veces uno de experiencia
        if (st.elite && table.length) {
          const rare = table.slice().sort((a, b) => a[1] - b[1])[0][0];
          if (!out.drops.includes(rare)) { out.drops.push(rare); DK.codex.recordDrop(st.zoneId, e.species, rare); }
          if (U.chance(C().expItemChance)) out.drops.push(DK.expedition.expItem());
        }
        // Zona con drops propios (Corazón del Vacío)
        if (st.expedition && zone.drops) zone.drops.forEach(([id, p]) => { if (D.items[id] && U.chance(p)) out.drops.push(id); });
        // Fragmento abisal (forma alternativa): jefes ocultos, el Devorador y jefes con Corrupción III+
        if (st.expedition && DK.endgame && U.chance(DK.endgame.abisalChance(st))) out.drops.push('fragmento_abisal');
        // Mini jefe: a veces suelta un tónico
        if (st.elite && st.expedition && U.chance(C().expedition.tonicDrops.elite)) out.drops.push(DK.expedition.tonic());
        // v4.74: piedras de forja (y las exclusivas de jefe)
        if (st.expedition) out.drops.push(...DK.gear.battleDrops(st.boss ? 'boss' : st.elite ? 'elite' : 'fight'));
      }
      if (st.expedition) {
        const coins0 = DK.expedition.active().loot.coins;
        const split = DK.expedition.addLoot(out.drops, out.coins, { src: st.boss ? 'boss' : st.elite ? 'elite' : 'fight', level: e.level });
        out.toBag = split.bag;
        out.gear = split.gear; // v4.74: piezas con su rareza
        out.coins = DK.expedition.active().loot.coins - coins0; // con la bonificación de reliquias
        // Reliquias que curan al ganar
        const wh = DK.relics.sum('winHeal') + DK.camp.value('auxilios'); // v5.46: + Primeros auxilios
        if (wh) DK.party.active().forEach((d) => { if (!DK.daskai.isFainted(d)) { const s = DK.daskai.stats(d); d.cur.hp = Math.min(s.hp, d.cur.hp + Math.round(s.hp * wh)); } });
        out.winHeal = wh;
        // Tras vencer a un rival de élite eliges una reliquia
        // Runas de expedición: élites a veces, jefes siempre (DK.runes)
        out.runes = DK.runes.drop(st.secret ? 'secret' : st.boss ? 'boss' : st.elite ? 'elite' : '');
        // v5.46: los mini jefes y los jefes sueltan una reliquia especial al azar (de todas; la corrupción la hace más rara)
        if (st.elite || st.boss) { const rid = DK.relics.drop(st.boss ? 'boss' : 'elite'); if (rid) { DK.relics.give(rid); DK.expedition.logEvent('relic', { id: rid }); out.relic = rid; }
          // v5.46: Relicario (mejora permanente): a veces suelta otra
          if (U.chance(DK.camp.value('relicario'))) { const r2 = DK.relics.drop(st.boss ? 'boss' : 'elite'); if (r2) { DK.relics.give(r2); DK.expedition.logEvent('relic', { id: r2 }); out.relic2 = r2; } } }
      } else { out.drops.forEach((id) => DK.bag.add(id)); DK.wallet.add(out.coins, { silent: true }); }

      DK.store.state.stats.wins++;
      // v5.1: Abismo → cada jefe vencido cuenta para el récord y da un pequeño premio
      if (st.boss && st.expedition && DK.abyss && DK.abyss.on()) out.abyss = DK.abyss.onBoss();
      // Jefe del final del mapa: progreso de la zona
      if (st.boss && st.final) {
        DK.world.boss(st.zoneId).defeated++;
        out.freeUnlocked = DK.world.boss(st.zoneId).defeated === 1;
        out.unlockedByBoss = DK.world.unlockNext(st.zoneId);
      }
      // Jefe oculto: la primera victoria lo desbloquea como posible jefe final
      if (st.secret) {
        const rec = DK.world.secret(st.zoneId);
        rec.defeated++;
        out.secretUnlocked = rec.defeated === 1;
        const ex = DK.expedition.active();
        if (ex && ex.log) (ex.log.secrets = ex.log.secrets || []).push(st.zoneId);
        DK.emit('secret:defeated', { zone: st.zoneId, first: out.secretUnlocked });
      }
      // Línea de tiempo de la expedición
      if (st.expedition) {
        if (st.secret) DK.expedition.logEvent('secret', { title: st.bossInfo.title });
        else if (st.boss) DK.expedition.logEvent('boss', { title: (st.bossInfo || zone.boss).title });
        else if (st.elite) { DK.expedition.logEvent('elite', { species: e.species }); DK.expedition.questTrack('elite'); }
        if (out.captured) { DK.expedition.logEvent('recruit', { name: DK.daskai.name(e), species: e.species }); DK.expedition.questTrack('capture'); }
      }
      // v5.18: legendario vencido: desde la segunda victoria puede querer unirse
      if (st.legend && st.outcome === 'won') { const L = DK.legends.defeated(st.legend); out.legend = { species: st.legend, n: L.n, offer: L.offer, level: e.level }; }
      if (st.boss) {
        DK.store.state.stats.bossesDefeated++;
        // Emblemas para las Mejoras permanentes (sólo en expedición)
        if (st.expedition) out.emblems = DK.camp.addEmblems(DK.expedition.bossEmblems()); // más cuanto más grande es el mapa
        DK.emit('boss:defeated', { zone: st.zoneId, secret: st.secret });
      }
      DK.world.addWin(st.zoneId);
      out.unlocked = out.unlockedByBoss || null;
      DK.emit('enemy:defeated', { species: e.species, house: sp.house, zone: st.zoneId, boss: st.boss, shiny: !!e.shiny });
      DK.emit('battle:won', { zone: st.zoneId });
      DK.store.save();
      return out;
    },

    /** Cierra el combate: registra la pelea en el códice y las estadísticas. */
    finish(st) {
      if (st.finished) return;
      st.finished = true;
      if (st.duel) { DK.duels.finish(st); return; }
      DK.codex.entry(st.zoneId, st.enemy.species).fought++;
      const s = DK.store.state.stats;
      // Muerte permanente (según la dificultad): en una expedición, los daskai que
      // han caído mueren... salvo que les quede una salvación (bendición, pluma, altar)
      st.dead = []; st.saved = [];
      st.allyCache = this.ally(st);
      if (st.expedition && DK.rules.permadeath()) {
        const e = DK.expedition.active();
        DK.party.all().filter((d) => d.cur.hp <= 0).forEach((d) => {
          const how = DK.expedition.trySave(d);
          if (how) { st.saved.push({ name: DK.daskai.name(d), how }); return; }
          const info = { name: DK.daskai.name(d), species: d.species, level: d.level, uid: d.uid, look: DK.looks.of(d) || null };
          st.dead.push(info);
          if (e && e.log) (e.log.fallen = e.log.fallen || []).push(info);
          DK.expedition.logEvent('fallen', { name: info.name });
          DK.party.kill(d.uid, st.zoneId);
        });
      }
      s.battles++;
      if (st.outcome === 'lost') {
        // Tu equipo vuelve con poca vida (en expediciones ya no queda nadie de ese equipo)
        s.losses++;
        DK.party.active().forEach((d) => { const ss = DK.daskai.stats(d); d.cur.hp = Math.max(d.cur.hp, Math.ceil(ss.hp * C().lossHpPct)); d.status = null; });
      }
      if (st.outcome === 'fled') s.flees++;
      DK.store.save();
      const ally = this.ally(st);
      DK.emit('battle:end', {
        outcome: st.outcome, zone: st.zoneId, turns: st.turn, boss: st.boss, elite: !!st.elite,
        enemy: { species: st.enemy.species, level: st.enemy.level, shiny: !!st.enemy.shiny, look: DK.looks.of(st.enemy) || undefined },
        foes: st.wave ? st.wave.all.map((x) => ({ species: x.species, level: x.level, shiny: !!x.shiny, look: DK.looks.of(x) || undefined })) : undefined, // v5.9: oleadas/relevos
        ally: ally ? { uid: ally.uid, species: ally.species, level: ally.level } : null,
      });
    },
  };

  DK.battle = B;
})();
