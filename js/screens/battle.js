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

  DK.screens.register('battle', {
    title: (p) => D.zones[p.zone].name, icon: 'swords', back: false, nav: false, section: 'battle', tutorial: 'battle',
    music: (p) => (p.boss || p.secret ? (p.secret ? 'boss_secret' : 'boss') : D.zones[p.zone].scene),
    /**
     * Entrada al combate: la pantalla se tapa con una cortinilla, el
     * combate se monta detrás y se descubre. Jefes y mini jefes llevan
     * su cinta de título; los combates normales, un barrido rápido.
     */
    transition(p, go) {
      const z = D.zones[p.zone];
      if (p.state) return go();   // volver a un combate ya empezado
      if (p.boss) {
        const info = p.secret && D.secretBosses ? D.secretBosses[p.zone] : z.boss;
        const sp = D.species[info.species];
        return DK.fx.cover({ title: info.title, subtitle: t(p.secret ? 'battle.curtainSecret' : 'battle.curtainBoss', { name: sp.name, n: info.level + (DK.expedition.active() ? DK.expedition.levelBonus() : 0) }), icon: p.secret ? 'cave' : 'crown', colors: ['#f59e0b', '#7f1d1d'], kind: 'boss' }, go);
      }
      if (p.elite) return DK.fx.cover({ title: t('battle.curtainEliteTitle'), subtitle: z.name, icon: 'skull', colors: ['#f43f5e', '#4c0519'], kind: 'elite' }, go);
      return DK.fx.cover({ colors: z.colors, kind: 'battle' }, go);
    },
    render(params) {
      if (!params.state) params.state = B().start(params.zone, params.leaderUid, { boss: params.boss, elite: params.elite, secret: params.secret, final: params.final });
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
    function buildEnemy() {
      const e = st.enemy, s = DK.daskai.stats(e), sp = D.species[e.species];
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
        h('div', { class: 'hud-title' }, h('b', null, st.boss ? (st.bossInfo || zone.boss).title : sp.name), V.level(e.level)),
        h('div', { class: 'hud-tags' }, st.boss ? h('span', { class: 'badge leader' }, DK.icon('crown', 13), t('battle.boss')) : null, V.houseBadge(sp.house, { known: st.known }), V.roleBadge(e), V.shinyTag(e), ui.eStatus, ui.ePhase),
        ui.eHp, ui.eMp, ui.eBreak, ui.intent);
      updateBreak();
      ui.eSprite = V.dSprite(e, { size: st.boss ? 210 : 180, cls: 'idle' });
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
        h('div', { class: 'hud-tags' }, V.houseBadge(sp.house), V.roleBadge(a), V.shinyTag(a), V.tempTag(a), ui.aStatus),
        ui.aHp, ui.aMp, ui.aExp);
      ui.aSprite = V.dSprite(a, { size: 210, flip: true, cls: 'idle' });
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
      const rival = (x2) => h('span', { class: 'tl-step enemy' }, DK.icon('skull', 12), D.species[st.enemy.species].name, x2 ? h('em', null, ' ×2') : null);
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
    const PART = { power: 'dmgPower', atkdef: 'dmgAtkDef', level: 'dmgLevel', house: 'dmgHouse', bonus: 'dmgBonus', weak: 'dmgWeak', guard: 'dmgGuard', switchIn: 'dmgSwitch', shield: 'dmgShield', burn: 'dmgBurn', weather: 'dmgWeather', stab: 'dmgStab', broken: 'dmgBroken' };
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
    function updateStatus() {
      ui.aStatus.replaceChildren(V.statusTag(B().ally(st).status) || '');
      ui.eStatus.replaceChildren(V.statusTag(st.enemy.status) || '');
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
      ui.eHp.update(s.eHp, es.hp); ui.eMp.update(s.eMp, es.mp);
      updateBreak(s);
      updateStatus();
    }

    /* ---------- Registro ---------- */
    function log(text, kind = '', cat = 'sys') {
      const line = h('div', { class: `log-line ${kind} cat-${cat}` }, text);
      if (logFilter !== 'all' && logFilter !== cat) line.classList.add('hidden');
      logEl.append(line);
      logEl.scrollTop = logEl.scrollHeight;
      // Últimas 3 líneas sobre la arena
      const last = [...logEl.querySelectorAll('.log-line:not(.hidden)')].slice(-3).map((l) => { const c = l.cloneNode(true); c.classList.remove('hidden'); return c; });
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
    function floatNum(side, text, kind) {
      const n = h('span', { class: `float-num ${side} ${kind}` }, text);
      fx.append(n);
      setTimeout(() => n.remove(), 1100);
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
            pendingAttack = e;
            break;
          case 'hit': {
            const att = pendingAttack && !e.dot ? pendingAttack : null;
            if (att && !skipping) await DK.fx.attack(fx, spriteOf(att.side), spriteOf(e.side), { house: e.house, kind: e.kind, crit: e.crit });
            pendingAttack = null;
            anim(spriteOf(e.side), 'hit', 450);
            if (e.crit) { anim(arena, 'shake', 400); DK.vibrate([40, 30, 60]); }
            DK.audio.sfx(e.crit ? 'crit' : 'hit');
            floatNum(e.side, (e.crit ? '¡' : '') + '-' + e.amount + (e.crit ? '!' : ''), e.dot ? 'dot' : e.eff === 'strong' ? 'strong' : e.eff === 'weak' ? 'weak' : '');
            break;
          }
          case 'heal': case 'regen':
            floatNum(e.side, '+' + e.amount, e.mana ? 'mana' : 'heal');
            if (e.anim === 'heal') { DK.fx.heal(fx, spriteOf(e.side)); DK.audio.sfx('heal'); anim(spriteOf(e.side), 'glow', 600); }
            break;
          case 'mana': floatNum(e.side, '+' + e.amount + ' ' + t('common.mpShort'), 'mana'); DK.fx.heal(fx, spriteOf(e.side), '#60a5fa'); DK.audio.sfx('mana'); break;
          case 'buff': anim(spriteOf(e.side), 'buff', 600); DK.audio.sfx('buff'); break;
          case 'debuff': anim(spriteOf(e.side), 'debuff', 600); DK.audio.sfx('debuff'); break;
          case 'status': DK.audio.sfx('status'); DK.fx.burst(fx, spriteOf(e.side), 'oscuridad', 10); break;
          case 'miss': floatNum(e.side, t('battle.missFloat'), 'weak'); DK.audio.sfx('miss'); pendingAttack = null; break;
          case 'faint': spriteOf(e.side).classList.add('faint'); DK.audio.sfx('faint'); if (e.side === 'ally') DK.vibrate(200); break;
          case 'capture': anim(ui.eSprite, 'capturing', 900); DK.audio.sfx('capture'); break;
          case 'captured': ui.eSprite.classList.add('captured'); DK.audio.sfx('captured'); DK.fx.burst(fx, ui.eSprite, 'luz', 24); break;
          case 'captureFail': DK.audio.sfx('captureFail'); break;
          case 'switch': buildAlly(); anim(ui.aSprite, 'enter', 600); DK.audio.sfx('swap'); break;
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
      const tags = pv ? [
        pv.ko ? h('span', { class: 'pv-tag ko ' + pv.ko, tip: pv.ko === 'sure' ? t('battle.koSureTip') : t('battle.koMaybeTip') }, DK.icon('skull', 11), pv.ko === 'sure' ? t('battle.koSure') : t('battle.koMaybe')) : null,
        pv.stab ? h('span', { class: 'pv-tag stab', tip: t('battle.stabTip', { n: Math.round((DK.config.stab - 1) * 100) }) }, DK.icon(D.houses[m.house].icon, 11), t('battle.stabShort')) : null,
        pv.brk ? h('span', { class: 'pv-tag brk', tip: t('battle.breakGainTip', { n: pv.brk }) }, DK.icon('bolt', 11), '+' + pv.brk) : null,
      ].filter(Boolean) : [];
      const b = h('button', {
        class: 'bmove' + (can ? '' : ' disabled') + (m.power && eff ? ' eff-' + eff : '') + (knownWeak ? ' eff-weakspot' : '') + (pv && pv.ko === 'sure' ? ' is-ko' : ''), type: 'button', disabled: !can, style: { '--mc': color },
        tip: can ? [m.desc || '', est ? breakdown('ally', mid, est) : null].filter(Boolean).join('\n') : t('battle.noMana'),
        onClick: go,
      },
        h('div', { class: 'bmove-top' },
          h('span', { class: 'bmove-icon' }, DK.icon(m.kind === 'fisico' ? 'sword' : 'wand', 16)),
          h('b', { class: 'bmove-name' }, m.name),
          m.power && eff ? V.effTag(eff) : null,
          knownWeak ? h('span', { class: 'weak-tag', tip: t('battle.weakTip') }, DK.icon('target', 11), t('battle.weakShort')) : null,
          pr ? h('span', { class: 'prio-tag ' + (pr > 0 ? 'fast' : 'slow'), tip: t(pr > 0 ? 'battle.prioFastTip' : 'battle.prioSlowTip') }, DK.icon(pr > 0 ? 'bolt' : 'clock', 11)) : null,
          h('span', { class: 'order-tag ' + first, tip: first === 'ally' ? t('battle.goFirst') : first === 'enemy' ? t('battle.goSecond') : t('battle.orderTie') }, first === 'ally' ? '1º' : first === 'enemy' ? '2º' : '='),
          h('kbd', { class: 'hotkey' }, i + 1)),
        h('div', { class: 'bmove-stats' },
          h('span', null, DK.icon('sparkle', 12), cost ? `${cost} ${t('common.mpShort')}` : t('move.free')),
          h('span', null, DK.icon('swords', 12), m.power ? t('move.power', { n: m.power }) : t('move.support')),
          h('span', null, DK.icon('eye', 12), `${m.acc}%`)),
        h('div', { class: 'bmove-dmg' },
          est ? h('span', { class: 'pv-dmg' }, DK.icon('target', 12), h('b', null, `${est[0]}-${est[1]}`), h('span', { class: 'pv-pct' }, `${pv.pct[0] === pv.pct[1] ? pv.pct[1] : pv.pct[0] + '-' + pv.pct[1]}%`)) : h('span', { class: 'muted' }, m.effect ? V.effectText(m) : t('move.support')),
          tags.length ? h('span', { class: 'pv-tags' }, tags) : null,
          // En el móvil la fila de datos se oculta: el coste va aquí
          h('span', { class: 'bmove-cost' }, DK.icon('sparkle', 11), cost ? `${cost}` : t('move.free'))));
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
      const mine = D.species[d.species].house, theirs = D.species[st.enemy.species].house;
      const atk = B().houseMult(mine, theirs).eff;   // mi ataque contra él
      const def = B().houseMult(theirs, mine).eff;   // su ataque contra mí
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
      const items = DK.bag.list('batalla');
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
          h('div', { class: 'bs-portrait' }, V.sprite(d.species, { size: 52, flip: side === 'ally', shiny: d.shiny })),
          h('div', { class: 'bs-who' },
            h('b', { class: 'bs-name' }, side === 'ally' ? DK.daskai.name(d) : st.boss ? (st.bossInfo || zone.boss).title : sp.name),
            h('div', { class: 'bs-tags' }, V.level(d.level), V.houseBadge(sp.house, { known: side === 'ally' || st.known }), V.statusTag(d.status)),
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
      const mine = hk ? B().houseMult(asp.house, esp.house).eff : null;
      const theirs = hk ? B().houseMult(esp.house, asp.house).eff : null;
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
      for (const id of r.drops) { await wait(200); log((r.toLoot && !(r.toBag || []).includes(id) ? t('battle.lootItem') : t('battle.gotItem')) + ' ' + D.items[id].name, 'drop', 'reward'); }
      (r.shared || []).forEach((x) => {
        log(t('battle.sharedExp', { name: x.name, n: x.exp }), 'muted', 'reward');
        if (x.to > x.from) { log(t('battle.levelUp', { name: x.name, n: x.to }), 'level', 'reward'); DK.ui.toast(t('battle.levelUp', { name: x.name, n: x.to }), { icon: 'star', kind: 'good' }); }
      });
      if (r.winHeal) { log(t('relics.winHealLog', { n: Math.round(r.winHeal * 100) }), 'good', 'reward'); const s2 = DK.daskai.stats(a); ui.aHp.update(a.cur.hp, s2.hp); }
      if (st.elite && st.expedition && DK.expedition.active() && DK.expedition.active().relicChoice) log(t('relics.eliteLog'), 'level', 'reward');
      if (!r.captured && !r.drops.length) log(t('battle.noDrop'), 'muted', 'reward');
      if (r.freeUnlocked) { log(t('battle.freeUnlocked', { zone: zone.name }), 'level', 'reward'); DK.ui.toast(t('battle.freeUnlocked', { zone: zone.name }), { icon: 'swords', kind: 'good' }); }
      if (r.emblems) { log(t('battle.emblemLog', { n: r.emblems }), 'level', 'reward'); DK.ui.toast(t('battle.emblemLog', { n: r.emblems }), { icon: 'emblem', kind: 'good' }); }
      if (r.secretUnlocked) { log(t('battle.secretUnlocked', { title: st.bossInfo.title, zone: zone.name }), 'level', 'reward'); DK.ui.toast(t('battle.secretUnlocked', { title: st.bossInfo.title, zone: zone.name }), { icon: 'cave', kind: 'good' }); }
      if (r.unlocked) { log(t('battle.zoneUnlocked', { zone: r.unlocked.name }), 'level', 'reward'); DK.ui.toast(t('battle.zoneUnlocked', { zone: r.unlocked.name }), { icon: 'map', kind: 'good' }); }
      DK.crafting.newlyReadyFavorites().forEach((rc) => DK.ui.toast(t('bag.favReady', { item: D.items[rc.result].name }), { icon: 'star', kind: 'good' }));
      B().finish(st);
      // Jefe del mapa derrotado: se decide si continuar o terminar (panel final)
      if (st.expedition && DK.expedition.active()) { DK.expedition.completeNode(); if (st.boss && st.final !== false) DK.expedition.bossCleared(); }
      end(st.outcome, r);
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
        lost: ['skull', t('battle.lostTitle'), lostLoot && lostLoot.boss ? t('battle.lostBoss', { n: Math.round(DK.config.expedition.bossDeathLoss * 100) }) : lostLoot ? t('battle.lostExp') : t('battle.lostText')],
      };
      const [ic, title, sub] = titles[outcome];
      banner.replaceChildren(h('div', { class: 'banner-card ' + outcome }, DK.icon(ic, 34), h('h2', null, title), h('p', null, sub),
        r ? h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('star', 13), `+${r.exp} ${t('common.expShort')}`), h('span', { class: 'chip pos' }, DK.icon('coin', 13), `+${r.coins}`),
          r.drops.map((id) => h('span', { class: 'chip pos' }, DK.icon(D.items[id].icon, 13), D.items[id].name)),
          r.relicOffer ? h('span', { class: 'chip pos' }, DK.icon('amulet', 13), t('relics.toChoose')) : null,
          r.emblems ? h('span', { class: 'chip pos emblem-chip' }, DK.icon('emblem', 13), t('emblem.plus', { n: r.emblems })) : null) : null,
        choice ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('crown', 14), ' ', t('exp.mapCleared', { n: choice.depth })),
          h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('gift', 13), t('exp.lootNow', { items: choice.items, coins: DK.expedition.active().loot.coins })),
            DK.expedition.active().log.kept.slice(-4).map((x) => h('span', { class: 'chip pos' }, DK.icon('paw', 13), t('exp.keeps', { name: x.name }))))) : null,
        st.saved && st.saved.length ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('sparkles', 14), ' ', t('battle.savedTitle')),
          h('div', { class: 'chips' }, st.saved.map((x) => h('span', { class: 'chip pos' }, DK.icon('sparkles', 13), `${x.name} · ${t('battle.savedBy.' + x.how)}`)))) : null,
        st.dead && st.dead.length ? h('div', { class: 'exp-summary' }, h('b', null, DK.icon('skull', 14), ' ', t('battle.fallenTitle')),
          h('div', { class: 'chips' }, st.dead.map((x) => h('span', { class: 'chip neg' }, DK.icon('skull', 13), `${x.name} · ${t('common.lvl')} ${x.level}`)))) : null,
        lostLoot && lostLoot.recruits && lostLoot.recruits.length ? h('div', { class: 'exp-summary' }, h('b', null, t('exp.recruitsLeft')),
          h('div', { class: 'chips' }, lostLoot.recruits.map((x) => h('span', { class: 'chip neg' }, DK.icon('paw', 13), x.name)))) : null));
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
        const stop = () => { const s2 = DK.expedition.complete(); DK.ui.toast(t('exp.cashed', { coins: s2.coins }), { icon: 'coin', kind: 'good' }); DK.router.reset('expSummary'); };
        const heal2 = btn({ icon: 'flask', label: t('heal.button'), size: 'lg', desc: t('battle.healDesc'), variant: 'ghost', hotkey: '3', onClick: async () => { if (await V.healDialog(DK.party.active())) { buildAlly(); end(outcome, r); } } });
        actionsEl.replaceChildren(h('div', { class: 'end-panel' },
          h('div', { class: 'end-main' },
            btn({ icon: 'next', label: t('exp.continue'), size: 'lg', variant: 'primary', hotkey: '1', disabled: !DK.party.aliveActive().length,
              desc: t('exp.continueDesc', { zone: nz.name, n: choice.depth + 1, lv: choice.nextBonus }) + ' · ' + t('size.label', { name: t('size.' + (choice.next.size || 'small') + '.name'), n: DK.expedition.sizeFloors(choice.next.size) }), onClick: goOn })),
          h('div', { class: 'end-side' },
            btn({ icon: 'coin', label: t('exp.cashOut'), size: 'lg', variant: 'tone', hotkey: '2', desc: t('exp.cashOutDesc', { coins: choice.coins, n: Math.round((choice.mult - 1) * 100) }), onClick: stop }),
            heal2)));
        drawToolbar(); bindKeys({ 1: goOn, Enter: goOn, 2: stop, 3: () => heal2.click() }); return;
      }

      const alive = DK.party.aliveActive();
      const heal = btn({ icon: 'flask', label: t('heal.button'), size: 'lg', desc: t('battle.healDesc'), variant: 'tone', hotkey: '2', onClick: async () => { if (await V.healDialog(DK.party.active())) { buildAlly(); end(outcome, r); } } });
      // Quién lucha en el siguiente: por defecto el mismo (si sigue en pie)
      const cur = B().ally(st);
      if (!params._nextUid || !alive.some((d) => d.uid === params._nextUid)) params._nextUid = cur && !DK.daskai.isFainted(cur) ? cur.uid : alive[0] && alive[0].uid;
      const who = alive.length > 1 ? h('label', { class: 'next-who' }, h('span', { class: 'muted small' }, t('battle.nextFighter')),
        DK.ui.select({ label: t('battle.nextFighter'), value: params._nextUid, onChange: (v) => (params._nextUid = v),
          options: alive.map((d) => ({ value: d.uid, label: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level} · ${Math.round(DK.daskai.hpPct(d) * 100)}% ${t('common.hpShort')}` })) })) : null;
      const next = () => {
        if (!params._nextUid) return;
        DK.router.replace('battle', { zone: st.zoneId, leaderUid: params._nextUid, boss: DK.expedition.active() ? DK.expedition.isBossNext() : false });
      };
      const keys = { 1: next, Enter: next, 2: () => heal.click(), 3: goHub };
      const expNow = DK.expedition.active();
      let cont, third, whoEl = who;
      if (expNow) {
        // En una expedición se vuelve al mapa para elegir el siguiente paso
        const toMap = () => { if (params._nextUid) expNow.leader = params._nextUid; DK.store.save(); DK.router.reset('expedition'); };
        keys[1] = toMap; keys.Enter = toMap;
        cont = btn({ icon: 'map', label: t('exp.backToMap'), size: 'lg', variant: 'primary', hotkey: '1', disabled: !alive.length, desc: t('exp.lootNow', { items: DK.expedition.lootCount(), coins: expNow.loot.coins }), onClick: toMap });
        // (Ya no se puede abandonar en cualquier momento: sólo en las hogueras del mapa)
        third = null;
      } else {
        cont = btn({ icon: 'swords', label: t('battle.nextFight'), size: 'lg', variant: 'primary', hotkey: '1', disabled: !alive.length, desc: alive.length ? t('battle.continueDesc') : t('battle.noneStanding'), onClick: next });
        third = exit;
      }
      actionsEl.replaceChildren(h('div', { class: 'end-panel' }, h('div', { class: 'end-main' }, whoEl, cont), h('div', { class: 'end-side' }, heal, third)));
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
        anim(ui.eSprite, 'enter-enemy', 700); anim(ui.aSprite, 'enter', 700);
        const sp = D.species[st.enemy.species];
        if (st.boss) { log(t('battle.bossAppears', { title: (st.bossInfo || zone.boss).title, name: sp.name, n: st.enemy.level }), 'warn'); DK.vibrate([80, 40, 80]); }
        else if (st.elite) { log(t('battle.eliteAppears', { name: sp.name, n: st.enemy.level }), 'warn'); DK.vibrate([60, 30, 60]); }
        else log(t('battle.appears', { name: sp.name, n: st.enemy.level, zone: zone.name }));
        if (st.enemy.shiny) { log(t('battle.shinyAppears'), 'level'); DK.audio.sfx('shiny'); }
        const exp = DK.expedition.active();
        if (exp) log(t('exp.fightN', { step: Math.min(exp.step, exp.total), total: exp.total }), 'muted');
        await wait(500);
        if (!st.known) log(t('battle.firstMeet'), 'muted');
        log(t('battle.go', { name: DK.daskai.name(B().ally(st)) }));
        await wait(400);
        busy = false;
        if (!stopped) showMain();
      })();
    } else if (st.outcome) end(st.outcome); else showMain();

    return root;
  }
})();
