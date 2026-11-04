/* =============================================================
 * screens/progress.js — Progreso: Senda del aventurero (niveles con premios),
 * «Casi lo tienes», Misiones (diarias y semanales, una se puede cambiar al día)
 * y Logros por categorías (con sus premios y pistas de los ocultos).
 * params: { tab: 'missions'|'ach' }  (las estadísticas están en el Perfil)
 *
 *   DK.views.missionCard(m, refresh)  → tarjeta de misión (también la usa Inicio)
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'progress', icon: 'award', order: 60, screen: 'progress', label: () => t('nav.progress'), badge: () => { const n = DK.missions.claimable() + DK.pass.pending().length; return n ? String(n) : ''; } });

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
  V.missionCard = (m, refresh, { compact = false, reroll = false } = {}) => {
        const done = m.progress >= m.target;
        return h('div', { class: 'card mission ' + (m.claimed ? 'claimed' : done ? 'done' : '') },
          h('div', { class: 'mission-icon' }, DK.icon(m.icon, 22)),
          h('div', { class: 'grow' },
            h('b', null, DK.missionText(m)),
            DK.ui.bar({ value: m.progress, max: m.target, kind: 'exp', text: true }),
            h('div', { class: 'chips' }, h('span', { class: 'chip' }, DK.icon('coin', 13), m.reward.coins),
              m.reward.item && m.reward.qty ? h('span', { class: 'chip' }, DK.icon(D.items[m.reward.item].icon, 13), `${D.items[m.reward.item].name} x${m.reward.qty}`) : null,
              h('span', { class: 'chip pass-chip', tip: t('pass.pointsTip') }, DK.icon('award', 13), t('pass.points', { n: DK.missions.passPoints(m) })))),
          reroll && !m.claimed && !done && DK.missions.canReroll() ? h('button', { class: 'icon-btn mission-reroll', type: 'button', tip: t('missions.rerollTip'), 'aria-label': t('missions.reroll'),
            onClick: () => { if (DK.missions.reroll(m)) { DK.audio.sfx('select'); DK.ui.toast(t('missions.rerolled'), { icon: 'refresh' }); refresh(); } } }, DK.icon('refresh', 15)) : null,
          m.claimed ? h('span', { class: 'badge good' }, DK.icon('check', 13), t('missions.claimed'))
            : btn({ icon: 'gift', label: t('missions.claim'), size: compact ? 'sm' : '', variant: done ? 'primary' : 'ghost', disabled: !done, onClick: () => { if (DK.missions.claim(m)) { DK.audio.sfx('achievement'); DK.ui.toast(t('missions.claimedToast', { coins: m.reward.coins }), { icon: 'gift', kind: 'good' }); refresh(); } } }));
  };

  /** Pestaña de misiones: diarias y semanales juntas. */
  function missionsTab(refresh) {
    const section = (period) => h('div', { class: 'stack-s' },
      h('div', { class: 'row between wrap gap' }, h('h3', null, DK.icon(period === 'daily' ? 'sun' : 'clock', 18), ' ', t('missions.' + period)), h('span', { class: 'badge' }, DK.icon('clock', 13), t('missions.resetIn', { time: timeLeft(period) }))),
      h('p', { class: 'muted small' }, t('missions.' + period + 'Help')),
      h('div', { class: 'list' }, DK.missions.list(period).map((m) => V.missionCard(m, refresh, { reroll: true }))));
    return h('div', { class: 'stack' },
      h('p', { class: 'muted small mission-reroll-note' }, DK.icon('refresh', 13), ' ', DK.missions.canReroll() ? t('missions.rerollLeft') : t('missions.rerollUsed')),
      h('div', { class: 'missions-cols' }, section('daily'), section('weekly')));
  }

  /* ---------- Senda del aventurero ---------- */
  /** Icono y texto de un premio de la senda. */
  function rewardView(r) {
    if (r.frame) return { icon: 'sparkle', text: t('profile.frame.' + r.frame) + (r.title ? ' · ' + t('pass.titles.' + r.title) : ''), cls: 'cosmetic', frame: r.frame };
    if (r.title) return { icon: 'award', text: t('pass.titleReward', { name: t('pass.titles.' + r.title) }), cls: 'cosmetic' };
    if (r.rune) return { icon: 'rune', text: r.rune === 'random' ? t('pass.runeRandom', { n: r.n || 1 }) : t('rune.' + r.rune + '.name'), cls: 'rune', rune: r.rune };
    if (r.emblems) return { icon: 'emblem', text: t('emblem.plus', { n: r.emblems }), cls: 'emblem' };
    if (r.item) return { icon: D.items[r.item].icon, text: `${D.items[r.item].name} ×${r.qty || 1}`, cls: 'item', item: r.item };
    return { icon: 'coin', text: t('pass.coins', { n: (r.coins || 0).toLocaleString(DK.i18n.lang) }) + (r.rune ? ' + ' + t('pass.runeRandom', { n: 1 }) : ''), cls: 'coins' };
  }
  function passCard(refresh) {
    const pr = DK.pass.progress(), pending = DK.pass.pending(), M = DK.pass.max();
    const claim = (lv) => { const got = DK.pass.claim(lv); if (!got) return; DK.audio.sfx('achievement'); DK.ui.toast(t('pass.claimed', { n: lv, what: rewardView(DK.pass.reward(lv)).text }), { icon: 'gift', kind: 'good' }); refresh(); };
    const node = (lv) => {
      const r = DK.pass.reward(lv), v = rewardView(r), reached = lv <= pr.level, got = DK.pass.claimed(lv), extra = lv > M;
      const st = got ? 'got' : reached ? 'ready' : 'locked';
      return h('button', { class: 'pass-node ' + st + ' r-' + v.cls + (lv % 10 === 0 ? ' big' : '') + (extra ? ' extra' : ''), type: 'button', disabled: st !== 'ready', tip: `${t('pass.levelN', { n: extra ? M + '+' : lv })} · ${v.text}`,
        onClick: () => claim(lv) },
        h('span', { class: 'pass-lv' }, extra ? '∞' : lv),
        h('span', { class: 'pass-reward' }, v.item ? V.itemIcon(D.items[v.item], 18) : v.rune && v.rune !== 'random' && V.runeGem ? V.runeGem(v.rune, 30) : v.frame ? h('span', { class: 'pass-frame', style: { background: DK.avatars.frame(v.frame).css } }) : DK.icon(v.icon, 20)),
        h('small', null, v.text),
        h('span', { class: 'pass-state' }, DK.icon(got ? 'check' : reached ? 'gift' : 'lock', 11)));
    };
    const shown = Math.min(M + 1, Math.max(M, pr.level + 1));
    const track = h('div', { class: 'pass-track' }, Array.from({ length: shown }, (_, i) => node(i + 1)));
    // Centrar el nivel actual al pintar
    setTimeout(() => { const cur = track.querySelector('.pass-node.ready') || track.children[Math.min(pr.level, track.children.length - 1)]; if (cur) track.scrollLeft = Math.max(0, cur.offsetLeft - track.clientWidth / 2 + cur.clientWidth / 2); }, 0);
    const P = D.pass.points;
    return h('section', { class: 'card pass-card' },
      h('div', { class: 'pass-head' },
        h('div', { class: 'pass-badge' }, h('small', null, t('pass.level')), h('b', null, pr.level)),
        h('div', { class: 'pass-info' },
          h('h3', null, t('pass.title'), h('span', { class: 'pass-season', tip: t('pass.seasonTip') }, t('pass.season', { n: DK.pass.season(), d: DK.pass.daysLeft() }))),
          h('div', { class: 'pass-bar' }, h('i', { style: { width: Math.round((pr.into / pr.need) * 100) + '%' } })),
          h('span', { class: 'muted small' }, t('pass.toNext', { a: pr.into, b: pr.need, n: pr.level + 1 }), ' · ', t('pass.howTo', { d: P.daily, w: P.weekly, a: P.achievement }))),
        pending.length ? btn({ icon: 'gift', label: t('pass.claimAll', { n: pending.length }), variant: 'primary', cls: 'pass-claim', onClick: () => { const got = DK.pass.claimAll(); if (got.length) { DK.audio.sfx('achievement'); DK.ui.toast(t('pass.claimedN', { n: got.length }), { icon: 'gift', kind: 'good' }); } refresh(); } }) : null),
      track);
  }

  /** «Casi lo tienes»: lo más cerca de completarse, con un botón para ir a hacerlo. */
  function nearCard() {
    const list = DK.achievements.near(3);
    if (!list.length) return null;
    return h('section', { class: 'card near-card' },
      h('div', { class: 'panel-head' }, DK.icon('target', 18), h('h3', null, t('pass.nearTitle')), h('span', { class: 'muted small' }, t('pass.nearHint'))),
      h('div', { class: 'near-list' }, list.map((x) => {
        const m = x.kind === 'mission', name = m ? DK.missionText(x.item) : DK.achievements.name(x.item);
        return h('div', { class: 'near-row' },
          h('span', { class: 'near-icon ' + x.kind }, DK.icon(m ? x.item.icon : x.item.icon, 18)),
          h('div', { class: 'near-main' },
            h('b', null, name),
            h('span', { class: 'muted small' }, (m ? t('missions.' + DK.missions.periodOf(x.item)) : t('achievements.tab')) + ' · ' + `${Math.floor(x.value).toLocaleString(DK.i18n.lang)}/${x.target.toLocaleString(DK.i18n.lang)}`),
            h('span', { class: 'near-bar' }, h('i', { style: { width: Math.round(x.pct * 100) + '%' } }))),
          h('b', { class: 'near-pct' }, Math.round(x.pct * 100) + '%'),
          btn({ icon: 'next', label: t('pass.go'), size: 'sm', variant: 'tone', disabled: !!DK.expedition.active() && x.go !== 'zones', onClick: () => DK.router.reset(x.go) }));
      })));
  }

  /* ---------- Logros por categorías ---------- */
  const CAT_ICON = { combat: 'swords', collection: 'paw', expedition: 'flag', bosses: 'crown', craft: 'anvil' };
  function achTab(params, refresh) {
    const list = DK.achievements.list(), cats = DK.achievements.byCat();
    params.cat = params.cat || 'all';
    const nHidden = list.filter((x) => x.def.hidden).length, gotHidden = list.filter((x) => x.def.hidden && x.unlocked).length;
    const chip = (id, label, icon, got, total) => h('button', { class: 'ach-cat' + (params.cat === id ? ' on' : ''), type: 'button', onClick: () => { params.cat = id; refresh(); } },
      DK.icon(icon, 14), h('span', null, label), h('small', null, `${got}/${total}`), h('i', { class: 'ach-cat-bar' }, h('em', { style: { width: (total ? Math.round((got / total) * 100) : 0) + '%' } })));
    const total = list.length, got = list.filter((x) => x.unlocked).length;
    const bar = h('div', { class: 'ach-cats' }, chip('all', t('achievements.all'), 'award', got, total),
      D.achievementCats.map((c) => chip(c, t('achievements.cat.' + c), CAT_ICON[c], cats[c].got, cats[c].total)));
    const shown = list.filter((x) => params.cat === 'all' || x.def.cat === params.cat)
      .sort((a, b) => (a.unlocked ? 1 : 0) - (b.unlocked ? 1 : 0) || (a.def.hidden ? 1 : 0) - (b.def.hidden ? 1 : 0) || (b.value / b.def.target) - (a.value / a.def.target));
    const card = ({ def, value, unlocked, at }) => {
      const secret = def.hidden && !unlocked;
      const vars = Object.assign({ n: def.target }, def.vars ? def.vars(DK.store.state) : {});
      const hint = secret ? DK.t('achievements.' + (def.text || def.id) + '.hint', vars) : '';
      return h('div', { class: 'card ach ' + (unlocked ? 'unlocked' : '') + (secret ? ' secret' : '') + (def.hidden && unlocked ? ' hidden-got' : '') },
        h('div', { class: 'ach-icon' }, DK.icon(unlocked ? def.icon : secret ? 'question' : def.icon, 24)),
        h('div', { class: 'grow ach-main' },
          h('b', null, secret ? t('achievements.hiddenName') : DK.achievements.name(def)),
          h('p', { class: 'muted small' }, secret ? (hint && !hint.includes('.hint') ? h('span', null, DK.icon('info', 12), ' ', t('achievements.hintLabel'), ' ', hint) : t('achievements.hiddenDesc')) : DK.achievements.desc(def)),
          unlocked ? h('span', { class: 'small ach-date' }, DK.icon('check', 13), ' ', new Date(at).toLocaleDateString(DK.i18n.lang), def.hidden ? h('span', { class: 'badge ach-hidden-tag' }, t('achievements.hiddenTag')) : null)
            : secret ? null : DK.ui.bar({ value, max: def.target, kind: 'exp', text: true }),
          // Lo que da: monedas, puntos de senda y su título
          h('div', { class: 'chips ach-rewards' },
            h('span', { class: 'chip' }, DK.icon('coin', 12), secret ? '?' : def.reward),
            h('span', { class: 'chip pass-chip' }, DK.icon('award', 12), t('pass.points', { n: DK.achievements.passPoints(def) })),
            secret ? null : h('span', { class: 'chip title-chip', tip: t('achievements.titleTip') }, DK.icon('tag', 12), t('achievements.titleReward', { name: DK.achievements.name(def) })))));
    };
    return h('div', { class: 'stack' }, bar,
      h('p', { class: 'muted small' }, DK.icon('question', 13), ' ', t('achievements.hiddenCount', { n: gotHidden, max: nHidden }), ' · ', t('achievements.framesHint')),
      h('div', { class: 'ach-grid' }, shown.map(card)));
  }

  DK.screens.register('progress', {
    title: () => t('nav.progress'), icon: 'award', section: 'progress', tutorial: 'progress', music: 'menu',
    render(params) {
      // Las estadísticas viven ahora en el Perfil (screens/profile.js)
      if (params.tab === 'stats') { setTimeout(() => DK.router.replace('profile'), 0); params.tab = 'missions'; }
      const refresh = () => DK.router.refresh();
      const list = DK.achievements.list();
      return h('div', { class: 'screen progress-screen' },
        passCard(refresh),
        nearCard(),
        DK.ui.tabs({
          active: params.tab, onChange: (id) => (params.tab = id),
          items: [
            { id: 'missions', label: t('missions.title'), icon: 'scroll', count: DK.missions.claimable() || null, render: () => missionsTab(refresh) },
            { id: 'ach', label: t('achievements.tab'), icon: 'award', count: `${DK.achievements.unlockedCount()}/${list.length}`, render: () => achTab(params, refresh) },
          ],
        }));
    },
  });
})();
