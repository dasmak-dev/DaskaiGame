/* =============================================================
 * screens/progress.js — Progreso: Misiones (diarias y semanales),
 * Logros y Estadísticas en una sola pantalla con pestañas.
 * params: { tab: 'missions'|'ach' }  (las estadísticas están en el Perfil)
 *
 *   DK.views.missionCard(m, refresh)  → tarjeta de misión (también la usa Inicio)
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'progress', icon: 'award', order: 60, screen: 'progress', label: () => t('nav.progress'), badge: () => { const n = DK.missions.claimable(); return n ? String(n) : ''; } });

  /** Tiempo restante hasta medianoche o hasta el lunes. */
  function timeLeft(period) {
    const now = new Date(), end = new Date(now);
    end.setHours(24, 0, 0, 0);
    if (period === 'weekly') end.setDate(end.getDate() + ((8 - end.getDay()) % 7));
    const s = Math.max(0, (end - now) / 1000);
    const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${hh} h` : `${hh} h ${m} min`;
  }

  /** Tarjeta de una misión con su botón de cobrar. */
  V.missionCard = (m, refresh, { compact = false } = {}) => {
        const done = m.progress >= m.target;
        return h('div', { class: 'card mission ' + (m.claimed ? 'claimed' : done ? 'done' : '') },
          h('div', { class: 'mission-icon' }, DK.icon(m.icon, 22)),
          h('div', { class: 'grow' },
            h('b', null, DK.missionText(m)),
            DK.ui.bar({ value: m.progress, max: m.target, kind: 'exp', text: true }),
            h('div', { class: 'chips' }, h('span', { class: 'chip' }, DK.icon('coin', 13), m.reward.coins),
              m.reward.item && m.reward.qty ? h('span', { class: 'chip' }, DK.icon(D.items[m.reward.item].icon, 13), `${D.items[m.reward.item].name} x${m.reward.qty}`) : null)),
          m.claimed ? h('span', { class: 'badge good' }, DK.icon('check', 13), t('missions.claimed'))
            : btn({ icon: 'gift', label: t('missions.claim'), size: compact ? 'sm' : '', variant: done ? 'primary' : 'ghost', disabled: !done, onClick: () => { if (DK.missions.claim(m)) { DK.audio.sfx('achievement'); DK.ui.toast(t('missions.claimedToast', { coins: m.reward.coins }), { icon: 'gift', kind: 'good' }); refresh(); } } }));
  };

  /** Pestaña de misiones: diarias y semanales juntas. */
  function missionsTab(refresh) {
    const section = (period) => h('div', { class: 'stack-s' },
      h('div', { class: 'row between wrap gap' }, h('h3', null, DK.icon(period === 'daily' ? 'sun' : 'clock', 18), ' ', t('missions.' + period)), h('span', { class: 'badge' }, DK.icon('clock', 13), t('missions.resetIn', { time: timeLeft(period) }))),
      h('p', { class: 'muted small' }, t('missions.' + period + 'Help')),
      h('div', { class: 'list' }, DK.missions.list(period).map((m) => V.missionCard(m, refresh))));
    return h('div', { class: 'missions-cols' }, section('daily'), section('weekly'));
  }

  DK.screens.register('progress', {
    title: () => t('nav.progress'), icon: 'award', section: 'progress', tutorial: 'progress', music: 'menu',
    render(params) {
      // Las estadísticas viven ahora en el Perfil (screens/profile.js)
      if (params.tab === 'stats') { setTimeout(() => DK.router.replace('profile'), 0); params.tab = 'missions'; }
      const refresh = () => DK.router.refresh();
      const st = DK.store.state, s = st.stats;
      const list = DK.achievements.list();
      // Los ocultos no dicen qué piden hasta conseguirlos (van al final mientras estén bloqueados)
      const ordered = list.slice().sort((a, b) => (a.def.hidden && !a.unlocked ? 1 : 0) - (b.def.hidden && !b.unlocked ? 1 : 0));
      const nHidden = list.filter((x) => x.def.hidden).length, gotHidden = list.filter((x) => x.def.hidden && x.unlocked).length;
      const achTab = () => h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, DK.icon('question', 13), ' ', t('achievements.hiddenCount', { n: gotHidden, max: nHidden })),
        h('div', { class: 'ach-grid' }, ordered.map(({ def, value, unlocked, at }) => {
          const secret = def.hidden && !unlocked;
          return h('div', { class: 'card ach ' + (unlocked ? 'unlocked' : '') + (secret ? ' secret' : '') + (def.hidden && unlocked ? ' hidden-got' : '') },
            h('div', { class: 'ach-icon' }, DK.icon(unlocked ? def.icon : secret ? 'question' : 'lock', 24)),
            h('div', { class: 'grow' }, h('b', null, secret ? t('achievements.hiddenName') : DK.achievements.name(def)),
              h('p', { class: 'muted small' }, secret ? t('achievements.hiddenDesc') : DK.achievements.desc(def)),
              unlocked ? h('span', { class: 'small' }, DK.icon('check', 13), ' ', new Date(at).toLocaleDateString(DK.i18n.lang), def.hidden ? h('span', { class: 'badge ach-hidden-tag' }, t('achievements.hiddenTag')) : null)
                : secret ? null : DK.ui.bar({ value, max: def.target, kind: 'exp' })),
            h('span', { class: 'chip' }, DK.icon('coin', 13), secret ? '?' : def.reward));
        })));
      return h('div', { class: 'screen' }, DK.ui.tabs({
        active: params.tab, onChange: (id) => (params.tab = id),
        items: [
          { id: 'missions', label: t('missions.title'), icon: 'scroll', count: DK.missions.claimable() || null, render: () => missionsTab(refresh) },
          { id: 'ach', label: t('achievements.tab'), icon: 'award', count: `${DK.achievements.unlockedCount()}/${list.length}`, render: achTab },
        ],
      }));
    },
  });
})();
