/* =============================================================
 * screens/camp.js — Mejoras: mejoras permanentes (data/upgrades.js, DK.camp).
 *
 * Se pagan con EMBLEMAS (1 por jefe derrotado) y se compran AL TERMINAR
 * cada expedición, en su resumen (screens/expSummary.js usa
 * V.upgradeCard con canBuy). Esta pantalla es el catálogo: lo que tienes,
 * lo que cuesta cada nivel y cuántos emblemas guardas.
 *
 * Cada tarjeta muestra el nivel actual, lo que da el siguiente nivel
 * y su precio. Para añadir una mejora: data/upgrades.js + textos en
 * lang → camp.up.<id> + leer DK.camp.value('<id>') donde se aplique.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const V = DK.views;
  const { t } = DK;


  /** Texto del efecto de una mejora con un valor concreto. */
  /** Texto del efecto con un valor. Si hay un texto propio por nivel (lv1, lv2…) se usa ese. */
  const effectText = (u, value) => {
    const lv = u.levels.findIndex((l) => l.value === value) + 1;
    const own = DK.i18n.lookup(DK.i18n.lang, `camp.up.${u.id}.lv${lv}`);
    return own || t(`camp.up.${u.id}.effect`, { n: value < 1 ? Math.round(value * 100) : value });
  };

  /** Emblemas como «chip» (moneda de las mejoras). */
  V.emblems = (n) => h('span', { class: 'emblems', tip: t('emblem.help') }, DK.icon('emblem', 15), h('b', null, String(n)));

  /**
   * Tarjeta de una mejora.
   * @param {boolean} canBuy  true sólo en el resumen de la expedición (se compra ahí)
   */
  function upgradeCard(u, refresh, canBuy = false) {
    const lv = DK.camp.level(u.id), max = u.levels.length;
    const next = DK.camp.next(u.id);
    const cur = DK.camp.value(u.id);
    const canPay = next && DK.camp.emblems() >= next.cost;
    const buy = () => {
      if (!DK.camp.buy(u.id)) { DK.audio.sfx('error'); DK.ui.toast(t('camp.noEmblems'), { icon: 'emblem', kind: 'bad' }); return; }
      DK.audio.sfx('levelup'); DK.ui.toast(t('camp.bought', { name: t(`camp.up.${u.id}.name`) }), { icon: u.icon, kind: 'good' });
      DK.app.renderNav(); refresh();
    };
    return h('div', { class: 'card camp-card' + (lv ? ' owned' : '') + (!next ? ' maxed' : '') },
      h('div', { class: 'camp-card-head' },
        h('span', { class: 'camp-icon' }, DK.icon(u.icon, 26)),
        h('div', { class: 'grow' }, h('b', null, t(`camp.up.${u.id}.name`)), h('p', { class: 'muted small' }, t(`camp.up.${u.id}.desc`))),
        h('span', { class: 'camp-level', tip: t('camp.levelTip') }, `${lv}/${max}`)),
      h('div', { class: 'camp-pips' }, u.levels.map((_, i) => h('span', { class: 'pip' + (i < lv ? ' on' : '') }))),
      lv ? h('p', { class: 'small' }, DK.icon('check', 13), ' ', t('camp.now'), ' ', h('b', null, effectText(u, cur))) : null,
      next ? h('div', { class: 'camp-buy' },
        h('span', { class: 'small' }, lv ? t('camp.nextLevel') : t('camp.firstLevel'), ' ', h('b', null, effectText(u, next.value))),
        canBuy ? btn({ icon: 'emblem', label: t('camp.buy', { n: next.cost }), variant: canPay ? 'primary' : 'tone', size: 'sm', disabled: !canPay, tip: canPay ? null : t('camp.missing', { n: next.cost - DK.camp.emblems() }), onClick: buy })
          : h('span', { class: 'camp-cost', tip: t('camp.buyAtEnd') }, DK.icon('emblem', 13), ' ', next.cost))
        : h('span', { class: 'badge good' }, DK.icon('crown', 13), t('camp.maxed')));
  }

  V.upgradeCard = upgradeCard;

  /**
   * Las Mejoras NO se ven desde el menú: sólo aparecen al terminar una
   * expedición (V.upgradeMenu, desde screens/expSummary.js). Si algo
   * intenta abrir la pantalla 'camp', se vuelve al Inicio.
   */
  DK.screens.register('camp', {
    title: () => t('nav.camp'), icon: 'star', section: 'home', music: 'menu',
    render() { setTimeout(() => DK.router.reset('hub'), 0); return h('div'); },
  });

  /** Contenido del menú de Mejoras (emblemas + tarjetas con «Mejorar»). */
  V.upgradeShop = (refresh) => {
    const U = DK.data.upgrades;
    const total = U.reduce((a, u) => a + u.levels.length, 0);
    const have = U.reduce((a, u) => a + DK.camp.level(u.id), 0);
    const n = DK.camp.affordable();
    return h('div', { class: 'stack upgrade-shop' },
      h('div', { class: 'row between wrap gap-s upgrade-shop-head' },
        h('p', { class: 'muted small grow' }, t('camp.text')),
        h('div', { class: 'row gap-s' }, h('span', { class: 'chip' }, DK.icon('star', 13), t('camp.levels', { n: have, total })), V.emblems(DK.camp.emblems()))),
      h('div', { class: 'warning ' + (n ? 'good' : '') }, DK.icon('emblem', 16), h('span', null, n ? t(n === 1 ? 'sum.shopCanOne' : 'sum.shopCan', { n }) : t('camp.saveHint'))),
      DK.data.upgradeGroups.map((g) => h('section', { class: 'stack-s' },
        h('h4', { class: 'camp-group' }, t('camp.group.' + g)),
        h('div', { class: 'camp-grid' }, U.filter((u) => u.group === g).map((u) => upgradeCard(u, refresh, true))))));
  };

  /** Abre el menú de Mejoras (panel; hoja inferior en el móvil). onChange tras cada compra. */
  V.upgradeMenu = (onChange = () => {}) => {
    const holder = h('div');
    const draw = () => holder.replaceChildren(V.upgradeShop(() => { draw(); onChange(); }));
    draw();
    return DK.ui.drawer({ id: 'upgrades', title: t('sum.shopTitle'), icon: 'emblem', size: 'wide', cls: 'upgrade-drawer', content: holder,
      actions: [{ label: t('camp.closeMenu'), icon: 'check', variant: 'primary' }] });
  };
})();
