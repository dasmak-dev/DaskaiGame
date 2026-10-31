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
  const t = (k, v) => DK.t(k, v);
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
   * Mejoras permanentes: se compran AQUÍ, al terminar la expedición, con los
   * emblemas (1 por jefe). Sólo en el resumen de la última expedición.
   */
  function upgradeShop(s, params, refresh) {
    const U = D.upgrades;
    const open = params.shop != null ? params.shop : DK.camp.affordable() > 0;
    const n = DK.camp.affordable();
    return h('div', { class: 'card stack-s sum-shop' },
      h('div', { class: 'panel-head' }, DK.icon('emblem', 18), h('h3', null, t('sum.shopTitle')),
        h('span', { class: 'grow' }), V.emblems(DK.camp.emblems()),
        btn({ icon: open ? 'arrowUp' : 'arrowDown', label: open ? t('sum.shopHide') : t('sum.shopShow'), size: 'sm', variant: 'ghost', onClick: () => { params.shop = !open; refresh(); } })),
      h('p', { class: 'muted small' }, s.emblems ? tn('sum.shopEarned', s.emblems) : t('sum.shopNone'), ' ', n ? tn('sum.shopCan', n) : t('sum.shopSave')),
      open ? DK.data.upgradeGroups.map((g) => h('section', { class: 'stack-s' },
        h('h4', { class: 'camp-group' }, t('camp.group.' + g)),
        h('div', { class: 'camp-grid' }, U.filter((u) => u.group === g).map((u) => V.upgradeCard(u, refresh, true))))) : null);
  }

  /** Chips de objetos { id: n }. lost=true los muestra tachados. */
  const itemChips = (items, lost) => {
    const list = Object.entries(items || {});
    return list.length ? h('div', { class: 'chips' }, list.map(([id, n]) => D.items[id] ? h('span', { class: 'chip ' + (lost ? 'neg' : 'pos') }, DK.icon(D.items[id].icon, 13), lost ? h('s', null, `${D.items[id].name} x${n}`) : `${D.items[id].name} x${n}`) : null)) : h('p', { class: 'muted small' }, t('sum.none'));
  };

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
      DK.keys.on('Enter', home);

      const hero = h('div', { class: 'card sum-hero ' + o.cls, style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
        h('span', { class: 'sum-icon' }, DK.icon(o.icon, 40)),
        h('div', { class: 'grow' },
          h('span', { class: 'muted small' }, t('exp.title', { zone: zone.name })),
          h('h2', null, t('sum.out.' + s.outcome)),
          h('p', { class: 'muted' }, t('sum.outText.' + s.outcome, { n: Math.round(((s.mult || DK.config.expeditionBonus) - 1) * 100) })),
          h('div', { class: 'chips' },
            h('span', { class: 'chip pos' }, DK.icon('compass', 13), t('sum.depth', { n: depth, maps: zonesDone.length })),
            s.emblems ? h('span', { class: 'chip pos' }, DK.icon('emblem', 13), t('emblem.plus', { n: s.emblems })) : null,
            (s.secrets || []).length ? h('span', { class: 'chip pos' }, DK.icon('cave', 13), tn('sum.secrets', s.secrets.length)) : null,
            h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(s.step, s.total), total: s.total })),
            h('span', { class: 'chip' }, DK.icon('clock', 13), DK.util.duration(mins)),
            h('span', { class: 'chip' }, DK.icon('map', 13), t('sum.nodes', { n: totalNodes })),
            s.difficulty ? h('span', { class: 'chip' }, DK.icon(DK.data.difficulties[s.difficulty].icon, 13), t('difficulty.' + s.difficulty + '.name')) : null)),
        h('div', { class: 'sum-actions' },
          btn({ icon: 'home', label: t('nav.home'), variant: 'primary', hotkey: '↵', onClick: home }),
          btn({ icon: 'flag', label: t('sum.again'), variant: 'tone', onClick: again }),
          latest ? null : btn({ icon: 'star', label: t('nav.camp'), variant: 'ghost', onClick: () => DK.router.reset('camp') })));

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
        s.packBack || s.lostPack ? h('h4', null, DK.icon('bag', 14), ' ', s.packBack ? t('sum.packBack') : t('sum.packLost')) : null,
        s.packBack ? itemChips(s.packBack) : s.lostPack ? itemChips(s.lostPack, true) : null,
        (s.outcome === 'lostBoss' || s.outcome === 'campfire') && s.lostPack && Object.keys(s.lostPack).length ? [h('h4', null, DK.icon('skull', 14), ' ', t('sum.packLost')), itemChips(s.lostPack, true)] : null);

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
        latest && !DK.store.state.gameOver ? upgradeShop(s, params, refresh) : null,
        h('div', { class: 'sum-grid' }, pathCard, h('div', { class: 'stack' }, rewards, people, extras)));
    },
  });
})();
