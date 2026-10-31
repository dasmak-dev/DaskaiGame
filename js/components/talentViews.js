/* =============================================================
 * components/talentViews.js — Talentos (cada 10 niveles, 1 de 2).
 *
 *   V.talentTab(d, changed)  → pestaña «Talentos» de la ficha
 *   V.talentDialog(d)        → ventana para elegir los talentos pendientes
 *   V.talentText(id)         → «+8% ataque»
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data;
  const t = (k, v) => DK.t(k, v);
  const V = (DK.views = DK.views || {});

  /** Efecto de un talento en texto corto. */
  V.talentText = (id) => {
    const tl = D.talents[id], parts = [];
    const mods = Object.entries(tl.mods || {});
    if (mods.length === D.statKeys.length && mods.every(([, v]) => v === mods[0][1])) parts.push(t('talent.all', { n: Math.round(mods[0][1] * 100) }));
    else mods.forEach(([k, v]) => parts.push(`${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${DK.tr('stats', D.stats[k]).toLowerCase()}`));
    if (tl.regen) parts.push(t('talent.regen', { n: tl.regen }));
    return parts.join(' · ');
  };

  /** Tarjeta de un talento (elegible o ya elegido). */
  const card = (id, { chosen, other, onPick } = {}) => h(onPick ? 'button' : 'div', {
    class: 'talent-card' + (chosen ? ' chosen' : '') + (other ? ' other' : '') + (onPick ? ' pickable' : ''), type: onPick ? 'button' : null, onClick: onPick || null },
    h('span', { class: 'talent-icon' }, DK.icon(D.talents[id].icon, 20)),
    h('span', { class: 'talent-main' }, h('b', null, t(`talent.${id}.name`)), h('span', { class: 'small' }, V.talentText(id)), h('span', { class: 'muted small' }, t(`talent.${id}.desc`))),
    chosen ? DK.icon('check', 16) : null);

  /** Fila de un nivel de talento: las dos opciones. */
  function tierRow(d, tier, onPick) {
    const [a, b] = DK.daskai.talentOptions(d, tier);
    const chosen = (d.talents || {})[tier];
    const unlocked = d.level >= tier;
    return h('div', { class: 'talent-tier' + (unlocked ? '' : ' locked') + (unlocked && !chosen ? ' pending' : '') },
      h('span', { class: 'talent-lvl' }, h('span', null, t('common.lvl'), ' ', h('b', null, tier))),
      h('div', { class: 'talent-pair' }, [a, b].map((id) => card(id, {
        chosen: chosen === id, other: chosen && chosen !== id,
        onPick: unlocked && !chosen ? () => onPick(tier, id) : null,
      }))));
  }

  /**
   * Sección de talentos de la ficha (pestaña Atributos): los pendientes con
   * sus dos opciones, los elegidos en una línea y el próximo nivel.
   */
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
    const chosen = Object.entries(d.talents || {}).sort((a, b) => a[0] - b[0]);
    return h('div', { class: 'stack-s talent-section' },
      h('h4', { class: 'row gap-s' }, DK.icon('star', 16), t('talent.tab'), h('span', { class: 'muted small', tip: t('talent.help', { n: every }) }, DK.icon('info', 13))),
      pending.length ? h('div', { class: 'talent-list' }, pending.map((tier) => tierRow(d, tier, pick))) : null,
      chosen.length ? h('div', { class: 'chips' }, chosen.map(([tier, id]) => h('span', { class: 'chip talent-chip', tip: `${t('common.lvl')} ${tier} · ${V.talentText(id)}\n${t(`talent.${id}.desc`)}` }, DK.icon(D.talents[id].icon, 13), t(`talent.${id}.name`)))) : null,
      next <= DK.config.maxLevel ? h('p', { class: 'muted small' }, DK.icon('clock', 12), ' ', t('talent.next', { n: next })) : null);
  };

  /** Ventana para elegir los talentos pendientes (tras subir de nivel). */
  V.talentDialog = async (d) => {
    while (DK.daskai.talentsPending(d).length) {
      const tier = DK.daskai.talentsPending(d)[0];
      const [a, b] = DK.daskai.talentOptions(d, tier);
      const id = await DK.ui.modal({
        title: t('talent.title', { name: DK.daskai.name(d), level: tier }), icon: 'star', cls: 'talent-modal',
        content: (close) => h('div', { class: 'stack-s' }, h('p', { class: 'muted' }, t('talent.choose')),
          h('div', { class: 'talent-pair big' }, [a, b].map((x) => card(x, { onPick: () => close(x) })))),
        actions: [{ label: t('talent.later'), icon: 'clock', variant: 'ghost', value: null }],
      }).promise;
      if (!id) return;
      DK.daskai.chooseTalent(d, tier, id);
      DK.audio.sfx('levelup');
      DK.ui.toast(t('talent.chosen', { name: DK.daskai.name(d), talent: t(`talent.${id}.name`) }), { icon: D.talents[id].icon, kind: 'good' });
    }
  };
})();
