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
  const t = (k, v) => DK.t(k, v);

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

      const cards = Object.values(D.zones).map((z) => {
        const unlocked = DK.world.isUnlocked(z.id);
        const isRec = rec && rec.id === z.id;
        const bossDone = DK.world.boss(z.id).defeated > 0;
        const card = h(unlocked ? 'button' : 'div', { class: 'zone-row ' + (unlocked ? '' : 'locked') + (params.zone === z.id ? ' selected' : ''), type: unlocked ? 'button' : null, style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
          h('span', { class: 'zone-row-art' }, DK.icon(unlocked ? z.icon : 'lock', 24)),
          h('span', { class: 'zone-row-body' },
            h('b', null, unlocked ? z.name : '???'),
            h('span', { class: 'row gap-s wrap' }, h('span', { class: 'badge' }, DK.icon('star', 13), `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`),
              isRec ? h('span', { class: 'badge good' }, DK.icon('compass', 13), t('zones.recommended')) : null,
              exp && exp.zone === z.id ? h('span', { class: 'badge leader' }, DK.icon('flag', 13), t('zones.inExpedition')) : null,
              unlocked && bossDone ? h('span', { class: 'badge' }, DK.icon('crown', 13), t('zones.bossDone')) : null),
            unlocked && !bossDone ? h('span', { class: 'muted small' }, DK.icon('lock', 12), ' ', t('zones.freeLocked')) : null,
            !unlocked ? h('span', { class: 'muted small' }, t('zones.unlockHint2', { zone: D.zones[z.unlock] && DK.world.isUnlocked(z.unlock) ? D.zones[z.unlock].name : t('zones.previous') })) : null),
          unlocked ? h('span', { class: 'dk-row-arrow' }, DK.icon('next', 18)) : null);
        if (unlocked) card.addEventListener('click', () => { DK.audio.sfx('select'); choose(z); });
        return card;
      });

      DK.keys.on('Enter', () => DK.play.quick());
      return h('div', { class: 'screen zones-screen' }, expeditionCard(refresh),
        h('h3', { class: 'zones-sub' }, DK.icon('map', 16), ' ', t('zones.zonesTitle')),
        h('div', { class: 'zones-layout' },
        h('div', { class: 'zone-list' }, cards),
        h('div', { class: 'panel zone-side' }, sel ? zonePanel(sel, refresh) : DK.ui.empty('map', t('zones.pick'), ''))));
    },
  });
})();
