/* =============================================================
 * screens/expedition.js — Mapa de la expedición.
 *
 *  Izquierda: el mapa por pisos (de abajo arriba, el jefe arriba del todo).
 *  Pulsa un nodo iluminado para ir allí (teclas 1-4 de izquierda a derecha).
 *  Derecha: lo que pasa en el nodo elegido (suceso, tienda, descanso,
 *  cofre) o, si no hay nada pendiente, tu botín, tu equipo y la retirada.
 *
 *  Los combates se abren en la pantalla 'battle' con params.node; al
 *  ganar, battle.js llama a DK.expedition.completeNode() y vuelve aquí.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);
  const E = () => DK.expedition;
  const ROW_FULL = 96, ROW_COMPACT = 58; // alto de cada piso en el mapa (px): normal y vista previa

  /** Daskai que luchará en el siguiente combate (el elegido o el primero en pie). */
  function fighter() {
    const e = E().active(), alive = DK.party.aliveActive();
    return alive.find((d) => d.uid === e.leader) || alive[0];
  }

  /** Abre el combate del nodo pendiente. kind: tipo forzado (suceso que acaba en combate). */
  function fight(kind) {
    const e = E().active(), n = E().pendingNode();
    const d = fighter();
    if (!d) { DK.ui.toast(t('warn.allFainted'), { icon: 'skull', kind: 'bad' }); return; }
    const type = kind || n.type;
    // 'secret' = el jefe oculto de la cueva; el jefe final también puede serlo (n.secret)
    const secret = type === 'secret' || (type === 'boss' && !!n.secret);
    DK.router.go('battle', { zone: e.zone, leaderUid: d.uid, boss: type === 'boss' || type === 'secret', secret, final: type === 'boss', elite: type === 'elite', node: n.id });
  }

  /** Va a un nodo del mapa. */
  function go(id, refresh) {
    const n = E().choose(id);
    if (!n) return;
    DK.audio.sfx('select');
    if (E().TYPES[n.type].battle) fight();
    else { refresh(); if (DK.ui.isNarrow()) setTimeout(() => { const p = document.querySelector('.exp-side'); if (p) p.scrollIntoView({ behavior: 'smooth' }); }, 50); }
  }

  /* ---------- Mapa ---------- */
  /**
   * Mapa de la expedición.
   * @param {Function} refresh
   * @param {Object} [src]   expedición a dibujar (por defecto la activa; el resumen pasa la terminada)
   * @param {boolean} [readonly]  sin nodos pulsables (resumen)
   */
  function mapView(refresh, src, readonly, { compact = false } = {}) {
    const e = src || E().active();
    const ROW_H = compact ? ROW_COMPACT : ROW_FULL;
    const rows = e.map.rows, H = rows.length * ROW_H;
    const avail = readonly ? [] : E().available();
    if (readonly && !e.pos && e.cleared.length) e.pos = e.cleared[e.cleared.length - 1];
    const cleared = new Set(e.cleared);
    const yOf = (row) => (rows.length - 1 - row) * ROW_H + ROW_H / 2;
    const all = rows.flat();
    const byId = Object.fromEntries(all.map((n) => [n.id, n]));

    // Líneas: recorridas, disponibles y el resto
    let lines = '';
    all.forEach((n) => n.links.forEach((lid) => {
      const m = byId[lid];
      const walked = cleared.has(n.id) && (cleared.has(lid) || e.pending === lid);
      const open = (e.pos === n.id && avail.includes(lid)) || (!e.pos && false);
      const cls = walked ? 'walked' : open ? 'open' : (cleared.has(n.id) || n.row < (byId[e.pos] ? byId[e.pos].row : -1)) ? 'gone' : '';
      lines += `<line x1="${n.x * 100}" y1="${yOf(n.row)}" x2="${m.x * 100}" y2="${yOf(m.row)}" class="${cls}"/>`;
    }));
    // Atajos: línea discontinua hasta el nodo al que saltan
    all.filter((n) => n.jump && byId[n.jump]).forEach((n) => {
      const m = byId[n.jump];
      const used = (cleared.has(n.id) && (e.jumpTo === n.jump || cleared.has(n.jump) || e.pending === n.jump));
      lines += `<line x1="${n.x * 100}" y1="${yOf(n.row)}" x2="${m.x * 100}" y2="${yOf(m.row)}" class="jump${used ? ' walked' : ''}"/>`;
    });
    const svg = h('div', { class: 'exp-lines' });
    svg.innerHTML = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" width="100%" height="${H}">${lines}</svg>`;

    // Nodos (teclas 1-n para los disponibles, de izquierda a derecha)
    const order = avail.slice().sort((a, b) => byId[a].x - byId[b].x);
    if (!readonly) order.forEach((id, i) => DK.keys.on(String(i + 1), () => go(id, refresh)));
    const nodes = all.map((n) => {
      const ty = E().TYPES[n.type];
      const state = cleared.has(n.id) ? 'done' : e.pending === n.id ? (readonly && e.outcome === 'lost' ? 'lost' : 'pending') : avail.includes(n.id) ? 'open' : 'locked';
      const key = order.indexOf(n.id);
      const b = h('button', {
        class: `exp-node t-${n.type} s-${state}` + (e.pos === n.id ? ' here' : '') + (n.secret ? ' secret' : ''), type: 'button',
        style: { left: n.x * 100 + '%', top: yOf(n.row) + 'px' }, disabled: state !== 'open',
        tip: n.secret ? `${t('exp.node.secretBoss')} — ${D.secretBosses[e.zone].title}` : `${t('exp.node.' + n.type)} — ${t('exp.nodeDesc.' + n.type)}`, 'aria-label': t('exp.node.' + n.type),
        onClick: () => go(n.id, refresh),
      }, DK.icon(state === 'done' ? 'check' : ty.icon, n.type === 'boss' ? 30 : 22),
      key >= 0 && key < 9 ? h('kbd', { class: 'hotkey' }, key + 1) : null,
      // Los mini jefes (élite) dan una reliquia: se marca en el mapa
      n.type === 'elite' && state !== 'done' ? h('span', { class: 'node-relic' }, DK.icon('amulet', 12)) : null);
      return b;
    });
    const zone = D.zones[e.zone];
    const map = h('div', { class: 'exp-map' + (compact ? ' compact' : ''), style: { height: H + 'px', '--z1': zone.colors[0], '--z2': zone.colors[1] } }, svg, nodes);
    // Centra la vista en los nodos disponibles
    // (se desplaza sólo la caja del mapa, no la página)
    setTimeout(() => {
      const el = map.querySelector('.s-open, .s-pending, .s-lost, .here'); const box = map.parentElement;
      if (el && box) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2);
    }, 30);
    if (compact) return h('div', { class: 'exp-map-compact' }, h('div', { class: 'exp-scroll' }, map), legend());
    return h('div', { class: 'card exp-map-card' },
      h('div', { class: 'panel-head' }, DK.icon(zone.icon, 18), h('h3', null, zone.name),
        h('span', { class: 'chip', tip: t('exp.depthTip') }, DK.icon('compass', 13), t('exp.depth', { n: e.depth || 1 })),
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(e.step, e.total), total: e.total }))),
      readonly ? null : relicBar(),
      h('div', { class: 'exp-scroll' }, map),
      legend());
  }
  /** Mapa de sólo lectura (resumen, vista previa en Zonas). opts: { compact } */
  DK.views.expMap = (src, opts) => mapView(() => {}, src, true, opts);

  /** Fila de reliquias activas (con su efecto en el tooltip). */
  function relicBar(list = DK.relics.list()) {
    if (!list.length) return null;
    return h('div', { class: 'relic-bar' }, list.map((r) => h('span', { class: 'relic-chip r-' + r.rarity, tip: `${r.name} — ${relicText(r)}` }, DK.icon(r.icon, 15), h('span', null, r.name))));
  }
  const relicText = (r) => t('relics.effect.' + r.effect.type, { n: Math.round((r.effect.pct || 0) * 100), add: r.effect.type === 'crit' || r.effect.type === 'capture' ? Math.round(r.effect.add * 100) : r.effect.add, house: r.effect.house ? DK.tr('houses', D.houses[r.effect.house]) : '', stat: r.effect.stat ? DK.tr('stats', D.stats[r.effect.stat]) : '' });
  DK.views.relicText = relicText;
  DK.views.relicBar = relicBar;

  /** Elegir reliquia (al empezar y tras vencer a un rival de élite). */
  function relicPanel(e, refresh) {
    const list = e.relicChoice.map((id) => D.relics[id]);
    const pick = (i) => { const id = DK.relics.choose(i); if (id) { DK.audio.sfx('levelup'); DK.ui.toast(t('relics.got', { name: D.relics[id].name }), { icon: D.relics[id].icon, kind: 'good' }); } refresh(); };
    list.forEach((r, i) => DK.keys.on(String(i + 1), () => pick(i)));
    const first = !e.cleared.length && !e.pending;
    return h('div', { class: 'card stack-s' },
      h('div', { class: 'exp-node-head t-relic' }, h('span', { class: 'exp-node-big t-relic' }, DK.icon('amulet', 28)),
        h('div', null, h('h3', null, first ? t('relics.startTitle') : t('relics.eliteTitle')), h('p', { class: 'muted small' }, t('relics.text')))),
      h('div', { class: 'relic-grid' }, list.map((r, i) => h('div', { class: 'relic-card r-' + r.rarity },
        h('span', { class: 'relic-icon' }, DK.icon(r.icon, 30)),
        h('b', null, r.name), V.rarity(r.rarity),
        h('p', { class: 'small' }, relicText(r)),
        btn({ icon: 'plus', label: t('relics.take'), variant: 'primary', hotkey: String(i + 1), onClick: () => pick(i) })))),
      first ? null : btn({ icon: 'next', label: t('relics.skip'), variant: 'ghost', onClick: () => pick(null) }));
  }

  /**
   * Pactos del mapa (data/curses.js): eliges cuáles aceptar antes de
   * empezar. Más dificultad a cambio de más monedas o reliquias.
   */
  function cursePanel(e, params, refresh) {
    params.curses = params.curses || [];
    const sel = params.curses;
    const toggle = (id) => { params.curses = sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat(id); DK.audio.sfx('select'); refresh(); };
    const confirm = () => { DK.curses.accept(sel); params.curses = null; if (sel.length) DK.audio.sfx('debuff'); refresh(); };
    e.curseOffer.forEach((id, i) => DK.keys.on(String(i + 1), () => toggle(id)));
    DK.keys.on('Enter', confirm);
    const coins = sel.reduce((a, id) => a + (D.curses[id].reward.coins || 0), 0);
    const relics = sel.reduce((a, id) => a + (D.curses[id].reward.relic || 0), 0);
    const reward = (c) => [c.reward.coins ? t('curse.rewardCoins', { n: Math.round(c.reward.coins * 100) }) : null, c.reward.relic ? t('curse.rewardRelic', { n: c.reward.relic }) : null].filter(Boolean).join(' · ');
    return h('div', { class: 'card stack' },
      h('div', { class: 'exp-node-head t-elite' }, h('span', { class: 'exp-node-big t-elite' }, DK.icon('skull', 28)),
        h('div', null, h('h3', null, t('curse.title', { n: e.depth || 1 })), h('p', { class: 'muted small' }, t('curse.text')))),
      h('div', { class: 'curse-grid' }, e.curseOffer.map((id, i) => {
        const c = D.curses[id], on = sel.includes(id);
        return h('button', { class: 'curse-card' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on, onClick: () => toggle(id) },
          h('span', { class: 'curse-icon' }, DK.icon(c.icon, 26)),
          h('b', null, t('curse.' + id + '.name')),
          h('p', { class: 'small' }, t('curse.' + id + '.desc')),
          h('span', { class: 'curse-reward' }, DK.icon('gift', 13), reward(c)),
          h('span', { class: 'curse-check' }, DK.icon(on ? 'check' : 'plus', 14), on ? t('curse.accepted') : t('curse.accept')),
          h('kbd', { class: 'hotkey' }, String(i + 1)));
      })),
      h('div', { class: 'row between wrap gap' },
        h('span', { class: 'small' }, sel.length ? [t('curse.total'), ' ', h('b', null, [coins ? t('curse.rewardCoins', { n: Math.round(coins * 100) }) : null, relics ? t('curse.rewardRelic', { n: relics }) : null].filter(Boolean).join(' · '))] : h('span', { class: 'muted' }, t('curse.none'))),
        btn({ icon: sel.length ? 'skull' : 'next', label: sel.length ? t('curse.go', { n: sel.length }) : t('curse.skip'), variant: sel.length ? 'primary' : 'tone', hotkey: '↵', onClick: confirm })));
  }

  /** Tras derrotar al jefe de un mapa: continuar más profundo o terminar y cobrar. */
  function choicePanel(refresh) {
    const c = E().choiceInfo();
    const nz = D.zones[c.next.zone];
    const goOn = () => { E().continueRun(); DK.audio.sfx('select'); refresh(); };
    const stop = () => { const s = E().complete(); DK.ui.toast(t('exp.cashed', { coins: s.coins }), { icon: 'coin', kind: 'good' }); DK.router.reset('expSummary'); };
    DK.keys.on('1', goOn); DK.keys.on('2', stop);
    return h('div', { class: 'card stack exp-choice' },
      h('div', { class: 'exp-node-head t-boss' }, h('span', { class: 'exp-node-big t-boss' }, DK.icon('crown', 28)),
        h('div', null, h('h3', null, t('exp.mapCleared', { n: c.depth })), h('p', { class: 'muted small' }, t('exp.choiceText')))),
      h('div', { class: 'exp-choice-grid' },
        h('div', { class: 'exp-choice-card go', style: { '--z1': nz.colors[0], '--z2': nz.colors[1] } },
          h('span', { class: 'muted small' }, t('exp.nextMap', { n: c.depth + 1 })),
          h('h3', null, DK.icon(nz.icon, 20), ' ', nz.name),
          h('div', { class: 'chips' }, h('span', { class: 'chip' }, `${t('common.lvl')} ${nz.levels[0] + c.nextBonus}-${nz.levels[1] + c.nextBonus}`),
            c.nextBonus ? h('span', { class: 'chip neg' }, DK.icon('skull', 12), t('exp.levelPlus', { n: c.nextBonus })) : null,
            h('span', { class: 'chip pos' }, DK.icon('amulet', 12), t('exp.newRelic'))),
          h('p', { class: 'small muted' }, t('exp.continueRisk')),
          btn({ icon: 'next', label: t('exp.continue'), variant: 'primary', hotkey: '1', disabled: !DK.party.aliveActive().length, onClick: goOn })),
        h('div', { class: 'exp-choice-card stop' },
          h('span', { class: 'muted small' }, t('exp.cashOut')),
          h('h3', null, V.coins(c.coins)),
          h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, `x${c.mult.toFixed(2)}`), h('span', { class: 'chip' }, DK.icon('gift', 12), t('exp.itemsN', { n: c.items }))),
          h('p', { class: 'small muted' }, t('exp.cashOutText')),
          btn({ icon: 'coin', label: t('exp.cashOut'), variant: 'tone', hotkey: '2', onClick: stop }))));
  }

  function legend() {
    return h('div', { class: 'chart-legend exp-legend' }, Object.entries(E().TYPES).map(([k, ty]) =>
      h('span', { class: 'legend-item', tip: t('exp.nodeDesc.' + k) }, h('span', { class: 'exp-legend-icon t-' + k }, DK.icon(ty.icon, 13)), t('exp.node.' + k))));
  }

  /* ---------- Panel del nodo ---------- */
  const cont = (refresh) => btn({ icon: 'next', label: t('exp.continuePath'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => { E().completeNode(); refresh(); } });
  const head = (type, title, text) => h('div', { class: 'exp-node-head t-' + type },
    h('span', { class: 'exp-node-big t-' + type }, DK.icon(E().TYPES[type].icon, 28)), h('div', null, h('h3', null, title), text ? h('p', { class: 'muted small' }, text) : null));

  function nodePanel(n, refresh) {
    const e = E().active();
    const done = (key, vars) => h('div', { class: 'stack-s' }, h('div', { class: 'warning good' }, DK.icon('check', 18), h('span', null, t(key, vars))), cont(refresh));
    const enterCont = () => DK.keys.on('Enter', () => { E().completeNode(); refresh(); });

    if (E().TYPES[n.type].battle) {
      DK.keys.on('Enter', () => fight());
      return h('div', { class: 'card stack-s' }, head(n.type, t('exp.node.' + n.type), t('exp.nodeDesc.' + n.type)),
        btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => fight() }));
    }

    if (n.type === 'treasure') {
      if (!e.result) {
        const open = () => { const r = E().openTreasure(); e.result = { key: 'treasure', items: r.items, coins: r.coins, recipe: r.recipe, relic: r.relic }; DK.audio.sfx('coin'); DK.store.save(); refresh(); };
        DK.keys.on('Enter', open);
        return h('div', { class: 'card stack-s' }, head('treasure', t('exp.node.treasure'), t('exp.treasureText')),
          btn({ icon: 'gift', label: t('exp.openChest'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: open }));
      }
      enterCont();
      return h('div', { class: 'card stack-s' }, head('treasure', t('exp.node.treasure')),
        e.result.recipe ? h('div', { class: 'warning good' }, DK.icon('scroll', 18), h('span', null, t('exp.recipeFound', { item: D.items[D.recipes.find((r) => r.id === e.result.recipe).result].name }))) : null,
        e.result.relic ? h('div', { class: 'warning good' }, DK.icon(D.relics[e.result.relic].icon, 18), h('span', null, t('relics.inChest', { name: D.relics[e.result.relic].name, effect: relicText(D.relics[e.result.relic]) }))) : null,
        h('div', { class: 'chips' }, h('span', { class: 'chip pos', tip: t('exp.toLoot') }, DK.icon('coin', 13), `+${e.result.coins}`),
          e.result.items.map((id) => { const bag = E().toBag(id); return h('span', { class: 'chip pos', tip: bag ? t('exp.toBagTip') : t('exp.toLoot') }, DK.icon(D.items[id].icon, 13), D.items[id].name, ' ', DK.icon(bag ? 'bag' : 'flag', 12)); })),
        h('p', { class: 'muted small' }, DK.icon('bag', 12), ' ', t('exp.toBagTip'), ' · ', DK.icon('flag', 12), ' ', t('exp.toLoot')), cont(refresh));
    }

    if (n.type === 'rest') {
      if (e.result) {
        enterCont();
        const pv0 = E().campfirePreview();
        return h('div', { class: 'card stack-s' }, head('rest', t('exp.node.rest')), done(e.result.key, e.result.vars),
          E().canCampfireExit() ? btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv0.pct, coins: pv0.coins }), variant: 'ghost', onClick: async () => {
            if (!(await DK.ui.confirm(t('exp.campExitQ'), t('exp.campExitText', { pct: pv0.pct, coins: pv0.coins, items: pv0.items }) + (pv0.recruits.length ? ' ' + t('exp.campExitRecruits', { names: pv0.recruits.join(', ') }) : ''), { okLabel: t('exp.campExit'), okIcon: 'home', icon: 'campfire' }))) return;
            const r = E().campfireExit(); DK.ui.toast(t('exp.campExited', { coins: r.coins }), { icon: 'campfire', kind: 'good' }); DK.router.reset('expSummary');
          } }) : null);
      }
      const team = DK.party.active();
      if (!e.trainUid || !team.some((d) => d.uid === e.trainUid)) e.trainUid = (fighter() || team[0]).uid;
      const rest = () => { const r = E().rest(); e.result = { key: 'exp.rested', vars: { n: r.pct } }; DK.audio.sfx('heal'); DK.store.save(); refresh(); };
      const train = async () => {
        const r = E().train(e.trainUid);
        e.result = { key: 'exp.trained', vars: { name: DK.daskai.name(r.d), n: r.exp } };
        DK.store.save();
        if (r.levelInfo.levels.length) await V.levelUpDialog(r.d, r.levelInfo);
        for (const m of r.levelInfo.pending) await V.learnMovePrompt(r.d, m);
        if (r.levelInfo.evolveReady) await V.evolveDialog(r.d);
        refresh();
      };
      DK.keys.on('1', rest); DK.keys.on('2', train);
      // Volver a casa desde la hoguera: la mitad del botín y TODOS los daskai reclutados
      const pv = E().campfirePreview();
      const goHome = async () => {
        if (!E().canCampfireExit()) return;
        const text = t('exp.campExitText', { pct: pv.pct, coins: pv.coins, items: pv.items }) + (pv.recruits.length ? ' ' + t('exp.campExitRecruits', { names: pv.recruits.join(', ') }) : '');
        if (!(await DK.ui.confirm(t('exp.campExitQ'), text, { okLabel: t('exp.campExit'), okIcon: 'home', icon: 'campfire' }))) return;
        const r = E().campfireExit();
        DK.ui.toast(t('exp.campExited', { coins: r.coins }), { icon: 'campfire', kind: 'good' });
        DK.router.reset('expSummary');
      };
      if (E().canCampfireExit()) DK.keys.on('3', goHome);
      const exitBox = E().canCampfireExit()
        ? h('div', { class: 'camp-exit' },
          btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv.pct, coins: pv.coins }), variant: 'ghost', size: 'lg', hotkey: '3', onClick: goHome }),
          pv.recruits.length ? h('p', { class: 'small good-text' }, DK.icon('paw', 12), ' ', t('exp.campExitKeeps', { names: pv.recruits.join(', ') })) : null)
        : h('p', { class: 'muted small' }, DK.icon('lock', 12), ' ', t('exp.noRetreat'));
      return h('div', { class: 'card stack-s' }, head('rest', t('exp.node.rest'), t('exp.restText')),
        h('div', { class: 'list' }, team.map((d) => V.daskaiRow(d, { compact: true }))),
        btn({ icon: 'bed', label: t('exp.restHeal'), desc: t('exp.restHealDesc', { n: Math.round(DK.config.expedition.restHeal * 100) }), variant: 'primary', size: 'lg', hotkey: '1', onClick: rest }),
        h('div', { class: 'stack-s exp-train' },
          btn({ icon: 'star', label: t('exp.train'), desc: t('exp.trainDesc'), variant: 'tone', size: 'lg', hotkey: '2', onClick: train }),
          DK.ui.select({ label: t('exp.trainWho'), value: e.trainUid, onChange: (v) => (e.trainUid = v),
            options: team.map((d) => ({ value: d.uid, label: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}` })) })),
        exitBox);
    }

    if (n.type === 'cave') return cavePanel(e, refresh);
    if (n.type === 'shortcut') return shortcutPanel(n, refresh);

    if (n.type === 'recruit') return recruitPanel(e, refresh);
    if (n.type === 'shrine') return shrinePanel(e, refresh);

    if (n.type === 'shop') return merchantPanel(e, refresh);

    if (n.type === 'event') {
      const ev = D.events.find((x) => x.id === e.event) || D.events[0];
      const T = (k, v) => t(`events.${ev.id}.${k}`, v);
      if (e.result) {
        const r = e.result;
        if (r.fight) DK.keys.on('Enter', () => fight(r.fight)); else enterCont();
        return h('div', { class: 'card stack-s' }, head('event', T('title')),
          h('div', { class: 'warning ' + (r.fight ? 'warn' : 'good') }, DK.icon(r.fight ? 'skull' : ev.icon, 18), h('span', null, T('results.' + r.key, r.vars))),
          r.fight ? btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => fight(r.fight) }) : cont(refresh));
      }
      const ctx = E().ctx();
      return h('div', { class: 'card stack-s' }, head('event', T('title'), T('text')),
        h('div', { class: 'stack-s' }, ev.choices.map((c, i) => {
          const ok = !c.req || c.req(ctx);
          const pick = () => { if (E().resolveEvent(c.id)) { DK.audio.sfx('select'); DK.app.renderNav(); refresh(); } };
          if (ok) DK.keys.on(String(i + 1), pick);
          return btn({ icon: c.icon, label: T('choices.' + c.id), desc: ok ? T('desc.' + c.id) : T('need.' + c.id), variant: i === 0 ? 'primary' : 'tone', size: 'lg', hotkey: String(i + 1), disabled: !ok, onClick: pick });
        })));
    }
    return null;
  }

  /**
   * Mercader: la única tienda del juego. Comprar (unidades limitadas por
   * oferta) o vender lo que llevas en la bolsa.
   */
  const shopUi = { mode: 'buy', qty: {} };
  function merchantPanel(e, refresh) {
    if (shopUi.node !== e.pending) { shopUi.node = e.pending; shopUi.mode = 'buy'; shopUi.qty = {}; }
    DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
    const q = (k) => shopUi.qty[shopUi.mode + k] || 1;
    const setQ = (k) => (n) => { shopUi.qty[shopUi.mode + k] = n; refresh(); };
    const sellable = DK.bag.list().filter((x) => DK.shop.canSell(x.item.id));
    const mode = DK.ui.segmented({ value: shopUi.mode, onChange: (v) => { shopUi.mode = v; refresh(); },
      options: [{ value: 'buy', label: t('shop.buy'), icon: 'bag' }, { value: 'sell', label: `${t('shop.sell')} (${sellable.length})`, icon: 'coin' }] });
    let grid;
    if (shopUi.mode === 'buy') {
      grid = h('div', { class: 'shop-grid side' }, (e.offers || []).map((o, i) => {
        if (o.left == null) o.left = o.sold ? 0 : 1;
        const it = D.items[o.id];
        const n = Math.min(q(i), Math.max(1, o.left));
        const buy = () => { if (E().buyOffer(i, n)) { DK.audio.sfx('coin'); DK.ui.toast(t('shop.bought', { item: it.name, n }), { icon: 'bag', kind: 'good' }); shopUi.qty['buy' + i] = 1; refresh(); } else DK.audio.sfx('error'); };
        if (o.left > 0 && i < 9) DK.keys.on(String(i + 1), buy);
        return V.shopCard(o.id, { price: o.price, oldPrice: D.prices[o.id], sold: o.left <= 0, qty: n, max: o.left, onQty: o.left > 1 ? setQ(i) : null, hotkey: i < 9 ? String(i + 1) : null, onBuy: buy,
          badges: o.left > 0 ? [h('span', { class: 'badge' }, t('shop.left', { n: o.left }))] : [] });
      }));
    } else {
      grid = sellable.length ? h('div', { class: 'shop-grid side' }, sellable.map(({ item, qty }) => {
        const n = Math.min(q(item.id), qty);
        return V.shopCard(item.id, { mode: 'sell', price: DK.shop.sellPrice(item.id), qty: n, max: qty, onQty: qty > 1 ? setQ(item.id) : null,
          onBuy: () => { const coins = DK.shop.sellPrice(item.id) * n; DK.shop.sell(item.id, n); DK.ui.toast(t('shop.soldN', { item: item.name, n, coins }), { icon: 'coin', kind: 'good' }); shopUi.qty['sell' + item.id] = 1; refresh(); } });
      })) : DK.ui.empty('coin', t('shop.nothingToSell'), '');
    }
    return h('div', { class: 'card stack-s merchant' }, head('shop', t('exp.node.shop'), t('exp.shopText2')),
      h('div', { class: 'row between wrap gap-s' }, mode,
        h('div', { class: 'row gap-s' },
          h('span', { class: 'shop-wallet', tip: t('exp.lootCoinsTip') }, DK.icon('flag', 14), ' ', V.coins(e.loot.coins)),
          h('span', { class: 'shop-wallet', tip: t('exp.yourCoins') }, DK.icon('user', 14), ' ', V.coins(DK.wallet.get())))),
      shopUi.mode === 'buy' ? h('p', { class: 'muted small' }, t('exp.payNote')) : null,
      shopUi.mode === 'sell' ? h('p', { class: 'muted small' }, t('shop.sellHelp2', { n: Math.round(DK.config.sellRatio * 100) })) : null,
      grid, cont(refresh));
  }

  /**
   * Cueva: guarida del jefe oculto de la zona (o un tesoro escondido).
   * Vencer al jefe oculto por primera vez lo desbloquea: desde entonces
   * puede aparecer como jefe final de los mapas de esta zona.
   */
  function cavePanel(e, refresh) {
    const sb = E().secretBoss();
    const rec = DK.world.secret(e.zone);
    const headEl = head('cave', t('exp.node.cave'), rec.defeated ? t('exp.caveTextKnown', { title: sb.title }) : t('exp.caveText'));
    if (!e.result) {
      const explore = () => { E().exploreCave(); DK.audio.sfx('select'); refresh(); };
      DK.keys.on('1', explore); DK.keys.on('2', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl,
        rec.defeated ? h('div', { class: 'warning good' }, DK.icon('check', 16), h('span', null, t('exp.secretKnown', { title: sb.title }))) : null,
        btn({ icon: 'compass', label: t('exp.caveExplore'), desc: t('exp.caveExploreDesc'), variant: 'primary', size: 'lg', hotkey: '1', onClick: explore }),
        btn({ icon: 'next', label: t('exp.caveSkip'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
    }
    const r = e.result;
    if (r.fight === 'secret') {
      DK.keys.on('1', () => fight('secret')); DK.keys.on('2', () => { E().completeNode(); refresh(); });
      const lvl = sb.level + E().levelBonus();
      return h('div', { class: 'card stack-s cave-lair' }, headEl,
        h('div', { class: 'lair' }, h('div', { class: 'lair-art' }, V.sprite(sb.species, { size: 120, cls: 'idle' })),
          h('div', { class: 'stack-s' }, h('span', { class: 'badge leader' }, DK.icon('crown', 12), t('exp.secretBoss')),
            h('h3', null, sb.title), h('span', { class: 'muted small' }, `${D.species[sb.species].name} · ${t('common.lvl')} ${lvl}`),
            h('p', { class: 'small' }, t('exp.events.' + r.key, r.vars)),
            h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('emblem', 12), t('emblem.plus', { n: DK.config.expedition.emblemsPerBoss })),
              rec.defeated ? null : h('span', { class: 'chip pos' }, DK.icon('crown', 12), t('exp.secretUnlockChip')),
              sb.drops.slice(0, 2).map(([id]) => h('span', { class: 'chip' }, DK.icon(D.items[id].icon, 12), D.items[id].name))))),
        h('p', { class: 'muted small' }, DK.icon('alert', 12), ' ', t('exp.secretRisk')),
        btn({ icon: 'swords', label: t('exp.secretFight'), variant: 'primary', size: 'lg', hotkey: '1', onClick: () => fight('secret') }),
        btn({ icon: 'next', label: t('exp.secretLeave'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
    }
    DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'warning good' }, DK.icon('gift', 16), h('span', null, t('exp.events.caveTreasure'))),
      h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('coin', 13), `+${r.coins}`),
        r.items.map((id) => h('span', { class: 'chip pos' }, DK.icon(D.items[id].icon, 13), D.items[id].name))), cont(refresh));
  }

  /** Atajo: saltar varios pisos a cambio de vida del equipo. */
  function shortcutPanel(n, refresh) {
    const e = E().active();
    const target = E().node(n.jump);
    const skip = target.row - n.row - 1;
    const cost = Math.round(DK.config.expedition.shortcutHpCost * 100);
    const take = () => { const r = E().takeShortcut(); if (!r) return; DK.audio.sfx('swap'); DK.ui.toast(t('exp.shortcutTaken', { n: r.skipped }), { icon: 'shortcut', kind: 'good' }); refresh(); };
    DK.keys.on('1', take); DK.keys.on('2', () => { E().completeNode(); refresh(); });
    return h('div', { class: 'card stack-s' }, head('shortcut', t('exp.node.shortcut'), t('exp.shortcutText', { n: skip })),
      h('div', { class: 'chips' }, h('span', { class: 'chip neg' }, DK.icon('heart', 12), t('exp.shortcutCost', { n: cost })),
        h('span', { class: 'chip pos' }, DK.icon('next', 12), t('exp.shortcutSkip', { n: skip })),
        h('span', { class: 'chip' }, DK.icon(E().TYPES[target.type].icon, 12), t('exp.shortcutTo', { node: t('exp.node.' + target.type) }))),
      h('p', { class: 'muted small' }, t('exp.shortcutHint')),
      btn({ icon: 'shortcut', label: t('exp.shortcutTake'), variant: 'primary', size: 'lg', hotkey: '1', onClick: take }),
      btn({ icon: 'next', label: t('exp.shortcutNo'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /** Santuario: bendice a un daskai para que se salve de la muerte una vez en esta expedición. */
  function shrinePanel(e, refresh) {
    const headEl = head('shrine', t('exp.node.shrine'), t('exp.shrineText'));
    if (e.result) {
      DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl, h('div', { class: 'warning good' }, DK.icon('sparkles', 18), h('span', null, t(e.result.key, e.result.vars))), cont(refresh));
    }
    const team = DK.party.active();
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'list' }, team.map((d, i) => {
        const pick = () => { E().bless(d.uid); DK.audio.sfx('levelup'); refresh(); };
        DK.keys.on(String(i + 1), pick);
        return V.daskaiRow(d, { compact: true, tags: e.blessed === d.uid ? [h('span', { class: 'badge good' }, DK.icon('sparkles', 13), t('exp.blessedTag'))] : [],
          actions: btn({ icon: 'sparkles', label: t('exp.bless'), size: 'sm', variant: 'primary', hotkey: String(i + 1), onClick: pick }) });
      })),
      e.blessed ? h('p', { class: 'muted small' }, t('exp.blessReplace')) : null,
      btn({ icon: 'next', label: t('exp.shrineSkip'), variant: 'ghost', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /** Nodo de reclutamiento: eliges uno de los daskai (se une como temporal). */
  function recruitPanel(e, refresh) {
    const headEl = head('recruit', t('exp.node.recruit'), t('exp.recruitText'));
    if (e.result) {
      const d = DK.party.get(e.result.uid);
      const team = DK.party.active();
      const full = d && !DK.party.isActive(d.uid);
      DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl,
        h('div', { class: 'warning good' }, DK.icon('paw', 18), h('span', null, t(e.result.key, e.result.vars))),
        h('p', { class: 'muted small' }, t('exp.tempRule')),
        full ? h('div', { class: 'inline-panel' }, h('p', { class: 'small' }, DK.icon('swap', 14), ' ', t('exp.teamFull', { name: DK.daskai.name(d) })),
          h('div', { class: 'list' }, team.map((x, i) => V.daskaiRow(x, { compact: true,
            actions: btn({ icon: 'swap', label: t('detail.replaceHere'), size: 'sm', variant: 'tone', onClick: () => { DK.party.placeAt(d.uid, i); refresh(); } }) })))) : null,
        cont(refresh));
    }
    const cands = e.candidates || [];
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'recruit-grid' }, cands.map((c, i) => {
        const sp = D.species[c.species];
        const pick = () => { if (E().recruit(i)) { DK.audio.sfx('levelup'); DK.app.renderNav(); refresh(); } };
        DK.keys.on(String(i + 1), pick);
        const s = DK.daskai.stats(Object.assign({}, c, { wild: false }));
        return h('div', { class: 'recruit-card', style: { '--c': D.houseColor(sp.house) } },
          h('div', { class: 'recruit-art' }, V.dSprite(c, { size: 84, cls: 'float' })),
          h('div', { class: 'row gap-s wrap' }, h('b', null, sp.name), V.level(c.level), V.shinyTag(c)),
          h('div', { class: 'row gap-s wrap' }, V.houseBadge(sp.house)),
          h('div', { class: 'chips' },
            h('span', { class: 'chip', tip: DK.tr('natures', D.natures[c.nature], 'desc') }, DK.icon('leaf', 13), DK.tr('natures', D.natures[c.nature])),
            h('span', { class: 'chip', tip: DK.tr('passives', D.passives[c.passive], 'desc') }, DK.icon('sparkle', 13), DK.tr('passives', D.passives[c.passive]))),
          h('div', { class: 'recruit-stats' }, ['hp', 'atk', 'matk', 'spd'].map((k) => h('span', { tip: DK.tr('stats', D.stats[k]) }, DK.icon(D.stats[k].icon, 13), h('b', null, s[k])))),
          btn({ icon: 'plus', label: t('exp.recruitPick'), variant: 'primary', hotkey: String(i + 1), onClick: pick }));
      })),
      btn({ icon: 'next', label: t('exp.recruitSkip'), variant: 'ghost', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /* ---------- Panel de estado (sin nada pendiente) ---------- */
  /* ---------- Barra de estado (iconos sobre el mapa) ----------
   * Cada icono muestra un número y, al pulsarlo, despliega su detalle
   * debajo (params.hud = id). El equipo se ve como mini retratos con su
   * vida: pulsar uno lo elige para el siguiente combate.
   */
  function hudDetail(id, refresh) {
    const e = E().active();
    const items = Object.entries(e.loot.items);
    switch (id) {
      case 'loot': return h('div', { class: 'stack-s' },
        h('div', { class: 'row gap-s wrap' }, h('b', null, t('exp.loot')), V.coins(e.loot.coins)),
        items.length ? h('div', { class: 'chips' }, items.map(([iid, n]) => h('span', { class: 'chip' }, DK.icon(D.items[iid].icon, 13), `${D.items[iid].name} x${n}`))) : h('p', { class: 'muted small' }, t('exp.lootEmpty')),
        h('p', { class: 'muted small' }, t('exp.lootRule', { n: Math.round((E().bonusMult(Math.max(1, e.zones.length)) - 1) * 100) })));
      case 'relics': return DK.relics.list().length
        ? h('div', { class: 'list' }, DK.relics.list().map((r) => h('div', { class: 'relic-row r-' + r.rarity }, h('span', { class: 'relic-icon sm' }, DK.icon(r.icon, 18)), h('div', { class: 'grow' }, h('b', null, r.name), h('div', { class: 'muted small' }, relicText(r))))))
        : h('p', { class: 'muted small' }, t('exp.noRelics'));
      case 'saves': return h('div', { class: 'stack-s' },
        h('p', { class: 'small' }, t('exp.revivesLeft', { n: E().revivesLeft() }), DK.bag.count('pluma_fenix') ? ' · ' + t('exp.feathers', { n: DK.bag.count('pluma_fenix') }) : ''),
        e.blessed && DK.party.get(e.blessed) ? h('p', { class: 'small' }, DK.icon('sparkles', 13), ' ', t('exp.blessedNow', { name: DK.daskai.name(DK.party.get(e.blessed)) })) : null,
        h('p', { class: 'muted small' }, t('exp.revivesHelp')));
      case 'recruits': return E().recruits().length
        ? h('div', { class: 'stack-s' }, h('div', { class: 'chips' }, E().recruits().map((d) => h('span', { class: 'chip' }, DK.icon('paw', 13), `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`))), h('p', { class: 'muted small' }, t('exp.tempRule')))
        : h('p', { class: 'muted small' }, t('exp.noRecruits'));
      case 'pack': {
        const list = DK.bag.list().filter(({ item }) => item.category !== 'pieza');
        return h('div', { class: 'stack-s' },
          list.length ? h('div', { class: 'chips' }, list.map(({ item, qty }) => h('span', { class: 'chip' }, DK.icon(item.icon, 13), `${item.name} x${qty}`))) : h('p', { class: 'muted small' }, t('pack.empty')),
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'bag', label: t('nav.pack'), size: 'sm', variant: 'tone', onClick: () => DK.router.go('inventory') }),
            btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(DK.party.active())) refresh(); } })));
      }
      case 'emblems': return h('div', { class: 'stack-s' },
        h('p', { class: 'small' }, t('emblem.have', { n: DK.camp.emblems() }), (e.log.emblems ? ' · ' + t('emblem.thisRun', { n: e.log.emblems }) : '')),
        h('p', { class: 'muted small' }, t('emblem.help')));
      case 'curses': return h('div', { class: 'list' }, DK.curses.active().map((cid) => h('div', { class: 'relic-row' }, h('span', { class: 'relic-icon sm' }, DK.icon(D.curses[cid].icon, 18)),
        h('div', { class: 'grow' }, h('b', null, t('curse.' + cid + '.name')), h('div', { class: 'muted small' }, t('curse.' + cid + '.desc'))))));
      default: return null;
    }
  }

  function hud(params, refresh) {
    const e = E().active();
    const cur = fighter();
    const toggle = (id) => { params.hud = params.hud === id ? null : id; refresh(); };
    const icon = (id, ic, value, label, cls = '') => h('button', { class: 'hud-btn ' + cls + (params.hud === id ? ' on' : ''), type: 'button', tip: label, 'aria-label': label, 'aria-expanded': params.hud === id, onClick: () => toggle(id) },
      DK.icon(ic, 18), h('b', null, String(value)));
    const pack = DK.bag.list().filter(({ item }) => item.category !== 'pieza').reduce((a, x) => a + x.qty, 0);
    // Retratos del equipo: vida en un anillo; el elegido para el siguiente combate, resaltado
    const team = h('div', { class: 'hud-team' }, DK.party.active().map((d) => {
      const pct = Math.round(DK.daskai.hpPct(d) * 100), dead = DK.daskai.isFainted(d);
      const b = h('button', { class: 'hud-mon' + (cur && cur.uid === d.uid ? ' leader' : '') + (dead ? ' ko' : pct < 35 ? ' low' : ''), type: 'button', style: { '--p': pct + '%' },
        tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level} · ${pct}% ${t('common.hpShort')}${cur && cur.uid === d.uid ? ' · ' + t('battle.nextFighter') : ''}`,
        onClick: dead ? null : () => { e.leader = d.uid; DK.store.save(); DK.audio.sfx('select'); refresh(); } },
        V.sprite(d.species, { size: 34, shiny: d.shiny }), h('span', { class: 'hud-hp' }, h('i')));
      return b;
    }));
    const bar = h('div', { class: 'exp-hud card' },
      team,
      h('span', { class: 'hud-sep' }),
      icon('loot', 'gift', e.loot.coins, t('exp.loot'), 'gold'),
      icon('pack', 'bag', pack, t('nav.pack')),
      icon('relics', 'amulet', DK.relics.list().length, t('relics.title')),
      DK.rules.permadeath() || E().revivesLeft() ? icon('saves', 'sparkles', E().revivesLeft(), t('exp.revivesTitle')) : null,
      E().recruits().length ? icon('recruits', 'paw', E().recruits().length, t('exp.recruits')) : null,
      DK.curses.active().length ? icon('curses', 'skull', DK.curses.active().length, t('curse.active'), 'bad') : null,
      icon('emblems', 'emblem', DK.camp.emblems(), t('emblem.title'), 'emblem'),
      h('span', { class: 'grow' }),
      // Ya no hay retirada en cualquier momento: se vuelve a casa desde las hogueras
      h('span', { class: 'hud-lock muted small', tip: DK.rules.canRetreat() ? t('exp.exitRuleTip') : t('exp.noRetreat') }, DK.icon(DK.rules.canRetreat() ? 'campfire' : 'lock', 14), h('span', { class: 'hud-label' }, DK.rules.canRetreat() ? t('exp.exitRule') : '')));
    const detail = params.hud ? hudDetail(params.hud, refresh) : null;
    return h('div', { class: 'exp-hud-wrap' }, bar, detail ? h('div', { class: 'card exp-hud-detail' }, detail) : null,
      h('p', { class: 'muted small exp-hud-hint' }, DK.icon('swords', 12), ' ', t('exp.hudHint', { name: cur ? DK.daskai.name(cur) : '—' })));
  }

  /* ---------- Modo expedición ----------
   * Mientras hay una expedición en curso sólo se puede ir a estas
   * pantallas: el resto (inicio, crafteo, mejoras, códice...) espera en
   * casa. La navegación sólo muestra Mapa, Equipo y Mochila (`expedition`
   * en DK.menus.add('nav', ...)).
   */
  const EXP_SCREENS = ['expedition', 'battle', 'team', 'inventory', 'expSummary', 'gameOver', 'mainMenu', 'newGame', 'goodbye'];
  DK.router.guard = (id) => {
    if (!DK.store.state || !E().active() || EXP_SCREENS.includes(id)) return null;
    // Aviso sólo si se intenta salir desde la propia expedición (no al cargar la partida)
    const cur = DK.router.current();
    if (cur && !['mainMenu', 'newGame', 'battle'].includes(cur.id)) DK.ui.toast(t('exp.focusOnly'), { icon: 'flag' });
    return { id: 'expedition' };
  };
  DK.menus.add('nav', { id: 'expmap', icon: 'map', order: 5, screen: 'expedition', expedition: 'only', label: () => t('nav.expMap'), badge: () => (E().active() && E().active().awaitingChoice ? '!' : '') });

  /** Tarjeta de la barra lateral durante una expedición: zona, mapa y piso. */
  DK.views.expNavCard = (e) => {
    const z = D.zones[e.zone];
    return h('button', { class: 'nav-exp', type: 'button', style: { '--z1': z.colors[0], '--z2': z.colors[1] }, onClick: () => DK.router.reset('expedition') },
      h('span', { class: 'nav-exp-icon' }, DK.icon(z.icon, 20)),
      h('span', { class: 'nav-profile-text' }, h('b', null, z.name),
        h('span', { class: 'muted small' }, `${t('exp.depth', { n: e.depth || 1 })} · ${t('exp.floor', { step: Math.min(e.step, e.total), total: e.total })}`)));
  };

  DK.screens.register('expedition', {
    title: () => { const e = E().active(); return e ? t('exp.title', { zone: D.zones[e.zone].name }) : t('exp.titleNone'); },
    icon: 'flag', section: 'battle', music: 'menu', tutorial: 'expedition',
    render(params) {
      const refresh = () => DK.router.refresh();
      const e = E().active();
      if (!e) return h('div', { class: 'screen' }, DK.ui.empty('flag', t('exp.none'), t('exp.noneText')),
        btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') }));
      E().ensureMap(); E().ensureFields();
      const pend = E().pendingNode();
      // Vista centrada: mientras eliges una reliquia o estás en un nodo sin combate
      // (mercader, suceso, descanso, cofre, reclutas) el mapa se oculta.
      const focus = e.awaitingChoice ? choicePanel(refresh) : e.curseOffer ? cursePanel(e, params, refresh) : (e.relicChoice && e.relicChoice.length) ? relicPanel(e, refresh) : pend && !E().TYPES[pend.type].battle ? nodePanel(pend, refresh) : null;
      if (focus) {
        setTimeout(() => window.scrollTo({ top: 0 }), 0);
        const zone = D.zones[e.zone];
        return h('div', { class: 'screen exp-screen exp-focus' },
          h('div', { class: 'exp-focus-bar', style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
            DK.icon(zone.icon, 18), h('b', null, zone.name),
            h('span', { class: 'chip', tip: t('exp.depthTip') }, DK.icon('compass', 13), t('exp.depth', { n: e.depth || 1 })),
            h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(e.step, e.total), total: e.total })),
            h('span', { class: 'chip', tip: t('exp.lootCoinsTip') }, DK.icon('gift', 13), t('exp.lootNow', { items: E().lootCount(), coins: e.loot.coins })),
            h('span', { class: 'grow' }), relicBar()),
          h('div', { class: 'exp-focus-body' }, focus));
      }
      // Mapa a todo el ancho con la barra de estado encima (o el nodo pendiente al lado)
      return h('div', { class: 'screen exp-screen' }, hud(params, refresh),
        pend ? h('div', { class: 'exp-layout' }, mapView(refresh), h('div', { class: 'exp-side' }, nodePanel(pend, refresh))) : mapView(refresh));
    },
  });
})();
