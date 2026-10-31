/* =============================================================
 * screens/codex.js — Códice: bestiario de enemigos y objetos por zona.
 * Lo no descubierto aparece como ??? .
 * params: { zone, sub }
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);

  DK.menus.add('nav', { id: 'codex', icon: 'book', order: 50, screen: 'codex', label: () => t('nav.codex') });

  DK.screens.register('codex', {
    title: () => t('codex.title'), icon: 'book', section: 'codex', tutorial: 'codex', music: 'menu',
    render(params) {
      const zones = DK.codex.discoveredZones();
      if (!zones.length) return h('div', { class: 'screen' }, DK.ui.empty('book', t('codex.empty'), t('codex.emptyText')));
      return h('div', { class: 'screen' }, DK.ui.tabs({
        active: params.zone, onChange: (id) => (params.zone = id), cls: 'tabs-scroll',
        items: zones.map((zid) => ({ id: zid, label: D.zones[zid].name, icon: D.zones[zid].icon, count: Math.round(DK.codex.completion(zid) * 100) + '%', render: () => zoneView(zid, params) })),
      }));
    },
  });

  function zoneView(zid, params) {
    const zone = D.zones[zid];
    const cz = DK.codex.zone(zid);
    const enemies = zone.enemies.map((e) => e.species);
    const items = DK.codex.zoneItems(zid);
    const seenCount = enemies.filter((s) => cz.enemies[s]).length;
    const boss = zone.boss, bossDone = DK.world.boss(zid).defeated > 0;
    return h('div', null,
      h('div', { class: 'zone-banner', style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
        DK.icon(zone.icon, 26), h('div', null, h('h3', null, zone.name), h('span', null, `${t('common.lvl')} ${zone.levels[0]}-${zone.levels[1]} · ${zone.desc}`))),
      boss ? h('div', { class: 'card boss-card ' + (bossDone ? '' : 'unknown') },
        V.sprite(boss.species, { size: 64, silhouette: !bossDone }),
        h('div', { class: 'grow' }, h('span', { class: 'badge leader' }, DK.icon('crown', 13), t('codex.boss')), h('h4', null, bossDone ? `${boss.title} · ${D.species[boss.species].name}` : '???'),
          h('p', { class: 'muted small' }, bossDone ? t('codex.bossDefeated', { n: DK.world.boss(zid).defeated, level: boss.level }) : t('codex.bossHint')))) : null,
      DK.ui.tabs({
        active: params.sub, onChange: (id) => (params.sub = id),
        items: [
          { id: 'enemies', label: t('codex.enemies'), icon: 'paw', count: `${seenCount}/${enemies.length}`,
            render: () => h('div', { class: 'codex-grid' }, enemies.map((sid) => enemyCard(zid, sid))) },
          { id: 'items', label: t('codex.items'), icon: 'gift', count: `${cz.items.length}/${items.length}`,
            render: () => h('div', { class: 'item-grid' }, items.map((iid) => cz.items.includes(iid) ? V.itemCard(iid, null, { onClick: () => V.openItem(iid) }) : V.itemCard(iid, null, { unknown: true }))) },
        ],
      }));
  }

  function enemyCard(zid, sid) {
    const e = DK.codex.getEntry(zid, sid);
    const sp = D.species[sid];
    if (!e) return h('button', { class: 'codex-card unknown', type: 'button', disabled: true }, V.sprite(sid, { size: 80, silhouette: true }), h('b', null, '???'), h('span', { class: 'muted small' }, t('common.undiscovered')));
    const c = h('button', { class: 'codex-card', type: 'button', style: { '--c': D.houseColor(sp.house) } },
      V.sprite(sid, { size: 80 }), h('b', null, sp.name),
      V.houseBadge(sp.house, { known: e.fought > 0 }),
      h('span', { class: 'muted small' }, t('codex.defeatedN', { n: e.defeated })));
    c.addEventListener('click', () => openEnemy(zid, sid));
    return c;
  }

  function openEnemy(zid, sid) {
    const e = DK.codex.getEntry(zid, sid);
    const sp = D.species[sid];
    const zone = D.zones[zid];
    const known = e.fought > 0;
    const evo = sp.evolve && D.species[sp.evolve.into];
    DK.ui.modal({
      title: sp.name, icon: 'paw', size: 'wide',
      content: h('div', { class: 'codex-detail' },
        h('div', { class: 'codex-detail-head', style: { '--c': D.houseColor(sp.house) } },
          V.sprite(sid, { size: 130, cls: 'float' }),
          h('div', null,
            h('div', { class: 'row gap-s wrap' }, V.houseBadge(sp.house, { known }), h('span', { class: 'badge' }, DK.icon('map', 13), `${zone.name} · ${t('common.lvl')} ${zone.levels[0]}-${zone.levels[1]}`)),
            h('p', { class: 'muted' }, sp.desc),
            evo && known ? h('p', { class: 'small' }, DK.icon('evolve', 14), ' ', t('codex.evolves', { into: evo.name, n: sp.evolve.level })) : null,
            h('div', { class: 'chips' },
              h('span', { class: 'chip' }, DK.icon('eye', 13), t('codex.seen', { n: e.seen })),
              h('span', { class: 'chip' }, DK.icon('swords', 13), t('codex.fought', { n: e.fought })),
              h('span', { class: 'chip' }, DK.icon('trophy', 13), t('codex.defeatedN', { n: e.defeated })),
              h('span', { class: 'chip' }, DK.icon('orb', 13), t('codex.captured', { n: e.captured }))))),
        h('h4', null, DK.icon('swords', 16), ' ', t('codex.movesSeen')),
        e.moves.length ? h('div', { class: 'move-grid' }, e.moves.map((m) => V.moveCard(m, { compact: true, estimate: null }))) : h('p', { class: 'muted small' }, t('codex.noMoves')),
        h('h4', null, DK.icon('gift', 16), ' ', t('codex.drops')),
        h('div', { class: 'item-grid' }, sp.drops.map(([iid, p]) => e.drops.includes(iid)
          ? V.itemCard(iid, null, { note: t('codex.prob', { n: p < 0.01 ? (p * 100).toFixed(1) : Math.round(p * 100) }), onClick: () => V.openItem(iid) })
          : V.itemCard(iid, null, { unknown: true })))),
      actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost' }],
    });
  }
})();
