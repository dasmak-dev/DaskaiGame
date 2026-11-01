/* =============================================================
 * screens/craft.js — Crafteo: fabricar objetos con los materiales que
 * traes de las expediciones (data/recipes.js, DK.crafting).
 *
 * Diseño simple:
 *   - Una barra: Recetas | Materiales, buscador, «Sólo fabricables» y tipo.
 *   - RECETAS en LISTA agrupada por secciones plegables (equipo con ataque,
 *     con pasiva, de atributos, tónicos, consumibles). Arriba, tus OBJETIVOS.
 *     Cada fila: icono, nombre, qué hace y su estado (fabricable / faltan).
 *   - MATERIALES: lo que tienes de cada uno, en cuántas recetas se usa y
 *     dónde conseguirlo.
 *   - Detalle en tres bloques: qué hace · qué necesitas · fabricar.
 *     A la derecha en escritorio; hoja inferior en el móvil.
 *   - Objetivos (estrella, DK.crafting favoritas): lo que les falta sale al
 *     preparar la expedición y en «Qué hacer ahora»; avisan cuando están listos.
 *   - Al fabricar equipo se ofrece ponérselo a un daskai (V.equipChooser),
 *     viendo cómo le cambian los atributos.
 *
 * params: { tab: 'recipes'|'materials', q, only, kind, sel, mat, times, open: {sección: bool} }
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const C = () => DK.crafting;

  /** Tipo (sección) de una receta según su resultado. */
  function kindOf(r) {
    const it = D.items[r.result];
    if (it.grants && it.grants.move) return 'move';
    if (it.grants && it.grants.passive) return 'passive';
    if (it.category === 'equipo') return 'stats';
    if (it.use && (it.use.perm || it.use.resetPerm)) return 'tonic';
    return 'consumable';
  }
  const KINDS = { move: 'swords', passive: 'shield', stats: 'gem', tonic: 'flask', consumable: 'heart' };
  V.craftKind = kindOf;

  /** Línea corta de lo que hace el resultado. */
  function summary(it) {
    if (it.grants && it.grants.move) return t('craft.grantMove', { name: D.moves[it.grants.move].name });
    if (it.grants && it.grants.passive) return t('craft.grantPassive', { name: DK.tr('passives', D.passives[it.grants.passive]) });
    if (it.stats) return Object.entries(it.stats).map(([k, v]) => `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    return it.use ? V.useText(it) : it.desc;
  }

  /** Dónde se consigue un material: zonas cuyos salvajes, jefe o jefe oculto lo sueltan. */
  function sources(itemId) {
    const out = [];
    Object.values(D.zones).forEach((z) => {
      const wild = z.enemies.some((e) => (D.species[e.species].drops || []).some(([id]) => id === itemId));
      const boss = (z.boss.drops || []).some(([id]) => id === itemId);
      const secret = D.secretBosses && D.secretBosses[z.id] && D.secretBosses[z.id].drops.some(([id]) => id === itemId);
      if (wild || boss || secret) out.push({ zone: z, how: wild ? 'wild' : boss ? 'boss' : 'secret' });
    });
    return out;
  }
  const sourceText = (id) => {
    const src = sources(id);
    if (src.length) return t('craft.foundIn', { list: src.map((s) => s.zone.name + (s.how !== 'wild' ? ` (${t('craft.how.' + s.how)})` : '')).join(', ') });
    return C().recipeFor(id) ? t('craft.craftable') : t('craft.rare');
  };
  V.craftSourceText = sourceText;

  /** Estado de una receta: 'ready' (n veces) | 'chain' | 'missing' (n materiales). */
  function status(r) {
    const n = C().maxTimes(r);
    if (n > 0) return { key: 'ready', n };
    if (C().plan(r).ok) return { key: 'chain' };
    return { key: 'missing', n: Object.entries(r.ingredients).filter(([id, q]) => DK.bag.count(id) < q).length };
  }

  /**
   * ¿Cuenta para el aviso del menú? Sólo tónicos y equipo NUEVO (que no tengas
   * ni en la bolsa ni equipado) que puedas fabricar ahora mismo.
   */
  const owned = (id) => DK.bag.count(id) > 0 || DK.party.all().some((d) => d.equip.includes(id));
  const worthy = (r) => { const k = kindOf(r); return (k === 'tonic' || (['move', 'passive', 'stats'].includes(k) && !owned(r.result))) && C().canCraft(r); };
  DK.menus.add('nav', {
    id: 'craft', icon: 'anvil', order: 32, screen: 'craft', label: () => t('nav.craft'),
    badge: () => { const n = D.recipes.filter(worthy).length; return n ? String(n) : ''; },
  });

  /* ---------------- Equipar lo fabricado ---------------- */
  /**
   * Ventana «¿A quién se lo pones?»: para cada daskai del equipo, su hueco
   * libre (o los ocupados, para cambiarlo) con cómo le cambian los atributos.
   * @returns {Promise<boolean>} true si se equipó
   */
  V.equipChooser = (itemId) => {
    const it = D.items[itemId];
    return DK.ui.modal({
      title: t('craft.equipQ', { item: it.name }), icon: 'gem', size: 'wide',
      content: (close) => h('div', { class: 'stack-s' },
        h('p', { class: 'muted small' }, t('craft.equipText')),
        h('div', { class: 'list' }, DK.party.active().map((d) => {
          const free = [...Array(DK.config.maxEquip).keys()].find((i) => !d.equip[i]);
          const opts = free != null ? [free] : [...Array(DK.config.maxEquip).keys()];
          const has = d.equip.includes(itemId);
          return h('div', { class: 'eq-choice' },
            h('div', { class: 'row gap-s' }, V.sprite(d.species, { size: 40, shiny: d.shiny }),
              h('div', { class: 'grow' }, h('b', null, DK.daskai.name(d)), h('div', { class: 'muted small' }, `${t('common.lvl')} ${d.level} · ${d.equip.filter(Boolean).length}/${DK.config.maxEquip}`))),
            has ? h('span', { class: 'badge good' }, DK.icon('check', 12), t('craft.equipped'))
              : h('div', { class: 'stack-s' }, opts.map((slot) => h('div', { class: 'eq-slot' },
                h('span', { class: 'small muted' }, d.equip[slot] ? t('craft.replaces', { item: D.items[d.equip[slot]].name }) : t('craft.freeSlot')),
                V.diffChips(DK.bag.equipPreview(d, slot, itemId)),
                btn({ icon: 'gem', label: d.equip[slot] ? t('craft.swap') : t('inv.equip'), size: 'sm', variant: 'primary', onClick: () => {
                  DK.bag.equip(d, slot, itemId); DK.audio.sfx('select');
                  toast(t('equip.done', { name: DK.daskai.name(d), item: it.name }), { icon: 'gem', kind: 'good' }); close(true);
                } })))));
        }))),
      actions: [{ label: t('craft.notNow'), icon: 'x', variant: 'ghost', value: false }],
    }).promise;
  };

  /* ---------------- Detalle de receta ---------------- */
  function recipeDetail(r, ctx) {
    const it = D.items[r.result];
    const kind = kindOf(r);
    const times = Math.max(1, ctx.times || 1);
    const plan = C().plan(r, times);
    const direct = C().canCraft(r, times);
    const max = Math.max(1, C().maxTimes(r));
    const goal = C().isFavorite(r.id);

    const doCraft = async () => {
      const ok = direct ? C().craft(r, times) : C().runPlan(plan);
      if (!ok) return;
      DK.audio.sfx('craft');
      toast(t('craft.done', { item: it.name, n: r.qty * times }), { icon: it.icon, kind: 'good' });
      ctx.redraw();
      // Equipo: ofrecer ponérselo a alguien ya
      if (it.category === 'equipo' && DK.party.active().length) { await V.equipChooser(it.id); ctx.redraw(); }
    };

    // 1) Qué hace
    const what = [];
    if (it.grants && it.grants.move) what.push(V.moveCard(it.grants.move, { compact: true }));
    if (it.grants && it.grants.passive) what.push(V.passiveBox(it.grants.passive));
    if (it.stats) what.push(h('p', { class: 'cr-line' }, summary(it)));
    if (it.use) what.push(h('p', { class: 'cr-line' }, V.useText(it)));

    // 2) Qué necesitas
    const ings = h('div', { class: 'cr-ings' }, Object.entries(r.ingredients).map(([id, n]) => {
      const have = DK.bag.count(id), need = n * times, ok = have >= need;
      const sub = C().recipeFor(id);
      return h('div', { class: 'cr-ing' + (ok ? ' ok' : '') },
        V.itemIcon(D.items[id], 20),
        h('div', { class: 'grow cr-ing-main' }, h('b', null, D.items[id].name), h('span', { class: 'muted small' }, sourceText(id))),
        sub && !ok ? btn({ icon: 'anvil', size: 'sm', variant: 'ghost', tip: t('craft.open'), onClick: () => ctx.open({ sel: sub.id, mat: null }) }) : null,
        h('b', { class: 'cr-count' }, `${have}/${need}`));
    }));

    return h('div', { class: 'cr-detail stack' },
      h('div', { class: 'cr-detail-head' }, V.itemIcon(it, 34),
        h('div', { class: 'grow' }, h('h3', null, it.name),
          h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'muted small' }, t('craft.kind.' + kind) + ' · ' + t('item.owned', { n: DK.bag.count(it.id) })))),
        h('button', { class: 'cr-goal' + (goal ? ' on' : ''), type: 'button', tip: goal ? t('craft.goalOff') : t('craft.goalOn'), 'aria-pressed': goal,
          onClick: () => { const on = C().toggleFavorite(r.id); toast(on ? t('craft.goalAdded', { item: it.name }) : t('craft.goalRemoved', { item: it.name }), { icon: 'star', kind: on ? 'good' : '' }); ctx.redraw(); } },
          DK.icon('star', 18), h('span', null, goal ? t('craft.goal') : t('craft.goalShort'))),
        ctx.close ? btn({ icon: 'x', size: 'sm', variant: 'ghost', tip: t('common.close'), onClick: ctx.close }) : null),
      h('section', { class: 'cr-block' }, h('h4', null, t('craft.whatDoes')), what, it.desc && !it.use ? h('p', { class: 'muted small' }, it.desc) : null),
      h('section', { class: 'cr-block' }, h('h4', null, t('craft.ingredients')), ings,
        !plan.ok ? h('p', { class: 'muted small' }, t('craft.missing')) : !direct ? h('p', { class: 'muted small' }, DK.icon('anvil', 12), ' ', t('craft.chainInfo', { n: plan.steps.length - 1 })) : null),
      h('section', { class: 'cr-block cr-make' },
        h('div', { class: 'stepper' },
          btn({ icon: 'minus', size: 'sm', variant: 'ghost', disabled: times <= 1, onClick: () => ctx.setTimes(times - 1) }),
          h('b', null, 'x' + times),
          btn({ icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => ctx.setTimes(times + 1) }),
          max > 1 ? btn({ label: t('craft.max'), size: 'sm', variant: 'ghost', onClick: () => ctx.setTimes(max) }) : null),
        btn({ icon: 'anvil', label: plan.ok && !direct ? t('craft.makeChain') : t('craft.make', { n: r.qty * times }), variant: 'primary', size: 'lg', disabled: !plan.ok, onClick: doCraft })));
  }

  /* ---------------- Detalle de material ---------------- */
  function materialDetail(id, ctx) {
    const it = D.items[id];
    const uses = C().usesOf(id);
    const src = sources(id);
    return h('div', { class: 'cr-detail stack' },
      h('div', { class: 'cr-detail-head' }, V.itemIcon(it, 34),
        h('div', { class: 'grow' }, h('h3', null, it.name), h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'muted small' }, t('item.owned', { n: DK.bag.count(id) })))),
        ctx.close ? btn({ icon: 'x', size: 'sm', variant: 'ghost', tip: t('common.close'), onClick: ctx.close }) : null),
      h('p', { class: 'muted' }, it.desc),
      h('section', { class: 'cr-block' }, h('h4', null, t('craft.whereGet')),
        src.length ? h('div', { class: 'cr-sources' }, src.map((s) => h('div', { class: 'cr-source' }, DK.icon(s.zone.icon, 14), h('span', null, s.zone.name), h('span', { class: 'muted small' }, t('craft.how.' + s.how)))))
          : h('p', { class: 'muted small' }, sourceText(id))),
      h('section', { class: 'cr-block' }, h('h4', null, t(uses.length === 1 ? 'craft.usedInOne' : 'craft.usedIn', { n: uses.length })),
        h('div', { class: 'cr-list' }, uses.map((r) => recipeRow(r, { onClick: () => ctx.open({ tab: 'recipes', sel: r.id, mat: null }) })))));
  }

  /* ---------------- Filas ---------------- */
  /** Fila de receta: icono · nombre y qué hace · estado. */
  function recipeRow(r, { selected, onClick }) {
    const it = D.items[r.result], s = status(r), goal = C().isFavorite(r.id);
    return h('button', { class: 'cr-row' + (selected ? ' selected' : '') + (s.key === 'ready' ? ' ready' : ''), type: 'button', onClick },
      V.itemIcon(it, 22),
      h('span', { class: 'cr-row-main' }, h('b', null, it.name, goal ? h('span', { class: 'cr-star', tip: t('craft.goal') }, DK.icon('star', 12)) : null), h('span', { class: 'muted small' }, summary(it))),
      h('span', { class: 'cr-status s-' + s.key }, s.key === 'ready' ? t('craft.canN', { n: s.n }) : s.key === 'chain' ? t('craft.chainShort') : t('craft.missingN', { n: s.n })));
  }

  /** Fila de material: icono · nombre y uso · cantidad. */
  function materialRow(id, { selected, onClick }) {
    const it = D.items[id], n = DK.bag.count(id), uses = C().usesOf(id).length;
    return h('button', { class: 'cr-row' + (selected ? ' selected' : '') + (n ? ' have' : ''), type: 'button', onClick },
      V.itemIcon(it, 22),
      h('span', { class: 'cr-row-main' }, h('b', null, it.name), h('span', { class: 'muted small' }, t('craft.usedInShort', { n: uses }) + ' · ' + sourceText(id))),
      h('span', { class: 'cr-qty' + (n ? '' : ' zero') }, 'x' + n));
  }

  /* ---------------- Pantalla ---------------- */
  DK.screens.register('craft', {
    title: () => t('craft.title'), icon: 'anvil', section: 'craft', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.tab = params.tab || 'recipes';
      params.kind = params.kind || 'all';
      params.open = params.open || {};
      const q = (params.q || '').trim().toLowerCase();
      const narrow = DK.ui.isNarrow();
      const set = (o) => { Object.assign(params, o); refresh(); };

      // Abrir un detalle: en escritorio a la derecha; en el móvil, hoja inferior
      const open = (o) => {
        Object.assign(params, o, { times: 1 });
        if (!narrow) { refresh(); return; }
        const holder = h('div');
        let dr;
        const ctx = {
          get times() { return params.times; },
          setTimes: (n) => { params.times = Math.max(1, Math.min(99, n)); draw(); },
          redraw: () => { draw(); refresh(); },
          open: (o2) => { Object.assign(params, o2, { times: 1 }); draw(); holder.closest('.drawer-body') && (holder.closest('.drawer-body').scrollTop = 0); },
        };
        const draw = () => holder.replaceChildren(params.sel ? recipeDetail(C().get(params.sel), ctx) : materialDetail(params.mat, ctx));
        draw();
        dr = DK.ui.drawer({ title: t('craft.title'), icon: 'anvil', size: 'wide', cls: 'cr-sheet', content: holder });
        dr.promise.then(() => { params.sel = null; params.mat = null; if (DK.router.current() && DK.router.current().id === 'craft') refresh(); });
      };

      /* Barra única */
      const kinds = ['all', ...Object.keys(KINDS)];
      const bar = h('div', { class: 'cr-bar' },
        DK.ui.segmented({ value: params.tab, onChange: (v) => set({ tab: v, sel: null, mat: null }),
          options: [{ value: 'recipes', label: t('craft.tabRecipes'), icon: 'anvil' }, { value: 'materials', label: t('craft.tabMaterials'), icon: 'cube' }] }),
        h('input', { class: 'input cr-search', type: 'search', placeholder: params.tab === 'recipes' ? t('craft.search') : t('craft.searchMat'), value: params.q || '',
          onInput: (e) => { params.q = e.target.value; clearTimeout(params._qt); params._qt = setTimeout(() => { refresh(); const i = document.querySelector('.cr-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } }),
        params.tab === 'recipes' ? DK.ui.select({ label: t('craft.type'), value: params.kind, onChange: (v) => set({ kind: v }),
          options: kinds.map((k) => ({ value: k, label: k === 'all' ? t('craft.kind.all') : t('craft.kind.' + k) })) }) : null,
        params.tab === 'recipes' ? btn({ icon: params.only ? 'check' : 'filter', label: t('craft.only'), size: 'sm', variant: params.only ? 'primary' : 'ghost', onClick: () => set({ only: !params.only }) }) : null);

      let body, detail = null;
      if (params.tab === 'recipes') {
        let list = D.recipes.slice();
        if (params.kind !== 'all') list = list.filter((r) => kindOf(r) === params.kind);
        if (params.only) list = list.filter((r) => C().plan(r).ok);
        if (q) list = list.filter((r) => D.items[r.result].name.toLowerCase().includes(q) || Object.keys(r.ingredients).some((id) => D.items[id].name.toLowerCase().includes(q)));
        const ord = (r) => ({ ready: 0, chain: 1, missing: 2 })[status(r).key] * 10 + D.rarities[D.items[r.result].rarity].order;
        list.sort((a, b) => ord(a) - ord(b) || D.items[a.result].name.localeCompare(D.items[b.result].name));
        const row = (r) => recipeRow(r, { selected: params.sel === r.id, onClick: () => (params.sel === r.id && !narrow ? set({ sel: null }) : open({ sel: r.id, mat: null })) });
        const goals = list.filter((r) => C().isFavorite(r.id));
        const section = (id, icon, title, items, defOpen) => {
          if (!items.length) return null;
          const ready = items.filter((r) => status(r).key === 'ready').length;
          const isOpen = params.open[id] != null ? params.open[id] : defOpen || !!q;
          return h('section', { class: 'cr-section' + (isOpen ? ' open' : '') },
            h('button', { class: 'cr-section-head', type: 'button', 'aria-expanded': isOpen, onClick: () => { params.open[id] = !isOpen; refresh(); } },
              DK.icon(icon, 16), h('b', null, title), h('span', { class: 'muted small' }, t('craft.recipesN', { n: items.length })),
              ready ? h('span', { class: 'cr-ready-n' }, t('craft.readyN', { n: ready })) : null,
              h('span', { class: 'grow' }), DK.icon(isOpen ? 'arrowUp' : 'arrowDown', 14)),
            isOpen ? h('div', { class: 'cr-list' }, items.map(row)) : null);
        };
        const sections = [
          goals.length ? section('goals', 'star', t('craft.goals'), goals, true) : null,
          ...Object.keys(KINDS).map((k) => {
            const items = list.filter((r) => kindOf(r) === k);
            return section(k, KINDS[k], t('craft.kind.' + k), items, items.some((r) => status(r).key === 'ready'));
          }),
        ].filter(Boolean);
        body = sections.length ? h('div', { class: 'cr-sections' }, sections) : DK.ui.empty('anvil', t('craft.emptyTitle'), t('craft.emptyText'));
        const sel = params.sel && C().get(params.sel);
        if (sel && !narrow) detail = recipeDetail(sel, { times: params.times, setTimes: (n) => set({ times: Math.max(1, Math.min(99, n)) }), redraw: refresh, open: (o) => open(o), close: () => set({ sel: null }) });
      } else {
        let mats = Object.values(D.items).filter((it) => it.category === 'pieza').map((it) => it.id);
        if (q) mats = mats.filter((id) => D.items[id].name.toLowerCase().includes(q));
        mats.sort((a, b) => (DK.bag.count(b) > 0) - (DK.bag.count(a) > 0) || D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order || D.items[a].name.localeCompare(D.items[b].name));
        body = mats.length ? h('div', { class: 'cr-list' }, mats.map((id) => materialRow(id, { selected: params.mat === id, onClick: () => (params.mat === id && !narrow ? set({ mat: null }) : open({ mat: id, sel: null })) })))
          : DK.ui.empty('cube', t('craft.emptyTitle'), '');
        if (params.mat && !narrow) detail = materialDetail(params.mat, { open: (o) => open(o), close: () => set({ mat: null }) });
      }

      return h('div', { class: 'screen cr-screen' }, bar,
        h('div', { class: 'cr-layout' + (detail ? ' has-detail' : '') }, h('div', { class: 'cr-main' }, body), detail ? h('aside', { class: 'card cr-side' }, detail) : null));
    },
  });
})();
