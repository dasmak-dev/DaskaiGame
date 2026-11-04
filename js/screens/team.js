/* =============================================================
 * screens/team.js — Equipo y cajas (al estilo del PC de Pokémon).
 *
 *  ┌ Cajas ─────────────────────────────┬── Tu equipo (hasta 5) ──┐
 *  │ ‹ [Nombre de la caja · 12/30] ›    │  líder                  │
 *  │ pestañas 1 2 3 … +                 │  …                      │
 *  │ cuadrícula 6×5 sobre su fondo      │                         │
 *  └────────────────────────────────────┴─────────────────────────┘
 *  Esencias y caídos debajo. Arrastrar (o mantener pulsado en el móvil)
 *  mueve daskai entre huecos de la caja y del equipo (DK.boxes).
 *  Pulsar un daskai abre su ficha en un panel deslizante.
 *  Q / E cambian de caja; / abre el buscador (resalta en las cajas).
 * Clic derecho / pulsación larga en un daskai → menú de acciones rápidas.
 * Flechas ↑ ↓ cambian el daskai seleccionado.
 *
 * params: { uid, panel: {tab, open}, q, houses, sort, wounded, nature, passive, compare, search, graves }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

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

  /** Fondo de una caja: terreno en pixel art con los colores del tema. */
  const boxBg = (bg) => { const c = DK.boxes.colors(bg); return { backgroundImage: `url(${DK.pix.terrain(c, 'box-' + bg)})`, '--b1': c[0], '--b2': c[1] }; };

  /** Elegir el fondo de una caja. */
  function pickBg(i, refresh) {
    const cur = DK.boxes.box(i).bg;
    DK.ui.modal({ title: t('box.bgTitle'), icon: 'image', cls: 'box-bg-modal', content: (close) => h('div', { class: 'box-bg-grid' },
      Object.entries(DK.boxes.backgrounds()).map(([id, o]) => h('button', { class: 'box-bg-opt' + (id === cur ? ' on' : ''), type: 'button', style: boxBg(id), 'aria-pressed': String(id === cur),
        onClick: () => { DK.boxes.setBg(i, id); DK.audio.sfx('select'); close(); refresh(); } }, h('span', null, o.label)))) });
  }

  DK.screens.register('team', {
    title: () => t('team.title'), icon: 'users', section: 'team', tutorial: 'team', music: () => DK.audio.zoneTrack(),
    render(params) {
      const refresh = () => DK.router.refresh();
      params.houses = params.houses || [];
      params.panel = params.panel || {};
      DK.boxes.sync();
      const active = DK.party.active();
      const inExp = !!DK.expedition.active();
      const matches = new Set(filtered(params).map((d) => d.uid));
      const anyFilter = !!(params.q || params.houses.length || params.wounded || params.nature || params.passive);
      if (params.uid && !DK.party.get(params.uid)) params.uid = null;

      /* ---- Ficha del daskai (panel deslizante) ---- */
      const order = () => active.concat(DK.boxes.box().slots.filter(Boolean).map((u) => DK.party.get(u)).filter(Boolean));
      const neighbor = (uid, dir) => { const l = order(); const i = l.findIndex((d) => d.uid === uid); return l.length ? l[(i + dir + l.length) % l.length] : null; };
      const openDetail = (uid) => {
        params.uid = uid; params.panel = { tab: params.panel.tab };
        const holder = h('div');
        let dr, cur = uid;
        const draw = () => {
          const d = DK.party.get(cur);
          if (!d) { dr && dr.close(); return; }
          if (dr) dr.el.querySelector('.drawer-head h3').textContent = DK.daskai.name(d);
          holder.replaceChildren(V.daskaiPanel(d, { state: params.panel, onChange: () => { DK.boxes.sync(); draw(); refresh(); }, onRemoved: () => { dr.close(); params.uid = null; refresh(); },
            onNav: (dir) => { const n = neighbor(cur, dir); if (n && n.uid !== cur) { cur = n.uid; params.uid = cur; params.sheetFor = cur; params.panel = { tab: params.panel.tab }; draw(); refresh(); const b = holder.closest('.drawer-body'); if (b) b.scrollTop = 0; } } }));
        };
        draw();
        dr = DK.ui.drawer({ title: DK.daskai.name(DK.party.get(uid)), icon: 'paw', size: 'wide', content: holder });
        params.sheetFor = uid;
        dr.promise.then(() => { params.sheetFor = null; params.uid = null; if (DK.router.current() && DK.router.current().id === 'team') refresh(); });
        refresh();
      };
      if (params.uid && params.sheetFor !== params.uid) { const u = params.uid; params.sheetFor = u; setTimeout(() => openDetail(u), 0); }

      /** Pulsar un daskai: abrir su ficha o, en modo comparar, elegirlo. */
      const select = (d) => {
        if (params.compare) {
          const sel = params.compare.includes(d.uid) ? params.compare.filter((u) => u !== d.uid) : params.compare.concat(d.uid).slice(-2);
          params.compare = sel;
          if (sel.length === 2) V.compare(DK.party.get(sel[0]), DK.party.get(sel[1]));
          refresh(); return;
        }
        DK.audio.sfx('select');
        openDetail(d.uid);
      };
      const ctx = (el, d) => DK.ui.attachContextMenu(el, () => V.daskaiActions(d, {
        onChange: refresh, onOpen: () => openDetail(d.uid),
        onCompare: (x) => { params.compare = [x.uid]; DK.ui.toast(t('team.comparePick'), { icon: 'scale' }); refresh(); },
      }));
      const picked = (d) => (params.compare ? params.compare.includes(d.uid) : params.uid === d.uid);

      /* ---- Equipo (derecha): hasta config.maxTeam ---- */
      const partySlots = [];
      for (let i = 0; i < DK.config.maxTeam; i++) {
        const d = active[i];
        let inner;
        if (d) {
          const sp = DK.daskai.species(d), s = DK.daskai.stats(d);
          const hp = DK.util.percent(d.cur.hp, s.hp), mp = DK.util.percent(d.cur.mp, s.mp);
          inner = h('div', { class: 'party-mon' + (picked(d) ? ' selected' : '') + (DK.daskai.isFainted(d) ? ' fainted' : ''), role: 'button', tabindex: '0', 'data-drag': params.compare ? null : '1', dataset: { uid: d.uid }, style: { '--c': D.houseColor(sp.house) },
            tip: `${DK.daskai.name(d)} · ${sp.name}`, onClick: (e) => { if (!e.target.closest('.party-out')) select(d); }, onKeydown: (e) => { if (e.key === 'Enter') select(d); } },
            h('span', { class: 'party-art' }, V.dSprite(d, { size: 64 }), i === 0 ? h('span', { class: 'party-crown', tip: t('team.leaderHint') }, DK.icon('crown', 14)) : null),
            h('span', { class: 'party-info' },
              h('span', { class: 'party-name' }, h('b', null, DK.daskai.name(d)), h('span', { class: 'party-lv' }, `${t('common.lvl')} ${d.level}`)),
              h('span', { class: 'party-tags' }, V.houseBadge(sp.house), V.roleBadge(d), V.shinyTag(d), V.tempTag(d), V.statusTag(d.status), DK.daskai.canEvolve(d) ? h('span', { class: 'badge evo', tip: t('evo.readyTip') }, DK.icon('evolve', 12)) : null),
              h('span', { class: 'party-bar hp' + (hp < 25 ? ' crit' : hp < 50 ? ' mid' : '') }, h('i', { style: { width: hp + '%' } }), h('em', null, `${d.cur.hp}/${s.hp}`)),
              h('span', { class: 'party-bar mp' }, h('i', { style: { width: mp + '%' } }))),
            active.length > 1 && !params.compare ? h('button', { class: 'party-out', type: 'button', tip: t(inExp ? 'party.toReserve' : 'party.toBox'), 'aria-label': t(inExp ? 'party.toReserve' : 'party.toBox'),
              onClick: () => { DK.party.removeFromTeam(d.uid); DK.boxes.sync(); DK.audio.sfx('swap'); refresh(); } }, DK.icon('arrowDown', 16)) : null);
          ctx(inner, d);
        } else inner = h('div', { class: 'party-empty' }, h('span', { class: 'party-ball' }), h('span', null, h('b', null, t('party.empty'))));
        partySlots.push(h('div', { class: 'party-slot drop-zone', dataset: { zone: 'slot', index: i } }, inner));
      }
      const party = h('section', { class: 'party-panel' },
        h('div', { class: 'party-head' }, h('span', { class: 'party-title' }, DK.icon('users', 20), t('party.title')), h('span', { class: 'party-count' }, `${active.length}/${DK.config.maxTeam}`),
          h('span', { class: 'grow' }),
          btn({ icon: 'flask', label: t('heal.button'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(active)) refresh(); } })),
        h('div', { class: 'party-list' }, partySlots),
        h('p', { class: 'party-hint muted small' }, DK.icon('grip', 13), ' ', t(inExp ? 'box.dragHintExp' : 'box.dragHint')));

      /* ---- Cajas (izquierda) ---- */
      const bi = DK.boxes.cur(), box = DK.boxes.box(bi);
      const go = (dir) => { DK.boxes.setCur(bi + dir); DK.audio.sfx('select'); refresh(); };
      if (!inExp) { DK.keys.on('q', () => go(-1)); DK.keys.on('e', () => go(1)); }
      const cells = box.slots.map((uid, i) => {
        const d = uid && DK.party.get(uid);
        let mon = null;
        if (d) {
          const sp = DK.daskai.species(d), training = DK.training.isTraining(d.uid);
          const usable = !inExp || DK.party.canJoin(d.uid);
          mon = h('div', { class: 'pc-mon' + (picked(d) ? ' selected' : '') + (anyFilter && !matches.has(d.uid) ? ' dim' : '') + (anyFilter && matches.has(d.uid) ? ' match' : '') + (!usable ? ' away' : ''),
            role: 'button', tabindex: '0', 'data-drag': params.compare || training || !usable ? null : '1', dataset: { uid: d.uid }, style: { '--c': D.houseColor(sp.house) },
            tip: `${DK.daskai.name(d)} · ${sp.name} · ${t('common.lvl')} ${d.level}${training ? ' · ' + t('train.title') : ''}${!usable && !training ? ' · ' + t('box.atHome') : ''}`,
            onClick: () => select(d), onKeydown: (e) => { if (e.key === 'Enter') select(d); } },
            V.dSprite(d, { size: 56 }),
            h('span', { class: 'pc-lv' }, d.level),
            h('span', { class: 'pc-house' }, DK.icon(D.houses[sp.house].icon, 11)),
            d.shiny ? h('span', { class: 'pc-flag shiny' }, DK.icon('sparkles', 11)) : training ? h('span', { class: 'pc-flag train' }, DK.icon('dumbbell', 11)) : DK.daskai.canEvolve(d) ? h('span', { class: 'pc-flag evo' }, DK.icon('evolve', 11)) : null);
          ctx(mon, d);
        }
        return h('div', { class: 'pc-slot drop-zone' + (d ? '' : ' is-empty'), dataset: { zone: 'box', index: i } }, mon);
      });
      const nBoxes = DK.boxes.list().length;
      const rename = async () => { const v = await DK.ui.prompt(t('box.renameTitle'), { placeholder: DK.boxes.name(bi), maxlength: 24, icon: 'edit', value: box.name || '' }); if (v != null) { DK.boxes.rename(bi, v); refresh(); } };
      const sortSel = DK.ui.select({ label: t('box.sort'), value: '', onChange: (v) => { if (v) { DK.boxes.sort(bi, v); DK.audio.sfx('swap'); refresh(); } },
        options: [{ value: '', label: t('box.sort') }, ...['level', 'house', 'species', 'name'].map((v) => ({ value: v, label: t('box.sortBy.' + v) }))] });

      // Buscador y filtros (resaltan en las cajas)
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
      // Con filtros: cuántos coinciden en cada caja (para saltar a ellas)
      const hits = anyFilter ? DK.boxes.list().map((b) => b.slots.filter((u) => u && matches.has(u)).length) : null;

      const pc = h('section', { class: 'pc-box' },
        h('div', { class: 'pc-toolbar' },
          btn({ icon: 'search', label: t('team.searchBtn') + ' (/)', iconOnly: true, size: 'sm', variant: params.search || anyFilter ? 'primary' : 'ghost', hotkey: '/', onClick: toggleSearch }),
          btn({ icon: 'scale', label: params.compare ? t('team.compareOn', { n: params.compare.length }) : t('team.compare'), iconOnly: true, size: 'sm', variant: params.compare ? 'primary' : 'ghost', onClick: () => { params.compare = params.compare ? null : []; refresh(); } }),
          h('span', { class: 'grow' }), sortSel),
        filters,
        h('div', { class: 'pc-head' },
          h('button', { class: 'pc-arrow', type: 'button', 'aria-label': t('box.prev'), tip: t('box.prev') + ' (Q)', onClick: () => go(-1) }, DK.icon('back', 22)),
          h('button', { class: 'pc-plate', type: 'button', tip: t('box.rename'), onClick: rename, style: { '--b1': DK.boxes.colors(box.bg)[0], '--b2': DK.boxes.colors(box.bg)[1] } },
            h('b', null, DK.boxes.name(bi)), h('small', null, t('box.count', { n: DK.boxes.count(bi), max: DK.boxes.SIZE }))),
          h('button', { class: 'pc-arrow', type: 'button', 'aria-label': t('box.next'), tip: t('box.next') + ' (E)', onClick: () => go(1) }, DK.icon('next', 22))),
        h('div', { class: 'pc-tabs', role: 'tablist' }, DK.boxes.list().map((b, i) => h('button', { class: 'pc-tab drop-zone' + (i === bi ? ' on' : '') + (hits && hits[i] ? ' hit' : ''), type: 'button', role: 'tab', 'aria-selected': String(i === bi), dataset: { zone: 'tab', index: i },
          tip: DK.boxes.name(i) + (hits && hits[i] ? ` · ${t('box.matches', { n: hits[i] })}` : ''), style: { '--b1': DK.boxes.colors(b.bg)[0] }, onClick: () => { DK.boxes.setCur(i); refresh(); } }, String(i + 1))),
          nBoxes < DK.boxes.MAX ? h('button', { class: 'pc-tab add', type: 'button', tip: t('box.add'), 'aria-label': t('box.add'), onClick: () => { DK.boxes.add(); DK.audio.sfx('select'); refresh(); } }, DK.icon('plus', 14)) : null),
        h('div', { class: 'pc-grid', style: boxBg(box.bg) }, cells),
        h('div', { class: 'pc-actions' },
          btn({ icon: 'edit', label: t('box.rename'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: rename }),
          btn({ icon: 'image', label: t('box.bg'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => pickBg(bi, refresh) }),
          null));

      /* ---- Esencias y caídos ---- */
      const graves = inExp ? [] : DK.store.state.graveyard || [];
      const essences = inExp ? [] : DK.legacy.list();
      const target = params.uid && DK.party.get(params.uid);
      const essenceBox = essences.length ? h('div', { class: 'essences inline-panel' },
        h('div', { class: 'team-section-head' }, DK.icon('sparkle', 16), h('b', null, t('legacy.title', { n: essences.length })), h('span', { class: 'muted small' }, t('legacy.hint'))),
        h('div', { class: 'list' }, essences.map((es) => {
          const p = DK.legacy.preview(es);
          const goInherit = async () => {
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
            btn({ icon: 'sparkle', label: target ? t('legacy.inheritIn', { name: DK.daskai.name(target) }) : t('legacy.pick'), size: 'sm', variant: 'primary', disabled: !target, onClick: goInherit }));
        }))) : null;
      const extras = essenceBox || graves.length ? h('div', { class: 'panel team-extras' }, essenceBox,
        graves.length ? h('div', { class: 'graves' },
          h('button', { class: 'team-section-head as-btn', type: 'button', onClick: () => { params.graves = !params.graves; refresh(); } },
            DK.icon('skull', 16), h('b', null, t('team.fallen', { n: graves.length })), h('span', { class: 'grow' }), DK.icon(params.graves ? 'arrowUp' : 'arrowDown', 14)),
          params.graves ? V.graveyard(graves) : null) : null) : null;

      /* ---- En expedición: las cajas se quedan en el campamento ----
       * Sólo se ve quién está contigo (los que salieron y los reclutas)
       * para cambiarlo por alguien del equipo. */
      let left = pc;
      if (inExp) {
        const withYou = DK.party.all().filter((d) => !DK.party.isActive(d.uid) && DK.party.canJoin(d.uid));
        const cellsExp = withYou.map((d) => {
          const sp = DK.daskai.species(d);
          const mon = h('div', { class: 'pc-mon' + (picked(d) ? ' selected' : ''), role: 'button', tabindex: '0', 'data-drag': params.compare ? null : '1', dataset: { uid: d.uid }, style: { '--c': D.houseColor(sp.house) },
            tip: `${DK.daskai.name(d)} · ${sp.name} · ${t('common.lvl')} ${d.level}`, onClick: () => select(d), onKeydown: (e) => { if (e.key === 'Enter') select(d); } },
            V.dSprite(d, { size: 56 }), h('span', { class: 'pc-lv' }, d.level), h('span', { class: 'pc-house' }, DK.icon(D.houses[sp.house].icon, 11)),
            d.temp ? h('span', { class: 'pc-flag evo', tip: t('exp.tempRule') }, DK.icon('paw', 11)) : null);
          ctx(mon, d);
          return h('div', { class: 'pc-slot' }, mon);
        });
        left = h('section', { class: 'pc-box pc-away' },
          h('div', { class: 'pc-head' }, h('div', { class: 'pc-plate', style: { '--b1': '#64748b', '--b2': '#1e293b' } }, h('b', null, t('box.withYou')), h('small', null, t('box.withYouN', { n: withYou.length })))),
          h('div', { class: 'pc-grid drop-zone', dataset: { zone: 'reserve' }, style: boxBg('noche') }, cellsExp.length ? cellsExp : h('p', { class: 'pc-none' }, t('box.withYouEmpty'))),
          h('div', { class: 'warning' }, DK.icon('lock', 16), h('span', null, t('box.locked'))));
      }

      const root = h('div', { class: 'screen team-screen pc-screen' }, h('div', { class: 'pc-layout' }, left, party), extras);
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
        let ok = false;
        if (z.dataset.zone === 'slot') ok = DK.boxes.toTeam(uid, parseInt(z.dataset.index, 10));
        else if (z.dataset.zone === 'reserve') {
          ok = DK.party.isActive(uid) && DK.party.removeFromTeam(uid);
          if (!ok && DK.party.isActive(uid)) DK.ui.toast(t('team.needOne'), { icon: 'alert', kind: 'bad' });
          if (!DK.party.isActive(uid) && !ok) return;
        } else if (z.dataset.zone === 'tab') {
          // Soltar sobre la pestaña de otra caja: va al primer hueco libre de esa caja
          const bi2 = parseInt(z.dataset.index, 10), slot = DK.boxes.box(bi2).slots.indexOf(null);
          ok = slot >= 0 && DK.boxes.moveTo(uid, bi2, slot);
          if (ok) DK.ui.toast(t('box.moved', { name: DK.daskai.name(DK.party.get(uid)), box: DK.boxes.name(bi2) }), { icon: 'grid', kind: 'good' });
          else DK.ui.toast(slot < 0 ? t('box.full') : t('team.needOne'), { icon: 'alert', kind: 'bad' });
        } else if (z.dataset.zone === 'box') {
          ok = DK.boxes.moveTo(uid, DK.boxes.cur(), parseInt(z.dataset.index, 10));
          if (!ok && DK.party.isActive(uid)) DK.ui.toast(t('team.needOne'), { icon: 'alert', kind: 'bad' });
        } else return;
        DK.audio.sfx(ok ? 'swap' : 'error');
        refresh();
      },
    }));
  }
})();
