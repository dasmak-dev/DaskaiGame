/* =============================================================
 * screens/settings.js — Panel de Ajustes (se abre como panel lateral
 * desde cualquier sitio, sin salir de la pantalla actual):
 * apariencia, accesibilidad, sonido, combate, idioma, ayudas,
 * partidas e instalación como app.
 *
 *   DK.settingsPanel.open()
 * Cada control llama a DK.settings.set(clave, valor).
 * ============================================================= */
(function () {
  const { h, btn, toggle, slider, segmented } = DK.ui;
  const S = DK.settings;
  const { t } = DK;

  /** Construye el contenido del panel. `refresh` lo vuelve a pintar. */
  function build(refresh, close) {
    {
      const set = (k, rerender = false) => (v) => { S.set(k, v); if (rerender) refresh(); };
      const group = (icon, title, ...rows) => h('section', { class: 'card settings-group' }, h('div', { class: 'section-head' }, DK.icon(icon, 18), h('h3', null, title)), ...rows);
      const rowSeg = (icon, label, seg) => h('div', { class: 'setting-row' }, DK.icon(icon, 18), h('span', { class: 'setting-text' }, h('b', null, label)), seg);

      return h('div', { class: 'settings' },
        group('contrast', t('settings.appearance'),
          rowSeg('sun', t('settings.theme'), segmented({ value: S.get('theme') || 'auto', onChange: (v) => S.set('theme', v === 'auto' ? null : v),
            options: [{ value: 'auto', label: t('settings.themeAuto'), icon: 'refresh' }, { value: 'light', label: t('settings.themeLight'), icon: 'sun' }, { value: 'dark', label: t('settings.themeDark'), icon: 'moon' }] })),
          rowSeg('layers', t('settings.uiStyle'), segmented({ value: ['exile', 'clean', 'classic'].includes(S.get('uiStyle')) ? S.get('uiStyle') : 'clean', onChange: (v) => S.set('uiStyle', v),
            options: [{ value: 'exile', label: t('settings.styleExile'), icon: 'skull', tip: t('settings.styleExileTip') }, { value: 'clean', label: t('settings.styleClean'), icon: 'sparkle' }, { value: 'classic', label: t('settings.styleClassic'), icon: 'shield' }] })),
          rowSeg('type', t('settings.textSize'), segmented({ value: S.get('textSize'), onChange: set('textSize'),
            options: [['sm', 'S'], ['md', 'M'], ['lg', 'L'], ['xl', 'XL']].map(([v, l]) => ({ value: v, label: l })) })),
          h('div', { class: 'setting-row', tip: t('uiScale.desc') }, DK.icon('maximize', 18), h('span', { class: 'setting-text' }, h('b', null, t('uiScale.label')), h('small', { class: 'muted' }, t('uiScale.desc'))),
            segmented({ value: Number(S.get('uiScale')) || 1, onChange: (v) => { S.set('uiScale', v); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }, options: [0.9, 1, 1.1, 1.25].map((v) => ({ value: v, label: Math.round(v * 100) + '%' })) })),
          toggle({ icon: 'image', label: t('settings.pixelArt'), desc: t('settings.pixelArtDesc'), value: S.get('pixelArt') !== false, onChange: (v) => { S.set('pixelArt', v); DK.router.refresh(); } }),
          toggle({ icon: 'hand', label: t('settings.customCursor'), desc: t('settings.customCursorDesc'), value: S.get('customCursor') !== false, onChange: set('customCursor') }),
          toggle({ icon: 'sparkles', label: t('settings.bgFx'), desc: t('settings.bgFxDesc'), value: S.get('bgFx') !== false, onChange: set('bgFx') }),
          toggle({ icon: 'dna', label: t('settings.showTraits'), desc: t('settings.showTraitsDesc'), value: !!S.get('showTraits'), onChange: set('showTraits') })),
        group('accessibility', t('settings.accessibility'),
          toggle({ icon: 'contrast', label: t('settings.highContrast'), desc: t('settings.highContrastDesc'), value: S.get('highContrast'), onChange: set('highContrast') }),
          toggle({ icon: 'eye', label: t('settings.colorblind'), desc: t('settings.colorblindDesc'), value: S.get('colorblind'), onChange: set('colorblind') }),
          toggle({ icon: 'pause', label: t('settings.reduceMotion'), desc: t('settings.reduceMotionDesc'), value: S.get('reduceMotion'), onChange: set('reduceMotion') }),
          toggle({ icon: 'vibrate', label: t('settings.vibration'), desc: t('settings.vibrationDesc'), value: S.get('vibration'), onChange: set('vibration') })),
        group('volume', t('settings.sound'),
          toggle({ icon: 'volumeOff', label: t('settings.mute'), value: S.get('muted'), onChange: set('muted') }),
          slider({ icon: 'music', label: t('settings.music'), value: S.get('musicVol'), onChange: (v) => S.set('musicVol', v) }),
          slider({ icon: 'volume', label: t('settings.sfx'), value: S.get('sfxVol'), onChange: (v) => { S.set('sfxVol', v); DK.audio.sfx('select'); } })),
        group('swords', t('settings.combat'),
          rowSeg('gauge', t('settings.battleSpeed'), segmented({ value: S.get('battleSpeed'), onChange: set('battleSpeed'), options: [1, 2, 4].map((n) => ({ value: n, label: 'x' + n, icon: 'play' })) })),
          toggle({ icon: 'bolt', label: t('settings.autoBattle'), desc: t('settings.autoBattleDesc'), value: S.get('autoBattle'), onChange: set('autoBattle') }),
          toggle({ icon: 'flask', label: t('settings.autoHeal'), desc: t('settings.autoHealDesc', { n: Math.round(DK.config.autoHeal.at * 100), max: DK.config.autoHeal.max }), value: S.get('autoHeal'), onChange: set('autoHeal') }),
          toggle({ icon: 'heart', label: t('settings.autoPause'), desc: t('settings.autoPauseDesc'), value: S.get('autoPause'), onChange: set('autoPause') }),
          toggle({ icon: 'skip', label: t('settings.skipAnims'), desc: t('settings.skipAnimsDesc'), value: S.get('skipAnims'), onChange: set('skipAnims') }),
          toggle({ icon: 'keyboard', label: t('settings.showHotkeys'), desc: t('settings.showHotkeysDesc'), value: S.get('showHotkeys'), onChange: set('showHotkeys') }),
          toggle({ icon: 'flee', label: t('settings.confirmFlee'), value: S.get('confirmFlee'), onChange: set('confirmFlee') }),
          toggle({ icon: 'anvil', label: t('settings.confirmForge'), value: S.get('confirmForge') !== false, onChange: set('confirmForge') }),
          toggle({ icon: 'trash', label: t('settings.confirmRelease'), value: S.get('confirmRelease'), onChange: set('confirmRelease') })),
        group('globe', t('settings.language'),
          rowSeg('globe', t('settings.language'), DK.ui.select({ label: t('settings.language'), value: S.get('lang'), options: DK.i18n.languages().map((l) => ({ value: l.id, label: l.name })), onChange: (v) => { S.set('lang', v); refresh(); if (DK.router.current()) DK.router.refresh(); } }))),
        group('help', t('settings.helpers'),
          toggle({ icon: 'help', label: t('settings.tutorials'), desc: t('settings.tutorialsDesc'), value: S.get('tutorials'), onChange: set('tutorials') }),
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'refresh', label: t('settings.resetTutorials'), variant: 'ghost', onClick: () => { DK.tutorial.reset(); DK.ui.toast(t('settings.tutorialsReset'), { icon: 'help' }); refresh(); } }),
            btn({ icon: 'help', label: t('top.help'), variant: 'ghost', onClick: () => DK.help.open() }))),
        group('folder', t('settings.saves'),
          h('p', { class: 'muted small' }, t('settings.savesText')),
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'folder', label: t('settings.manageSaves'), variant: 'tone', onClick: () => { close(); if (DK.store.state) DK.store.save(); DK.router.reset('mainMenu'); } }),
            DK.store.state ? btn({ icon: 'download', label: t('settings.exportCurrent'), variant: 'ghost', onClick: () => { DK.store.save(); DK.store.exportSlot(DK.store.slot); } }) : null)),
        group('smartphone', t('settings.app'),
          h('p', { class: 'muted small' }, /^https?:/.test(location.protocol) ? t('settings.appText') : t('settings.appFile')),
          btn({ icon: 'download', label: t('settings.install'), variant: 'primary', disabled: !DK.app.canInstall(), tip: DK.app.canInstall() ? null : t('settings.installUnavailable'), onClick: async () => { await DK.app.install(); refresh(); } })),
        h('div', { class: 'row between wrap gap' },
          btn({ icon: 'refresh', label: t('settings.resetAll'), variant: 'ghost', onClick: async () => { if (await DK.ui.confirm(t('settings.resetAll'), t('settings.resetAllText'), { danger: true })) { S.reset(); refresh(); } } }),
          h('span', { class: 'muted small' }, `Daskai v${DK.version}`)));
    }
  }

  DK.settingsPanel = {
    /** Abre (o cierra, si ya está abierto) el panel de ajustes. */
    open() {
      const holder = h('div');
      let close = () => {};
      const draw = () => holder.replaceChildren(build(draw, () => close()));
      const d = DK.ui.drawer({ id: 'settings', title: t('settings.title'), icon: 'settings', content: holder });
      if (!d) return;
      close = d.close;
      draw();
    },
  };
})();
