/* =============================================================
 * screens/craft.js — Crafteo: construir objetos con los materiales
 * que traes de las expediciones.
 *
 * Lo más importante son los objetos de equipo con `grants`
 * (data/items.js): al equiparlos, el daskai gana un ataque nuevo
 * o una pasiva extra. Todas las recetas están a la vista desde el
 * principio (data/recipes.js); lo difícil es reunir los materiales.
 *
 * params: { kind, only, q, sel, times, uses }
 *   kind  'all' | 'move' | 'passive' | 'stats' | 'consumable'
 *   only  true → sólo lo que puedes construir ahora
 *   sel   id de la receta abierta en el panel de detalle
 *   uses  id de un material: filtra las recetas que lo usan
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);

  /** Tipo de una receta según lo que da su resultado. */
  function kindOf(r) {
    const it = D.items[r.result];
    if (it.grants && it.grants.move) return 'move';
    if (it.grants && it.grants.passive) return 'passive';
    if (it.category === 'equipo') return 'stats';
    return 'consumable';
  }
  const KINDS = { all: 'sparkles', move: 'swords', passive: 'shield', stats: 'gem', consumable: 'flask' };

  /** Dónde se consigue un material: zonas cuyos salvajes o jefe lo sueltan. */
  function sources(itemId) {
    const out = [];
    Object.values(D.zones).forEach((z) => {
      const wild = z.enemies.some((e) => (D.species[e.species].drops || []).some(([id]) => id === itemId));
      const boss = (z.boss.drops || []).some(([id]) => id === itemId);
      if (wild || boss) out.push({ zone: z, boss: boss && !wild });
    });
    return out;
  }

  /** Lo que hace el resultado: tarjeta del ataque, pasiva, atributos o efecto. */
  function effectPreview(it) {
    const blocks = [];
    if (it.grants && it.grants.move) blocks.push(h('div', { class: 'stack-s' }, h('span', { class: 'craft-label' }, DK.icon('swords', 14), t('craft.givesMove')), V.moveCard(it.grants.move)));
    if (it.grants && it.grants.passive) blocks.push(V.passiveBox(it.grants.passive));
    if (it.stats) blocks.push(h('div', { class: 'stack-s' }, h('span', { class: 'craft-label' }, DK.icon('gem', 14), t('item.bonus')), V.statChips(it.stats)));
    if (it.use) blocks.push(h('div', { class: 'stack-s' }, h('span', { class: 'craft-label' }, DK.icon('flask', 14), t('item.effect')), h('b', null, V.useText(it))));
    return h('div', { class: 'stack-s' }, blocks);
  }

  DK.menus.add('nav', {
    id: 'craft', icon: 'anvil', order: 32, screen: 'craft', label: () => t('nav.craft'),
    badge: () => { const n = D.recipes.filter((r) => DK.crafting.canCraft(r)).length; return n ? String(n) : ''; },
  });

  DK.screens.register('craft', {
    title: () => t('craft.title'), icon: 'anvil', section: 'craft', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.kind = params.kind || 'all';
      const q = (params.q || '').trim().toLowerCase();

      let list = D.recipes.slice();
      if (params.uses) list = list.filter((r) => r.ingredients[params.uses]);
      if (params.kind !== 'all') list = list.filter((r) => kindOf(r) === params.kind);
      if (params.only) list = list.filter((r) => DK.crafting.plan(r).ok);
      if (q) list = list.filter((r) => D.items[r.result].name.toLowerCase().includes(q) || Object.keys(r.ingredients).some((id) => D.items[id].name.toLowerCase().includes(q)));
      // Primero lo que puedes construir, luego por rareza
      const order = (r) => (DK.crafting.canCraft(r) ? 0 : DK.crafting.plan(r).ok ? 1 : 2) * 10 + D.rarities[D.items[r.result].rarity].order;
      list.sort((a, b) => order(a) - order(b));

      const filters = h('div', { class: 'craft-filters' },
        DK.ui.segmented({ options: Object.keys(KINDS).map((k) => ({ value: k, icon: KINDS[k], label: t('craft.kind.' + k) })), value: params.kind, onChange: (v) => DK.router.replace('craft', Object.assign({}, params, { kind: v, sel: null })) }),
        h('div', { class: 'row gap-s wrap' },
          h('input', { class: 'input craft-search', type: 'search', placeholder: t('craft.search'), value: params.q || '', onChange: (e) => DK.router.replace('craft', Object.assign({}, params, { q: e.target.value })) }),
          btn({ icon: params.only ? 'check' : 'filter', label: t('craft.only'), size: 'sm', variant: params.only ? 'primary' : 'ghost', onClick: () => DK.router.replace('craft', Object.assign({}, params, { only: !params.only })) }),
          params.uses ? btn({ icon: 'x', label: t('craft.usesFilter', { item: D.items[params.uses].name }), size: 'sm', variant: 'tone', onClick: () => DK.router.replace('craft', Object.assign({}, params, { uses: null })) }) : null));

      const cards = list.length ? h('div', { class: 'craft-grid' }, list.map((r) => recipeCard(r, params))) : DK.ui.empty('anvil', t('craft.emptyTitle'), t('craft.emptyText'));
      const sel = params.sel && DK.crafting.get(params.sel);

      return h('div', { class: 'screen craft-screen' },
        h('div', { class: 'card craft-intro row gap wrap' }, h('span', { class: 'craft-intro-icon' }, DK.icon('anvil', 28)),
          h('div', { class: 'grow' }, h('h3', null, t('craft.title')), h('p', { class: 'muted small' }, t('craft.intro'))),
          btn({ icon: 'bag', label: t('nav.inventory'), size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('inventory') })),
        filters,
        h('div', { class: 'craft-layout' + (sel ? ' has-detail' : '') }, cards, sel ? detail(sel, params, refresh) : null));
    },
  });

  /** Tarjeta de receta de la lista. */
  function recipeCard(r, params) {
    const it = D.items[r.result];
    const kind = kindOf(r);
    const can = DK.crafting.maxTimes(r);
    const chain = !can && DK.crafting.plan(r).ok;
    const sub = kind === 'move' ? D.moves[it.grants.move].name : kind === 'passive' ? DK.tr('passives', D.passives[it.grants.passive]) : kind === 'stats' ? null : V.useText(it);
    return h('button', { class: `craft-card card r-${it.rarity} k-${kind}` + (params.sel === r.id ? ' selected' : '') + (can ? ' ready' : chain ? ' chain' : ''), type: 'button', onClick: () => DK.router.replace('craft', Object.assign({}, params, { sel: params.sel === r.id ? null : r.id, times: 1 })) },
      h('div', { class: 'row gap-s' }, V.itemIcon(it, 26),
        h('div', { class: 'grow craft-card-main' }, h('b', null, it.name),
          h('span', { class: 'craft-kind small' }, DK.icon(KINDS[kind], 12), t('craft.kind.' + kind), sub ? ' · ' + sub : '')),
        can ? h('span', { class: 'badge good' }, 'x' + can) : chain ? h('span', { class: 'badge warn', tip: t('craft.canChain') }, DK.icon('anvil', 12)) : null),
      kind === 'stats' ? V.statChips(it.stats) : null,
      h('div', { class: 'craft-ings' }, Object.entries(r.ingredients).map(([id, n]) => {
        const have = DK.bag.count(id);
        return h('span', { class: 'craft-ing ' + (have >= n ? 'ok' : 'no'), tip: D.items[id].name }, DK.icon(D.items[id].icon, 13), `${have}/${n}`);
      })));
  }

  /** Panel de detalle: efecto, ingredientes, cantidad, construir y equipar. */
  function detail(r, params, refresh) {
    const it = D.items[r.result];
    const times = Math.max(1, params.times || 1);
    const plan = DK.crafting.plan(r, times);
    const direct = DK.crafting.canCraft(r, times);
    const max = Math.max(1, DK.crafting.maxTimes(r));
    const setTimes = (n) => DK.router.replace('craft', Object.assign({}, params, { times: Math.max(1, Math.min(99, n)) }));

    const ings = h('div', { class: 'list' }, Object.entries(r.ingredients).map(([id, n]) => {
      const have = DK.bag.count(id), need = n * times;
      const src = sources(id);
      const sub = DK.crafting.recipeFor(id);
      return h('div', { class: 'craft-ing-row ' + (have >= need ? 'ok' : 'no') },
        V.itemIcon(D.items[id], 20),
        h('div', { class: 'grow' }, h('b', null, D.items[id].name),
          h('div', { class: 'muted small' },
            src.length ? t('craft.foundIn', { list: src.map((s) => s.zone.name + (s.boss ? ' (' + t('craft.boss') + ')' : '')).join(', ') }) : sub ? t('craft.craftable') : t('craft.rare'))),
        sub && have < need ? btn({ icon: 'anvil', size: 'sm', variant: 'ghost', tip: t('craft.open'), onClick: () => DK.router.replace('craft', Object.assign({}, params, { sel: sub.id, times: 1 })) }) : null,
        h('b', { class: 'craft-count' }, `${have}/${need}`));
    }));

    const doCraft = () => {
      const ok = direct ? DK.crafting.craft(r, times) : DK.crafting.runPlan(plan);
      if (!ok) return;
      DK.audio.sfx('craft');
      toast(t('craft.done', { item: it.name, n: r.qty * times }), { icon: it.icon, kind: 'good' });
      refresh();
    };

    // Equipar el resultado a un daskai del equipo (si es equipo y lo tienes)
    let equip = null;
    if (it.category === 'equipo' && DK.bag.count(it.id)) {
      equip = h('div', { class: 'stack-s' }, h('span', { class: 'craft-label' }, DK.icon('gem', 14), t('craft.equipTo')),
        h('div', { class: 'list' }, DK.party.active().map((d) => {
          const free = d.equip.findIndex((x, i) => !x && i < DK.config.maxEquip);
          const slot = free >= 0 ? free : d.equip.length < DK.config.maxEquip ? d.equip.length : -1;
          const has = d.equip.includes(it.id);
          return h('div', { class: 'craft-equip-row' }, V.sprite(d.species, { size: 34 }),
            h('div', { class: 'grow' }, h('b', null, DK.daskai.name(d)), h('div', { class: 'muted small' }, `${t('common.lvl')} ${d.level} · ${d.equip.filter(Boolean).length}/${DK.config.maxEquip}`)),
            has ? h('span', { class: 'badge good' }, DK.icon('check', 12), t('craft.equipped'))
              : btn({ icon: 'gem', label: t('inv.equip'), size: 'sm', variant: 'tone', disabled: slot < 0, tip: slot < 0 ? t('craft.noSlot') : null, onClick: () => { DK.bag.equip(d, slot, it.id); DK.audio.sfx('select'); toast(t('equip.done', { name: DK.daskai.name(d), item: it.name }), { icon: 'gem', kind: 'good' }); refresh(); } }));
        })));
    }

    return h('aside', { class: 'card craft-detail stack' },
      h('div', { class: 'row gap' }, V.itemIcon(it, 34),
        h('div', { class: 'grow' }, h('h3', null, it.name), h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'badge' }, DK.icon(KINDS[kindOf(r)], 12), t('craft.kind.' + kindOf(r))), h('span', { class: 'badge' }, t('item.owned', { n: DK.bag.count(it.id) })))),
        btn({ icon: 'x', size: 'sm', variant: 'ghost', tip: t('common.close'), onClick: () => DK.router.replace('craft', Object.assign({}, params, { sel: null })) })),
      h('p', { class: 'muted' }, it.desc),
      effectPreview(it),
      h('span', { class: 'craft-label' }, DK.icon('cube', 14), t('craft.ingredients')),
      ings,
      h('div', { class: 'craft-make row gap wrap' },
        h('div', { class: 'stepper' },
          btn({ icon: 'minus', size: 'sm', variant: 'ghost', disabled: times <= 1, onClick: () => setTimes(times - 1) }),
          h('b', null, 'x' + times),
          btn({ icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => setTimes(times + 1) }),
          max > 1 ? btn({ label: t('craft.max'), size: 'sm', variant: 'ghost', onClick: () => setTimes(max) }) : null),
        btn({ icon: 'anvil', label: plan.ok && !direct ? t('craft.makeChain') : t('craft.make', { n: r.qty * times }), variant: 'primary', disabled: !plan.ok, onClick: doCraft })),
      !plan.ok ? h('p', { class: 'muted small' }, DK.icon('info', 13), ' ', t('craft.missing')) : !direct ? h('p', { class: 'muted small' }, DK.icon('anvil', 13), ' ', t('craft.chainInfo', { n: plan.steps.length - 1 })) : null,
      equip);
  }
})();
