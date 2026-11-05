/* =============================================================
 * components/daskaiPanel.js — Ficha completa de un daskai como panel.
 *
 * Se usa en la pantalla Equipo (a la derecha de la lista en escritorio,
 * o en un panel deslizante en móvil). Todo se hace dentro del panel,
 * sin abrir ventanas encima: usar objetos, equipar, cambiar ataques,
 * apodo, entrar/salir del equipo...
 *
 *   DK.views.daskaiPanel(d, { state, onChange, onRemoved })
 *     state:     objeto donde se guarda la pestaña y lo desplegado
 *                (se conserva al repintar): { tab, open }
 *     onChange:  se llama tras cualquier cambio (para repintar)
 *     onRemoved: se llama si el daskai se libera
 *
 *   DK.views.daskaiActions(d, { onChange, onOpen }) → opciones del menú contextual
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  /** Libera un daskai (con confirmación). Devuelve true si se liberó. */
  async function release(d) {
    const r = DK.daskai.releaseReward(d);
    const list = Object.entries(r.items).map(([id, n]) => `${D.items[id].name} x${n}`).join(', ');
    if (DK.settings.get('confirmRelease') && !(await DK.ui.confirm(t('release.title', { name: DK.daskai.name(d) }), t('release.text', { coins: r.coins, items: list }), { okLabel: t('detail.release'), okIcon: 'trash', danger: true }))) return false;
    const name = DK.daskai.name(d);
    if (!DK.party.release(d.uid)) { toast(t('release.cant'), { icon: 'alert', kind: 'bad' }); return false; }
    DK.audio.sfx('coin');
    toast(t('release.done', { name, coins: r.coins }), { icon: 'trash', kind: 'good' });
    return true;
  }
  V.releaseDaskai = release;

  /**
   * Opciones del menú contextual de un daskai (clic derecho en cualquier lista).
   * @param {Object} d
   * @param {Object} o {onChange, onOpen, onCompare}
   */
  V.daskaiActions = (d, { onChange = () => DK.router.refresh(), onOpen, onCompare } = {}) => {
    const active = DK.party.isActive(d.uid), leader = DK.store.state.team[0] === d.uid;
    const full = DK.party.active().length >= DK.config.maxTeam;
    return [
      onOpen ? { icon: 'eye', label: t('ctx.open'), onClick: onOpen } : false,
      active && !leader ? { icon: 'crown', label: t('detail.makeLeader'), onClick: () => { DK.party.setLeader(d.uid); onChange(); } } : false,
      active ? { icon: 'minus', label: t('detail.removeTeam'), disabled: DK.party.active().length <= 1, onClick: () => { DK.party.removeFromTeam(d.uid); DK.audio.sfx('swap'); onChange(); } }
        : { icon: 'plus', label: full ? t('ctx.addFull') : t('detail.addTeam'), disabled: full, onClick: () => { DK.party.addToTeam(d.uid); DK.audio.sfx('swap'); onChange(); } },
      { icon: 'flask', label: t('heal.button'), onClick: async () => { if (await V.healDialog([d])) onChange(); } },
      DK.daskai.canEvolve(d) ? { icon: 'evolve', label: t('evo.button'), onClick: async () => { if (await V.evolveDialog(d)) onChange(); } } : false,
      onCompare ? { icon: 'scale', label: t('detail.compare'), onClick: () => onCompare(d) } : false,
      // Mover a otra caja (fuera de las expediciones, que las cajas se quedan en el campamento)
      !DK.expedition.active() && DK.boxes ? { icon: 'grid', label: active ? t('box.storeIn') : t('box.moveTo'), disabled: active && DK.party.active().length <= 1, onClick: () => V.moveToBox(d, onChange) } : false,
      null,
      { icon: 'trash', label: t('detail.release'), danger: true, disabled: DK.party.all().length <= 1, onClick: async () => { if (await release(d)) onChange(); } },
    ].filter((x) => x !== false); // null = separador
  };

  /**
   * Elegir caja para un daskai (desde el menú contextual): cada caja con su
   * nombre, color y huecos libres. Lo coloca en el primer hueco libre.
   */
  V.moveToBox = (d, onChange = () => DK.router.refresh()) => {
    DK.boxes.sync();
    const here = DK.boxes.locate(d.uid);
    const m = DK.ui.modal({ title: t('box.moveTitle', { name: DK.daskai.name(d) }), icon: 'grid', content: (close) => h('div', { class: 'box-pick' },
      DK.boxes.list().map((b, i) => {
        const used = DK.boxes.count(i), full = used >= DK.boxes.SIZE, cur = here && here.b === i;
        const c = DK.boxes.colors(b.bg);
        return h('button', { class: 'box-pick-btn' + (cur ? ' cur' : ''), type: 'button', disabled: full || cur, style: { '--b1': c[0], '--b2': c[1] },
          onClick: () => {
            const slot = DK.boxes.box(i).slots.indexOf(null);
            if (slot < 0 || !DK.boxes.moveTo(d.uid, i, slot)) { DK.audio.sfx('error'); return; }
            DK.audio.sfx('swap'); DK.ui.toast(t('box.moved', { name: DK.daskai.name(d), box: DK.boxes.name(i) }), { icon: 'grid', kind: 'good' });
            close(i); onChange();
          } },
          h('span', { class: 'box-pick-sw' }), h('b', null, DK.boxes.name(i)), h('small', null, cur ? t('box.here') : full ? t('box.full') : t('box.count', { n: used, max: DK.boxes.SIZE })));
      }),
      DK.boxes.list().length < DK.boxes.MAX ? h('button', { class: 'box-pick-btn add', type: 'button', onClick: () => { const i = DK.boxes.add(); if (i >= 0 && DK.boxes.moveTo(d.uid, i, 0)) { DK.audio.sfx('swap'); close(i); onChange(); } } },
        DK.icon('plus', 18), h('b', null, t('box.newBox'))) : null) });
    return m.promise;
  };

  /** Panel completo de un daskai. */
  V.daskaiPanel = (d, { state = {}, onChange = () => {}, onRemoved = () => {}, onNav } = {}) => {
    const sp = DK.daskai.species(d);
    const active = DK.party.isActive(d.uid);
    const isLeader = DK.store.state.team[0] === d.uid;
    const changed = () => onChange();
    const toggle = (key) => { state.open = state.open === key ? null : key; changed(); };

    /* ---- Nombre (con apodo editable en línea) ---- */
    let nameEl;
    if (state.open === 'rename') {
      const input = h('input', { class: 'input input-sm', value: d.nickname || '', placeholder: sp.name, maxlength: 16, 'aria-label': t('detail.renameTitle') });
      const save = () => { DK.daskai.rename(d, input.value.trim()); state.open = null; changed(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); state.open = null; changed(); } });
      setTimeout(() => input.focus(), 20);
      nameEl = h('div', { class: 'row gap-s wrap' }, input, btn({ icon: 'check', label: t('common.accept'), size: 'sm', variant: 'primary', onClick: save }), btn({ icon: 'x', label: t('common.cancel'), size: 'sm', variant: 'ghost', onClick: () => toggle('rename') }));
    } else {
      nameEl = h('div', { class: 'row gap-s wrap' }, h('h2', null, DK.daskai.name(d)),
        h('button', { class: 'icon-btn dp-rename', type: 'button', tip: t('detail.rename'), 'aria-label': t('detail.rename'), onClick: () => toggle('rename') }, DK.icon('edit', 14)),
        d.nickname ? h('span', { class: 'muted' }, `(${sp.name})`) : null,
        V.level(d.level), V.houseBadge(sp.house), V.roleBadge(d, { neutral: true }), V.shinyTag(d), V.tempTag(d), V.statusTag(d.status),
        DK.daskai.isFainted(d) ? h('span', { class: 'badge bad' }, DK.icon('skull', 13), t('common.fainted')) : null,
        active ? h('span', { class: 'badge good' }, DK.icon('check', 13), isLeader ? t('detail.teamLeader') : t('team.inTeam')) : null);
    }

    /* ---- Acciones: la principal con texto; el resto, iconos con su nombre al pasar ---- */
    const full = DK.party.active().length >= DK.config.maxTeam;
    const main = [];
    if (active) {
      if (!isLeader) main.push(btn({ icon: 'crown', label: t('detail.makeLeader'), variant: 'tone', size: 'sm', onClick: () => { DK.party.setLeader(d.uid); DK.audio.sfx('swap'); changed(); } }));
    } else if (DK.training.isTraining(d.uid)) {
      main.push(btn({ icon: 'dumbbell', label: t('train.goTo'), variant: 'primary', size: 'sm', onClick: () => DK.router.reset('training') }));
    } else {
      main.push(btn({ icon: 'plus', label: t('detail.addTeam'), variant: 'primary', size: 'sm', onClick: () => { if (!full) { DK.party.addToTeam(d.uid); DK.audio.sfx('swap'); changed(); } else toggle('team'); } }));
    }
    if (DK.daskai.canEvolve(d)) main.push(btn({ icon: 'evolve', label: t('evo.button'), variant: 'primary', size: 'sm', onClick: async () => { if (await V.evolveDialog(d)) changed(); } }));
    // Ascender (nivel máximo): vuelve al 1 con una estrella más
    if (DK.ascension.can(d) && !DK.expedition.active()) main.push(btn({ icon: 'star', label: t('ascend.button', { n: DK.ascension.stars(d) + 1 }), variant: 'primary', size: 'sm', cls: 'ascend-btn', onClick: async () => {
      const pct = Math.round(D.endgame.ascension.statPerStar * 100);
      if (!(await DK.ui.confirm(t('ascend.q', { name: DK.daskai.name(d) }), t('ascend.text', { name: DK.daskai.name(d), n: DK.ascension.stars(d) + 1, pct, total: pct * (DK.ascension.stars(d) + 1) }), { okLabel: t('ascend.ok'), okIcon: 'star', icon: 'star' }))) return;
      if (DK.ascension.ascend(d)) { DK.audio.sfx('levelup'); toast(t('ascend.done', { name: DK.daskai.name(d), n: d.stars }), { icon: 'star', kind: 'good' }); changed(); }
    } }));
    const tool = (icon, label, onClick, { on = false, disabled = false, tip = null, danger = false, cls = '' } = {}) =>
      h('button', { class: 'icon-btn dp-tool' + (on ? ' on' : '') + (danger ? ' danger' : '') + (cls ? ' ' + cls : ''), type: 'button', tip: tip || label, 'aria-label': label, disabled, onClick }, DK.icon(icon, 17));
    const tools = [
      active ? tool('minus', t('detail.removeTeam'), () => { if (DK.party.removeFromTeam(d.uid)) { DK.audio.sfx('swap'); changed(); } }, { disabled: DK.party.active().length <= 1, tip: DK.party.active().length <= 1 ? t('team.needOne') : null, cls: 'dp-out' }) : null,
      tool('flask', t('detail.useItem'), () => toggle('items'), { on: state.open === 'items', cls: 'dp-items' }),
      tool('heart', t('heal.button'), async () => { if (await V.healDialog([d])) changed(); }, { cls: 'dp-heal' }),
      tool('trash', t('detail.release'), async () => { if (await release(d)) onRemoved(); }, { disabled: DK.party.all().length <= 1, danger: true, cls: 'dp-release' }),
    ];
    const actions = [h('div', { class: 'dp-main' }, main), h('div', { class: 'dp-tools', role: 'toolbar', 'aria-label': t('detail.actions') }, tools)];

    /* ---- Desplegables en línea ---- */
    let inline = null;
    if (state.open === 'team') {
      inline = h('div', { class: 'inline-panel' }, h('p', { class: 'small' }, DK.icon('swap', 14), ' ', t('detail.teamFull')),
        h('div', { class: 'list' }, DK.party.active().map((a) => V.daskaiRow(a, { compact: true, actions: btn({ icon: 'swap', label: t('detail.replace'), size: 'sm', variant: 'primary', onClick: () => {
          const tm = DK.store.state.team; tm[tm.indexOf(a.uid)] = d.uid; DK.store.save(); DK.audio.sfx('swap'); state.open = null; changed();
        } }) }))));
    }
    if (state.open === 'items') {
      const items = DK.bag.list('mejora').concat(DK.bag.list('batalla').filter((x) => !x.item.use.capture));
      inline = h('div', { class: 'inline-panel' },
        items.length ? h('div', { class: 'inline-items' }, items.map(({ item, qty }) => {
          const why = DK.bag.cannotUse(item.id, d);
          const p = DK.bag.potency(item.id, d);
          return h('div', { class: 'inline-item' + (why ? ' disabled' : '') }, V.itemIcon(item, 18),
            h('div', { class: 'grow' }, h('b', null, `${item.name} `), h('span', { class: 'muted small' }, `x${qty} · ${why || V.useText(item)}`)),
            btn({ icon: 'hand', label: t('inv.use'), size: 'sm', variant: 'primary', disabled: !!why, tip: why || (p.hp ? `+${p.hp} PV` : p.mp ? `+${p.mp} PM` : null),
              onClick: async () => { const r = DK.bag.use(item.id, d); DK.audio.sfx(r.levelInfo ? 'levelup' : 'heal'); toast(r.msg, { icon: r.levelInfo ? 'star' : 'flask', kind: r.ok ? 'good' : 'bad' }); if (r.levelInfo) await V.afterLevel(d, r.levelInfo); changed(); } }));
        })) : h('p', { class: 'muted small' }, t('detail.noItemsText')));
    }

    const head = h('div', { class: 'panel-head-card', style: { '--c': D.houseColor(sp.house) } },
      h('div', { class: 'detail-sprite' }, V.dSprite(d, { size: 130, cls: 'float' })),
      h('div', { class: 'detail-info' }, nameEl,
        h('p', { class: 'muted small' }, sp.desc),
        V.vitals(d, { exp: true }),
        h('p', { class: 'small muted' }, d.level >= DK.config.maxLevel ? t('detail.maxLevel') : t('detail.toNext', { n: DK.daskai.expToNext(d) - d.exp, level: d.level + 1 }))));

    const tabs = DK.ui.tabs({
      active: ({ talents: 'stats', learn: 'moves' })[state.tab] || state.tab, onChange: (id) => (state.tab = id),
      items: [
        // 3 pestañas: Atributos (+ talentos) · Ataques (+ aprender y evolución) · Equipo
        { id: 'stats', label: t('detail.stats'), icon: 'chart', count: DK.daskai.talentsPending(d).length ? '!' : null,
          render: () => h('div', { class: 'stack-s dp-stats' }, h('div', { class: 'info-grid dp-profile' }, V.natureInfo(d), V.passiveInfo(d)), V.permInfo(d), V.statTable(d, { open: !!state.statsOpen }), V.talentTab(d, changed)) },
        { id: 'moves', label: t('detail.moves'), icon: 'swords', count: `${d.moves.length}/${DK.config.maxMoves}`,
          render: () => h('div', { class: 'stack' }, movesTab(d, state, changed), h('div', null, h('h4', { class: 'mt' }, DK.icon('book2', 16), ' ', t('detail.learn')), learnTab(d, changed))) },
        { id: 'equip', label: t('detail.equip'), icon: 'gem', count: `${d.equip.filter(Boolean).length}/${DK.config.maxEquip}`, render: () => equipTab(d, state, changed) },
      ],
    });
    // Anterior / siguiente: flechas y, con el dedo, deslizar la cabecera a los lados
    let navBar = null;
    if (onNav) {
      navBar = h('div', { class: 'panel-navbar' },
        h('button', { class: 'panel-nav prev', type: 'button', 'aria-label': t('detail.prev'), tip: t('detail.prev'), onClick: () => onNav(-1) }, DK.icon('back', 16)),
        h('span', { class: 'muted small panel-nav-hint' }, t('detail.swipeHint')),
        h('button', { class: 'panel-nav next', type: 'button', 'aria-label': t('detail.next'), tip: t('detail.next'), onClick: () => onNav(1) }, DK.icon('next', 16)));
      let sx = null, sy = 0;
      head.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      head.addEventListener('touchend', (e) => {
        if (sx == null) return;
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { DK.audio.sfx('select'); onNav(dx < 0 ? 1 : -1); }
      });
    }
    return h('div', { class: 'daskai-panel' }, navBar, head, h('div', { class: 'panel-actions dp-actions' }, actions), inline, tabs);
  };

  /* ---------- Ataques: sustituir sin ventanas ---------- */
  function movesTab(d, state, changed) {
    const replacing = state.open && state.open.startsWith('replace:') ? state.open.slice(8) : null;
    const reserve = d.learned.filter((m) => !d.moves.includes(m));
    const activeCards = d.moves.map((mid, i) => V.moveCard(mid, {
      d, compact: !!replacing,
      actions: replacing
        ? [btn({ icon: 'swap', label: t('detail.replaceHere'), size: 'sm', variant: 'primary', onClick: () => { DK.daskai.setMove(d, replacing, i); DK.store.save(); state.open = null; DK.audio.sfx('swap'); changed(); } })]
        : d.moves.length > 1 ? [btn({ icon: 'minus', label: t('detail.toReserve'), size: 'sm', variant: 'ghost', onClick: () => { DK.daskai.removeMove(d, i); DK.store.save(); changed(); } })] : null,
    }));
    const reserveCards = reserve.map((mid) => V.moveCard(mid, {
      d, actions: [replacing === mid
        ? btn({ icon: 'x', label: t('common.cancel'), size: 'sm', variant: 'ghost', onClick: () => { state.open = null; changed(); } })
        : btn({ icon: d.moves.length < DK.config.maxMoves ? 'plus' : 'swap', label: d.moves.length < DK.config.maxMoves ? t('detail.activate') : t('detail.replace'), size: 'sm', variant: 'primary',
          onClick: () => { if (d.moves.length < DK.config.maxMoves) { DK.daskai.setMove(d, mid); DK.store.save(); changed(); } else { state.open = 'replace:' + mid; changed(); } } })],
    }));
    return h('div', null,
      replacing ? h('div', { class: 'warning warn' }, DK.icon('swap', 18), h('span', null, t('detail.whichReplace', { move: D.moves[replacing].name }))) : h('p', { class: 'muted small' }, t('detail.movesHelp')),
      h('div', { class: 'move-grid' }, activeCards),
      reserve.length ? h('div', null, h('h4', { class: 'mt' }, DK.icon('list', 16), ' ', t('detail.reserve')), h('div', { class: 'move-grid' }, reserveCards)) : null);
  }

  /* ---------- Equipamiento: elegir en línea con vista previa ---------- */
  function equipTab(d, state, changed) {
    const slots = [];
    for (let i = 0; i < DK.config.maxEquip; i++) {
      const id = d.equip[i];
      const choosing = state.open === 'equip' + i;
      const head = id
        ? h('div', { class: 'equip-slot filled card' + (choosing ? ' choosing' : '') },
          h('div', { class: 'row gap-s' }, V.itemIcon(D.items[id], 26), h('div', { class: 'grow' }, h('b', null, D.items[id].name), h('div', null, V.rarity(D.items[id].rarity)))),
          V.statChips(D.items[id].stats),
          D.items[id].grants ? h('span', { class: 'grants-text small' }, DK.icon('sparkles', 13), ' ', V.grantsText(D.items[id])) : null,
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'swap', label: choosing ? t('common.cancel') : t('equip.change'), size: 'sm', variant: 'ghost', onClick: () => { state.open = choosing ? null : 'equip' + i; changed(); } }),
            btn({ icon: 'x', label: t('equip.remove'), size: 'sm', variant: 'ghost', onClick: () => { DK.bag.unequip(d, i); changed(); } })))
        : h('button', { class: 'equip-slot empty' + (choosing ? ' choosing' : ''), type: 'button', onClick: () => { state.open = choosing ? null : 'equip' + i; changed(); } },
          DK.icon(choosing ? 'x' : 'plus', 22), h('b', null, choosing ? t('common.cancel') : t('equip.freeSlot', { n: i + 1 })), h('span', { class: 'muted small' }, t('equip.freeSlotHint')));
      slots.push(head);
    }
    const choosingSlot = state.open && state.open.startsWith('equip') ? parseInt(state.open.slice(5), 10) : null;
    const items = DK.bag.list('equipo');
    const chooser = choosingSlot != null ? h('div', { class: 'inline-panel' }, h('p', { class: 'small' }, DK.icon('gem', 14), ' ', t('equip.choose')),
      items.length ? h('div', { class: 'inline-items' }, items.map(({ item, qty }) => h('div', { class: 'inline-item' }, V.itemIcon(item, 18),
        h('div', { class: 'grow' }, h('b', null, `${item.name} `), h('span', { class: 'muted small' }, 'x' + qty), item.grants ? h('div', { class: 'grants-text small' }, DK.icon('sparkles', 12), ' ', V.grantsText(item)) : null, V.diffChips(DK.bag.equipPreview(d, choosingSlot, item.id))),
        btn({ icon: 'gem', label: t('inv.equip'), size: 'sm', variant: 'primary', onClick: () => { DK.bag.equip(d, choosingSlot, item.id); DK.audio.sfx('select'); toast(t('equip.done', { name: DK.daskai.name(d), item: item.name }), { icon: 'gem', kind: 'good' }); state.open = null; changed(); } }))))
        : h('p', { class: 'muted small' }, t('equip.noneText'))) : null;
    return h('div', null, h('div', { class: 'equip-grid' }, slots), chooser);
  }

  /* ---------- Aprendizaje y evolución ---------- */
  function learnTab(d, changed) {
    const sp = D.species[d.species];
    // v4.51: la siguiente forma sale de las formas de ESTE daskai (1-4), no sólo de su especie
    const nf = DK.daskai.nextForm(d), evo = nf && D.species[nf.into], fo = DK.daskai.formsOf(d);
    const evoName = nf ? DK.daskai.speciesName({ species: nf.into, extra: (d.extra || 0) + (nf.extra ? 1 : 0) }) : '';
    const pips = h('span', { class: 'forms-pips', tip: t('evo.formsTip', { n: fo.now + 1, total: fo.total }) }, Array.from({ length: fo.total }, (_, i) => h('i', { class: i <= fo.now ? 'on' : '' })));
    return h('div', null,
      !evo ? h('div', { class: 'card evo-info' }, pips, h('div', { class: 'grow' }, h('b', null, fo.total === 1 ? t('evo.single') : t('evo.lastForm')), h('p', { class: 'muted small' }, fo.total === 1 ? t('evo.singleInfo') : t('evo.lastInfo')))) : null,
      evo ? h('div', { class: 'card evo-info' }, V.sprite(evo.id, { look: DK.looks.of(d, (d.form || 0) + 1), size: 64, silhouette: d.level < nf.level, shiny: !!d.shiny }),
        h('div', { class: 'grow' }, h('b', null, d.level >= nf.level ? t('evo.readyLong', { into: evoName }) : t('evo.at', { n: nf.level })),
          h('p', { class: 'muted small' }, pips, ' ', t('evo.formsTip', { n: fo.now + 1, total: fo.total }), ' · ', t('evo.info'))),
        DK.daskai.canEvolve(d) ? btn({ icon: 'evolve', label: t('evo.button'), variant: 'primary', onClick: async () => { if (await V.evolveDialog(d)) changed(); } }) : null) : null,
      h('div', { class: 'learn-list' }, sp.learn.map(([lv, mid]) => {
        const m = D.moves[mid];
        const known = d.learned.includes(mid);
        return h('div', { class: 'learn-row ' + (known ? 'known' : lv <= d.level ? '' : 'locked') },
          h('span', { class: 'lvl' }, t('common.lvl') + ' ', h('b', null, lv)),
          DK.icon(m.kind === 'fisico' ? 'sword' : 'wand', 16),
          h('b', { class: 'grow' }, m.name), V.kindTag(m.kind),
          h('span', { class: 'muted small' }, m.power ? t('move.power', { n: m.power }) : t('move.support')),
          h('span', { class: 'muted small' }, m.kind === 'fisico' ? t('move.free') : `${m.mp} ${t('common.mpShort')}`),
          known ? h('span', { class: 'badge good' }, DK.icon('check', 13), t('detail.learned')) : h('span', { class: 'badge' }, DK.icon('lock', 13), t('detail.pending')));
      })));
  }
})();
