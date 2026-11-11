/* =============================================================
 * screens/mainMenu.js — Menú principal con las 3 ranuras de partida
 * a la vista (jugar, nueva, exportar, importar, borrar) y despedida.
 *
 * Opciones extra del menú (debajo de las ranuras): menú 'main'.
 *   DK.menus.add('main', { id, icon, label, desc, order, action | screen })
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const { t } = DK;
  const V = DK.views;

  /* ---------- Opciones bajo las ranuras ---------- */
  DK.menus.define('main');
  DK.menus.add('main', {
    id: 'settings', icon: 'settings', order: 30, variant: 'tone',
    label: () => t('main.settings'), desc: () => t('main.settingsDesc'),
    action: () => DK.settingsPanel.open(),
  });
  // v5.45: seguir en este dispositivo una partida guardada en la nube (con el código de recuperación)
  DK.menus.add('main', {
    id: 'cloud', icon: 'download', order: 35, variant: 'tone',
    visible: () => !!(DK.online && DK.online.enabled() && DK.cloudRestore),
    label: () => t('cloud.restoreShort'), desc: () => t('cloud.restoreDesc'),
    action: () => DK.cloudRestore(),
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
    // Opciones secundarias: botones iguales (icono arriba, nombre abajo) en una fila
    const tool = (icon, label, onClick, danger) => h('button', { class: 'save-tool' + (danger ? ' danger' : ''), type: 'button', tip: label, onClick }, DK.icon(icon, 17), h('span', null, label));
    const importIt = async () => {
      if (m.exists && !(await DK.ui.confirm(t('saves.importQ'), t('saves.importText'), { okLabel: t('saves.import'), danger: true }))) return;
      pickFile(n);
    };
    const tools = m.exists ? [
      tool('download', t('saves.export'), () => DK.store.exportSlot(n) && DK.ui.toast(t('saves.exported'), { icon: 'download' })),
      tool('upload', t('saves.import'), importIt),
      tool('refresh', t('saves.overwriteShort'), async () => {
        if (await DK.ui.confirm(t('saves.overwriteQ'), t('saves.overwriteText', { name: m.name }), { okLabel: t('saves.overwrite'), danger: true })) DK.router.go('newGame', { slot: n });
      }),
      tool('trash', t('saves.delete'), async () => {
        if (await DK.ui.confirm(t('saves.deleteQ'), t('saves.deleteText', { name: m.name }), { okLabel: t('saves.delete'), okIcon: 'trash', danger: true })) { DK.store.deleteSlot(n); refresh(); }
      }, true),
    ] : [tool('upload', t('saves.import'), importIt)];

    const main = m.exists
      ? btn({ icon: 'play', label: last ? t('main.continue') : t('saves.play'), desc: m.inExpedition ? t('saves.inExpedition') : null, size: 'lg', variant: last ? 'primary' : 'tone', hotkey: String(n), cls: 'save-main', onClick: () => play(n) })
      : btn({ icon: 'sparkles', label: t('saves.newHere'), size: 'lg', variant: DK.store.hasAnySave() ? 'tone' : 'primary', hotkey: String(n), cls: 'save-main', onClick: () => DK.router.go('newGame', { slot: n }) });
    DK.keys.on(String(n), () => (m.exists ? play(n) : DK.router.go('newGame', { slot: n })));

    // Estadísticas en una cuadrícula fija: siempre en el mismo sitio en las tres ranuras
    const stat = (icon, value, label, cls = '') => h('div', { class: 'save-stat ' + cls, tip: label }, DK.icon(icon, 14), h('b', null, value), h('small', null, label));
    const diff = m.difficulty && DK.data.difficulties[m.difficulty];
    const stats = m.exists ? h('div', { class: 'save-stats' },
      stat('star', String(m.bestLevel), t('saves.statBest')),
      stat('paw', String(m.count), t('saves.statCount')),
      stat('clock', DK.util.duration(m.playTime), t('saves.statTime')),
      stat('coin', m.coins.toLocaleString(DK.i18n.lang), t('hub.coins')),
      stat('map', String(m.zones), t('saves.statZones')),
      stat('crown', String(m.bosses), t('saves.statBosses'))) : null;
    const flags = m.exists ? [
      diff ? h('span', { class: 'chip' }, DK.icon(diff.icon, 12), t('difficulty.' + m.difficulty + '.name')) : null,
      m.inExpedition ? h('span', { class: 'chip pos' }, DK.icon('flag', 12), t('saves.onExpedition')) : null,
      m.fallen ? h('span', { class: 'chip neg' }, DK.icon('skull', 12), t('saves.fallen', { n: m.fallen })) : null,
      m.gameOver ? h('span', { class: 'chip neg' }, DK.icon('skull', 12), t('over.title')) : null,
    ].filter(Boolean) : [];

    return h('div', { class: 'card save-slot ' + (m.exists ? 'full' : 'empty') + (last ? ' last' : '') },
      h('div', { class: 'save-top' },
        h('span', { class: 'save-num' }, t('saves.slotN', { n })),
        last ? h('span', { class: 'save-last' }, DK.icon('check', 12), t('saves.lastPlayed')) : null),
      h('div', { class: 'save-head' },
        m.exists ? h('div', { class: 'save-portrait' }, m.avatar ? V.avatar(m, { size: 64, leader: m.leader }) : m.leader ? V.sprite(m.leader.species, { size: 64, look: m.leader.look, shiny: m.leader.shiny, cls: last ? 'float' : '' }) : m.bestSpecies ? V.sprite(m.bestSpecies, { size: 64, cls: last ? 'float' : '' }) : DK.icon('skull', 26))
          : h('div', { class: 'save-empty-icon' }, DK.icon('plus', 26)),
        h('div', { class: 'save-title' },
          h('h3', null, m.exists ? m.name : t('saves.empty')),
          h('p', { class: 'muted small' }, m.exists && m.updated ? t('saves.updated', { date: new Date(m.updated).toLocaleString(DK.i18n.lang, { dateStyle: 'short', timeStyle: 'short' }) }) : t('saves.emptyHint')))),
      stats,
      flags.length ? h('div', { class: 'chips save-flags' }, flags) : null,
      h('div', { class: 'save-foot' }, main, h('div', { class: 'save-tools n' + tools.length }, tools)));
  }

  DK.screens.register('mainMenu', {
    title: '', music: 'title', nav: false,
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
