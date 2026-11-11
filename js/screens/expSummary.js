/* =============================================================
 * screens/expSummary.js — Resumen al terminar una expedición.
 *
 * Se abre al derrotar al jefe, al retirarse o al perder. Usa el
 * resumen guardado en DK.store.state.lastExpedition (lo crea
 * DK.expedition.snapshot): camino recorrido, nodos visitados,
 * mapas superados (profundidad), botín, reclutas y reliquias.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  /** Singular (clave + 'One') cuando n es 1. */
  const tn = (key, n) => t(n === 1 ? key + 'One' : key, { n });

  const OUT = {
    completed: { icon: 'trophy', cls: 'good' },
    retreat: { icon: 'flag', cls: 'warn' },
    lost: { icon: 'skull', cls: 'bad' },
    lostBoss: { icon: 'crown', cls: 'bad' },
    campfire: { icon: 'campfire', cls: 'warn' },
  };

  /**
   * Mejoras permanentes: sólo existen AQUÍ, al terminar la expedición. El menú
   * se abre solo la primera vez que se ve el resumen (s.shopShown) y se
   * puede volver a abrir con la tarjeta o el botón de arriba.
   */
  function upgradeCardSummary(s, refresh) {
    const n = DK.camp.affordable();
    return h('button', { class: 'card sum-shop', type: 'button', onClick: () => V.upgradeMenu(refresh) },
      h('span', { class: 'sum-shop-icon' }, DK.icon('emblem', 26)),
      h('span', { class: 'grow stack-s' }, h('b', null, t('sum.shopTitle')),
        h('span', { class: 'muted small' }, s.emblems ? tn('sum.shopEarned', s.emblems) : t('sum.shopNone'), ' ', n ? tn('sum.shopCan', n) : t('sum.shopSave'))),
      V.emblems(DK.camp.emblems()), DK.icon('next', 18));
  }

  /** v4.74: chips de las piezas de equipo encontradas (con el color de su rareza). */
  const gearChips = (list, lost) => (list || []).length ? h('div', { class: 'chips' }, list.map((p) => D.items[p.base] ? h('span', { class: 'chip gear-chip' + (lost ? ' neg' : ''), style: { '--g': D.gear.rarities[p.rarity].color }, tip: t('gear.rarity.' + p.rarity) + ' · ' + t('gear.ilvlN', { n: p.ilvl }) },
    DK.icon(D.items[p.base].icon, 13), lost ? h('s', null, p.name) : p.name) : null)) : null;

  /** Chips de objetos { id: n }. lost=true los muestra tachados. */
  const itemChips = (items, lost) => {
    const list = Object.entries(items || {});
    return list.length ? h('div', { class: 'chips' }, list.map(([id, n]) => D.items[id] ? h('span', { class: 'chip ' + (lost ? 'neg' : 'pos') }, DK.icon(D.items[id].icon, 13), lost ? h('s', null, `${D.items[id].name} x${n}`) : `${D.items[id].name} x${n}`) : null)) : h('p', { class: 'muted small' }, t('sum.none'));
  };

  /* ---------- Línea de tiempo ---------- */
  const TL_ICON = { start: 'flag', newMap: 'map', elite: 'skull', boss: 'crown', secret: 'cave', recruit: 'paw', relic: 'amulet', cave: 'cave', caveTreasure: 'gift',
    shortcut: 'shortcut', event: 'question', saved: 'sparkles', fallen: 'skull', mapCleared: 'trophy', campfire: 'campfire', cashout: 'coin', retreat: 'flag', lost: 'skull', quest: 'checkCircle' };
  const TL_KIND = { boss: 'good', secret: 'good', mapCleared: 'good', recruit: 'good', relic: 'good', cashout: 'good', quest: 'good', fallen: 'bad', lost: 'bad', saved: 'warn' };
  function tlText(ev) {
    const v = ev.v || {};
    const vars = Object.assign({}, v);
    if (v.zone) vars.zone = D.zones[v.zone] ? D.zones[v.zone].name : v.zone;
    if (v.size) vars.size = t('size.' + v.size + '.name');
    if (v.species) vars.species = D.species[v.species] ? D.species[v.species].name : v.species;
    if (v.id && ev.k === 'relic') vars.relic = D.relics[v.id] ? D.relics[v.id].name : v.id;
    if (v.id && ev.k === 'event') vars.event = t(`events.${v.id}.title`);
    if (v.id && ev.k === 'quest') vars.name = t(`quest.${v.id}.name`);
    let text = t('tl.' + ev.k, vars);
    if ((ev.k === 'start' || ev.k === 'newMap') && v.mod) text += ' · ' + t('mod.' + v.mod + '.name');
    return text;
  }
  function timeline(s) {
    const list = s.timeline || [];
    if (!list.length) return null;
    const t0 = list[0].at;
    return h('div', { class: 'card stack-s sum-tl' },
      h('div', { class: 'panel-head' }, DK.icon('clock', 18), h('h3', null, t('sum.timeline')), h('span', { class: 'muted small' }, t('sum.moments', { n: list.length }))),
      h('ol', { class: 'tl' }, list.map((ev) => h('li', { class: 'tl-item k-' + (TL_KIND[ev.k] || '') },
        h('span', { class: 'tl-dot' }, DK.icon(TL_ICON[ev.k] || 'info', 14)),
        h('span', { class: 'tl-text' }, tlText(ev)),
        h('span', { class: 'tl-meta muted small' }, `${t('exp.depth', { n: ev.d })}${ev.f ? ' · ' + t('sum.floorN', { n: ev.f }) : ''} · ${DK.util.duration(Math.round((ev.at - t0) / 1000))}`)))));
  }
  /** Comparación con tu mejor expedición anterior (por profundidad y luego monedas). */
  function compare(s) {
    const hist = (DK.store.state.expHistory || []).filter((x) => x !== s && x.endedAt !== s.endedAt);
    if (!hist.length) return null;
    const best = hist.slice().sort((a, b) => (b.depth || 1) - (a.depth || 1) || (b.coins || 0) - (a.coins || 0))[0];
    const row = (icon, label, now, prev, fmt = String) => {
      const diff = now - prev;
      return h('div', { class: 'cmp-row' }, DK.icon(icon, 15), h('span', { class: 'grow' }, label), h('b', null, fmt(now)),
        h('span', { class: 'cmp-diff ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '') }, diff > 0 ? '▲ ' + fmt(diff) : diff < 0 ? '▼ ' + fmt(-diff) : '='), h('span', { class: 'muted small' }, t('sum.bestWas', { v: fmt(prev) })));
    };
    const dur = (x) => Math.round(((x.endedAt || 0) - (x.startedAt || 0)) / 1000);
    const isRecord = (s.depth || 1) > (best.depth || 1) || ((s.depth || 1) === (best.depth || 1) && (s.coins || 0) > (best.coins || 0));
    return h('div', { class: 'card stack-s sum-cmp' },
      h('div', { class: 'panel-head' }, DK.icon('trophy', 18), h('h3', null, t('sum.compare')), isRecord ? h('span', { class: 'badge good' }, DK.icon('star', 12), t('sum.newRecord')) : null),
      row('compass', t('sum.cmpDepth'), s.depth || 1, best.depth || 1),
      row('coin', t('sum.cmpCoins'), s.coins || 0, best.coins || 0),
      row('emblem', t('emblem.title'), s.emblems || 0, best.emblems || 0),
      row('clock', t('sum.cmpTime'), dur(s), dur(best), (n) => DK.util.duration(n)));
  }

  /* ---------- v5.9: equipo, rivales y cifras clave ---------- */
  function statStrip(s, kept) {
    const team = s.team || [], foes = s.foes || [];
    const lv = team.reduce((a, x) => a + Math.max(0, (x.to || 0) - (x.from || 0)), 0);
    const items = Object.values(s.items || {}).reduce((a, n) => a + n, 0) + (s.gear || []).length;
    const cell = (icon, v, label, cls = '') => h('div', { class: 'ss-cell ' + cls }, h('span', { class: 'ss-ico' }, DK.icon(icon, 18)), h('b', null, v), h('small', null, label));
    return h('div', { class: 'sum-strip' },
      cell('swords', String(foes.filter((x) => x.won).length), t('sum5.won')),
      cell('arrowUp', '+' + lv, t('sum5.levels'), lv ? 'up' : ''),
      cell('coin', (kept || s.outcome === 'retreat' || s.outcome === 'lostBoss' ? s.coins || 0 : 0).toLocaleString(DK.i18n.lang), t('hub.coins')),
      cell('gift', String(items), t('sum5.items')),
      cell('emblem', String(s.emblems || 0), t('emblem.title')),
      cell('flag', `${Math.min(s.step, s.total)}/${s.total}`, t('sum5.floors')));
  }
  function teamPanel(s) {
    const team = s.team || [];
    if (!team.length) return null;
    const sorted = team.slice().sort((a, b) => ((b.to || 0) - (b.from || 0)) - ((a.to || 0) - (a.from || 0)));
    return h('section', { class: 'card sum-team' },
      h('div', { class: 'panel-head' }, h('h3', null, t('sum5.team'))),
      h('div', { class: 'st-grid' }, sorted.map((x, i) => {
        const up = Math.max(0, (x.to || 0) - (x.from || 0));
        const sp = D.species[x.species]; if (!sp) return null;
        const live = x.uid && DK.party.get(x.uid);
        return h(live ? 'button' : 'div', { class: 'st-card' + (x.fallen ? ' fallen' : x.fainted ? ' ko' : '') + (up ? ' leveled' : ''), type: live ? 'button' : null, style: { '--i': i, '--c': D.houseColor(sp.house || (D.species[sp.evolvedFrom] || {}).house) },
          onClick: live ? () => V.quickStats(live, { onChange: () => DK.router.refresh() }) : null },
          h('span', { class: 'st-art' }, V.sprite(x.species, { look: x.look, shiny: x.shiny, size: 84, cls: x.fallen ? '' : 'alive' })),
          h('b', { class: 'st-name' }, x.name),
          h('span', { class: 'st-lv' }, h('span', { class: 'muted' }, `${t('common.lvl')} ${x.from}`), DK.icon('next', 13), h('b', null, x.to)),
          up ? h('span', { class: 'st-up' }, DK.icon('arrowUp', 12), tn('sum5.upN', up)) : h('span', { class: 'st-up none' }, t('sum5.noUp')),
          x.fallen ? h('span', { class: 'st-tag bad' }, DK.icon('skull', 11), t('sum5.fallen')) : x.recruit ? h('span', { class: 'st-tag good' }, DK.icon('paw', 11), t('sum5.recruit')) : x.fainted ? h('span', { class: 'st-tag warn' }, DK.icon('heart', 11), t('sum5.ko')) : null);
      })));
  }
  function foesPanel(s) {
    const foes = s.foes || [];
    if (!foes.length) return null;
    // agrupados por especie: cuántas veces, nivel más alto, si fue jefe / élite / vinculado
    const by = new Map();
    foes.forEach((f) => { const k = f.species + (f.boss ? ':b' : f.elite ? ':e' : ''); const g = by.get(k) || Object.assign({ n: 0, max: 0, won: 0, cap: 0 }, f); g.n++; g.max = Math.max(g.max, f.level || 0); if (f.won) g.won++; if (f.captured) g.cap++; if (!g.shiny && f.shiny) { g.shiny = true; g.look = f.look; } by.set(k, g); });
    const list = [...by.values()].sort((a, b) => (b.boss - a.boss) || (b.elite - a.elite) || b.max - a.max);
    return h('section', { class: 'card sum-foes' },
      h('div', { class: 'panel-head' }, h('h3', null, t('sum5.foes')), h('span', { class: 'muted small' }, t('sum5.foesHint', { n: foes.length, k: list.length }))),
      h('div', { class: 'sf-grid' }, list.map((g, i) => {
        const sp = D.species[g.species]; if (!sp) return null;
        // v5.16: al pulsarlo se ve en grande (sólo el dibujo: sin atributos)
        const zoom = () => DK.ui.modal({ title: sp.name, closeX: true, cls: 'sf-zoom', content: h('div', { class: 'sfz-wrap' + (g.boss ? ' boss' : '') },
          h('div', { class: 'sfz-art', style: { '--c': D.houseColor(sp.house || (D.species[sp.evolvedFrom] || {}).house) } }, V.sprite(g.species, { look: g.look, shiny: g.shiny, size: 280, flip: true, cls: 'alive' })),
          h('div', { class: 'sfz-meta' }, h('span', null, `${t('common.lvl')} ${g.max}`), g.n > 1 ? h('span', null, '×' + g.n) : null,
            g.boss ? h('span', { class: 'sf-tag boss' }, DK.icon('crown', 11), t('battle.boss')) : g.elite ? h('span', { class: 'sf-tag elite' }, DK.icon('skull', 11), t('exp.node.elite')) : null,
            g.shiny ? h('span', { class: 'sf-tag cap' }, DK.icon('sparkles', 11), t('common.shiny')) : null)) });
        return h('button', { type: 'button', class: 'sf-card' + (g.boss ? ' boss' : g.elite ? ' elite' : '') + (g.won ? '' : ' lost'), style: { '--i': i }, tip: `${sp.name} · ${t('common.lvl')} ${g.max}`, onClick: zoom },
          h('span', { class: 'sf-art' }, V.sprite(g.species, { look: g.look, shiny: g.shiny, size: g.boss ? 76 : 60, flip: true, cls: 'alive' })),
          h('b', null, sp.name), h('small', { class: 'muted' }, `${t('common.lvl')} ${g.max}`),
          g.n > 1 ? h('span', { class: 'sf-n' }, '×' + g.n) : null,
          g.boss ? h('span', { class: 'sf-tag boss' }, DK.icon('crown', 11), t('battle.boss')) : g.elite ? h('span', { class: 'sf-tag elite' }, DK.icon('skull', 11), t('exp.node.elite')) : null,
          g.cap ? h('span', { class: 'sf-tag cap' }, DK.icon('paw', 11), t('sum5.bonded')) : null,
          !g.won ? h('span', { class: 'sf-tag lost' }, DK.icon('x', 11), t('sum5.notBeaten')) : null);
      })));
  }

  DK.screens.register('expSummary', {
    title: () => t('sum.title'), icon: 'list', section: 'battle', music: 'menu',
    /** params.index → resumen de DK.store.state.expHistory[index] (desde el Perfil); si no, el último. */
    render(params) {
      const refresh = () => DK.router.refresh();
      const hist = DK.store.state.expHistory || [];
      const s = params && params.index != null ? hist[params.index] : DK.store.state.lastExpedition;
      if (!s) return h('div', { class: 'screen' }, DK.ui.empty('list', t('sum.empty'), ''), btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') }));
      const zone = D.zones[s.zone];
      const o = OUT[s.outcome] || OUT.retreat;
      const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 1000));
      const nodes = Object.entries(s.nodes || {});
      const totalNodes = nodes.reduce((a, [, n]) => a + n, 0);
      const kept = s.outcome === 'completed' || s.outcome === 'campfire';
      const latest = !(params && params.index != null);
      const again = () => DK.play.quick();
      const depth = s.depth || 1, zonesDone = s.zones || [];
      const home = () => DK.router.reset(DK.store.state.gameOver ? 'gameOver' : 'hub');
      // Objetivos de crafteo que ya se pueden fabricar con lo traído
      if (latest) DK.crafting.newlyReadyFavorites().forEach((rc) => DK.ui.toast(t('bag.favReady', { item: D.items[rc.result].name }), { icon: 'star', kind: 'good' }));
      const goalsReady = latest ? DK.crafting.goalsReady() : [];
      // El menú de Mejoras se abre solo al llegar al resumen (una vez por expedición)
      if (latest && !DK.store.state.gameOver && !s.shopShown) { s.shopShown = true; DK.store.save(); setTimeout(() => V.upgradeMenu(refresh), 350); }
      DK.keys.on('Enter', home);

      const hero = h('div', { class: 'card sum-hero ' + o.cls, style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
        DK.outcomeEmblem(s.outcome, o.cls), // v5.12: emblema elaborado, distinto según el estilo
        h('div', { class: 'grow' },
          h('span', { class: 'muted small' }, t('exp.title', { zone: zone.name })),
          h('h2', null, s.averno ? t('averno.sumTitle') : t('sum.out.' + s.outcome)),
          h('p', { class: 'muted' }, s.averno ? t('averno.sumText', { floors: s.averno.floors, maps: s.averno.maps, lv: s.averno.level }) : t('sum.outText.' + s.outcome, { n: Math.round(((s.mult || DK.config.expeditionBonus) - 1) * 100) })),
          s.averno && s.averno.best ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('averno.newBest')) : null,
          // v5.33: tabla global del Averno y, la primera vez, si quieres publicar tu récord
          s.averno ? h('div', { class: 'row gap-s wrap' }, btn({ icon: 'trophy', label: t('online.boardBtn'), size: 'sm', variant: 'tone', onClick: () => V.leaderboard() })) : null,
          s.averno && latest ? V.publishAsk() : null,
          // v5.11: datos del mapa en una cuadrícula ordenada (antes, píldoras en filas desiguales)
          h('div', { class: 'sum-meta' }, [
            ['compass', t('sum5.mMaps'), String(depth)],
            zonesDone.length ? ['crown', t('sum5.mCleared'), String(zonesDone.length)] : null,
            ['flag', t('sum5.mFloor'), `${Math.min(s.step, s.total)} / ${s.total}`],
            ['clock', t('sum5.mTime'), DK.util.duration(mins)],
            ['map', t('sum5.mNodes'), String(totalNodes)],
            s.difficulty ? [DK.data.difficulties[s.difficulty].icon, t('sum5.mDiff'), t('difficulty.' + s.difficulty + '.name')] : null,
            s.weekly ? ['trophy', t('weekly.title'), s.weekly.score.toLocaleString(DK.i18n.lang)] : null,
            (s.runes || []).length ? ['rune', t('rune.short'), '+' + s.runes.length] : null,
            (s.secrets || []).length ? ['cave', t('sum5.mSecrets'), String(s.secrets.length)] : null,
          ].filter(Boolean).map(([ic, k, v]) => h('div', { class: 'sm-cell' }, h('small', null, DK.icon(ic, 12), k), h('b', null, v))))),
        h('div', { class: 'sum-actions' },
          btn({ icon: 'home', label: t('nav.home'), variant: 'primary', hotkey: '↵', onClick: home }),
          btn({ icon: 'flag', label: t('sum.again'), variant: 'tone', onClick: again }),
          latest && !DK.store.state.gameOver ? btn({ icon: 'emblem', label: t('sum.shopTitle'), variant: 'ghost', onClick: () => V.upgradeMenu(refresh) }) : null));

      const pathCard = h('div', { class: 'stack-s' },
        zonesDone.length ? h('div', { class: 'card stack-s' }, h('div', { class: 'panel-head' }, DK.icon('crown', 18), h('h3', null, t('sum.maps'))),
          h('div', { class: 'chips' }, zonesDone.map((zid, i) => h('span', { class: 'chip pos' }, DK.icon(D.zones[zid].icon, 13), `${i + 1}. ${D.zones[zid].name}`)))) : null,
        h('span', { class: 'muted small' }, t('sum.lastMap', { zone: zone.name })),
        V.expMap(s),
        h('div', { class: 'card stack-s' },
          h('div', { class: 'panel-head' }, DK.icon('compass', 18), h('h3', null, t('sum.path'))),
          nodes.length ? h('div', { class: 'sum-nodes' }, nodes.map(([type, n]) => h('div', { class: 'sum-node t-' + type },
            h('span', { class: 'exp-legend-icon t-' + type }, DK.icon(DK.expedition.TYPES[type].icon, 14)), h('span', { class: 'grow' }, t('exp.node.' + type)), h('b', null, n)))) : h('p', { class: 'muted small' }, t('sum.none'))));

      // v5.11: botín en fichas (icono, nombre, cantidad y rareza; al pasar el ratón o pulsar, qué hace)
      const RANK = { legendario: 0, epico: 1, raro: 2, comun: 3 };
      const lootTiles = (items, gear, lost) => {
        const tiles = [];
        (gear || []).forEach((g) => { if (!D.items[g.base]) return; const full = DK.gear.find && DK.gear.find(g.uid); const p = full ? full.p : g;
          tiles.push({ r: g.rarity === 'legendario' ? 0 : g.rarity === 'raro' ? 1 : g.rarity === 'magico' ? 2 : 3, el: h('div', Object.assign({ style: { '--g': D.gear.rarities[g.rarity] ? D.gear.rarities[g.rarity].color : '#aaa' } }, full ? V.infoProps('gear', p) : {}, { class: 'lt lt-gear' + (lost ? ' lost' : '') + (full ? ' has-info' : ''), tip: g.name }),
            h('span', { class: 'lt-ico' }, V.gearIcon(p, 34)), h('span', { class: 'lt-name' }, g.name), h('small', { class: 'lt-sub' }, t('gear.rarity.' + g.rarity))) }); });
        Object.entries(items || {}).forEach(([id, n]) => { const it = D.items[id]; if (!it) return;
          tiles.push({ r: RANK[it.rarity] != null ? RANK[it.rarity] : 3, el: h('div', Object.assign({ tip: it.name }, V.infoProps('item', id), { class: 'lt has-info r-' + it.rarity + (lost ? ' lost' : '') }),
            h('span', { class: 'lt-ico' }, V.itemIcon(it, 34, { tip: false }), n > 1 ? h('b', { class: 'lt-n' }, '×' + n) : null), h('span', { class: 'lt-name' }, it.name), h('small', { class: 'lt-sub' }, V.itemDoes(it) || DK.tr('categories', D.categories[it.category]))) }); });
        return tiles.length ? h('div', { class: 'lt-grid' }, tiles.sort((a, b) => a.r - b.r).map((x) => x.el)) : null;
      };
      const count = (items, gear) => Object.values(items || {}).reduce((a, n) => a + n, 0) + (gear || []).length;
      const lootSec = (icon, title, items, gear, lost, note) => { const n = count(items, gear); return n ? h('div', { class: 'lt-sec' + (lost ? ' lost' : '') }, h('div', { class: 'lt-head' }, DK.icon(icon, 15), h('b', null, title), h('span', { class: 'lt-count' }, String(n)), note ? h('small', { class: 'muted' }, note) : null), lootTiles(items, gear, lost)) : null; };
      const coinsOk = kept || s.outcome === 'retreat' || s.outcome === 'lostBoss';
      const loot = h('section', { class: 'card sum-loot' },
        h('div', { class: 'panel-head' }, h('h3', null, t('sum.rewards')),
          h('span', { class: 'sl-coins' + (coinsOk ? '' : ' lost') }, DK.icon('coin', 18), coinsOk ? h('b', null, (s.coins || 0).toLocaleString(DK.i18n.lang)) : h('s', null, String(s.lostCoins || 0)))),
        s.outcome === 'campfire' ? h('p', { class: 'muted small' }, t('sum.campfireLost', { pct: 100 - (s.keepPct || 50), coins: s.lostCoins || 0 })) : null,
        s.lootSpent ? h('p', { class: 'muted small' }, t('sum.spent', { n: s.lootSpent })) : null,
        s.outcome === 'lost' ? null : lootSec('gift', t('sum.loot'), s.items, s.gear, false),
        lootSec('bag', t('sum.toBag'), s.toBag, null, false),
        lootSec('bag', t('sum.packBack'), s.packBack, null, false),
        lootSec('skull', t('sum.lootLost'), s.outcome === 'lost' || s.outcome === 'lostBoss' || s.outcome === 'campfire' ? s.lostItems : null, s.outcome === 'lost' || s.outcome === 'lostBoss' || s.outcome === 'campfire' ? s.lostGear : null, true),
        lootSec('skull', t('sum.packLost'), s.lostPack, null, true),
        !count(s.items, s.gear) && !count(s.toBag) && !count(s.lostItems, s.lostGear) ? h('p', { class: 'muted small' }, t('sum.none')) : null);
      const rewards = null && h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('gift', 18), h('h3', null, t('sum.rewards'))),
        h('div', { class: 'row between' }, h('span', null, t('sum.coins')), kept || s.outcome === 'retreat' || s.outcome === 'lostBoss' ? V.coins(s.coins || 0) : h('s', { class: 'muted' }, String(s.lostCoins || 0))),
        s.outcome === 'campfire' ? h('p', { class: 'muted small' }, t('sum.campfireLost', { pct: 100 - (s.keepPct || 50), coins: s.lostCoins || 0 })) : null,
        s.lootSpent ? h('p', { class: 'muted small' }, t('sum.spent', { n: s.lootSpent })) : null,
        h('h4', null, DK.icon('flag', 14), ' ', s.outcome === 'lost' ? t('sum.lootLost') : t('sum.loot')),
        s.outcome === 'lost' ? itemChips(s.lostItems, true) : itemChips(s.items),
        s.outcome === 'lost' ? gearChips(s.lostGear, true) : gearChips(s.gear),
        s.outcome === 'lostBoss' || s.outcome === 'campfire' ? [h('h4', null, DK.icon('skull', 14), ' ', t('sum.lootLost')), itemChips(s.lostItems, true), gearChips(s.lostGear, true)] : null,
        h('h4', null, DK.icon('bag', 14), ' ', t('sum.toBag')),
        itemChips(s.toBag),
        s.packBack && Object.keys(s.packBack).length ? [h('h4', null, DK.icon('bag', 14), ' ', t('sum.packBack')), itemChips(s.packBack)] : null,
        s.lostPack && Object.keys(s.lostPack).length ? [h('h4', null, DK.icon('skull', 14), ' ', t('sum.packLost')), itemChips(s.lostPack, true)] : null);

      const recruits = (s.recruits || []);
      const people = h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('paw', 18), h('h3', null, t('sum.recruits'))),
        recruits.length ? h('div', { class: 'list' }, recruits.map((x) => { const k = x.kept != null ? x.kept : kept; return h('div', { class: 'sum-recruit ' + (k ? 'kept' : 'left') },
          V.sprite(x.species, { size: 44 }), h('b', { class: 'grow' }, x.name),
          h('span', { class: 'badge ' + (k ? 'good' : 'bad') }, DK.icon(k ? 'check' : 'x', 13), k ? t('sum.kept') : t('sum.left'))); })) : h('p', { class: 'muted small' }, t('sum.noRecruits')));

      const fallen = s.fallen || [];
      if (fallen.length) people.append(h('h4', null, DK.icon('skull', 14), ' ', t('sum.fallen')),
        h('div', { class: 'chips' }, fallen.map((x) => h('span', { class: 'chip neg' }, DK.icon('skull', 13), `${x.name} · ${t('common.lvl')} ${x.level}`))));
      const relics = (s.relics || []).map((id) => D.relics[id]).filter(Boolean);
      const extras = h('div', { class: 'card stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('amulet', 18), h('h3', null, t('relics.title'))),
        relics.length ? h('div', { class: 'list' }, relics.map((r) => h('div', { class: 'relic-row r-' + r.rarity }, h('span', { class: 'relic-icon sm' }, DK.icon(r.icon, 18)), h('div', { class: 'grow' }, h('b', null, r.name), h('div', { class: 'muted small' }, V.relicText(r)))))) : h('p', { class: 'muted small' }, t('sum.none')));

      // v5.9: tu equipo en grande (nivel al salir → al volver) y los rivales a los que te enfrentaste
      const team = teamPanel(s), foes = foesPanel(s), strip = statStrip(s, kept);
      return h('div', { class: 'screen sum-screen' }, hero, strip, team, foes, loot,
        latest && !DK.store.state.gameOver ? upgradeCardSummary(s, refresh) : null,
        goalsReady.length ? h('button', { class: 'card sum-goals', type: 'button', onClick: () => DK.router.reset('craft', { sel: goalsReady[0].id }) },
          h('span', { class: 'sum-shop-icon goals' }, DK.icon('star', 24)),
          h('span', { class: 'grow stack-s' }, h('b', null, t('craft.goalsReadyTitle')), h('span', { class: 'muted small' }, goalsReady.map((r) => D.items[r.result].name).join(', '))),
          DK.icon('next', 18)) : null,
        h('div', { class: 'sum-grid' }, h('div', { class: 'stack' }, compare(s), timeline(s), pathCard), h('div', { class: 'stack' }, people, extras)));
    },
  });
})();
