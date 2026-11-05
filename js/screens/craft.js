/* =============================================================
 * screens/craft.js — Crafteo: fabricar objetos con los materiales que
 * traes de las expediciones (data/recipes.js, DK.crafting).
 *
 * Mesa de trabajo:
 *   - Pestañas Consumibles | Equipo | Materiales, filtros por tipo, objetivos,
 *     «Sólo las que puedo» y buscador.
 *   - Fichas de receta en cuadrícula: icono, nombre, estado (lista / con pasos /
 *     falta 1 / faltan N) y sus materiales con tienes/necesitas (verde o rojo).
 *     Primero las que puedes hacer; las lejanas, atenuadas.
 *   - A la derecha (hoja inferior en el móvil), la receta elegida: efecto,
 *     materiales en huecos con dónde se consigue cada uno (zona con «Ir →»
 *     que te lleva a Batalla con esa zona elegida), cantidad y «Forjar».
 *   - Objetivos (estrella, DK.crafting favoritas): lo que les falta sale al
 *     preparar la expedición y en «Qué hacer ahora»; avisan cuando están listos.
 *   - Al fabricar equipo se ofrece ponérselo a un daskai (V.equipChooser),
 *     viendo cómo le cambian los atributos.
 *
 * params: { tab: 'consum'|'equip'|'materials' ('recipes' = la de la receta), sub, q, only, sel, mat, times }
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
    id: 'craft', icon: 'craftCog', order: 32, screen: 'craft', label: () => t('nav.craft'),
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

  /* ---------------- Mesa de trabajo (detalle de receta) ---------------- */
  const GROUPS = { consum: ['consumable', 'tonic'], equip: ['move', 'passive', 'stats'] };
  const groupOf = (r) => (GROUPS.equip.includes(kindOf(r)) ? 'equip' : 'consum');
  const inExp = () => !!DK.expedition.active();

  /** Chips de zona donde cae un material (las abiertas llevan «Ir»). */
  function sourceChips(id, missing) {
    const src = sources(id);
    if (!src.length) return h('div', { class: 'wb-src' }, h('span', { class: 'wb-zone none' }, DK.icon(C().recipeFor(id) ? 'craftCog' : 'gift', 11), C().recipeFor(id) ? t('craft.craftable') : t('craft.rare')));
    return h('div', { class: 'wb-src' }, src.slice(0, 4).map((s) => {
      const open = DK.world.isUnlocked(s.zone.id), how = s.how !== 'wild' ? ` (${t('craft.how.' + s.how)})` : '';
      if (!open) return h('span', { class: 'wb-zone lock', tip: t('craft.zoneLocked') }, DK.icon('lock', 11), s.zone.name + how);
      return h('button', { class: 'wb-zone go' + (missing ? ' need' : ''), type: 'button', disabled: inExp(), tip: inExp() ? t('craft.goExp') : t('craft.goTip', { zone: s.zone.name }),
        onClick: () => DK.router.reset('zones', { zone: s.zone.id }) },
        DK.icon(s.zone.icon, 11), s.zone.name + how, missing && !inExp() ? h('b', null, ' · ' + t('craft.go') + ' →') : null);
    }));
  }

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
      // Equipo recién forjado: se ofrece equiparlo (también con el botón «Equipar» del detalle)
      if (it.category === 'equipo' && DK.party.active().length) { await V.equipChooser(it.id); ctx.redraw(); }
    };
    const canEquip = it.category === 'equipo' && DK.bag.count(it.id) > 0 && DK.party.active().length > 0;

    // Qué hace
    const what = [];
    if (it.grants && it.grants.move) what.push(V.moveCard(it.grants.move, { compact: true }));
    if (it.grants && it.grants.passive) what.push(V.passiveBox(it.grants.passive));
    const eff = it.stats ? Object.entries(it.stats).map(([k, v]) => h('span', { class: 'wb-eff' + (v < 0 ? ' neg' : '') }, `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`)) : [];
    if (it.use) eff.push(h('span', { class: 'wb-eff' }, V.useText(it)));

    // Materiales en huecos: tienes / necesitas y dónde conseguirlo
    const missing = [];
    const slots = h('div', { class: 'wb-slots' }, Object.entries(r.ingredients).map(([id, n]) => {
      const have = DK.bag.count(id), need = n * times, ok = have >= need;
      if (!ok) missing.push(`${need - have} ${D.items[id].name}`);
      const sub = C().recipeFor(id);
      return h('div', { class: 'wb-slot' + (ok ? ' ok' : ' no') },
        V.itemIcon(D.items[id], 24),
        h('div', { class: 'wb-slot-main' }, h('b', null, D.items[id].name), sourceChips(id, !ok)),
        h('div', { class: 'wb-slot-end' },
          h('span', { class: 'wb-count ' + (ok ? 'ok' : 'no') }, `${have}/${need}`),
          sub && !ok ? h('button', { class: 'wb-sub', type: 'button', tip: t('craft.open'), onClick: () => ctx.open({ sel: sub.id, mat: null }) }, DK.icon('craftCog', 12), t('craft.subShort')) : null));
    }));

    return h('div', { class: 'wb-detail' },
      h('div', { class: 'wb-res' }, V.itemIcon(it, 38),
        h('div', { class: 'grow' }, h('h3', null, it.name),
          h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'muted small' }, t('craft.kind.' + kind) + ' · ' + t('item.owned', { n: DK.bag.count(it.id) })))),
        h('button', { class: 'cr-goal' + (goal ? ' on' : ''), type: 'button', tip: goal ? t('craft.goalOff') : t('craft.goalOn'), 'aria-pressed': goal,
          onClick: () => { const on = C().toggleFavorite(r.id); toast(on ? t('craft.goalAdded', { item: it.name }) : t('craft.goalRemoved', { item: it.name }), { icon: 'star', kind: on ? 'good' : '' }); ctx.redraw(); } },
          DK.icon('star', 16), h('span', null, goal ? t('craft.goal') : t('craft.goalShort'))),
        ctx.close ? h('button', { class: 'icon-btn', type: 'button', tip: t('common.close'), 'aria-label': t('common.close'), onClick: ctx.close }, DK.icon('x', 16)) : null),
      it.desc ? h('p', { class: 'muted small wb-desc' }, it.desc) : null,
      eff.length ? h('div', { class: 'wb-effs' }, eff) : null,
      what,
      h('div', { class: 'wb-h' }, DK.icon('craftCog', 13), t('craft.ingredients')),
      slots,
      missing.length && !plan.ok ? h('p', { class: 'wb-note' }, DK.icon('info', 13), t('craft.missingNote', { list: missing.join(', ') })) : null,
      plan.ok && !direct ? h('p', { class: 'wb-note chain' }, DK.icon('craftCog', 13), t('craft.chainInfo', { n: plan.steps.length - 1 })) : null,
      canEquip ? h('div', { class: 'wb-equip' }, DK.icon('check', 13), h('span', { class: 'grow small' }, t('item.owned', { n: DK.bag.count(it.id) })),
        btn({ icon: 'gem', label: t('inv.equip'), size: 'sm', variant: 'tone', cls: 'wb-equip-btn', onClick: async () => { await V.equipChooser(it.id); ctx.redraw(); } })) : null,
      h('div', { class: 'wb-foot' },
        h('div', { class: 'wb-qty' },
          h('button', { type: 'button', 'aria-label': '−', disabled: times <= 1, onClick: () => ctx.setTimes(times - 1) }, DK.icon('minus', 14)),
          h('b', null, String(times)),
          h('button', { type: 'button', 'aria-label': '+', onClick: () => ctx.setTimes(times + 1) }, DK.icon('plus', 14)),
          max > 1 ? h('button', { type: 'button', class: 'wb-max', onClick: () => ctx.setTimes(max) }, t('craft.max')) : null),
        btn({ icon: 'hammer', label: plan.ok && !direct ? t('craft.makeChain') : t('craft.forge', { n: r.qty * times }), variant: 'primary', size: 'lg', cls: 'wb-forge', disabled: !plan.ok, onClick: doCraft })));
  }

  /* ---------------- Detalle de material ---------------- */
  function materialDetail(id, ctx) {
    const it = D.items[id];
    const uses = C().usesOf(id);
    return h('div', { class: 'wb-detail' },
      h('div', { class: 'wb-res' }, V.itemIcon(it, 38),
        h('div', { class: 'grow' }, h('h3', null, it.name), h('div', { class: 'row gap-s wrap' }, V.rarity(it.rarity), h('span', { class: 'muted small' }, t('item.owned', { n: DK.bag.count(id) })))),
        ctx.close ? h('button', { class: 'icon-btn', type: 'button', tip: t('common.close'), 'aria-label': t('common.close'), onClick: ctx.close }, DK.icon('x', 16)) : null),
      h('p', { class: 'muted small wb-desc' }, it.desc),
      h('div', { class: 'wb-h' }, DK.icon('map', 13), t('craft.whereGet')),
      sourceChips(id, true),
      h('div', { class: 'wb-h' }, DK.icon('craftCog', 13), t(uses.length === 1 ? 'craft.usedInOne' : 'craft.usedIn', { n: uses.length })),
      h('div', { class: 'wb-grid mini' }, uses.map((r) => recipeTile(r, { onClick: () => ctx.open({ tab: groupOf(r), sel: r.id, mat: null }) }))));
  }

  /* ---------------- Fichas ---------------- */
  /** Ficha de receta: icono, nombre, estado y sus materiales con tienes/necesitas. */
  function recipeTile(r, { selected, onClick }) {
    const it = D.items[r.result], s = status(r), goal = C().isFavorite(r.id);
    const tag = s.key === 'ready' ? h('span', { class: 'wb-tag ok' }, DK.icon('check', 10), t('craft.readyTag', { n: s.n }))
      : s.key === 'chain' ? h('span', { class: 'wb-tag chain' }, DK.icon('craftCog', 10), t('craft.chainShort'))
        : h('span', { class: 'wb-tag ' + (s.n === 1 ? 'near' : 'far') }, t(s.n === 1 ? 'craft.missingOne' : 'craft.missingN', { n: s.n }));
    return h('button', { class: 'wb-tile s-' + s.key + (s.key === 'missing' && s.n > 1 ? ' far' : '') + (selected ? ' sel' : ''), type: 'button', 'aria-pressed': selected ? 'true' : 'false', onClick },
      goal ? h('span', { class: 'wb-star', tip: t('craft.goal') }, DK.icon('star', 12)) : null,
      h('span', { class: 'wb-top' }, V.itemIcon(it, 20), h('span', { class: 'wb-name' }, h('b', null, it.name), tag)),
      // v4.42: en vez de la lista de materiales, una barra fina con lo que ya tienes (el detalle los enseña)
      (() => { const ing = Object.entries(r.ingredients), tot = ing.reduce((a, [, n]) => a + n, 0), got = ing.reduce((a, [id, n]) => a + Math.min(n, DK.bag.count(id)), 0);
        return h('span', { class: 'wb-prog', tip: ing.map(([id, n]) => `${D.items[id].name} ${DK.bag.count(id)}/${n}`).join(' · ') }, h('i', { style: { width: Math.round((got / Math.max(1, tot)) * 100) + '%' } })); })());
  }

  /** Ficha de material: icono, nombre, cuántos tienes y en cuántas recetas se usa. */
  function materialTile(id, { selected, onClick }) {
    const it = D.items[id], n = DK.bag.count(id), uses = C().usesOf(id).length;
    return h('button', { class: 'wb-tile mat' + (n ? ' have' : ' far') + (selected ? ' sel' : ''), type: 'button', onClick },
      h('span', { class: 'wb-top' }, V.itemIcon(it, 20), h('span', { class: 'wb-name' }, h('b', null, it.name), h('span', { class: 'muted small' }, t('craft.usedInShort', { n: uses })))),
      h('span', { class: 'wb-qty-big' + (n ? '' : ' zero') }, '×' + n));
  }

  /* ---------------- Forja rúnica: fundir 3 runas en una del tier siguiente ---------------- */
  function runeForge(refresh) {
    const R = DK.runes;
    const bases = R.defs().filter((r) => !r.late || DK.endgame.late() || R.tiersOf(r.id).some((id) => R.countKey(id)));
    return h('div', { class: 'stack' },
      h('p', { class: 'muted small' }, DK.icon('info', 13), ' ', t('forge.help', { a: R.fuseCost(R.withTier('oro', 1)), b: R.fuseCost(R.withTier('oro', 2)) })),
      h('div', { class: 'forge-grid' }, bases.map((r) => h('div', { class: 'forge-card' },
        h('div', { class: 'forge-head' }, V.runeGem(r.id, 44), h('div', null, h('b', null, V.runeName(r.id)), h('small', { class: 'muted' }, V.runeEffect(r.id)))),
        h('div', { class: 'forge-tiers' }, R.tiersOf(r.id).map((id, i) => {
          const n = R.countKey(id), next = i < 2 ? R.tiersOf(r.id)[i + 1] : null;
          // Desglose por rareza (normal · mágica · rara)
          const byR = { n: 0, m: 0, r: 0 }; R.idsOfKey(id).forEach((x) => { byR[R.parse(x).rarity] += R.count(x); });
          return h('div', { class: 'forge-tier' + (n ? '' : ' none') },
            V.runeGem(id, 30, { dim: !n }), h('span', null, h('b', null, '×' + n), h('small', null, V.runeEffect(id)),
              n ? h('small', { class: 'forge-rar' }, ['n', 'm', 'r'].filter((k) => byR[k]).map((k) => h('span', { class: 'rr-' + k }, byR[k] + ' ' + t('rune.rar.' + k)))) : null),
            next ? btn({ icon: 'merge', label: t('forge.fuse', { cost: R.fuseCost(id) }), size: 'sm', variant: R.canFuse(id) ? 'primary' : 'ghost', disabled: !R.canFuse(id),
              tip: R.parse(id).tier >= R.maxTier() ? t('forge.tierLocked', { n: R.roman(next) }) : R.freeKey(id) < 3 ? t('forge.need', { n: 3 - R.freeKey(id) }) : DK.wallet.get() < R.fuseCost(id) ? t('forge.noCoins') : t('forge.tip', { name: V.runeName(next) }),
              onClick: () => { const got = R.fuse(id); if (got) { DK.audio.sfx('craft'); DK.ui.toast(t('forge.done', { name: V.runeName(got) }), { icon: 'rune', kind: 'good' }); refresh(); } } }) : null);
        }))))));
  }

  /* ---------------- Pantalla ---------------- */
  DK.screens.register('craft', {
    title: () => t('craft.title'), icon: 'craftCog', section: 'craft', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      // Compatibilidad: 'recipes' → la pestaña de la receta elegida
      if (!params.tab || params.tab === 'recipes') { const r0 = params.sel && C().get(params.sel); params.tab = r0 ? groupOf(r0) : 'equip'; }
      params.sub = params.sub || 'all';
      const q = (params.q || '').trim().toLowerCase();
      const narrow = DK.ui.isNarrow();
      const set = (o) => { Object.assign(params, o); refresh(); };

      // Abrir un detalle: en escritorio, la mesa de la derecha; en el móvil, hoja inferior
      const open = (o) => {
        if (!narrow && ((o.sel && o.sel === params.sel) || (o.mat && o.mat === params.mat))) { set({ sel: null, mat: null }); return; }
        Object.assign(params, o, { times: 1 });
        if (!narrow) { refresh(); return; }
        const holder = h('div');
        const ctx = {
          get times() { return params.times; },
          setTimes: (n) => { params.times = Math.max(1, Math.min(99, n)); draw(); },
          redraw: () => { draw(); refresh(); },
          open: (o2) => { Object.assign(params, o2, { times: 1 }); draw(); holder.closest('.drawer-body') && (holder.closest('.drawer-body').scrollTop = 0); },
        };
        const draw = () => holder.replaceChildren(params.sel ? recipeDetail(C().get(params.sel), ctx) : materialDetail(params.mat, ctx));
        draw();
        const dr = DK.ui.drawer({ title: t('craft.title'), icon: 'craftCog', size: 'wide', cls: 'cr-sheet', content: holder });
        dr.promise.then(() => { params.sel = null; params.mat = null; if (DK.router.current() && DK.router.current().id === 'craft') refresh(); });
      };

      const isMat = params.tab === 'materials';
      const count = (g) => D.recipes.filter((r) => groupOf(r) === g).length;
      const readyIn = (g) => D.recipes.filter((r) => groupOf(r) === g && status(r).key === 'ready').length;
      const tab = (id, icon, label, n, ready) => h('button', { class: 'wb-tabbtn' + (params.tab === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(params.tab === id),
        onClick: () => set({ tab: id, sub: 'all', sel: null, mat: null }) }, DK.icon(icon, 15), h('span', null, label), h('small', null, String(n)), ready ? h('i', { class: 'wb-ready', tip: t('craft.readyN', { n: ready }) }, ready) : null);
      const tabsEl = () => h('div', { class: 'wb-tabs', role: 'tablist' },
        tab('consum', 'potion', t('craft.tabConsum'), count('consum'), readyIn('consum')),
        tab('equip', 'gem', t('craft.tabEquip'), count('equip'), readyIn('equip')),
        tab('materials', 'cube', t('craft.tabMaterials'), Object.values(D.items).filter((it) => it.category === 'pieza' && !D.isHidden(it.id)).length),
        DK.runes.total() ? tab('runes', 'rune', t('craft.tabRunes'), DK.runes.total(), DK.runes.defs().filter((r) => DK.runes.canFuse(r.id) || DK.runes.canFuse(DK.runes.withTier(r.id, 2))).length) : null);
      if (params.tab === 'runes') return h('div', { class: 'screen cr-screen wb runes-only' }, h('div', { class: 'wb-main' }, tabsEl(), runeForge(refresh)));
      // v4.42: filtros compactos (iconos con tooltip), «sólo las que puedo» y la búsqueda como botones de icono
      const search = params.searchOpen || q ? h('input', { class: 'input wb-search', type: 'search', placeholder: isMat ? t('craft.searchMat') : t('craft.search'), value: params.q || '',
        onInput: (e) => { params.q = e.target.value; clearTimeout(params._qt); params._qt = setTimeout(() => { refresh(); const i = document.querySelector('.wb-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } }) : null;
      const subs = isMat ? [] : ['all', ...GROUPS[params.tab], 'goals'];
      const subLabel = (v) => (v === 'all' ? t('craft.sub.all') : v === 'goals' ? t('craft.goals') : t('craft.kind.' + v));
      const chip = (v) => h('button', { class: 'wb-chip' + (v === 'all' ? '' : ' ico') + (params.sub === v ? ' on' : ''), type: 'button', tip: v === 'all' ? null : subLabel(v), 'aria-label': subLabel(v), onClick: () => set({ sub: v }) },
        v === 'all' ? subLabel(v) : DK.icon(v === 'goals' ? 'star' : KINDS[v], 14));
      const filters = h('div', { class: 'wb-filters' },
        subs.length ? h('div', { class: 'wb-chipset' }, subs.map(chip)) : null,
        search, h('span', { class: 'grow' }),
        isMat ? null : btn({ icon: params.only ? 'check' : 'filter', label: t('craft.onlyMine'), iconOnly: true, size: 'sm', variant: params.only ? 'tone' : 'ghost', onClick: () => set({ only: !params.only }) }),
        btn({ icon: 'search', label: isMat ? t('craft.searchMat') : t('craft.search'), iconOnly: true, size: 'sm', variant: params.searchOpen || q ? 'tone' : 'ghost',
          onClick: () => { params.searchOpen = !params.searchOpen; if (!params.searchOpen) params.q = ''; refresh(); if (params.searchOpen) setTimeout(() => { const i = document.querySelector('.wb-search'); if (i) i.focus(); }, 30); } }));

      let body, detail = null;
      if (!isMat) {
        let list = D.recipes.filter((r) => groupOf(r) === params.tab);
        if (params.sub === 'goals') list = list.filter((r) => C().isFavorite(r.id));
        else if (params.sub !== 'all') list = list.filter((r) => kindOf(r) === params.sub);
        if (params.only) list = list.filter((r) => C().plan(r).ok);
        if (q) list = list.filter((r) => D.items[r.result].name.toLowerCase().includes(q) || Object.keys(r.ingredients).some((id) => D.items[id].name.toLowerCase().includes(q)));
        // Primero lo que puedes hacer, luego lo que necesita un solo material más
        const ord = (r) => { const st = status(r); return (st.key === 'ready' ? 0 : st.key === 'chain' ? 1 : st.n === 1 ? 2 : 3) * 10 + D.rarities[D.items[r.result].rarity].order; };
        list.sort((a, b) => ord(a) - ord(b) || D.items[a.result].name.localeCompare(D.items[b.result].name));
        // v4.42: el detalle sólo se abre al pulsar una receta (no se elige la primera sola)
        if (params.sel && !list.some((r) => r.id === params.sel)) params.sel = null;
        body = list.length ? h('div', { class: 'wb-grid' }, list.map((r) => recipeTile(r, { selected: params.sel === r.id, onClick: () => open({ sel: r.id, mat: null }) })))
          : DK.ui.empty('craftCog', t('craft.emptyTitle'), t('craft.emptyText'));
        const sel = params.sel && C().get(params.sel);
        if (sel && !narrow) detail = recipeDetail(sel, { times: params.times, setTimes: (n) => set({ times: Math.max(1, Math.min(99, n)) }), redraw: refresh, open: (o) => open(o) });
      } else {
        let mats = Object.values(D.items).filter((it) => it.category === 'pieza' && !D.isHidden(it.id)).map((it) => it.id);
        if (q) mats = mats.filter((id) => D.items[id].name.toLowerCase().includes(q));
        mats.sort((a, b) => (DK.bag.count(b) > 0) - (DK.bag.count(a) > 0) || D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order || D.items[a].name.localeCompare(D.items[b].name));
        body = mats.length ? h('div', { class: 'wb-grid' }, mats.map((id) => materialTile(id, { selected: params.mat === id, onClick: () => open({ mat: id, sel: null }) })))
          : DK.ui.empty('cube', t('craft.emptyTitle'), '');
        if (params.mat && !narrow) detail = materialDetail(params.mat, { open: (o) => open(o) });
      }

      const shownBefore = params._shown; params._shown = detail ? (params.sel || params.mat) : null;
      return h('div', { class: 'screen cr-screen wb' + (detail ? ' has-detail' : '') },
        h('div', { class: 'wb-main' }, tabsEl(), filters, body),
        // v4.46: la entrada animada sólo al abrir otro detalle (al forjar se repinta sin parpadear)
        detail ? h('aside', { class: 'wb-side' + ((params.sel || params.mat) !== shownBefore ? ' fresh' : '') },
          h('button', { class: 'icon-btn wb-side-x', type: 'button', tip: t('common.close'), 'aria-label': t('common.close'), onClick: () => set({ sel: null, mat: null }) }, DK.icon('x', 16)),
          detail) : null);
    },
  });
})();
