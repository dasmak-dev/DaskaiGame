/* =============================================================
 * screens/inventory.js — Inventario: los objetos que ganas en las
 * expediciones. Aquí se usan (curar, dar experiencia) y se equipan.
 * Para construir equipo nuevo con los materiales → screens/craft.js.
 *
 * Objetos: lista a la izquierda y detalle del seleccionado a la derecha,
 * con las acciones ahí mismo (usar en un daskai, equipar en una ranura,
 * vender...). También se puede arrastrar un objeto sobre un daskai de
 * la barra del equipo para usarlo o equiparlo.
 *
 * params: { item, cat, q }
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);

  DK.menus.add('nav', {
    id: 'inventory', icon: 'bag', order: 30, screen: 'inventory', expedition: true, pin: true,
    label: () => (DK.bag.inPack() ? t('nav.pack') : t('nav.inventory')),
  });

  DK.screens.register('inventory', {
    title: () => (DK.bag.inPack() ? t('nav.pack') : t('inv.title')), icon: 'bag', section: 'inventory', tutorial: 'inventory', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      const exp = DK.bag.inPack() && DK.expedition.active();
      const heal = btn({ icon: 'heart', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(DK.party.active())) refresh(); } });
      // En expedición: la mochila y, aparte, el botín (que se entrega al terminar)
      const head = exp
        ? h('div', { class: 'card pack-head' },
          h('div', { class: 'row gap wrap' }, h('span', { class: 'pack-head-icon' }, DK.icon('bag', 22)),
            h('div', { class: 'grow' }, h('b', null, t('nav.pack')), h('p', { class: 'muted small' }, t('pack.inExp'))), heal),
          lootStrip(exp))
        : h('div', { class: 'row between wrap gap' }, V.coins(DK.wallet.get()),
          h('div', { class: 'row gap-s' }, btn({ icon: 'anvil', label: t('nav.craft'), size: 'sm', variant: 'tone', onClick: () => DK.router.reset('craft') }), heal));
      return h('div', { class: 'screen inventory-screen' }, head, itemsTab(params, refresh));
    },
  });

  /** Botín de la expedición en curso (no se puede usar hasta volver). */
  function lootStrip(e) {
    const items = Object.entries(e.loot.items);
    return h('div', { class: 'pack-loot' }, h('span', { class: 'muted small' }, DK.icon('gift', 13), ' ', t('pack.loot')), V.coins(e.loot.coins),
      items.length ? h('div', { class: 'chips' }, items.map(([id, n]) => h('span', { class: 'chip', tip: t('pack.lootTip') }, DK.icon(D.items[id].icon, 13), `${D.items[id].name} x${n}`))) : h('span', { class: 'muted small' }, t('exp.lootEmpty')));
  }

  /* ================= OBJETOS ================= */

  /** Usa o equipa un objeto sobre un daskai (desde el detalle o arrastrando). */
  function applyItemTo(itemId, d, refresh, slot) {
    const it = D.items[itemId];
    if (it.category === 'batalla' || it.category === 'mejora') {
      const r = DK.bag.use(itemId, d);
      DK.audio.sfx(!r.ok ? 'error' : r.levelInfo ? 'levelup' : 'heal');
      toast(r.msg, { icon: r.levelInfo ? 'star' : 'flask', kind: r.ok ? 'good' : 'bad' });
      if (r.levelInfo) { V.afterLevel(d, r.levelInfo).then(refresh); return; }
    } else if (it.category === 'equipo') {
      let s = slot;
      if (s == null) { s = d.equip.findIndex((x) => !x); if (s < 0) s = 0; }
      DK.bag.equip(d, s, itemId);
      DK.audio.sfx('select');
      toast(t('equip.done', { name: DK.daskai.name(d), item: it.name }), { icon: 'gem', kind: 'good' });
    } else { toast(t('inv.cantUsePiece'), { icon: 'cube' }); return; }
    refresh();
  }

  function itemsTab(params, refresh) {
    params.cat = params.cat || 'all';
    const q = (params.q || '').toLowerCase();
    const list = DK.bag.list(params.cat === 'all' ? null : params.cat).filter(({ item }) => !q || item.name.toLowerCase().includes(q));
    if (!params.item || !DK.bag.count(params.item)) params.item = list[0] && list[0].item.id;

    const catChips = V.catButtons([['all', 'layers', t('inv.all')], ...Object.values(D.categories).filter((c) => !DK.bag.inPack() || c.id !== 'pieza').map((c) => [c.id, c.icon, DK.tr('categories', c)])]
      .map(([id, icon, label]) => ({ id, icon, label, count: id === 'all' ? DK.bag.total() : DK.bag.total(id) })), params.cat, (v) => { params.cat = v; params.item = null; refresh(); });
    const search = h('input', { class: 'input input-sm', type: 'search', placeholder: t('inv.search'), value: params.q || '' });
    search.addEventListener('change', () => { params.q = search.value; refresh(); });

    const cards = list.map(({ item, qty }) => {
      const c = V.itemCard(item.id, qty, { selected: params.item === item.id, note: item.use ? V.useText(item) : null, onClick: () => openItem(item.id) });
      if (item.category !== 'pieza') {
        c.draggable = true;
        c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'item:' + item.id); c.classList.add('dragging'); });
        c.addEventListener('dragend', () => c.classList.remove('dragging'));
      }
      return c;
    });

    /** Selecciona un objeto (panel derecho o deslizante en móvil). */
    function openItem(id) {
      params.item = id;
      if (!DK.ui.isNarrow()) { refresh(); return; }
      const holder = h('div');
      const draw = () => holder.replaceChildren(DK.bag.count(id) ? itemPanel(id, () => { draw(); refresh(); }) : DK.ui.empty('bag', t('inv.noneLeft'), ''));
      draw();
      DK.ui.drawer({ title: D.items[id].name, icon: D.items[id].icon, content: holder });
    }

    // Barra del equipo: soltar objetos encima
    const dropStrip = h('div', { class: 'card drop-strip' },
      h('p', { class: 'muted small' }, DK.icon('hand', 14), ' ', t('inv.dropHint')),
      h('div', { class: 'drop-targets' }, DK.party.active().map((d) => {
        const el = h('div', { class: 'drop-target', dataset: { uid: d.uid }, tip: DK.daskai.name(d) }, V.daskaiRow(d, { compact: true }));
        el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-over'); });
        el.addEventListener('dragleave', () => el.classList.remove('drop-over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault(); el.classList.remove('drop-over');
          const data = e.dataTransfer.getData('text/plain') || '';
          if (data.startsWith('item:')) applyItemTo(data.slice(5), d, refresh);
        });
        return el;
      })));

    const left = h('div', { class: 'panel inv-list' },
      h('div', { class: 'row gap-s wrap' }, DK.icon('search', 16), search), catChips,
      list.length ? h('div', { class: 'item-grid scroll-list' }, cards) : DK.ui.empty('bag', t('bag.empty'), t('bag.emptyText')));
    const right = h('div', { class: 'panel inv-detail' }, params.item ? itemPanel(params.item, refresh) : DK.ui.empty('bag', t('inv.pickOne'), ''));
    return h('div', { class: 'stack' }, dropStrip, h('div', { class: 'inv-layout' }, left, right));
  }

  /** Panel de detalle de un objeto con sus acciones en línea. */
  function itemPanel(itemId, refresh) {
    const it = D.items[itemId];
    const blocks = [V.itemDetail(itemId)];
    // En expedición sólo cuentan los que van en ella
    const party = DK.bag.inPack() ? DK.party.active() : DK.party.active().concat(DK.party.all().filter((d) => !DK.party.isActive(d.uid)));

    if ((it.category === 'batalla' && !it.use.capture) || it.category === 'mejora') {
      blocks.push(h('h4', null, DK.icon('hand', 16), ' ', t('inv.useOn')),
        h('div', { class: 'list' }, party.map((d) => {
          const why = DK.bag.cannotUse(itemId, d);
          const p = DK.bag.potency(itemId, d);
          const tip = why || (it.use.exp ? `+${it.use.exp} ${t('common.expShort')} · ${t('inv.toNext', { n: Math.max(0, DK.daskai.expToNext(d) - d.exp) })}` : p.hp ? `+${p.hp} PV` : p.mp ? `+${p.mp} PM` : null);
          return V.daskaiRow(d, { compact: true, actions: btn({ icon: 'hand', label: t('inv.use'), size: 'sm', variant: 'primary', disabled: !!why, tip, onClick: () => applyItemTo(itemId, d, refresh) }) });
        })));
    }
    if (it.use && it.use.capture) blocks.push(h('p', { class: 'muted small' }, DK.icon('info', 14), ' ', t('bag.onlyInBattle')));
    if (it.category === 'equipo') {
      blocks.push(h('h4', null, DK.icon('gem', 16), ' ', t('inv.equipOn')),
        h('div', { class: 'list' }, party.map((d) => h('div', { class: 'equip-target' }, V.daskaiRow(d, { compact: true }),
          h('div', { class: 'equip-target-slots' }, [0, 1].map((slot) => h('div', { class: 'equip-target-slot' },
            h('span', { class: 'muted small' }, d.equip[slot] ? D.items[d.equip[slot]].name : t('equip.freeSlot', { n: slot + 1 })),
            V.diffChips(DK.bag.equipPreview(d, slot, itemId)),
            btn({ icon: 'gem', label: t('inv.equipSlot', { n: slot + 1 }), size: 'sm', variant: d.equip[slot] ? 'ghost' : 'primary', onClick: () => applyItemTo(itemId, d, refresh, slot) }))))))));
    }
    {
      const uses = DK.crafting.usesOf(itemId);
      if (uses.length && !DK.bag.inPack()) blocks.push(btn({ icon: 'anvil', label: t('inv.toWorkshop'), variant: 'tone', onClick: () => DK.router.reset('craft', { uses: itemId }) }));
    }
    if (DK.shop.canSell(itemId)) blocks.push(h('p', { class: 'muted small' }, DK.icon('shop', 14), ' ', t('inv.sellAtMerchant', { n: DK.shop.sellPrice(itemId) })));
    return h('div', { class: 'stack-s' }, ...blocks);
  }

})();
