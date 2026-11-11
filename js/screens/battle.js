/* =============================================================
 * screens/battle.js — Pantalla de combate.
 *
 * Disposición:
 *   ┌ Arena: enemigo arriba a la derecha, aliado abajo a la izquierda,
 *   │ controles (automático, velocidad, sonido, registro) arriba a la
 *   │ derecha y las últimas líneas del registro abajo a la izquierda.
 *   └ Panel de mando: 4 ataques grandes + acciones (Bolsa, Cambiar,
 *     Huir, Estadísticas) y el banquillo con el resto del equipo.
 *
 * Comodidades: atajos (1-4 ataques, B/C/F/S acciones, R repetir,
 * A automático, V velocidad, Espacio acelerar, L registro),
 * velocidad x1/x2/x4, vista previa del daño en la barra enemiga,
 * indicador de eficacia y de orden de turno, cambiar de daskai.
 *
 * params: { zone, leaderUid, boss, state }
 * ============================================================= */
(function () {
  const { h, btn, bar, modal } = DK.ui;
  const D = DK.data, V = DK.views, B = () => DK.battle;
  const { t } = DK;

  /** v4.88: pista del combate: la de la zona más rápida, élite, jefe; con poca vida, latido; jefe herido, furia. */
  // v5.17: algunos jefes (según la zona: estable) y los combates contra varios rivales seguidos llevan música electrónica rápida
  const SYNTH_ZONES = new Set(['volcano', 'sky', 'abyss', 'glacier', 'cave', 'temple']);
  function battleTrack(st, p) {
    const boss = st ? st.boss || st.secret : p.boss || p.secret, secret = st ? st.secret : p.secret, elite = st ? st.elite : p.elite;
    const zone = D.zones[st ? st.zoneId : p.zone], wave = st ? !!st.wave : !!p.wave;
    const synth = boss && !secret && zone && (SYNTH_ZONES.has(zone.scene) || (p && p.abyssRound != null));
    const base = boss ? (secret ? 'boss_secret' : synth ? 'boss_synth' : 'boss') : elite ? 'elite' : wave ? 'horde' : (zone ? zone.scene : 'menu') + ':fight';
    if (!st || st.outcome) return base;
    const a = DK.battle.ally(st), e = st.enemy;
    if (a && !DK.daskai.isFainted(a) && DK.daskai.hpPct(a) < 0.3) return 'danger';
    if (boss && e && DK.daskai.hpPct(e) < 0.35) return synth ? 'boss_synth_rage' : 'boss_rage';
    return base;
  }

  DK.screens.register('battle', {
    title: (p) => D.zones[p.zone].name, icon: 'swords', back: false, nav: false, section: 'battle', tutorial: 'battle',
    // v4.88: combate normal = variante «fight» de la pista de la zona; élites y jefes, las suyas
    music: (p) => battleTrack(p.state, p),
    /**
     * Entrada al combate: la pantalla se tapa con una cortinilla, el
     * combate se monta detrás y se descubre. Jefes y mini jefes llevan
     * su cinta de título; los combates normales, un barrido rápido.
     */
    transition(p, go) {
      const z = D.zones[p.zone];
      if (p.state) return go();   // volver a un combate ya empezado
      if (p.boss) {
        const avb = !p.secret && DK.averno && DK.averno.on(); // v5.31: el jefe del Averno es uno de los de las zonas
        const info = p.secret && D.secretBosses ? D.secretBosses[p.zone] : avb ? DK.averno.bossInfo() : z.boss;
        const sp = D.species[info.species];
        const ex = DK.expedition.active(), lvl = avb ? info.level - DK.expedition.levelBonus() : !p.secret && p.abyssRound != null && ex && ex.kind === 'abismo' ? Math.max(info.level, DK.abyss.bossLevel(ex.startZone || ex.zone, p.abyssRound)) : info.level; // v5.1b: nivel real en el Abismo
        return DK.fx.cover({ title: info.title, subtitle: t(p.secret ? 'battle.curtainSecret' : 'battle.curtainBoss', { name: sp.name, n: lvl + (ex ? DK.expedition.levelBonus() : 0) }), icon: p.secret ? 'cave' : 'crown', colors: ['#f59e0b', '#7f1d1d'], kind: 'boss' }, go);
      }
      if (p.elite) return DK.fx.cover({ title: t('battle.curtainEliteTitle'), subtitle: z.name, icon: 'skull', colors: ['#f43f5e', '#4c0519'], kind: 'elite' }, go);
      return DK.fx.cover({ colors: z.colors, kind: 'battle' }, go);
    },
    render(params) {
      if (!params.state) params.state = B().start(params.zone, params.leaderUid, { boss: params.boss, elite: params.elite, secret: params.secret, final: params.final, abyssRound: params.abyssRound, wave: params.wave });
      return buildBattle(params);
    },
    onLeave(params) { if (params._ctl) params._ctl.stop(); },
  });

  function buildBattle(params) {
    const st = params.state;
    const zone = D.zones[st.zoneId];
    // Automático: lo elegido en este combate o, si no, el ajuste «Empezar en automático»
    let busy = false, skipping = false, auto = params.auto != null ? !!params.auto : !!DK.settings.get('autoBattle'), stopped = false;
    let logFilter = 'all';
    params._ctl = { stop: () => { stopped = true; } };

    /* ---------- Tiempos (respetan la velocidad elegida) ---------- */
    const speed = () => DK.settings.get('battleSpeed') || 1;
    /** Espera adaptada a la velocidad (y casi nula al pulsar Espacio). */
    const wait = (ms) => {
      if (skipping) return DK.util.sleep(10);
      const f = DK.settings.get('skipAnims') ? 0.35 : 1;
      return DK.util.sleep((ms * f) / speed());
    };

    /* ---------- Elementos ---------- */
    const enemySlot = h('div', { class: 'combatant enemy' });
    const allySlot = h('div', { class: 'combatant ally' });
    const enemyHud = h('div', { class: 'hud hud-enemy' });
    const allyHud = h('div', { class: 'hud hud-ally' });
    const fx = h('div', { class: 'fx-layer' });
    const banner = h('div', { class: 'battle-banner' });
    const orderChip = h('div', { class: 'turn-order' });
    const toolbar = h('div', { class: 'arena-controls' });
    const ticker = h('button', { class: 'log-ticker', type: 'button', tip: t('battle.expandLog'), onClick: () => expandLog() });
    const autoBadge = h('div', { class: 'auto-badge hidden' }, DK.icon('bolt', 14), h('span', null, t('battle.autoRunning')));
    // Los jefes tienen su propio fondo (uno por zona y otro para el jefe oculto)
    const sceneId = st.boss ? DK.scenes.bossScene(zone, st.secret) : zone.scene;
    const arena = h('div', { class: 'arena' + (st.boss ? ' is-boss' : '') + (st.secret ? ' is-secret' : '') + (st.elite ? ' is-elite' : ''), style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
      DK.scenes.render(sceneId, zone.colors),
      DK.ambient ? DK.ambient.battle(sceneId) : null, // v5.7: luz, aurora, calor… y más partículas
      // v5.4: clima de la zona (nieve en el Glaciar, niebla en el Pantano, lluvia a ratos…); en el jefe secreto, no
      st.secret || !DK.weather ? null : DK.weather.layer(DK.weather.forZone(zone, Math.floor(Date.now() / 72e5))),
      h('div', { class: 'platform p-enemy' }), h('div', { class: 'platform p-ally' }),
      enemyHud, enemySlot, allySlot, allyHud, orderChip, toolbar, ticker, autoBadge, fx, banner);
    // Registro completo (se abre en un panel lateral con L o pulsando las últimas líneas)
    const logEl = h('div', { class: 'battle-log', 'aria-live': 'polite' });
    const logFilters = h('div', { class: 'log-filters' });
    const logWrap = h('div', { class: 'log-wrap' }, h('div', { class: 'log-title' }, logFilters), logEl);
    const actionsEl = h('div', { class: 'battle-actions' });
    const benchEl = h('div', { class: 'battle-bench' });
    const root = h('div', { class: 'screen battle-screen' }, arena, h('div', { class: 'battle-deck' }, actionsEl, benchEl));
    const ui = {};

    /* ---------- HUD ---------- */
    function buildEnemy(cur) {
      const e = cur || st.enemy, s = DK.daskai.stats(e), sp = D.species[e.species];
      ui.eCur = e;
      ui.eHp = bar({ value: e.cur.hp, max: s.hp, kind: 'hp', icon: 'heart', label: DK.tr('stats', D.stats.hp) });
      ui.eMp = bar({ value: e.cur.mp, max: s.mp, kind: 'mp', icon: 'sparkle', label: DK.tr('stats', D.stats.mp) });
      ui.eStatus = h('span');
      ui.ePhase = h('span', { class: 'phase-tags' });
      ui.intent = h('div', { class: 'intent' });
      // Barra de ruptura (jefes y élites)
      ui.eBreak = st.breakMax ? h('div', { class: 'break-gauge', tip: t('battle.breakTip', { n: Math.round((DK.config.breakGauge.dmg - 1) * 100) }) },
        h('span', { class: 'bg-icon' }, DK.icon('bolt', 12)), h('span', { class: 'bg-track' }, h('span', { class: 'bg-fill' }), h('span', { class: 'bg-preview' })), h('b', { class: 'bg-label' })) : null;
      // Marcas de las fases del jefe sobre su barra de vida
      (st.phases || []).forEach((p) => ui.eHp.querySelector('.bar-track').append(h('i', { class: 'phase-mark', style: { left: p.at * 100 + '%' }, tip: t('phase.name.' + p.type) })));
      enemyHud.replaceChildren(
        h('div', { class: 'hud-title' }, h('b', null, st.boss ? (st.bossInfo || zone.boss).title : DK.daskai.name(e)), V.level(e.level)),
        h('div', { class: 'hud-tags' }, st.boss ? h('span', { class: 'badge leader' }, DK.icon('crown', 13), t('battle.boss')) : null,
          st.wave ? h('span', { class: 'badge wave-badge', tip: t('battle.wave.tip.' + st.wave.kind, { n: st.wave.total }) }, DK.icon(st.wave.kind === 'chain' ? 'swords' : 'swap', 12), t('battle.wave.badge.' + st.wave.kind, { i: Math.min(st.wave.total, st.wave.beaten + 1), n: st.wave.total })) : null, V.housesBadge(e, { known: st.known }), V.roleBadge(e), V.shinyTag(e), ui.eStatus, ui.ePhase),
        ui.eHp, ui.eMp, ui.eBreak, ui.intent);
      updateBreak();
      ui.eSprite = V.dSprite(e, { size: st.boss ? 210 : 180, cls: 'idle grounded alive' + (st.boss && !st.turn && !params._entered ? ' boss-enter' : '') });
      if (st.boss && !st.turn && !params._entered) { params._entered = true; setTimeout(() => DK.audio.sfx('roar'), 650); }
      enemySlot.replaceChildren(ui.eSprite);
    }
    function buildAlly() {
      const a = B().ally(st), s = DK.daskai.stats(a), sp = D.species[a.species];
      ui.aHp = bar({ value: a.cur.hp, max: s.hp, kind: 'hp', icon: 'heart', label: DK.tr('stats', D.stats.hp) });
      ui.aMp = bar({ value: a.cur.mp, max: s.mp, kind: 'mp', icon: 'sparkle', label: DK.tr('stats', D.stats.mp) });
      ui.aExp = bar({ value: a.exp, max: Math.max(1, DK.daskai.expToNext(a)), kind: 'exp', icon: 'star', label: t('common.exp') });
      ui.aStatus = h('span');
      ui.aLevel = h('span', null, V.level(a.level));
      allyHud.replaceChildren(
        h('div', { class: 'hud-title' }, h('b', null, DK.daskai.name(a)), ui.aLevel),
        h('div', { class: 'hud-tags' }, V.housesBadge(a), V.roleBadge(a), V.shinyTag(a), V.tempTag(a), ui.aStatus),
        ui.aHp, ui.aMp, ui.aExp);
      ui.aSprite = V.dSprite(a, { size: 210, flip: true, cls: 'idle grounded alive' });
      allySlot.replaceChildren(ui.aSprite);
      updateStatus();
    }
    /**
     * Línea de tiempo: quién actúa en este turno (según el ataque que
     * señales o, si no, uno normal) y en el siguiente.
     */
    function updateTimeline(moveId) {
      if (st.outcome) { orderChip.replaceChildren(); return; }
      const a = B().ally(st), o = B().turnOrder(st);
      const order = moveId ? B().orderFor(st, moveId) : B().orderFor(st, 'placaje');
      const you = h('span', { class: 'tl-step ally' }, DK.icon('user', 12), DK.daskai.name(a));
      const rival = (x2) => h('span', { class: 'tl-step enemy' }, DK.icon('skull', 12), DK.daskai.name(st.enemy), x2 ? h('em', null, ' ×2') : null);
      const twice = st.frenzy && (st.turn + 1) % 2 === 0;
      const steps = order.first === 'enemy' ? [rival(false), you] : [you, rival(false)];
      if (twice) steps.push(rival(true));
      const nextTwice = st.frenzy && (st.turn + 2) % 2 === 0;
      orderChip.replaceChildren(h('span', { class: 'tl-label' }, t('battle.turnN', { n: st.turn + 1 })), ...steps.flatMap((s, i) => (i ? [h('span', { class: 'tl-arrow' }, '›'), s] : [s])),
        h('span', { class: 'tl-sep' }), h('span', { class: 'tl-next muted' }, t('battle.nextTurn'), nextTwice ? ' ×2' : ''));
      const why = order.by === 'priority' ? t('battle.byPriority') : order.first === 'tie' ? t('battle.orderTie') : t('battle.bySpeed', { a: o.a, e: o.e });
      orderChip.dataset.tip = `${t('battle.orderTip')}\n${why}`;
      orderChip.classList.toggle('tie', order.first === 'tie');
    }

    /** Texto del desglose de daño de un ataque (lo que se ve al pasar por encima). */
    const PART = { power: 'dmgPower', atkdef: 'dmgAtkDef', level: 'dmgLevel', house: 'dmgHouse', bonus: 'dmgBonus', weak: 'dmgWeak', guard: 'dmgGuard', switchIn: 'dmgSwitch', shield: 'dmgShield', burn: 'dmgBurn', weather: 'dmgWeather', stab: 'dmgStab', broken: 'dmgBroken', gear: 'dmgGear' };
    function breakdown(side, mid, est) {
      const f = B().factors(st, side, D.moves[mid], { ignoreHouse: !st.known, hideWeak: side === 'ally' });
      const lines = f.parts.map((p) => `${t('battle.' + PART[p.k])}: ${typeof p.v === 'number' && p.k !== 'power' ? '×' + (Math.round(p.v * 100) / 100) : p.v}`);
      if (!st.known && side === 'ally') lines.push(t('battle.dmgUnknownHouse'));
      if (est) lines.push(`= ${est[0]}-${est[1]} · ${t('battle.dmgCrit', { n: Math.round(f.critP * 100) })}`);
      return lines.join('\n');
    }

    /** Intención del rival: qué hará este turno y cuánto te haría. */
    const INTENT_ICON = { attack: 'sword', heavy: 'swords', heal: 'heart', buff: 'arrowUp', debuff: 'arrowDown', status: 'poison', stunned: 'bolt' };
    function updateIntent() {
      if (!ui.intent) return;
      const it = !st.outcome && B().intentInfo(st);
      ui.intent.className = 'intent' + (it ? ' i-' + it.type : ' hidden');
      if (!it) return ui.intent.replaceChildren();
      if (it.type === 'stunned') {
        ui.intent.dataset.tip = t('intent.stunnedTip', { n: Math.round((DK.config.breakGauge.dmg - 1) * 100) });
        ui.intent.classList.remove('lethal');
        return ui.intent.replaceChildren(h('span', { class: 'intent-icon' }, DK.icon('bolt', 15)),
          h('span', { class: 'intent-text' }, h('small', null, t('intent.label')), h('b', null, t('intent.stunned'))));
      }
      const m = D.moves[it.move];
      const hp = B().ally(st).cur.hp;
      const lethal = it.dmg && it.dmg[0] * (it.twice ? 2 : 1) >= hp;
      ui.intent.dataset.tip = `${m.name} · ${m.desc}${it.acc < 100 ? ` · ${t('move.acc')} ${it.acc}%` : ''}${it.dmg ? '\n' + breakdown('enemy', it.move, it.dmg) : ''}`;
      ui.intent.classList.toggle('lethal', !!lethal);
      ui.intent.replaceChildren(...[
        h('span', { class: 'intent-icon' }, DK.icon(INTENT_ICON[it.type], 15)),
        h('span', { class: 'intent-text' }, h('small', null, t('intent.label')), h('b', null, m.name)),
        it.priority ? h('span', { class: 'prio-tag ' + (it.priority > 0 ? 'fast' : 'slow'), tip: t(it.priority > 0 ? 'battle.prioFastTip' : 'battle.prioSlowTip') }, DK.icon(it.priority > 0 ? 'bolt' : 'clock', 11)) : null,
        h('span', { class: 'intent-val' }, it.dmg ? `≈ ${it.dmg[0]}-${it.dmg[1]}` : t('intent.' + it.type), it.twice ? h('em', null, ' ×2') : null),
        lethal ? h('span', { class: 'intent-warn', tip: t('intent.lethal') }, DK.icon('skull', 14)) : null].filter(Boolean));
    }
    /** Fase del jefe y escudo. */
    function updatePhase() {
      if (!ui.ePhase) return;
      const tags = [];
      st.phases.slice(0, st.phase).forEach((p) => { if (p.type !== 'shield' || st.shield > 0) tags.push(h('span', { class: 'badge phase p-' + p.type, tip: t('phase.desc.' + p.type) }, DK.icon(D.phaseTypes[p.type].icon, 12), t('phase.name.' + p.type), p.type === 'shield' ? ' ' + st.shield : '')); });
      ui.ePhase.replaceChildren(...tags);
    }
    /** Estados alterados y orden de turno. */
    /** Efectos temporales de pasivas «al entrar» (ATQ −15% · 2). */
    const timedTags = (side) => B().timedOf(st, side).map((x) => h('span', { class: 'badge timed ' + (x.pct > 0 ? 'up' : 'down'), tip: t('battle.timedTip', { passive: DK.tr('passives', D.passives[x.src]), n: x.left }) },
      DK.icon(x.pct > 0 ? 'arrowUp' : 'arrowDown', 11), `${D.stats[x.stat].short} ${x.pct > 0 ? '+' : '−'}${Math.round(Math.abs(x.pct) * 100)}%`, h('small', null, x.left)));
    /** v4.88: la música cambia con la tensión: poca vida → latido; jefe herido → furia. */
    function updateMood() {
      if (!st.outcome) {
        DK.audio.music(battleTrack(st, params));
        // v5.4: música dinámica: más tensión cuanto más herido está el jefe o tu daskai
        const a = DK.battle.ally(st), en = st.enemy;
        const mine = a && !DK.daskai.isFainted(a) ? 1 - DK.daskai.hpPct(a) : 0, theirs = (st.boss || st.secret) && en ? 1 - DK.daskai.hpPct(en) : 0;
        DK.audio.intensity(Math.max(mine * 1.1 - 0.2, theirs - 0.15));
      } else DK.audio.intensity(0);
    }
    function updateStatus() {
      updateMood();
      // v5.4: el estado se ve en el propio daskai (escarcha, chispas, «Zzz», ojos tapados…)
      [[ui.aSprite, B().ally(st)], [ui.eSprite, st.enemy]].forEach(([el, d]) => { if (!el) return; [...el.classList].filter((c) => c.startsWith('st-')).forEach((c) => el.classList.remove(c)); if (d && d.status && d.cur.hp > 0) el.classList.add('st-' + d.status); });
      ui.aStatus.replaceChildren(V.statusTag(B().ally(st).status) || '', ...timedTags('ally'));
      ui.eStatus.replaceChildren(V.statusTag(st.enemy.status) || '', ...timedTags('enemy'));
      updatePhase();
      updateTimeline(ui.hoverMove || null);
    }
    /** Barra de ruptura: valor actual, vista previa del ataque señalado y estado «roto». */
    function updateBreak(s, previewGain) {
      if (!ui.eBreak) return;
      const val = s ? s.bVal : st.breakVal, max = s ? s.bMax : st.breakMax, broken = s ? s.broken : st.broken;
      const pct = broken ? 100 : Math.round((val / Math.max(1, max)) * 100);
      ui.eBreak.classList.toggle('is-broken', !!broken);
      ui.eBreak.querySelector('.bg-fill').style.width = pct + '%';
      const pv = !broken && previewGain ? Math.min(100 - pct, Math.round((previewGain / Math.max(1, max)) * 100)) : 0;
      const pvEl = ui.eBreak.querySelector('.bg-preview');
      pvEl.style.left = pct + '%'; pvEl.style.width = pv + '%';
      ui.eBreak.querySelector('.bg-label').textContent = broken ? t('battle.brokenShort') : `${val}/${max}`;
    }
    /** Actualiza barras con la foto de un evento. */
    function applySnap(s) {
      if (!s) return;
      const a = B().ally(st), as = DK.daskai.stats(a), es = DK.daskai.stats(st.enemy);
      if (s.aUid === a.uid) { ui.aHp.update(s.aHp, as.hp); ui.aMp.update(s.aMp, as.mp); }
      // v5.5: en oleadas/relevos la foto puede ser de otro rival (el que está en pantalla manda)
      const shown = ui.eCur || st.enemy;
      if (!s.eUid || s.eUid === shown.uid) { const ss = shown === st.enemy ? es : DK.daskai.stats(shown); ui.eHp.update(s.eHp, ss.hp); ui.eMp.update(s.eMp, ss.mp); }
      updateBreak(s);
      updateStatus();
    }

    /* ---------- Registro ---------- */
    function log(text, kind = '', cat = 'sys') {
      const line = h('div', { class: `log-line ${kind} cat-${cat}` }, V.richLog ? V.richLog(text) : text); // v5.5: ataques, objetos, pasivas y estados resaltados
      if (logFilter !== 'all' && logFilter !== cat) line.classList.add('hidden');
      logEl.append(line);
      logEl.scrollTop = logEl.scrollHeight;
      // Últimas 3 líneas sobre la arena
      const last = [...logEl.querySelectorAll('.log-line:not(.hidden)')].slice(-3).map((l) => { const c = l.cloneNode(true); c.classList.remove('hidden'); c.querySelectorAll('[data-tip]').forEach((x) => { x.removeAttribute('data-tip'); x.removeAttribute('role'); x.removeAttribute('tabindex'); }); return c; });
      ticker.replaceChildren(...last);
    }
    function drawLogFilters() {
      logFilters.replaceChildren(...['all', 'dmg', 'item', 'reward'].map((f) => h('button', {
        class: 'chip chip-toggle' + (logFilter === f ? ' on' : ''), type: 'button',
        onClick: () => { logFilter = f; drawLogFilters(); logEl.querySelectorAll('.log-line').forEach((l) => l.classList.toggle('hidden', f !== 'all' && !l.classList.contains('cat-' + f))); },
      }, t('battle.logFilter.' + f))));
    }
    /** Registro completo en un panel lateral (se sigue actualizando mientras está abierto). */
    function expandLog() {
      logEl.classList.add('expanded');
      DK.ui.drawer({ id: 'battle-log', modal: false, title: t('battle.log'), icon: 'list', content: logWrap });
      setTimeout(() => (logEl.scrollTop = logEl.scrollHeight), 30);
    }

    /* ---------- Efectos ---------- */
    function floatNum(side, text, kind, color) {
      const n = h('span', { class: `float-num ${side} ${kind}`, style: color ? { '--fc': color } : null }, text);
      // v5.4: varios números seguidos no se pisan: cada uno sale un poco desplazado
      const k = (floatNum.k = ((floatNum.k || 0) + 1) % 4);
      n.style.marginLeft = (k - 1.5) * 14 + 'px';
      fx.append(n);
      setTimeout(() => n.remove(), kind === 'crit' ? 1400 : 1100);
    }
    function anim(el, cls, ms) {
      if (!el) return;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), ms);
    }
    const spriteOf = (side) => (side === 'ally' ? ui.aSprite : ui.eSprite);
    let pendingAttack = null;

    /** Reproduce los eventos del motor con animaciones, sonido y texto. */
    async function play(events) {
      for (const e of events) {
        if (stopped) return;
        switch (e.anim) {
          case 'attack':
            anim(spriteOf(e.side), 'atk-' + e.side, 420);
            // v5.4: los ataques mágicos se cargan un instante (brillo del color de su casa)
            if (e.kind === 'magico' && !skipping && D.moves[e.move] && D.moves[e.move].power) { spriteOf(e.side).style.setProperty('--hc', D.houseColor(e.house || 'neutral') || '#e9d5ff'); anim(spriteOf(e.side), 'charge', 420); await wait(240); }
            pendingAttack = e;
            break;
          case 'hit': {
            const att = pendingAttack && !e.dot ? pendingAttack : null;
            if (att && !skipping) await DK.fx.attack(fx, spriteOf(att.side), spriteOf(e.side), { house: e.house, kind: e.kind, crit: e.crit });
            pendingAttack = null;
            // v5.4: impacto con peso: destello blanco, un parón cortito y temblor en los críticos y golpes gordos
            anim(spriteOf(e.side), 'hit', 450);
            if (!e.dot) anim(spriteOf(e.side), 'flash', 160);
            const maxHp = DK.daskai.stats(B().get(st, e.side)).hp || 1, big = e.amount >= maxHp * 0.25;
            if (e.crit) { anim(arena, 'shake', 400); DK.vibrate([40, 30, 60]); } else if (big && !e.dot) anim(arena, 'shake-s', 260);
            DK.audio.sfx(e.crit ? 'crit' : 'hit');
            floatNum(e.side, (e.crit ? '¡' : '') + '-' + e.amount + (e.crit ? '!' : ''), e.dot ? 'dot' : e.crit ? 'crit' : e.eff === 'strong' ? 'strong' : e.eff === 'weak' ? 'weak' : '');
            if (!e.dot && !skipping) await DK.util.sleep((e.crit ? 110 : 60) / speed()); // parón al golpear
            break;
          }
          case 'heal': case 'regen':
            floatNum(e.side, '+' + e.amount, e.mana ? 'mana' : 'heal');
            if (e.anim === 'heal') { DK.fx.heal(fx, spriteOf(e.side)); DK.audio.sfx('heal'); anim(spriteOf(e.side), 'glow', 600); }
            break;
          case 'mana': floatNum(e.side, '+' + e.amount + ' ' + t('common.mpShort'), 'mana'); DK.fx.heal(fx, spriteOf(e.side), '#60a5fa'); DK.audio.sfx('mana'); break;
          case 'buff': anim(spriteOf(e.side), 'buff', 600); DK.audio.sfx('buff'); break;
          case 'debuff': anim(spriteOf(e.side), 'debuff', 600); DK.audio.sfx('debuff'); break;
          case 'status': { // v5.4: cada estado con su color y su nombre flotando
            const S = e.status && D.statuses[e.status];
            DK.audio.sfx('status'); DK.fx.statusBurst(fx, spriteOf(e.side), e.status);
            if (S) floatNum(e.side, DK.tr('statuses', S), 'status', S.color);
            break;
          }
          case 'blocked': { const S = D.statuses[e.status]; anim(spriteOf(e.side), 'blocked', 500); if (S) floatNum(e.side, t('battle.blockedFloat.' + e.status), 'status', S.color); DK.audio.sfx('miss'); break; }
          case 'cured': anim(spriteOf(e.side), 'glow', 600); break;
          case 'miss': floatNum(e.side, t('battle.missFloat'), 'weak'); DK.audio.sfx('miss'); pendingAttack = null; break;
          case 'faint': {
            const sp = spriteOf(e.side);
            // v5.4: el jefe se deshace en partículas a cámara lenta con un destello; los demás caen de lado y se apagan
            if (e.side === 'enemy' && st.boss && !skipping) {
              arena.classList.add('slowmo'); anim(arena, 'boss-flash', 900); DK.audio.sfx('crit'); DK.vibrate([80, 60, 160]);
              sp.classList.add('disintegrate'); DK.fx.disintegrate(fx, sp, e.house || DK.daskai.species(st.enemy).house);
              await DK.util.sleep(1300 / speed()); arena.classList.remove('slowmo');
            } else sp.classList.add('faint');
            DK.audio.sfx('faint'); if (e.side === 'ally') DK.vibrate(200);
            break;
          }
          case 'capture': anim(ui.eSprite, 'capturing', 900); DK.audio.sfx('capture'); break;
          case 'captured': ui.eSprite.classList.add('captured'); DK.audio.sfx('captured'); DK.fx.burst(fx, ui.eSprite, 'luz', 24); break;
          case 'captureFail': DK.audio.sfx('captureFail'); break;
          case 'switch': buildAlly(); anim(ui.aSprite, 'enter', 600); DK.audio.sfx('swap'); break;
          // v5.5: oleadas y relevos: el rival se retira o entra otro sin salir del combate
          case 'enemyOut': ui.eSprite.classList.add('retreat'); DK.audio.sfx('flee'); await wait(420); break;
          case 'enemyIn': { const nx = st.wave && st.wave.all.find((x) => x.uid === e.uid); buildEnemy(nx); anim(ui.eSprite, 'enter-enemy', 700); DK.audio.sfx('swap'); break; }
          case 'flee': DK.audio.sfx('flee'); break;
          case 'broken': anim(ui.eSprite, 'hit', 450); anim(arena, 'shake', 500); DK.audio.sfx('crit'); DK.vibrate([60, 40, 90]); floatNum('enemy', t('battle.breakFloat'), 'strong'); DK.fx.burst(fx, ui.eSprite, 'luz', 18); break;
          case 'stunned': anim(ui.eSprite, 'debuff', 600); floatNum('enemy', t('battle.stunFloat'), 'weak'); break;
          default: break;
        }
        applySnap(e.snap);
        if (e.text) log(e.text, e.kind, e.cat);
        await wait(e.anim === 'regen' ? 120 : e.anim === 'faint' ? 800 : e.anim === 'capture' ? 950 : e.anim === 'attack' ? 200 : e.text ? 620 : 300);
      }
    }

    /* ---------- Barra de herramientas ---------- */
    function drawToolbar() {
      const a = B().ally(st);
      const last = a && st.lastMove && DK.daskai.battleMoves(a).includes(st.lastMove) && B().canUseMove(a, st.lastMove) ? st.lastMove : null;
      const muted = DK.settings.get('muted');
      autoBadge.classList.toggle('hidden', !auto || !!st.outcome);
      arena.classList.toggle('auto-on', auto && !st.outcome);
      toolbar.replaceChildren(...[
        last && !st.outcome ? h('button', { class: 'ctl', type: 'button', disabled: busy, tip: t('battle.repeat', { move: D.moves[last].name }) + ' (R)', onClick: () => act({ type: 'move', moveId: last }) }, DK.icon('repeat', 16)) : null,
        !st.outcome ? h('button', { class: 'ctl auto' + (auto ? ' on' : ''), type: 'button', 'aria-pressed': auto, tip: t('battle.autoTip') + ' (A)', onClick: toggleAuto }, DK.icon('bolt', 16), h('span', null, auto ? t('battle.autoOn') : t('battle.auto'))) : null,
        h('button', { class: 'ctl', type: 'button', tip: t('battle.speedTip') + ' (V)', onClick: cycleSpeed }, DK.icon('gauge', 16), h('span', null, 'x' + speed())),
        h('button', { class: 'ctl', type: 'button', tip: muted ? t('battle.unmute') : t('battle.mute'), onClick: () => { DK.settings.set('muted', !muted); drawToolbar(); } }, DK.icon(muted ? 'volumeOff' : 'volume', 16)),
        h('button', { class: 'ctl', type: 'button', tip: t('battle.stats') + ' (S)', onClick: showStats }, DK.icon('chart', 16)),
        h('button', { class: 'ctl', type: 'button', tip: t('battle.expandLog') + ' (L)', onClick: expandLog }, DK.icon('list', 16))].filter(Boolean));
    }
    function toggleAuto() { if (st.outcome) return; auto = !auto; params.auto = auto; drawToolbar(); if (auto && !busy) autoStep(); else if (!auto && !busy) showMain(); }
    function cycleSpeed() { const n = { 1: 2, 2: 4, 4: 1 }[speed()]; DK.settings.set('battleSpeed', n); drawToolbar(); DK.ui.toast(t('battle.speedSet', { n }), { icon: 'gauge' }); }
    /** Combate automático: elige el mejor ataque tras una pausa. */
    async function autoStep() {
      await wait(450);
      if (!auto || busy || st.outcome || stopped || DK.keys.inModal()) return;
      const a = B().ally(st);
      // Zona crítica: primero su propio ataque de curación (gratis); si no, un objeto de la bolsa
      if (B().autoShouldHeal(st)) {
        const healMove = DK.daskai.battleMoves(a).find((m) => D.moves[m].effect && D.moves[m].effect.type === 'heal' && B().canUseMove(a, m));
        if (healMove) { st.autoHeals = (st.autoHeals || 0) + 1; act({ type: 'move', moveId: healMove }); return; }
        const item = B().autoHealItem(st);
        if (item) { st.autoHeals = (st.autoHeals || 0) + 1; log(t('battle.autoHealed', { name: DK.daskai.name(a), item: D.items[item].name }), 'good', 'item'); act({ type: 'item', itemId: item }); return; }
      }
      // Seguridad: con poca vida el automático se pausa (ajuste «Pausar el automático»)
      st._paused = st._paused || {};
      if (DK.settings.get('autoPause') && DK.daskai.hpPct(a) < 0.3 && !st._paused[a.uid]) {
        st._paused[a.uid] = true; auto = false; params.auto = false; drawToolbar(); showMain();
        DK.audio.sfx('error'); DK.ui.toast(t('battle.autoPaused', { name: DK.daskai.name(a) }), { icon: 'heart', kind: 'bad' });
        return;
      }
      act({ type: 'move', moveId: B().bestMove(st) });
    }

    /* ---------- Menús de acción ---------- */
    /** Registra los atajos del menú actual (quita los anteriores). */
    function bindKeys(map) {
      (ui.offKeys || []).forEach((off) => off());
      ui.offKeys = Object.entries(map).map(([k, fn]) => DK.keys.on(k, fn));
      ui.offKeys.push(DK.keys.on('r', () => { const a = B().ally(st); if (!busy && st.lastMove && DK.daskai.battleMoves(a).includes(st.lastMove) && B().canUseMove(a, st.lastMove)) act({ type: 'move', moveId: st.lastMove }); }));
      ui.offKeys.push(DK.keys.on('a', toggleAuto));
      ui.offKeys.push(DK.keys.on('v', cycleSpeed));
      ui.offKeys.push(DK.keys.on('l', expandLog));
    }

    /**
     * Previsión de un ataque contra el rival actual: rango de daño, % de su
     * vida, eficacia (casa del ataque contra la del rival), misma casa,
     * si remata y cuánto llena la ruptura.
     */
    function preview(mid) {
      const m = D.moves[mid];
      if (!m || !m.power) return null;
      const est = B().estimate(st, mid);
      const hp = st.enemy.cur.hp, maxHp = DK.daskai.stats(st.enemy).hp;
      const a = B().ally(st);
      return {
        est, eff: B().effOf(st, mid), stab: B().isStab(a, m),
        pct: [DK.util.percent(est[0], maxHp), DK.util.percent(est[1], maxHp)],
        ko: est[0] >= hp ? 'sure' : est[1] >= hp ? 'maybe' : null,
        brk: B().breakGain(st, m), acc: m.acc,
      };
    }

    /** Botón grande de ataque (color de su casa, coste, daño previsto con % y eficacia). */
    function moveButton(a, mid, i, _eff, go, can) {
      const m = D.moves[mid];
      const pv = preview(mid);
      const est = pv && pv.est;
      const eff = pv ? pv.eff : null;
      const color = D.houseColor(B().moveHouse(a, m));
      const cost = B().mpCost(a, mid);
      const pr = B().priority(mid);
      const first = B().orderFor(st, mid).first;
      const knownWeak = m.power > 0 && B().weakKnown(st.enemy.species) && B().weakness(st.enemy.species) === m.kind;
      // --- v4.40: botón por capas (nombre y orden · eficacia · daño · datos) ---
      const hm = pv && m.power ? B().houseMult(B().moveHouse(a, m), DK.daskai.houses(st.enemy)).mult : 1;
      const fmtX = (x) => '×' + (+x.toFixed(2)).toLocaleString(DK.i18n.lang);
      // Franja de eficacia: lo primero que se lee después del nombre
      const effStrip = !m.power ? h('span', { class: 'bm-eff sup' }, DK.icon('sparkle', 12), h('span', null, m.effect ? V.effectText(m) : t('move.support')))
        : !st.known ? h('span', { class: 'bm-eff unk', tip: t('battle.effUnknownTip') }, DK.icon('question', 12), h('span', null, t('battle.effUnknown')))
          : h('span', { class: 'bm-eff ' + (eff || 'normal'), tip: t('battle.effTip', { x: fmtX(hm) }) },
            DK.icon(eff === 'strong' ? 'arrowUp' : eff === 'weak' ? 'arrowDown' : 'minus', 12),
            h('b', null, eff === 'strong' ? t('battle.effStrong') : eff === 'weak' ? t('battle.effWeak') : t('battle.effNormal1')),
            h('span', { class: 'bm-x' }, fmtX(hm)),
            knownWeak ? h('span', { class: 'bm-weak', tip: t('battle.weakTip') }, DK.icon('target', 11), t('battle.weakShort')) : null);
      const orderEl = h('span', { class: 'bm-order ' + first + (pr ? (pr > 0 ? ' fast' : ' slow') : ''), tip: [first === 'ally' ? t('battle.goFirst') : first === 'enemy' ? t('battle.goSecond') : t('battle.orderTie'), pr ? t(pr > 0 ? 'battle.prioFastTip' : 'battle.prioSlowTip') : null].filter(Boolean).join(' · ') },
        pr ? DK.icon(pr > 0 ? 'bolt' : 'clock', 11) : null, first === 'ally' ? '1º' : first === 'enemy' ? '2º' : '=');
      const tags = pv ? [
        pv.stab ? h('span', { class: 'bm-chip stab', tip: t('battle.stabTip', { n: Math.round((DK.config.stab - 1) * 100) }) }, DK.icon(D.houses[m.house].icon, 11), t('battle.stabShort')) : null,
        pv.brk ? h('span', { class: 'bm-chip brk', tip: t('battle.breakGainTip', { n: pv.brk }) }, DK.icon('bolt', 11), '+' + pv.brk) : null,
      ].filter(Boolean) : [];
      const b = h('button', {
        class: 'bmove v2' + (can ? '' : ' disabled') + (m.power && eff ? ' eff-' + eff : '') + (knownWeak ? ' eff-weakspot' : '') + (pv && pv.ko === 'sure' ? ' is-ko' : ''), type: 'button', disabled: !can, style: { '--mc': color },
        tip: can ? [m.desc || '', est ? breakdown('ally', mid, est) : null].filter(Boolean).join('\n') : t('battle.noMana'),
        onClick: go,
      },
        h('div', { class: 'bm-head' },
          h('span', { class: 'bmove-icon' }, DK.icon(m.kind === 'fisico' ? 'sword' : 'wand', 16)),
          h('b', { class: 'bmove-name' }, m.name),
          orderEl,
          h('kbd', { class: 'hotkey' }, i + 1)),
        effStrip,
        est ? h('div', { class: 'bm-dmg' },
          h('b', null, `${est[0]}-${est[1]}`),
          h('span', { class: 'bm-pct' }, `${pv.pct[0] === pv.pct[1] ? pv.pct[1] : pv.pct[0] + '-' + pv.pct[1]}%`),
          pv.ko ? h('span', { class: 'bm-ko ' + pv.ko, tip: pv.ko === 'sure' ? t('battle.koSureTip') : t('battle.koMaybeTip') }, DK.icon('skull', 11), pv.ko === 'sure' ? t('battle.koSure') : t('battle.koMaybe')) : null) : null,
        h('div', { class: 'bm-foot' },
          h('span', { class: 'bm-cost' + (cost ? '' : ' free') }, DK.icon('sparkle', 11), cost ? `${cost}` : t('move.free')),
          m.power ? h('span', { class: 'bm-stat', tip: t('move.power', { n: m.power }) }, DK.icon('swords', 11), m.power) : null,
          m.acc < 100 ? h('span', { class: 'bm-stat', tip: t('move.accTip') }, DK.icon('eye', 11), m.acc + '%') : null,
          tags));
      const on = () => { ui.eHp.preview(est ? st.enemy.cur.hp : null, Math.max(0, st.enemy.cur.hp - (est ? est[1] : 0))); updateBreak(null, pv && pv.brk); ui.hoverMove = mid; updateTimeline(mid); };
      const off = () => { ui.eHp.preview(null); updateBreak(); ui.hoverMove = null; updateTimeline(null); };
      b.addEventListener('mouseenter', on);
      b.addEventListener('mouseleave', off);
      b.addEventListener('focus', on);
      b.addEventListener('blur', off);
      return b;
    }

    /**
     * Informe del rival: ventaja o desventaja de un daskai tuyo contra el
     * rival actual (sólo si ya conoces su casa).
     * @returns {{cls:'good'|'bad'|'even'|'unknown', text}}
     */
    function matchup(d) {
      if (!st.known) return { cls: 'unknown', text: t('battle.mUnknown') };
      // v4.71: con doble casa cuenta lo mejor de cada uno
      const atk = B().bestHouseMult(d, st.enemy).eff;   // mi ataque contra él
      const def = B().bestHouseMult(st.enemy, d).eff;   // su ataque contra mí
      if (atk === 'strong' || def === 'weak') return { cls: 'good', text: t('battle.mGood') };
      if (def === 'strong' || atk === 'weak') return { cls: 'bad', text: t('battle.mBad') };
      return { cls: 'even', text: t('battle.mEven') };
    }

    /** Banquillo: el resto del equipo con su vida y su ventaja contra el rival (pulsar = cambiar, gasta el turno). */
    function renderBench(canSwitch) {
      const a = B().ally(st);
      const team = DK.party.active();
      benchEl.replaceChildren(
        h('div', { class: 'bench-head' }, DK.icon('users', 14), h('span', null, t('battle.bench'))),
        h('div', { class: 'bench-list' }, team.map((d) => {
          const cur = a && d.uid === a.uid;
          const fainted = DK.daskai.isFainted(d);
          const s = DK.daskai.stats(d);
          const pct = DK.util.percent(d.cur.hp, s.hp);
          const mu = matchup(d);
          // Si entrase ahora: cuánto le haría la intención del rival (con el colchón del cambio)
          const iv = !cur && !fainted ? B().intentVs(st, d) : null;
          const ivPct = iv ? Math.round((iv[1] / s.hp) * 100) : null;
          const el = h('button', { class: 'bench-item' + (cur ? ' current' : '') + (fainted ? ' fainted' : ''), type: 'button',
            disabled: !canSwitch || cur || fainted || busy, tip: `${cur ? t('battle.inBattle') : fainted ? t('common.fainted') : t('battle.switchTo', { name: DK.daskai.name(d) })} · ${mu.text}${iv ? '\n' + t('battle.ifSwitch', { a: iv[0], b: iv[1], n: Math.round((1 - DK.config.switchMult) * 100) }) : ''}`,
            onClick: () => act({ type: 'switch', uid: d.uid }) },
          V.dSprite(d, { size: 38 }),
          h('span', { class: 'bench-info' }, h('span', { class: 'bench-name' }, h('b', null, DK.daskai.name(d)), h('span', { class: 'mu mu-' + mu.cls }, DK.icon(mu.cls === 'good' ? 'arrowUp' : mu.cls === 'bad' ? 'arrowDown' : mu.cls === 'even' ? 'minus' : 'question', 11))),
            h('span', { class: 'mini-bar hp' + (pct < 25 ? ' low' : pct < 50 ? ' mid' : '') }, h('span', { style: { width: pct + '%' } })),
            iv ? h('span', { class: 'bench-iv' + (iv[1] >= d.cur.hp ? ' lethal' : ivPct >= 35 ? ' high' : '') }, DK.icon('shield', 10), `-${iv[0]}-${iv[1]}`) : null),
          cur ? DK.icon('swords', 14) : fainted ? DK.icon('skull', 14) : null);
          return el;
        })));
    }

    /**
     * Panel principal: los 4 ataques en grande (1-4) y al lado las acciones
     * Bolsa (B), Cambiar (C), Huir (F) y Estadísticas (S).
     */
    function showMain() {
      drawToolbar();
      updateIntent();
      const a = B().ally(st);
      const eff = null; // la eficacia ahora es de cada ataque (su casa contra la del rival)
      const flee = Math.round(B().fleeChance(st) * 100);
      const others = DK.party.aliveActive().filter((d) => d.uid !== a.uid);
      const fleeDesc = st.boss ? t('battle.fleeBoss') : flee >= 100 ? t('battle.fleeSure') : flee <= 0 ? t('battle.fleeNever') : t('battle.fleeChance', { n: flee });
      const keys = { b: showBag, c: () => others.length && showSwitch(), f: () => flee > 0 && doFlee(), d: () => act({ type: 'guard' }), s: showStats };
      // Sus ataques + los que dan los objetos equipados (marcados con un icono de gema)
      const granted = DK.daskai.grantedMoves(a);
      const moves = DK.daskai.battleMoves(a).map((mid, i) => {
        const can = B().canUseMove(a, mid);
        const go = () => { ui.eHp.preview(null); act({ type: 'move', moveId: mid }); };
        if (can) keys[String(i + 1)] = go;
        const b = moveButton(a, mid, i, eff, go, can);
        if (granted.includes(mid)) { b.classList.add('granted'); b.querySelector('.bmove-top').append(h('span', { class: 'bmove-gem', tip: t('craft.grantedMove') }, DK.icon('gem', 12))); }
        return b;
      });
      if (!B().hasUsableMove(a)) {
        const go = () => act({ type: 'move', moveId: 'forcejeo' });
        moves.push(moveButton(a, 'forcejeo', moves.length, null, go, true));
        keys[moves.length] = go;
      }
      const side = (icon, label, hk, tip, onClick, disabled) => h('button', { class: 'bact', type: 'button', disabled, tip, onClick },
        DK.icon(icon, 18), h('span', null, label), h('kbd', { class: 'hotkey' }, hk));
      actionsEl.replaceChildren(h('div', { class: 'deck-main' + (auto ? ' is-auto' : '') },
        h('div', { class: 'deck-moves' }, moves),
        h('div', { class: 'deck-side' },
          side('shield', t('battle.guard'), 'D', t('battle.guardDesc', { n: Math.round((1 - DK.config.guardMult) * 100) }), () => act({ type: 'guard' }), false),
          side('bag', t('battle.bag'), 'B', t('battle.bagDesc'), showBag, false),
          side('swap', t('battle.switch'), 'C', others.length ? t('battle.switchDesc') : t('battle.switchNone'), showSwitch, !others.length),
          side('flee', t('battle.flee'), 'F', st.expedition && DK.curses.effect('noFlee') ? t('curse.noFleeMsg') : fleeDesc, doFlee, flee <= 0)),
        auto ? h('div', { class: 'deck-auto' }, DK.icon('bolt', 16), h('span', null, t('battle.autoDeck')),
          btn({ icon: 'hand', label: t('battle.takeControl'), size: 'sm', variant: 'primary', hotkey: 'A', onClick: toggleAuto })) : null));
      renderBench(others.length > 0);
      bindKeys(keys);
      if (auto) autoStep();
    }

    async function doFlee() {
      if (DK.settings.get('confirmFlee') && !(await DK.ui.confirm(t('battle.fleeQ'), t('battle.fleeChance', { n: Math.round(B().fleeChance(st) * 100) }), { okLabel: t('battle.flee'), okIcon: 'flee' }))) return;
      act({ type: 'flee' });
    }

    const backBtn = () => btn({ icon: 'back', label: t('battle.toMoves'), variant: 'ghost', hotkey: 'Esc', onClick: showMain });

    function showBag() {
      const a = B().ally(st);
      // (sin vínculo en combate, los cristales no salen en la bolsa del combate)
      const items = DK.bag.list('batalla').filter(({ item }) => !(item.use && item.use.capture && !DK.config.captureEnabled));
      const keys = { Escape: showMain, Backspace: showMain, b: showMain };
      actionsEl.replaceChildren(h('div', { class: 'sub-panel' },
        h('div', { class: 'sub-head' }, backBtn(), h('span', { class: 'muted small' }, t('battle.itemTurn'))),
        items.length ? h('div', { class: 'item-grid battle-items' }, items.map(({ item, qty }, i) => {
          const why = item.use.capture ? B().cannotCapture(st) : DK.bag.cannotUse(item.id, a, { inBattle: true });
          const note = item.use.capture && !why ? t('battle.captureProb', { n: Math.round(B().captureChance(st, item) * 100) }) : why || V.useText(item);
          const go = () => act({ type: 'item', itemId: item.id });
          if (!why && i < 9) keys[String(i + 1)] = go;
          const c = V.itemCard(item.id, qty, { note, onClick: why ? null : go, extra: !why && i < 9 ? h('kbd', { class: 'hotkey' }, i + 1) : null });
          if (why) c.disabled = true;
          return c;
        })) : DK.ui.empty('bag', t('battle.bagEmpty'), t('battle.bagEmptyText'))));
      bindKeys(keys);
    }

    /**
     * Elegir daskai en el propio panel (sin ventana).
     * @param {boolean} forced  true si el actual se ha debilitado (no se puede volver)
     * @returns {Promise<string>} uid elegido (o null si se vuelve atrás)
     */
    function chooseInline(forced) {
      return new Promise((resolve) => {
        const a = B().ally(st);
        const list = DK.party.aliveActive().filter((d) => forced || d.uid !== a.uid);
        // En automático, sale solo el que tenga más vida
        if (forced && auto && list.length) { const best = list.slice().sort((x, y) => DK.daskai.hpPct(y) - DK.daskai.hpPct(x))[0]; setTimeout(() => resolve(best.uid), 300); return; }
        const keys = forced ? {} : { Escape: () => { showMain(); resolve(null); }, c: () => { showMain(); resolve(null); } };
        actionsEl.replaceChildren(h('div', { class: 'sub-panel' },
          h('div', { class: 'sub-head' }, forced ? h('b', null, DK.icon('skull', 16), ' ', t('battle.nextTitle')) : backBtn(), h('span', { class: 'muted small' }, forced ? t('battle.nextNote') : t('battle.switchNote'))),
          h('div', { class: 'list switch-list' }, list.map((d, i) => {
            const pick = () => resolve(d.uid);
            if (i < 9) keys[String(i + 1)] = pick;
            return V.daskaiRow(d, { compact: true, actions: btn({ icon: 'swap', label: t('battle.sendOut'), size: 'sm', variant: 'primary', hotkey: i < 9 ? String(i + 1) : null, onClick: pick }) });
          }))));
        bindKeys(keys);
      });
    }
    async function showSwitch() {
      const uid = await chooseInline(false);
      if (uid) act({ type: 'switch', uid });
    }

    /**
     * Estadísticas del combate en un panel lateral que no tapa la arena (S).
     * Comparativa tú / rival, intención, fases del jefe, pactos y ataques vistos.
     */
    function showStats() {
      const a = B().ally(st), e = st.enemy;
      const asp = D.species[a.species], esp = D.species[e.species];
      // Información progresiva: casa (1 combate), ataques (revealMovesAt) y atributos (revealStatsAt)
      const know = B().knowledge(st), C = DK.config;
      const known = know >= C.revealStatsAt;
      const knowMoves = know >= C.revealMovesAt;
      const as = DK.daskai.stats(a), es = DK.daskai.stats(e);
      const KEYS = ['atk', 'matk', 'def', 'mdef', 'spd'];
      const weak = B().weakness(e.species), weakKnown = B().weakKnown(e.species);
      const step = (ok, icon, label) => h('div', { class: 'bs-know' + (ok ? ' ok' : '') }, DK.icon(ok ? 'check' : icon, 13), h('span', null, label));
      const knowledge = h('div', { class: 'bs-knowledge' },
        step(st.known, 'question', t('battle.know.house')),
        step(knowMoves, 'swords', t('battle.know.moves', { n: C.revealMovesAt })),
        step(known, 'chart', t('battle.know.stats', { n: C.revealStatsAt })),
        step(weakKnown, 'target', weakKnown ? t('battle.know.weakIs', { kind: weak === 'fisico' ? t('common.physical') : t('common.magical') }) : weak ? t('battle.know.weak') : t('battle.know.noWeak')));

      /** Cabecera de un combatiente: retrato, nombre, nivel, casa, estado y barras. */
      const fighterCard = (d, side) => {
        const s = side === 'ally' ? as : es, sp = side === 'ally' ? asp : esp;
        return h('div', { class: 'bs-fighter ' + side },
          h('div', { class: 'bs-portrait' }, V.sprite(d.species, { look: DK.looks.of(d), size: 52, flip: side === 'ally', shiny: d.shiny })),
          h('div', { class: 'bs-who' },
            h('b', { class: 'bs-name' }, side === 'ally' || !st.boss ? DK.daskai.name(d) : (st.bossInfo || zone.boss).title),
            h('div', { class: 'bs-tags' }, V.level(d.level), V.housesBadge(d, { known: side === 'ally' || st.known }), V.statusTag(d.status)),
            bar({ value: d.cur.hp, max: s.hp, kind: 'hp', icon: 'heart' }),
            bar({ value: d.cur.mp, max: s.mp, kind: 'mp', icon: 'sparkle' })));
      };
      const stage = (side, k) => { const v = st.stages[side][k] || 0; return v ? h('span', { class: 'bs-stage ' + (v > 0 ? 'up' : 'down') }, (v > 0 ? '+' : '') + v) : null; };
      // Tabla comparativa: tu valor · barra doble · el del rival (oculto si no lo conoces)
      const rows = KEYS.map((k) => {
        const av = Math.round(B().stat(st, 'ally', k)), ev2 = Math.round(B().stat(st, 'enemy', k));
        const tot = Math.max(1, av + (known ? ev2 : av));
        const win = !known ? '' : av > ev2 ? ' ally-wins' : ev2 > av ? ' enemy-wins' : '';
        return h('div', { class: 'bs-row' + win },
          h('span', { class: 'bs-val ally' }, stage('ally', k), h('b', null, av)),
          h('div', { class: 'bs-mid' },
            h('span', { class: 'bs-label' }, DK.icon(D.stats[k].icon, 13), DK.tr('stats', D.stats[k])),
            h('div', { class: 'bs-bars' }, h('i', { class: 'a', style: { width: (av / tot) * 100 + '%' } }), h('i', { class: 'e' + (known ? '' : ' unknown'), style: { width: known ? (ev2 / tot) * 100 + '%' : '50%' } }))),
          h('span', { class: 'bs-val enemy' }, h('b', null, known ? ev2 : '?'), known ? stage('enemy', k) : null));
      });
      // Eficacia en los dos sentidos
      const effName = (eff) => (eff === 'strong' ? t('battle.effStrong') : eff === 'weak' ? t('battle.effWeak') : t('battle.effNormal'));
      const hk = st.known;
      const mine = hk ? B().bestHouseMult(a, e).eff : null;
      const theirs = hk ? B().bestHouseMult(e, a).eff : null;
      const matchup = h('div', { class: 'bs-matchup' },
        h('div', { class: 'bs-eff ' + (mine || 'normal') }, h('small', null, t('battle.yourHits')), h('b', null, hk ? effName(mine) : '?')),
        h('div', { class: 'bs-eff ' + (theirs === 'strong' ? 'weak' : theirs === 'weak' ? 'strong' : 'normal') }, h('small', null, t('battle.theirHits')), h('b', null, hk ? effName(theirs) : '?')));

      const section = (icon, title, ...body) => h('section', { class: 'bs-section' }, h('h4', null, DK.icon(icon, 15), title), ...body);
      const it = B().intentInfo(st);
      const cz = DK.codex.getEntry(st.zoneId, e.species);
      const curses = st.expedition ? DK.curses.active() : [];

      DK.ui.drawer({
        id: 'battle-stats', modal: false, title: t('battle.statsTitle'), icon: 'chart', size: 'wide',
        content: h('div', { class: 'bstats' },
          h('div', { class: 'bs-versus' }, fighterCard(a, 'ally'), h('span', { class: 'bs-vs' }, 'VS'), fighterCard(e, 'enemy')),
          section('eye', t('battle.knowTitle', { n: know }), knowledge),
          section('scale', t('battle.compare'), h('div', { class: 'bs-head' }, h('span', null, t('battle.you')), h('span', null, t('battle.rival'))), h('div', { class: 'bs-table' }, rows),
            !known ? h('p', { class: 'muted small' }, DK.icon('question', 13), ' ', t('battle.statsLocked', { n: Math.max(0, C.revealStatsAt - know) })) : null),
          section('target', t('battle.matchup'), matchup),
          it ? section('eye', t('intent.label'), h('div', { class: 'bs-intent i-' + it.type },
            h('b', null, D.moves[it.move].name), h('span', { class: 'muted small' }, D.moves[it.move].desc),
            h('span', { class: 'chip' }, it.dmg ? `≈ ${it.dmg[0]}-${it.dmg[1]} ${t('battle.dmgTo', { name: DK.daskai.name(a) })}` : t('intent.' + it.type), it.twice ? ' ×2' : ''))) : null,
          st.boss && st.phases.length ? section('crown', t('phase.title'), h('div', { class: 'list' }, st.phases.map((p, i) => h('div', { class: 'bs-phase' + (i < st.phase ? ' done' : '') },
            h('span', { class: 'bs-phase-at' }, Math.round(p.at * 100) + '%'), DK.icon(D.phaseTypes[p.type].icon, 15),
            h('div', { class: 'grow' }, h('b', null, t('phase.name.' + p.type)), h('div', { class: 'muted small' }, t('phase.desc.' + p.type))),
            i < st.phase ? h('span', { class: 'badge warn' }, t('phase.active')) : null)))) : null,
          curses.length ? section('skull', t('curse.active'), h('div', { class: 'chips' }, curses.map((id) => h('span', { class: 'chip neg', tip: t('curse.' + id + '.desc') }, DK.icon(D.curses[id].icon, 13), t('curse.' + id + '.name'))))) : null,
          section('swords', t('battle.knownMoves'), knowMoves && cz && cz.moves.length
            ? h('div', { class: 'chips' }, cz.moves.map((m) => h('span', { class: 'chip', tip: D.moves[m].desc }, DK.icon(D.moves[m].kind === 'fisico' ? 'sword' : 'wand', 13), D.moves[m].name, D.moves[m].power ? h('span', { class: 'muted' }, ' ' + D.moves[m].power) : null)))
            : h('p', { class: 'muted small' }, knowMoves ? t('codex.noMoves') : t('battle.movesLocked', { n: Math.max(0, C.revealMovesAt - know) }))),
          section('sparkles', DK.daskai.name(a), h('div', { class: 'chips' },
            ...DK.daskai.passives(a).map((pid) => h('span', { class: 'chip', tip: DK.tr('passives', D.passives[pid], 'desc') }, DK.icon('sparkles', 13), DK.tr('passives', D.passives[pid]))),
            h('span', { class: 'chip', tip: DK.tr('natures', D.natures[a.nature], 'desc') }, DK.icon('leaf', 13), DK.tr('natures', D.natures[a.nature])),
            h('span', { class: 'chip' }, DK.icon('regen', 13), `${t('stats.regenShort')} ${as.regen}%`)))),
      });
    }

    /* ---------- Flujo del turno ---------- */
    async function act(action) {
      if (busy || st.outcome) return;
      busy = true;
      bindKeys({ Space: () => { skipping = true; } });
      actionsEl.replaceChildren(h('div', { class: 'waiting' }, DK.icon('swords', 18), h('span', null, t('battle.resolving')), h('kbd', { class: 'hotkey' }, t('battle.spaceSkip'))));
      drawToolbar(); renderBench(false);
      ui.intent.classList.add('resolving');
      const events = B().turn(st, action);
      await play(events);
      skipping = false;
      ui.intent.classList.remove('resolving');
      await afterTurn();
    }

    async function afterTurn() {
      if (stopped) return;
      if (st.outcome === 'won' || st.outcome === 'captured') return victory();
      if (st.outcome === 'fled' || st.outcome === 'lost') { B().finish(st); return end(st.outcome); }
      if (st.needSwitch) {
        if (st.expedition && DK.rules.permadeath()) { log(t(DK.expedition.revivesLeft() || DK.expedition.active().blessed ? 'battle.fallenMaybe' : 'battle.willDie', { name: DK.daskai.name(B().ally(st)) }), 'bad'); DK.vibrate && DK.vibrate([120, 60, 120]); }
        const uid = await chooseInline(true);
        await play(B().switchTo(st, uid));
      }
      busy = false;
      showMain();
    }

    /** Recompensas, subida de nivel, evolución y botín. */
    async function victory() {
      const a = B().ally(st);
      const r = B().rewards(st);
      DK.audio.sfx('win');
      DK.fx.confetti(fx, st.boss ? 60 : 24);
      log(t('battle.gainExp', { name: DK.daskai.name(a), n: r.exp }), 'good', 'reward');
      log(r.toLoot ? t('battle.coinsLoot', { n: r.coins }) : t('battle.coins', { n: r.coins }), 'drop', 'reward');
      ui.aExp.update(a.exp, Math.max(1, DK.daskai.expToNext(a)));
      const L = r.levelInfo;
      if (L.levels.length) {
        ui.aLevel.replaceChildren(V.level(a.level));
        const s = DK.daskai.stats(a); ui.aHp.update(a.cur.hp, s.hp); ui.aMp.update(a.cur.mp, s.mp);
        log(t('battle.levelUp', { name: DK.daskai.name(a), n: a.level }), 'level', 'reward');
        await V.levelUpDialog(a, L);
      }
      for (const m of L.pending) {
        const learned = await V.learnMovePrompt(a, m);
        log(learned ? t('battle.learned', { name: DK.daskai.name(a), move: D.moves[m].name }) : t('battle.toReserve', { move: D.moves[m].name }), learned ? 'level' : 'muted', 'reward');
      }
      if (L.evolveReady && (await V.evolveDialog(a))) { buildAlly(); log(t('battle.evolved', { name: DK.daskai.name(a) }), 'level', 'reward'); }
      if (r.captured) log(t('battle.joined', { name: DK.daskai.name(st.enemy), team: DK.party.isActive(st.enemy.uid) ? t('battle.joinedTeam') : '' }), 'good', 'reward');
      if (r.temp) log(t('exp.tempNote', { name: DK.daskai.name(st.enemy) }), 'warn', 'reward');
      for (const id of r.drops) { if (r.gear && DK.gear.isGear(id)) continue; await wait(200); log((r.toLoot && !(r.toBag || []).includes(id) ? t('battle.lootItem') : t('battle.gotItem')) + ' ' + D.items[id].name, 'drop', 'reward'); }
      for (const id of r.runes || []) { await wait(200); log(t('rune.got', { name: V.runeName(id) }) + ' · ' + V.runeTip(id).split(' · ').slice(1).join(' · '), 'level', 'reward'); DK.ui.toast(t('rune.got', { name: V.runeName(id) }), { icon: 'rune', kind: 'good' }); }
      (r.shared || []).forEach((x) => {
        log(t('battle.sharedExp', { name: x.name, n: x.exp }), 'muted', 'reward');
        if (x.to > x.from) log(t('battle.levelUp', { name: x.name, n: x.to }), 'level', 'reward');
      });
      // v4.59: los del banquillo que suben de nivel salen en tarjetitas que se van solas
      V.levelFeed((r.shared || []).filter((x) => x.to > x.from));
      if (r.winHeal) { log(t('relics.winHealLog', { n: Math.round(r.winHeal * 100) }), 'good', 'reward'); const s2 = DK.daskai.stats(a); ui.aHp.update(a.cur.hp, s2.hp); }
      if (st.elite && st.expedition && DK.expedition.active() && DK.expedition.active().relicChoice) log(t('relics.eliteLog'), 'level', 'reward');
      for (const p of r.gear || []) { await wait(200); log(t('battle.lootItem') + ' ' + DK.gear.name(p) + ' (' + t('gear.rarity.' + p.rarity) + ')', 'drop', 'reward'); }
      if (!r.captured && !r.drops.length && !(r.runes || []).length) log(t('battle.noDrop'), 'muted', 'reward');
      if (r.freeUnlocked) { log(t('battle.freeUnlocked', { zone: zone.name }), 'level', 'reward'); DK.ui.toast(t('battle.freeUnlocked', { zone: zone.name }), { icon: 'swords', kind: 'good' }); }
      if (r.emblems) { log(t('battle.emblemLog', { n: r.emblems }), 'level', 'reward'); DK.ui.toast(t('battle.emblemLog', { n: r.emblems }), { icon: 'emblem', kind: 'good' }); }
      if (r.secretUnlocked) { log(t('battle.secretUnlocked', { title: st.bossInfo.title, zone: zone.name }), 'level', 'reward'); DK.ui.toast(t('battle.secretUnlocked', { title: st.bossInfo.title, zone: zone.name }), { icon: 'cave', kind: 'good' }); }
      if (r.unlocked) { log(t('battle.zoneUnlocked', { zone: r.unlocked.name }), 'level', 'reward'); DK.ui.toast(t('battle.zoneUnlocked', { zone: r.unlocked.name }), { icon: 'map', kind: 'good' }); }
      // v5.18: legendario vencido: la 1.ª vez sólo se le vence; desde la 2.ª puede querer unirse (y tú decides)
      if (r.legend) {
        const nm = D.species[r.legend.species].name;
        log(t('legend.beaten', { name: nm, n: r.legend.n }), 'level', 'reward');
        if (r.legend.offer) {
          DK.audio.sfx('legend');
          const ok = await DK.ui.confirm(t('legend.offerQ', { name: nm }), t('legend.offerText', { name: nm, lv: r.legend.level }), { okLabel: t('legend.accept'), okIcon: 'crown', icon: 'crown' });
          if (ok) { const d = DK.legends.join(r.legend.species, r.legend.level); log(t('legend.joined', { name: DK.daskai.name(d) }), 'level', 'reward'); DK.ui.toast(t('legend.joined', { name: DK.daskai.name(d) }), { icon: 'crown', kind: 'good' }); }
        } else if (r.legend.n === 1) log(t('legend.firstTime', { name: nm }), 'muted', 'reward');
      }
      DK.crafting.newlyReadyFavorites().forEach((rc) => DK.ui.toast(t('bag.favReady', { item: D.items[rc.result].name }), { icon: 'star', kind: 'good' }));
      B().finish(st);
      // Jefe del mapa derrotado: se decide si continuar o terminar (panel final)
      if (st.expedition && DK.expedition.active()) { DK.expedition.completeNode(); if (st.boss && st.final !== false) DK.expedition.bossCleared(); }
      end(st.outcome, r);
    }

    /**
     * Botín del panel final (v4.60): experiencia y monedas en dos casillas grandes y cada objeto,
     * runa, reliquia o emblema en su tarjetita con icono y color de rareza (entran una a una).
     */
    function rewardsView(r) {
      let k = 0; const dl = () => ({ animationDelay: (0.15 + k++ * 0.09).toFixed(2) + 's' });
      // v5.4: las cifras grandes (experiencia, monedas) corren desde 0
      const big = (icon, n, label, cls) => {
        const m = /^\+(\d+)$/.exec(String(n)), b = h('b', null, m ? '+0' : n);
        if (m) setTimeout(() => DK.util.countTo(b, 0, +m[1], 900, (x) => '+' + Math.round(x).toLocaleString(DK.i18n.lang)), 250);
        return h('div', { class: 'rw-big ' + cls, style: dl() }, h('span', { class: 'rw-big-ico' }, DK.icon(icon, 22)), b, h('small', null, label));
      };
      const counts = {}; r.drops.forEach((id) => { if (!(r.gear && DK.gear.isGear(id))) counts[id] = (counts[id] || 0) + 1; });
      const items = [
        ...Object.entries(counts).map(([id, n]) => { const it = D.items[id]; return h('div', Object.assign({ style: dl(), tip: it.name }, V.infoProps('item', id), { class: 'rw-item has-info r-' + it.rarity }),
          h('span', { class: 'rw-item-ico' }, V.itemIcon ? V.itemIcon(it, 30) : DK.icon(it.icon, 26), n > 1 ? h('span', { class: 'rw-n' }, '×' + n) : null), h('span', { class: 'rw-item-name' }, it.name),
          r.toLoot && !(r.toBag || []).includes(id) ? h('small', { class: 'rw-dest' }, DK.icon('gift', 10), t('exp.destLoot')) : null); }),
        // v4.74: piezas de equipo con el color de su rareza
        ...(r.gear || []).map((p) => h('div', Object.assign({ style: Object.assign(dl(), { '--g': D.gear.rarities[p.rarity].color }), tip: t('gear.rarity.' + p.rarity) }, V.infoProps('gear', p), { class: 'rw-item has-info gear g-' + p.rarity }),
          h('span', { class: 'rw-item-ico' }, V.gearIcon(p, 30)), h('span', { class: 'rw-item-name' }, DK.gear.name(p)), h('small', { class: 'rw-dest' }, t('gear.rarity.' + p.rarity)))),
        ...(r.runes || []).map((id) => h('div', Object.assign({ style: dl(), tip: V.runeTip(id) }, V.infoProps('rune', id), { class: 'rw-item has-info rune ' + V.runeRarity(id) }), h('span', { class: 'rw-item-ico' }, V.runeGem(id, 30)), h('span', { class: 'rw-item-name' }, V.runeName(id)))),
        r.relicOffer ? h('div', { class: 'rw-item relic', style: dl() }, h('span', { class: 'rw-item-ico' }, DK.icon('amulet', 26)), h('span', { class: 'rw-item-name' }, t('relics.toChoose'))) : null,
      ].filter(Boolean);
      // v5.4: botín legendario → haz dorado y sonido propio
      if ((r.gear || []).some((p) => p.rarity === 'legendario') || r.drops.some((id) => D.items[id] && D.items[id].rarity === 'legendario')) setTimeout(() => DK.audio.sfx('legend'), 450);
      return h('div', { class: 'rw' },
        h('div', { class: 'rw-main' }, big('star', '+' + r.exp, t('common.expShort'), 'exp'), big(r.toLoot ? 'gift' : 'coin', '+' + r.coins, r.toLoot ? t('battle.coinsLootShort') : t('hub.coins'), 'coin'),
          r.emblems ? big('emblem', '+' + r.emblems, t('emblem.title'), 'emblem') : null),
        items.length ? h('div', { class: 'rw-items' }, items) : null);
    }

    /** Panel final del combate. */
    function end(outcome, r) {
      const choice = DK.expedition.choiceInfo(); // tras un jefe de expedición: continuar o terminar
      busy = true;
      renderBench(false);
      auto = false; params.auto = false;
      let lostLoot = null;
      if (!params._ended) {
        params._ended = true;
        if (outcome === 'lost') { DK.audio.sfx('lose'); if (DK.expedition.active()) lostLoot = DK.expedition.fail({ boss: st.boss }); params._lostLoot = lostLoot; }
        if (outcome === 'fled' && DK.expedition.active()) DK.expedition.completeNode();
      } else lostLoot = params._lostLoot;
      const titles = {
        won: ['trophy', st.boss ? t('battle.bossWin') : t('battle.win'), t('battle.winText')],
        captured: ['orb', t('battle.capturedTitle'), t('battle.capturedText', { name: DK.daskai.name(st.enemy) })],
        fled: ['flee', t('battle.fledTitle'), t('battle.fledText')],
        lost: ['skull', t('battle.lostTitle'), lostLoot && lostLoot.averno ? t('averno.lostText', { floors: lostLoot.averno.floors, maps: lostLoot.averno.maps }) : lostLoot && lostLoot.boss ? t('battle.lostBoss', { n: Math.round(DK.config.expedition.bossDeathLoss * 100), pack: DK.rules.keepPack() ? t('pack.keepText') : t('pack.loseText') }) : lostLoot ? t('battle.lostExp', { pack: DK.rules.keepPack() ? t('pack.keepText') : t('pack.loseText') }) : t('battle.lostText')],
      };
      const [ic, title, sub] = titles[outcome];
      // v5.25: desde el botín se puede ver el registro del combate (panel lateral) o plegar la ventana para ver la arena
      const fold = (on) => banner.classList.toggle('folded', on);
      const bannerTools = h('div', { class: 'banner-tools' },
        btn({ icon: 'list', label: t('battle.endLog'), size: 'sm', variant: 'ghost', hotkey: 'L', onClick: () => expandLog() }),
        btn({ icon: 'eye', label: t('battle.endPeek'), size: 'sm', variant: 'ghost', onClick: () => fold(true) }));
      const unfold = h('button', { class: 'banner-unfold', type: 'button', onClick: () => fold(false) }, DK.icon('gift', 16), t('battle.endShow'));
      banner.replaceChildren(unfold, h('div', { class: 'banner-card ' + outcome }, DK.icon(ic, 34), h('h2', null, title), h('p', null, sub),
        r ? rewardsView(r) : null,
        r && r.shared && r.shared.length ? h('div', { class: 'team-exp' }, r.shared.map((x) => {
          const d = DK.party.get(x.uid); if (!d) return null;
          const need = Math.max(1, DK.daskai.expToNext(d)), pct = d.level >= DK.config.maxLevel ? 100 : Math.round((d.exp / need) * 100);
          return h('div', { class: 'te-row' + (x.to > x.from ? ' up' : ''), tip: `${x.name} · +${x.exp} ${t('common.expShort')}` },
            V.dSprite(d, { size: 28 }), h('span', { class: 'te-bar' }, h('i', { style: { width: pct + '%' } })),
            x.to > x.from ? h('span', { class: 'te-lv' }, DK.icon('arrowUp', 11), x.to) : h('span', { class: 'te-exp' }, '+' + x.exp));
        })) : null,
        choice ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('crown', 14), ' ', t('exp.mapCleared', { n: choice.depth })),
          h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('gift', 13), t('exp.lootNow', { items: choice.items, coins: DK.expedition.active().loot.coins })),
            DK.expedition.active().log.kept.slice(-4).map((x) => h('span', { class: 'chip pos' }, DK.icon('paw', 13), t('exp.keeps', { name: x.name }))))) : null,
        st.saved && st.saved.length ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('sparkles', 14), ' ', t('battle.savedTitle')),
          h('div', { class: 'chips' }, st.saved.map((x) => h('span', { class: 'chip pos' }, DK.icon('sparkles', 13), `${x.name} · ${t('battle.savedBy.' + x.how)}`)))) : null,
        st.dead && st.dead.length ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('skull', 14), ' ', t('battle.fallenTitle')),
          h('div', { class: 'chips' }, st.dead.map((x) => h('span', { class: 'chip neg' }, DK.icon('skull', 13), `${x.name} · ${t('common.lvl')} ${x.level}`)))) : null,
        lostLoot && lostLoot.recruits && lostLoot.recruits.length ? h('div', { class: 'exp-summary' }, h('b', null, t('exp.recruitsLeft')),
          h('div', { class: 'chips' }, lostLoot.recruits.map((x) => h('span', { class: 'chip neg' }, DK.icon('paw', 13), x.name)))) : null,
        bannerTools));
      banner.classList.add('show');

      const goHub = () => DK.router.reset(DK.store.state.gameOver ? 'gameOver' : 'hub');
      const exit = btn({ icon: 'home', label: t('battle.exit'), size: 'lg', desc: t('battle.exitDesc'), variant: outcome === 'lost' ? 'primary' : 'tone', hotkey: outcome === 'lost' ? '1' : '3', onClick: goHub });
      const toSummary = () => DK.router.reset(DK.store.state.gameOver ? 'gameOver' : 'expSummary');
      const summaryBtn = btn({ icon: 'list', label: t('exp.seeSummary'), size: 'lg', desc: t('exp.seeSummaryDesc'), variant: 'primary', hotkey: '1', onClick: toSummary });
      if (outcome === 'lost') {
        // Si era una expedición, se va al resumen
        const main = st.expedition ? summaryBtn : exit;
        actionsEl.replaceChildren(h('div', { class: 'action-grid one' }, main)); drawToolbar(); bindKeys({ 1: () => main.click(), Enter: () => main.click() }); return;
      }
      if (choice) {
        // Continuar a un mapa nuevo (más difícil) o terminar y cobrar con bonificación
        const nz = D.zones[choice.next.zone];
        const goOn = () => { DK.expedition.continueRun(); DK.audio.sfx('select'); DK.router.reset('expedition'); };
        const stop = () => { const s2 = DK.expedition.complete(); if (!s2) return; DK.ui.toast(t('exp.cashed', { coins: s2.coins }), { icon: 'coin', kind: 'good' }); DK.router.reset('expSummary'); };
        const avc = DK.averno.on(); // v5.31: en el Averno no se cobra: se sigue bajando
        const heal2 = btn({ icon: 'flask', label: t('heal.button'), size: 'lg', desc: t('battle.healDesc'), variant: 'ghost', hotkey: '3', onClick: async () => { if (await V.healDialog(DK.party.active())) { buildAlly(); end(outcome, r); } } });
        actionsEl.replaceChildren(h('div', { class: 'end-panel' },
          h('div', { class: 'end-main' },
            btn({ icon: 'next', label: t('exp.continue'), size: 'lg', variant: 'primary', hotkey: '1', disabled: !DK.party.aliveActive().length,
              desc: (avc ? t('averno.nextDesc', { lv: DK.averno.level(), n: choice.depth + 1 }) : t('exp.continueDesc', { zone: nz.name, n: choice.depth + 1, lv: choice.nextBonus })) + ' · ' + t('size.label', { name: t('size.' + (choice.next.size || 'small') + '.name'), n: DK.expedition.sizeFloors(choice.next.size) }), onClick: goOn })),
          h('div', { class: 'end-side' },
            avc ? h('p', { class: 'muted small' }, DK.icon('flame', 12), ' ', t('averno.noCash')) : btn({ icon: 'coin', label: t('exp.cashOut'), size: 'lg', variant: 'tone', hotkey: '2', desc: t('exp.cashOutDesc', { coins: choice.coins, n: Math.round((choice.mult - 1) * 100) }), onClick: stop }),
            heal2)));
        drawToolbar(); bindKeys({ 1: goOn, Enter: goOn, 2: stop, 3: () => heal2.click() }); return;
      }

      const alive = DK.party.aliveActive();
      const heal = btn({ icon: 'flask', label: t('heal.button'), size: 'lg', desc: t('battle.healDesc'), variant: 'tone', hotkey: '2', onClick: async () => { if (await V.healDialog(DK.party.active())) { buildAlly(); end(outcome, r); } } });
      // Quién lucha en el siguiente: por defecto el mismo (si sigue en pie)
      const cur = B().ally(st);
      if (!params._nextUid || !alive.some((d) => d.uid === params._nextUid)) params._nextUid = cur && !DK.daskai.isFainted(cur) ? cur.uid : alive[0] && alive[0].uid;
      // (v4.69: ya no hay desplegable «Luchará» al acabar)
      const next = () => {
        if (!params._nextUid) return;
        DK.router.replace('battle', { zone: st.zoneId, leaderUid: params._nextUid, boss: DK.expedition.active() ? DK.expedition.isBossNext() : false });
      };
      const keys = { 1: next, Enter: next, 2: () => heal.click(), 3: goHub };
      const expNow = DK.expedition.active();
      // Botón «Curar» de la barra final, con cuántos del equipo están heridos
      const endHealBtn = () => {
        const hurt = DK.party.active().filter((d) => !DK.daskai.isFainted(d) && DK.daskai.hpPct(d) < 1).length;
        const b = btn({ icon: 'flask', label: t('heal.short'), variant: 'tone', hotkey: '2', tip: t('battle.healDesc'), onClick: () => heal.click() });
        if (hurt) b.append(h('span', { class: 'ee-hurt', tip: t('battle.hurtTip', { n: hurt }) }, DK.icon('heart', 11), hurt));
        return b;
      };
      if (expNow) {
        // En una expedición se vuelve al mapa para elegir el siguiente paso
        const toMap = () => { if (params._nextUid) expNow.leader = params._nextUid; DK.store.save(); DK.router.reset('expedition'); };
        keys[1] = toMap; keys.Enter = toMap;
        // v4.63: barra propia y compacta. Sin el desplegable «Luchará» (en el mapa se elige el siguiente paso):
        // a la izquierda el botín que llevas, a la derecha curar y volver al mapa.
        const back = btn({ icon: 'map', label: t('exp.backToMap'), variant: 'primary', hotkey: '1', disabled: !alive.length, onClick: toMap });
        const healBtn = endHealBtn();
        actionsEl.replaceChildren(h('div', { class: 'end-exp' },
          h('div', { class: 'ee-loot' }, h('span', { class: 'ee-lbl' }, t('exp.lootLabel')),
            h('span', { class: 'ee-chip' }, DK.icon('gift', 14), h('b', null, DK.expedition.lootCount())),
            h('span', { class: 'ee-chip gold' }, DK.icon('coin', 14), h('b', null, expNow.loot.coins))),
          h('div', { class: 'ee-btns' }, healBtn, back)));
        drawToolbar(); bindKeys(keys); return;
      }
      // v4.68: el combate libre usa la misma barra compacta que la expedición. A la izquierda quién lucha
      // en el siguiente (desplegable si hay varios en pie); a la derecha salir, curar y siguiente combate.
      const nextBtn = btn({ icon: 'swords', label: t('battle.nextFight'), variant: 'primary', hotkey: '1', disabled: !alive.length, tip: alive.length ? t('battle.continueDesc') : t('battle.noneStanding'), onClick: next });
      const healBtn = endHealBtn();
      const exitBtn = btn({ icon: 'home', label: t('battle.exit'), variant: 'ghost', hotkey: '3', tip: t('battle.exitDesc'), onClick: goHub });
      const fighter = alive.find((d) => d.uid === params._nextUid);
      // v4.69: sin el desplegable «Luchará»: sigue el mismo (o el primero en pie); se cambia desde el banquillo
      const left = fighter ? h('div', { class: 'ee-loot' }, h('span', { class: 'ee-lbl' }, t('battle.nextFighter')), h('span', { class: 'ee-chip' }, V.dSprite(fighter, { size: 22 }), h('b', null, DK.daskai.name(fighter)), h('small', { class: 'muted' }, Math.round(DK.daskai.hpPct(fighter) * 100) + '%')))
        : h('div', { class: 'ee-loot' }, h('span', { class: 'ee-lbl' }, t('battle.noneStanding')));
      actionsEl.replaceChildren(h('div', { class: 'end-exp free' }, left, h('div', { class: 'ee-btns' }, exitBtn, healBtn, nextBtn)));
      drawToolbar();
      bindKeys(keys);
    }

    /* ---------- Inicio ---------- */
    buildEnemy();
    buildAlly();
    drawLogFilters();
    drawToolbar();
    if (st.turn === 0 && !st._intro) {
      st._intro = true;
      busy = true;
      (async () => {
        // v4.58: con la cortinilla todavía delante (jefe, mini jefe, zona) no empieza nada:
        // ni las entradas ni el modo automático
        for (let i = 0; i < 60 && document.querySelector('.curtain'); i++) await DK.util.sleep(80);
        if (stopped) return;
        anim(ui.eSprite, 'enter-enemy', 700); anim(ui.aSprite, 'enter', 700);
        const sp = D.species[st.enemy.species];
        if (st.boss) { log(t('battle.bossAppears', { title: (st.bossInfo || zone.boss).title, name: sp.name, n: st.enemy.level }), 'warn'); DK.vibrate([80, 40, 80]); }
        else if (st.elite) { log(t('battle.eliteAppears', { name: DK.daskai.name(st.enemy), n: st.enemy.level }), 'warn'); DK.vibrate([60, 30, 60]); }
        else log(t('battle.appears', { name: DK.daskai.name(st.enemy), n: st.enemy.level, zone: zone.name }));
        if (st.enemy.shiny) { log(t('battle.shinyAppears'), 'level'); DK.audio.sfx('shiny'); }
        const exp = DK.expedition.active();
        if (exp) log(t('exp.fightN', { step: Math.min(exp.step, exp.total), total: exp.total }), 'muted');
        await wait(500);
        if (!st.known) log(t('battle.firstMeet'), 'muted');
        log(t('battle.go', { name: DK.daskai.name(B().ally(st)) }));
        // Pasivas «al entrar» de los dos (al empezar)
        (st.entryLog || []).forEach((x) => log(x.text, x.kind, 'dmg'));
        st.entryLog = [];
        await wait(400);
        busy = false;
        if (!stopped) showMain();
      })();
    } else if (st.outcome) end(st.outcome); else showMain();

    return root;
  }
})();
