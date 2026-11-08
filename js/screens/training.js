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

  const riskKey = (r) => (r < 0.12 ? 'low' : r < 0.3 ? 'mid' : r < 0.55 ? 'high' : 'crazy');
  const zoneColor = (z) => (z.colors && z.colors[0]) || 'var(--accent)';

  /** Informe al volver: diario, botín y experiencia. */
  async function showReport(rep) {
    const info = X().zoneInfo(rep.zone);
    const items = Object.entries(rep.items);
    await DK.ui.modal({
      title: t('explore.report'), icon: 'compass', size: 'md',
      content: () => h('div', { class: 'stack-s ex-report' },
        h('div', { class: 'ex-rep-head' + (rep.hurt ? ' hurt' : ''), style: { '--zc': zoneColor(info.z) } },
          DK.icon(info.z.icon || 'map', 18), h('b', null, info.z.name), h('span', { class: 'grow' }),
          h('span', { class: 'badge ' + (rep.hurt ? 'bad' : 'good') }, t(rep.hurt ? 'explore.reportHurt' : 'explore.reportOk'))),
        h('ol', { class: 'ex-log' }, rep.log.map((l) => h('li', null, l))),
        rep.cache ? h('p', { class: 'ex-cache' }, DK.icon('gift', 14), ' ', t('explore.cacheGot')) : null,
        (rep.done || []).length ? h('p', { class: 'small good-text' }, DK.icon('scroll', 13), ' ', t('explore.req.done'), ' ', rep.done.map((r) => X().requestText(r)).join(' · ')) : null,
        h('div', { class: 'ex-got' }, h('small', { class: 'muted' }, t('explore.got')),
          h('div', { class: 'ex-items' },
            rep.coins ? h('span', { class: 'ex-it coin' }, DK.icon('coin', 16), h('b', null, num(rep.coins))) : null,
            items.map(([id, n]) => h('span', { class: 'ex-it', tip: D.items[id].name }, V.itemIcon(D.items[id], 26), h('b', null, '×' + n))),
            rep.gear.map((p) => h('span', { class: 'ex-it gear', tip: DK.gear.name(p) }, V.gearIcon(p, 26), h('small', null, DK.gear.name(p)))))),
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
    const row = (icon, name, chance, extra) => h('div', { class: 'ex-lrow' }, icon, h('span', { class: 'grow' }, name, extra ? h('small', { class: 'muted' }, ' · ', extra) : null), chance != null ? h('b', null, pct(chance)) : null);
    const sec = (title, rows) => h('div', { class: 'ex-lsec' }, h('span', { class: 'ex-h' }, title), rows);
    DK.ui.modal({
      title: t('explore.lootTitle', { zone: info.z.name }), icon: 'list', size: 'md',
      content: () => h('div', { class: 'stack-s ex-loot' },
        h('p', { class: 'muted small' }, t('explore.lootDur', { d: t('explore.durs.' + durId).toLowerCase() }), ' · ', t('explore.approx', { n: L.total }), '. ', t('explore.approxTip')),
        sec(t('explore.lootSec.mats', { n: L.rolls }), h('div', { class: 'ex-lgrid' }, L.mats.map((m) => row(V.itemIcon(D.items[m.id], 22), D.items[m.id].name, m.chance)))), h('small', { class: 'muted' }, t('explore.atLeastOne')),
        sec(t('explore.lootSec.usual'), [
          row(V.itemIcon(D.items.fragmento_forja, 26), t('explore.lootFrag'), L.fragment),
          row(DK.icon('coin', 22), t('explore.lootCoins'), null, `${num(L.coins[0])}–${num(L.coins[1])}`),
          row(V.itemIcon(D.items.racion_viaje, 26), t('explore.lootRation'), L.ration)]),
        sec(t('explore.lootSec.some'), [
          row(h('span', { class: 'ex-lstones' }, L.stones.list.slice(0, 3).map((id) => V.itemIcon(D.items[id], 20))), t('explore.lootStones'), L.stones.chance, L.stones.list.map((id) => D.items[id].name.replace(/^Piedra (de |del )?/i, '')).join(', ')),
          row(DK.icon('gem', 22), t('explore.lootGear', { m: Math.round(L.gear.magic * 100) }), L.gear.chance)]),
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

  /** Grupo fuera: zona, quiénes, barra de tiempo y recoger / hacer volver. */
  function groupCard(g, refresh) {
    const p = X().progress(g), info = X().zoneInfo(g.zone);
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
    return h('div', { class: 'card ex-group' + (p.done ? ' ready' : ''), style: { '--zc': zoneColor(info.z) } },
      h('div', { class: 'ex-g-head' }, DK.icon(info.z.icon || 'map', 16), h('b', null, info.z.name), h('span', { class: 'chip sm' }, t('explore.durs.' + g.dur)), h('span', { class: 'grow' }),
        p.done ? null : h('button', { class: 'icon-btn ex-recall', type: 'button', tip: t('explore.recall'), 'aria-label': t('explore.recall'), onClick: recall }, DK.icon('x', 14))),
      h('div', { class: 'ex-g-who' }, p.ds.map((d) => h('span', { class: 'ex-g-mon', tip: DK.daskai.name(d) }, V.dSprite(d, { size: 52, cls: p.done ? 'idle' : 'walk' }), h('small', null, DK.daskai.name(d))))),
      h('div', { class: 'ex-bar' }, h('span', { style: { width: Math.round(p.frac * 100) + '%' } })),
      p.done ? btn({ icon: 'gift', label: t('explore.collect'), variant: 'primary', onClick: collect, cls: 'ex-collect' })
        : h('div', { class: 'muted small ex-left' }, DK.icon('clock', 12), ' ', t('explore.away', { t: dur(p.left) })));
  }

  /** Planificador: zona, duración, quién va y el resumen. */
  function planner(params, refresh) {
    const zones = X().zones();
    const C = DK.config.explore;
    if (!params.z || !zones.some((z) => z.id === params.z)) {
      // Por defecto, la zona más alta cuyo nivel no supere al de tu mejor daskai
      const best = Math.max(1, ...DK.party.all().filter((d) => !d.temp).map((d) => d.level));
      params.z = (zones.filter((z) => X().zoneInfo(z.id).lv <= best + 2).pop() || zones[0] || {}).id;
    }
    params.dur = params.dur || 'mid';
    params.sel = (params.sel || []).filter((u) => DK.party.get(u) && !X().cannotMember(DK.party.get(u)));
    const sel = params.sel, ds = sel.map((u) => DK.party.get(u));
    const close = () => { params.plan = false; refresh(); };
    const zoneBtn = (z) => {
      const i = X().zoneInfo(z.id), on = z.id === params.z, hs = i.house && D.houses[i.house];
      // v4.87: lista (una fila por zona) con sus materiales; cabe cualquier número de zonas
      return h('button', { class: 'ex-zone' + (on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': on, style: { '--zc': zoneColor(z) }, onClick: () => { params.z = z.id; refresh(); } },
        h('span', { class: 'ex-zradio' }), DK.icon(z.icon || 'map', 18), h('span', { class: 'ex-zn' }, z.name),
        hs ? h('i', { class: 'ex-zh', style: { background: D.houseColor(i.house) }, tip: `${t('explore.houseTip')}: ${DK.tr('houses', hs)}` }) : null,
        h('span', { class: 'ex-zmats', 'aria-hidden': 'true' }, i.mats.slice(0, 4).map((id) => V.itemIcon(D.items[id], 18))),
        h('span', { class: 'ex-zl', tip: t('explore.lvTip') }, t('explore.lv', { n: i.lv })));
    };
    const durBtn = (x) => h('button', { type: 'button', class: params.dur === x.id ? 'on' : '', 'aria-pressed': params.dur === x.id, onClick: () => { params.dur = x.id; refresh(); } },
      h('b', null, t('explore.durs.' + x.id)), h('small', null, dur(X().minutes(ds, x.id))));
    const all = DK.party.all().filter((d) => !d.temp && !X().isTraining(d.uid)).sort((a, b) => b.level - a.level);
    params.who = params.who || 'all';
    const shown = all.filter((x) => params.who === 'all' || (params.who === 'team') === DK.party.isActive(x.uid));
    // Lista abierta si aún no hay nadie; al llenar el grupo se pliega sola
    if (params.listOpen == null) params.listOpen = !sel.length;
    const listOpen = !!params.listOpen;
    const toggle = (d) => { const i = sel.indexOf(d.uid); if (i >= 0) sel.splice(i, 1); else if (sel.length < C.partyMax) sel.push(d.uid); if (sel.length >= C.partyMax) params.listOpen = false; DK.audio.sfx('select'); refresh(); };
    const tile = (d) => {
      const why = X().cannotMember(d), on = sel.includes(d.uid), sp = DK.daskai.species(d), nat = C.natures[d.nature || 'equilibrada'];
      return h('button', { class: 'tr-tile ex-tile' + (on ? ' on' : '') + (why ? ' off' : ''), type: 'button', disabled: !!why || (!on && sel.length >= C.partyMax), 'aria-pressed': on,
        style: { '--c': D.houseColor(sp.house) }, tip: why || `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}${nat ? ' · ' + t('explore.nat.' + nat.key) : ''}`, onClick: () => toggle(d) },
        DK.party.isActive(d.uid) ? h('span', { class: 'tr-tag team', tip: t('team.inTeam') }, DK.icon('users', 11)) : null,
        on ? h('span', { class: 'ex-check' }, DK.icon('check', 12)) : null,
        V.dSprite(d, { size: 50 }), h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`),
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
    const rk = pv ? riskKey(pv.risk) : 'low', have = DK.bag.count('racion_viaje');
    const summary = pv && sel.length ? h('div', { class: 'ex-sum' },
      h('div', { class: 'ex-risk r-' + rk, tip: t('explore.riskTip') }, h('span', { class: 'muted small' }, t('explore.risk')),
        h('div', { class: 'ex-riskbar' }, h('span', { style: { width: Math.max(4, Math.round(pv.risk * 100)) + '%' } })), h('b', null, `${t('explore.riskLv.' + rk)} · ${pct(pv.risk)}`)),
      pv.houseMatch ? h('p', { class: 'small good-text' }, DK.icon('shield', 12), ' ', t('explore.houseMatch')) : null,
      h('div', { class: 'ex-sum-grid' },
        h('div', null, h('span', { class: 'muted small' }, t('explore.cost')),
          h('div', { class: 'ex-cost' }, h('span', { class: DK.wallet.get() < pv.cost.coins ? 'bad-text' : '' }, DK.icon('coin', 13), ' ', num(pv.cost.coins)),
            h('span', { class: have < pv.cost.rations ? 'bad-text' : '', tip: t('explore.rationsHave', { n: have }) }, V.itemIcon(D.items.racion_viaje, 18), ' ', t('explore.rations', { n: pv.cost.rations }))),
          have < pv.cost.rations ? btn({ icon: 'forgeRune', label: t('explore.craftRations'), size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('craft', { tab: 'consum', sel: 'racion_viaje' }) }) : null),
        h('div', null, h('span', { class: 'muted small' }, t('explore.expEach')),
          h('div', { class: 'ex-exps' }, pv.exp.map((e) => h('span', null, V.dSprite(e.d, { size: 22 }), ' +', num(e.n))))),
        h('div', null, h('span', { class: 'muted small' }, t('explore.loot')),
          h('div', { class: 'ex-mats' }, pv.info.mats.slice(0, 5).map((id) => h('span', { tip: D.items[id].name }, V.itemIcon(D.items[id], 22))), DK.icon('coin', 14)),
          h('small', { class: 'muted', tip: t('explore.approxTip') }, t('explore.approx', { n: X().zoneLoot(params.z, params.dur, sel).total }), ' · ', t('explore.lootRare', { s: Math.round(pv.stone * 100), g: Math.round(pv.gear * 100) })),
          h('button', { class: 'wb-mats-link ex-seeall', type: 'button', onClick: () => lootList(params.z, params.dur, sel) }, DK.icon('list', 12), t('explore.seeAll')))),
      pv.bonuses.length ? h('div', { class: 'chips ex-bon' }, pv.bonuses.map((b) => h('span', { class: 'chip pos' }, DK.daskai.name(b.d), ': ', t('explore.nat.' + b.key)))) : null) : null;
    return h('div', { class: 'panel stack ex-plan' },
      h('div', { class: 'panel-head' }, DK.icon('compass', 18), h('h3', null, t('explore.newTitle')), h('span', { class: 'grow' }), btn({ icon: 'back', label: t('explore.back'), size: 'sm', variant: 'ghost', onClick: close })),
      h('div', { class: 'stack-xs' }, h('span', { class: 'ex-h' }, t('explore.zone'),
        params.z ? h('button', { class: 'wb-mats-link ex-seeall', type: 'button', onClick: () => lootList(params.z, params.dur, sel) }, DK.icon('list', 12), t('explore.seeAll')) : null),
        zones.length ? h('div', { class: 'ex-zones', role: 'radiogroup' }, zones.map(zoneBtn)) : h('p', { class: 'muted' }, t('explore.pickZone'))),
      h('div', { class: 'stack-xs' }, h('span', { class: 'ex-h' }, t('explore.dur')), h('div', { class: 'ex-durs' }, C.durations.map(durBtn))),
      h('div', { class: 'stack-xs' }, h('span', { class: 'ex-h' }, t('explore.who', { n: sel.length, max: C.partyMax })),
        // v4.87: los elegidos arriba (con quitar) y la lista plegable para no tener que bajar tanto
        h('div', { class: 'ex-chosen' },
          ds.map((d) => h('button', { class: 'ex-pick', type: 'button', tip: t('explore.whoHint'), onClick: () => toggle(d) }, V.dSprite(d, { size: 30 }), h('span', null, h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`)), DK.icon('x', 12))),
          Array.from({ length: C.partyMax - ds.length }, () => h('button', { class: 'ex-pick empty', type: 'button', onClick: () => { params.listOpen = true; refresh(); } }, DK.icon('plus', 14))),
          h('button', { class: 'ex-listtog', type: 'button', 'aria-expanded': listOpen, onClick: () => { params.listOpen = !listOpen; refresh(); } },
            DK.icon('chevronDown', 14), listOpen ? t('explore.listHide') : t('explore.listShow', { n: all.length }))),
        listOpen ? [DK.ui.segmented({ value: params.who, onChange: (v) => { params.who = v; refresh(); },
          options: [{ value: 'all', label: t('train.whoAll', { n: all.length }) }, { value: 'team', label: t('train.whoTeam'), icon: 'users' }, { value: 'box', label: t('train.whoBox'), icon: 'grid' }] }),
          shown.length ? h('div', { class: 'tr-grid ex-grid' }, shown.map(tile)) : DK.ui.empty('users', t('explore.none'), '')] : null),
      summary,
      h('div', { class: 'row gap-s wrap between ex-go' }, why && sel.length ? h('span', { class: 'small bad-text' }, why) : h('span'),
        btn({ icon: 'compass', label: t('explore.go', { t: dur(X().minutes(ds, params.dur)) }), variant: 'primary', disabled: !!why, tip: why, onClick: go })));
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
      const grid = gs.map((g) => groupCard(g, refresh));
      // v4.88: mientras planificas, sólo se ven los grupos que ya están fuera (sin los huecos libres ni bloqueados)
      if (!params.plan) for (let i = gs.length; i < n; i++) grid.push(h('button', { class: 'card train-slot free ex-free', type: 'button', onClick: () => { params.plan = true; refresh(); } },
        DK.icon('plus', 26), h('b', null, t('explore.send')), h('span', { class: 'muted small' }, t('explore.sendHint'))));
      if (!params.plan) for (let i = n; i < X().slotMax(); i++) grid.push(h('div', { class: 'card train-slot locked', tip: t('explore.lockedTip') }, DK.icon('lock', 22), h('span', { class: 'muted small' }, t('explore.locked'))));
      clearInterval(params._timer);
      if (gs.length) params._timer = setInterval(() => { if (!document.querySelector('.train-screen')) return clearInterval(params._timer); if (!params.plan) refresh(); }, 20000);
      const reps = (DK.store.state.training.reports || []).slice(0, 5);
      return h('div', { class: 'screen train-screen ex-screen' },
        h('div', { class: 'card camp-hero' },
          h('span', { class: 'camp-hero-icon' }, DK.icon('compass', 34)),
          h('div', { class: 'grow' }, h('h2', null, t('explore.title')), h('p', { class: 'muted' }, t('explore.text')),
            h('div', { class: 'chips' },
              h('span', { class: 'chip' }, DK.icon('users', 13), t('explore.groups', { n: gs.length, max: n })),
              h('span', { class: 'chip', tip: t('explore.rationsHelp') }, V.itemIcon(D.items.racion_viaje, 16), t('explore.rationsHave', { n: DK.bag.count('racion_viaje') })))),
          h('div', { class: 'shop-wallet' }, V.coins(DK.wallet.get()))),
        params.plan ? planner(params, refresh) : null,
        grid.length ? h('div', { class: 'train-grid ex-groups' }, grid) : null,
        params.plan ? null : requestsCard(refresh),
        reps.length ? h('details', { class: 'ex-last' }, h('summary', null, DK.icon('clock', 13), ' ', t('explore.last')),
          h('ul', null, reps.map((r) => h('li', { class: r.hurt ? 'hurt' : '' }, h('b', null, D.zones[r.zone] ? D.zones[r.zone].name : r.zone), ' · ', r.names.join(', '), ' · ',
            DK.icon('coin', 11), ' ', num(r.coins), ' · ', Object.values(r.items).reduce((a, b) => a + b, 0), ' ', DK.icon('cube', 11), r.gear ? [' · ', DK.icon('gem', 11), ' ', r.gear] : null)))) : null,
        upgradePanel(refresh));
    },
    onLeave(params) { clearInterval(params._timer); },
  });
})();
