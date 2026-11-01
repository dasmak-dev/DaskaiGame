/* =============================================================
 * screens/hub.js — El campamento (pantalla principal).
 *
 *  - Arriba, la escena del campamento (components/camp.js): cada lugar
 *    lleva a una sección y tu equipo descansa junto a la hoguera.
 *  - Debajo: la próxima expedición (Enter), «Qué hacer ahora», tu equipo
 *    y las misiones del día.
 *  - Acciones extra que añadan otros archivos con
 *    DK.menus.add('hub', { id, icon, label, desc, action | screen })
 *    salen como botones bajo la expedición.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'home', icon: 'campfire', order: 10, screen: 'hub', pin: true, label: () => t('nav.home') });

  // Menú de acciones rápidas: otros archivos pueden añadir opciones con
  // DK.menus.add('hub', { id, icon, label, desc, action | screen }).
  // (No hay descanso gratis ni de pago: fuera de las expediciones sólo se cura con objetos.)
  DK.menus.define('hub');

  /** Tarjeta "Jugar" con el escenario de la zona de fondo. */
  function playCard(refresh) {
    const exp = DK.expedition.active();
    // Sin expedición: la zona del primer mapa de la próxima (se elige al azar)
    const z = exp ? D.zones[exp.zone] : D.zones[DK.expedition.nextStart().zone];
    const rec = DK.world.recommended();
    if (!z) return null;
    const problems = DK.world.warnings(z.id).filter((w) => w.kind !== 'good');
    const art = h('div', { class: 'play-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('div', { class: 'play-sprites' }, z.enemies.slice(0, 4).map((e) => V.sprite(e.species, { size: 56, silhouette: !DK.codex.getEntry(z.id, e.species), cls: 'float' }))));
    return h('div', { class: 'card play-card' }, art,
      h('div', { class: 'play-body' },
        h('span', { class: 'muted small' }, exp ? t('home.expedition') : t('exp.firstMap')),
        h('h2', null, z.name),
        h('div', { class: 'chips' }, h('span', { class: 'chip' }, DK.icon('star', 13), `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`),
          V.sizeChip(exp ? DK.expedition.size() : DK.expedition.nextStart().size),
          exp ? h('span', { class: 'chip' }, DK.icon('compass', 13), t('exp.depth', { n: exp.depth || 1 })) : null,
          exp ? h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.progress', { step: exp.step, total: exp.total, items: DK.expedition.lootCount(), coins: exp.loot.coins })) : null,
          !exp && DK.expedition.bestDepth() ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('exp.best', { n: DK.expedition.bestDepth() })) : null),
        problems.length ? V.warnings(problems, async () => { if (await V.healDialog(DK.party.active())) refresh(); }) : null,
        h('div', { class: 'row gap-s wrap' },
          btn({ icon: exp ? 'map' : 'play', label: exp ? t('exp.openMap') : t('home.playExp'), size: 'lg', variant: 'primary', hotkey: '↵', cls: 'play-btn', onClick: () => DK.play.quick() }),
          !exp && rec && DK.world.freeUnlocked(rec.id) ? btn({ icon: 'swords', label: t('zones.free'), variant: 'tone', tip: t('zones.freeDesc') + ' · ' + rec.name, onClick: () => DK.play.start(rec.id) }) : null,
          btn({ icon: 'map', label: t('nav.battle'), variant: 'ghost', onClick: () => DK.router.reset('zones') }))));
  }

  DK.screens.register('hub', {
    title: () => t('nav.home'), icon: 'campfire', section: 'home', back: false, music: 'menu', tutorial: 'hub',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.todo = params.todo || {};
      const team = DK.party.active();
      DK.keys.on('Enter', () => DK.play.quick());

      const teamCard = h('div', { class: 'card' },
        h('div', { class: 'panel-head' }, DK.icon('users', 18), h('h3', null, t('home.yourTeam')),
          btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', tip: t('heal.tip'), onClick: async () => { if (await V.healDialog(team)) refresh(); } }),
          btn({ icon: 'edit', label: t('home.manage'), size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('team') })),
        h('div', { class: 'home-team' }, team.map((d) => {
          const row = V.daskaiRow(d, { compact: true, onClick: () => DK.router.reset('team', { uid: d.uid }) });
          DK.ui.attachContextMenu(row, () => V.daskaiActions(d, { onChange: refresh, onOpen: () => DK.router.reset('team', { uid: d.uid }) }));
          return row;
        })));

      const daily = DK.missions.list('daily');
      const missionsCard = h('div', { class: 'card' },
        h('div', { class: 'panel-head' }, DK.icon('scroll', 18), h('h3', null, t('home.today')),
          btn({ icon: 'next', label: t('home.allMissions'), size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('progress', { tab: 'missions' }) })),
        h('div', { class: 'list' }, daily.map((m) => V.missionCard(m, refresh, { compact: true }))));

      const extra = DK.menus.items('hub');
      const extraRow = extra.length ? h('div', { class: 'row gap-s wrap' }, extra.map((it) => btn({ icon: it.icon, label: typeof it.label === 'function' ? it.label() : it.label, variant: it.variant || 'tone', tip: typeof it.desc === 'function' ? it.desc() : it.desc, onClick: () => DK.menus.activate(it) }))) : null;

      return h('div', { class: 'screen hub camp-screen' },
        V.campScene({ team }),
        h('div', { class: 'camp-panels' },
          h('div', { class: 'stack' }, playCard(refresh), extraRow, V.todoCard(refresh, params.todo)),
          h('div', { class: 'stack' }, teamCard, missionsCard)));
    },
  });

})();
