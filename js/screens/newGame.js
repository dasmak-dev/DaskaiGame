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
    // v4.46: cada inicial ya nace al entrar en esta pantalla (genes, naturaleza, pasiva y rasgo al azar),
    // así lo que ves es exactamente el daskai que te llevas
    params.rolls = params.rolls || {};
    starters.forEach((s) => { if (!params.rolls[s.id]) params.rolls[s.id] = DK.daskai.create(s.id, DK.config.starterLevel, { starter: true }); });
    const statsOf = (id) => DK.daskai.stats(params.rolls[id]);
    const best = Object.fromEntries(D.statKeys.map((k) => [k, Math.max(...starters.map((s) => statsOf(s.id)[k]))]));
    const refresh = () => DK.router.refresh();

    const start = () => {
      const d = DK.store.newGame(params.slot, params.name, params.pick, params.difficulty, params.rolls[params.pick]);
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
    const line = [sp]; while (line[line.length - 1].evolve && line.length < 6) line.push(D.species[line[line.length - 1].evolve.into]);

    const picker = h('div', { class: 'st-picker', role: 'radiogroup', 'aria-label': t('newGame.pickTitle') }, starters.map((s, i) =>
      h('button', { class: 'st-pick' + (s.id === params.pick ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(s.id === params.pick), 'aria-label': DK.daskai.name(params.rolls[s.id]),
        tip: `${DK.daskai.name(params.rolls[s.id])} · ${s.name} · ${DK.tr('houses', D.houses[s.house])}`, style: { '--c': D.houseColor(s.house) }, onClick: () => choose(s.id) },
        V.sprite(s.id, { size: 52, look: DK.looks.of(params.rolls[s.id]) }), h('span', { class: 'st-pick-house' }, DK.icon(D.houses[s.house].icon, 12)), h('kbd', { class: 'hotkey' }, String(i + 1)))));

    const stage = h('div', { class: 'st-stage', style: { '--c': D.houseColor(sp.house) } },
      h('button', { class: 'st-arrow prev', type: 'button', 'aria-label': t('detail.prev'), onClick: () => step(-1) }, DK.icon('back', 22)),
      h('div', { class: 'st-hero' }, h('span', { class: 'st-pedestal', 'aria-hidden': 'true' }), V.sprite(sp.id, { size: 168, cls: 'float', look: DK.looks.of(params.rolls[sp.id]) })),
      h('button', { class: 'st-arrow next', type: 'button', 'aria-label': t('detail.next'), onClick: () => step(1) }, DK.icon('next', 22)));
    // Deslizar en el móvil
    let x0 = null;
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1); });

    // Atributos de ESTE daskai: se resaltan los que ha sacado por encima de lo normal de su especie (genes + rasgo)
    const dd = params.rolls[sp.id], ds = statsOf(sp.id);
    const luck = (k) => (1 + ((dd.genes && dd.genes[k]) || 0)) * (1 + ((DK.daskai.roleOf(dd).mods || {})[k] || 0)) - 1; // v5.18: genes + rasgo
    const stats = h('div', { class: 'st-stats' }, D.statKeys.map((k) => {
      const l = luck(k), pct = Math.round(l * 100);
      return h('div', { class: 'st-stat' + (pct >= 4 ? ' top' : pct <= -4 ? ' low' : ''), tip: DK.tr('stats', D.stats[k], 'desc') || DK.tr('stats', D.stats[k]) },
        h('span', { class: 'st-stat-name' }, DK.icon(D.stats[k].icon, 14), DK.tr('stats', D.stats[k], 'short')),
        h('b', null, ds[k], pct ? h('small', { class: 'st-luck ' + (pct > 0 ? 'up' : 'down') }, (pct > 0 ? '+' : '') + pct + '%') : null),
        h('span', { class: 'st-stat-bar' }, h('i', { style: { width: Math.round((ds[k] / best[k]) * 100) + '%' } })));
    }));
    const traits = h('div', { class: 'st-traits' }, V.natureInfo(dd), V.passiveInfo(dd)); // (v5.47: el rasgo va junto al nombre para que la ficha no cambie de alto)

    const info = h('div', { class: 'st-info' },
      // v4.56: su nombre propio (systems/names.js); la especie, al lado en pequeño
      h('div', { class: 'st-title' }, h('h2', { tip: DK.daskai.name(dd) }, DK.daskai.name(dd)), h('span', { class: 'dk-species' }, sp.name), V.housesBadge(dd), V.roleBadge(dd)),
      h('div', { class: 'chips' },
        // v4.72: con doble casa cuentan las dos (eficacia multiplicada, como en combate)
        ...(() => {
          const mine = DK.daskai.houses(dd), all = Object.keys(D.houses), nm = (l) => l.map((x) => DK.tr('houses', D.houses[x])).join(' · ');
          const strong = all.filter((x) => mine.some((m) => DK.battle.houseMult(m, [x]).mult > 1.001));
          const weak = all.filter((x) => DK.battle.houseMult(x, mine).mult > 1.001);
          return [strong.length ? h('span', { class: 'chip pos' }, DK.icon('swords', 13), t('newGame.strong', { house: nm(strong) })) : null,
            weak.length ? h('span', { class: 'chip neg' }, DK.icon('shield', 13), t('newGame.weak', { house: nm(weak) })) : null];
        })(),
        null),
      // Línea evolutiva completa (los iniciales tienen tres evoluciones)
      line.length > 1 ? h('div', { class: 'st-line', 'aria-label': t('newGame.lineTitle') }, line.map((x, i) => [
        i ? h('span', { class: 'st-line-step' }, DK.icon('next', 14), h('small', null, `${t('common.lvl')} ${line[i - 1].evolve.level}`)) : null,
        // v4.49: las 2 últimas evoluciones son un secreto (sólo silueta); al pasar el ratón (o tocar) se ven en grande
        (() => {
          const secret = i > 0 && i >= line.length - 2, r0 = params.rolls[sp.id], look = r0.house2 ? Object.assign({}, r0.look, { h2: r0.house2 }) : r0.look; // v4.72: con su segunda casa (la etapa sale de cada especie)
          return h('span', { class: 'st-line-mon' + (i ? '' : ' on') + (secret ? ' secret' : ''), tabindex: '0', 'aria-label': secret ? t('newGame.secretEvo') : x.name },
            V.sprite(x.id, { size: 44, look, silhouette: secret }), h('small', null, secret ? '???' : x.name),
            h('span', { class: 'st-line-peek', 'aria-hidden': 'true' }, V.sprite(x.id, { size: 132, look, silhouette: secret }),
              h('b', null, secret ? t('newGame.secretEvo') : x.name), h('small', null, i ? `${t('common.lvl')} ${line[i - 1].evolve.level}` : t('newGame.firstForm'))));
        })()])) : null,
      traits,
      h('div', { class: 'st-stats-head' }, h('b', null, t('newGame.statsTitle')), h('span', { class: 'muted small' }, t('newGame.statsNote', { n: Math.round(DK.config.genes * 100) }))),
      stats);

    return h('div', { class: 'screen starter-screen' },
      h('p', { class: 'muted center st-intro' }, t('newGame.pickText', { name: params.name })),
      picker,
      h('section', { class: 'card sp-card', style: { '--c': D.houseColor(sp.house) } }, stage, info),
      h('div', { class: 'st-actions' },
        btn({ icon: 'back', label: t('newGame.changeName'), variant: 'ghost', onClick: () => { params.step = 'name'; refresh(); } }),
        btn({ icon: 'check', label: t('newGame.choose', { name: DK.daskai.name(params.rolls[sp.id]) }), variant: 'primary', size: 'lg', onClick: start, hotkey: '↵', cls: 'st-go' })));
  }
})();
