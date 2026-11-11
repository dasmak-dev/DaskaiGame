/* =============================================================
 * components/hoverCard.js — v5.29: ficha flotante al dejar el ratón encima, y fabricar al momento.
 *
 *   DK.ui.hoverCard(el, () => nodo, { delay })  → al dejar el ratón ~0,6 s sobre `el` aparece, junto al
 *       puntero, una ficha pequeña con lo que devuelva la función (p. ej. V.gearTip de una pieza). Sigue al
 *       ratón, se va al salir, al pulsar o al desplazar. Sólo con ratón (en táctil no hace nada).
 *   V.runeCard(id)                → ficha compacta de una runa (para la ficha flotante)
 *   V.makeDialog(itemId, onDone)  → ventana para fabricar una piedra o un reactivo con su receta (en cadena si hace falta)
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  let box = null, timer = 0, owner = null, last = { x: 0, y: 0 };
  const canHover = () => window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function place() {
    if (!box) return;
    const r = box.getBoundingClientRect(), pad = 14, vw = innerWidth, vh = innerHeight;
    let x = last.x + 18, y = last.y + 16;
    if (x + r.width + pad > vw) x = last.x - r.width - 14;
    if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);
    box.style.transform = `translate(${Math.max(pad, Math.round(x))}px, ${Math.round(y)}px)`;
  }
  function hide() {
    clearTimeout(timer); timer = 0; owner = null;
    if (box) { box.remove(); box = null; }
  }
  function show(render) {
    hide.keep = true;
    const node = render(); if (!node) return;
    box = h('div', { class: 'hover-card', role: 'tooltip' }, node);
    document.body.append(box); place();
    requestAnimationFrame(() => box && box.classList.add('in'));
  }
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  DK.on && DK.on('route:changed', hide);

  DK.ui.hoverCard = (el, render, o = {}) => {
    if (!el || !canHover()) return el;
    const delay = o.delay ?? 600;
    el.dataset.hc = '1'; // (core/ui.js no pone encima la burbuja de texto de lo de dentro)
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; hide(); owner = el; last = { x: e.clientX, y: e.clientY }; timer = setTimeout(() => { if (owner === el && el.isConnected) show(render); }, delay); });
    el.addEventListener('pointermove', (e) => { last = { x: e.clientX, y: e.clientY }; if (box && owner === el) place(); });
    el.addEventListener('pointerleave', () => { if (owner === el) hide(); });
    el.addEventListener('pointerdown', hide);
    return el;
  };
  DK.ui.hideHoverCard = hide;

  /** Ficha compacta de una runa: gema, nombre, rareza · tier · grupo, efecto y sus modificadores. */
  V.runeCard = (id) => {
    const R = DK.runes, p = R.parse(id); if (!p) return null;
    return h('div', { class: 'rb-card hc-rune ' + V.runeRarity(id) },
      h('div', { class: 'rb-head' }, V.runeGem(id, 44),
        h('div', { class: 'grow' }, h('b', { class: 'rb-name' }, V.runeName(id)),
          h('small', { class: 'rb-rar' }, t('rune.rar.' + p.rarity), ' · ', t('rune.tierN', { n: p.tier }), ' · ', t('rune.' + R.get(id).group)))),
      h('p', { class: 'small hc-eff' }, V.runeEffect(id)),
      p.affixes.length ? h('div', { class: 'hc-mods' }, p.affixes.map((a) => { const k = R.kindOf(a.k), [lo, hi] = R.range(a.k, p.tier, p.rarity);
        return h('div', { class: 'gt-affix ' + k }, h('span', { class: 'gt-kind' }, k === 'prefix' ? 'P' : 'S'), h('span', { class: 'grow' }, t('rune.aff.' + a.k, { n: a.v })), h('small', { class: 'muted' }, lo === hi ? String(hi) : `${lo}–${hi}`)); }))
        : null,
      R.count(id) > 1 ? h('small', { class: 'muted' }, t('rune.forge.x', { n: R.count(id) })) : null);
  };

  /** ¿Se puede fabricar ese objeto ahora (aunque sea en cadena)? */
  V.canMake = (itemId) => { const r = DK.crafting.recipeFor(itemId); return !!(r && DK.crafting.plan(r).ok); };

  /** Ventana para fabricar una piedra / reactivo: ingredientes (tienes / hacen falta) y ×1, ×5, ×máx. */
  V.makeDialog = (itemId, onDone) => {
    const r = DK.crafting.recipeFor(itemId), it = D.items[itemId];
    if (!r || !it) return Promise.resolve(false);
    let max = 0; for (let n = 1; n <= 99 && DK.crafting.plan(r, n).ok; n++) max = n;
    const make = (n, close) => {
      const plan = DK.crafting.plan(r, n);
      if (!plan.ok || !DK.crafting.runPlan(plan)) { DK.audio.sfx('error'); toast(t('craft.cantNow'), { icon: 'x', kind: 'bad' }); return; }
      DK.audio.sfx('craft'); toast(t('craft.madeN', { n: n * r.qty, item: it.name }), { icon: 'check', kind: 'good' });
      close(true); if (onDone) onDone();
    };
    const ing = Object.entries(r.ingredients).map(([id, n]) => { const have = DK.bag.count(id);
      return h('div', { class: 'mk-ing' + (have >= n ? ' ok' : ' miss') }, V.itemIcon(D.items[id], 26), h('span', { class: 'grow' }, D.items[id].name), h('b', null, `${have}/${n}`)); });
    const plan1 = DK.crafting.plan(r), chain = plan1.ok && plan1.steps.length > 1;
    return DK.ui.modal({
      title: t('craft.makeTitle', { item: it.name }), icon: 'anvil', cls: 'mk-modal',
      content: (close) => h('div', { class: 'stack-s' },
        h('div', { class: 'mk-head' }, V.itemIcon(it, 40), h('div', null, h('b', null, it.name), h('small', { class: 'muted' }, it.desc)), h('span', { class: 'chip sm' }, t('craft.youHave', { n: DK.bag.count(itemId) }))),
        h('small', { class: 'muted' }, t('craft.makeNeeds', { n: r.qty })), h('div', { class: 'mk-ings' }, ing),
        chain ? h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('craft.makeChainNote')) : null,
        !max ? h('p', { class: 'small warn-text' }, t('craft.makeMissing')) : null,
        h('div', { class: 'row gap-s wrap mk-btns' },
          btn({ icon: 'anvil', label: '×1', variant: 'primary', disabled: max < 1, onClick: () => make(1, close) }),
          max >= 5 ? btn({ label: '×5', variant: 'tone', onClick: () => make(5, close) }) : null,
          max > 1 ? btn({ label: t('craft.makeMax', { n: max }), variant: 'tone', onClick: () => make(max, close) }) : null)),
      actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost', value: false }],
    }).promise;
  };
})();
