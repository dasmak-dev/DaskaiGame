/* =============================================================
 * screens/expSummary.js — Resumen al terminar una expedición.
 *
 * Se abre al derrotar al jefe, al retirarse o al perder. Usa el
 * resumen guardado en DK.store.state.lastExpedition (lo crea
 * DK.expedition.snapshot): camino recorrido, nodos visitados,
 * mapas superados (profundidad), botín, reclutas y reliquias.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  /** Singular (clave + 'One') cuando n es 1. */
  const tn = (key, n) => t(n === 1 ? key + 'One' : key, { n });

  const OUT = {
    completed: { icon: 'trophy', cls: 'good' },
    retreat: { icon: 'flag', cls: 'warn' },
    lost: { icon: 'skull', cls: 'bad' },
    lostBoss: { icon: 'crown', cls: 'bad' },
    campfire: { icon: 'campfire', cls: 'warn' },
  };

  /**
   * Mejoras permanentes: sólo existen AQUÍ, al terminar la expedición. El menú
   * se abre solo la primera vez que se ve el resumen (s.shopShown) y se
   * puede volver a abrir con la tarjeta o el botón de arriba.
   */
  function upgradeCardSummary(s, refresh) {
    const n = DK.camp.affordable();
    return h('button', { class: 'card sum-shop', type: 'button', onClick: () => V.upgradeMenu(refresh) },
      h('span', { class: 'sum-shop-icon' }, DK.icon('emblem', 26)),
      h('span', { class: 'grow stack-s' }, h('b', null, t('sum.shopTitle')),
        h('span', { class: 'muted small' }, s.emblems ? tn('sum.shopEarned', s.emblems) : t('sum.shopNone'), ' ', n ? tn('sum.shopCan', n) : t('sum.shopSave'))),
      V.emblems(DK.camp.emblems()), DK.icon('next', 18));
  }

  /** Chips de objetos { id: n }. lost=true los muestra tachados. */
  const itemChips = (items, lost) => {
    const list = Object.entries(items || {});
    return list.length ? h('div', { class: 'chips' }, list.map(([id, n]) => D.items[id] ? h('span', { class: 'chip ' + (lost ? 'neg' : 'pos') }, DK.icon(D.items[id].icon, 13), lost ? h('s', null, `${D.items[id].name} x${n}`) : `${D.items[id].name} x${n}`) : null)) : h('p', { class: 'muted small' }, t('sum.none'));
  };

  /* ---------- Línea de tiempo ---------- */
  const TL_ICON = { start: 'flag', newMap: 'map', elite: 'skull', boss: 'crown', secret: 'cave', recruit: 'paw', relic: 'amulet', cave: 'cave', caveTreasure: 'gift',
    shortcut: 'shortcut', event: 'question', saved: 'sparkles', fallen: 'skull', mapCleared: 'trophy', campfire: 'campfire', cashout: 'coin', retreat: 'flag', lost: 'skull', quest: 'checkCircle' };
  const TL_KIND = { boss: 'good', secret: 'good', mapCleared: 'good', recruit: 'good', relic: 'good', cashout: 'good', quest: 'good', fallen: 'bad', lost: 'bad', saved: 'warn' };
  function tlText(ev) {
    const v = ev.v || {};
    const vars = Object.assign({}, v);
    if (v.zone) vars.zone = D.zones[v.zone] ? D.zones[v.zone].name : v.zone;
    if (v.size) vars.size = t('size.' + v.size + '.name');
    if (v.species) vars.species = D.species[v.species] ? D.species[v.species].name : v.species;
    if (v.id && ev.k === 'relic') vars.relic = D.relics[v.id] ? D.relics[v.id].name : v.id;
    if (v.id && ev.k === 'event') vars.event = t(`events.${v.id}.title`);
    if (v.id && ev.k === 'quest') vars.name = t(`quest.${v.id}.name`);
    let text = t('tl.' + ev.k, vars);
    if ((ev.k === 'start' || ev.k === 'newMap') && v.mod) text += ' · ' + t('mod.' + v.mod + '.name');
    return text;
  }
  function timeline(s) {
    const list = s.timeline || [];
    if (!list.length) return null;
    const t0 = list[0].at;
    return h('div', { class: 'card stack-s sum-tl' },
      h('div', { class: 'panel-head' }, DK.icon('clock', 18), h('h3', null, t('sum.timeline')), h('span', { class: 'muted small' }, t('sum.moments', { n: list.length }))),
      h('ol', { class: 'tl' }, list.map((ev) => h('li', { class: 'tl-item k-' + (TL_KIND[ev.k] || '') },
        h('span', { class: 'tl-dot' }, DK.icon(TL_ICON[ev.k] || 'info', 14)),
        h('span', { class: 'tl-text' }, tlText(ev)),
        h('span', { class: 'tl-meta muted small' }, `${t('exp.depth', { n: ev.d })}${ev.f ? ' · ' + t('sum.floorN', { n: ev.f }) : ''} · ${DK.util.duration(Math.round((ev.at - t0) / 1000))}`)))));
  }
  /** Comparación con tu mejor expedición anterior (por profundidad y luego monedas). */
  function compare(s) {
    const hist = (DK.store.state.expHistory || []).filter((x) => x !== s && x.endedAt !== s.endedAt);
    if (!hist.length) return null;
    const best = hist.slice().sort((a, b) => (b.depth || 1) - (a.depth || 1) || (b.coins || 0) - (a.coins || 0))[0];
    const row = (icon, label, now, prev, fmt = String) => {
      const diff = now - prev;
      return h('div', { class: 'cmp-row' }, DK.icon(icon, 15), h('span', { class: 'grow' }, label), h('b', null, fmt(now)),
        h('span', { class: 'cmp-diff ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '') }, diff > 0 ? '▲ ' + fmt(diff) : diff < 0 ? '▼ ' + fmt(-diff) : '='), h('span', { class: 'muted small' }, t('sum.bestWas', { v: fmt(prev) })));
    };
    const dur = (x) => Math.round(((x.endedAt || 0) - (x.startedAt || 0)) / 1000);
    const isRecord = (s.depth || 1) > (best.depth || 1) || ((s.depth || 1) === (best.depth || 1) && (s.coins || 0) > (best.coins || 0));
    return h('div', { class: 'card stack-s sum-cmp' },
      h('div', { class: 'panel-head' }, DK.icon('trophy', 18), h('h3', null, t('sum.compare')), isRecord ? h('span', { class: 'badge good' }, DK.icon('star', 12), t('sum.newRecord')) : null),
      row('compass', t('sum.cmpDepth'), s.depth || 1, best.depth || 1),
      row('coin', t('sum.cmpCoins'), s.coins || 0, best.coins || 0),
      row('emblem', t('emblem.title'), s.emblems || 0, best.emblems || 0),
      row('clock', t('sum.cmpTime'), dur(s), dur(best), (n) => DK.util.duration(n)));
  }

  DK.screens.register('expSummary', {
    title: () => t('sum.title'), icon: 'list', section: 'battle', music: 'menu',
    /** params.index → resumen de DK.store.state.expHistory[index] (desde el Perfil); si no, el último. */
    render(params) {
      const refresh = () => DK.router.refresh();
      const hist = DK.store.state.expHistory || [];
      const s = params && params.index != null ? hist[params.index] : DK.store.state.lastExpedition;
      if (!s) return h('div', { class: 'screen' }, DK.ui.empty('list', t('sum.empty'), ''), btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') }));
      const zone = D.zones[s.zone];
      const o = OUT[s.outcome] || OUT.retreat;
      const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 1000));
      const nodes = Object.entries(s.nodes || {});
      const totalNodes = nodes.reduce((a, [, n]) => a + n, 0);
      const kept = s.outcome === 'completed' || s.outcome === 'campfire';
      const latest = !(params && params.index != null);
      const again = () => DK.play.quick();
      const depth = s.depth || 1, zonesDone = s.zones || [];
      const home = () => DK.router.reset(DK.store.state.gameOver ? 'gameOver' : 'hub');
      // Objetivos de crafteo que ya se pueden fabricar con lo traído
      if (latest) DK.crafting.newlyReadyFavorites().forEach((rc) => DK.ui.toast(t('bag.favReady', { item: D.items[rc.result].name }), { icon: 'star', kind: 'good' }));
      const goalsReady = latest ? DK.crafting.goalsReady() : [];
      // El menú de Mejoras se abre solo al llegar al resumen (una vez por expedición)
      if (latest && !DK.store.state.gameOver && !s.shopShown) { s.shopShown = true; DK.store.save(); setTimeout(() => V.upgradeMenu(refresh), 350); }
      DK.keys.on('Enter', home);

      const hero = h('div', { class: 'card sum-hero ' + o.cls, style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
        h('span', { class: 'sum-icon' }, DK.icon(o.icon, 40)),
        h('div', { class: 'grow' },
          h('span', { class: 'muted small' }, t('exp.title', { zone: zone.name })),
          h('h2', null, t('sum.out.' + s.outcome)),
          h('p', { class: 'muted' }, t('sum.outText.' + s.outcome, { n: Math.round(((s.mult || DK.config.expeditionBonus) - 1) * 100) })),
          h('div', { class: 'chips' },
            h('span', { class: 'chip pos' }, DK.icon('compass', 13), t('sum.depth', { n: depth, maps: zonesDone.length })),
            // Desafío semanal: puntos, récord y premio
            s.weekly ? h('span', { class: 'chip gold wk-chip', tip: s.weekly.reward ? t('weekly.gotReward', { e: s.weekly.reward.emblems }) : t('weekly.title') }, DK.icon('trophy', 13), t('weekly.result', { n: s.weekly.score.toLocaleString(DK.i18n.lang) }), s.weekly.isBest ? ' · ' + t('weekly.newBest') : '') : null,
            s.emblems ? h('span', { class: 'chip pos' }, DK.icon('emblem', 13), t('emblem.plus', { n: s.emblems })) : null,
            (s.runes || []).length ? h('span', { class: 'chip pos rune-chip', tip: s.runes.map((id) => V.runeName(id)).join(', ') }, DK.icon('rune', 13), `+${s.runes.length} ${t('rune.short')}`) : null,
            (s.secrets || []).length ? h('span', { class: 'chip pos' }, DK.icon('cave', 13), tn('sum.secrets', s.secrets.length)) : null,
            h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(s.step, s.total), total: s.total })),
            h('span', { class: 'chip' }, DK.icon('clock', 13), DK.util.duration(mins)),
            h('span', { class: 'chip' }, DK.icon('map', 13), t('sum.nodes', { n: totalNodes })),
            s.difficulty ? h('span', { class: 'chip' }, DK.icon(DK.data.difficulties[s.difficulty].icon, 13), t('difficulty.' + s.difficulty + '.name')) : null)),
        h('div', { class: 'sum-actions' },
          btn({ icon: 'home', label: t('nav.home'), variant: 'primary', hotkey: '↵', onClick: home }),
          btn({ icon: 'flag', label: t('sum.again'), variant: 'tone', onClick: again }),
          latest && !DK.store.state.gameOver ? btn({ icon: 'emblem', label: t('sum.shopTitle'), variant: 'ghost', onClick: () => V.upgradeMenu(refresh) }) : null));

      const pathCard = h('div', { class: 'stack-s' },
        zonesDone.length ? h('div', { class: 'card stack-s' }, h('div', { class: 'panel-head' }, DK.icon('crown', 18), h('h3', null, t('sum.maps'))),
          h('div', { class: 'chips' }, zonesDone.map((zid, i) => h('span', { class: 'chip pos' }, DK.icon(D.zones[zid].icon, 13), `${i + 1}. ${D.zones[zid].name}`)))) : null,
        h('span', { class: 'muted small' }, t('sum.lastMap', { zone: zone.name })),
        V.expMap(s),
        h('div', { class: 'card stack-s' },
          h('div', { class: 'panel-head' }, DK.icon('compass', 18), h('h3', null, t('sum.path'))),
          nodes.length ? h('div', { class: 'sum-nodes' }, nodes.map(([type, n]) => h('div', { class: 'sum-node t-' + type },
            h('span', { class: 'exp-legend-icon t-' + type }, DK.icon(DK.expedition.TYPES[type].icon, 14)), h('span', { class: 'grow' }, t('exp.node.' + type)), h('b', null, n)))) : h('p', { class: 'muted small' }, t('sum.none'))));

      const rewards = h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('gift', 18), h('h3', null, t('sum.rewards'))),
        h('div', { class: 'row between' }, h('span', null, t('sum.coins')), kept || s.outcome === 'retreat' || s.outcome === 'lostBoss' ? V.coins(s.coins || 0) : h('s', { class: 'muted' }, String(s.lostCoins || 0))),
        s.outcome === 'campfire' ? h('p', { class: 'muted small' }, t('sum.campfireLost', { pct: 100 - (s.keepPct || 50), coins: s.lostCoins || 0 })) : null,
        s.lootSpent ? h('p', { class: 'muted small' }, t('sum.spent', { n: s.lootSpent })) : null,
        h('h4', null, DK.icon('flag', 14), ' ', s.outcome === 'lost' ? t('sum.lootLost') : t('sum.loot')),
        s.outcome === 'lost' ? itemChips(s.lostItems, true) : itemChips(s.items),
        s.outcome === 'lostBoss' || s.outcome === 'campfire' ? [h('h4', null, DK.icon('skull', 14), ' ', t('sum.lootLost')), itemChips(s.lostItems, true)] : null,
        h('h4', null, DK.icon('bag', 14), ' ', t('sum.toBag')),
        itemChips(s.toBag),
        s.packBack && Object.keys(s.packBack).length ? [h('h4', null, DK.icon('bag', 14), ' ', t('sum.packBack')), itemChips(s.packBack)] : null,
        s.lostPack && Object.keys(s.lostPack).length ? [h('h4', null, DK.icon('skull', 14), ' ', t('sum.packLost')), itemChips(s.lostPack, true)] : null);

      const recruits = (s.recruits || []);
      const people = h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('paw', 18), h('h3', null, t('sum.recruits'))),
        recruits.length ? h('div', { class: 'list' }, recruits.map((x) => { const k = x.kept != null ? x.kept : kept; return h('div', { class: 'sum-recruit ' + (k ? 'kept' : 'left') },
          V.sprite(x.species, { size: 44 }), h('b', { class: 'grow' }, x.name),
          h('span', { class: 'badge ' + (k ? 'good' : 'bad') }, DK.icon(k ? 'check' : 'x', 13), k ? t('sum.kept') : t('sum.left'))); })) : h('p', { class: 'muted small' }, t('sum.noRecruits')));

      const fallen = s.fallen || [];
      if (fallen.length) people.append(h('h4', null, DK.icon('skull', 14), ' ', t('sum.fallen')),
        h('div', { class: 'chips' }, fallen.map((x) => h('span', { class: 'chip neg' }, DK.icon('skull', 13), `${x.name} · ${t('common.lvl')} ${x.level}`))));
      const relics = (s.relics || []).map((id) => D.relics[id]).filter(Boolean);
      const extras = h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('amulet', 18), h('h3', null, t('relics.title'))),
        relics.length ? h('div', { class: 'list' }, relics.map((r) => h('div', { class: 'relic-row r-' + r.rarity }, h('span', { class: 'relic-icon sm' }, DK.icon(r.icon, 18)), h('div', { class: 'grow' }, h('b', null, r.name), h('div', { class: 'muted small' }, V.relicText(r)))))) : h('p', { class: 'muted small' }, t('sum.none')));

      return h('div', { class: 'screen sum-screen' }, hero,
        latest && !DK.store.state.gameOver ? upgradeCardSummary(s, refresh) : null,
        goalsReady.length ? h('button', { class: 'card sum-goals', type: 'button', onClick: () => DK.router.reset('craft', { sel: goalsReady[0].id }) },
          h('span', { class: 'sum-shop-icon goals' }, DK.icon('star', 24)),
          h('span', { class: 'grow stack-s' }, h('b', null, t('craft.goalsReadyTitle')), h('span', { class: 'muted small' }, goalsReady.map((r) => D.items[r.result].name).join(', '))),
          DK.icon('next', 18)) : null,
        h('div', { class: 'sum-grid' }, h('div', { class: 'stack' }, compare(s), timeline(s), pathCard), h('div', { class: 'stack' }, rewards, people, extras)));
    },
  });
})();
