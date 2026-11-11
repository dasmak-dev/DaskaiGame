/* =============================================================
 * components/runeBench.js — Forja de runas (v4.89, Crafteo → Runas → Forjar)
 *
 *   V.runeBench(params, refresh)
 *     params: { rsel (id de la runa), rmod (índice del modificador elegido), rgr (filtro de grupo) }
 *
 * Como la forja del equipo, pero para las runas de expedición: sus
 * modificadores son PREFIJOS (cambian el mapa) y SUFIJOS (las recompensas).
 * Se trabajan con REACTIVOS que sólo se encuentran explorando su zona
 * (config.expedition.runes.reagents + explore.finds):
 *   · Tus runas (izquierda): las que tienes, agrupadas por id (×n iguales)
 *   · Mesa: la runa en grande, sus huecos P/S, los modificadores (pulsa uno
 *     para cambiarlo, llevarlo al máximo o quitarlo) y lo que puede salir
 *   · Reactivos (derecha): cuántos tienes, de qué zona salen y por qué no se puede
 * Las runas engastadas en la próxima expedición no se pueden forjar.
 * ============================================================= */
(function () {
  const { h, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const R = () => DK.runes;
  const ORD = { l: 0, r: 1, m: 2, n: 3 };
  /** v4.90: grupos de reactivos (como los de las piedras del equipo). */
  const GROUPS = { rarity: ['up', 'rare', 'legend'], tier: ['tier'], reroll: ['alter', 'chaos', 'values'], mod: ['add', 'change', 'max', 'remove'] };

  /** Zona donde se encuentra un reactivo (explore.finds). */
  const zoneOf = (item) => { const f = DK.config.explore.finds || {}; const z = Object.keys(f).find((k) => f[k].reagent === item); return z && D.zones[z] ? D.zones[z] : null; };

  /** Fila del selector: gema, nombre, rareza y modificadores; cuántas iguales. */
  function runeRow(id, on, onClick) {
    const p = R().parse(id), n = R().count(id), free = R().free(id), sl = R().slotsOf(id);
    const dots = (used, max, cls) => [...Array(max).keys()].map((i) => h('i', { class: cls + (i < used ? ' on' : '') }));
    return DK.ui.hoverCard(h('button', { class: 'rb-row ' + V.runeRarity(id) + (on ? ' on' : ''), type: 'button', 'aria-pressed': on, onClick, 'aria-label': V.runeTip(id) },
      V.runeGem(id, 32),
      h('span', { class: 'rb-main' }, h('b', null, V.runeName(id)),
        h('small', null, p.affixes.length ? V.runeAffixes(id).join(' · ') : V.runeEffect(id))),
      sl.total ? h('span', { class: 'fp-slots', 'aria-hidden': 'true' }, h('span', null, dots(sl.P[0], sl.P[1], 'p')), h('span', null, dots(sl.S[0], sl.S[1], 's'))) : null,
      h('span', { class: 'rb-n' + (free < n ? ' sock' : '') }, free < n ? DK.icon('lock', 10) : null, '×' + n)), () => V.runeCard(id)); // v5.29: ficha al dejar el ratón
  }

  V.runeBench = (params, refresh) => {
    const narrow = DK.ui.isNarrow();
    const ids = Object.keys(R().all()).filter((id) => R().count(id) > 0 && R().get(id))
      .sort((a, b) => ORD[R().parse(a).rarity] - ORD[R().parse(b).rarity] || R().parse(b).tier - R().parse(a).tier || V.runeName(a).localeCompare(V.runeName(b)));
    params.rgr = params.rgr || 'all';
    if (params.rsel && !ids.includes(params.rsel)) params.rsel = null;
    const id = params.rsel, p = id ? R().parse(id) : null;
    if (p && params.rmod != null && !p.affixes[params.rmod]) params.rmod = null;
    const pick = (x) => { params.rsel = params.rsel === x ? null : x; params.rmod = null; refresh(); };
    const have = (it) => DK.bag.home()[it] || 0;

    /* ---- Tus runas ---- */
    const groups = ['all', 'size', 'kind', 'bonus'];
    const okG = (x) => params.rgr === 'all' || R().get(x).group === params.rgr;
    const shown = ids.filter(okG);
    const listCol = h('div', { class: 'fb-col rb-list' + (p ? '' : ' browse') },
      ids.length ? [
        h('div', { class: 'fp-bar' }, h('span', { class: 'fp-seg' }, groups.map((g) => h('button', { class: params.rgr === g ? 'on' : '', type: 'button', 'aria-pressed': params.rgr === g, onClick: () => { params.rgr = g; refresh(); } },
          g === 'all' ? t('rune.allGroups') : t('rune.forge.g.' + g), h('small', null, ' ' + ids.filter((x) => g === 'all' || R().get(x).group === g).length))))),
        shown.length ? h('div', { class: 'rb-rows' }, shown.map((x) => runeRow(x, x === id, () => pick(x)))) : h('p', { class: 'muted small' }, t('gear.bench.noMatch')),
      ] : DK.ui.empty('rune', t('rune.forge.none'), ''));

    /* ---- Reactivos ---- */
    const forgeIt = (item, o = {}) => {
      const r = R().forge(id, item, Object.assign({ mod: params.rmod }, o));
      if (!r.ok) { DK.audio.sfx('error'); toast(r.msg, { icon: 'x', kind: 'bad' }); return; }
      const up = R().parse(r.id).rarity !== p.rarity;
      DK.audio.sfx(up ? 'levelup' : 'craft');
      toast(r.msg + (V.runeAffixes(r.id).length ? ' · ' + V.runeAffixes(r.id).join(' · ') : ''), { icon: 'rune', kind: 'good' });
      params.rsel = r.id; params._rfx = { from: r.before, to: r.id };
      if (!['max', 'change'].includes(R().opOf(item))) params.rmod = null;
      refresh();
    };
    const reagentBtn = (item) => {
      const it = D.items[item], n = have(item), op = R().opOf(item), z = zoneOf(item);
      const needSel = R().targetedOps.includes(op) && params.rmod == null;
      // v5.29: sin reactivo pero con su receta a mano → pulsar lo fabrica
      const makeable = !n && V.canMake(item);
      const why = makeable ? null : !p ? t('rune.why.none') : R().cannotForge(id, item, { mod: params.rmod }) || (needSel && n ? t('rune.forge.pickMod') : null);
      return h('button', { class: 'fs-row rb-reagent' + (why ? ' off' : '') + (n ? '' : ' none') + (needSel && n && p && !R().cannotForge(id, item) ? ' wants' : ''), type: 'button', disabled: !!why,
        tip: makeable ? t('craft.makeTip') : (why ? why + ' · ' : '') + it.desc, 'aria-label': it.name, onClick: () => (makeable ? V.makeDialog(item, refresh) : forgeIt(item)) },
        V.itemIcon(it, 26), h('span', { class: 'fs-main' }, h('b', null, it.name), h('small', null, t('rune.forge.ops.' + op), op === 'tier' && p && R().tierCost(id) ? ' · ' + R().tierCost(id).toLocaleString(DK.i18n.lang) + ' ' + t('rune.forge.coins') : '',
          h('span', { class: 'rb-zone' }, ' · ', z ? z.name : t('rune.forge.src.' + op)))),
        makeable ? h('span', { class: 'fs-make', 'aria-label': t('craft.makeBtn') }, DK.icon('anvil', 10)) : h('span', { class: 'fs-n' + (n ? '' : ' zero') }, String(n)));
    };
    const reagentsCol = h('div', { class: 'fb-col fb-stones rb-reagents' },
      Object.entries(GROUPS).map(([g, ops]) => { const its = R().reagents().filter((x) => D.items[x] && ops.includes(R().opOf(x)));
        return its.length ? h('div', { class: 'fb-group' }, h('span', { class: 'fb-group-h' }, t('rune.forge.g2.' + g)), h('div', { class: 'fs-grid' }, its.map(reagentBtn))) : null; }),
      null); // v5.3: sin la nota de dónde sale cada reactivo

    // v5.3: sin runa elegida sólo se ve la lista; los reactivos aparecen al pulsar una runa
    if (!p) return h('div', { class: 'forge-bench rune-bench browse no-sel' }, listCol);

    /* ---- Mesa ---- */
    const sl = R().slotsOf(id), fx = params._rfx && params._rfx.to === id ? params._rfx : null;
    const before = fx ? R().parse(fx.from).affixes.map((a) => a.k + '=' + a.v) : null;
    const pips = (used, max) => h('span', { class: 'fb-pips' }, [...Array(max).keys()].map((i) => h('i', { class: i < used ? 'on' : '' })));
    const modRow = (a, i) => {
      const k = R().kindOf(a.k), [lo, hi] = R().range(a.k, p.tier, p.rarity), on = params.rmod === i, changed = before && !before.includes(a.k + '=' + a.v);
      return h('button', { class: 'gt-affix rb-mod ' + k + (on ? ' sel' : '') + (changed ? ' changed' : ''), type: 'button', 'aria-pressed': on, onClick: () => { params.rmod = on ? null : i; refresh(); } },
        h('span', { class: 'gt-kind' }, k === 'prefix' ? 'P' : 'S'), h('span', { class: 'grow' }, t('rune.aff.' + a.k, { n: a.v })),
        h('small', { class: 'muted rb-range' }, lo === hi ? String(hi) : `${lo}–${hi}`));
    };
    const adder = 'perla_runica';
    const addSlot = (kind, free) => {
      const n = have(adder), why = D.items[adder] ? R().cannotForge(id, adder, { kind }) : t('rune.why.none');
      return h('button', { class: 'gt-affix empty ' + kind + (why ? ' off' : ''), type: 'button', disabled: !!why, tip: (why ? why + ' · ' : '') + (D.items[adder] ? D.items[adder].desc : ''), onClick: () => forgeIt(adder, { kind }) },
        h('span', { class: 'gt-kind' }, kind === 'prefix' ? 'P' : 'S'),
        h('span', { class: 'grow' }, DK.icon('plus', 12), ' ', t(kind === 'prefix' ? 'rune.forge.addP' : 'rune.forge.addS'), free > 1 ? h('small', { class: 'muted' }, ` ×${free}`) : null),
        h('span', { class: 'fa-cost' + (n ? '' : ' zero') }, D.items[adder] ? V.itemIcon(D.items[adder], 16) : null, String(n)));
    };
    const roomP = Math.max(0, Math.min(sl.P[1] - sl.P[0], sl.total - p.affixes.length)), roomS = Math.max(0, Math.min(sl.S[1] - sl.S[0], sl.total - p.affixes.length));
    const ACTS = [['cuarzo_eco', 'change'], ['escarcha_celeste', 'max'], ['polvo_vacio', 'remove']];
    const selBar = params.rmod != null ? h('div', { class: 'fa-bar', role: 'group' },
      ACTS.filter(([it]) => D.items[it]).map(([it, k]) => {
        const n = have(it), why = R().cannotForge(id, it, { mod: params.rmod });
        return h('button', { class: 'fa-act' + (why ? ' off' : ''), type: 'button', disabled: !!why, tip: (why ? why + ' · ' : '') + D.items[it].desc, onClick: () => forgeIt(it) },
          V.itemIcon(D.items[it], 16), h('span', null, t('rune.forge.' + k)), h('b', { class: n ? '' : 'zero' }, String(n)));
      }),
      h('button', { class: 'fa-x', type: 'button', 'aria-label': t('common.close'), onClick: () => { params.rmod = null; refresh(); } }, DK.icon('x', 12))) : null;
    const modsOf = (kind) => p.affixes.map((a, i) => [a, i]).filter(([a]) => R().kindOf(a.k) === kind);
    const block = (kind, room) => h('div', { class: 'rb-mods' }, h('small', { class: 'gp-ch' }, t(kind === 'prefix' ? 'rune.forge.prefixes' : 'rune.forge.suffixes')),
      modsOf(kind).map(([a, i]) => [modRow(a, i), params.rmod === i ? selBar : null]),
      room && p.rarity !== 'n' ? addSlot(kind, room) : null);
    const card = h('div', { class: 'rb-card ' + V.runeRarity(id) },
      h('div', { class: 'rb-head' }, V.runeGem(id, 64),
        h('div', { class: 'grow' }, h('b', { class: 'rb-name' }, V.runeName(id)),
          h('small', { class: 'rb-rar' }, t('rune.rar.' + p.rarity), ' · ', t('rune.tierN', { n: p.tier }), ' · ', t('rune.' + R().get(id).group)),
          h('small', { class: 'muted' }, V.runeEffect(id))),
        h('span', { class: 'rb-count' }, t('rune.forge.x', { n: R().count(id) }))),
      p.rarity === 'n' ? h('p', { class: 'muted small' }, t('rune.forge.noMods'))
        : h('div', { class: 'fb-slotsbar' },
          h('span', { class: 'fb-slot-g' }, h('b', null, 'P'), t('gear.bench.prefixes'), pips(sl.P[0], sl.P[1])),
          h('span', { class: 'fb-slot-g' }, h('b', null, 'S'), t('gear.bench.suffixes'), pips(sl.S[0], sl.S[1])),
          h('span', { class: 'fb-slot-tot muted small' }, `${p.affixes.length}/${sl.total}`)),
      p.rarity === 'n' ? null : h('div', { class: 'rb-modcols' }, block('prefix', roomP), block('suffix', roomS)),
      p.affixes.length ? h('p', { class: 'fb-selhint small' + (params.rmod != null ? ' on' : '') }, DK.icon('info', 13), t('rune.forge.selHint')) : null,
      R().free(id) < R().count(id) ? h('p', { class: 'small warn-text' }, DK.icon('lock', 12), ' ', t('rune.why.socketed')) : null);
    // Lo que puede salir (para su tier)
    const keys = Object.keys(DK.config.expedition.runes.affixes);
    const poolRow = (k) => { const [lo, hi] = R().range(k, p.tier, p.rarity === 'n' ? 'm' : p.rarity), kd = R().kindOf(k);
      return h('div', { class: 'fb-pool-row ' + kd + (p.affixes.some((a) => a.k === k) ? ' have' : '') }, h('span', { class: 'gt-kind' }, kd === 'prefix' ? 'P' : 'S'), h('span', { class: 'grow' }, t('rune.aff.' + k, { n: lo === hi ? hi : `${lo}–${hi}` }))); };
    const pool = h('details', { class: 'fb-block fb-pool', open: !narrow },
      h('summary', null, DK.icon('dice', 14), t('rune.forge.pool')),
      h('div', { class: 'fb-pool-cols' }, h('div', null, keys.filter((k) => R().kindOf(k) === 'prefix').map(poolRow)), h('div', null, keys.filter((k) => R().kindOf(k) === 'suffix').map(poolRow))));
    const mesa = h('div', { class: 'fb-col fb-mesa' },
      narrow ? h('button', { class: 'fb-back', type: 'button', onClick: () => pick(id) }, DK.icon('back', 14), t('rune.forge.changeRune'), h('span', { class: 'muted small' }, String(ids.length))) : null,
      card, narrow ? reagentsCol : null, pool);
    return h('div', { class: 'forge-bench rune-bench' }, narrow ? null : listCol, mesa, narrow ? null : reagentsCol);
  };
})();
