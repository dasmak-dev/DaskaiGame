/* =============================================================
 * components/gearViews.js — Cómo se ven las piezas de equipo (v4.74).
 *
 *   V.gearTip(p, o)   → ficha estilo Path of Exile: nombre con el color de su
 *                       rareza, base, nivel, atributos, prefijos, sufijos y pasiva
 *                       o: { compact, onAffix(i), pickAffix, who, diff: {before} }
 *   V.gearTile(p, o)  → casilla de la cuadrícula (icono, nombre, rareza, nivel)
 *   V.gearLine(p)     → una línea corta: «+9 ATQ · +50 PM · 2 afijos»
 *   V.gearRarity(r)   → insignia de rareza
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const RC = (r) => D.gear.rarities[r].color;
  const statName = (k) => (k === 'regen' ? DK.tr('stats', D.stats.regen) : DK.tr('stats', D.stats[k]));
  const statShort = (k) => (D.stats[k] && DK.tr('stats', D.stats[k], 'short')) || statName(k);

  /** v4.84: nota de calidad (S/A/B/C/D) con su puntuación en el tooltip. */
  V.gearQuality = (p, { small = false } = {}) => { const q = DK.gear.quality(p); return h('span', { class: 'gq gq-' + q.grade + (small ? ' sm' : ''), tip: t('gear.qualityTip', { n: q.score, g: q.grade, tip: t('gear.qualityAdvice.' + q.grade) }) }, small ? q.grade : t('gear.quality', { g: q.grade })); };
  V.gearRarity = (r) => h('span', { class: 'gear-rar g-' + r, style: { '--g': RC(r) } }, t('gear.rarity.' + r));

  /** Una línea corta con lo que da. */
  V.gearLine = (p) => {
    const parts = p.attrs.map((a) => `+${DK.gear.attrValue(p, a)}${a.k === 'regen' ? '%' : ''} ${statShort(a.k)}`);
    if (p.affixes.length) parts.push(t(p.affixes.length === 1 ? 'gear.oneAffix' : 'gear.nAffixes', { n: p.affixes.length }));
    return parts.join(' · ');
  };

  /** Quién la lleva puesta (o null). */
  const wearer = (p) => { const x = DK.gear.find(p.uid); return x && x.where === 'equip' ? x.d : null; };

  /** Casilla de la cuadrícula. */
  V.gearTile = (p, { selected = false, onClick, compact = false } = {}) => {
    const it = D.items[p.base], d = wearer(p);
    return h('button', { class: 'gear-tile g-' + p.rarity + (selected ? ' on' : '') + (compact ? ' compact' : ''), type: 'button', style: { '--g': RC(p.rarity) }, onClick, 'aria-pressed': selected },
      h('span', { class: 'gear-tile-ico' }, V.gearIcon(p, compact ? 24 : 30), h('span', { class: 'gear-ilvl', tip: t('gear.ilvl') }, p.ilvl)),
      h('span', { class: 'gear-tile-main' },
        h('b', { class: 'gear-name' }, DK.gear.name(p)),
        h('span', { class: 'gear-tile-sub' }, it.name, ' · ', V.gearLine(p))),
      d ? h('span', { class: 'gear-worn', tip: t('gear.wornBy', { name: DK.daskai.name(d) }) }, V.dSprite(d, { size: 26 })) : null);
  };

  /**
   * Ficha completa. o.onAffix(i): botón para volver a tirar ese afijo (esquirla de jefe).
   * o.changed: Set de claves que acaban de cambiar ('a0', 'x1'…) para resaltarlas.
   */
  V.gearTip = (p, { compact = false, onAffix = null, changed = null, sel = null, onSelect = null, selBar = null, addSlot = null, onMain = null, will = null } = {}) => {
    const it = D.items[p.base], d = wearer(p);
    const hi = (key) => (changed && changed.has(key) ? ' fresh' : '') + (will && will.has(key) ? ' will' : ''); // v4.84: will = lo que va a cambiar
    const sep = () => h('i', { class: 'gt-sep' });
    const head = h('div', { class: 'gt-head' },
      h('span', { class: 'gt-ico' }, V.gearIcon(p, compact ? 30 : 40)),
      h('div', { class: 'grow' },
        h('b', { class: 'gt-name' }, DK.gear.name(p)),
        h('span', { class: 'gt-base' }, `${DK.gear.typeName(p)} · ${it.name}`),
        h('span', { class: 'gt-meta' }, V.gearRarity(p.rarity), h('span', { class: 'gt-ilvl' }, t('gear.ilvlN', { n: p.ilvl })),
          // v4.84: calidad, bloqueada y fabricada
          V.gearQuality(p), p.lk ? h('span', { class: 'gt-lk', tip: t('gear.lockedPiece') }, DK.icon('lock', 12)) : null,
          p.cf ? h('span', { class: 'gt-cf', tip: t('gear.craftedTip') }, DK.icon('hammer', 11), t('gear.crafted')) : null)));
    const rows = [];
    // Lo que da su base (ataque o pasiva)
    if (it.grants) rows.push(h('div', { class: 'gt-implicit' }, DK.icon('sparkles', 13), V.grantsText(it)), sep());
    // Atributos
    // v4.78: el atributo principal (el de su tipo) va destacado
    const mainK = DK.gear.primaryOf(p.base);
    rows.push(h('div', { class: 'gt-attrs' }, p.attrs.map((a, i) => h('div', { class: 'gt-attr' + hi('a' + i) + (a.k === mainK ? ' main' : ''), tip: a.k === mainK ? t('gear.prev.mainShort', { stat: statName(a.k) }) : null },
      D.stats[a.k] ? DK.icon(D.stats[a.k].icon, 13) : DK.icon('regen', 13),
      h('span', null, h('b', null, `+${DK.gear.attrValue(p, a)}${a.k === 'regen' ? '%' : ''}`), ' ', statName(a.k),
        // v4.80: el principal enseña su rango (y en la forja, un botón para re-tirarlo)
        a.k === mainK && !compact ? h('small', { class: 'gt-range', tip: t('gear.bench.range', { a: DK.gear.attrRange(p, a)[0], b: DK.gear.attrRange(p, a)[1] }) }, ` (${DK.gear.attrRange(p, a).join('–')})`) : null),
      a.k === mainK && onMain ? onMain(a) : a.k === mainK ? h('span', { class: 'gt-main' }, DK.icon('star', 10)) : null))));
    // Prefijos y sufijos
    // v4.79: addSlot(kind) → nodo para cada hueco libre (añadir prefijo/sufijo en la forja)
    const sl = addSlot ? DK.gear.slots(p) : null;
    const freeP = sl && p.affixes.length < sl.total ? Math.max(0, sl.P[1] - sl.P[0]) : 0;
    const freeS = sl && p.affixes.length < sl.total ? Math.max(0, sl.S[1] - sl.S[0]) : 0;
    if (p.affixes.length || freeP || freeS) {
      rows.push(sep());
      // v4.75: en la forja los afijos se eligen (onSelect) y el sellado lleva candado
      const exOf = (a) => (D.gear.affixes[a.id] || {}).only; // v4.81: exclusivo de su tipo
      const line = (a, i) => h(onSelect ? 'button' : 'div', Object.assign({ class: 'gt-affix ' + DK.gear.kindOf(a) + hi('x' + i) + (sel === i ? ' sel' : '') + (a.lock ? ' locked' : '') + (exOf(a) ? ' excl' : '') },
        onSelect ? { type: 'button', 'aria-pressed': sel === i, onClick: () => onSelect(sel === i ? null : i) } : {}),
        h('span', { class: 'gt-kind', tip: t('gear.' + DK.gear.kindOf(a)) }, DK.gear.kindOf(a) === 'prefix' ? 'P' : 'S'),
        a.lock ? h('span', { class: 'gt-lock', tip: t('gear.locked') }, DK.icon('lock', 12)) : null,
        exOf(a) ? h('span', { class: 'gt-excl', tip: t('gear.exclusive', { type: t(`gear.type.${exOf(a)}.one`) }) }, DK.icon('star', 11)) : null,
        h('span', { class: 'grow' }, DK.gear.affixText(a), compact ? null : h('small', { class: 'gt-range' }, ` (${DK.gear.affixRange(a)})`)),
        h('span', { class: 'gt-tier t' + a.t, tip: t('gear.tierTip', { n: a.t }) }, 'N' + a.t),
        onAffix ? h('button', { class: 'gt-reroll', type: 'button', tip: t('gear.rerollThis'), 'aria-label': t('gear.rerollThis'), onClick: () => onAffix(i) }, DK.icon('target', 13)) : null);
      const pre = [], suf = [];
      p.affixes.forEach((a, i) => { const L = DK.gear.kindOf(a) === 'prefix' ? pre : suf; L.push(line(a, i)); if (selBar && sel === i) L.push(selBar); });
      // Huecos libres: uno por tipo (con cuántos quedan)
      if (freeP) pre.push(addSlot('prefix', freeP));
      if (freeS) suf.push(addSlot('suffix', freeS));
      rows.push(h('div', { class: 'gt-affixes' }, pre, suf));
    }
    // Pasiva exclusiva
    const lp = DK.gear.passive(p);
    if (lp) rows.push(sep(), h('div', { class: 'gt-legend' + hi('leg') }, DK.icon('crown', 14), h('div', null, h('b', null, DK.tr('passives', D.passives[lp])), h('span', null, DK.tr('passives', D.passives[lp], 'desc')))));
    if (!compact && it.desc) rows.push(h('p', { class: 'gt-flavor' }, it.desc));
    return h('div', { class: 'gear-tip g-' + p.rarity + (compact ? ' compact' : ''), style: { '--g': RC(p.rarity) } }, head, h('div', { class: 'gt-body' }, rows),
      d && !compact ? h('div', { class: 'gt-worn' }, V.dSprite(d, { size: 22 }), t('gear.wornBy', { name: DK.daskai.name(d) })) : null);
  };

  /**
   * v4.75: ventana «Equipar en…»: tus daskai separados en «En tu equipo», «Entrenando» y
   * cada caja (plegadas), con buscador. Al pulsar uno se ven sus huecos con lo que lleva y
   * cómo le cambian los atributos. En una expedición, sólo el equipo.
   * @returns {Promise<boolean>} true si se equipó
   */
  V.equipPicker = (uid) => {
    const x = DK.gear.find(uid); if (!x) return Promise.resolve(false);
    const p = x.p, name = DK.gear.name(p), exp = !!DK.store.state.expedition;
    if (DK.boxes && DK.boxes.sync) DK.boxes.sync(); // que cada daskai esté en su caja
    const team = DK.party.active();
    const training = exp ? [] : DK.party.all().filter((d) => !d.temp && !DK.party.isActive(d.uid) && DK.training && DK.training.isTraining(d.uid));
    const used = new Set(team.concat(training).map((d) => d.uid));
    const boxes = exp ? [] : DK.boxes.list().map((b, i) => ({ name: DK.boxes.name(i), list: b.slots.filter(Boolean).map((u) => DK.party.get(u)).filter((d) => d && !d.temp && !used.has(d.uid)) })).filter((b) => b.list.length);
    // Los que no estén en ninguna caja (por si acaso), a una sección más
    const inBox = new Set(boxes.flatMap((b) => b.list.map((d) => d.uid)));
    const loose = exp ? [] : DK.party.all().filter((d) => !d.temp && !used.has(d.uid) && !inBox.has(d.uid));
    if (loose.length) boxes.push({ name: '—', list: loose });
    let q = '', open = null;
    return DK.ui.modal({
      title: t('gear.equipTitle', { name }), icon: 'gem', size: 'wide', cls: 'equip-picker',
      content: (close) => {
        const body = h('div', { class: 'ep-body' });
        const row = (d) => {
          const isOpen = open === d.uid, hasIt = d.equip.some((e) => e && e.uid === p.uid);
          const mini = h('span', { class: 'ep-slots' }, [...Array(DK.config.maxEquip).keys()].map((i) => {
            const e = d.equip[i];
            return e && typeof e === 'object' ? h('span', { class: 'ep-mini', style: { '--g': D.gear.rarities[e.rarity].color }, tip: DK.gear.name(e) }, V.gearIcon(e, 22)) : h('span', { class: 'ep-mini free', tip: t('gear.slotFree') }, DK.icon('plus', 11));
          }));
          const head = h('button', { class: 'ep-row' + (isOpen ? ' on' : ''), type: 'button', onClick: () => { open = isOpen ? null : d.uid; draw(); } },
            V.dSprite(d, { size: 40 }),
            h('span', { class: 'ep-main' }, h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`, DK.training && DK.training.isTraining(d.uid) ? ' · ' + t('gear.inTraining') : '')),
            mini, DK.icon('chevronDown', 16));
          if (!isOpen) return h('div', { class: 'ep-item' }, head);
          const slots = [...Array(DK.config.maxEquip).keys()].map((slot) => {
            const e = d.equip[slot];
            return h('div', { class: 'ep-slot' },
              h('span', { class: 'ep-slot-h' }, h('b', null, t('gear.slotN', { n: slot + 1 })), e ? h('span', { class: 'ep-cur', style: { '--g': D.gear.rarities[e.rarity].color } }, DK.gear.name(e)) : h('span', { class: 'muted' }, t('gear.slotFree'))),
              V.diffChips(DK.gear.preview(d, slot, p.uid)),
              btn({ icon: 'gem', label: e ? t('gear.swapHere') : t('gear.equipHere'), size: 'sm', variant: e ? 'ghost' : 'primary', disabled: hasIt,
                onClick: () => { DK.gear.equip(d, slot, p.uid); DK.audio.sfx('thud'); DK.ui.toast(t('equip.done', { name: DK.daskai.name(d), item: name }), { icon: 'gem', kind: 'good' }); close(true); } }));
          });
          return h('div', { class: 'ep-item open' }, head, h('div', { class: 'ep-slots-detail' }, slots));
        };
        const match = (d) => !q || DK.daskai.name(d).toLowerCase().includes(q) || D.species[d.species].name.toLowerCase().includes(q);
        const section = (title, icon, list, startOpen) => {
          const shown = list.filter(match);
          if (!shown.length) return null;
          return h('details', { class: 'ep-sec', open: startOpen || !!q || shown.some((d) => d.uid === open) },
            h('summary', null, DK.icon(icon, 15), h('span', null, title), h('b', null, String(shown.length)), DK.icon('next', 13)), shown.map(row));
        };
        const draw = () => {
          const secs = [section(t('gear.secTeam'), 'users', team, true), section(t('gear.secTraining'), 'compass', training, true),
            ...boxes.map((b) => section(b.name === '—' ? t('gear.secOther') : t('gear.secBox', { name: b.name }), 'grid', b.list, false))].filter(Boolean);
          body.replaceChildren(...(secs.length ? secs : [h('p', { class: 'muted small' }, t('gear.secNone'))]));
        };
        draw();
        const search = exp ? null : h('input', { class: 'input ep-search', type: 'search', placeholder: t('gear.equipSearch'), onInput: (ev) => { q = ev.target.value.trim().toLowerCase(); draw(); } });
        return h('div', { class: 'stack-s' }, V.gearTile(p, { compact: true }), search, body);
      },
      actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost', value: false }],
    }).promise;
  };
})();
