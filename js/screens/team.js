/* =============================================================
 * screens/team.js — Equipo.
 *
 *  ┌ Colección ────────────────────┬── Ficha del seleccionado ───┐
 *  │ Equipo de batalla (4 huecos)  │                              │
 *  │ Reserva (cuadrícula)          │                              │
 *  │ Caídos (plegable)             │                              │
 *  └───────────────────────────────┴──────────────────────────────┘
 *  El buscador y los filtros están ocultos: botón «Buscar» (o tecla /).
 * En móvil la ficha se abre en un panel deslizante.
 * Clic derecho / pulsación larga en un daskai → menú de acciones rápidas.
 * Flechas ↑ ↓ cambian el daskai seleccionado.
 *
 * params: { uid, panel: {tab, open}, q, houses, sort, wounded, nature, passive, compare, search, graves }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);

  DK.menus.add('nav', { id: 'team', icon: 'users', order: 20, expedition: true, pin: true, screen: 'team', label: () => t('nav.team'), badge: () => (DK.party.all().some((d) => DK.daskai.canEvolve(d)) ? '!' : '') });

  /** Aplica búsqueda, filtros y orden a la colección. */
  function filtered(params) {
    const q = (params.q || '').trim().toLowerCase();
    const houses = params.houses || [];
    let list = DK.party.all().filter((d) => {
      const sp = DK.daskai.species(d);
      if (q && !DK.daskai.name(d).toLowerCase().includes(q) && !sp.name.toLowerCase().includes(q)) return false;
      if (houses.length && !houses.includes(sp.house)) return false;
      if (params.wounded && DK.daskai.hpPct(d) >= 1 && !d.status) return false;
      if (params.nature && d.nature !== params.nature) return false;
      if (params.passive && d.passive !== params.passive) return false;
      return true;
    });
    const sorters = {
      level: (a, b) => b.level - a.level,
      name: (a, b) => DK.daskai.name(a).localeCompare(DK.daskai.name(b)),
      house: (a, b) => DK.daskai.species(a).house.localeCompare(DK.daskai.species(b).house) || b.level - a.level,
      hp: (a, b) => DK.daskai.hpPct(a) - DK.daskai.hpPct(b),
      recent: () => 0,
    };
    list = list.slice().sort(sorters[params.sort || 'level']);
    if (params.sort === 'recent') list.reverse();
    return list;
  }

  DK.screens.register('team', {
    title: () => t('team.title'), icon: 'users', section: 'team', tutorial: 'team', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.houses = params.houses || [];
      params.panel = params.panel || {};
      const active = DK.party.active();
      const list = filtered(params);
      // No se abre ninguna ficha por defecto: sólo al pulsar un daskai
      if (params.uid && !DK.party.get(params.uid)) params.uid = null;

      /** Abre la ficha de un daskai (panel derecho o deslizante en móvil). */
      /** Anterior / siguiente de la lista (flechas y deslizar en la ficha). */
      const neighbor = (uid, dir) => { const l = filtered(params); const i = l.findIndex((d) => d.uid === uid); return l.length ? l[(i + dir + l.length) % l.length] : null; };
      const openDetail = (uid) => {
        if (params.uid !== uid) params.panel = { tab: params.panel.tab };
        params.uid = uid;
        if (!DK.ui.isNarrow()) { refresh(); return; }
        const holder = h('div');
        let dr, cur = uid;
        const draw = () => {
          const d = DK.party.get(cur);
          if (!d) { dr && dr.close(); return; }
          if (dr) dr.el.querySelector('.drawer-head h3').textContent = DK.daskai.name(d);
          holder.replaceChildren(V.daskaiPanel(d, { state: params.panel, onChange: () => { draw(); refresh(); }, onRemoved: () => { dr.close(); params.uid = null; refresh(); },
            onNav: (dir) => { const n = neighbor(cur, dir); if (n && n.uid !== cur) { cur = n.uid; params.uid = cur; params.sheetFor = cur; params.panel = { tab: params.panel.tab }; draw(); holder.closest('.drawer-body').scrollTop = 0; } } }));
        };
        draw();
        dr = DK.ui.drawer({ title: DK.daskai.name(DK.party.get(uid)), icon: 'paw', size: 'wide', content: holder });
        params.sheetFor = uid;
        dr.promise.then(() => { params.sheetFor = null; params.uid = null; if (DK.router.current() && DK.router.current().id === 'team') refresh(); });
        refresh();
      };
      // Al llegar con un daskai elegido (p. ej. desde el Inicio), en el móvil se abre su ficha
      if (params.uid && DK.ui.isNarrow() && params.sheetFor !== params.uid) { const u = params.uid; params.sheetFor = u; setTimeout(() => openDetail(u), 0); }

      /** Clic en un daskai: abrir ficha o, en modo comparar, seleccionarlo. */
      const select = (d) => {
        if (params.compare) {
          const sel = params.compare.includes(d.uid) ? params.compare.filter((u) => u !== d.uid) : params.compare.concat(d.uid).slice(-2);
          params.compare = sel;
          if (sel.length === 2) V.compare(DK.party.get(sel[0]), DK.party.get(sel[1]));
          refresh(); return;
        }
        openDetail(d.uid);
      };
      const ctx = (row, d) => DK.ui.attachContextMenu(row, () => V.daskaiActions(d, {
        onChange: refresh, onOpen: () => openDetail(d.uid),
        onCompare: (x) => { params.compare = [x.uid]; DK.ui.toast(t('team.comparePick'), { icon: 'scale' }); refresh(); },
      }));

      /* ---- Equipo de batalla ---- */
      const slots = [];
      for (let i = 0; i < DK.config.maxTeam; i++) {
        const d = active[i];
        let slot;
        if (d) {
          slot = V.daskaiTile(d, { big: true, onClick: () => select(d), draggable: !params.compare, selected: params.compare ? params.compare.includes(d.uid) : params.uid === d.uid,
            badges: i === 0 ? [h('span', { class: 'badge leader', tip: t('team.leaderHint') }, DK.icon('crown', 12))] : [],
            corner: active.length > 1 ? h('button', { class: 'tile-btn', type: 'button', tip: t('team.remove'), 'aria-label': t('team.remove'), onClick: () => { DK.party.removeFromTeam(d.uid); DK.audio.sfx('swap'); refresh(); } }, DK.icon('minus', 14)) : null });
          ctx(slot, d);
        } else slot = h('div', { class: 'slot-empty tile-empty' }, DK.icon('plus', 20), h('span', { class: 'small' }, t('team.emptySlot')));
        slots.push(h('div', { class: 'team-slot drop-zone', dataset: { zone: 'slot', index: i } }, slot));
      }

      /* ---- Buscador y filtros (ocultos hasta pulsar «Buscar») ---- */
      const anyFilter = !!(params.q || params.houses.length || params.wounded || params.nature || params.passive);
      const toggleSearch = () => { params.search = !params.search; refresh(); if (params.search) setTimeout(() => { const s2 = document.querySelector('.team-filters input[type=search]'); if (s2) s2.focus(); }, 30); };
      DK.keys.on('/', toggleSearch);
      let filters = null;
      if (params.search) {
        const search = h('input', { class: 'input input-sm', type: 'search', placeholder: t('team.search'), value: params.q || '', 'aria-label': t('team.search') });
        let timer;
        search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { params.q = search.value; refresh(); setTimeout(() => { const s2 = document.querySelector('.team-filters input[type=search]'); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } }, 0); }, 250); });
        const houseChips = h('div', { class: 'chips' }, Object.values(D.houses).map((hs) => {
          const on = params.houses.includes(hs.id);
          return h('button', { class: 'chip chip-toggle' + (on ? ' on' : ''), type: 'button', style: { '--c': D.houseColor(hs.id) }, 'aria-pressed': on,
            onClick: () => { params.houses = on ? params.houses.filter((x) => x !== hs.id) : params.houses.concat(hs.id); refresh(); } }, DK.icon(hs.icon, 13), DK.tr('houses', hs));
        }));
        const natSel = DK.ui.select({ label: t('common.nature'), value: params.nature || '', onChange: (v) => { params.nature = v || null; refresh(); },
          options: [{ value: '', label: t('team.anyNature') }, ...Object.values(D.natures).map((n) => ({ value: n.id, label: DK.tr('natures', n) }))] });
        const pasSel = DK.ui.select({ label: t('common.passive'), value: params.passive || '', onChange: (v) => { params.passive = v || null; refresh(); },
          options: [{ value: '', label: t('team.anyPassive') }, ...Object.values(D.passives).map((p) => ({ value: p.id, label: DK.tr('passives', p) }))] });
        filters = h('div', { class: 'team-filters inline-panel' },
          h('div', { class: 'row gap-s' }, DK.icon('search', 16), search),
          houseChips,
          h('div', { class: 'row gap-s wrap' }, natSel, pasSel,
            btn({ icon: 'heart', label: t('team.onlyWounded'), size: 'sm', variant: params.wounded ? 'primary' : 'ghost', onClick: () => { params.wounded = !params.wounded; refresh(); } }),
            anyFilter ? btn({ icon: 'x', label: t('team.clear'), size: 'sm', variant: 'ghost', onClick: () => { Object.assign(params, { q: '', houses: [], wounded: false, nature: null, passive: null }); refresh(); } }) : null));
      }
      const sortSel = DK.ui.select({ label: t('team.sort'), value: params.sort || 'level', onChange: (v) => { params.sort = v; refresh(); },
        options: ['level', 'name', 'house', 'hp', 'recent'].map((v) => ({ value: v, label: t('team.sortBy.' + v) })) });
      const toolbar = h('div', { class: 'team-toolbar' },
        btn({ icon: 'search', label: t('team.searchBtn'), size: 'sm', variant: params.search || anyFilter ? 'primary' : 'ghost', hotkey: '/', onClick: toggleSearch }),
        sortSel,
        btn({ icon: 'scale', label: params.compare ? t('team.compareOn', { n: params.compare.length }) : t('team.compare'), size: 'sm', variant: params.compare ? 'primary' : 'ghost', onClick: () => { params.compare = params.compare ? null : []; refresh(); } }),
        h('span', { class: 'grow' }),
        btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(active)) refresh(); } }));

      /* ---- Reserva (los que no están en el equipo) ---- */
      // En expedición, la reserva son sólo los que salieron contigo y los reclutas
      const inExp = !!DK.expedition.active();
      const reserve = list.filter((d) => !DK.party.isActive(d.uid) && (!inExp || DK.party.canJoin(d.uid)));
      const tiles = reserve.map((d) => {
        const tile = V.daskaiTile(d, {
          onClick: () => select(d), draggable: !params.compare,
          selected: params.compare ? params.compare.includes(d.uid) : params.uid === d.uid,
          corner: params.compare || DK.training.isTraining(d.uid) ? null : h('button', { class: 'tile-btn add', type: 'button', disabled: active.length >= DK.config.maxTeam, tip: active.length >= DK.config.maxTeam ? t('team.fullTip') : t('team.add'), 'aria-label': t('team.add'),
            onClick: () => { DK.party.addToTeam(d.uid); DK.audio.sfx('swap'); refresh(); } }, DK.icon('plus', 14)),
        });
        ctx(tile, d);
        return tile;
      });
      const graves = inExp ? [] : DK.store.state.graveyard || [];
      const essences = inExp ? [] : DK.legacy.list();
      /** Esencias de los caídos: se heredan en el daskai seleccionado (experiencia + atributo). */
      const target = params.uid && DK.party.get(params.uid);
      const essenceBox = essences.length ? h('div', { class: 'essences inline-panel' },
        h('div', { class: 'team-section-head' }, DK.icon('sparkle', 16), h('b', null, t('legacy.title', { n: essences.length })), h('span', { class: 'muted small' }, t('legacy.hint'))),
        h('div', { class: 'list' }, essences.map((es) => {
          const p = DK.legacy.preview(es);
          const go = async () => {
            if (!target) return;
            if (!(await DK.ui.confirm(t('legacy.q', { from: es.name, to: DK.daskai.name(target) }), t('legacy.qText', { exp: p.exp, n: p.points, stat: DK.tr('stats', D.stats[p.stat]) }), { okLabel: t('legacy.inherit'), okIcon: 'sparkle' }))) return;
            const r = DK.legacy.inherit(es.id, target.uid);
            DK.audio.sfx('levelup'); DK.ui.toast(t('legacy.done', { name: DK.daskai.name(r.d), from: es.name }), { icon: 'sparkle', kind: 'good' });
            await V.afterLevel(r.d, r.levelInfo); refresh();
          };
          return h('div', { class: 'essence' },
            V.sprite(es.species, { size: 36, cls: 'grave-sprite' }),
            h('div', { class: 'grow' }, h('b', null, t('legacy.of', { name: es.name })),
              h('div', { class: 'muted small' }, `+${p.exp} ${t('common.expShort')} · +${p.points} ${DK.tr('stats', D.stats[p.stat])}`)),
            btn({ icon: 'sparkle', label: target ? t('legacy.inheritIn', { name: DK.daskai.name(target) }) : t('legacy.pick'), size: 'sm', variant: 'primary', disabled: !target, onClick: go }));
        }))) : null;
      const left = h('div', { class: 'panel team-list' },
        toolbar,
        anyFilter && !params.search ? h('div', { class: 'warning warn small' }, DK.icon('filter', 16), h('span', { class: 'grow' }, t('team.filtersOn')),
          btn({ icon: 'x', label: t('team.clear'), size: 'sm', variant: 'ghost', onClick: () => { Object.assign(params, { q: '', houses: [], wounded: false, nature: null, passive: null }); refresh(); } })) : null,
        filters,
        h('div', { class: 'team-section-head' }, DK.icon('swords', 16), h('b', null, t('team.active', { n: active.length, max: DK.config.maxTeam })), h('span', { class: 'muted small' }, t('team.dragHint'))),
        h('div', { class: 'team-slots' }, slots),
        h('div', { class: 'team-section-head' }, DK.icon('users', 16), h('b', null, inExp ? t('team.expReserve', { n: reserve.length }) : t('team.reserve', { n: reserve.length })), h('span', { class: 'muted small' }, inExp ? t('team.expReserveHint') : t('team.ctxHint'))),
        h('div', { class: 'tile-grid drop-zone', dataset: { zone: 'collection' } }, tiles.length ? tiles : h('p', { class: 'muted small tile-grid-empty' }, anyFilter ? t('team.noResults') : t('team.reserveEmpty'))),
        essenceBox,
        graves.length ? h('div', { class: 'graves' },
          h('button', { class: 'team-section-head as-btn', type: 'button', onClick: () => { params.graves = !params.graves; refresh(); } },
            DK.icon('skull', 16), h('b', null, t('team.fallen', { n: graves.length })), h('span', { class: 'grow' }), DK.icon(params.graves ? 'arrowUp' : 'arrowDown', 14)),
          params.graves ? V.graveyard(graves) : null) : null);

      /* ---- Ficha (escritorio) ---- */
      const sel = params.uid && DK.party.get(params.uid);
      const close = () => { params.uid = null; refresh(); };
      const right = sel ? h('div', { class: 'panel team-detail' },
        h('div', { class: 'team-detail-bar' }, h('span', { class: 'muted small' }, DK.icon('paw', 13), ' ', t('team.sheet')),
          h('button', { class: 'team-detail-close', type: 'button', tip: t('common.close') + ' (Esc)', 'aria-label': t('common.close'), onClick: close }, DK.icon('x', 16))),
        V.daskaiPanel(sel, { state: params.panel, onChange: refresh, onRemoved: close, onNav: (dir) => { const n = neighbor(sel.uid, dir); if (n) { params.uid = n.uid; params.panel = { tab: params.panel.tab }; refresh(); } } })) : null;
      if (sel) DK.keys.on('Escape', close);

      // ↑ ↓ para recorrer la colección
      const move = (dir) => { if (!params.uid) return; const i = list.findIndex((d) => d.uid === params.uid); const n = list[Math.max(0, Math.min(list.length - 1, i + dir))]; if (n) { params.uid = n.uid; params.panel = { tab: params.panel.tab }; refresh(); } };
      DK.keys.on('ArrowDown', () => move(1));
      DK.keys.on('ArrowUp', () => move(-1));

      const root = h('div', { class: 'screen team-screen' }, h('div', { class: 'team-layout' + (sel ? ' has-detail' : ' no-detail') }, left, right));
      enableDnD(root, refresh);
      return root;
    },
  });

  /**
   * Arrastrar y soltar entre colección y huecos del equipo (ratón y dedo:
   * con el dedo, mantener pulsado un momento y mover). DK.ui.pointerDrag.
   */
  function enableDnD(root, refresh) {
    root.querySelectorAll('[data-drag][data-uid]').forEach((tile) => DK.ui.pointerDrag(tile, {
      zones: '.drop-zone', touch: true,
      onDrop: (z) => {
        const uid = tile.dataset.uid;
        if (z.dataset.zone === 'slot') { if (DK.party.placeAt(uid, parseInt(z.dataset.index, 10)) === false) { DK.audio.sfx('error'); return; } DK.audio.sfx('swap'); }
        else if (z.dataset.zone === 'collection' && DK.party.isActive(uid)) {
          if (!DK.party.removeFromTeam(uid)) DK.ui.toast(t('team.needOne'), { icon: 'alert', kind: 'bad' });
          else DK.audio.sfx('swap');
        } else return;
        refresh();
      },
    }));
  }
})();
