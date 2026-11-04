/* =============================================================
 * screens/codex.js — Códice.
 *
 * Nunca está vacío: desde el principio se ven TODAS las especies, objetos
 * y jefes; lo que aún no conoces sale como silueta o «???».
 *   Pestañas: Daskai · Zonas (% de cada zona) · Objetos · Jefes · Guía
 *   (wiki con lo desbloqueado: data/wiki.js).
 *   Filtros (Daskai): casa, zona y estado (vistos / vencidos / vinculados).
 *   Ficha de especie: dónde aparece, evolución, ataques por nivel, punto
 *   débil, lo que suelta y tu mejor ejemplar. Lo que no sabes se revela
 *   poco a poco (verla, luchar contra ella, vincularla).
 * Datos: DK.codex.species(id), DK.codex.itemKnown(id), DK.codex.totals().
 *
 * params: { tab, house, zone, state, q, sel, wsel (entrada de la guía abierta) }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const C = () => DK.codex;

  DK.menus.add('nav', { id: 'codex', icon: 'book', order: 50, screen: 'codex', label: () => t('nav.codex') });

  /** Orden «natural» de las especies: por zona en la que aparecen y luego por nombre. */
  const zoneIndex = (sid) => { const z = Object.keys(D.zones).findIndex((zid) => D.zones[zid].enemies.some((e) => e.species === sid)); return z < 0 ? 99 : z; };
  const STATUS_ORDER = { captured: 0, fought: 1, seen: 2, unknown: 3 };

  /* ---------------- Ficha de especie ---------------- */
  function speciesSheet(sid, open) {
    const sp = D.species[sid], info = C().species(sid);
    const known = info.status !== 'unknown';
    const fought = info.fought > 0 || info.status === 'captured';
    const captured = info.status === 'captured';
    if (!known) {
      return h('div', { class: 'cx-sheet stack' },
        h('div', { class: 'cx-head unknown' }, V.sprite(sid, { size: 120, silhouette: true }),
          h('div', null, h('h2', null, '???'), h('p', { class: 'muted' }, t('codex.unknownText')),
            info.spawn.length ? h('p', { class: 'small' }, DK.icon('map', 13), ' ', t('codex.hintZone', { zone: D.zones[info.spawn[0]].name })) : h('p', { class: 'small muted' }, t('codex.hintEvo')))));
    }
    // Línea evolutiva (las desconocidas en silueta)
    const line = []; let root = sid;
    while (D.species[root].evolvedFrom) root = D.species[root].evolvedFrom;
    for (let cur = root, i = 0; cur && i < 5; i++) { line.push(cur); cur = D.species[cur].evolve && D.species[cur].evolve.into; }
    const evoRow = line.length > 1 ? h('div', { class: 'cx-evo' }, line.map((x, i) => {
      const k = C().species(x).status !== 'unknown';
      return [i ? h('span', { class: 'cx-evo-arrow' }, DK.icon('next', 14), h('small', null, `${t('common.lvl')} ${D.species[line[i - 1]].evolve.level}`)) : null,
        h('button', { class: 'cx-evo-mon' + (x === sid ? ' on' : ''), type: 'button', disabled: !k, onClick: () => open(x) }, V.sprite(x, { size: 54, silhouette: !k }), h('span', null, k ? D.species[x].name : '???'))];
    })) : null;
    const moves = sp.learn.map(([lv, mid]) => {
      const show = captured || info.moves.includes(mid) || (fought && info.fought >= DK.config.revealMovesAt);
      const m = D.moves[mid];
      return h('div', { class: 'cx-move' + (show ? '' : ' hidden') }, h('span', { class: 'cx-lv' }, `${t('common.lvl')} ${lv}`),
        show ? [DK.icon(m.kind === 'fisico' ? 'sword' : 'wand', 14), h('b', null, m.name), m.house ? h('span', { class: 'muted small' }, DK.tr('houses', D.houses[m.house])) : null, h('span', { class: 'muted small cx-pow' }, m.power ? t('move.power', { n: m.power }) : t('move.support'))]
          : h('span', { class: 'muted' }, '???'));
    });
    const weakKnown = DK.battle.weakKnown(sid);
    const weak = DK.battle.weakness(sid);
    return h('div', { class: 'cx-sheet stack' },
      h('div', { class: 'cx-head', style: { '--c': D.houseColor(sp.house) } },
        V.sprite(sid, { size: 120, cls: 'float' }),
        h('div', { class: 'stack-s' }, h('h2', null, sp.name),
          h('div', { class: 'row gap-s wrap' }, V.houseBadge(sp.house, { known: fought }), h('span', { class: 'badge cx-st st-' + info.status }, t('codex.status.' + info.status))),
          h('p', { class: 'muted' }, sp.desc))),
      h('div', { class: 'cx-stats' },
        [['eye', t('codex.seenL'), info.seen], ['swords', t('codex.foughtL'), info.fought], ['trophy', t('codex.defeatedL'), info.defeated], ['orb', t('codex.capturedL'), info.captured + (info.owned.length && !info.captured ? info.owned.length : 0)]]
          .map(([ic, l, n]) => h('div', { class: 'cx-stat' }, DK.icon(ic, 16), h('b', null, String(n)), h('span', { class: 'muted small' }, l)))),
      h('section', { class: 'cx-block' }, h('h4', null, t('codex.where')),
        info.spawn.length ? h('div', { class: 'chips' }, info.spawn.map((z) => h('span', { class: 'chip' }, DK.icon(D.zones[z].icon, 13), `${D.zones[z].name} · ${t('common.lvl')} ${D.zones[z].levels[0]}-${D.zones[z].levels[1]}`)))
          : h('p', { class: 'muted small' }, sp.evolvedFrom ? t('codex.onlyEvo', { from: C().species(sp.evolvedFrom).status !== 'unknown' ? D.species[sp.evolvedFrom].name : '???' }) : t('codex.nowhere'))),
      evoRow ? h('section', { class: 'cx-block' }, h('h4', null, t('codex.evoLine')), evoRow) : null,
      h('section', { class: 'cx-block' }, h('h4', null, t('codex.weakness')),
        h('p', { class: 'small' }, !weakKnown ? t('codex.weakUnknown') : weak ? t('codex.weakIs', { kind: t('codex.kind.' + weak) }) : t('codex.noWeak'))),
      h('section', { class: 'cx-block' }, h('h4', null, t('codex.movesByLevel')), h('div', { class: 'cx-moves' }, moves),
        !captured ? h('p', { class: 'muted small' }, t('codex.movesHint', { n: DK.config.revealMovesAt })) : null),
      sp.drops.length ? h('section', { class: 'cx-block' }, h('h4', null, t('codex.drops')),
        h('div', { class: 'cx-drops' }, sp.drops.map(([iid, p]) => info.drops.includes(iid)
          ? h('span', { class: 'chip' }, DK.icon(D.items[iid].icon, 13), `${D.items[iid].name} · ${p < 0.01 ? (p * 100).toFixed(1) : Math.round(p * 100)}%`)
          : h('span', { class: 'chip muted' }, DK.icon('question', 13), '???')))) : null,
      h('section', { class: 'cx-block' }, h('h4', null, t('codex.yours')),
        info.best ? h('div', { class: 'row gap-s' }, V.daskaiRow(info.best, { compact: true, onClick: () => DK.router.reset('team', { uid: info.best.uid }) }))
          : h('p', { class: 'muted small' }, t('codex.notYours'))));
  }

  /* ---------------- Pestaña Daskai ---------------- */
  function speciesTab(params, open) {
    let list = Object.keys(D.species);
    const q = (params.q || '').trim().toLowerCase();
    list = list.filter((s) => {
      const info = C().species(s);
      if (params.house && params.house !== 'all' && D.species[s].house !== params.house) return false;
      if (params.zone && params.zone !== 'all' && !info.spawn.includes(params.zone)) return false;
      if (params.state && params.state !== 'all' && info.status !== params.state && !(params.state === 'fought' && info.status === 'captured')) return false;
      if (q && !(info.status !== 'unknown' && D.species[s].name.toLowerCase().includes(q))) return false;
      return true;
    });
    list.sort((a, b) => zoneIndex(a) - zoneIndex(b) || D.species[a].name.localeCompare(D.species[b].name));
    const filters = h('div', { class: 'cx-filters' },
      DK.ui.select({ label: t('codex.house'), value: params.house || 'all', onChange: (v) => { params.house = v; DK.router.refresh(); },
        options: [{ value: 'all', label: t('codex.allHouses') }, ...Object.keys(D.houses).map((k) => ({ value: k, label: DK.tr('houses', D.houses[k]) }))] }),
      DK.ui.select({ label: t('codex.zone'), value: params.zone || 'all', onChange: (v) => { params.zone = v; DK.router.refresh(); },
        options: [{ value: 'all', label: t('codex.allZones') }, ...Object.keys(D.zones).filter((k) => !D.zones[k].secretZone || DK.world.isUnlocked(k)).map((k) => ({ value: k, label: DK.world.isUnlocked(k) ? D.zones[k].name : '???' }))] }),
      DK.ui.select({ label: t('codex.stateL'), value: params.state || 'all', onChange: (v) => { params.state = v; DK.router.refresh(); },
        options: ['all', 'seen', 'fought', 'captured', 'unknown'].map((k) => ({ value: k, label: t('codex.filter.' + k) })) }));
    const grid = list.length ? h('div', { class: 'cx-grid' }, list.map((s) => {
      const info = C().species(s), known = info.status !== 'unknown';
      return h('button', { class: `cx-card st-${info.status}` + (params.sel === s ? ' selected' : ''), type: 'button', style: { '--c': D.houseColor(D.species[s].house) }, onClick: () => open(s) },
        V.sprite(s, { size: 70, silhouette: !known }),
        h('b', null, known ? D.species[s].name : '???'),
        h('span', { class: 'cx-card-st' }, DK.icon(info.status === 'captured' ? 'orb' : info.status === 'fought' ? 'swords' : info.status === 'seen' ? 'eye' : 'question', 12), t('codex.status.' + info.status)));
    })) : DK.ui.empty('book', t('craft.emptyTitle'), '');
    return h('div', { class: 'stack' }, filters, grid);
  }

  /* ---------------- Pestaña Objetos ---------------- */
  function itemsTab(params) {
    const q = (params.q || '').trim().toLowerCase();
    return h('div', { class: 'stack' }, ['batalla', 'mejora', 'equipo', 'pieza'].map((cat) => {
      const ids = Object.values(D.items).filter((it) => it.category === cat && !D.isHidden(it.id) && (!q || (C().itemKnown(it.id) && it.name.toLowerCase().includes(q)))).map((it) => it.id);
      if (!ids.length) return null;
      const known = ids.filter((id) => C().itemKnown(id)).length;
      return h('section', { class: 'cx-items' },
        h('h4', { class: 'inv-group-head' }, DK.icon(D.categories[cat].icon, 14), DK.tr('categories', D.categories[cat]), h('span', { class: 'muted' }, `${known}/${ids.length}`)),
        h('div', { class: 'cx-item-grid' }, ids.map((id) => {
          const it = D.items[id], k = C().itemKnown(id);
          return h('button', { class: 'cx-item' + (k ? '' : ' unknown'), type: 'button', disabled: !k, tip: k ? it.desc : t('codex.itemHint'), onClick: () => V.openItem && V.openItem(id) },
            k ? V.itemIcon(it, 22) : h('span', { class: 'item-icon' }, DK.icon('question', 22)),
            h('span', { class: 'cx-item-main' }, h('b', null, k ? it.name : '???'), k ? h('span', { class: 'muted small' }, DK.tr('rarities', D.rarities[it.rarity])) : null));
        })));
    }));
  }

  /* ---------------- Pestaña Jefes ---------------- */
  function bossesTab() {
    const card = (zid, b, secret) => {
      const rec = secret ? DK.world.secret(zid) : DK.world.boss(zid);
      const done = rec.defeated > 0, found = done || (secret && rec.found > 0);
      const z = D.zones[zid], zoneKnown = DK.world.isUnlocked(zid);
      return h('div', { class: 'cx-boss' + (done ? ' done' : '') + (secret ? ' secret' : ''), style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
        h('div', { class: 'cx-boss-art' }, V.sprite(b.species, { size: 84, silhouette: !found })),
        h('div', { class: 'stack-s grow' },
          h('span', { class: 'badge ' + (secret ? 'warn' : 'leader') }, DK.icon(secret ? 'cave' : 'crown', 12), secret ? t('exp.secretBoss') : t('codex.boss')),
          h('b', null, found ? b.title : '???'),
          h('span', { class: 'muted small' }, (zoneKnown ? z.name : '???') + (found ? ` · ${D.species[b.species].name} · ${t('common.lvl')} ${b.level}` : '')),
          h('span', { class: 'small ' + (done ? 'good-text' : 'muted') }, done ? t('codex.bossDefeated', { n: rec.defeated, level: b.level })
            : secret ? (zoneKnown ? t('codex.secretHint', { zone: z.name }) : t('codex.secretHintUnknown')) : t('codex.bossHint'))));
    };
    return h('div', { class: 'stack' },
      h('h4', { class: 'inv-group-head' }, DK.icon('crown', 14), t('codex.zoneBosses')),
      h('div', { class: 'cx-boss-grid' }, Object.keys(D.zones).filter((zid) => !D.zones[zid].secretZone || DK.world.isUnlocked(zid)).map((zid) => card(zid, D.zones[zid].boss, false))),
      h('h4', { class: 'inv-group-head' }, DK.icon('cave', 14), t('codex.secretBosses')),
      h('div', { class: 'cx-boss-grid' }, Object.keys(D.secretBosses || {}).map((zid) => card(zid, D.secretBosses[zid], true))));
  }

  /* ---------------- Pestaña Zonas (% del códice por zona) ---------------- */
  /** % medio del códice de zonas (todas las zonas visibles cuentan). */
  const zoneIds = () => Object.keys(D.zones).filter((zid) => !D.zones[zid].secretZone || DK.world.isUnlocked(zid));
  const zonesPct = () => { const z = zoneIds(); return z.reduce((a, id) => a + C().completion(id), 0) / Math.max(1, z.length); };
  function zonesTab(params) {
    const late = DK.endgame.late();
    const card = (zid) => {
      const z = D.zones[zid], open = DK.world.isUnlocked(zid), pct = C().completion(zid);
      const list = z.enemies.map((e) => e.species), rec = C().zone(zid), seen = list.filter((sid) => rec && rec.enemies[sid]).length;
      const fought = list.filter((sid) => ['fought', 'captured'].includes(C().species(sid).status)).length;
      const boss = DK.world.boss(zid).defeated > 0, full = pct >= 1;
      return h('button', { class: 'cx-zone' + (open ? '' : ' off') + (full ? ' full' : ''), type: 'button', disabled: !open, style: { '--z1': z.colors[0], '--z2': z.colors[1] },
        tip: open ? t('codex.zoneTip') : t('codex.zoneLocked'), onClick: () => { params.tab = 'species'; params.zone = zid; params.sel = null; DK.router.refresh(); } },
        h('span', { class: 'cx-zone-icon' }, DK.icon(open ? (z.icon || 'map') : 'lock', 20)),
        h('span', { class: 'cx-zone-main' },
          h('span', { class: 'row between gap-s' }, h('b', null, open ? z.name : '???'), h('b', { class: 'cx-zone-pct' }, Math.round(pct * 100) + '%')),
          h('span', { class: 'cx-zone-bar' }, h('i', { style: { width: Math.round(pct * 100) + '%' } })),
          open ? h('span', { class: 'cx-zone-meta' },
            h('span', null, DK.icon('eye', 11), ' ', t('codex.zoneSeen', { n: seen, max: list.length })),
            h('span', null, DK.icon('swords', 11), ' ', fought),
            boss ? h('span', { class: 'good-text' }, DK.icon('crown', 11), ' ', t('codex.zoneBoss')) : null,
            full && late ? h('span', { class: 'cx-zone-nm' }, DK.icon('moon', 11), ' ', t('codex.zoneNightmare')) : null) : null));
    };
    return h('div', { class: 'stack' },
      h('p', { class: 'muted small' }, late ? t('codex.zonesHintLate') : t('codex.zonesHint')),
      h('div', { class: 'cx-zone-grid' }, zoneIds().map(card)));
  }

  /* ---------------- Pestaña Guía (wiki de lo desbloqueado) ---------------- */
  function wikiTab(params) {
    const q = (params.q || '').trim().toLowerCase();
    const groups = D.wikiGroups.map((g) => {
      const all = D.wiki.filter((e) => e.group === g), known = all.filter((e) => DK.wiki.known(e));
      const shown = known.filter((e) => !q || (DK.wiki.title(e) + ' ' + DK.wiki.body(e)).toLowerCase().includes(q));
      if (q && !shown.length) return null;
      const locked = all.length - known.length;
      return h('section', { class: 'wk-group' },
        h('h4', { class: 'inv-group-head' }, DK.icon(all[0].icon, 14), t(['wiki', 'g', g].join('.')), h('span', { class: 'muted' }, `${known.length}/${all.length}`)),
        h('div', { class: 'wk-list' },
          shown.map((e) => h('details', { class: 'wk-entry', open: params.wsel === e.id || !!q, 'data-id': e.id },
            h('summary', null, h('span', { class: 'wk-icon' }, DK.icon(e.icon, 16)), h('b', null, DK.wiki.title(e)),
              e.stat ? h('span', { class: 'wk-stat' }, e.stat()) : null, DK.icon('next', 14)),
            h('div', { class: 'wk-body' }, DK.wiki.body(e).split('\n').map((para) => h('p', null, para))))),
          !q && locked ? h('div', { class: 'wk-entry locked' }, h('span', { class: 'wk-icon' }, DK.icon('lock', 14)), h('span', { class: 'muted' }, t('wiki.lockedN', { n: locked }))) : null));
    }).filter(Boolean);
    if (params.wsel) { const id = params.wsel; setTimeout(() => { const el = document.querySelector(`.wk-entry[data-id="${id}"]`); if (el) el.scrollIntoView({ block: 'center' }); }, 60); params.wsel = null; }
    return h('div', { class: 'stack' }, h('p', { class: 'muted small' }, t('wiki.intro')),
      groups.length ? groups : DK.ui.empty('book', t('wiki.empty'), ''));
  }

  DK.screens.register('codex', {
    title: () => t('codex.title'), icon: 'book', section: 'codex', tutorial: 'codex', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.tab = params.tab || 'species';
      const tot = C().totals();
      const narrow = DK.ui.isNarrow();
      const open = (sid) => {
        params.sel = sid;
        if (!narrow) { refresh(); return; }
        const holder = h('div');
        const draw = (x) => holder.replaceChildren(speciesSheet(x, (y) => { params.sel = y; draw(y); }));
        draw(sid);
        DK.ui.drawer({ title: t('codex.title'), icon: 'book', size: 'wide', content: holder }).promise.then(() => { params.sel = null; });
      };
      const pct = (a, b) => Math.round((a / Math.max(1, b)) * 100) + '%';
      const tabs = h('div', { class: 'inv-tabs cx-tabs' }, [['species', 'paw', t('codex.tabSpecies'), pct(tot.species, tot.speciesTotal)], ['zones', 'map', t('codex.tabZones'), Math.round(zonesPct() * 100) + '%'], ['items', 'gift', t('codex.tabItems'), pct(tot.items, tot.itemsTotal)], ['bosses', 'crown', t('codex.tabBosses'), `${tot.bosses}/${tot.bossesTotal}`], ['wiki', 'book', t('wiki.tab'), `${DK.wiki.unlocked().length}/${D.wiki.length}`]]
        .map(([id, icon, label, n]) => h('button', { class: 'inv-tab' + (params.tab === id ? ' on' : ''), type: 'button', onClick: () => { params.tab = id; params.sel = null; params.q = ''; refresh(); } }, DK.icon(icon, 18), h('span', null, label), h('b', null, n))));
      const search = ['species', 'items', 'wiki'].includes(params.tab) ? h('input', { class: 'input inv-search', type: 'search', placeholder: params.tab === 'wiki' ? t('wiki.search') : t('codex.search'), value: params.q || '',
        onInput: (e) => { params.q = e.target.value; clearTimeout(params._qt); params._qt = setTimeout(() => { refresh(); const i = document.querySelector('.inv-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } }) : null;
      const body = params.tab === 'species' ? speciesTab(params, open) : params.tab === 'items' ? itemsTab(params) : params.tab === 'zones' ? zonesTab(params) : params.tab === 'wiki' ? wikiTab(params) : bossesTab();
      const side = params.tab === 'species' && params.sel && !narrow ? h('aside', { class: 'card inv-side cx-side' },
        h('div', { class: 'row between' }, h('span', { class: 'muted small' }, DK.icon('book', 13), ' ', t('codex.sheet')), btn({ icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { params.sel = null; refresh(); } })),
        speciesSheet(params.sel, open)) : null;
      return h('div', { class: 'screen cx-screen' },
        h('div', { class: 'card cx-hero' },
          h('span', { class: 'cx-hero-icon' }, DK.icon('book', 28)),
          h('div', { class: 'grow' }, h('h2', null, t('codex.title')), h('p', { class: 'muted small' }, t('codex.intro'))),
          h('div', { class: 'cx-progress' }, h('b', null, pct(tot.species + tot.items + tot.bosses, tot.speciesTotal + tot.itemsTotal + tot.bossesTotal)), h('span', { class: 'muted small' }, t('codex.complete')))),
        tabs, search ? h('div', { class: 'cx-search-row' }, search) : null,
        h('div', { class: 'inv-main' + (side ? ' has-detail' : '') }, h('div', { class: 'inv-list-wrap' }, body), side));
    },
  });
})();
