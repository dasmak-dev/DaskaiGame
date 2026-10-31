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
  const t = (k, v) => DK.t(k, v);
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
      const zone = D.zones[zoneId];
      // En expediciones profundas los rivales tienen más nivel (DK.expedition.levelBonus)
      const plus = DK.expedition.active() ? DK.expedition.levelBonus() : 0;
      const lv = (n) => Math.min(DK.config.maxLevel, n + plus);
      let enemy;
      // Datos del jefe: el de la zona o, en las cuevas, el oculto (D.secretBosses)
      const secret = o.secret && D.secretBosses ? D.secretBosses[zoneId] : null;
      const bossInfo = secret || (o.boss ? zone.boss : null);
      if (o.boss && bossInfo) {
        enemy = DK.daskai.create(bossInfo.species, lv(bossInfo.level), { boss: true, shiny: false });
      } else if (o.elite) {
        const pick = U.weighted(zone.enemies);
        enemy = DK.daskai.create(pick.species, lv(zone.levels[1] + C().eliteLevelBonus), { wild: true, elite: true });
      } else {
        const pick = U.weighted(zone.enemies);
        enemy = DK.daskai.create(pick.species, lv(U.rand(zone.levels[0], zone.levels[1])), { wild: true });
      }
      DK.daskai.fullHeal(enemy);
      const known = DK.codex.fought(zoneId, enemy.species) > 0; // ¿hemos peleado antes contra él?
      DK.codex.seeEnemy(zoneId, enemy.species);
      const stt = DK.store.state.stats;
      stt.usage[leaderUid] = (stt.usage[leaderUid] || 0) + 1;
      DK.store.save();
      DK.emit('battle:start', { zone: zoneId, boss: !!o.boss, elite: !!o.elite });
      const st = {
        zoneId, enemy, allyUid: leaderUid, known, boss: !!o.boss, elite: !!o.elite && !o.boss, expedition: !!DK.expedition.active(),
        secret: !!secret, final: o.final != null ? !!o.final : !!o.boss && !secret,
        bossInfo: bossInfo ? { title: bossInfo.title, coins: bossInfo.coins, drops: bossInfo.drops } : null,
        stages: { ally: zeroStages(), enemy: zeroStages() }, turn: 0, outcome: null, needSwitch: false, finished: false, lastMove: null,
        phases: o.boss ? (secret ? secret.phases.map((p) => Object.assign({}, p)) : this.bossPhases(zoneId)) : [], phase: 0, shield: 0, frenzy: false, bossRegen: 0, guarding: false,
      };
      // Pacto «Frenesí»: el rival empieza más rápido
      if (st.expedition && DK.curses.effect('enemySpd')) st.stages.enemy.spd = Math.min(3, DK.curses.effect('enemySpd'));
      st.intent = this.enemyChoice(st);
      return st;
    },

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
      if (!m || !m.power) return null;
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
    /** Atributo en combate (con mejoras/reducciones). */
    stat(st, side, k) {
      const base = DK.daskai.stats(this.get(st, side))[k];
      return st.stages[side][k] != null ? base * this.stageMult(st.stages[side][k]) : base;
    },

    /** Multiplicador por casas: atacante fuerte x1.5, defensor fuerte -25%. */
    houseMult(attHouse, defHouse) {
      const H = D.houses;
      if (H[attHouse] && H[attHouse].strongVs === defHouse) return { mult: C().house.strongDamage, eff: 'strong' };
      if (H[defHouse] && H[defHouse].strongVs === attHouse) return { mult: 1 - C().house.weakDefense, eff: 'weak' };
      return { mult: 1, eff: null };
    },

    /** Eficacia del aliado contra el enemigo (null si aún no se conoce su casa). */
    effOf(st) {
      if (!st.known) return null;
      return this.houseMult(D.species[this.ally(st).species].house, D.species[st.enemy.species].house).eff;
    },

    /** Fórmula de daño (también se usa fuera de combate para estimaciones). */
    rawDamage({ power, kind, attLevel, atk, def, mult = 1, roll = 1, crit = false, burned = false }) {
      if (!power) return 0;
      let a = atk;
      if (kind === 'fisico' && burned) a *= D.statuses.quemadura.atkMult;
      const dmg = power * (a / (a + def)) * (1 + attLevel / 100) * 1.15 * mult * roll * (crit ? C().critMult : 1);
      return Math.max(1, Math.round(dmg));
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
      const h = ignoreHouse ? { mult: 1, eff: null } : this.houseMult(D.species[A.species].house, D.species[T.species].house);
      // Reliquias y Mejoras de expedición: más daño para ti, menos daño recibido
      let bonus = 1, critP = C().critChance;
      if (st.expedition) {
        if (side === 'ally') { bonus *= 1 + DK.relics.sum('dmg') + DK.relics.houseDmg(D.species[A.species].house) + DK.camp.value('fuerza'); critP += DK.relics.sum('crit'); }
        else bonus *= Math.max(0.3, 1 - DK.relics.sum('defense') - DK.camp.value('coraza'));
      }
      // Punto débil de la especie (ver weakness): más daño de ese tipo de ataque
      const wk = this.weakness(T.species) === move.kind && !(hideWeak && !this.weakKnown(T.species)) ? C().weakMult : 1;
      const guard = side === 'enemy' && st.guarding ? C().guardMult : 1;            // te estás defendiendo
      const switchIn = side === 'enemy' && st.switchCushion ? C().switchMult : 1;  // acaba de entrar al cambiar
      const shield = side === 'ally' && st.shield > 0 && h.eff !== 'strong' ? 0.35 : 1; // escudo del jefe
      const atk = this.stat(st, side, phys ? 'atk' : 'matk');
      const tSide = T === this.get(st, other(side)) ? other(side) : null;
      const def = tSide ? this.stat(st, tSide, phys ? 'def' : 'mdef') : DK.daskai.stats(T)[phys ? 'def' : 'mdef'];
      const mult = h.mult * bonus * wk * guard * switchIn * shield;
      const parts = [
        { k: 'power', v: move.power }, { k: 'atkdef', v: `${Math.round(atk)} / ${Math.round(def)}` }, { k: 'level', v: 1 + A.level / 100 },
        h.mult !== 1 ? { k: 'house', v: h.mult } : null, bonus !== 1 ? { k: 'bonus', v: bonus } : null, wk !== 1 ? { k: 'weak', v: wk } : null,
        guard !== 1 ? { k: 'guard', v: guard } : null, switchIn !== 1 ? { k: 'switchIn', v: switchIn } : null, shield !== 1 ? { k: 'shield', v: shield } : null,
        A.status === 'quemadura' && phys ? { k: 'burn', v: D.statuses.quemadura.atkMult } : null,
      ].filter(Boolean);
      return { power: move.power, atk, def, level: A.level, eff: h.eff, mult, critP, parts, weak: wk !== 1, burned: A.status === 'quemadura' };
    },

    /** Calcula el daño de un ataque de `side` contra el otro (o contra `o.target`). */
    damage(st, side, move, { random = true, ignoreHouse = false, target, hideWeak = false } = {}) {
      const A = this.get(st, side);
      const f = this.factors(st, side, move, { ignoreHouse, target, hideWeak });
      const crit = random && U.chance(f.critP);
      const dmg = this.rawDamage({
        power: move.power, kind: move.kind, attLevel: A.level, atk: f.atk, def: f.def,
        mult: f.mult, roll: random ? U.randf(0.88, 1) : 1, crit, burned: f.burned,
      });
      return { dmg, crit, eff: f.eff, weak: f.weak };
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
    knowledge(st) { return DK.codex.fought(st.zoneId, st.enemy.species); },

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
      const save = !d.wild && !d.boss && DK.expedition.active() ? DK.relics.sum('mpSave') : 0;
      return Math.max(1, Math.round(m.mp * (1 - save)));
    },
    canUseMove(d, moveId) { return d.cur.mp >= this.mpCost(d, moveId); },
    hasUsableMove(d) { return DK.daskai.battleMoves(d).some((m) => this.canUseMove(d, m)); },

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
      return { aHp: a.cur.hp, aMp: a.cur.mp, aStatus: a.status, eHp: e.cur.hp, eMp: e.cur.mp, eStatus: e.status, aUid: a.uid };
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
    act(st, side, moveId, ev) {
      const A = this.get(st, side), T = this.get(st, other(side));
      const m = D.moves[moveId];
      const house = m.house || (m.kind === 'fisico' ? null : D.species[A.species].house);
      if (m.kind === 'magico' && m.mp) A.cur.mp = Math.max(0, A.cur.mp - this.mpCost(A, moveId));
      if (side === 'enemy') DK.codex.recordMove(st.zoneId, A.species, moveId);
      else st.lastMove = moveId;
      this.push(st, ev, { text: t('battle.uses', { name: this.name(st, side), move: m.name }), anim: 'attack', side, cat: 'dmg', move: moveId, house, kind: m.kind });

      if (!U.chance(m.acc / 100)) { this.push(st, ev, { text: t('battle.missed'), kind: 'muted', anim: 'miss', side: other(side), cat: 'dmg' }); return; }

      let dealt = 0;
      if (m.power > 0) {
        const r = this.damage(st, side, m);
        dealt = Math.min(r.dmg, T.cur.hp);
        T.cur.hp = Math.max(0, T.cur.hp - r.dmg);
        DK.emit('damage', { side: other(side), amount: dealt, crit: r.crit });
        this.push(st, ev, { anim: 'hit', side: other(side), amount: r.dmg, crit: r.crit, eff: r.eff, house, kind: m.kind, cat: 'dmg' });
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
        if (side === 'ally') this.checkPhase(st, ev);
      }

      const e = m.effect;
      if (!e) return;
      const lucky = e.chance == null || U.chance(e.chance);
      const s = DK.daskai.stats(A);
      if (e.type === 'drain' && dealt > 0) {
        const heal = Math.min(Math.round(dealt * e.pct), s.hp - A.cur.hp);
        if (heal > 0) { A.cur.hp += heal; this.push(st, ev, { text: t('battle.drains', { name: this.name(st, side), n: heal }), anim: 'heal', side, amount: heal, cat: 'dmg' }); }
      } else if (e.type === 'heal') {
        const heal = Math.min(Math.round(s.hp * e.pct), s.hp - A.cur.hp);
        if (heal > 0) { A.cur.hp += heal; this.push(st, ev, { text: t('battle.heals', { name: this.name(st, side), n: heal }), anim: 'heal', side, amount: heal, cat: 'dmg' }); }
        else this.push(st, ev, { text: t('battle.alreadyFull'), kind: 'muted', cat: 'dmg' });
      } else if (e.type === 'status' && lucky && T.cur.hp > 0) {
        if (!T.status) { T.status = e.status; this.push(st, ev, { text: t('battle.gotStatus', { name: this.name(st, other(side)), status: statusName(e.status) }), kind: 'warn', anim: 'status', side: other(side), cat: 'dmg' }); }
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
      if (st.boss) return t('battle.bossNoCapture');
      if (C().captureOnlyInExpedition && !st.expedition) return t('battle.captureExpOnly');
      if (st.expedition && DK.curses.effect('noCapture')) return t('curse.noCaptureMsg');
      return null;
    },

    /** Probabilidad de vínculo con un cristal. */
    captureChance(st, it) {
      if (st.boss) return 0;
      const e = st.enemy, a = this.ally(st);
      let p = it.use.capture * (1 - 0.7 * DK.daskai.hpPct(e)) + (e.status ? 0.1 : 0) + (st.expedition ? DK.relics.sum('capture') : 0);
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
      // El rival hace lo que anunció (si aún puede); si no, elige otra cosa
      const enemyMove = st.intent && this.canUseMove(st.enemy, st.intent) ? st.intent : this.enemyChoice(st);

      if (action.type === 'flee') {
        if (U.chance(this.fleeChance(st))) {
          this.push(st, ev, { text: t('battle.fled'), kind: 'good', anim: 'flee' });
          st.outcome = 'fled';
          return ev;
        }
        this.push(st, ev, { text: t('battle.fleeFail'), kind: 'warn' });
        this.act(st, 'enemy', enemyMove, ev);
      } else if (action.type === 'item') {
        if (this.useItem(st, action.itemId, ev)) return ev;
        this.act(st, 'enemy', enemyMove, ev);
      } else if (action.type === 'switch') {
        // Cambio táctico: el que entra recibe menos daño este turno
        ev.push(...this.switchTo(st, action.uid, { voluntary: true }));
        st.switchCushion = true;
        this.act(st, 'enemy', enemyMove, ev);
      } else if (action.type === 'guard') {
        // Defenderse: actúa siempre primero, recibe menos daño y recupera algo de maná
        const a = this.ally(st), s = DK.daskai.stats(a);
        st.guarding = true;
        const mp = Math.min(Math.round(s.mp * C().guardMana), s.mp - a.cur.mp);
        a.cur.mp += mp;
        this.push(st, ev, { text: t('battle.guarding', { name: DK.daskai.name(a), n: mp }), kind: 'good', anim: mp ? 'mana' : 'buff', side: 'ally', amount: mp || undefined, cat: 'dmg' });
        this.act(st, 'enemy', enemyMove, ev);
      } else if (action.type === 'move') {
        const order = this.orderFor(st, action.moveId, enemyMove);
        const allyFirst = order.first === 'ally' || (order.first === 'tie' && U.chance(0.5));
        const seq = allyFirst ? [['ally', action.moveId], ['enemy', enemyMove]] : [['enemy', enemyMove], ['ally', action.moveId]];
        for (const [side, mv] of seq) {
          if (this.get(st, side).cur.hp <= 0 || this.get(st, other(side)).cur.hp <= 0) break;
          this.act(st, side, mv, ev);
        }
      }
      // Frenesí del jefe: uno de cada dos turnos ataca otra vez
      if (st.frenzy && st.turn % 2 === 0 && st.enemy.cur.hp > 0 && this.ally(st).cur.hp > 0 && !st.outcome) {
        this.push(st, ev, { text: t('phase.again', { name: cap(this.name(st, 'enemy')) }), kind: 'warn', cat: 'dmg' });
        this.act(st, 'enemy', this.enemyChoice(st), ev);
      }
      st.guarding = false; st.switchCushion = false;
      if (!this.resolve(st, ev)) this.endOfTurn(st, ev);
      if (!st.outcome) st.intent = this.enemyChoice(st);
      return ev;
    },

    /** Daño por estados alterados y regeneración al final del turno. */
    endOfTurn(st, ev) {
      for (const side of ['ally', 'enemy']) {
        const d = this.get(st, side);
        if (d.cur.hp <= 0) continue;
        const s = DK.daskai.stats(d);
        if (d.status) {
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
        st.outcome = 'won';
        return true;
      }
      if (a.cur.hp <= 0) {
        this.push(st, ev, { text: t('battle.allyFainted', { name: DK.daskai.name(a) }), kind: 'bad', anim: 'faint', side: 'ally' });
        st.stages.ally = zeroStages();
        if (DK.party.aliveActive().length) st.needSwitch = true;
        else { st.outcome = 'lost'; this.push(st, ev, { text: t('battle.noneLeft'), kind: 'bad' }); }
        return true;
      }
      return false;
    },

    /** Cambia el daskai aliado. */
    switchTo(st, uid, { voluntary = false } = {}) {
      const ev = [];
      const prev = this.ally(st);
      st.allyUid = uid; st.needSwitch = false; st.stages.ally = zeroStages();
      const stt = DK.store.state.stats; stt.usage[uid] = (stt.usage[uid] || 0) + 1;
      if (voluntary && prev) this.push(st, ev, { text: t('battle.comeBack', { name: DK.daskai.name(prev) }) });
      this.push(st, ev, { text: t('battle.go', { name: DK.daskai.name(this.ally(st)) }), anim: 'switch', side: 'ally' });
      return ev;
    },

    /* ---------------- Recompensas ---------------- */
    /**
     * Reparte experiencia, monedas y botín tras ganar o vincular.
     * En una expedición el botín se guarda aparte hasta terminarla.
     */
    rewards(st) {
      const ally = this.ally(st), e = st.enemy, sp = D.species[e.species], zone = D.zones[st.zoneId];
      const out = { exp: 0, coins: 0, drops: [], unlocked: null, captured: st.outcome === 'captured', boss: st.boss, toLoot: st.expedition };
      out.exp = Math.round(C().expGain(sp.exp, e.level) * (st.boss ? 2 : st.elite ? 1.5 : 1) * (1 + DK.camp.value('sabiduria') + (st.expedition ? DK.relics.sum('exp') : 0)));
      out.levelInfo = DK.daskai.gainExp(ally, out.exp);
      // Experiencia compartida con el resto del equipo (no debilitados)
      out.shared = DK.party.active().filter((d) => d.uid !== ally.uid && !DK.daskai.isFainted(d) && d.level < DK.config.maxLevel).map((d) => {
        const n = Math.max(1, Math.round(out.exp * C().expShare));
        const before = d.level;
        const info = DK.daskai.gainExp(d, n);
        return { uid: d.uid, name: DK.daskai.name(d), exp: n, from: before, to: d.level, evolveReady: info.evolveReady };
      });
      const bi = st.bossInfo || zone.boss;
      out.coins = st.boss ? bi.coins : C().coinDrop(e.level) * (st.elite ? 2 : 1);

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
        // Mini jefe: a veces suelta un tónico
        if (st.elite && st.expedition && U.chance(C().expedition.tonicDrops.elite)) out.drops.push(DK.expedition.tonic());
      }
      if (st.expedition) {
        const coins0 = DK.expedition.active().loot.coins;
        const split = DK.expedition.addLoot(out.drops, out.coins);
        out.toBag = split.bag;
        out.coins = DK.expedition.active().loot.coins - coins0; // con la bonificación de reliquias
        // Reliquias que curan al ganar
        const wh = DK.relics.sum('winHeal');
        if (wh) DK.party.active().forEach((d) => { if (!DK.daskai.isFainted(d)) { const s = DK.daskai.stats(d); d.cur.hp = Math.min(s.hp, d.cur.hp + Math.round(s.hp * wh)); } });
        out.winHeal = wh;
        // Tras vencer a un rival de élite eliges una reliquia
        if (st.elite) { DK.relics.offer(['raro', 'epico'], 3); const ex = DK.expedition.active(); if (ex && !(ex.relicChoice || []).length) DK.relics.offer(['comun', 'raro', 'epico'], 3); out.relicOffer = true; }
      } else { out.drops.forEach((id) => DK.bag.add(id)); DK.wallet.add(out.coins, { silent: true }); }

      DK.store.state.stats.wins++;
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
      if (st.boss) {
        DK.store.state.stats.bossesDefeated++;
        // Emblemas para las Mejoras permanentes (sólo en expedición)
        if (st.expedition) out.emblems = DK.camp.addEmblems(C().expedition.emblemsPerBoss);
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
          const info = { name: DK.daskai.name(d), species: d.species, level: d.level };
          st.dead.push(info);
          if (e && e.log) (e.log.fallen = e.log.fallen || []).push(info);
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
        enemy: { species: st.enemy.species, level: st.enemy.level, shiny: !!st.enemy.shiny },
        ally: ally ? { uid: ally.uid, species: ally.species, level: ally.level } : null,
      });
    },
  };

  DK.battle = B;
})();
