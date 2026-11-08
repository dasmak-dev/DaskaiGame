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

  /** v4.79: filtros del selector de piezas. */
  const SORTS = {
    rar: (a, b) => GR()[b.p.rarity].order - GR()[a.p.rarity].order || b.p.ilvl - a.p.ilvl,
    ilvl: (a, b) => b.p.ilvl - a.p.ilvl || GR()[b.p.rarity].order - GR()[a.p.rarity].order,
    name: (a, b) => DK.gear.name(a.p).localeCompare(DK.gear.name(b.p)),
    q: (a, b) => DK.gear.quality(b.p).score - DK.gear.quality(a.p).score, // v4.84: calidad
  };
  const statIcon = (k) => (D.stats[k] ? D.stats[k].icon : 'regen');
  const statLabel = (k) => DK.tr('stats', D.stats[k]);

  /** Fila compacta del selector: icono, nombre, tipo · nivel, huecos y quién la lleva. */
  function pieceRow(x, d, on, onClick) {
    const sl = DK.gear.slots(x), k = DK.gear.primaryOf(x.base);
    const dots = (used, max, cls) => [...Array(max).keys()].map((i) => h('i', { class: cls + (i < used ? ' on' : '') }));
    return h('button', { class: 'fp-row g-' + x.rarity + (on ? ' on' : ''), type: 'button', style: { '--g': GR()[x.rarity].color }, 'aria-pressed': on, onClick,
      tip: `${DK.gear.name(x)} · ${t('gear.rarity.' + x.rarity)} · ${V.gearLine(x)}` },
      h('span', { class: 'fp-ico' }, V.gearIcon(x, 30)),
      h('span', { class: 'fp-main' },
        h('b', { class: 'fp-name' }, DK.gear.name(x)),
        h('small', { class: 'fp-sub' }, h('span', { class: 'fp-stat', tip: t('gear.bench.statTip', { stat: statLabel(k) }) }, DK.icon(statIcon(k), 14)), DK.gear.typeName(x), h('span', { class: 'fp-lv' }, t('gear.ilvlN', { n: x.ilvl })))),
      x.lk ? h('span', { class: 'fp-lk', tip: t('gear.lockedPiece') }, DK.icon('lock', 12)) : null,
      V.gearQuality(x, { small: true }),
      sl.total ? h('span', { class: 'fp-slots', 'aria-hidden': 'true' }, h('span', null, dots(sl.P[0], sl.P[1], 'p')), h('span', null, dots(sl.S[0], sl.S[1], 's'))) : null,
      d ? h('span', { class: 'fp-worn' }, V.dSprite(d, { size: 26 })) : h('span', { class: 'fp-worn none' }));
  }

  /** v4.84: ventana de desguace en lote (sólo piezas sueltas y sin bloquear). */
  function salvageDialog(refresh) {
    const pick = { normal: true, magico: true, raro: false };
    const content = () => {
      const box = h('div', { class: 'stack-s fb-batch' });
      const draw = () => {
        const list = DK.gear.home().filter((p) => pick[p.rarity] && !p.lk), f = list.reduce((s, p) => s + DK.gear.salvageValue(p).fragmento_forja, 0);
        const locked = DK.gear.home().filter((p) => pick[p.rarity] && p.lk).length;
        box.replaceChildren(
          h('p', { class: 'muted small' }, t('gear.batch.text')),
          h('div', { class: 'fb-batch-rars' }, Object.keys(pick).map((r) => {
            const n = DK.gear.home().filter((p) => p.rarity === r && !p.lk).length;
            return h('label', { class: 'fb-batch-rar' + (pick[r] ? ' on' : ''), style: { '--g': GR()[r].color } },
              h('input', { type: 'checkbox', checked: pick[r], onChange: (e) => { pick[r] = e.target.checked; draw(); } }), h('i', { class: 'gear-dot' }), t('gear.rarity.' + r), h('b', null, String(n)));
          })),
          h('div', { class: 'fb-batch-sum' }, h('span', null, t('gear.batch.sum', { n: list.length })), h('span', { class: 'fb-batch-f' }, V.itemIcon(D.items.fragmento_forja, 20), '+' + f)),
          locked ? h('p', { class: 'muted small' }, DK.icon('lock', 12), ' ', t('gear.batch.locked', { n: locked })) : null);
        box._list = list; box._f = f;
      };
      draw();
      return box;
    };
    let body;
    const m = DK.ui.modal({ title: t('gear.batch.title'), icon: 'hammer', content: () => (body = content()),
      actions: [{ label: t('common.cancel'), icon: 'x', variant: 'ghost', value: null },
        { label: t('gear.salvage'), icon: 'hammer', variant: 'danger', onClick: (close) => {
          if (!body._list.length) { close(null); return; }
          const r = DK.gear.salvageMany(Object.keys(pick).filter((k) => pick[k]));
          DK.audio.sfx('craft'); toast(t('gear.salvagedAll', { n: r.n, f: r.f }), { icon: 'hammer', kind: 'good' }); close(true); refresh();
        } }] });
    return m.promise;
  }

  V.forgeBench = (params, refresh) => {
    const narrow = DK.ui.isNarrow();
    const all = pieces();
    params.fgr = params.fgr || 'all'; params.fst = params.fst || 'all'; params.floc = params.floc || 'all'; params.fsort = params.fsort || 'rar';
    // v4.79: al entrar no hay ninguna pieza elegida: el jugador elige una
    if (params.fp && !all.some((x) => x.p.uid === params.fp)) params.fp = null;
    const cur = all.find((x) => x.p.uid === params.fp);
    const p = cur && cur.p;
    if (p && params.fsel != null && !p.affixes[params.fsel]) params.fsel = null;
    const pick = (uid) => { params.fp = params.fp === uid ? null : uid; params.fsel = null; params._fx = null; params.farm = null; params.fhist = params.flast = false; refresh(); };

    /* ---- Tus piezas (v4.79: selector compacto con filtros) ---- */
    const q = (params.fq || '').trim().toLowerCase();
    const okR = (x) => params.fgr === 'all' || x.p.rarity === params.fgr;
    const okS = (x) => params.fst === 'all' || DK.gear.primaryOf(x.p.base) === params.fst;
    const okL = (x) => params.floc === 'all' || (params.floc === 'eq' ? !!x.d : !x.d);
    const okQ = (x) => !q || DK.gear.name(x.p).toLowerCase().includes(q) || D.items[x.p.base].name.toLowerCase().includes(q) || DK.gear.typeName(x.p).toLowerCase().includes(q);
    // Cada contador cuenta con los demás filtros puestos (así se ve de un vistazo qué queda)
    const count = (f) => all.filter((x) => f(x) && okQ(x)).length;
    const shown = all.filter((x) => okR(x) && okS(x) && okL(x) && okQ(x)).sort(SORTS[params.fsort] || SORTS.rar);
    const set = (k, v) => () => { params[k] = params[k] === v && v !== 'all' ? 'all' : v; refresh(); };
    const rarChip = (r) => { const n = count((x) => x.p.rarity === r && okS(x) && okL(x)); return h('button', { class: 'fp-chip rar' + (params.fgr === r ? ' on' : '') + (n ? '' : ' zero'), type: 'button', style: { '--g': GR()[r].color }, tip: t('gear.rarity.' + r), 'aria-label': t('gear.rarity.' + r), 'aria-pressed': params.fgr === r, onClick: set('fgr', r) }, h('i', { class: 'gear-dot' }), h('span', { class: 'fp-lbl' }, t('gear.rarity.' + r)), h('b', null, String(n))); };
    const stats = [...new Set(Object.values(D.gear.primary))];
    const statChip = (k) => { const n = count((x) => DK.gear.primaryOf(x.p.base) === k && okR(x) && okL(x)); return n || params.fst === k ? h('button', { class: 'fp-chip st' + (params.fst === k ? ' on' : ''), type: 'button', tip: t('gear.bench.statTip', { stat: statLabel(k) }), 'aria-label': statLabel(k), 'aria-pressed': params.fst === k, onClick: set('fst', k) }, DK.icon(statIcon(k), 15), h('b', null, String(n))) : null; };
    const locSeg = h('span', { class: 'fp-seg' }, ['all', 'home', 'eq'].map((k) => h('button', { class: params.floc === k ? 'on' : '', type: 'button', 'aria-pressed': params.floc === k, onClick: () => { params.floc = k; refresh(); } }, t('gear.bench.loc.' + k))));
    const filtered = params.fgr !== 'all' || params.fst !== 'all' || params.floc !== 'all' || !!q;
    const browse = !p; // sin pieza elegida, el selector ocupa la mesa
    // v4.83: barra de filtros moderna y sencilla: buscador con contador, Todas/Sueltas/Equipadas y orden
    // en una fila; debajo, una sola tira de píldoras (rarezas y atributo principal) y «Limpiar»
    const sortNext = { rar: 'ilvl', ilvl: 'q', q: 'name', name: 'rar' };
    const refocus = () => { const i = document.querySelector('.fp-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
    const bar = h('div', { class: 'fp-bar' },
      h('label', { class: 'fp-search' }, DK.icon('search', 15),
        h('input', { class: 'fp-q', type: 'search', placeholder: t('gear.bench.searchN', { n: all.length }), value: params.fq || '', 'aria-label': t('inv.search'),
          onInput: (e) => { params.fq = e.target.value; clearTimeout(params._fqt); params._fqt = setTimeout(() => { refresh(); refocus(); }, 220); } }),
        filtered ? h('span', { class: 'fp-count' }, `${shown.length}/${all.length}`) : null),
      locSeg,
      h('button', { class: 'fp-sortbtn', type: 'button', tip: t('gear.bench.sortBy'), 'aria-label': `${t('gear.bench.sortBy')}: ${t('gear.bench.sort.' + params.fsort)}`,
        onClick: () => { params.fsort = sortNext[params.fsort] || 'rar'; refresh(); } }, DK.icon('swap', 14), h('span', { class: 'fp-sortlbl' }, t('gear.bench.sort.' + params.fsort))),
      // v4.84: desguazar en lote
      h('button', { class: 'fp-sortbtn fp-salv', type: 'button', tip: t('gear.batch.title'), 'aria-label': t('gear.batch.title'), onClick: () => salvageDialog(refresh) }, DK.icon('hammer', 14), h('span', { class: 'fp-sortlbl' }, t('gear.batch.short'))));
    const chips = h('div', { class: 'fp-chips' },
      D.gear.rarityOrder.map(rarChip), h('i', { class: 'fp-div', 'aria-hidden': 'true' }), stats.map(statChip),
      filtered ? h('button', { class: 'fp-clear', type: 'button', onClick: () => { params.fgr = params.fst = params.floc = 'all'; params.fq = ''; refresh(); } }, DK.icon('x', 12), t('gear.bench.clear')) : null);
    const listCol = h('div', { class: 'fb-col fb-pieces' + (browse ? ' browse' : '') },
      all.length ? [bar, chips,
        shown.length ? h('div', { class: 'fp-list' }, shown.map((x) => pieceRow(x.p, x.d, x.p.uid === params.fp, () => pick(x.p.uid))))
          : h('p', { class: 'muted small fp-nomatch' }, t('gear.bench.noMatch')),
      ] : DK.ui.empty('gem', t('gear.bench.none'), t('gear.bench.noneText')));

    if (!p) {
      return h('div', { class: 'forge-bench browse' }, listCol);
    }

    /* ---- Mesa ---- */
    const fx = params._fx && params._fx.uid === p.uid ? params._fx : null;
    // v4.84: toda acción pasa por ask(): enseña qué cambiará y pide confirmar (salvo si se desactivó)
    const ask = (stone, kind) => {
      if (DK.settings.get('confirmForge') === false) { forgeIt(stone, kind); return; }
      params.farm = { stone, kind: kind || null, affix: params.fsel, uid: p.uid }; refresh();
    };
    const forgeIt = (stone, kind) => {
      params.farm = null;
      const r = DK.gear.forge(p.uid, stone, { affix: params.fsel, kind });
      if (!r.ok) { DK.audio.sfx('error'); toast(r.msg, { icon: 'x', kind: 'bad' }); return; }
      params._fx = { uid: p.uid, keys: V.gearDiffKeys(r.before, r.p), before: r.before, stone };
      // El afijo elegido sigue elegido si sigue ahí (templado, sello); si no, se suelta
      if (!['piedra_templado', 'sello_forja', 'esquirla_jefe', 'piedra_cambio', 'piedra_divina'].includes(stone)) params.fsel = null;
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
    const have = (id) => DK.bag.home()[id] || 0;
    const short = (id) => D.items[id].name.replace(/^(Piedra|Cristal) (de |del )?/i, '').replace(/^\w/, (c) => c.toUpperCase());
    // v4.79: huecos libres → «+ Añadir prefijo/sufijo» (aumento en mágicas, exaltación en raras y legendarias)
    const adder = DK.gear.adderFor(p);
    const addSlot = adder ? (kind, free) => {
      const n = have(adder), why = DK.gear.cannotForge(p, adder, { kind });
      return h('button', { class: 'gt-affix empty ' + kind + (why ? ' off' : ''), type: 'button', disabled: !!why,
        tip: (why ? why + ' · ' : '') + t('gear.bench.addWith', { stone: D.items[adder].name, n }), onClick: () => ask(adder, kind) },
        h('span', { class: 'gt-kind' }, kind === 'prefix' ? 'P' : 'S'),
        h('span', { class: 'grow' }, DK.icon('plus', 12), ' ', t(kind === 'prefix' ? 'gear.bench.addP' : 'gear.bench.addS'), free > 1 ? h('small', { class: 'muted' }, ` ×${free}`) : null),
        h('span', { class: 'fa-cost' + (n ? '' : ' zero') }, V.itemIcon(D.items[adder], 16), String(n)));
    } : null;
    // v4.79: barra bajo el afijo elegido: cambiarlo (sólo ése), esquirla, templar o sellar
    const ACTS = [['piedra_cambio', 'cambio'], ['esquirla_jefe', 'esquirla'], ['piedra_templado', 'templado'], ['sello_forja', 'sello']];
    const selBar = params.fsel != null ? h('div', { class: 'fa-bar', role: 'group' },
      ACTS.filter(([id]) => id !== 'esquirla_jefe' || have(id)).map(([id, k]) => {
        const n = have(id), why = DK.gear.cannotForge(p, id, { affix: params.fsel });
        return h('button', { class: 'fa-act' + (why ? ' off' : '') + (id === 'esquirla_jefe' ? ' boss' : ''), type: 'button', disabled: !!why,
          tip: (why ? why + ' · ' : '') + D.items[id].desc, onClick: () => ask(id) },
          V.itemIcon(D.items[id], 16), h('span', null, t('gear.bench.act.' + k)), h('b', { class: n ? '' : 'zero' }, String(n)));
      }),
      h('button', { class: 'fa-x', type: 'button', 'aria-label': t('common.close'), onClick: () => { params.fsel = null; refresh(); } }, DK.icon('x', 12))) : null;
    // v4.80: re-tirar el atributo principal con la piedra de núcleo
    const onMain = (a) => {
      const id = 'piedra_nucleo', n = have(id), why = DK.gear.cannotForge(p, id), [lo, hi] = DK.gear.attrRange(p, a);
      return h('button', { class: 'gt-mainroll' + (why ? ' off' : ''), type: 'button', disabled: !!why, 'aria-label': D.items[id].name,
        tip: (why ? why + ' · ' : '') + t('gear.bench.mainRoll', { a: lo, b: hi, stone: D.items[id].name, n }), onClick: () => ask(id) },
        V.itemIcon(D.items[id], 16), h('b', { class: n ? '' : 'zero' }, String(n)));
    };
    // v4.84: piedra «armada» (esperando confirmación) y su vista previa
    const arm = params.farm && params.farm.uid === p.uid && !(params.farm.until) && !DK.gear.cannotForge(p, params.farm.stone, { affix: params.farm.affix, kind: params.farm.kind }) ? params.farm
      : params.farm && params.farm.until && params.farm.uid === p.uid ? params.farm : null;
    if (!arm) params.farm = null;
    const pv = arm && !arm.until ? DK.gear.forgePreview(p, arm.stone, { affix: arm.affix, kind: arm.kind }) : null;
    const tip = V.gearTip(p, { will: pv ? pv.keys : null, changed: fx ? fx.keys : null, sel: params.fsel, selBar, addSlot, onMain, onSelect: p.affixes.length ? (i) => { params.fsel = i; params.farm = null; refresh(); } : null });
    const selLine = h('p', { class: 'fb-selhint small' + (selA ? ' on' : '') }, DK.icon(selA ? 'target' : 'info', 13),
      selA ? t('gear.bench.actHint') : t('gear.bench.selectHint'));

    /* ---- Confirmar (v4.84) ---- */
    const confirmBox = arm ? (() => {
      const it = D.items[arm.until ? DK.gear.rerollerFor(p) : arm.stone], n = have(it.id);
      const go = () => {
        if (arm.until) { params.farm = null; runUntil(arm.max); return; }
        forgeIt(arm.stone, arm.kind);
      };
      return h('div', { class: 'fb-confirm', role: 'dialog', 'aria-label': t('gear.cf.title') },
        h('div', { class: 'fbc-head' }, V.itemIcon(it, 30),
          h('div', { class: 'grow' }, h('b', null, arm.until ? t('gear.until.title') : t('gear.cf.use', { stone: it.name })), h('small', { class: 'muted' }, t('gear.cf.have', { n }))),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.cancel'), onClick: () => { params.farm = null; refresh(); } }, DK.icon('x', 14))),
        arm.until ? h('ul', { class: 'fbc-lines' },
          h('li', { class: 'warn' }, t('gear.until.text', { n: arm.max, stone: it.name })),
          h('li', null, t('gear.until.wants', { list: (params.fwant || []).map((id) => t(`gear.affix.${id}.name`)).join(', ') })))
          : h('ul', { class: 'fbc-lines' }, pv.lines.map((l) => h('li', { class: l.kind }, l.text))),
        pv && pv.odds.length ? h('div', { class: 'fbc-odds' }, h('small', { class: 'muted' }, t('gear.pv.odds')),
          pv.odds.map((o) => h('div', { class: 'fbc-odd' + (o.only ? ' excl' : '') }, o.only ? DK.icon('star', 10) : null, h('span', { class: 'grow' }, o.text), h('b', null, pct(o.chance))))) : null,
        h('div', { class: 'fbc-actions' },
          h('label', { class: 'fbc-skip' }, h('input', { type: 'checkbox', onChange: (e) => DK.settings.set('confirmForge', !e.target.checked) }), t('gear.cf.dontAsk')),
          btn({ label: t('common.cancel'), size: 'sm', variant: 'ghost', onClick: () => { params.farm = null; refresh(); } }),
          btn({ icon: 'check', label: t('gear.cf.ok'), size: 'sm', variant: 'primary', cls: 'fbc-ok', onClick: go })));
    })() : null;

    /* ---- Tirar hasta conseguirlo (v4.84) ---- */
    params.fwant = params.fwantUid === p.uid ? params.fwant || [] : [];
    params.fwantUid = p.uid;
    const reroller = DK.gear.rerollerFor(p);
    const runUntil = (max) => {
      const r = DK.gear.rollUntil(p.uid, params.fwant, max);
      if (!r.ok) { DK.audio.sfx('error'); toast(r.msg, { icon: 'x', kind: 'bad' }); refresh(); return; }
      params._fx = { uid: p.uid, keys: V.gearDiffKeys(r.before, p), before: r.before, stone: r.stone };
      DK.audio.sfx(r.hit ? 'levelup' : 'craft');
      toast(r.msg, { icon: r.hit ? 'target' : 'dice', kind: r.hit ? 'good' : '' });
      refresh();
    };
    const wantToggle = (id) => { const w = params.fwant; const i = w.indexOf(id); if (i >= 0) w.splice(i, 1); else w.push(id); refresh(); };
    params.fmax = params.fmax || 5;
    const untilBox = reroller && params.fwant.length ? (() => {
      const n = have(reroller), max = Math.max(1, Math.min(params.fmax, n || 1));
      const why = DK.gear.cannotForge(p, reroller) || (p.affixes.some((a) => params.fwant.includes(a.id)) ? t('gear.until.already') : null);
      return h('div', { class: 'fb-until' },
        h('div', { class: 'fbu-main' }, DK.icon('target', 14), h('span', { class: 'grow small' }, t('gear.until.box', { n: params.fwant.length, stone: D.items[reroller].name, have: n }))),
        h('div', { class: 'fbu-ctl' },
          h('span', { class: 'wb-qty' },
            h('button', { type: 'button', 'aria-label': '−', disabled: max <= 1, onClick: () => { params.fmax = Math.max(1, max - 1); refresh(); } }, DK.icon('minus', 12)),
            h('b', null, String(max)),
            h('button', { type: 'button', 'aria-label': '+', disabled: max >= n, onClick: () => { params.fmax = max + 1; refresh(); } }, DK.icon('plus', 12))),
          btn({ icon: 'dice', label: t('gear.until.go'), size: 'sm', variant: 'tone', disabled: !!why, tip: why || null,
            onClick: () => { if (DK.settings.get('confirmForge') === false) { runUntil(max); return; } params.farm = { until: true, max, uid: p.uid }; refresh(); } }),
          h('button', { class: 'fbu-clear', type: 'button', onClick: () => { params.fwant = []; refresh(); } }, t('gear.bench.clear'))));
    })() : null;

    // Afijos que pueden salir
    const poolList = DK.gear.affixPool(p);
    const poolRow = (a) => h('div', { class: 'fb-pool-row ' + a.kind + (a.only ? ' excl' : '') + (params.fwantUid === p.uid && (params.fwant || []).includes(a.id) ? ' want' : ''), tip: a.only ? t('gear.exclusive', { type: t(`gear.type.${a.only}.one`) }) : null },
      DK.gear.rerollerFor(p) ? h('button', { class: 'fbp-want', type: 'button', tip: t('gear.until.mark'), 'aria-label': t('gear.until.mark'), 'aria-pressed': (params.fwant || []).includes(a.id), onClick: () => wantToggle(a.id) }, DK.icon('target', 12)) : null,
      h('span', { class: 'gt-kind' }, a.kind === 'prefix' ? 'P' : 'S'), a.only ? h('span', { class: 'gt-excl' }, DK.icon('star', 11)) : null,
      h('span', { class: 'grow' }, t(`gear.affix.${a.id}.text`, { v: a.range[0] === a.range[1] ? a.range[0] : `${a.range[0]}–${a.range[1]}` })),
      h('span', { class: 'fb-pool-pct' }, pct(a.chance)));
    const tiers = DK.gear.tierChances(p);
    const pool = h('details', { class: 'fb-block fb-pool', open: !narrow },
      h('summary', null, DK.icon('dice', 14), t('gear.bench.pool')), h('p', { class: 'muted small fb-pool-hint' }, t('gear.bench.poolHint', { n: tiers.length }), DK.gear.rerollerFor(p) ? ' ' + t('gear.until.hint') : ''),
      untilBox,
      h('div', { class: 'fb-tiers' }, h('span', { class: 'muted small' }, t('gear.bench.tiers')), tiers.map((x) => h('span', { class: 'gt-tier t' + x.t }, `N${x.t} ${pct(x.chance)}`))),
      h('div', { class: 'fb-pool-cols' },
        h('div', null, poolList.filter((a) => a.kind === 'prefix').map(poolRow)),
        h('div', null, poolList.filter((a) => a.kind === 'suffix').map(poolRow))));
    // v4.79: historial oculto por defecto, como un enlace discreto al pie
    const nh = (p.hist || []).length;
    // v4.80: el «último cambio» (cómo estaba antes) va al lado, igual de discreto
    const tog = (k, other) => () => { params[k] = !params[k]; params[other] = false; refresh(); };
    const hist = nh || fx ? h('div', { class: 'fb-histwrap' },
      h('div', { class: 'fb-foot' },
        fx ? h('button', { class: 'wb-mats-link fb-lastlink', type: 'button', 'aria-expanded': !!params.flast, onClick: tog('flast', 'fhist') },
          DK.icon('refresh', 12), t('gear.bench.lastLink', { stone: D.items[fx.stone].name.replace(/^(Piedra|Cristal) (de |del )?/i, '') }), DK.icon('chevronDown', 12)) : null,
        nh ? h('button', { class: 'wb-mats-link fb-histlink', type: 'button', 'aria-expanded': !!params.fhist, onClick: tog('fhist', 'flast') },
          DK.icon('clock', 12), t('gear.bench.histLink', { n: nh }), DK.icon('chevronDown', 12)) : null),
      fx && params.flast ? h('div', { class: 'fb-before' }, h('small', { class: 'muted' }, t('gear.bench.before')), V.gearTip(fx.before, { compact: true })) : null,
      params.fhist ? h('ol', { class: 'fb-hist-list' }, p.hist.map((e) => h('li', null, V.itemIcon(D.items[e.s], 18),
        h('span', { class: 'grow' }, h('b', null, D.items[e.s].name), h('small', null, e.from === e.to ? e.to : `${e.from} → ${e.to}`)), h('small', { class: 'muted' }, ago(e.at))))) : null) : null;
    /* ---- Piedras ---- */
    const stoneBtn = (id) => {
      const it = D.items[id], n = DK.bag.home()[id] || 0;
      const needSel = DK.gear.targeted.includes(id) && params.fsel == null;
      const why = DK.gear.cannotForge(p, id, { affix: params.fsel }) || (needSel && n ? t('gear.bench.needSel') : null);
      // v4.76: fila compacta: gema, nombre y efecto en una línea, cantidad; el motivo, en el tooltip
      return h('button', { class: 'fs-row' + (arm && arm.stone === id ? ' armed' : '') + (why ? ' off' : '') + (n ? '' : ' none') + (['esquirla_jefe', 'corazon_jefe', 'eco_legendario'].includes(id) ? ' boss' : '') + (needSel && n && !DK.gear.cannotForge(p, id) ? ' wants' : ''),
        type: 'button', disabled: !!why, tip: (why ? why + ' · ' : '') + it.desc, 'aria-label': it.name, 'aria-pressed': !!(arm && arm.stone === id), onClick: () => ask(id) },
        V.itemIcon(it, 26), h('span', { class: 'fs-main' }, h('b', null, it.name.replace(/^(Piedra|Cristal) (de |del )?/i, '').replace(/^\w/, (c) => c.toUpperCase())), h('small', null, t('gear.stoneShort.' + id))),
        h('span', { class: 'fs-n' + (n ? '' : ' zero') }, String(n)));
    };
    const stonesCol = h('div', { class: 'fb-col fb-stones' },
      Object.entries(DK.gear.groups).map(([g, ids]) => h('div', { class: 'fb-group' }, h('span', { class: 'fb-group-h' }, t('gear.bench.g.' + g)), h('div', { class: 'fs-grid' }, ids.map(stoneBtn)))),
      h('p', { class: 'muted small fb-buy' }, DK.icon('info', 12), ' ', t('gear.bench.buyHint')));

    const mesa = h('div', { class: 'fb-col fb-mesa' },
      narrow ? h('button', { class: 'fb-back', type: 'button', onClick: () => pick(p.uid) }, DK.icon('back', 14), t('gear.bench.change'), h('span', { class: 'muted small' }, String(all.length))) : null,
      cur.d ? h('p', { class: 'fb-worn small' }, V.dSprite(cur.d, { size: 22 }), t('gear.bench.worn', { name: DK.daskai.name(cur.d) })) : null,
      slotsBar, tip, p.affixes.length ? selLine : null,
      confirmBox,
      h('div', { class: 'gear-actions' }, btn({ icon: 'gem', label: t('gear.equipOnBtn'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.equipPicker(p.uid)) refresh(); } }),
        btn({ icon: 'lock', label: t(p.lk ? 'gear.unlock' : 'gear.lock'), size: 'sm', variant: p.lk ? 'tone' : 'ghost', cls: 'fb-lockbtn', tip: t('gear.lockTip'),
          onClick: () => { const on = DK.gear.toggleLock(p.uid); toast(t(on ? 'gear.lockedOn' : 'gear.lockedOff', { name: DK.gear.name(p) }), { icon: 'lock' }); refresh(); } })),
      narrow ? stonesCol : null, // en el móvil, las piedras justo debajo de la pieza
      pool, hist);

    return h('div', { class: 'forge-bench' }, narrow ? null : listCol, mesa, narrow ? null : stonesCol);
  };
})();
