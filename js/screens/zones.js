/* =============================================================
 * screens/zones.js — Batalla.
 *   Arriba: la expedición (empezar una nueva, o seguir la que está en
 *   curso). Las expediciones son infinitas y eligen zona al azar
 *   (systems/expedition.js), así que aquí no se elige zona para ellas.
 *   Abajo: las zonas, con su información y los combates libres
 *   (que se desbloquean al derrotar al jefe de esa zona).
 *
 *   DK.play.start(zona, { expedition })  → combate libre, o expedición (la zona se ignora)
 *   DK.play.quick()                      → continúa la expedición o empieza una
 *
 * params: { zone }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'battle', icon: 'swords', order: 40, pin: true, screen: 'zones', label: () => t('nav.battle'), badge: () => (DK.expedition.active() ? '!' : '') });

  /* ---------- Empezar combates desde cualquier pantalla ---------- */
  DK.play = {
    /**
     * Empieza un combate en una zona.
     * @param {string} zoneId
     * @param {Object} [o] {expedition: true para empezar/continuar una expedición}
     * @returns {boolean} false si no hay daskai en pie
     */
    start(zoneId, { expedition = false } = {}) {
      let alive = DK.party.aliveActive();
      // Fuera de expedición, si nadie del equipo está en pie se recupera lo justo para salir
      if (!alive.length && !DK.expedition.active()) { DK.expedition.afterEnd(); alive = DK.party.aliveActive(); }
      if (!alive.length) { DK.audio.sfx('error'); DK.ui.toast(t('warn.allFainted'), { icon: 'skull', kind: 'bad' }); return false; }
      const exp = DK.expedition.active();
      if (exp && !expedition) { DK.ui.toast(t('zones.expBusy'), { icon: 'flag', kind: 'bad' }); return false; }
      if (expedition) {
        // Antes de salir se prepara la mochila (screens/expPrepare.js);
        // las expediciones se juegan desde su mapa (screens/expedition.js)
        DK.router.go(exp ? 'expedition' : 'expPrepare');
        return true;
      }
      if (!DK.world.freeUnlocked(zoneId)) { DK.audio.sfx('error'); DK.ui.toast(t('zones.freeLocked'), { icon: 'lock', kind: 'bad' }); return false; }
      DK.router.go('battle', { zone: zoneId, leaderUid: alive[0].uid });
      return true;
    },
    /** Botón "Jugar": continúa la expedición o entra en la zona recomendada. */
    quick() {
      const exp = DK.expedition.active();
      if (exp) return this.start(exp.zone, { expedition: true });
      return this.start(null, { expedition: true });
    },
  };

  /** Contenido del panel de una zona (también se usa en el panel deslizante del móvil). */
  function zonePanel(z, refresh) {
    const exp = DK.expedition.active();
    const team = DK.party.active();
    const ok = DK.party.aliveActive().length > 0;
    const prog = DK.world.progress(z.id);
    const bossDone = DK.world.boss(z.id).defeated > 0;
    const expHere = exp && exp.zone === z.id;
    const art = h('div', { class: 'zone-panel-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('div', { class: 'zone-panel-title' }, DK.icon(z.icon, 22), h('div', null, h('h3', null, z.name), h('span', null, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`))),
      h('div', { class: 'zone-mini-sprites' }, z.enemies.map((e) => V.sprite(e.species, { size: 44, silhouette: !DK.codex.getEntry(z.id, e.species) }))));
    return h('div', { class: 'stack-s zone-panel' }, art,
      h('p', { class: 'muted small' }, z.desc),
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, DK.icon('trophy', 13), t('zones.wins', { n: prog.wins })),
        h('span', { class: 'chip' }, DK.icon('book', 13), Math.round(DK.codex.completion(z.id) * 100) + '%'),
        z.boss ? h('span', { class: 'chip' }, DK.icon('crown', 13), bossDone ? t('zones.bossDone') : t('zones.bossLevel', { n: z.boss.level })) : null),
      recordsBlock(z),
      expHere ? h('div', { class: 'warning warn' }, DK.icon('flag', 18), h('span', null, t('zones.inExpedition'))) : null,
      h('div', { class: 'zone-panel-actions' },
        DK.world.freeUnlocked(z.id)
          ? btn({ icon: 'swords', label: t('zones.free'), desc: t('zones.freeDesc'), size: 'lg', variant: 'tone', disabled: !ok || !!exp, tip: exp ? t('zones.expBusy') : null, onClick: () => DK.play.start(z.id) })
          : btn({ icon: 'lock', label: t('zones.free'), desc: t('zones.freeLocked'), size: 'lg', variant: 'tone', disabled: true })),
      h('div', { class: 'row between gap-s' }, h('b', null, t('confirm.question')),
        btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(team)) refresh(); } })),
      h('div', { class: 'list' }, team.map((d, i) => V.daskaiRow(d, { compact: true, tags: i === 0 ? [h('span', { class: 'badge leader' }, DK.icon('crown', 13), t('common.leader'))] : [] }))),
      h('button', { class: 'link-btn', type: 'button', onClick: () => DK.router.reset('team') }, DK.icon('users', 14), ' ', t('zones.editTeam')));
  }

  /** Récords de una zona: mapas superados, mejor profundidad, tamaños, jefe oculto y el mapa más rápido. */
  function recordsBlock(z) {
    const r = DK.world.progress(z.id).rec || { maps: 0, best: 0, sizes: {}, fastest: null };
    const sec = DK.world.secret(z.id);
    const cell = (icon, label, value, dim) => h('div', { class: 'zr-cell' + (dim ? ' dim' : '') }, DK.icon(icon, 16), h('b', null, value), h('span', { class: 'muted small' }, label));
    return h('section', { class: 'zone-records' }, h('h4', null, DK.icon('trophy', 14), ' ', t('zones.records')),
      h('div', { class: 'zr-grid' },
        cell('map', t('zones.recMaps'), String(r.maps), !r.maps),
        cell('compass', t('zones.recDepth'), r.best ? t('exp.depth', { n: r.best }) : '—', !r.best),
        cell('mountain', t('zones.recXl'), String(r.sizes.xl || 0), !r.sizes.xl),
        cell('cave', t('zones.recSecret'), sec.defeated ? '×' + sec.defeated : '—', !sec.defeated),
        cell('clock', t('zones.recFast'), r.fastest ? DK.util.duration(Math.round(r.fastest / 1000)) : '—', !r.fastest)));
  }

  /** Tarjeta de la expedición: empezar una nueva o seguir la que está en curso. */
  function expeditionCard(refresh) {
    const exp = DK.expedition.active();
    const ok = DK.party.aliveActive().length > 0;
    const team = DK.party.active();
    const best = DK.expedition.bestDepth();
    if (exp) {
      const z = D.zones[exp.zone];
      return h('div', { class: 'card exp-launch active', style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
        h('div', { class: 'exp-launch-main' },
          h('span', { class: 'exp-launch-icon' }, DK.icon('flag', 30)),
          h('div', { class: 'grow' }, h('span', { class: 'muted small' }, t('home.expedition')), h('h2', null, z.name),
            h('div', { class: 'chips' },
              h('span', { class: 'chip' }, DK.icon('compass', 13), t('exp.depth', { n: exp.depth || 1 })),
              h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(exp.step, exp.total), total: exp.total })),
              h('span', { class: 'chip' }, DK.icon('gift', 13), t('exp.lootNow', { items: DK.expedition.lootCount(), coins: exp.loot.coins })))),
          h('div', { class: 'exp-launch-actions' },
            btn({ icon: 'map', label: t('exp.openMap'), size: 'lg', variant: 'primary', disabled: !ok, hotkey: '↵', onClick: () => DK.play.quick() }),
            h('span', { class: 'muted small', tip: t('exp.exitRuleTip') }, DK.icon('campfire', 13), ' ', t('exp.exitRule')))),
        V.warnings(DK.world.warnings(exp.zone), async () => { if (await V.healDialog(team)) refresh(); }));
    }
    const pv = DK.expedition.preview();
    const z = D.zones[pv.zone];
    return h('div', { class: 'card exp-launch', style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'exp-launch-main' },
        h('span', { class: 'exp-launch-icon' }, DK.icon('compass', 30)),
        h('div', { class: 'grow' }, h('h2', null, t('exp.start')), h('p', { class: 'muted small' }, t('exp.infiniteText')),
          h('div', { class: 'chips' },
            h('span', { class: 'chip' }, DK.icon(z.icon, 13), t('exp.nextZone', { zone: z.name })),
            V.sizeChip(pv.size), V.modChip(pv.mod),
            best ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('exp.best', { n: best })) : null,
            h('span', { class: 'chip' }, DK.icon('map', 13), t('zones.unlockedN', { n: DK.world.unlockedZones().length, total: Object.keys(D.zones).length })))),
        h('div', { class: 'exp-launch-actions' },
          btn({ icon: 'flag', label: t('exp.start'), desc: t('exp.startDesc'), size: 'lg', variant: 'primary', disabled: !ok, hotkey: '↵', onClick: () => DK.play.quick() }))),
      DK.rules.permadeath() ? h('div', { class: 'warning bad' }, DK.icon('skull', 18), h('span', null, t('zones.permadeath'))) : null,
      V.warnings(DK.world.warnings(pv.zone), async () => { if (await V.healDialog(team)) refresh(); }),
      // Vista previa del primer mapa (es el mismo que saldrá al empezar)
      h('details', { class: 'zone-preview' }, h('summary', null, DK.icon('map', 15), ' ', t('zones.preview')),
        DK.views.expMap(pv, { compact: true })));
  }

  DK.screens.register('zones', {
    title: () => t('zones.title'), icon: 'map', section: 'battle', tutorial: 'zones', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      const rec = DK.world.recommended();
      const exp = DK.expedition.active();
      if (!params.zone || !DK.world.isUnlocked(params.zone)) params.zone = exp ? exp.zone : rec && rec.id;
      // En el móvil la zona sólo se abre al pulsarla (panel deslizante)
      const sel = D.zones[params.zone];

      /** Selecciona una zona (panel derecho o deslizante en móvil). */
      const choose = (z) => {
        params.zone = z.id;
        if (!DK.ui.isNarrow()) { refresh(); return; }
        const holder = h('div');
        const draw = () => holder.replaceChildren(zonePanel(z, () => { draw(); refresh(); }));
        draw();
        DK.ui.drawer({ title: z.name, icon: z.icon, content: holder });
        refresh();
      };

      /*
       * Mapa del mundo: las zonas como un camino. Las desbloqueadas a color,
       * la siguiente como «?» con la pista para abrirla, y el resto resumidas
       * en «N zonas por descubrir».
       */
      const all = Object.values(D.zones);
      const unlocked = all.filter((z) => DK.world.isUnlocked(z.id));
      const next = all.find((z) => !DK.world.isUnlocked(z.id));
      const hidden = all.filter((z) => !DK.world.isUnlocked(z.id) && z !== next).length;
      const node = (z) => {
        const isRec = rec && rec.id === z.id, bossDone = DK.world.boss(z.id).defeated > 0;
        const b = h('button', { class: 'wm-node' + (params.zone === z.id ? ' selected' : '') + (bossDone ? ' done' : ''), type: 'button', style: { '--z1': z.colors[0], '--z2': z.colors[1] }, onClick: () => { DK.audio.sfx('select'); choose(z); } },
          h('span', { class: 'wm-orb' }, DK.icon(z.icon, 24), bossDone ? h('span', { class: 'wm-crown', tip: t('zones.bossDone') }, DK.icon('crown', 11)) : null),
          h('span', { class: 'wm-name' }, z.name),
          h('span', { class: 'wm-lv muted small' }, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`),
          isRec ? h('span', { class: 'wm-tag good' }, t('zones.recommended')) : exp && exp.zone === z.id ? h('span', { class: 'wm-tag' }, DK.icon('flag', 11), t('zones.inExpedition')) : null);
        return b;
      };
      const path = h('div', { class: 'wm-path' },
        unlocked.map((z, i) => [i ? h('span', { class: 'wm-link' }) : null, node(z)]),
        next ? [h('span', { class: 'wm-link locked' }), h('div', { class: 'wm-node locked' },
          h('span', { class: 'wm-orb' }, DK.icon('lock', 22)), h('span', { class: 'wm-name' }, '???'),
          h('span', { class: 'wm-lv muted small' }, `${t('common.lvl')} ${next.levels[0]}-${next.levels[1]}`),
          h('span', { class: 'wm-hint muted small' }, t('zones.unlockHint2', { zone: D.zones[next.unlock] ? D.zones[next.unlock].name : t('zones.previous') })))] : null,
        hidden ? [h('span', { class: 'wm-link locked' }), h('div', { class: 'wm-node more' }, h('span', { class: 'wm-orb' }, h('b', null, '+' + hidden)), h('span', { class: 'wm-name muted' }, t('zones.moreHidden', { n: hidden })))] : null);

      DK.keys.on('Enter', () => DK.play.quick());
      return h('div', { class: 'screen zones-screen' }, expeditionCard(refresh),
        h('div', { class: 'card wm-card' },
          h('div', { class: 'panel-head' }, DK.icon('map', 18), h('h3', null, t('zones.worldMap')), h('span', { class: 'muted small' }, t('zones.unlockedN', { n: unlocked.length, total: all.length }))),
          h('div', { class: 'wm-scroll' }, path)),
        sel && !DK.ui.isNarrow() ? h('div', { class: 'panel zone-side wide' }, zonePanel(sel, refresh)) : null);
    },
  });
})();
