/* =============================================================
 * components/forgeBench.js — La Forja de Crafteo (v4.75): el taller
 * donde se trabaja una pieza de equipo hasta dejarla perfecta.
 *
 *   V.forgeBench(params, refresh)
 *     params: { fp (uid de la pieza), fsel (índice del afijo elegido), fgr (filtro de rareza), fq, _fx }
 *
 * Tres columnas (en el móvil, una debajo de otra):
 *   · Tus piezas: armería y lo que llevan tus daskai (filtro de rareza y buscador)
 *   · Mesa: la pieza en grande, sus huecos de prefijo y sufijo, afijos que se pueden
 *     elegir (para la esquirla, el templado y el sello), lo último que cambió, los afijos
 *     que pueden salir (con su probabilidad y el mejor valor a su nivel) y su historial
 *   · Piedras: agrupadas (subir rareza, volver a tirar, un afijo, legendario), con cuántas
 *     tienes y por qué no se puede usar alguna
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const GR = () => D.gear.rarities;
  const pct = (x) => (x >= 0.995 ? '100' : x < 0.01 ? '<1' : String(Math.round(x * 100))) + '%';

  /** Todas las piezas que se pueden trabajar en casa: { p, d } (d = quién la lleva). */
  function pieces() {
    return DK.gear.home().map((p) => ({ p, d: null })).concat(DK.gear.equipped().map((x) => ({ p: x.p, d: x.d })))
      .sort((a, b) => GR()[b.p.rarity].order - GR()[a.p.rarity].order || b.p.ilvl - a.p.ilvl);
  }

  /** Hace un rato: «hace 3 min». */
  const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t('gear.bench.ago.now') : m < 60 ? t('gear.bench.ago.min', { n: m }) : m < 1440 ? t('gear.bench.ago.h', { n: Math.round(m / 60) }) : t('gear.bench.ago.d', { n: Math.round(m / 1440) }); };

  V.forgeBench = (params, refresh) => {
    const narrow = DK.ui.isNarrow();
    const all = pieces();
    params.fgr = params.fgr || 'all';
    if (params.fp && !all.some((x) => x.p.uid === params.fp)) params.fp = null;
    if (!params.fp && all.length && !narrow) params.fp = all[0].p.uid;
    const cur = all.find((x) => x.p.uid === params.fp);
    const p = cur && cur.p;
    if (p && params.fsel != null && !p.affixes[params.fsel]) params.fsel = null;
    const pick = (uid) => { params.fp = uid; params.fsel = null; params._fx = null; refresh(); };

    /* ---- Tus piezas ---- */
    const q = (params.fq || '').trim().toLowerCase();
    const counts = {}; all.forEach(({ p: x }) => (counts[x.rarity] = (counts[x.rarity] || 0) + 1));
    const shown = all.filter(({ p: x }) => (params.fgr === 'all' || x.rarity === params.fgr) && (!q || DK.gear.name(x).toLowerCase().includes(q) || D.items[x.base].name.toLowerCase().includes(q)));
    const chip = (id, label, n) => h('button', { class: 'gear-filter sm' + (params.fgr === id ? ' on' : ''), type: 'button', style: id !== 'all' ? { '--g': GR()[id].color } : null, onClick: () => { params.fgr = id; refresh(); } },
      id !== 'all' ? h('i', { class: 'gear-dot' }) : null, label, h('b', null, String(n)));
    const listCol = h('div', { class: 'fb-col fb-pieces' },
      h('h4', { class: 'fb-h' }, DK.icon('gem', 14), t('gear.bench.pieces'), h('span', { class: 'muted' }, String(all.length))),
      all.length ? [
        h('div', { class: 'gear-filters fb-filters' }, chip('all', t('gear.all'), all.length), D.gear.rarityOrder.filter((r) => counts[r]).map((r) => chip(r, t('gear.rarity.' + r), counts[r]))),
        all.length > 6 ? h('input', { class: 'input fb-search', type: 'search', placeholder: t('inv.search'), value: params.fq || '',
          onInput: (e) => { params.fq = e.target.value; clearTimeout(params._fqt); params._fqt = setTimeout(() => { refresh(); const i = document.querySelector('.fb-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); } }) : null,
        h('div', { class: 'fb-list' }, shown.map(({ p: x }) => V.gearTile(x, { compact: true, selected: x.uid === params.fp, onClick: () => pick(x.uid) }))),
      ] : DK.ui.empty('gem', t('gear.bench.none'), t('gear.bench.noneText')));

    if (!p) {
      return h('div', { class: 'forge-bench empty' }, listCol,
        h('div', { class: 'fb-col fb-mesa' }, DK.ui.empty('anvil', t('gear.bench.empty'), t('gear.bench.emptyText'))));
    }

    /* ---- Mesa ---- */
    const fx = params._fx && params._fx.uid === p.uid ? params._fx : null;
    const forgeIt = (stone) => {
      const r = DK.gear.forge(p.uid, stone, { affix: params.fsel });
      if (!r.ok) { DK.audio.sfx('error'); toast(r.msg, { icon: 'x', kind: 'bad' }); return; }
      params._fx = { uid: p.uid, keys: V.gearDiffKeys(r.before, r.p), before: r.before, stone };
      // El afijo elegido sigue elegido si sigue ahí (templado, sello); si no, se suelta
      if (!['piedra_templado', 'sello_forja', 'esquirla_jefe', 'piedra_divina'].includes(stone)) params.fsel = null;
      DK.audio.sfx(r.p.rarity !== r.before.rarity ? 'levelup' : 'craft');
      toast(r.msg, { icon: D.items[stone].icon, kind: 'good' });
      refresh();
    };
    const sl = DK.gear.slots(p);
    const pips = (used, max) => h('span', { class: 'fb-pips' }, [...Array(max).keys()].map((i) => h('i', { class: i < used ? 'on' : '' })));
    const slotsBar = h('div', { class: 'fb-slotsbar' },
      h('span', { class: 'fb-slot-g' }, h('b', null, 'P'), t('gear.bench.prefixes'), pips(sl.P[0], sl.P[1])),
      h('span', { class: 'fb-slot-g' }, h('b', null, 'S'), t('gear.bench.suffixes'), pips(sl.S[0], sl.S[1])),
      h('span', { class: 'fb-slot-tot muted small' }, `${p.affixes.length}/${sl.total}`),
      h('span', { class: 'fb-ilvl', tip: t('gear.bench.ilvlTip') }, DK.icon('info', 12), t('gear.ilvlN', { n: p.ilvl })));
    const selA = params.fsel != null ? p.affixes[params.fsel] : null;
    const tip = V.gearTip(p, { changed: fx ? fx.keys : null, sel: params.fsel, onSelect: p.affixes.length ? (i) => { params.fsel = i; refresh(); } : null });
    const selLine = h('p', { class: 'fb-selhint small' + (selA ? ' on' : '') }, DK.icon(selA ? 'target' : 'info', 13),
      selA ? t('gear.bench.selected', { a: DK.gear.affixText(selA) }) : t('gear.bench.selectHint'));
    const lastBox = fx ? h('details', { class: 'fb-last' }, h('summary', null, DK.icon('refresh', 13), t('gear.bench.last', { stone: D.items[fx.stone].name }), h('span', { class: 'muted' }, ` · ${t('gear.bench.before')}`)),
      V.gearTip(fx.before, { compact: true })) : null;

    // Afijos que pueden salir
    const poolList = DK.gear.affixPool(p);
    const poolRow = (a) => h('div', { class: 'fb-pool-row ' + a.kind },
      h('span', { class: 'gt-kind' }, a.kind === 'prefix' ? 'P' : 'S'),
      h('span', { class: 'grow' }, t(`gear.affix.${a.id}.text`, { v: a.range[0] === a.range[1] ? a.range[0] : `${a.range[0]}–${a.range[1]}` })),
      h('span', { class: 'fb-pool-pct' }, pct(a.chance)));
    const tiers = DK.gear.tierChances(p);
    const pool = h('details', { class: 'fb-block fb-pool', open: !narrow },
      h('summary', null, DK.icon('dice', 14), t('gear.bench.pool')), h('p', { class: 'muted small fb-pool-hint' }, t('gear.bench.poolHint', { n: tiers.length })),
      h('div', { class: 'fb-tiers' }, h('span', { class: 'muted small' }, t('gear.bench.tiers')), tiers.map((x) => h('span', { class: 'gt-tier t' + x.t }, `N${x.t} ${pct(x.chance)}`))),
      h('div', { class: 'fb-pool-cols' },
        h('div', null, poolList.filter((a) => a.kind === 'prefix').map(poolRow)),
        h('div', null, poolList.filter((a) => a.kind === 'suffix').map(poolRow))));
    // Historial
    const hist = h('details', { class: 'fb-block fb-hist', open: !narrow && !!(p.hist && p.hist.length) },
      h('summary', null, DK.icon('clock', 14), t('gear.bench.hist'), h('span', { class: 'muted small' }, ` (${(p.hist || []).length})`)),
      (p.hist || []).length ? h('ol', { class: 'fb-hist-list' }, p.hist.map((e) => h('li', null, V.itemIcon(D.items[e.s], 18),
        h('span', { class: 'grow' }, h('b', null, D.items[e.s].name), h('small', null, e.from === e.to ? e.to : `${e.from} → ${e.to}`)), h('small', { class: 'muted' }, ago(e.at)))))
        : h('p', { class: 'muted small' }, t('gear.bench.histNone')));
    /* ---- Piedras ---- */
    const stoneBtn = (id) => {
      const it = D.items[id], n = DK.bag.home()[id] || 0;
      const needSel = DK.gear.targeted.includes(id) && params.fsel == null;
      const why = DK.gear.cannotForge(p, id, { affix: params.fsel }) || (needSel && n ? t('gear.bench.needSel') : null);
      // v4.76: fila compacta: gema, nombre y efecto en una línea, cantidad; el motivo, en el tooltip
      return h('button', { class: 'fs-row' + (why ? ' off' : '') + (n ? '' : ' none') + (['esquirla_jefe', 'corazon_jefe', 'eco_legendario'].includes(id) ? ' boss' : '') + (needSel && n && !DK.gear.cannotForge(p, id) ? ' wants' : ''),
        type: 'button', disabled: !!why, tip: (why ? why + ' · ' : '') + it.desc, 'aria-label': it.name, onClick: () => forgeIt(id) },
        V.itemIcon(it, 26), h('span', { class: 'fs-main' }, h('b', null, it.name.replace(/^Piedra (de |del )?/i, '').replace(/^\w/, (c) => c.toUpperCase())), h('small', null, t('gear.stoneShort.' + id))),
        h('span', { class: 'fs-n' + (n ? '' : ' zero') }, String(n)));
    };
    const stonesCol = h('div', { class: 'fb-col fb-stones' },
      h('h4', { class: 'fb-h' }, DK.icon('anvil', 14), t('gear.bench.stones'), h('span', { class: 'muted small' }, t('gear.forgeHint.' + p.rarity))),
      Object.entries(DK.gear.groups).map(([g, ids]) => h('div', { class: 'fb-group' }, h('span', { class: 'fb-group-h' }, t('gear.bench.g.' + g)), h('div', { class: 'fs-grid' }, ids.map(stoneBtn)))),
      h('p', { class: 'muted small fb-buy' }, DK.icon('info', 12), ' ', t('gear.bench.buyHint')));

    const mesa = h('div', { class: 'fb-col fb-mesa' },
      cur.d ? h('p', { class: 'fb-worn small' }, V.dSprite(cur.d, { size: 22 }), t('gear.bench.worn', { name: DK.daskai.name(cur.d) })) : null,
      slotsBar, tip, p.affixes.length ? selLine : null, lastBox,
      h('div', { class: 'gear-actions' }, btn({ icon: 'gem', label: t('gear.equipOnBtn'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.equipPicker(p.uid)) refresh(); } })),
      narrow ? stonesCol : null, // en el móvil, las piedras justo debajo de la pieza
      pool, hist);

    return h('div', { class: 'forge-bench' }, listCol, mesa, narrow ? null : stonesCol);
  };
})();
