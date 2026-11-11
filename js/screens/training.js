/* =============================================================
 * screens/training.js — Exploraciones (DK.explore). v4.86
 *
 * Arriba, los grupos que hay fuera (con su barra de tiempo; al volver,
 * «Ver qué traen» abre el informe con el diario del viaje). Un hueco libre
 * abre el planificador: zona (nivel y casa), duración, quién va (hasta 3)
 * y el resumen con el riesgo, el coste (monedas + raciones), la
 * experiencia de cada uno, el botín posible y los bonus de naturaleza.
 * Abajo, las mejoras del Puesto de exploradores. Sigue usando la ruta
 * 'training' (y la clave de desbloqueo) por compatibilidad.
 *
 * params: { plan: true, z: zona, dur, sel: [uids], who }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const X = () => DK.explore;
  const num = (n) => Math.round(n).toLocaleString(DK.i18n.lang);
  const dur = (min) => DK.util.duration(Math.max(60, Math.round(min * 60)));
  const pct = (f) => Math.round(f * 100) + '%';

  DK.menus.add('nav', {
    id: 'training', icon: 'compass', order: 17, screen: 'training', mobile: false, dock: false, label: () => t('nav.training'),
    visible: () => !DK.store.state || DK.unlocks.has('training'),
    badge: () => { const n = DK.store.state ? X().readyCount() : 0; return n ? String(n) : ''; },
  });

  const riskKey = (r) => (r < 0.15 ? 'low' : r < 0.32 ? 'mid' : r < 0.55 ? 'high' : 'crazy');
  const zoneColor = (z) => (z.colors && z.colors[0]) || 'var(--accent)';
  const durShort = (min) => (min >= 60 ? (min % 60 ? DK.util.duration(min * 60) : t('explore.hours', { n: min / 60 })) : t('explore.mins', { n: min }));
  const typeIcon = (ty) => DK.icon((D.gear.types || {})[ty] || 'gem', 14);

  /** Informe al volver: diario, botín y experiencia. */
  async function showReport(rep) {
    const info = X().zoneInfo(rep.zone, rep.danger || 0);
    const items = Object.entries(rep.items);
    const oc = rep.outcome || (rep.hurt ? 'hurt' : 'ok');
    await DK.ui.modal({
      title: t('explore.report'), icon: 'compass', size: 'md',
      content: () => h('div', { class: 'stack-s ex-report' },
        h('div', { class: 'ex-rep-head o-' + oc, style: { '--zc': zoneColor(info.z) } },
          DK.icon(info.z.icon || 'map', 18), h('b', null, info.z.name), h('span', { class: 'grow' }),
          h('span', { class: 'badge ' + (oc === 'ok' ? 'good' : 'bad') }, t('explore.outcome.' + oc))),
        h('ol', { class: 'ex-log' }, rep.log.map((l) => h('li', null, l))),
        rep.cache ? h('p', { class: 'ex-cache' }, DK.icon('gift', 14), ' ', t('explore.cacheGot')) : null,
        oc === 'disaster' ? h('p', { class: 'ex-disaster' }, DK.icon('skull', 14), ' ', t('explore.disasterLost', { n: rep.lost || 0 })) : null,
        (rep.done || []).length ? h('p', { class: 'small good-text' }, DK.icon('scroll', 13), ' ', t('explore.req.done'), ' ', rep.done.map((r) => X().requestText(r)).join(' · ')) : null,
        oc === 'disaster' && !items.length ? null : h('div', { class: 'ex-got' }, h('small', { class: 'muted' }, t('explore.got')),
          h('div', { class: 'ex-items' },
            rep.coins ? h('span', { class: 'ex-it coin' }, DK.icon('coin', 16), h('b', null, num(rep.coins))) : null,
            items.map(([id, n]) => h('span', { class: 'ex-it', tip: D.items[id].name }, V.itemIcon(D.items[id], 26), h('b', null, '×' + n))),
            (rep.runes || []).map((id) => h('span', { class: 'ex-it rune', tip: V.runeTip(id) }, V.runeGem(id, 26), h('small', null, V.runeName(id)))),
            rep.gear.map((p) => h('span', { class: 'ex-it gear', tip: DK.gear.name(p), tipNode: () => V.infoCard('gear', p) }, V.gearIcon(p, 26), h('small', null, DK.gear.name(p)))))),
        h('div', { class: 'ex-exp' }, rep.exp.map((e) => h('div', { class: 'ex-exp-row' }, V.dSprite(e.d, { size: 34 }), h('b', { class: 'grow' }, DK.daskai.name(e.d)),
          h('span', { class: 'good-text' }, t('explore.expGot', { n: num(e.n) })), e.levelInfo && e.levelInfo.levels ? h('span', { class: 'badge good' }, `${t('common.lvl')} ${e.d.level}`) : null)))),
      actions: [{ label: t('common.accept'), icon: 'check', variant: 'primary', value: true }],
    }).promise;
    for (const e of rep.exp) if (e.levelInfo) await V.afterLevel(e.d, e.levelInfo);
  }

  /** v4.87: todo lo que puede salir en una zona (con su probabilidad) para esa duración y ese grupo. */
  function lootList(zoneId, durId, uids) {
    const L = X().zoneLoot(zoneId, durId, uids), info = X().zoneInfo(zoneId);
    if (!L) return;
    const row = (icon, name, chance, extra) => h('div', { class: 'ex-lrow' }, icon, h('span', { class: 'grow' }, name, extra ? h('small', { class: 'muted' }, ' · ', extra) : null), chance != null ? h('b', null, typeof chance === 'string' ? chance : pct(chance)) : null);
    const sec = (title, rows, cls = '') => h('div', { class: 'ex-lsec ' + cls }, h('span', { class: 'ex-h' }, title), rows);
    const O = L.own || {};
    DK.ui.modal({
      title: t('explore.lootTitle', { zone: info.z.name }), icon: 'list', size: 'md',
      content: () => h('div', { class: 'stack-s ex-loot' },
        h('p', { class: 'muted small' }, t('explore.lootDur', { d: t('explore.durs.' + durId).toLowerCase() }), ' · ', t('explore.approx', { n: L.total }), '. ', t('explore.approxTip')),
        // v4.89: lo que sólo sale aquí
        L.own ? sec(t('explore.ownTitle'), h('div', { class: 'ex-lgrid' },
          O.reagent ? row(V.itemIcon(D.items[O.reagent.id], 24), D.items[O.reagent.id].name, O.reagent.locked ? t('explore.needRunes') : '≈' + O.reagent.n, t('explore.ownReagent')) : null,
          O.stone ? row(V.itemIcon(D.items[O.stone.id], 22), D.items[O.stone.id].name, O.stone.chance, t('explore.ownStone')) : null,
          O.gear.types.length ? row(h('span', { class: 'ex-ltypes' }, O.gear.types.map(typeIcon)), O.gear.types.map((ty) => t(`gear.type.${ty}.many`)).join(', '), O.gear.chance, t('explore.ownGear')) : null,
          O.rare ? row(V.itemIcon(D.items[O.rare.id], 24), D.items[O.rare.id].name, O.rare.chance, t('explore.ownRare')) : null,
          O.rune ? row(DK.icon('rune', 22), t('explore.ownRune'), O.rune.locked ? t('explore.needRunes') : O.rune.chance) : null,
          O.glyph ? row(V.itemIcon(D.items.glifo_ascenso, 22), D.items.glifo_ascenso.name, O.glyph.locked ? t('explore.needRunes') : O.glyph.chance) : null,
          O.heart ? row(V.itemIcon(D.items.corazon_runico, 22), D.items.corazon_runico.name, O.heart.locked ? t('explore.needRunes') : O.heart.chance) : null), 'own') : null,
        sec(t('explore.lootSec.mats', { n: L.rolls }), h('div', { class: 'ex-lgrid' }, L.mats.map((m) => row(V.itemIcon(D.items[m.id], 22), D.items[m.id].name, m.chance)))), h('small', { class: 'muted' }, t('explore.atLeastOne')),
        sec(t('explore.lootSec.usual'), h('div', { class: 'ex-lgrid' },
          row(V.itemIcon(D.items.fragmento_forja, 26), t('explore.lootFrag'), L.fragment),
          row(DK.icon('coin', 22), t('explore.lootCoins'), null, `${num(L.coins[0])}–${num(L.coins[1])}`),
          row(V.itemIcon(D.items.racion_viaje, 26), t('explore.lootRation'), L.ration))),
        sec(t('explore.lootSec.some'), h('div', { class: 'ex-lgrid' },
          row(h('span', { class: 'ex-lstones' }, L.stones.list.slice(0, 3).map((id) => V.itemIcon(D.items[id], 20))), t('explore.lootStones'), L.stones.chance, L.stones.list.map((id) => D.items[id].name.replace(/^(Piedra|Cristal) (de |del )?/i, '')).join(', ')),
          row(DK.icon('gem', 22), t('explore.lootGear', { m: Math.round(L.gear.magic * 100) }), L.gear.chance))),
        sec(t('explore.lootSec.rare'), [row(DK.icon('gift', 22), t('explore.lootCache'), L.cache.chance)])),
      actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost', value: null }],
    });
  }

  /** v4.87: encargos del día. */
  function requestsCard(refresh) {
    const list = X().requests(); if (!list.length) return null;
    return h('section', { class: 'card ex-req' },
      h('div', { class: 'row gap-s' }, DK.icon('scroll', 16), h('b', null, t('explore.req.title')), h('small', { class: 'muted grow' }, t('explore.req.hint'))),
      list.map((r) => {
        const rw = X().requestReward(r);
        return h('div', { class: 'ex-rq' + (r.done ? ' done' : '') + (r.claimed ? ' claimed' : '') },
          h('span', { class: 'ex-rq-dot' }, r.done ? DK.icon('check', 12) : null), h('span', { class: 'grow' }, X().requestText(r)),
          h('span', { class: 'ex-rq-rw' }, DK.icon('coin', 12), ' ', num(rw.coins), Object.keys(rw.items).map((id) => h('span', { tip: `${D.items[id].name} ×${rw.items[id]}` }, V.itemIcon(D.items[id], 18)))),
          r.claimed ? h('span', { class: 'badge' }, t('explore.req.claimed'))
            : btn({ label: t('explore.req.claim'), size: 'sm', variant: r.done ? 'primary' : 'ghost', disabled: !r.done, onClick: () => { const g = X().claimRequest(r.id); if (g) { DK.audio.sfx('levelup'); DK.ui.toast(t('explore.req.got', { c: num(g.coins) }), { icon: 'scroll', kind: 'good' }); refresh(); } } }));
      }));
  }

  /** Grupo fuera (v4.89): tarjeta compacta con la zona, quiénes, la barra y el tiempo. */
  function groupCard(g, refresh) {
    const p = X().progress(g), info = X().zoneInfo(g.zone, g.danger || 0);
    if (!info) return null;
    const collect = async () => {
      const rep = X().collect(g.id); if (!rep) return;
      DK.audio.sfx(rep.hurt ? 'error' : 'levelup'); DK.app.renderNav(); refresh();
      await showReport(rep); refresh();
    };
    const recall = async () => {
      if (!(await DK.ui.confirm(t('explore.recallTitle'), t('explore.recallText'), { danger: true, okLabel: t('explore.recall') }))) return;
      X().recall(g.id); DK.ui.toast(t('explore.recalled'), { icon: 'compass' }); DK.app.renderNav(); refresh();
    };
    return h('div', { class: 'ex-gc' + (p.done ? ' ready' : ''), style: { '--zc': zoneColor(info.z) } },
      h('div', { class: 'ex-gc-top' },
        h('span', { class: 'ex-gc-ico' }, DK.icon(info.z.icon || 'map', 16)),
        h('div', { class: 'ex-gc-t' }, h('b', null, info.z.name), h('small', null, t('explore.durs.' + g.dur), ' · ', t('explore.lv', { n: info.lv }), g.danger ? [' · ', h('span', { class: 'ex-dg-tag' }, DK.icon('skull', 10), String(g.danger))] : null)),
        p.done ? null : h('button', { class: 'icon-btn ex-recall', type: 'button', tip: t('explore.recall'), 'aria-label': t('explore.recall'), onClick: recall }, DK.icon('x', 13))),
      h('div', { class: 'ex-gc-who' }, p.ds.map((d) => h('span', { class: 'ex-g-mon', tip: DK.daskai.name(d) }, V.dSprite(d, { size: 44, cls: p.done ? 'idle' : 'walk' })))),
      h('div', { class: 'ex-gc-foot' },
        p.done ? btn({ icon: 'gift', label: t('explore.collect'), variant: 'primary', size: 'sm', onClick: collect, cls: 'ex-collect' })
          : [h('div', { class: 'ex-bar' }, h('span', { style: { width: Math.round(p.frac * 100) + '%' } })), h('small', { class: 'ex-left' }, DK.icon('clock', 11), dur(p.left))]));
  }

  /** Riesgo con su desglose (v4.89). */
  function riskBlock(pv) {
    const ri = pv.riskInfo, rk = riskKey(ri.risk);
    const part = (x) => {
      if (x.k === 'danger') return h('li', { class: 'up' }, t('explore.rk.danger', { n: x.v }));
      if (x.k === 'level') return h('li', { class: x.v > 0 ? 'up' : x.v < 0 ? 'down' : '' }, t(x.v > 0 ? 'explore.rk.under' : x.v < 0 ? 'explore.rk.over' : 'explore.rk.even', { n: Math.abs(x.v) }));
      return h('li', { class: x.v > 1 ? 'up' : 'down' }, t('explore.rk.' + x.k), h('b', null, (x.v > 1 ? '+' : '−') + Math.round(Math.abs(x.v - 1) * 100) + '%'));
    };
    return h('div', { class: 'ex-rk r-' + rk },
      h('div', { class: 'ex-rk-top' }, h('span', { class: 'ex-h' }, t('explore.risk')), h('b', { class: 'ex-rk-v' }, `${t('explore.riskLv.' + rk)} · ${pct(ri.risk)}`)),
      h('div', { class: 'ex-rk-bar' }, h('span', { class: 'hurt', style: { width: Math.max(3, Math.round((ri.risk - ri.disaster) * 100)) + '%' } }), h('span', { class: 'dis', style: { width: Math.round(ri.disaster * 100) + '%' } })),
      h('div', { class: 'ex-rk-leg small' },
        h('span', null, h('i', { class: 'hurt' }), t('explore.rk.hurtLeg', { p: pct(ri.risk - ri.disaster) })),
        h('span', null, h('i', { class: 'dis' }), t('explore.rk.disLeg', { p: pct(ri.disaster) }))),
      h('details', { class: 'ex-rk-why' }, h('summary', null, DK.icon('info', 12), t('explore.rk.how')),
        h('p', { class: 'muted small' }, t('explore.rk.base', { n: pct(DK.config.explore.risk.base) })),
        h('ul', null, ri.parts.map(part)),
        h('p', { class: 'muted small' }, t('explore.rk.outcomes'))));
  }

  /** Planificador (v4.89): zonas en mosaico + ficha de la zona a la izquierda; grupo, duración y resumen a la derecha. */
  function planner(params, refresh) {
    const zones = X().zones();
    const C = DK.config.explore;
    const best = Math.max(1, ...DK.party.all().filter((d) => !d.temp).map((d) => d.level));
    if (!params.z || !zones.some((z) => z.id === params.z)) {
      // Por defecto, la zona más alta cuyo nivel no supere al de tu mejor daskai
      params.z = (zones.filter((z) => X().zoneInfo(z.id).lv <= best + 2).pop() || zones[0] || {}).id;
    }
    params.dur = params.dur || 'mid';
    params.sel = (params.sel || []).filter((u) => DK.party.get(u) && !X().cannotMember(DK.party.get(u)));
    const sel = params.sel, ds = sel.map((u) => DK.party.get(u));
    const close = () => { params.plan = false; refresh(); };
    const avg = ds.length ? ds.reduce((a, d) => a + d.level, 0) / ds.length : best;
    const runesOn = DK.runes.enabled();
    // Mosaico de zonas: compacto (cabe cualquier número) con lo esencial; el detalle, en la ficha de abajo
    const zoneTile = (z) => {
      const i = X().zoneInfo(z.id), on = z.id === params.z, F = X().finds(z.id), gap = i.lv - avg;
      const fit = gap <= -6 ? 'easy' : gap <= 2 ? 'fit' : gap <= 7 ? 'hard' : 'deadly';
      return h('button', { class: 'ex-zt f-' + fit + (on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': on, style: { '--zc': zoneColor(z) },
        tip: `${z.name} · ${t('explore.lv', { n: i.lv })} · ${t('explore.fit.' + fit)}`, onClick: () => { params.z = z.id; refresh(); } },
        h('span', { class: 'ex-zt-ico' }, DK.icon(z.icon || 'map', 18)),
        h('span', { class: 'ex-zt-txt' }, h('b', null, z.name), h('small', null, h('i', { class: 'ex-zt-fit' }), t('explore.lv', { n: i.lv }), i.danger.lv ? h('em', { class: 'ex-zt-dg' }, ` (+${i.danger.lv})`) : null)),
        // el icono es el REACTIVO rúnico que sólo se encuentra explorando esa zona (Pantano y Glaciar no tienen)
        F && F.reagent && D.items[F.reagent] && runesOn ? h('span', { class: 'ex-zt-own', tip: t('explore.ownReagentTip', { item: D.items[F.reagent].name }) }, V.itemIcon(D.items[F.reagent], 18, { tip: false })) : null);
    };
    const info = params.z ? X().zoneInfo(params.z) : null, F = params.z ? X().finds(params.z) : null;
    const L = params.z ? X().zoneLoot(params.z, params.dur, sel) : null;
    const hs = info && info.house && D.houses[info.house];
    const own = (icon, label, sub) => h('span', { class: 'ex-own' }, icon, h('span', null, h('b', null, label), sub ? h('small', null, sub) : null));
    const zoneCard = info ? h('div', { class: 'ex-zd', style: { '--zc': zoneColor(info.z) } },
      h('div', { class: 'ex-zd-head' }, h('span', { class: 'ex-zd-ico' }, DK.icon(info.z.icon || 'map', 22)),
        h('div', { class: 'grow' }, h('b', null, info.z.name),
          h('small', null, t('explore.lv', { n: info.lv }), info.danger.lv ? h('em', { class: 'ex-zt-dg' }, ` (${info.baseLv} + ${info.danger.lv})`) : null, hs ? [' · ', h('i', { class: 'ex-zh', style: { background: D.houseColor(info.house) } }), ' ', DK.tr('houses', hs)] : null)),
        h('button', { class: 'wb-mats-link ex-seeall', type: 'button', onClick: () => lootList(params.z, params.dur, sel) }, DK.icon('list', 12), t('explore.seeAll'))),
      info.z.desc ? h('p', { class: 'muted small ex-zd-desc' }, info.z.desc) : null,
      F ? h('div', { class: 'ex-zd-own' }, h('span', { class: 'ex-h' }, DK.icon('star', 11), t('explore.ownTitle')),
        h('div', { class: 'ex-owns' },
          F.reagent && D.items[F.reagent] ? own(V.itemIcon(D.items[F.reagent], 26), D.items[F.reagent].name, runesOn ? t('explore.ownReagent') : t('explore.needRunes')) : null,
          F.stone && D.items[F.stone] ? own(V.itemIcon(D.items[F.stone], 24), D.items[F.stone].name.replace(/^(Piedra|Cristal) (de |del )?/i, '').replace(/^\w/, (c) => c.toUpperCase()), t('explore.ownStone')) : null,
          (F.gear || []).length ? own(h('span', { class: 'ex-types' }, F.gear.map(typeIcon)), F.gear.map((ty) => t(`gear.type.${ty}.many`)).join(' · '), t('explore.ownGear')) : null,
          F.rare && D.items[F.rare] ? own(V.itemIcon(D.items[F.rare], 26), D.items[F.rare].name, t('explore.ownRare')) : null)) : null,
      h('div', { class: 'ex-zd-mats' }, h('span', { class: 'ex-h' }, t('explore.zoneMats')), h('span', { class: 'ex-mats' }, info.mats.slice(0, 8).map((id) => h('span', { tip: D.items[id].name }, V.itemIcon(D.items[id], 22)))))) : null;

    // Duración: discreta (píldoras pequeñas)
    const durPills = h('div', { class: 'ex-dpills', role: 'radiogroup', 'aria-label': t('explore.dur') }, C.durations.map((x) => h('button', { type: 'button', role: 'radio', class: params.dur === x.id ? 'on' : '', 'aria-checked': params.dur === x.id,
      tip: t('explore.durs.' + x.id) + ' · ' + t('explore.rations', { n: x.rations }), onClick: () => { params.dur = x.id; refresh(); } }, durShort(X().minutes(ds, x.id)))));

    // v5.28: peligro (más nivel = más riesgo y más botín); los bloqueados se ven con candado
    const DGs = X().dangerLevels(), dMax = X().dangerMax(), dCur = X().danger();
    const dangerPills = h('div', { class: 'ex-dpills ex-danger', role: 'radiogroup', 'aria-label': t('explore.danger') }, DGs.map((x, n) => {
      const locked = n > dMax;
      return h('button', { type: 'button', role: 'radio', class: (dCur === n ? 'on' : '') + (locked ? ' locked' : '') + ' dg-' + n, 'aria-checked': dCur === n, disabled: locked,
        tip: n ? t('explore.dangerTip', { n, lv: x.lv, loot: Math.round((x.loot - 1) * 100), rare: Math.round((x.rare - 1) * 100), coins: Math.round((x.coins - 1) * 100) }) + (locked ? ' · ' + t('explore.dangerLocked', { n: n - 1 }) : '') : t('explore.danger0'),
        onClick: () => { X().setDanger(n); refresh(); } }, locked ? DK.icon('lock', 11) : n ? [DK.icon('skull', 11), String(n)] : '—');
    }));

    // v4.90: buscador, orden y páginas (con muchos daskai la lista era enorme)
    params.who = params.who || 'all'; params.wsort = params.wsort || 'lv';
    const SORT = { lv: (a, b) => b.level - a.level, name: (a, b) => DK.daskai.name(a).localeCompare(DK.daskai.name(b)), house: (a, b) => DK.daskai.species(a).house.localeCompare(DK.daskai.species(b).house) || b.level - a.level };
    const all = DK.party.all().filter((d) => !d.temp && !X().isTraining(d.uid)).sort(SORT[params.wsort] || SORT.lv);
    const wq = (params.wq || '').trim().toLowerCase();
    const okQ = (d) => !wq || DK.daskai.name(d).toLowerCase().includes(wq) || (DK.daskai.species(d).name || '').toLowerCase().includes(wq)
      || DK.tr('houses', D.houses[DK.daskai.species(d).house] || {}).toLowerCase().includes(wq) || String(d.level) === wq;
    const shown = all.filter((x) => (params.who === 'all' || (params.who === 'team') === DK.party.isActive(x.uid)) && okQ(x));
    const per = DK.ui.isNarrow() ? 9 : 16, pages = Math.max(1, Math.ceil(shown.length / per));
    params.wpage = Math.min(Math.max(0, params.wpage || 0), pages - 1);
    const pageList = shown.slice(params.wpage * per, params.wpage * per + per);
    if (params.listOpen == null) params.listOpen = !sel.length;
    const listOpen = !!params.listOpen;
    const toggle = (d) => { const i = sel.indexOf(d.uid); if (i >= 0) sel.splice(i, 1); else if (sel.length < C.partyMax) sel.push(d.uid); if (sel.length >= C.partyMax) params.listOpen = false; DK.audio.sfx('select'); refresh(); };
    const weakVs = (d) => info && hs && hs.strongVs === DK.daskai.species(d).house;
    const tile = (d) => {
      const why = X().cannotMember(d), on = sel.includes(d.uid), sp = DK.daskai.species(d), nat = C.natures[d.nature || 'equilibrada'];
      return h('button', { class: 'tr-tile ex-tile' + (on ? ' on' : '') + (why ? ' off' : ''), type: 'button', disabled: !!why || (!on && sel.length >= C.partyMax), 'aria-pressed': on,
        style: { '--c': D.houseColor(sp.house) }, tip: why || `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}${nat ? ' · ' + t('explore.nat.' + nat.key) : ''}${weakVs(d) ? ' · ' + t('explore.weakTip') : ''}`, onClick: () => toggle(d) },
        DK.party.isActive(d.uid) ? h('span', { class: 'tr-tag team', tip: t('team.inTeam') }, DK.icon('users', 11)) : null,
        on ? h('span', { class: 'ex-check' }, DK.icon('check', 12)) : null,
        weakVs(d) ? h('span', { class: 'ex-weak', tip: t('explore.weakTip') }, DK.icon('alert', 11)) : null,
        V.dSprite(d, { size: 46 }), h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`),
        why ? h('span', { class: 'tr-why' }, why) : nat ? h('span', { class: 'ex-nat' }, t('explore.nat.' + nat.key)) : null);
    };
    const pv = params.z ? X().preview(sel, params.z, params.dur) : null;
    const why = X().cannot(sel, params.z, params.dur);
    const go = () => {
      const g = X().send(sel, params.z, params.dur);
      if (!g) { DK.audio.sfx('error'); DK.ui.toast(X().cannot(sel, params.z, params.dur) || t('explore.why.zone'), { icon: 'alert', kind: 'bad' }); return; }
      DK.audio.sfx('select'); DK.ui.toast(t('explore.log.set', { names: ds.map((d) => DK.daskai.name(d)).join(', '), zone: D.zones[params.z].name }), { icon: 'compass', kind: 'good' });
      params.plan = false; params.sel = []; DK.app.renderNav(); refresh();
    };
    const have = DK.bag.count('racion_viaje');
    const summary = pv && sel.length ? h('div', { class: 'ex-sum2' },
      riskBlock(pv),
      pv.houseMatch ? h('p', { class: 'small good-text ex-note' }, DK.icon('shield', 12), ' ', t('explore.houseMatch')) : null,
      h('div', { class: 'ex-kv' },
        h('div', null, h('span', { class: 'ex-h' }, t('explore.cost')),
          h('div', { class: 'ex-cost' }, h('span', { class: DK.wallet.get() < pv.cost.coins ? 'bad-text' : '' }, DK.icon('coin', 13), num(pv.cost.coins)),
            h('span', { class: have < pv.cost.rations ? 'bad-text' : '', tip: t('explore.rationsHelp') }, V.itemIcon(D.items.racion_viaje, 18, { tip: false }), `${pv.cost.rations}`, h('small', { class: 'muted' }, ' / ' + t('explore.rationsHave', { n: have })))),
          have < pv.cost.rations ? h('button', { class: 'wb-mats-link', type: 'button', onClick: () => DK.router.reset('craft', { tab: 'consum', sel: 'racion_viaje' }) }, DK.icon('forgeRune', 12), t('explore.craftRations')) : null),
        h('div', null, h('span', { class: 'ex-h' }, t('explore.expEach')),
          h('div', { class: 'ex-exps' }, pv.exp.map((e) => h('span', null, V.dSprite(e.d, { size: 22 }), '+' + num(e.n))))),
        h('div', null, h('span', { class: 'ex-h' }, t('explore.loot')),
          h('small', { class: 'muted', tip: t('explore.approxTip') }, t('explore.approx', { n: L ? L.total : 0 })))),
      pv.bonuses.length ? h('div', { class: 'chips ex-bon' }, pv.bonuses.map((b) => h('span', { class: 'chip pos' }, DK.daskai.name(b.d), ': ', t('explore.nat.' + b.key)))) : null) : null;

    // v4.90: rejilla en filas: [zonas | quién va + duración] · [selector de daskai, a lo ancho] · [ficha de la zona | riesgo y resumen]
    // así la ficha y el riesgo empiezan siempre a la misma altura
    const refocus = () => { const i = document.querySelector('.ex-wq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
    const sortNext = { lv: 'name', name: 'house', house: 'lv' };
    const picker = listOpen ? h('div', { class: 'ex-picker' },
      h('div', { class: 'ex-pk-bar' },
        h('label', { class: 'fp-search ex-pk-search' }, DK.icon('search', 15),
          h('input', { class: 'ex-wq', type: 'search', placeholder: t('explore.pk.search', { n: all.length }), value: params.wq || '', 'aria-label': t('inv.search'),
            onInput: (e) => { params.wq = e.target.value; params.wpage = 0; clearTimeout(params._wqt); params._wqt = setTimeout(() => { refresh(); refocus(); }, 200); } }),
          wq ? h('span', { class: 'fp-count' }, `${shown.length}/${all.length}`) : null),
        DK.ui.segmented({ value: params.who, onChange: (v) => { params.who = v; params.wpage = 0; refresh(); },
          options: [{ value: 'all', label: t('train.whoAll', { n: all.length }) }, { value: 'team', label: t('train.whoTeam'), icon: 'users' }, { value: 'box', label: t('train.whoBox'), icon: 'grid' }] }),
        h('button', { class: 'fp-sortbtn', type: 'button', tip: t('gear.bench.sortBy'), onClick: () => { params.wsort = sortNext[params.wsort] || 'lv'; refresh(); } }, DK.icon('swap', 14), h('span', { class: 'fp-sortlbl' }, t('explore.pk.sort.' + params.wsort))),
        // v4.98: «Ocultar lista» dentro del bloque de la lista (antes quedaba suelto junto a «Quién va»)
        h('button', { class: 'ex-listtog', type: 'button', 'aria-expanded': 'true', onClick: () => { params.listOpen = false; refresh(); } }, DK.icon('chevronDown', 14), t('explore.listHide'))),
      pageList.length ? h('div', { class: 'tr-grid ex-grid' }, pageList.map(tile)) : DK.ui.empty('users', wq ? t('gear.bench.noMatch') : t('explore.none'), ''),
      pages > 1 ? h('div', { class: 'ex-pager' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('explore.pk.prev'), disabled: params.wpage <= 0, onClick: () => { params.wpage--; refresh(); } }, DK.icon('back', 14)),
        [...Array(pages).keys()].filter((i) => pages <= 7 || i === 0 || i === pages - 1 || Math.abs(i - params.wpage) <= 1).map((i, k, arr) => [k && i - arr[k - 1] > 1 ? h('span', { class: 'muted' }, '…') : null,
          h('button', { class: 'ex-pg' + (i === params.wpage ? ' on' : ''), type: 'button', 'aria-current': i === params.wpage ? 'page' : null, onClick: () => { params.wpage = i; refresh(); } }, String(i + 1))]),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('explore.pk.next'), disabled: params.wpage >= pages - 1, onClick: () => { params.wpage++; refresh(); } }, DK.icon('next', 14))) : null) : null;
    const zonesSec = h('div', { class: 'ex-sec ex-a-zones' }, h('span', { class: 'ex-h' }, t('explore.zone'), h('small', { class: 'muted' }, String(zones.length))),
      zones.length ? h('div', { class: 'ex-zgrid', role: 'radiogroup' }, zones.map(zoneTile)) : h('p', { class: 'muted' }, t('explore.pickZone')));
    // v4.98: «Quién va» con tarjetas grandes que llenan su zona; al pulsar uno sale su ficha rápida (como en la hoguera)
    const card = (d) => { const sp = DK.daskai.species(d), nat = C.natures[d.nature || 'equilibrada'];
      return h('div', { class: 'ex-who-card', style: { '--c': D.houseColor(sp.house) } },
        h('button', { class: 'ex-who-main', type: 'button', tip: t('explore.whoTip'), onClick: () => { DK.audio.sfx('select'); V.quickStats(d, { onChange: refresh }); } },
          V.dSprite(d, { size: DK.ui.isNarrow() ? 70 : 100, cls: 'alive' }), h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`),
          nat ? h('span', { class: 'ex-nat' }, t('explore.nat.' + nat.key)) : null),
        h('button', { class: 'ex-who-x', type: 'button', 'aria-label': t('explore.remove'), tip: t('explore.remove'), onClick: () => toggle(d) }, DK.icon('x', 12))); };
    const whoSec = h('div', { class: 'ex-pcol ex-a-who' },
      h('div', { class: 'ex-sec' }, h('div', { class: 'ex-h ex-who-h' }, h('span', null, t('explore.who', { n: sel.length, max: C.partyMax })),
          !listOpen ? h('button', { class: 'ex-listtog', type: 'button', 'aria-expanded': 'false', onClick: () => { params.listOpen = true; refresh(); } }, DK.icon('chevronDown', 14), t('explore.listShow', { n: all.length })) : null),
        h('div', { class: 'ex-who-grid' },
          ds.map(card),
          Array.from({ length: C.partyMax - ds.length }, () => h('button', { class: 'ex-who-card empty', type: 'button', 'aria-label': t('explore.listShow', { n: all.length }), onClick: () => { params.listOpen = true; refresh(); } }, DK.icon('plus', 22), h('small', null, t('explore.addOne')))))));
    const sumSec = h('div', { class: 'ex-pcol ex-a-sum' },
      summary || h('div', { class: 'ex-sum2 ex-sum-empty muted small' }, DK.icon('users', 16), t('explore.pickWho')),
      h('div', { class: 'ex-go' }, why && sel.length ? h('span', { class: 'small bad-text' }, why) : h('span'),
        // v4.98: la duración, junto al botón de mandar
        h('div', { class: 'ex-durrow' }, h('span', { class: 'ex-h' }, DK.icon('clock', 11), t('explore.dur')), durPills),
        h('div', { class: 'ex-durrow' }, h('span', { class: 'ex-h' }, DK.icon('skull', 11), t('explore.danger')), dangerPills),
        btn({ icon: 'compass', label: t('explore.go', { t: dur(X().minutes(ds, params.dur)) }), variant: 'primary', disabled: !!why, tip: why, onClick: go })));
    return h('div', { class: 'panel ex-planner' },
      h('div', { class: 'ex-ph' }, DK.icon('compass', 18), h('h3', null, t('explore.newTitle')), h('span', { class: 'grow' }), btn({ icon: 'back', label: t('explore.back'), size: 'sm', variant: 'ghost', onClick: close })),
      h('div', { class: 'ex-pgrid' }, zonesSec, whoSec, picker ? h('div', { class: 'ex-a-picker' }, picker) : null, zoneCard ? h('div', { class: 'ex-a-zone' }, zoneCard) : null, sumSec));
  }

  /** Mejoras del Puesto de exploradores (antes Instructor). */
  function upgradePanel(refresh) {
    const I = DK.config.explore.post, lv = X().level(), next = X().nextLevel(), why = X().cannotBuy();
    const fx = (x) => [t('explore.up.slots', { n: DK.config.explore.slots + x.slots }), t('explore.up.rate', { n: Math.round(x.rate * 100) }), t('explore.up.discount', { n: Math.round(x.discount * 100) }), t('explore.up.safety', { n: Math.round((x.safety || 0) * 100) })];
    const lack = () => why === 'emblems' ? t('train.up.noEmblems', { n: next.emblems - DK.camp.emblems() }) : t('train.up.noMoney', { n: num(next.cost - DK.wallet.get()) });
    const buy = () => {
      if (!X().buyLevel()) { DK.audio.sfx('error'); DK.ui.toast(lack(), { icon: 'alert', kind: 'bad' }); return; }
      DK.audio.sfx('levelup'); DK.ui.toast(t('train.up.bought', { n: X().level() }), { icon: 'compass', kind: 'good' }); DK.app.renderNav(); refresh();
    };
    return h('section', { class: 'card tr-up' },
      h('div', { class: 'tr-up-head' },
        h('span', { class: 'tr-up-icon' }, DK.icon('flag', 18)),
        h('div', { class: 'grow' },
          h('b', null, t('explore.up.title')),
          h('div', { class: 'tr-up-steps' }, I.slice(1).map((x, i) => h('span', { class: 'tr-step' + (i < lv ? ' own' : '') + (i === lv ? ' next' : ''), tip: `${t('train.up.level', { n: i + 1, max: I.length - 1 })}: ${fx(x).join(' · ')}` })),
            h('small', { class: 'muted' }, t('train.up.level', { n: lv, max: I.length - 1 })))),
        next ? h('div', { class: 'tr-up-buy' },
          h('span', { class: 'tr-up-price' }, h('span', { class: why === 'emblems' ? 'bad-text' : '' }, V.emblems(next.emblems)), h('span', { class: why === 'coins' ? 'tr-fee bad' : 'tr-fee' }, DK.icon('coin', 13), ' ', num(next.cost))),
          btn({ icon: 'arrowUp', label: t('train.up.buy', { n: lv + 1 }), size: 'sm', variant: why ? 'tone' : 'primary', disabled: !!why, tip: why ? lack() : null, onClick: buy }))
          : h('span', { class: 'badge good' }, DK.icon('crown', 12), ' ', t('train.up.maxed'))),
      next ? h('p', { class: 'tr-up-next small' }, h('span', { class: 'muted' }, t('train.up.next')), ' ', fx(next).join(' · ')) : null);
  }

  DK.screens.register('training', {
    title: () => t('nav.training'), icon: 'compass', section: 'training', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      if (!DK.unlocks.has('training')) {
        return h('div', { class: 'screen train-screen' }, h('div', { class: 'card locked-feature' },
          h('span', { class: 'lf-icon' }, DK.icon('lock', 30)),
          h('h2', null, t('explore.title')), h('p', { class: 'muted' }, t('unlock.trainingLocked')),
          btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') })));
      }
      const gift = X().takeGift();
      if (gift) setTimeout(() => DK.ui.toast(t('explore.gift', { n: gift }), { icon: 'gift', kind: 'good' }), 200);
      const legacy = X().takeLegacy();
      if (legacy) setTimeout(() => DK.ui.toast(t('explore.legacy', { list: legacy.map((x) => `${x.name} (+${num(x.exp)})`).join(', ') }), { icon: 'compass', kind: 'good', duration: 8000 }), 300);
      const gs = X().slots(), n = X().slotCount();
      const cards = gs.map((g) => groupCard(g, refresh));
      // v4.88: mientras planificas, sólo se ven los grupos que ya están fuera (sin los huecos libres ni bloqueados)
      if (!params.plan && gs.length < n) cards.push(h('button', { class: 'ex-gc free', type: 'button', onClick: () => { params.plan = true; refresh(); } },
        h('span', { class: 'ex-free-plus' }, DK.icon('plus', 22)), h('b', null, t('explore.send')), h('small', { class: 'muted' }, t('explore.sendHint'))));
      clearInterval(params._timer);
      if (gs.length) params._timer = setInterval(() => { if (!document.querySelector('.train-screen')) return clearInterval(params._timer); if (!params.plan) refresh(); }, 20000);
      const reps = (DK.store.state.training.reports || []).slice(0, 5);
      const lockedN = X().slotMax() - n;
      return h('div', { class: 'screen train-screen ex-screen ex2' },
        // v4.89: cabecera limpia (sin contadores: los grupos van en su sección y las raciones en el coste)
        h('header', { class: 'ex-top' },
          h('span', { class: 'ex-top-ico' }, DK.icon('compass', 26)),
          h('div', { class: 'grow' }, h('h2', null, t('explore.title')), h('p', { class: 'muted small' }, t('explore.text')))),
        params.plan ? planner(params, refresh) : null,
        cards.length ? h('section', { class: 'ex-runs-wrap' },
          h('div', { class: 'ex-h' }, t('explore.onWay'), h('small', { class: 'muted' }, `${gs.length}/${n}`),
            !params.plan && lockedN > 0 ? h('small', { class: 'muted ex-more', tip: t('explore.lockedTip') }, DK.icon('lock', 11), ' ', t('explore.moreSlots', { n: lockedN })) : null),
          h('div', { class: 'ex-runs' }, cards)) : null,
        params.plan ? null : requestsCard(refresh),
        reps.length ? h('details', { class: 'ex-last' }, h('summary', null, DK.icon('clock', 13), ' ', t('explore.last')),
          h('ul', null, reps.map((r) => h('li', { class: r.outcome === 'disaster' ? 'dis' : r.hurt ? 'hurt' : '' }, h('b', null, D.zones[r.zone] ? D.zones[r.zone].name : r.zone), ' · ', r.names.join(', '), ' · ',
            DK.icon('coin', 11), ' ', num(r.coins), ' · ', Object.values(r.items).reduce((a, b) => a + b, 0), ' ', DK.icon('cube', 11), r.gear ? [' · ', DK.icon('gem', 11), ' ', r.gear] : null)))) : null,
        upgradePanel(refresh));
    },
    onLeave(params) { clearInterval(params._timer); },
  });
})();
