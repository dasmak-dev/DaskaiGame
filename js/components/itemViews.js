/* =============================================================
 * components/itemViews.js — Vistas de objetos: icono, tarjeta,
 * detalle, ingredientes de recetas y diálogo "Curar con objetos".
 * ============================================================= */
(function () {
  const { h, btn, modal } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = (DK.views = DK.views || {});

  /**
   * Icono de objeto «gema» a color (v4.42), como las runas: una pieza con la
   * forma de su categoría (batalla = orbe, mejora = rombo, equipo = escudo
   * hexagonal, pieza = losa), rellena con el color del objeto, su símbolo en
   * claro encima, brillo y un aro según la rareza (raro azul, épico morado,
   * legendario dorado). Ocupa la caja .item-icon (su tamaño lo pone el CSS).
   */
  const SHAPES = {
    batalla: '<circle cx="24" cy="24" r="21"/>',
    mejora: '<path d="M24 2.5 45.5 24 24 45.5 2.5 24z"/>',
    equipo: '<path d="M24 2.5 43 13v22L24 45.5 5 35V13z"/>',
    pieza: '<rect x="3.5" y="3.5" width="41" height="41" rx="10"/>',
  };
  const RING = { raro: '#60a5fa', epico: '#c084fc', legendario: '#fbbf24' };
  const mix = (a, b, k) => {
    const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    if (!/^#[0-9a-f]{6}$/i.test(a)) return a;
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  let iiN = 0;
  /**
   * v4.76: piedras de forja = gema HEXAGONAL oscura con su runa brillante dentro
   * (como las runas de la preparación de expediciones). Runa de cada piedra en STONE_RUNE.
   */
  const STONE_RUNE = {
    fragmento_forja: 'M9 4l7 4-2 12-7-4z M9 4l5 8', piedra_transmutacion: 'M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5',
    piedra_alteracion: 'M5 7h14M5 17h14M9 3L5 7l4 4M15 13l4 4-4 4', piedra_purga: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11zM9 15h6',
    piedra_regia: 'M4 17l2-9 4 4 2-6 2 6 4-4 2 9zM6 21h12', piedra_caos: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
    piedra_divina: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z', esquirla_jefe: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 9l3 3-3 3-3-3z',
    corazon_jefe: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM12 8v6M9 11h6', piedra_alquimia: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8',
    piedra_aumento: 'M12 4v16M4 12h16M8 8h8v8H8z', piedra_exaltacion: 'M12 21V4M5 11l7-7 7 7M8 21h8M9 15l3-3 3 3',
    piedra_anulacion: 'M5 5l14 14M19 5L5 19M12 2v3M12 19v3', piedra_templado: 'M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-4 3-5 0 2 1 3 2 3 0-3-1-5 0-8z',
    sello_forja: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6zM12 14v3', eco_legendario: 'M3 12c3-6 6-6 9 0s6 6 9 0M3 17c3-4 6-4 9 0s6 4 9 0M12 3v4',
  };
  const HEX = 'M24 2.5 43 13v22L24 45.5 5 35V13z';
  function stoneIcon(it, size) {
    const c = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#a78bfa', id = 'sg' + (++iiN), ring = RING[it.rarity];
    const span = document.createElement('span');
    span.className = 'item-icon ii stone-gem r-' + it.rarity + ' c-forja';
    span.style.setProperty('--c', c);
    span.innerHTML = `<svg viewBox="-2 -2 52 52" aria-hidden="true"><defs><radialGradient id="${id}" cx="40%" cy="35%" r="72%"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".55" stop-color="#1a1220" stop-opacity=".96"/><stop offset="1" stop-color="#07050a"/></radialGradient>`
      + `<filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      + (ring ? `<path d="${HEX}" fill="none" stroke="${ring}" stroke-width="2.4" stroke-opacity=".9" transform="translate(24 24) scale(1.08) translate(-24 -24)"/>` : '')
      + `<path d="${HEX}" fill="url(#${id})" stroke="${c}" stroke-opacity=".75" stroke-width="1.6"/>`
      + `<path d="M24 8 37 15.5v17L24 40 11 32.5v-17z" fill="none" stroke="${c}" stroke-opacity=".22" stroke-width="1"/>`
      + `<g transform="translate(11 11) scale(1.0833)" filter="url(#${id}f)" fill="none" stroke="${mix(c, '#ffffff', 0.35)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${STONE_RUNE[it.id] || 'M12 4v16'}"/></g>`
      + `<ellipse cx="18" cy="12" rx="7" ry="3" fill="#fff" opacity=".16"/></svg>`;
    return span;
  }

  /** v4.76: icono de una pieza de equipo: el de su tipo (daga, corona…) con el aro de su rareza. */
  V.gearIcon = (p, size = 22) => {
    const el = V.itemIcon(D.items[p.base], size, { ring: p.rarity === 'normal' ? null : D.gear.rarities[p.rarity].color });
    el.classList.add('gear-ico', 'g-' + p.rarity);
    el.style.width = el.style.height = size + 'px'; // tamaño fijo (no el de la caja .item-icon)
    return el;
  };

  V.itemIcon = (it, size = 22, o = {}) => {
    if (it.category === 'forja') return stoneIcon(it, size);
    const c = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#c0392b';
    const id = 'ii' + (++iiN), shape = SHAPES[it.category] || SHAPES.pieza, ring = o.ring !== undefined ? o.ring : it.category === 'equipo' ? null : RING[it.rarity];
    const light = mix(c, '#ffffff', 0.62), dark = mix(c, '#000000', 0.62), deep = mix(c, '#000000', 0.86);
    const fillShape = shape.replace('/>', ` fill="url(#${id})" stroke="${mix(c, '#ffffff', 0.25)}" stroke-opacity=".7" stroke-width="1.4"/>`);
    const ringShape = ring ? shape.replace('/>', ` fill="none" stroke="${ring}" stroke-width="2.4" stroke-opacity=".95" transform="translate(24 24) scale(1.07) translate(-24 -24)"/>`) : '';
    const span = document.createElement('span');
    span.className = 'item-icon ii r-' + it.rarity + ' c-' + it.category;
    span.style.setProperty('--c', c);
    span.innerHTML = `<svg viewBox="-2 -2 52 52" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${c}"/><stop offset=".6" stop-color="${dark}"/><stop offset="1" stop-color="${deep}"/></radialGradient></defs>`
      + ringShape + fillShape
      + `<g transform="translate(11 11) scale(1.0833)" fill="none" stroke="${light}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${DK.icon.raw(it.icon)}</g>`
      + `<ellipse cx="17" cy="12" rx="8" ry="3.6" fill="#fff" opacity=".2"/></svg>`;
    return span;
  };

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
   * Tras dar experiencia fuera de combate: subida de nivel, ataques nuevos y evolución.
   * @param {Object} d
   * @param {Object} info  resultado de DK.daskai.gainExp
   */
  V.afterLevel = async (d, info, o = {}) => {
    if (!info) return;
    // quiet (v4.45, usar objetos desde la Bolsa): sin ventanas de subida de nivel ni de evolución,
    // sólo un aviso; aprender un movimiento sí se pregunta (es una elección)
    if (info.levels.length && !o.quiet) await V.levelUpDialog(d, info);
    for (const m of info.pending) await V.learnMovePrompt(d, m);
    if (info.evolveReady && !o.quiet) await V.evolveDialog(d);
    else if (info.evolveReady) DK.ui.toast(`${DK.daskai.name(d)} · ${t('evo.ready')}`, { icon: 'evolve', kind: 'good' });
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
