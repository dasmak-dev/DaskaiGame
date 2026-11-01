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

  /**
   * Paso 2: daskai inicial, al estilo de elegir el primer Pokémon.
   *  - Arriba, los cinco como retratos pequeños en una fila (caben en el móvil).
   *  - En medio, el elegido en grande sobre un pedestal del color de su casa,
   *    con su casa, descripción, contra quién es fuerte o débil y su evolución.
   *  - Sus atributos en fichas (valor y barra comparada con el mejor inicial
   *    en ese atributo) y el botón para empezar (fijo abajo en el móvil).
   *  ← / → o 1-5 cambian de daskai; en el móvil también se puede deslizar.
   */
  function renderStarter(params) {
    const starters = Object.values(D.species).filter((s) => s.starter);
    params.pick = params.pick || starters[0].id;
    const best = Object.fromEntries(D.statKeys.map((k) => [k, Math.max(...starters.map((s) => s.base[k]))]));
    const refresh = () => DK.router.refresh();

    const start = () => {
      const d = DK.store.newGame(params.slot, params.name, params.pick, params.difficulty);
      DK.audio.sfx('levelup');
      DK.router.reset('hub');
      DK.ui.toast(t('newGame.welcome', { name: DK.daskai.name(d), player: params.name }), { icon: 'sparkles', kind: 'good' });
    };
    const choose = (id) => { if (id === params.pick) return; params.pick = id; DK.audio.sfx('select'); refresh(); };
    const step = (dir) => { const i = starters.findIndex((s) => s.id === params.pick); choose(starters[(i + dir + starters.length) % starters.length].id); };
    starters.forEach((sp, i) => DK.keys.on(String(i + 1), () => choose(sp.id)));
    DK.keys.on('ArrowLeft', () => step(-1)); DK.keys.on('ArrowRight', () => step(1));
    DK.keys.on('Enter', start);

    const sp = D.species[params.pick], hs = D.houses[sp.house];
    const evo = sp.evolve ? D.species[sp.evolve.into] : null;

    const picker = h('div', { class: 'st-picker', role: 'radiogroup', 'aria-label': t('newGame.pickTitle') }, starters.map((s, i) =>
      h('button', { class: 'st-pick' + (s.id === params.pick ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(s.id === params.pick), 'aria-label': s.name,
        tip: `${s.name} · ${DK.tr('houses', D.houses[s.house])}`, style: { '--c': D.houseColor(s.house) }, onClick: () => choose(s.id) },
        V.sprite(s.id, { size: 52 }), h('span', { class: 'st-pick-house' }, DK.icon(D.houses[s.house].icon, 12)), h('kbd', { class: 'hotkey' }, String(i + 1)))));

    const stage = h('div', { class: 'st-stage', style: { '--c': D.houseColor(sp.house) } },
      h('button', { class: 'st-arrow prev', type: 'button', 'aria-label': t('detail.prev'), onClick: () => step(-1) }, DK.icon('back', 22)),
      h('div', { class: 'st-hero' }, h('span', { class: 'st-pedestal', 'aria-hidden': 'true' }), V.sprite(sp.id, { size: 168, cls: 'float' })),
      h('button', { class: 'st-arrow next', type: 'button', 'aria-label': t('detail.next'), onClick: () => step(1) }, DK.icon('next', 22)));
    // Deslizar en el móvil
    let x0 = null;
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1); });

    const stats = h('div', { class: 'st-stats' }, D.statKeys.map((k) =>
      h('div', { class: 'st-stat' + (sp.base[k] === best[k] ? ' top' : ''), tip: DK.tr('stats', D.stats[k], 'desc') || DK.tr('stats', D.stats[k]) },
        h('span', { class: 'st-stat-name' }, DK.icon(D.stats[k].icon, 14), DK.tr('stats', D.stats[k], 'short')),
        h('b', null, sp.base[k]),
        h('span', { class: 'st-stat-bar' }, h('i', { style: { width: Math.round((sp.base[k] / best[k]) * 100) + '%' } })))));

    const info = h('div', { class: 'st-info' },
      h('div', { class: 'st-title' }, h('h2', null, sp.name), V.houseBadge(sp.house)),
      h('p', { class: 'st-desc' }, sp.desc),
      h('div', { class: 'chips' },
        h('span', { class: 'chip pos' }, DK.icon('swords', 13), t('newGame.strong', { house: DK.tr('houses', D.houses[hs.strongVs]) })),
        h('span', { class: 'chip neg' }, DK.icon('shield', 13), t('newGame.weak', { house: DK.tr('houses', V.weakAgainst(sp.house)) })),
        evo ? h('span', { class: 'chip' }, DK.icon('evolve', 13), t('newGame.evolves', { into: evo.name, n: sp.evolve.level })) : null),
      h('div', { class: 'st-stats-head' }, h('b', null, t('newGame.statsTitle')), h('span', { class: 'muted small' }, t('newGame.statsNote', { n: Math.round(DK.config.genes * 100) }))),
      stats);

    return h('div', { class: 'screen starter-screen' },
      h('p', { class: 'muted center st-intro' }, t('newGame.pickText', { name: params.name })),
      picker,
      h('section', { class: 'card st-card', style: { '--c': D.houseColor(sp.house) } }, stage, info),
      h('div', { class: 'st-actions' },
        btn({ icon: 'back', label: t('newGame.changeName'), variant: 'ghost', onClick: () => { params.step = 'name'; refresh(); } }),
        btn({ icon: 'check', label: t('newGame.choose', { name: sp.name }), variant: 'primary', size: 'lg', onClick: start, hotkey: '↵', cls: 'st-go' })));
  }
})();
