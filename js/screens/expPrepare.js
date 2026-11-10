/* =============================================================
 * screens/expPrepare.js — Piezas para preparar la expedición.
 *
 * Desde la v4.16 la expedición se prepara en la misma pantalla de
 * Batalla (screens/zones.js). Aquí quedan las piezas que usa:
 *   - V.kindPicker / V.kindChip / V.kindEffects: tipo de expedición.
 *   - V.packEditor(params, refresh): Mochila (LISTA de lo que te llevas,
 *     con − / + por objeto) y Tu bolsa (lo que puedes llevar, con filtro
 *     y «+»); también se puede arrastrar entre las dos (ratón o dedo).
 *     Batalla lo abre en un panel deslizante («Elegir objetos»).
 *   - V.lastPack(): la última mochila (para «Repetir»).
 * La pantalla 'expPrepare' sólo redirige a Batalla (enlaces antiguos).
 *
 * Durante la expedición sólo se puede usar lo que va en la mochila
 * (DK.bag trabaja sobre e.pack). Capacidad: DK.expedition.packCapacity().
 * ============================================================= */
(function () {
  /** Orden de los objetos de la mochila: categoría, rareza y nombre. */
  const packOrder = (a, b) => { const D = DK.data, cats = DK.config.expedition.packCategories; return cats.indexOf(D.items[a].category) - cats.indexOf(D.items[b].category) || D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order || D.items[a].name.localeCompare(D.items[b].name); };
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const E = () => DK.expedition;

  /** La última mochila, limitada a lo que aún tienes y a lo que cabe. */
  V.lastPack = lastPack;
  function lastPack() {
    const last = DK.store.state.lastPack || {}, home = DK.bag.home(), out = {};
    let room = E().packCapacity();
    Object.entries(last).forEach(([id, n]) => { const k = Math.min(n, home[id] || 0, room); if (k > 0 && E().canPack(id)) { out[id] = k; room -= k; } });
    return out;
  }

  /** Texto corto de lo que hace un objeto. */
  const effectOf = (it) => (it.use ? V.useText(it) : it.stats ? Object.entries(it.stats).map(([k, v]) => `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`).join(' · ') : it.desc);

  /* ---------- Tipos de expedición (config.expedition.kinds) ---------- */
  /** Chips con lo que cambia un tipo de expedición. */
  V.kindEffects = (k) => {
    const pct = (x) => Math.round(x * 100);
    return [k.sizes && k.sizes.length === 1 && k.sizes[0] === 'short' ? ['flag', t('kind.fx.short')] : null,
      k.capture ? ['orb', t('kind.fx.capture', { n: pct(k.capture) })] : null,
      k.shiny ? ['sparkles', t('kind.fx.shiny', { n: pct(k.shiny) })] : null,
      k.recruit ? ['paw', t('kind.fx.recruit', { n: k.recruit })] : null,
      k.exp ? ['star', t('kind.fx.exp', { n: pct(k.exp) })] : null,
      k.coins ? ['coin', t('kind.fx.coins', { n: (k.coins > 0 ? '+' : '') + pct(k.coins) }), k.coins < 0] : null,
      k.levels ? ['skull', t('kind.fx.levels', { n: k.levels }), true] : null,
      k.emblems ? ['emblem', t('kind.fx.emblems', { n: k.emblems })] : null].filter(Boolean)
      .map(([ic, label, bad]) => h('span', { class: 'chip ' + (bad ? 'neg' : 'pos') }, DK.icon(ic, 12), label));
  };
  /** Chip con el tipo de una expedición. */
  V.kindChip = (kind) => { if (kind === 'abismo') return null; // v5.1: ya lo dice la etiqueta «Abismo · ronda N»
    const k = DK.expedition.kindDef(kind); return h('span', { class: 'chip kind-chip k-' + k.id, tip: t('kind.' + k.id + '.desc') }, DK.icon(k.icon, 13), t('kind.' + k.id + '.name')); };
  /** Selector de tipo de expedición (tarjetas). onPick(id) al elegir uno. */
  V.kindPicker = (current, onPick) => h('div', { class: 'kind-picker', role: 'radiogroup', 'aria-label': t('kind.title') },
    DK.expedition.kinds().map((k) => h('button', { class: 'kind-card k-' + k.id + (k.id === current ? ' on' : '') + (k.locked ? ' locked' : ''), type: 'button', role: 'radio', 'aria-checked': String(k.id === current), disabled: k.locked,
      tip: k.locked ? t('kind.locked') : t('kind.' + k.id + '.desc'), onClick: () => { if (!k.locked && k.id !== current) { DK.audio.sfx('select'); onPick(k.id); } } },
      h('span', { class: 'kind-icon' }, DK.icon(k.locked ? 'lock' : k.icon, 22)),
      h('b', null, t('kind.' + k.id + '.name')),
      h('small', { class: 'kind-desc' }, k.locked ? t('kind.locked') : t('kind.' + k.id + '.desc')),
      h('span', { class: 'chips' }, V.kindEffects(k)))));

  /**
   * Editor de la mochila. params.pack = { id: n } (lo que te llevas),
   * params.cat = filtro de la bolsa. refresh() tras cada cambio.
   * @returns {{ packPanel, bagPanel, goalsPanel, used, cap }}
   */
  V.packEditor = (params, refresh) => {
      params.pack = params.pack || {};
      params.cat = params.cat || 'all';
      const pack = params.pack, home = DK.bag.home();
      const cap = E().packCapacity(), used = E().packSize(pack);
      const left = (id) => (home[id] || 0) - (pack[id] || 0);
      /** Mueve n unidades a la mochila (n<0 las devuelve a la bolsa). */
      const move = (id, n) => {
        const cur = pack[id] || 0;
        const k = Math.max(0, Math.min(cur + n, home[id] || 0, cur + cap - used));
        if (k === cur) { if (n > 0) { DK.audio.sfx('error'); DK.ui.toast(used >= cap ? t('pack.full') : t('pack.noMore'), { icon: 'bag', kind: 'bad' }); } return; }
        if (k) pack[id] = k; else delete pack[id];
        DK.audio.sfx('select'); refresh();
      };
      /* ---------- Mochila (lista) ---------- */
      const cats = DK.config.expedition.packCategories, order = packOrder;
      /** Fila de objeto. where: 'pack' (con − cantidad +) o 'bag' (con disponibles y +). */
      const row = (id, where) => {
        const it = D.items[id];
        const inPack = pack[id] || 0, avail = left(id);
        const el = h('div', { class: `pk-row r-${it.rarity}`, dataset: { id } },
          h('span', { class: 'pk-icon' }, V.itemIcon(it, 22)),
          h('span', { class: 'pk-main' }, h('b', null, it.name), h('span', { class: 'muted small' }, effectOf(it))),
          where === 'pack'
            ? h('span', { class: 'pk-step' },
              h('button', { class: 'pk-btn', type: 'button', 'aria-label': t('pack.less'), onClick: () => move(id, -1) }, DK.icon('minus', 14)),
              h('b', { class: 'pk-qty' }, String(inPack)),
              h('button', { class: 'pk-btn', type: 'button', 'aria-label': t('pack.more'), disabled: !avail || used >= cap, onClick: () => move(id, 1) }, DK.icon('plus', 14)))
            : h('span', { class: 'pk-step' },
              h('span', { class: 'pk-have muted small', tip: t('pack.haveTip') }, 'x' + avail),
              h('button', { class: 'pk-btn add', type: 'button', 'aria-label': t('pack.take'), tip: t('pack.tipAdd2'), disabled: used >= cap, onClick: (e) => move(id, e.shiftKey ? 99 : 1) }, DK.icon('plus', 14))));
        // Arrastrar de una lista a la otra (con el dedo: mantener pulsado)
        DK.ui.pointerDrag(el, { zones: '.pk-bag, .pk-pack', touch: true, onDrop: (zone, e) => {
          const to = zone.classList.contains('pk-pack') ? 'pack' : 'bag';
          if (to !== where) move(id, (to === 'pack' ? 1 : -1) * (e.shiftKey ? 99 : 1));
        } });
        return el;
      };

      const chosen = Object.keys(pack).sort(order);
      const last = lastPack();
      const full = used >= cap;
      const packPanel = h('div', { class: 'panel stack-s pk-pack' },
        h('div', { class: 'panel-head' }, DK.icon('bag', 18), h('h3', null, t('pack.backpack')),
          h('span', { class: 'badge ' + (full ? 'warn' : '') }, t('pack.cap', { n: used, max: cap }))),
        h('div', { class: 'cap-bar' + (full ? ' full' : ''), style: { '--p': Math.min(100, (used / cap) * 100) + '%' } }, h('span')),
        chosen.length ? h('div', { class: 'pk-list' }, chosen.map((id) => row(id, 'pack')))
          : h('div', { class: 'pk-empty' }, DK.icon('bag', 24), h('b', null, t('pack.empty')), h('span', { class: 'muted small' }, t('pack.dropHint2'))),
        h('div', { class: 'pk-actions' },
          Object.keys(last).length ? btn({ icon: 'repeat', label: t('pack.repeat'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => { Object.keys(pack).forEach((k) => delete pack[k]); Object.assign(pack, last); refresh(); } }) : null,
          btn({ icon: 'sparkles', label: t('pack.suggest'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => { Object.keys(pack).forEach((k) => delete pack[k]); Object.assign(pack, E().suggestPack()); refresh(); } }),
          chosen.length ? btn({ icon: 'x', label: t('pack.clear'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => { Object.keys(pack).forEach((k) => delete pack[k]); refresh(); } }) : null));

      /* ---------- Bolsa (lista con filtro) ---------- */
      const all = Object.keys(home).filter((id) => home[id] > 0 && E().canPack(id)).sort(order);
      const countIn = (c) => all.filter((id) => c === 'all' || D.items[id].category === c).reduce((a, id) => a + left(id), 0);
      const filters = h('div', { class: 'pk-filters', role: 'tablist' }, [['all', 'layers', t('pack.all')], ...cats.map((c) => [c, D.categories[c].icon, DK.tr('categories', D.categories[c])])].map(([id, icon, label]) =>
        h('button', { class: 'pk-filter' + (params.cat === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.cat === id, onClick: () => { params.cat = id; refresh(); } },
          DK.icon(icon, 14), h('span', null, label), h('b', null, String(countIn(id))))));
      const shown = all.filter((id) => left(id) > 0 && (params.cat === 'all' || D.items[id].category === params.cat));
      const bagPanel = h('div', { class: 'panel stack-s pk-bag' },
        h('div', { class: 'panel-head' }, DK.icon('home', 18), h('h3', null, t('pack.bag')), h('span', { class: 'muted small' }, t('pack.bagHint2'))),
        filters,
        shown.length ? h('div', { class: 'pk-list' }, shown.map((id) => row(id, 'bag')))
          : DK.ui.empty('bag', all.length ? t('pack.allPacked') : t('pack.nothing'), all.length ? '' : t('pack.nothingText')));

      /* ---------- Objetivos de crafteo: qué materiales buscar ---------- */
      const needs = Object.entries(DK.crafting.goalNeeds());
      const goalsPanel = DK.crafting.goals().length ? h('div', { class: 'panel stack-s brief-goals' },
        h('div', { class: 'panel-head' }, DK.icon('star', 18), h('h3', null, t('craft.goals')),
          h('span', { class: 'grow' }), btn({ icon: 'craftCog', label: t('nav.craft'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => DK.router.go('craft') })),
        needs.length ? h('div', { class: 'pk-list' }, needs.map(([id, n]) => h('div', { class: 'pk-row r-' + D.items[id].rarity },
          h('span', { class: 'pk-icon' }, V.itemIcon(D.items[id], 20)),
          h('span', { class: 'pk-main' }, h('b', null, D.items[id].name), h('span', { class: 'muted small' }, V.craftSourceText ? V.craftSourceText(id) : '')),
          h('b', { class: 'goal-miss' }, t('craft.needMore', { n })))))
          : h('div', { class: 'warning good' }, DK.icon('check', 16), h('span', null, t('craft.goalsAllReady')))) : null;

      return { packPanel, bagPanel, goalsPanel, used, cap };
  };

  /**
   * v5.2: ventana centrada para elegir la mochila. Arriba, la mochila como una fila de huecos (uno por
   * objeto: se ve de un vistazo cuánto cabe y qué llevas; pulsar uno lo devuelve) con Sugerir / Repetir /
   * Vaciar; debajo, tu bolsa en tarjetas con filtros por categoría y buscador: pulsar = 1 más, Mayús = todos
   * los que quepan, y el «−» de la tarjeta lo quita. params.pack = { id: n }.
   */
  V.packModal = (params, onChange) => {
    params.pack = params.pack || {};
    params.cat = params.cat || 'all';
    let q = '';
    return DK.ui.modal({
      title: t('pack.chooseTitle'), icon: 'bag', size: 'wide', cls: 'pm-modal',
      content: (close) => {
        const box = h('div', { class: 'pm-body' });
        const draw = () => {
          const pack = params.pack, home = DK.bag.home(), cap = E().packCapacity(), used = E().packSize(pack);
          const left = (id) => (home[id] || 0) - (pack[id] || 0);
          const move = (id, n) => {
            const cur = pack[id] || 0, k = Math.max(0, Math.min(cur + n, home[id] || 0, cur + cap - E().packSize(pack)));
            if (k === cur) { if (n > 0) { DK.audio.sfx('error'); DK.ui.toast(E().packSize(pack) >= cap ? t('pack.full') : t('pack.noMore'), { icon: 'bag', kind: 'bad' }); } return; }
            if (k) pack[id] = k; else delete pack[id];
            DK.audio.sfx(n > 0 ? 'select' : 'click'); draw(); onChange && onChange();
          };
          const setAll = (o) => { Object.keys(pack).forEach((k) => delete pack[k]); Object.assign(pack, o); DK.audio.sfx('select'); draw(); onChange && onChange(); };
          const cats = DK.config.expedition.packCategories, order = packOrder;
          // Huecos de la mochila: uno por unidad
          const units = Object.keys(pack).sort(order).flatMap((id) => Array(pack[id]).fill(id));
          const slots = h('div', { class: 'pm-slots', style: { '--n': cap } }, Array.from({ length: cap }, (_, i) => {
            const id = units[i]; if (!id) return h('span', { class: 'pm-slot empty' });
            const it = D.items[id];
            return h('button', { class: 'pm-slot r-' + it.rarity, type: 'button', tip: `${it.name} · ${effectOf(it)}\n${t('pack.slotRemove')}`, 'aria-label': t('pack.tapRemove', { name: it.name }), onClick: () => move(id, -1) }, V.itemIcon(it, 26));
          }));
          const last = lastPack();
          const head = h('div', { class: 'pm-head' },
            h('div', { class: 'pm-cap' }, DK.icon('bag', 18), h('b', null, t('pack.backpack')), h('span', { class: 'pm-capn' + (used >= cap ? ' full' : '') }, `${used}/${cap}`)),
            h('div', { class: 'pm-tools' },
              btn({ icon: 'sparkles', label: t('pack.suggest'), size: 'sm', variant: 'ghost', onClick: () => setAll(E().suggestPack()) }),
              Object.keys(last).length ? btn({ icon: 'repeat', label: t('pack.repeat'), size: 'sm', variant: 'ghost', onClick: () => setAll(last) }) : null,
              used ? btn({ icon: 'x', label: t('pack.clear'), size: 'sm', variant: 'ghost', onClick: () => setAll({}) }) : null));
          // Bolsa
          const all = Object.keys(home).filter((id) => home[id] > 0 && E().canPack(id)).sort(order);
          const countIn = (c) => all.filter((id) => c === 'all' || D.items[id].category === c).length;
          const filters = h('div', { class: 'pm-filters', role: 'tablist' }, [['all', 'layers', t('pack.all')], ...cats.map((c) => [c, D.categories[c].icon, DK.tr('categories', D.categories[c])])].filter(([id]) => id === 'all' || countIn(id)).map(([id, icon, label]) =>
            h('button', { class: 'pm-filter' + (params.cat === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.cat === id, onClick: () => { params.cat = id; draw(); } }, DK.icon(icon, 14), h('span', null, label), h('b', null, String(countIn(id))))));
          const search = h('label', { class: 'pm-search' }, DK.icon('search', 14), h('input', { type: 'search', placeholder: t('pack.search'), value: q, onInput: (e) => { q = e.target.value; const pos = e.target.selectionStart; draw(); const inp = box.querySelector('.pm-search input'); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); } } }));
          const qq = q.trim().toLowerCase();
          const shown = all.filter((id) => (params.cat === 'all' || D.items[id].category === params.cat) && (!qq || D.items[id].name.toLowerCase().includes(qq) || String(effectOf(D.items[id])).toLowerCase().includes(qq)));
          const card = (id) => { const it = D.items[id], inP = pack[id] || 0, av = left(id);
            return h('div', { class: 'pm-card r-' + it.rarity + (inP ? ' in' : '') + (!av ? ' out' : '') },
              h('button', { class: 'pm-card-main', type: 'button', disabled: !av || used >= cap, tip: t('pack.tipAdd2'), onClick: (e) => move(id, e.shiftKey ? 99 : 1) },
                h('span', { class: 'pm-ico' }, V.itemIcon(it, 30)),
                h('span', { class: 'pm-txt' }, h('b', null, it.name), h('small', null, effectOf(it))),
                h('span', { class: 'pm-have', tip: t('pack.haveTip') }, '×' + av)),
              inP ? h('span', { class: 'pm-in' }, h('button', { type: 'button', 'aria-label': t('pack.less'), onClick: () => move(id, -1) }, DK.icon('minus', 12)), h('b', null, t('pack.inPack', { n: inP }))) : null); };
          box.replaceChildren(
            h('div', { class: 'pm-top' }, head, slots, h('small', { class: 'muted pm-hint' }, t('pack.modalHint'))),
            h('div', { class: 'pm-bar' }, filters, search),
            shown.length ? h('div', { class: 'pm-grid' }, shown.map(card)) : DK.ui.empty('bag', all.length ? t('pack.noMatch') : t('pack.nothing'), all.length ? '' : t('pack.nothingText')),
            h('div', { class: 'pm-foot' }, btn({ icon: 'check', label: t('pack.done', { n: used, max: cap }), variant: 'primary', onClick: () => close(true) })));
        };
        draw();
        return box;
      },
    });
  };

  // Enlaces antiguos a «Preparar»: ahora todo está en Batalla
  DK.screens.register('expPrepare', {
    title: () => t('pack.title'), icon: 'bag', section: 'battle', music: 'menu', nav: false,
    render() { setTimeout(() => DK.router.reset(E().active() ? 'expedition' : 'zones'), 0); return h('div'); },
  });
})();
