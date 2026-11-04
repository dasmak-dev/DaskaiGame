/* =============================================================
 * screens/inventory.js — Inventario (y Mochila durante una expedición).
 *
 * Diseño:
 *   - Barra superior: filtros por tipo en HORIZONTAL (Todo, Batalla, Mejora,
 *     Equipamiento, Piezas), buscador y accesos (Crafteo, Curar).
 *   - Lista de objetos agrupada por tipo (filas: icono, nombre, efecto, cantidad).
 *   - Al pulsar un objeto, su FICHA grande con todas sus opciones:
 *       usar en un daskai (con lo que le hace) · equipar en un hueco (con la
 *       diferencia de atributos) · recetas en las que se usa · venta.
 *     A la derecha en escritorio; hoja inferior en el móvil.
 *   - En expedición: arriba la mochila y el botín (que se entrega al terminar).
 *
 * params: { item, cat, q }
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', {
    id: 'inventory', icon: 'bag', order: 30, screen: 'inventory', expedition: true, pin: true,
    label: () => (DK.bag.inPack() ? t('nav.pack') : t('nav.inventory')),
  });

  const CAT_ORDER = ['batalla', 'mejora', 'equipo', 'pieza'];

  DK.screens.register('inventory', {
    title: () => (DK.bag.inPack() ? t('nav.pack') : t('inv.title')), icon: 'bag', section: 'inventory', tutorial: 'inventory', music: () => DK.audio.zoneTrack(),
    render(params) {
      const refresh = () => DK.router.refresh();
      const exp = DK.bag.inPack() && DK.expedition.active();
      params.cat = params.cat || 'all';
      const q = (params.q || '').trim().toLowerCase();
      const narrow = DK.ui.isNarrow();

      /* ---- Barra: filtros horizontales + buscador + accesos ---- */
      const cats = ['all', ...CAT_ORDER.filter((c) => !exp || c !== 'pieza')];
      const tabs = h('div', { class: 'inv-tabs', role: 'tablist' }, cats.map((c) => {
        const n = c === 'all' ? DK.bag.total() : DK.bag.total(c);
        return h('button', { class: 'inv-tab' + (params.cat === c ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.cat === c,
          onClick: () => { params.cat = c; refresh(); } },
          DK.icon(c === 'all' ? 'layers' : D.categories[c].icon, 18),
          h('span', null, c === 'all' ? t('inv.all') : DK.tr('categories', D.categories[c])), h('b', null, String(n)));
      }));
      const search = h('input', { class: 'input inv-search', type: 'search', placeholder: t('inv.search'), value: params.q || '',
        onInput: (e) => { params.q = e.target.value; clearTimeout(params._qt); params._qt = setTimeout(() => { refresh(); const i = document.querySelector('.inv-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } });
      const bar = h('div', { class: 'inv-bar' }, tabs,
        h('div', { class: 'inv-bar-row' }, search,
          exp ? null : V.coins(DK.wallet.get()),
          exp ? null : btn({ icon: 'anvil', label: t('nav.craft'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('craft') }),
          btn({ icon: 'heart', label: t('heal.button'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(DK.party.active())) refresh(); } })));

      /* ---- Lista ---- */
      const all = DK.bag.list(params.cat === 'all' ? null : params.cat).filter(({ item }) => !q || item.name.toLowerCase().includes(q));
      if (params.item && !DK.bag.count(params.item)) params.item = null;
      if (!params.item && !narrow && all.length) params.item = all[0].item.id;
      const open = (id) => {
        params.item = id;
        if (!narrow) { refresh(); return; }
        const holder = h('div');
        const draw = () => holder.replaceChildren(DK.bag.count(id) ? itemPanel(id, () => { draw(); refresh(); }) : DK.ui.empty('bag', t('inv.noneLeft'), ''));
        draw();
        DK.ui.drawer({ title: D.items[id].name, icon: D.items[id].icon, size: 'wide', cls: 'inv-sheet', content: holder });
      };
      const row = ({ item, qty }) => h('button', { class: `inv-row r-${item.rarity}` + (params.item === item.id && !narrow ? ' selected' : ''), type: 'button', onClick: () => open(item.id) },
        V.itemIcon(item, 26),
        h('span', { class: 'inv-row-main' }, h('b', null, item.name), h('span', { class: 'muted small' }, shortText(item))),
        h('span', { class: 'inv-qty' }, 'x' + qty));
      const groups = (params.cat === 'all' ? CAT_ORDER : [params.cat]).map((c) => {
        const items = all.filter(({ item }) => item.category === c);
        if (!items.length) return null;
        return h('section', { class: 'inv-group' },
          params.cat === 'all' ? h('h4', { class: 'inv-group-head' }, DK.icon(D.categories[c].icon, 14), DK.tr('categories', D.categories[c]), h('span', { class: 'muted' }, String(items.reduce((a, x) => a + x.qty, 0)))) : null,
          h('div', { class: 'inv-grid' }, items.map(row)));
      }).filter(Boolean);
      const list = groups.length ? h('div', { class: 'inv-groups' }, groups) : DK.ui.empty('bag', t('bag.empty'), q ? '' : t('bag.emptyText'));

      const detail = !narrow ? h('aside', { class: 'card inv-side' }, params.item ? itemPanel(params.item, refresh) : DK.ui.empty('bag', t('inv.pickOne'), '')) : null;

      return h('div', { class: 'screen inv-screen' },
        exp ? packHead(exp) : null,
        bar,
        h('div', { class: 'inv-main' + (detail ? ' has-detail' : '') }, h('div', { class: 'inv-list-wrap' }, list), detail));
    },
  });

  /** Una línea de lo que hace un objeto. */
  function shortText(it) {
    if (it.use) return V.useText(it);
    if (it.grants) return V.grantsText(it);
    if (it.stats) return Object.entries(it.stats).map(([k, v]) => `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    const uses = DK.crafting.usesOf(it.id).length;
    return uses ? t('craft.usedInShort', { n: uses }) : D.rarities[it.rarity] ? DK.tr('rarities', D.rarities[it.rarity]) : '';
  }

  /** Cabecera en expedición: qué es la mochila y el botín que se entrega al volver. */
  function packHead(e) {
    const items = Object.entries(e.loot.items);
    return h('div', { class: 'card inv-pack-head' },
      h('div', { class: 'row gap' }, h('span', { class: 'pack-head-icon' }, DK.icon('bag', 22)),
        h('div', { class: 'grow' }, h('b', null, t('nav.pack')), h('p', { class: 'muted small' }, t('pack.inExp')))),
      h('div', { class: 'pack-loot' }, h('span', { class: 'muted small' }, DK.icon('gift', 13), ' ', t('pack.loot')), V.coins(e.loot.coins),
        items.length ? h('div', { class: 'chips' }, items.map(([id, n]) => h('span', { class: 'chip', tip: t('pack.lootTip') }, DK.icon(D.items[id].icon, 13), `${D.items[id].name} x${n}`))) : h('span', { class: 'muted small' }, t('exp.lootEmpty'))));
  }

  /** Usa o equipa un objeto sobre un daskai. */
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

  /** Huecos a ofrecer: los ocupados y sólo el primer hueco libre. */
  function slotsFor(d) {
    const all = [...Array(DK.config.maxEquip).keys()];
    const free = all.find((i) => !d.equip[i]);
    return all.filter((i) => d.equip[i] || i === free);
  }

  /**
   * Ficha de un objeto con todas sus opciones.
   * Bloques: cabecera · efecto · usar en / equipar en · recetas · venta.
   */
  function itemPanel(itemId, refresh) {
    const it = D.items[itemId];
    const cat = D.categories[it.category];
    const qty = DK.bag.count(itemId);
    // En expedición sólo cuentan los que van en ella; en casa, primero el equipo
    const party = DK.bag.inPack() ? DK.party.active() : DK.party.active().concat(DK.party.all().filter((d) => !DK.party.isActive(d.uid) && !d.temp));

    const blocks = [];
    // Cabecera grande
    blocks.push(h('div', { class: 'inv-hero r-' + it.rarity, style: { '--c': it.color || 'var(--primary)' } },
      h('span', { class: 'inv-hero-icon' }, DK.icon(it.icon, 40)),
      h('div', { class: 'grow' }, h('h2', null, it.name),
        h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'badge' }, DK.icon(cat.icon, 12), DK.tr('categories', cat)), h('span', { class: 'badge' }, t('item.owned', { n: qty })))),
      h('p', { class: 'muted inv-hero-desc' }, it.desc)));

    // Qué hace
    const what = [];
    if (it.use) what.push(h('p', { class: 'inv-effect' }, DK.icon('flask', 16), h('b', null, V.useText(it))));
    if (it.stats) what.push(V.statChips(it.stats));
    if (it.grants && it.grants.move) what.push(V.moveCard(it.grants.move, { compact: true }));
    if (it.grants && it.grants.passive) what.push(V.passiveBox(it.grants.passive));
    if (what.length) blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('craft.whatDoes')), what));

    // Usar en…
    if ((it.category === 'batalla' && !it.use.capture) || it.category === 'mejora') {
      if (it.use && it.use.guardian) blocks.push(h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('bag.autoItem'))));
      else blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('inv.useOn')),
        h('div', { class: 'inv-targets' }, party.map((d) => {
          const why = DK.bag.cannotUse(itemId, d);
          const p = DK.bag.potency(itemId, d);
          const gain = why ? why : it.use.exp ? `+${it.use.exp} ${t('common.expShort')}` : it.use.perm ? `+${DK.config.tonic.per[it.use.perm]} ${DK.tr('stats', D.stats[it.use.perm])}` : p.hp ? `+${p.hp} ${t('common.hpShort')}` : p.mp ? `+${p.mp} ${t('common.mpShort')}` : '';
          return h('div', { class: 'inv-target' + (why ? ' off' : '') },
            V.dSprite(d, { size: 42 }),
            h('div', { class: 'inv-target-main' }, h('b', null, DK.daskai.name(d), ' ', h('span', { class: 'muted small' }, `${t('common.lvl')} ${d.level}`)), V.vitals(d),
              h('span', { class: 'small ' + (why ? 'muted' : 'good-text') }, gain)),
            btn({ icon: 'hand', label: t('inv.use'), size: 'sm', variant: 'primary', disabled: !!why, onClick: () => applyItemTo(itemId, d, refresh) }));
        }))));
    }
    if (it.use && it.use.capture) blocks.push(h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('bag.onlyInBattle'))));

    // Equipar en…
    if (it.category === 'equipo') {
      blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('inv.equipOn')),
        h('div', { class: 'inv-targets' }, party.map((d) => h('div', { class: 'inv-target equip' },
          V.dSprite(d, { size: 42 }),
          h('div', { class: 'inv-target-main' }, h('b', null, DK.daskai.name(d), ' ', h('span', { class: 'muted small' }, `${t('common.lvl')} ${d.level}`)),
            h('div', { class: 'inv-slots' }, slotsFor(d).map((slot) => h('div', { class: 'inv-slot' },
              h('span', { class: 'small' }, d.equip[slot] ? t('craft.replaces', { item: D.items[d.equip[slot]].name }) : t('craft.freeSlot')),
              V.diffChips(DK.bag.equipPreview(d, slot, itemId)),
              btn({ icon: 'gem', label: d.equip[slot] ? t('craft.swap') : t('inv.equip'), size: 'sm', variant: d.equip[slot] ? 'ghost' : 'primary', onClick: () => applyItemTo(itemId, d, refresh, slot) }))))))))));
    }

    // Recetas en las que se usa
    const uses = DK.crafting.usesOf(itemId);
    if (uses.length) blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t(uses.length === 1 ? 'craft.usedInOne' : 'craft.usedIn', { n: uses.length })),
      h('div', { class: 'inv-recipes' }, uses.map((r) => h('button', { class: 'inv-recipe', type: 'button', disabled: DK.bag.inPack(), onClick: () => DK.router.reset('craft', { sel: r.id }) },
        V.itemIcon(D.items[r.result], 18), h('span', null, D.items[r.result].name))))));

    // Venta
    if (DK.shop.canSell(itemId)) blocks.push(h('p', { class: 'muted small inv-sell' }, DK.icon('shop', 14), ' ', t('inv.sellAtMerchant', { n: DK.shop.sellPrice(itemId) })));
    return h('div', { class: 'inv-detail-body' }, ...blocks);
  }
})();
