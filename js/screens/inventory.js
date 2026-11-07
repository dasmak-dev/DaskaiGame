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
  /** Grupos POR USO de la bolsa (v4.42). El último recoge lo demás (cristales…). */
  const USE_GROUPS = [
    { id: 'heal', icon: 'heart', test: (it) => it.category === 'batalla' && it.use && (it.use.heal || it.use.healPct) },
    { id: 'mana', icon: 'droplet', test: (it) => it.category === 'batalla' && it.use && (it.use.mana || it.use.manaPct) },
    { id: 'status', icon: 'pill', test: (it) => it.category === 'batalla' && it.use && it.use.cure },
    { id: 'boost', icon: 'star', test: (it) => it.category === 'mejora' },
    { id: 'forge', icon: 'anvil', test: (it) => it.category === 'forja' },
    { id: 'other', icon: 'layers', test: () => true },
  ];

  DK.screens.register('inventory', {
    title: () => (DK.bag.inPack() ? t('nav.pack') : t('inv.title')), icon: 'bag', section: 'inventory', tutorial: 'inventory', music: () => DK.audio.zoneTrack(),
    render(params) {
      const refresh = () => DK.router.refresh();
      const exp = DK.bag.inPack() && DK.expedition.active();
      // v4.74: dos pestañas: Objetos y Equipamiento (armería y forja)
      params.tab = params.tab === 'gear' || params.gear ? 'gear' : 'items';
      const nGear = DK.gear.list().length + DK.gear.equipped().filter((x) => !exp || DK.party.isActive(x.d.uid)).length;
      const nItems = DK.bag.list(null).filter(({ item }) => item.category !== 'pieza').reduce((a, x) => a + x.qty, 0);
      const mainTabs = h('div', { class: 'inv-main-tabs', role: 'tablist' },
        [['items', 'bag', t('inv.tabItems'), nItems], ['gear', 'anvil', exp ? t('inv.tabGearExp') : t('inv.tabGear'), nGear]].map(([id, icon, label, n]) =>
          h('button', { class: 'inv-main-tab' + (params.tab === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.tab === id,
            onClick: () => { params.tab = id; if (id === 'items') params.gear = null; else params.item = null; refresh(); } },
            DK.icon(icon, 18), h('span', null, label), h('b', null, String(n)))));
      if (params.tab === 'gear') return h('div', { class: 'screen inv-screen gear-screen' }, exp ? packHead(exp) : null, mainTabs, gearView(params, refresh, exp));
      params.cat = params.cat || 'all';
      const q = (params.q || '').trim().toLowerCase();
      const narrow = DK.ui.isNarrow();

      /* ---- v4.42: grupos POR USO (Curar, Maná, Estados, Mejorar, Equipo, Otros) ----
       * Los materiales de crafteo ya no salen aquí: viven en Crafteo → Materiales.
       * Buscar y ordenar van en dos botones de icono (la búsqueda se abre al pulsar). */
      params.cat = USE_GROUPS.some((g) => g.id === params.cat) || params.cat === 'all' ? params.cat : 'all';
      params.sort = params.sort || 'qty';
      const groupOf = (it) => (USE_GROUPS.find((g) => g.test(it)) || USE_GROUPS[USE_GROUPS.length - 1]).id;
      const owned = DK.bag.list(null).filter(({ item }) => item.category !== 'pieza');
      const counts = {}; owned.forEach(({ item, qty }) => { const g = groupOf(item); counts[g] = (counts[g] || 0) + qty; });
      const shown = USE_GROUPS.filter((g) => counts[g.id]);
      if (params.cat !== 'all' && !counts[params.cat]) params.cat = 'all';
      const tabs = h('div', { class: 'inv-tabs inv-tabs-use', role: 'tablist' }, [{ id: 'all', icon: 'layers' }].concat(shown).map((g) => {
        const n = g.id === 'all' ? owned.reduce((a, x) => a + x.qty, 0) : counts[g.id];
        return h('button', { class: 'inv-tab' + (params.cat === g.id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.cat === g.id,
          onClick: () => { params.cat = g.id; refresh(); } },
          DK.icon(g.icon, 17), h('span', null, t(['inv', 'ug', g.id].join('.'))), h('b', null, String(n)));
      }));
      const SORTS = ['qty', 'name', 'rarity'];
      const sortBtn = btn({ icon: 'sortArrows', label: t('inv.sortBy', { s: t('inv.sort.' + params.sort) }), iconOnly: true, size: 'sm', variant: 'ghost',
        onClick: () => { params.sort = SORTS[(SORTS.indexOf(params.sort) + 1) % SORTS.length]; DK.ui.toast(t('inv.sortBy', { s: t('inv.sort.' + params.sort) }), { icon: 'sortArrows' }); refresh(); } });
      const searchBtn = btn({ icon: 'search', label: t('inv.search'), iconOnly: true, size: 'sm', variant: params.searchOpen || q ? 'tone' : 'ghost',
        onClick: () => { params.searchOpen = !params.searchOpen; if (!params.searchOpen) params.q = ''; refresh(); if (params.searchOpen) setTimeout(() => { const i = document.querySelector('.inv-search'); if (i) i.focus(); }, 30); } });
      const search = params.searchOpen || q ? h('input', { class: 'input inv-search', type: 'search', placeholder: t('inv.search'), value: params.q || '',
        onInput: (e) => { params.q = e.target.value; clearTimeout(params._qt); params._qt = setTimeout(() => { refresh(); const i = document.querySelector('.inv-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } }) : null;
      const bar = h('div', { class: 'inv-bar' }, tabs,
        h('div', { class: 'inv-bar-row' }, search, h('span', { class: 'grow' }),
          exp ? null : V.coins(DK.wallet.get()),
          searchBtn, sortBtn,
          exp ? null : btn({ icon: 'craftCog', label: t('nav.craft'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('craft') }),
          btn({ icon: 'heart', label: t('heal.button'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(DK.party.active())) refresh(); } })));

      /* ---- Lista ---- */
      const rOrd = (it) => (D.rarities[it.rarity] || {}).order || 0;
      const sorter = params.sort === 'name' ? (a, b) => a.item.name.localeCompare(b.item.name) : params.sort === 'rarity' ? (a, b) => rOrd(b.item) - rOrd(a.item) || b.qty - a.qty : (a, b) => b.qty - a.qty;
      const all = owned.filter(({ item }) => (params.cat === 'all' || groupOf(item) === params.cat) && (!q || item.name.toLowerCase().includes(q))).sort(sorter);
      if (params.item && !DK.bag.count(params.item)) params.item = null;
      // El detalle NO se abre solo; sólo al pulsar un objeto (y pulsarlo otra vez lo cierra)
      const open = (id) => {
        if (!narrow && params.item === id) { params.item = null; refresh(); return; }
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
      const groups = (params.cat === 'all' ? shown : USE_GROUPS.filter((g) => g.id === params.cat)).map((g) => {
        const items = all.filter(({ item }) => groupOf(item) === g.id);
        if (!items.length) return null;
        return h('section', { class: 'inv-group' },
          params.cat === 'all' ? h('h4', { class: 'inv-group-head' }, DK.icon(g.icon, 14), t(['inv', 'ug', g.id].join('.')), h('span', { class: 'muted' }, String(items.reduce((a, x) => a + x.qty, 0)))) : null,
          h('div', { class: 'inv-grid' }, items.map(row)));
      }).filter(Boolean);
      // Materiales: sólo un acceso a Crafteo → Materiales
      const mats = exp ? [] : DK.bag.list('pieza');
      const matLink = mats.length ? h('button', { class: 'inv-mats-link', type: 'button', onClick: () => DK.router.reset('craft', { tab: 'materials' }) },
        DK.icon('cube', 16), h('span', null, h('b', null, t('inv.matsTitle')), h('span', { class: 'muted small' }, t('inv.matsText', { n: mats.length, q: mats.reduce((a, x) => a + x.qty, 0) }))), DK.icon('next', 16)) : null;
      const list = groups.length ? h('div', { class: 'inv-groups' }, groups, params.cat === 'all' ? matLink : null) : h('div', { class: 'stack' }, DK.ui.empty('bag', t('bag.empty'), q ? '' : t('bag.emptyText')), matLink);

      // v4.46: la entrada animada sólo al abrir otro objeto (al usar se repinta sin parpadear)
      const freshSide = params.item !== params._shown; params._shown = !narrow ? params.item || null : null;
      const detail = !narrow && params.item ? h('aside', { class: 'card inv-side' + (freshSide ? ' fresh' : '') },
        h('button', { class: 'icon-btn inv-side-x', type: 'button', tip: t('common.close'), 'aria-label': t('common.close'), onClick: () => { params.item = null; refresh(); } }, DK.icon('x', 16)),
        itemPanel(params.item, refresh)) : null;

      return h('div', { class: 'screen inv-screen' },
        exp ? packHead(exp) : null,
        mainTabs,
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
        items.length || (e.loot.gear || []).length ? h('div', { class: 'chips' }, items.map(([id, n]) => h('span', { class: 'chip', tip: t('pack.lootTip') }, DK.icon(D.items[id].icon, 13), `${D.items[id].name} x${n}`)),
          (e.loot.gear || []).map((p) => h('span', { class: 'chip gear-chip', style: { '--g': D.gear.rarities[p.rarity].color }, tip: t('gear.rarity.' + p.rarity) }, DK.icon(D.items[p.base].icon, 13), DK.gear.name(p)))) : h('span', { class: 'muted small' }, t('exp.lootEmpty'))));
  }

  /**
   * Vista previa de usar un objeto en un daskai (sin usarlo):
   *  - cura / maná: barra con lo que tiene y, en verde, lo que recupera (45/90 → 75/90)
   *  - experiencia: barra de experiencia con lo que gana y los niveles que sube (Nv 12 → 14)
   *  - tónico: el atributo antes → después · estados: el estado que quita
   */
  function usePreview(itemId, d, why) {
    const it = D.items[itemId], u = it.use || {}, s = DK.daskai.stats(d);
    const bar = (cls, cur, max, add, label) => h('div', { class: 'up-row ' + cls },
      h('div', { class: 'up-bar' }, h('i', { class: 'up-now', style: { width: Math.round((Math.min(cur, max) / max) * 100) + '%' } }),
        add > 0 ? h('i', { class: 'up-add', style: { left: Math.round((Math.min(cur, max) / max) * 100) + '%', width: Math.round((Math.min(add, max - cur) / max) * 100) + '%' } }) : null),
      h('span', { class: 'up-txt' }, label));
    if (why) return h('span', { class: 'small muted' }, why);
    const out = [];
    if (u.heal || u.healPct || u.mana || u.manaPct) {
      const p = DK.bag.potency(itemId, d);
      if (p.hp) { const add = Math.min(p.hp, s.hp - d.cur.hp); out.push(bar('hp', d.cur.hp, s.hp, add, h('span', null, `${d.cur.hp} → `, h('b', null, d.cur.hp + add), `/${s.hp}`, h('em', null, ` +${add}`)))); }
      if (p.mp) { const add = Math.min(p.mp, s.mp - d.cur.mp); out.push(bar('mp', d.cur.mp, s.mp, add, h('span', null, `${d.cur.mp} → `, h('b', null, d.cur.mp + add), `/${s.mp}`, h('em', null, ` +${add}`)))); }
    }
    if (u.cure && d.status && u.cure.includes(d.status)) out.push(h('span', { class: 'small good-text' }, DK.icon('check', 12), ' ', t('inv.curesStatus', { s: DK.tr('statuses', D.statuses[d.status]) })));
    if (u.exp || u.levels) {
      // Simula la experiencia: cuántos niveles sube y cómo queda la barra
      const cap = DK.config.maxLevel, curve = DK.config.expCurve;
      let lv = d.level, exp = d.exp || 0;
      const amount = u.exp || Math.max(1, curve(lv) - exp) + (u.levels > 1 ? curve(lv + 1) * (u.levels - 1) : 0);
      exp += amount;
      while (lv < cap && exp >= curve(lv)) { exp -= curve(lv); lv++; }
      const up = lv - d.level;
      out.push(h('div', { class: 'up-row exp' + (up ? ' lvup' : '') },
        h('div', { class: 'up-bar' },
          up ? h('i', { class: 'up-add full', style: { left: 0, width: (lv >= cap ? 100 : Math.round((exp / curve(lv)) * 100)) + '%' } })
            : [h('i', { class: 'up-now', style: { width: Math.round(((d.exp || 0) / curve(d.level)) * 100) + '%' } }), h('i', { class: 'up-add', style: { left: Math.round(((d.exp || 0) / curve(d.level)) * 100) + '%', width: Math.round((amount / curve(d.level)) * 100) + '%' } })]),
        h('span', { class: 'up-txt' }, up ? h('span', null, `${t('common.lvl')} ${d.level} → `, h('b', null, lv), h('em', null, ` +${up}`)) : h('span', null, `+${amount} ${t('common.expShort')}`))));
    }
    if (u.perm) {
      const k = u.perm, n = DK.config.tonic.per[k];
      out.push(h('span', { class: 'small' }, DK.icon(D.stats[k].icon, 12), ' ', DK.tr('stats', D.stats[k]), ': ', s[k], ' → ', h('b', { class: 'good-text' }, s[k] + n), h('span', { class: 'muted' }, ` · ${t('inv.tonicLeft', { n: DK.config.tonic.cap - DK.daskai.tonicsUsed(d) })}`)));
    }
    if (u.resetPerm) out.push(h('span', { class: 'small' }, t('inv.resetPreview', { n: DK.daskai.tonicsUsed(d) })));
    return out.length ? h('div', { class: 'up-list' }, out) : h('span', { class: 'small muted' }, V.useText(it));
  }

  /** Usa o equipa un objeto sobre un daskai. */
  function applyItemTo(itemId, d, refresh) {
    const it = D.items[itemId];
    if (it.category === 'batalla' || it.category === 'mejora') {
      const r = DK.bag.use(itemId, d);
      DK.audio.sfx(!r.ok ? 'error' : r.levelInfo ? 'levelup' : 'heal');
      toast(r.msg, { icon: r.levelInfo ? 'star' : 'flask', kind: r.ok ? 'good' : 'bad' });
      if (r.levelInfo) { refresh(); V.afterLevel(d, r.levelInfo).then(refresh); return; }
    } else { toast(t('inv.cantUsePiece'), { icon: 'cube' }); return; }
    refresh();
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
      h('span', { class: 'inv-hero-icon' }, V.itemIcon(it, 40)),
      h('div', { class: 'grow' }, h('h2', null, it.name),
        h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'badge' }, DK.icon(cat.icon, 12), DK.tr('categories', cat)), h('span', { class: 'badge' }, t('item.owned', { n: qty })))),
      h('p', { class: 'muted inv-hero-desc' }, it.desc)));

    // Qué hace
    const what = [];
    if (it.use) what.push(h('p', { class: 'inv-effect' }, DK.icon('flask', 16), h('b', null, V.useText(it))));
    if (it.stats) what.push(V.statChips(it.stats));
    what.push(...V.itemGrants(it));
    if (what.length) blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('craft.whatDoes')), what));

    // Usar en… (v4.42): equipo arriba y reserva aparte (plegada), con una vista
    // previa de lo que hará en cada uno (vida/maná que cura, experiencia y niveles, tónico…)
    if ((it.category === 'batalla' && !it.use.capture) || it.category === 'mejora') {
      if (it.use && it.use.guardian) blocks.push(h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('bag.autoItem'))));
      else {
        const team = party.filter((d) => DK.party.isActive(d.uid)), rest = party.filter((d) => !DK.party.isActive(d.uid));
        // En la reserva: primero en los que tiene efecto
        rest.sort((a, b) => (DK.bag.cannotUse(itemId, a) ? 1 : 0) - (DK.bag.cannotUse(itemId, b) ? 1 : 0) || b.level - a.level);
        const target = (d) => {
          const why = DK.bag.cannotUse(itemId, d);
          return h('div', { class: 'inv-target v2' + (why ? ' off' : '') + (DK.party.isActive(d.uid) ? ' in-team' : '') },
            h('span', { class: 'inv-target-art' }, V.dSprite(d, { size: 44 }), DK.party.isActive(d.uid) ? h('span', { class: 'inv-target-team', tip: t('team.inTeam') }, DK.icon('users', 10)) : null),
            h('div', { class: 'inv-target-main' },
              h('div', { class: 'row gap-s' }, h('b', null, DK.daskai.name(d)), h('span', { class: 'muted small' }, `${t('common.lvl')} ${d.level}`)),
              usePreview(itemId, d, why)),
            btn({ icon: 'hand', label: t('inv.use'), size: 'sm', variant: why ? 'ghost' : 'primary', disabled: !!why, tip: why || null, onClick: () => applyItemTo(itemId, d, refresh) }));
        };
        blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('inv.useOn')),
          team.length ? h('div', { class: 'inv-tgroup' }, h('span', { class: 'inv-tgroup-head' }, DK.icon('users', 13), t('inv.inTeam'), h('span', { class: 'muted' }, team.length)), h('div', { class: 'inv-targets' }, team.map(target))) : null,
          rest.length ? h('details', { class: 'inv-tgroup reserve', open: !team.length },
            h('summary', { class: 'inv-tgroup-head' }, DK.icon('grid', 13), t('inv.inReserve'), h('span', { class: 'muted' }, rest.length), DK.icon('next', 13)),
            h('div', { class: 'inv-targets' }, rest.map(target))) : null));
      }
    }
    if (it.use && it.use.capture) blocks.push(h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('bag.onlyInBattle'))));

    // Piedra de forja: se usa en la pestaña Equipamiento
    if (it.category === 'forja' && itemId !== 'fragmento_forja') blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('gear.forgeTitle')),
      h('p', { class: 'small muted' }, t('gear.stoneHow')),
      btn({ icon: 'anvil', label: t('gear.toForge'), variant: 'primary', size: 'sm', disabled: DK.bag.inPack(), onClick: () => DK.router.reset('inventory', { tab: 'gear' }) })));

    // Recetas en las que se usa
    const uses = DK.crafting.usesOf(itemId);
    if (uses.length) blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t(uses.length === 1 ? 'craft.usedInOne' : 'craft.usedIn', { n: uses.length })),
      h('div', { class: 'inv-recipes' }, uses.map((r) => h('button', { class: 'inv-recipe', type: 'button', disabled: DK.bag.inPack(), onClick: () => DK.router.reset('craft', { sel: r.id }) },
        V.itemIcon(D.items[r.result], 18), h('span', null, D.items[r.result].name))))));

    // Venta
    if (DK.shop.canSell(itemId)) blocks.push(h('p', { class: 'muted small inv-sell' }, DK.icon('shop', 14), ' ', t('inv.sellAtMerchant', { n: DK.shop.sellPrice(itemId) })));
    return h('div', { class: 'inv-detail-body' }, ...blocks);
  }

  /* =================== v4.74: Equipamiento (armería y forja) =================== */
  const GR = () => D.gear.rarities;
  const rOrder = (p) => GR()[p.rarity].order;

  /**
   * Pestaña Equipamiento:
   *   · arriba, tus piedras de forja (en casa) o qué hacer con lo encontrado (en expedición)
   *   · filtros por rareza, «sin equipar» y orden
   *   · cuadrícula de piezas (las equipadas llevan la cara de quien las lleva)
   *   · al elegir una: su ficha, la forja (piedras), equipar en… y desguazar
   * params: { gear (uid elegido), gr (rareza), free (sólo sin equipar), gsort }
   */
  function gearView(params, refresh, exp) {
    const narrow = DK.ui.isNarrow();
    params.gr = params.gr || 'all'; params.gsort = params.gsort || 'rarity';
    const loose = DK.gear.list().map((p) => ({ p, d: null }));
    const worn = DK.gear.equipped().filter((x) => !exp || DK.party.isActive(x.d.uid)).map((x) => ({ p: x.p, d: x.d }));
    const all = params.free ? loose : loose.concat(worn);
    const counts = {}; all.forEach(({ p }) => (counts[p.rarity] = (counts[p.rarity] || 0) + 1));
    const sorter = params.gsort === 'ilvl' ? (a, b) => b.p.ilvl - a.p.ilvl || rOrder(b.p) - rOrder(a.p)
      : params.gsort === 'name' ? (a, b) => DK.gear.name(a.p).localeCompare(DK.gear.name(b.p))
        : (a, b) => rOrder(b.p) - rOrder(a.p) || b.p.ilvl - a.p.ilvl;
    const shown = all.filter(({ p }) => params.gr === 'all' || p.rarity === params.gr).sort(sorter);
    if (params.gear && !DK.gear.find(params.gear)) params.gear = null;

    // En casa: acceso a la forja (Crafteo) con cuántas piedras tienes; en expedición, qué se puede hacer
    const nStones = DK.gear.stones.reduce((a, id) => a + (DK.bag.home()[id] || 0), 0);
    const stones = exp ? h('div', { class: 'card gear-exp-note' }, DK.icon('info', 16), h('span', null, t('gear.expNote')))
      : h('button', { class: 'forge-link', type: 'button', onClick: () => DK.router.reset('craft', { tab: 'forge' }) },
        DK.icon('anvil', 18), h('span', { class: 'grow' }, h('b', null, t('gear.goForge')), h('small', null, t('gear.bench.emptyText'))), h('span', { class: 'forge-link-n' }, DK.icon('gem', 13), String(nStones)), DK.icon('next', 16));

    // Filtros
    const chip = (id, label, n) => h('button', { class: 'gear-filter' + (params.gr === id ? ' on' : ''), type: 'button', style: id !== 'all' ? { '--g': GR()[id].color } : null,
      onClick: () => { params.gr = id; refresh(); } }, id !== 'all' ? h('i', { class: 'gear-dot' }) : null, label, h('b', null, String(n)));
    const SORTS = ['rarity', 'ilvl', 'name'];
    const filters = h('div', { class: 'gear-filters' },
      chip('all', t('gear.all'), all.length),
      D.gear.rarityOrder.filter((r) => counts[r]).map((r) => chip(r, t('gear.rarity.' + r), counts[r])),
      h('span', { class: 'grow' }),
      h('label', { class: 'gear-free' }, h('input', { type: 'checkbox', checked: !!params.free, onChange: (e) => { params.free = e.target.checked; refresh(); } }), t('gear.onlyFree')),
      btn({ icon: 'sortArrows', label: t('inv.sortBy', { s: t('gear.sort.' + params.gsort) }), iconOnly: true, size: 'sm', variant: 'ghost',
        onClick: () => { params.gsort = SORTS[(SORTS.indexOf(params.gsort) + 1) % SORTS.length]; toast(t('inv.sortBy', { s: t('gear.sort.' + params.gsort) }), { icon: 'sortArrows' }); refresh(); } }),
      exp ? null : btn({ icon: 'hammer', label: t('gear.salvageNormals'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => salvageNormals(refresh) }));

    const open = (uid) => {
      if (!narrow && params.gear === uid) { params.gear = null; refresh(); return; }
      params.gear = uid; params._changed = null;
      if (!narrow) { refresh(); return; }
      const holder = h('div');
      const draw = () => { const x = DK.gear.find(uid); holder.replaceChildren(x ? gearPanel(x.p, params, () => { draw(); refresh(); }, exp) : DK.ui.empty('gem', t('gear.gone'), '')); };
      draw();
      DK.ui.drawer({ title: DK.gear.name(DK.gear.find(uid).p), icon: 'anvil', size: 'wide', cls: 'inv-sheet gear-sheet', content: holder });
    };
    const grid = shown.length ? h('div', { class: 'gear-grid' }, shown.map(({ p }) => V.gearTile(p, { selected: params.gear === p.uid && !narrow, onClick: () => open(p.uid) })))
      : DK.ui.empty('gem', exp ? t('gear.noneFound') : t('gear.none'), exp ? '' : t('gear.noneText'));

    const freshSide = params.gear !== params._shownG; params._shownG = !narrow ? params.gear || null : null;
    const x = !narrow && params.gear && DK.gear.find(params.gear);
    const detail = x ? h('aside', { class: 'card inv-side gear-side' + (freshSide ? ' fresh' : '') },
      h('button', { class: 'icon-btn inv-side-x', type: 'button', tip: t('common.close'), 'aria-label': t('common.close'), onClick: () => { params.gear = null; refresh(); } }, DK.icon('x', 16)),
      gearPanel(x.p, params, refresh, exp)) : null;
    // En el móvil, si se entra con una pieza elegida (desde la ficha del daskai), se abre su hoja
    if (narrow && params.gear && !params._sheet) { params._sheet = true; const uid = params.gear; params.gear = null; setTimeout(() => open(uid), 0); }

    return h('div', { class: 'gear-wrap' }, stones, filters,
      h('div', { class: 'inv-main' + (detail ? ' has-detail' : '') }, h('div', { class: 'inv-list-wrap' }, grid), detail));
  }

  /** Desguazar de golpe todas las piezas normales sin equipar. */
  async function salvageNormals(refresh) {
    const list = DK.gear.home().filter((p) => p.rarity === 'normal');
    if (!list.length) { toast(t('gear.noNormals'), { icon: 'hammer' }); return; }
    const n = list.reduce((a, p) => a + DK.gear.salvageValue(p).fragmento_forja, 0);
    if (!(await DK.ui.confirm(t('gear.salvageAllQ', { n: list.length }), t('gear.salvageAllText', { n: list.length, f: n }), { okLabel: t('gear.salvage'), okIcon: 'hammer', danger: true }))) return;
    list.forEach((p) => DK.gear.salvage(p.uid));
    DK.audio.sfx('craft');
    toast(t('gear.salvagedAll', { n: list.length, f: n }), { icon: 'hammer', kind: 'good' });
    refresh();
  }

  /** Qué cambió al forjar (para resaltarlo en la ficha): Set de 'a<i>', 'x<i>', 'leg'. */
  V.gearDiffKeys = (b, p) => diffKeys(b, p);
  function diffKeys(before, p) {
    const out = new Set();
    p.attrs.forEach((a, i) => { const b = before.attrs[i]; if (!b || b.k !== a.k || b.r !== a.r || before.rarity !== p.rarity) out.add('a' + i); });
    p.affixes.forEach((a, i) => { const b = before.affixes[i]; if (!b || b.id !== a.id || b.t !== a.t || b.r !== a.r) out.add('x' + i); });
    if (p.rarity === 'legendario' && before.rarity !== 'legendario') out.add('leg');
    return out;
  }

  /**
   * Ficha de una pieza (v4.75): su carta, «Equipar en…» (ventana con equipo, entrenando y cajas),
   * «Mejorar en la forja» (Crafteo → Forja), quién la lleva y desguazar.
   */
  function gearPanel(p, params, refresh, exp) {
    const x = DK.gear.find(p.uid), wornBy = x && x.where === 'equip' ? x.d : null;
    const blocks = [V.gearTip(p)];
    blocks.push(h('div', { class: 'gear-actions' },
      btn({ icon: 'gem', label: t('gear.equipOnBtn'), variant: 'primary', onClick: async () => { if (await V.equipPicker(p.uid)) refresh(); } }),
      exp ? null : btn({ icon: 'anvil', label: t('gear.toForgeLong'), variant: 'tone', onClick: () => DK.router.reset('craft', { tab: 'forge', fp: p.uid }) })));
    if (wornBy) {
      blocks.push(h('section', { class: 'inv-block' }, h('h4', null, t('gear.wornTitle')),
        h('div', { class: 'inv-target equip' }, V.dSprite(wornBy, { size: 42 }), h('div', { class: 'inv-target-main' }, h('b', null, DK.daskai.name(wornBy)), h('span', { class: 'muted small' }, `${t('common.lvl')} ${wornBy.level}`)),
          btn({ icon: 'x', label: t('equip.remove'), size: 'sm', variant: 'ghost', onClick: () => { DK.gear.unequip(wornBy, x.slot); DK.audio.sfx('select'); refresh(); } }))));
    }
    // Desguazar (en casa y sin equipar)
    if (!exp && !wornBy) {
      const got = DK.gear.salvageValue(p);
      blocks.push(h('div', { class: 'gear-salvage' }, DK.icon('hammer', 15), h('span', { class: 'grow small muted' }, t('gear.salvageText', { n: got.fragmento_forja })),
        btn({ icon: 'hammer', label: t('gear.salvage'), size: 'sm', variant: 'ghost', onClick: async () => {
          if (p.rarity !== 'normal' && !(await DK.ui.confirm(t('gear.salvageQ', { name: DK.gear.name(p) }), t('gear.salvageQText', { n: got.fragmento_forja }), { okLabel: t('gear.salvage'), okIcon: 'hammer', danger: true }))) return;
          const r = DK.gear.salvage(p.uid);
          DK.audio.sfx('craft'); toast(r.msg, { icon: 'hammer', kind: 'good' });
          params.gear = null; DK.ui.closeAll(); refresh();
        } })));
    }
    return h('div', { class: 'inv-detail-body gear-body' }, ...blocks);
  }
})();
