/* =============================================================
 * screens/mainMenu.js — Menú principal con las 3 ranuras de partida
 * a la vista (jugar, nueva, exportar, importar, borrar) y despedida.
 *
 * Opciones extra del menú (debajo de las ranuras): menú 'main'.
 *   DK.menus.add('main', { id, icon, label, desc, order, action | screen })
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const t = (k, v) => DK.t(k, v);
  const V = DK.views;

  /* ---------- Opciones bajo las ranuras ---------- */
  DK.menus.define('main');
  DK.menus.add('main', {
    id: 'settings', icon: 'settings', order: 30, variant: 'tone',
    label: () => t('main.settings'), desc: () => t('main.settingsDesc'),
    action: () => DK.settingsPanel.open(),
  });
  DK.menus.add('main', {
    id: 'help', icon: 'help', order: 40, variant: 'tone',
    label: () => t('top.help'), desc: () => t('main.helpDesc'),
    action: () => DK.help.open(),
  });
  DK.menus.add('main', {
    id: 'exit', icon: 'power', order: 100, variant: 'ghost',
    label: () => t('main.exit'), desc: () => t('main.exitDesc'),
    action: () => DK.app.exit(),
  });

  /** Carga una ranura y entra en el juego. */
  function play(n) { if (DK.store.load(n)) DK.router.reset(DK.store.state.gameOver ? 'gameOver' : 'hub'); }

  /**
   * Tarjeta de una ranura de partida.
   * @param {number} n          ranura
   * @param {Function} refresh  vuelve a pintar el menú
   * @param {Function} pickFile abre el selector de archivo para importar en n
   */
  function slotCard(n, refresh, pickFile) {
    const m = DK.store.slotMeta(n);
    const last = DK.settings.get('lastSlot') === n && m.exists;
    const tools = [];
    if (m.exists) {
      tools.push(btn({ icon: 'download', label: t('saves.export'), variant: 'ghost', size: 'sm', onClick: () => DK.store.exportSlot(n) && DK.ui.toast(t('saves.exported'), { icon: 'download' }) }));
      tools.push(btn({ icon: 'sparkles', label: t('saves.overwrite'), variant: 'ghost', size: 'sm', onClick: async () => {
        if (await DK.ui.confirm(t('saves.overwriteQ'), t('saves.overwriteText', { name: m.name }), { okLabel: t('saves.overwrite'), danger: true })) DK.router.go('newGame', { slot: n });
      } }));
      tools.push(btn({ icon: 'trash', label: t('saves.delete'), variant: 'ghost', size: 'sm', onClick: async () => {
        if (await DK.ui.confirm(t('saves.deleteQ'), t('saves.deleteText', { name: m.name }), { okLabel: t('saves.delete'), okIcon: 'trash', danger: true })) { DK.store.deleteSlot(n); refresh(); }
      } }));
    }
    tools.push(btn({ icon: 'upload', label: t('saves.import'), variant: 'ghost', size: 'sm', onClick: async () => {
      if (m.exists && !(await DK.ui.confirm(t('saves.importQ'), t('saves.importText'), { okLabel: t('saves.import'), danger: true }))) return;
      pickFile(n);
    } }));

    const main = m.exists
      ? btn({ icon: 'play', label: last ? t('main.continue') : t('saves.play'), desc: t('main.continueDesc', { name: m.name, slot: n }), size: 'lg', variant: last ? 'primary' : 'tone', hotkey: String(n), onClick: () => play(n) })
      : btn({ icon: 'sparkles', label: t('saves.newHere'), desc: t('saves.emptyText'), size: 'lg', variant: DK.store.hasAnySave() ? 'tone' : 'primary', hotkey: String(n), onClick: () => DK.router.go('newGame', { slot: n }) });
    DK.keys.on(String(n), () => (m.exists ? play(n) : DK.router.go('newGame', { slot: n })));

    return h('div', { class: 'card save-slot ' + (m.exists ? '' : 'empty') + (last ? ' last' : '') },
      h('div', { class: 'save-head' },
        h('span', { class: 'save-num' }, n),
        m.exists ? (m.avatar ? V.avatar(m, { size: 60 }) : m.bestSpecies ? V.sprite(m.bestSpecies, { size: 60, cls: last ? 'float' : '' }) : h('div', { class: 'save-empty-icon' }, DK.icon('skull', 24))) : h('div', { class: 'save-empty-icon' }, DK.icon('plus', 24)),
        h('div', { class: 'grow' },
          h('h3', null, m.exists ? m.name : t('saves.empty')),
          m.exists ? h('div', { class: 'chips' },
            h('span', { class: 'chip' }, DK.icon('star', 13), t('saves.best', { n: m.bestLevel })),
            h('span', { class: 'chip' }, DK.icon('paw', 13), t('saves.count', { n: m.count })),
            h('span', { class: 'chip' }, DK.icon('clock', 13), DK.util.duration(m.playTime)),
            m.fallen ? h('span', { class: 'chip neg' }, DK.icon('skull', 13), t('saves.fallen', { n: m.fallen })) : null,
            m.gameOver ? h('span', { class: 'chip neg' }, DK.icon('skull', 13), t('over.title')) : null) : null,
          m.exists && m.updated ? h('p', { class: 'muted small' }, t('saves.updated', { date: new Date(m.updated).toLocaleString(DK.i18n.lang) })) : null)),
      main,
      h('div', { class: 'row gap-s wrap save-tools' }, tools));
  }

  DK.screens.register('mainMenu', {
    title: '', music: 'menu', nav: false,
    render() {
      if (DK.store.state) DK.store.close();
      const refresh = () => DK.router.refresh();
      const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
      let importSlot = 1;
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files[0]; if (!f) return;
        const ok = await DK.store.importFile(f, importSlot);
        DK.ui.toast(ok ? t('saves.imported', { slot: importSlot }) : t('saves.importError'), { icon: ok ? 'upload' : 'alert', kind: ok ? 'good' : 'bad' });
        fileInput.value = ''; refresh();
      });
      const pickFile = (n) => { importSlot = n; fileInput.click(); };
      const showcase = h('div', { class: 'logo-creatures' },
        ['lumino', 'pyrex', 'aquelo', 'terron', 'umbrix'].map((id, i) => V.sprite(id, { size: 64, cls: 'float d' + i })));
      const slots = [];
      for (let n = 1; n <= DK.store.slots; n++) slots.push(slotCard(n, refresh, pickFile));
      return h('div', { class: 'screen main-menu' }, fileInput,
        h('div', { class: 'logo' }, showcase, h('h1', { class: 'logo-title' }, 'DASKAI'), h('p', { class: 'logo-sub' }, t('main.tagline'))),
        h('div', { class: 'main-slots' }, h('h3', { class: 'center' }, DK.icon('folder', 18), ' ', t('main.yourGames')), h('div', { class: 'slot-grid' }, slots)),
        h('div', { class: 'main-menu-actions' }, DK.menus.render('main', { layout: 'row', hotkeys: false })),
        h('p', { class: 'muted small center' }, t('main.footer', { v: DK.version })));
    },
  });

  /* ---------- Despedida ---------- */
  DK.screens.register('goodbye', {
    title: '', nav: false,
    render() {
      DK.audio.music(null);
      return h('div', { class: 'screen center-screen' },
        V.sprite('lumino', { size: 120, cls: 'float' }),
        h('h2', null, t('bye.title')), h('p', { class: 'muted' }, t('bye.text')),
        btn({ icon: 'home', label: t('bye.back'), variant: 'primary', onClick: () => DK.router.reset('mainMenu') }));
    },
  });
})();
