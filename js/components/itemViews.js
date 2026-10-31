/* =============================================================
 * components/itemViews.js — Vistas de objetos: icono, tarjeta,
 * detalle, ingredientes de recetas y diálogo "Curar con objetos".
 * ============================================================= */
(function () {
  const { h, btn, modal } = DK.ui;
  const D = DK.data;
  const t = (k, v) => DK.t(k, v);
  const V = (DK.views = DK.views || {});

  V.itemIcon = (it, size = 22) => h('span', { class: 'item-icon r-' + it.rarity, style: { '--c': it.color || 'var(--primary)' } }, DK.icon(it.icon, size));

  /**
   * Tarjeta de objeto.
   * @param {string} itemId
   * @param {number|null} qty  cantidad (null = no mostrar)
   * @param {Object} [o] {onClick, unknown, note, extra (nodo), selected}
   */
  V.itemCard = (itemId, qty, { onClick, unknown = false, note, extra, selected } = {}) => {
    const it = D.items[itemId];
    if (unknown) {
      return h('button', { class: 'item-card unknown', type: 'button', disabled: true },
        h('span', { class: 'item-icon' }, DK.icon('question', 22)), h('div', { class: 'item-main' }, h('span', { class: 'item-name' }, '???'), h('span', { class: 'muted small' }, t('common.undiscovered'))));
    }
    const el = h('button', { class: 'item-card r-' + it.rarity + (selected ? ' selected' : ''), type: 'button', tip: it.desc },
      V.itemIcon(it),
      h('div', { class: 'item-main' }, h('span', { class: 'item-name' }, it.name),
        h('span', { class: 'item-sub' }, V.rarity(it.rarity), note ? h('span', { class: 'muted small' }, note) : null), extra || null),
      qty != null ? h('span', { class: 'qty' }, 'x' + qty) : null);
    if (onClick) el.addEventListener('click', onClick);
    return el;
  };

  /**
   * Tarjeta de producto de tienda (comprar o vender).
   * @param {string} itemId
   * @param {Object} o
   *   price      precio unitario
   *   oldPrice   precio sin descuento (se tacha si es mayor)
   *   mode       'buy' | 'sell'
   *   qty        cantidad elegida (muestra el selector si hay onQty)
   *   max        máximo del selector
   *   onQty(n)   cambia la cantidad
   *   onBuy()    acción principal (comprar / vender)
   *   onAll()    vender todo (sólo en modo venta)
   *   sold       ya comprado (mercader de expedición)
   *   badges     nodos extra (oferta, "para receta favorita"...)
   *   hotkey
   */
  V.shopCard = (itemId, { price, oldPrice, mode = 'buy', qty = 1, max = 99, onQty, onBuy, onAll, sold = false, badges = [], hotkey } = {}) => {
    const it = D.items[itemId];
    const owned = DK.store.state ? DK.bag.count(itemId) : 0;
    const total = price * qty;
    const wallet = DK.store.state ? DK.wallet.get() : 0;
    const short = mode === 'buy' && !sold ? Math.max(0, total - wallet) : 0;
    const stepper = onQty ? h('div', { class: 'qty-stepper', role: 'group', 'aria-label': t('shop.qty') },
      h('button', { type: 'button', class: 'qty-btn', 'aria-label': '-', disabled: qty <= 1, onClick: () => onQty(Math.max(1, qty - 1)) }, DK.icon('minus', 14)),
      h('span', { class: 'qty-val' }, qty),
      h('button', { type: 'button', class: 'qty-btn', 'aria-label': '+', disabled: qty >= max, onClick: () => onQty(Math.min(max, qty + 1)) }, DK.icon('plus', 14))) : null;
    const action = sold
      ? h('span', { class: 'badge good' }, DK.icon('check', 13), t('exp.sold'))
      : DK.ui.btn({ icon: mode === 'buy' ? 'bag' : 'coin', label: mode === 'buy' ? t('shop.buyFor', { n: total.toLocaleString(DK.i18n.lang) }) : t('shop.sellFor', { n: total.toLocaleString(DK.i18n.lang) }),
        variant: 'tone', size: 'sm', hotkey, disabled: short > 0 || (mode === 'sell' && owned < qty),
        tip: short > 0 ? t('shop.missing', { n: short }) : null, onClick: onBuy });
    return h('div', { class: `shop-card r-${it.rarity}` + (sold ? ' sold' : '') + (oldPrice > price ? ' discounted' : ''), style: { '--c': it.color || 'var(--primary)' }, tip: it.desc },
      h('div', { class: 'shop-card-top' },
        V.itemIcon(it, 30),
        h('div', { class: 'shop-card-badges' }, V.rarity(it.rarity), ...badges)),
      h('div', { class: 'shop-card-body' },
        h('b', { class: 'shop-card-name' }, it.name),
        h('span', { class: 'muted small shop-card-effect' }, V.useText(it) || it.desc),
        h('span', { class: 'small shop-card-owned' + (owned ? '' : ' muted') }, DK.icon('bag', 12), ' ', t('item.owned', { n: owned }))),
      h('div', { class: 'shop-card-price' },
        h('span', { class: 'shop-price' }, DK.icon('coin', 16), h('b', null, price.toLocaleString(DK.i18n.lang)),
          oldPrice > price ? h('s', { class: 'muted small' }, oldPrice.toLocaleString(DK.i18n.lang)) : null,
          mode === 'sell' ? h('span', { class: 'muted small' }, t('shop.each')) : null),
        stepper),
      h('div', { class: 'shop-card-foot' }, action,
        onAll && owned > 1 ? DK.ui.btn({ icon: 'coin', label: t('shop.sellAll', { n: owned }), variant: 'ghost', size: 'sm', onClick: onAll }) : null,
        short > 0 ? h('span', { class: 'small shop-short' }, t('shop.missing', { n: short })) : null));
  };

  /**
   * Tras dar experiencia fuera de combate: subida de nivel, ataques nuevos y evolución.
   * @param {Object} d
   * @param {Object} info  resultado de DK.daskai.gainExp
   */
  V.afterLevel = async (d, info) => {
    if (!info) return;
    if (info.levels.length) await V.levelUpDialog(d, info);
    for (const m of info.pending) await V.learnMovePrompt(d, m);
    if (info.evolveReady) await V.evolveDialog(d);
  };

  /** Chips de ingredientes con "tengo/necesito". */
  V.ingredients = (recipe, times = 1) => h('div', { class: 'chips' }, Object.entries(recipe.ingredients).map(([id, n]) => {
    const have = DK.store.state ? DK.bag.count(id) : 0;
    const craftable = DK.crafting.recipeFor(id);
    return h('span', { class: 'chip ' + (have >= n * times ? 'pos' : craftable ? 'warnc' : 'neg'), tip: craftable && have < n * times ? t('craft.canChain') : null },
      DK.icon(D.items[id].icon, 13), `${D.items[id].name} ${have}/${n * times}`);
  }));

  /** Texto del efecto de un objeto de batalla. */
  V.useText = (it) => {
    const u = it.use || {}, eff = [];
    if (u.heal) eff.push(t('item.heals', { n: u.heal }));
    if (u.healPct) eff.push(t('item.healsPct', { n: Math.round(u.healPct * 100) }));
    if (u.mana) eff.push(t('item.mana', { n: u.mana }));
    if (u.manaPct) eff.push(t('item.manaPct', { n: Math.round(u.manaPct * 100) }));
    if (u.cure) eff.push(t('item.cures', { list: u.cure.map((c) => DK.tr('statuses', D.statuses[c]).toLowerCase()).join(', ') }));
    if (u.capture) eff.push(t('item.capture', { n: Math.round(u.capture * 100) }));
    if (u.exp) eff.push(t('item.exp', { n: u.exp.toLocaleString(DK.i18n.lang) }));
    if (u.levels) eff.push(t('item.levels', { n: u.levels }));
    if (u.perm) eff.push(t('item.perm', { stat: DK.tr('stats', D.stats[u.perm]), n: DK.config.tonic.per[u.perm] }));
    if (u.resetPerm) eff.push(t('item.resetPerm'));
    return eff.join(' · ');
  };

  /**
   * Botones grandes para filtrar objetos por tipo (bolsa, mochila, preparar).
   * @param {Array} cats   [{ id, icon, label, count }]
   * @param {string} value id elegido
   * @param {Function} onChange (id) => {}
   */
  V.catButtons = (cats, value, onChange) => h('div', { class: 'cat-buttons', role: 'tablist' }, cats.map((c) =>
    h('button', { class: 'cat-btn' + (value === c.id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': value === c.id, onClick: () => onChange(c.id) },
      h('span', { class: 'cat-btn-icon' }, DK.icon(c.icon, 20)), h('span', { class: 'cat-btn-label' }, c.label),
      c.count != null ? h('b', { class: 'cat-btn-count' }, String(c.count)) : null)));

  /** Contenido detallado de un objeto (bolsa, tienda y códice). */
  V.itemDetail = (itemId) => {
    const it = D.items[itemId];
    const cat = D.categories[it.category];
    const rows = [];
    if (it.use) rows.push(h('div', { class: 'kv' }, h('span', null, t('item.effect')), h('b', null, V.useText(it))));
    if (it.stats) rows.push(h('div', { class: 'kv' }, h('span', null, t('item.bonus')), V.statChips(it.stats)));
    if (it.grants) rows.push(h('div', { class: 'kv' }, h('span', null, t('craft.grants')), h('b', { class: 'grants-text' }, DK.icon('sparkles', 13), ' ', V.grantsText(it))));
    // De expedición no se puede craftear ni vender en casa: no se enseña
    const home = !(DK.store.state && DK.bag.inPack());
    const recipe = home && DK.crafting.recipeFor(itemId);
    if (recipe) rows.push(h('div', { class: 'kv' }, h('span', null, t('item.madeWith')), V.ingredients(recipe)));
    const uses = home ? DK.crafting.usesOf(itemId) : [];
    if (uses.length) rows.push(h('div', { class: 'kv' }, h('span', null, t('item.usedFor')), h('div', { class: 'chips' }, uses.map((r) => h('span', { class: 'chip' }, DK.icon(D.items[r.result].icon, 13), D.items[r.result].name)))));
    if (D.prices[itemId]) rows.push(h('div', { class: 'kv' }, h('span', null, t('item.value')), h('div', { class: 'row gap' }, V.coins(DK.shop.sellPrice(itemId)), h('span', { class: 'muted small' }, t('item.sellValue')))));
    return h('div', { class: 'item-detail' },
      h('div', { class: 'item-detail-head' }, V.itemIcon(it, 34), h('div', null, h('h4', null, it.name), h('div', { class: 'row gap-s' }, V.rarity(it.rarity), h('span', { class: 'badge' }, DK.icon(cat.icon, 13), DK.tr('categories', cat)), DK.store.state ? h('span', { class: 'badge' }, t('item.owned', { n: DK.bag.count(itemId) })) : null))),
      h('p', null, it.desc), ...rows);
  };

  /** Abre el detalle de un objeto en un modal sencillo. */
  V.openItem = (itemId, actions = []) => modal({ title: D.items[itemId].name, icon: D.items[itemId].icon, content: V.itemDetail(itemId), actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost' }, ...actions] });

  /**
   * Diálogo "Curar con objetos": calcula el plan, lo enseña y lo aplica si se confirma.
   * @param {Array} list daskai a curar
   * @returns {Promise<boolean>} true si se aplicó
   */
  V.healDialog = async (list) => {
    const plan = DK.healer.plan(list);
    if (!plan.uses.length) {
      DK.ui.toast(list.every((d) => DK.daskai.hpPct(d) >= 1 && !d.status) ? t('heal.nothingToHeal') : t('heal.noItems'), { icon: 'flask' });
      return false;
    }
    const ok = await modal({
      title: t('heal.title'), icon: 'flask',
      content: h('div', null,
        h('p', { class: 'muted' }, t('heal.summary', { hp: plan.hp, mp: plan.mp, cures: plan.cures })),
        h('div', { class: 'item-grid' }, Object.entries(plan.totals).map(([id, n]) => V.itemCard(id, n, { note: t('heal.willUse') })))),
      actions: [{ label: t('common.cancel'), icon: 'x', variant: 'ghost', value: false }, { label: t('heal.confirm'), icon: 'check', variant: 'primary', value: true }],
    }).promise;
    if (!ok) return false;
    DK.healer.apply(plan);
    DK.audio.sfx('heal');
    DK.ui.toast(t('heal.done'), { icon: 'heart', kind: 'good' });
    return true;
  };
})();
