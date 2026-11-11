/* =============================================================
 * components/talentViews.js — Talentos (v4.96: cada 25 niveles, 1 de 3).
 *
 *   V.talentTab(d, changed)  → sección «Talentos» de la ficha (pista 25·50·75·100)
 *   V.talentDialog(d)        → ventana para elegir los talentos pendientes (v5.27: filas compactas, optRow)
 *   V.talentText(id)         → «+18% ataque · +8% prob. de crítico»
 *   V.talentFlush()          → abre la ventana a los que subieron a un nivel de talento
 *                              fuera de la vista (banquillo, objetos de la Bolsa…)
 *
 * La ventana recomienda: DK.daskai.talentProfile(d) mide si pega físico o
 * mágico, si aguanta, si es rápido y si usa estados; talentFit puntúa cada
 * opción (3 estrellas = le encaja muy bien) y la mejor lleva «Recomendado».
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = (DK.views = DK.views || {});
  const pctTxt = (v) => Math.round(v * 100);
  const queue = new Set(); // v4.96: daskai que subieron a un nivel de talento (V.talentFlush)

  /** Líneas de efecto de un talento: [{ txt, neg }] */
  V.talentLines = (id) => {
    const tl = D.talents[id], out = [];
    const mods = Object.entries(tl.mods || {});
    if (mods.length === D.statKeys.length && mods.every(([, v]) => v === mods[0][1])) out.push({ txt: t('talent.all', { n: pctTxt(mods[0][1]) }) });
    else mods.forEach(([k, v]) => out.push({ txt: `${v > 0 ? '+' : ''}${pctTxt(v)}% ${DK.tr('stats', D.stats[k]).toLowerCase()}`, neg: v < 0 }));
    if (tl.regen) out.push({ txt: t('talent.regen', { n: tl.regen }) });
    Object.entries(tl.fx || {}).forEach(([k, v]) => out.push({ txt: t('talent.fx.' + k, { n: pctTxt(v) }) }));
    return out;
  };
  /** Efecto de un talento en texto corto. */
  V.talentText = (id) => V.talentLines(id).map((l) => l.txt).join(' · ');

  /** Estrellas de encaje (1–3). */
  const fitStars = (score) => (score >= 0.62 ? 3 : score >= 0.42 ? 2 : 1);

  /** Tarjeta de un talento. o: { chosen, other, onPick, fit, best, big } */
  const card = (id, o = {}) => {
    const tl = D.talents[id], st = o.fit ? fitStars(o.fit.score) : 0;
    return h(o.onPick ? 'button' : 'div', {
      class: 'tl-card' + (o.chosen ? ' chosen' : '') + (o.other ? ' other' : '') + (o.onPick ? ' pickable' : '') + (o.best ? ' best' : '') + (o.big ? ' big' : ''),
      type: o.onPick ? 'button' : null, onClick: o.onPick || null, style: { '--tc': tl.color || 'var(--accent)' } },
      o.best ? h('span', { class: 'tl-ribbon' }, DK.icon('star', 11), t('talent.best')) : null,
      h('span', { class: 'tl-ico' }, DK.icon(tl.icon, o.big ? 26 : 20)),
      h('b', { class: 'tl-name' }, t(`talent.${id}.name`)),
      h('span', { class: 'tl-desc' }, t(`talent.${id}.desc`)),
      h('ul', { class: 'tl-fx' }, V.talentLines(id).map((l) => h('li', { class: l.neg ? 'neg' : '' }, l.txt))),
      o.fit ? h('span', { class: 'tl-fit f' + st, tip: t('talent.fitLv.' + st) },
        h('span', { class: 'tl-stars' }, [1, 2, 3].map((i) => DK.icon('star', 12, i <= st ? 'on' : ''))),
        h('small', null, t('talent.fitLv.' + st), o.fit.why && st >= 2 ? ': ' + t('talent.why.' + o.fit.why) : '')) : null,
      o.chosen ? h('span', { class: 'tl-check' }, DK.icon('check', 14)) : null,
      o.onPick && o.big ? h('span', { class: 'tl-pick' }, t('talent.pick')) : null);
  };

  /** Perfil del daskai (chips con barras): por qué se le recomienda lo que se le recomienda. */
  const profileChips = (d) => {
    const P = DK.daskai.talentProfile(d);
    return h('div', { class: 'tl-prof' }, h('small', { class: 'muted' }, t('talent.profile')),
      ['phys', 'mag', 'tank', 'fast', 'status'].map((k) => h('span', { class: 'tl-pchip' + (P[k] >= 0.6 ? ' hi' : ''), tip: Math.round(P[k] * 100) + '%' },
        t('talent.prof.' + k), h('i', null, h('i', { style: { width: Math.round(P[k] * 100) + '%' } })))));
  };

  /** Pista de niveles de talento (25 · 50 · 75 · 100) con lo elegido. */
  const track = (d, mini = false) => {
    const every = DK.config.talentEvery, tiers = [];
    for (let l = every; l <= DK.config.maxLevel; l += every) tiers.push(l);
    return h('div', { class: 'tl-track' + (mini ? ' mini' : ''), 'aria-label': t('talent.track') }, tiers.map((lv) => {
      const id = (d.talents || {})[lv], open = d.level >= lv && !id;
      return h('span', { class: 'tl-node' + (id ? ' done' : open ? ' open' : ''), style: id ? { '--tc': D.talents[id].color } : null,
        tip: id ? `${t(`talent.${id}.name`)} · ${V.talentText(id)}` : `${t('common.lvl')} ${lv}` },
        h('span', { class: 'tl-dot' }, id ? DK.icon(D.talents[id].icon, 14) : open ? DK.icon('star', 13) : DK.icon('lock', 11)),
        h('small', null, id ? t(`talent.${id}.name`) : `${t('common.lvl')} ${lv}`));
    }));
  };

  /** Opciones de un nivel con su encaje y la recomendada. */
  const optionsOf = (d, tier) => {
    const ids = DK.daskai.talentOptions(d, tier), prof = DK.daskai.talentProfile(d);
    const fits = ids.map((id) => DK.daskai.talentFit(d, id, prof));
    const bestI = fits.reduce((bi, f, i) => (f.score > fits[bi].score ? i : bi), 0);
    return { ids, fits, bestI };
  };

  /** v5.27: cómo cambian los atributos con un talento: [{ k, now, v, dv }] (sólo los que cambian) */
  const deltasOf = (d, tier, id) => {
    const c = JSON.parse(JSON.stringify(d)); c.talents = Object.assign({}, c.talents, { [tier]: id });
    const now = DK.daskai.stats(d), w = DK.daskai.stats(c);
    return D.statKeys.filter((k) => w[k] !== now[k]).map((k) => ({ k, now: now[k], v: w[k], dv: w[k] - now[k] }));
  };

  /**
   * v5.27: opción de talento en una fila compacta (sustituye a las tarjetas altas): icono · nombre, «Recomendado» y
   * estrellas de encaje · descripción · efectos y cómo quedan sus atributos en chips · botón Elegir. Todas miden lo mismo.
   */
  const optRow = (d, tier, id, o = {}) => {
    const tl = D.talents[id], st = o.fit ? fitStars(o.fit.score) : 0;
    const why = o.fit ? t('talent.fitLv.' + st) + (o.fit.why && st >= 2 ? ': ' + t('talent.why.' + o.fit.why) : '') : '';
    return h('button', { class: 'tl-opt' + (o.best ? ' best' : ''), type: 'button', onClick: o.onPick, style: { '--tc': tl.color || 'var(--accent)' },
      'aria-label': `${t(`talent.${id}.name`)} · ${V.talentText(id)}` },
      h('span', { class: 'tl-ico' }, DK.icon(tl.icon, 20)),
      h('span', { class: 'tl-main' },
        h('span', { class: 'tl-top' }, h('b', { class: 'tl-name' }, t(`talent.${id}.name`)),
          o.best ? h('span', { class: 'tl-best' }, DK.icon('star', 10), t('talent.best')) : null,
          st ? h('span', { class: 'tl-stars f' + st, tip: why }, [1, 2, 3].map((i) => DK.icon('star', 11, i <= st ? 'on' : ''))) : null),
        h('span', { class: 'tl-desc' }, t(`talent.${id}.desc`), why ? h('em', null, ' · ' + why) : null),
        h('span', { class: 'tl-chips' },
          V.talentLines(id).map((l) => h('span', { class: 'tl-chip' + (l.neg ? ' neg' : '') }, l.txt)),
          deltasOf(d, tier, id).map((x) => h('span', { class: 'tl-delta', tip: t('talent.compare') }, DK.icon(D.stats[x.k].icon, 11),
            DK.tr('stats', D.stats[x.k], 'short'), ' ', h('s', null, String(x.now)), ' → ', h('b', null, String(x.v)), h('small', { class: x.dv > 0 ? 'up' : 'down' }, (x.dv > 0 ? ' +' : ' ') + x.dv))))),
      h('span', { class: 'tl-go' }, t('talent.pick'), DK.icon('next', 14)));
  };

  /** Fila de un nivel de talento pendiente: sus tres opciones. */
  function tierRow(d, tier, onPick) {
    const { ids, fits, bestI } = optionsOf(d, tier);
    return h('div', { class: 'tl-tier pending' },
      h('span', { class: 'tl-lvl' }, t('common.lvl'), ' ', h('b', null, tier)),
      h('div', { class: 'tl-opts' }, ids.map((id, i) => optRow(d, tier, id, { fit: fits[i], best: i === bestI, onPick: () => onPick(tier, id) }))));
  }

  /** Sección de talentos de la ficha (pestaña Atributos). */
  V.talentTab = (d, changed) => {
    const every = DK.config.talentEvery;
    const next = (Math.floor(d.level / every) + 1) * every;
    const pick = (tier, id) => {
      if (!DK.daskai.chooseTalent(d, tier, id)) return;
      DK.audio.sfx('levelup');
      DK.ui.toast(t('talent.chosen', { name: DK.daskai.name(d), talent: t(`talent.${id}.name`) }), { icon: D.talents[id].icon, kind: 'good' });
      changed();
    };
    const pending = DK.daskai.talentsPending(d);
    return h('div', { class: 'stack-s talent-section' },
      h('div', { class: 'tl-sec-head' }, h('h4', { class: 'row gap-s' }, DK.icon('star', 16), t('talent.tab'), h('span', { class: 'muted small', tip: t('talent.help', { n: every }) }, DK.icon('info', 13))),
        track(d, true)),
      pending.length ? profileChips(d) : null,
      pending.length ? h('div', { class: 'tl-list' }, pending.map((tier) => tierRow(d, tier, pick))) : null,
      next <= DK.config.maxLevel ? h('p', { class: 'muted small' }, DK.icon('clock', 12), ' ', t('talent.next', { n: next })) : null);
  };

  /** Atributos ahora y con cada opción (la mayor mejora resaltada). */
  V.talentCompare = (d, tier, ...ids) => {
    const withT = (id) => { const c = JSON.parse(JSON.stringify(d)); c.talents = Object.assign({}, c.talents, { [tier]: id }); return DK.daskai.stats(c); };
    const now = DK.daskai.stats(d), all = ids.map(withT);
    const keys = D.statKeys.filter((k) => all.some((s) => s[k] !== now[k]));
    if (!keys.length) return null;
    return h('div', { class: 'tl-cmp-wrap' }, h('table', { class: 'tc-table tl-cmp' },
      h('thead', null, h('tr', null, h('th', null, t('talent.compare')), h('th', null, t('talent.now')),
        ids.map((id) => h('th', { style: { color: D.talents[id].color } }, DK.icon(D.talents[id].icon, 13), h('span', null, t(`talent.${id}.name`)))))),
      h('tbody', null, keys.map((k) => {
        const deltas = all.map((s) => s[k] - now[k]), max = Math.max(...deltas);
        return h('tr', null, h('td', { class: 'tc-k' }, DK.icon(D.stats[k].icon, 14), DK.tr('stats', D.stats[k], 'short')), h('td', { class: 'tc-v' }, h('b', null, String(now[k]))),
          all.map((s, i) => h('td', { class: 'tc-v' + (deltas[i] > 0 && deltas[i] === max ? ' best' : '') }, h('b', null, String(s[k])),
            deltas[i] ? h('small', { class: deltas[i] > 0 ? 'up' : 'down' }, (deltas[i] > 0 ? '+' : '') + deltas[i]) : null)));
      }))));
  };

  /** Ventana para elegir los talentos pendientes (rediseñada en la v4.96). */
  V.talentDialog = async (d) => {
    queue.delete(d.uid);
    while (DK.daskai.talentsPending(d).length) {
      const tier = DK.daskai.talentsPending(d)[0];
      const { ids, fits, bestI } = optionsOf(d, tier);
      const id = await DK.ui.modal({
        title: t('talent.title', { name: DK.daskai.name(d), level: tier }), icon: 'star', cls: 'talent-modal tl-modal tl-compact',
        content: (close) => h('div', { class: 'tl-dlg' },
          h('div', { class: 'tl-head' }, V.dSprite(d, { size: 52, cls: 'float' }),
            h('div', { class: 'tl-head-t' }, h('b', null, DK.daskai.name(d)), h('small', { class: 'muted' }, `${t('common.lvl')} ${d.level} · `, DK.tr('natures', D.natures[d.nature]))),
            track(d, true)),
          profileChips(d),
          h('p', { class: 'muted small tl-hint' }, DK.icon('info', 13), ' ', t('talent.choose')),
          h('div', { class: 'tl-opts' }, ids.map((x, i) => optRow(d, tier, x, { fit: fits[i], best: i === bestI, onPick: () => close(x) })))),
        actions: [{ label: t('talent.later'), icon: 'clock', variant: 'ghost', value: null }],
      }).promise;
      if (!id) return;
      DK.daskai.chooseTalent(d, tier, id);
      DK.audio.sfx('levelup');
      DK.ui.toast(t('talent.chosen', { name: DK.daskai.name(d), talent: t(`talent.${id}.name`) }), { icon: D.talents[id].icon, kind: 'good' });
    }
  };

  /*
   * v4.96: ¿por qué a veces no salía la ventana? Sólo se abría desde la ventana de subida de nivel
   * del daskai que combatía. Si subía otro del equipo (experiencia compartida del banquillo), o con
   * un objeto desde la Bolsa (modo silencioso), sólo salía un aviso. Ahora cada subida a un nivel de
   * talento queda apuntada y, al volver a una pantalla tranquila (sin ventanas abiertas y fuera del
   * combate), se abre la ventana de los que tengan talentos por elegir.
   */
  let busy = false;
  DK.on('levelUp', ({ d, level }) => { if (d && !d.temp && level % DK.config.talentEvery === 0) queue.add(d.uid); });
  V.talentFlush = async () => {
    if (busy || !queue.size || !DK.store.state) return;
    if (document.querySelector('.modal-backdrop')) return;
    const cur = DK.router && DK.router.current && DK.router.current();
    if (cur && ['battle', 'mainMenu'].includes(cur.id)) return;
    busy = true;
    try {
      for (const uid of [...queue]) {
        queue.delete(uid);
        const d = DK.party.get(uid);
        if (d && DK.daskai.talentsPending(d).length) await V.talentDialog(d);
      }
    } finally { busy = false; }
    if (DK.router && DK.router.refresh) DK.router.refresh();
  };
  DK.on('screen:enter', () => setTimeout(() => {
    // v4.96: aviso único si la partida tenía talentos del sistema antiguo (se devolvieron al cargar)
    const st = DK.store.state;
    if (st && st.talentReset) { delete st.talentReset; DK.ui.toast(t('talent.reset'), { icon: 'star', kind: 'good', duration: 7000 }); DK.store.save(); }
    V.talentFlush();
  }, 450));
})();
