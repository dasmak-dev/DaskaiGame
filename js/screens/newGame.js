/* =============================================================
 * screens/newGame.js — Nueva partida: nombre, dificultad y daskai inicial.
 * params: { slot, step: 'name'|'starter', name, difficulty, pick }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.screens.register('newGame', {
    title: (p) => (p.step === 'starter' ? t('newGame.pickTitle') : t('newGame.nameTitle')),
    icon: 'user', music: 'menu', nav: false,
    render(params) {
      params.step = params.step || 'name';
      params.slot = params.slot || 1;
      return params.step === 'name' ? renderName(params) : renderStarter(params);
    },
  });

  /** Paso 1: nombre. */
  function renderName(params) {
    const input = h('input', { class: 'input', type: 'text', maxlength: 16, placeholder: t('newGame.placeholder'), value: params.name || '', autocomplete: 'off', 'aria-label': t('newGame.nameLabel') });
    const err = h('p', { class: 'error small', role: 'alert' });
    const next = () => {
      const v = input.value.trim();
      if (v.length < 2) { err.textContent = t('newGame.nameError'); DK.audio.sfx('error'); input.focus(); return; }
      params.name = v; params.step = 'starter';
      DK.router.refresh();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
    // Dificultad (no se puede cambiar después)
    params.difficulty = params.difficulty || DK.data.defaultDifficulty;
    const diffCards = h('div', { class: 'diff-grid' }, Object.values(DK.data.difficulties).map((df) => h('button', {
      class: 'diff-card' + (params.difficulty === df.id ? ' selected' : '') + ' d-' + df.id, type: 'button', 'aria-pressed': params.difficulty === df.id,
      onClick: () => { params.name = input.value; params.difficulty = df.id; DK.audio.sfx('select'); DK.router.refresh(); },
    }, DK.icon(df.icon, 22), h('b', null, t('difficulty.' + df.id + '.name')), h('span', { class: 'small muted' }, t('difficulty.' + df.id + '.desc')))));
    setTimeout(() => input.focus(), 50);
    return h('div', { class: 'screen narrow' },
      h('div', { class: 'card hero-card' },
        h('div', { class: 'hero-icon' }, DK.icon('user', 36)),
        h('h2', null, t('newGame.nameQ')),
        h('p', { class: 'muted' }, t('newGame.nameHint', { slot: params.slot })),
        h('label', { class: 'field' }, h('span', null, t('newGame.nameLabel')), input),
        err,
        h('div', { class: 'field' }, h('span', null, t('difficulty.title')), diffCards, h('p', { class: 'muted small' }, t('difficulty.final'))),
        h('div', { class: 'row end' }, btn({ icon: 'next', label: t('common.continue'), variant: 'primary', onClick: next, hotkey: '↵' }))));
  }

  /** Paso 2: daskai inicial. */
  function renderStarter(params) {
    const starters = Object.values(D.species).filter((s) => s.starter);
    params.pick = params.pick || starters[0].id;
    const detail = h('div', { class: 'starter-detail card' });
    const grid = h('div', { class: 'starter-grid' });

    const start = () => {
      const d = DK.store.newGame(params.slot, params.name, params.pick, params.difficulty);
      DK.audio.sfx('levelup');
      DK.router.reset('hub');
      DK.ui.toast(t('newGame.welcome', { name: DK.daskai.name(d), player: params.name }), { icon: 'sparkles', kind: 'good' });
    };

    const drawDetail = () => {
      const sp = D.species[params.pick];
      const hs = D.houses[sp.house];
      const evo = sp.evolve ? D.species[sp.evolve.into] : null;
      detail.replaceChildren(
        h('div', { class: 'starter-detail-head', style: { '--c': D.houseColor(sp.house) } },
          V.sprite(sp.id, { size: 150, cls: 'float' }),
          h('div', null, h('h2', null, sp.name), V.houseBadge(sp.house), h('p', { class: 'muted' }, sp.desc),
            h('p', { class: 'small' }, DK.icon(hs.icon, 14), ' ', t('newGame.matchup', { strong: DK.tr('houses', D.houses[hs.strongVs]), weak: DK.tr('houses', V.weakAgainst(sp.house)) })),
            evo ? h('p', { class: 'small' }, DK.icon('evolve', 14), ' ', t('newGame.evolves', { into: evo.name, n: sp.evolve.level })) : null)),
        h('div', { class: 'mini-stats' }, D.statKeys.map((k) =>
          h('div', { class: 'mini-stat' }, h('span', { tip: DK.tr('stats', D.stats[k]) }, DK.icon(D.stats[k].icon, 14), DK.tr('stats', D.stats[k], 'short')), h('div', { class: 'stat-bar' }, h('div', { style: { width: (sp.base[k] / 70) * 100 + '%' } })), h('b', null, sp.base[k])))),
        h('div', { class: 'row between wrap gap' },
          btn({ icon: 'back', label: t('newGame.changeName'), variant: 'ghost', onClick: () => { params.step = 'name'; DK.router.refresh(); } }),
          btn({ icon: 'check', label: t('newGame.choose', { name: sp.name }), variant: 'primary', onClick: start, hotkey: '↵' })));
      grid.querySelectorAll('.starter-card').forEach((c) => c.classList.toggle('selected', c.dataset.id === params.pick));
    };

    starters.forEach((sp, i) => {
      const choose = () => { params.pick = sp.id; DK.audio.sfx('select'); drawDetail(); };
      const c = h('button', { class: 'starter-card', type: 'button', dataset: { id: sp.id }, style: { '--c': D.houseColor(sp.house) } },
        V.sprite(sp.id, { size: 84 }), h('b', null, sp.name), V.houseBadge(sp.house), h('kbd', { class: 'hotkey' }, i + 1));
      c.addEventListener('click', choose);
      DK.keys.on(String(i + 1), choose);
      grid.append(c);
    });
    DK.keys.on('Enter', start);
    drawDetail();
    return h('div', { class: 'screen' }, h('p', { class: 'muted center' }, t('newGame.pickText', { name: params.name })), grid, detail);
  }
})();
