/* =============================================================
 * screens/gameOver.js — Fin de la partida (modo difícil).
 *
 * Cuando no te queda ningún daskai (todos han caído en expediciones),
 * la partida termina. Se muestra el cementerio y tus estadísticas, y
 * puedes empezar de nuevo en la misma ranura.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  /** Lista de daskai caídos (también la usa la pantalla de Equipo). */
  V.graveyard = (list, { limit } = {}) => h('div', { class: 'grave-list' }, (limit ? list.slice(0, limit) : list).map((g) =>
    h('div', { class: 'grave' }, V.sprite(g.species, { size: 40, shiny: g.shiny, cls: 'grave-sprite' }),
      h('div', { class: 'grow' }, h('b', null, g.name), h('div', { class: 'muted small' }, `${t('common.lvl')} ${g.level} · ${D.zones[g.zone] ? D.zones[g.zone].name : ''} · ${new Date(g.at).toLocaleDateString(DK.i18n.lang)}`)),
      DK.icon('skull', 16))));

  DK.screens.register('gameOver', {
    title: () => t('over.title'), icon: 'skull', nav: false, back: false, music: 'menu',
    render() {
      const st = DK.store.state;
      if (!st) { setTimeout(() => DK.router.reset('mainMenu'), 0); return h('div'); }
      const s = st.stats;
      const slot = DK.store.slot;
      const restart = async () => {
        if (!(await DK.ui.confirm(t('over.restartQ'), t('over.restartText'), { okLabel: t('over.restart'), okIcon: 'refresh', danger: true }))) return;
        DK.router.reset('newGame', { slot });
      };
      DK.keys.on('Enter', restart);
      const stat = (icon, label, val) => h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, DK.icon(icon, 15), label), h('b', { class: 'kpi-value' }, val));
      return h('div', { class: 'screen narrow over-screen' },
        h('div', { class: 'card over-hero' },
          h('span', { class: 'over-icon' }, DK.icon('skull', 46)),
          h('h2', null, t('over.title')),
          h('p', { class: 'muted' }, t('over.text', { name: st.player.name })),
          h('div', { class: 'row gap-s wrap center-row' },
            btn({ icon: 'refresh', label: t('over.restart'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: restart }),
            btn({ icon: 'home', label: t('over.menu'), variant: 'ghost', size: 'lg', onClick: () => { DK.store.save(); DK.router.reset('mainMenu'); } }))),
        h('div', { class: 'kpi-grid' },
          stat('clock', t('pstats.playTime'), DK.util.duration(s.playTime)),
          stat('flag', t('pstats.expeditions'), s.expeditions),
          stat('swords', t('pstats.battles'), s.battles),
          stat('crown', t('pstats.bosses'), s.bossesDefeated)),
        h('div', { class: 'card stack-s' },
          h('div', { class: 'panel-head' }, DK.icon('skull', 18), h('h3', null, t('over.fallen', { n: (st.graveyard || []).length }))),
          (st.graveyard || []).length ? V.graveyard(st.graveyard) : h('p', { class: 'muted small' }, t('sum.none'))));
    },
  });
})();
