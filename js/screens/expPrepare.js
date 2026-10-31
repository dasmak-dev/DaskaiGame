/* =============================================================
 * screens/expPrepare.js — Preparar la expedición: elegir qué objetos
 * de la bolsa de casa te llevas en la mochila.
 *
 * Durante la expedición sólo se puede usar lo que va en la mochila
 * (DK.bag trabaja sobre e.pack) y lo que encuentres. La capacidad es
 * DK.expedition.packCapacity() (config + Mejora «Equipaje»).
 *
 * La bolsa de casa sale a la izquierda y la mochila a la derecha: se
 * pasan objetos arrastrándolos o pulsándolos (Mayús = todas las unidades).
 *
 * params: { pack: { id: n }, cat }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);
  const E = () => DK.expedition;

  /** La última mochila, limitada a lo que aún tienes y a lo que cabe. */
  function lastPack() {
    const last = DK.store.state.lastPack || {}, home = DK.bag.home(), out = {};
    let room = E().packCapacity();
    Object.entries(last).forEach(([id, n]) => { const k = Math.min(n, home[id] || 0, room); if (k > 0 && E().canPack(id)) { out[id] = k; room -= k; } });
    return out;
  }

  /** Texto corto de lo que hace un objeto. */
  const effectOf = (it) => (it.use ? V.useText(it) : it.stats ? Object.entries(it.stats).map(([k, v]) => `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`).join(' · ') : it.desc);

  DK.screens.register('expPrepare', {
    title: () => t('pack.title'), icon: 'bag', section: 'battle', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      if (E().active()) { setTimeout(() => DK.router.reset('expedition'), 0); return h('div'); }
      // La mochila empieza vacía: tú decides qué te llevas
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

      // Objetos de casa que se pueden llevar
      const cats = DK.config.expedition.packCategories;
      const sortIds = (ids) => ids.sort((a, b) => cats.indexOf(D.items[a].category) - cats.indexOf(D.items[b].category) || D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order || D.items[a].name.localeCompare(D.items[b].name));
      const all = sortIds(Object.keys(home).filter((id) => home[id] > 0 && E().canPack(id)));
      const shown = all.filter((id) => left(id) > 0 && (params.cat === 'all' || D.items[id].category === params.cat));

      const countIn = (c) => all.filter((id) => c === 'all' || D.items[id].category === c).reduce((a, id) => a + left(id), 0);
      const catChips = V.catButtons([{ id: 'all', icon: 'layers', label: t('pack.all'), count: countIn('all') },
        ...cats.map((c) => ({ id: c, icon: D.categories[c].icon, label: DK.tr('categories', D.categories[c]), count: countIn(c) }))], params.cat, (v) => { params.cat = v; refresh(); });

      /** Casilla de objeto (en la bolsa o en la mochila). Clic = 1 unidad · Mayús+clic = todas. */
      const tile = (id, qty, where) => {
        const it = D.items[id];
        const el = h('button', { class: `prep-tile r-${it.rarity}`, type: 'button',
          tip: `${it.name}\n${effectOf(it)}\n${where === 'bag' ? t('pack.tipAdd') : t('pack.tipRemove')}`,
          onClick: (e) => move(id, (where === 'bag' ? 1 : -1) * (e.shiftKey ? 99 : 1)) },
          V.itemIcon(it, 26), h('span', { class: 'prep-tile-name' }, it.name), h('b', { class: 'prep-tile-qty' }, 'x' + qty));
        // Arrastrar: de la bolsa a la mochila (+1) o de la mochila a la bolsa (-1); con Mayús, todas
        DK.ui.pointerDrag(el, { zones: '.prep-bag, .prep-pack', touch: true, onDrop: (zone, e) => {
          const to = zone.classList.contains('prep-pack') ? 'pack' : 'bag';
          if (to !== where) move(id, (to === 'pack' ? 1 : -1) * (e.shiftKey ? 99 : 1));
        } });
        return el;
      };
      const dropZone = (el) => el;

      const bagPanel = dropZone(h('div', { class: 'panel stack-s prep-bag' },
        h('div', { class: 'panel-head' }, DK.icon('home', 18), h('h3', null, t('pack.bag')), h('span', { class: 'muted small' }, t('pack.bagHint'))),
        catChips,
        shown.length ? h('div', { class: 'prep-grid' }, shown.map((id) => tile(id, left(id), 'bag')))
          : DK.ui.empty('bag', all.length ? t('pack.allPacked') : t('pack.nothing'), all.length ? '' : t('pack.nothingText'))), 'pack', -1);

      // Mochila
      const chosen = Object.entries(pack);
      const pots = DK.camp.value('provisiones');
      const pv = E().preview(), z = D.zones[pv.zone];
      const team = DK.party.active();
      const ok = DK.party.aliveActive().length > 0;
      const go = () => { if (!ok) return; E().start(pack); DK.audio.sfx('select'); DK.router.reset('expedition'); };
      DK.keys.on('Enter', go);

      const last = lastPack();
      const packPanel = dropZone(h('div', { class: 'panel stack-s prep-pack' },
        h('div', { class: 'panel-head' }, DK.icon('bag', 18), h('h3', null, t('pack.backpack')), h('span', { class: 'badge ' + (used >= cap ? 'warn' : '') }, t('pack.cap', { n: used, max: cap }))),
        h('div', { class: 'cap-bar', style: { '--p': Math.min(100, (used / cap) * 100) + '%' } }, h('span')),
        chosen.length ? h('div', { class: 'prep-grid' }, sortIds(chosen.map(([id]) => id)).map((id) => tile(id, pack[id], 'pack')))
          : h('div', { class: 'prep-drop' }, DK.icon('bag', 26), h('b', null, t('pack.empty')), h('span', { class: 'muted small' }, t('pack.dropHint'))),
        pots ? h('p', { class: 'small good-text' }, DK.icon('flask', 13), ' ', t('pack.free', { n: pots })) : null,
        DK.store.state.consolation ? h('div', { class: 'warning good' }, DK.icon('crown', 16), h('span', null, t('pack.consolation'))) : null,
        h('div', { class: 'row gap-s wrap' },
          Object.keys(last).length ? btn({ icon: 'repeat', label: t('pack.repeat'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = last; refresh(); } }) : null,
          btn({ icon: 'sparkles', label: t('pack.suggest'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = E().suggestPack(); refresh(); } }),
          chosen.length ? btn({ icon: 'x', label: t('pack.clear'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = {}; refresh(); } }) : null)), 'bag', 1);

      // Equipo y salida (en el móvil va al final, con un botón fijo abajo)
      const departPanel = h('div', { class: 'panel stack prep-depart' },
        h('div', { class: 'row between gap-s' }, h('b', null, DK.icon('users', 15), ' ', t('pack.team')),
          btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(team)) refresh(); } })),
        h('div', { class: 'list' }, team.map((d) => V.daskaiRow(d, { compact: true }))),
        V.warnings(DK.world.warnings(pv.zone).filter((w) => w.kind !== 'good'), async () => { if (await V.healDialog(team)) refresh(); }),
        h('div', { class: 'prep-go' },
          h('span', { class: 'chip' }, DK.icon(z.icon, 13), t('exp.nextZone', { zone: z.name })),
          btn({ icon: 'flag', label: t('pack.go'), desc: t('pack.goDesc', { n: used }), size: 'lg', variant: 'primary', hotkey: '↵', disabled: !ok, onClick: go }),
          h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('pack.risk'), DK.rules.permadeath() ? ' ' + t('zones.permadeath') : '')));

      return h('div', { class: 'screen prep-screen' },
        h('div', { class: 'card prep-intro' }, h('h2', null, t('pack.title')), h('p', { class: 'muted' }, t('pack.text'))),
        h('div', { class: 'prep-layout' }, bagPanel, packPanel, departPanel),
        h('div', { class: 'prep-sticky' }, btn({ icon: 'flag', label: t('pack.go'), desc: t('pack.goDesc', { n: used }), size: 'lg', variant: 'primary', disabled: !ok, onClick: go })));
    },
  });
})();
