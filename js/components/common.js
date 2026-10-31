/* =============================================================
 * components/common.js — Piezas visuales pequeñas reutilizables:
 * insignias (casa, rareza, nivel, estado, tipo), barras de vitales,
 * chips de atributos y fichas de información.
 *
 * Todas se cuelgan de DK.views para usarlas desde cualquier pantalla:
 *   DK.views.houseBadge('fuego')
 * ============================================================= */
(function () {
  const { h, bar } = DK.ui;
  const D = DK.data;
  const t = (k, v) => DK.t(k, v);
  const V = (DK.views = DK.views || {});

  /** Casa contra la que es débil una casa. */
  V.weakAgainst = (house) => Object.values(D.houses).find((x) => x.strongVs === house);

  /** Insignia de casa con tooltip de fortalezas/debilidades. */
  V.houseBadge = (house, { known = true } = {}) => {
    if (!known || !house) return h('span', { class: 'badge badge-unknown', tip: t('tips.unknownHouse') }, DK.icon('question', 13), '???');
    const hs = D.houses[house];
    const tip = t('tips.house', { strong: DK.tr('houses', D.houses[hs.strongVs]), weak: DK.tr('houses', V.weakAgainst(house)) });
    return h('span', { class: 'badge house', style: { '--c': D.houseColor(house) }, tip }, DK.icon(hs.icon, 13), DK.tr('houses', hs));
  };

  V.rarity = (r) => h('span', { class: 'badge rarity r-' + r, tip: t('tips.rarity') }, DK.tr('rarities', D.rarities[r]));
  V.level = (l) => h('span', { class: 'lvl' }, t('common.lvl') + ' ', h('b', null, l));
  /** Etiqueta de daskai temporal (recluta de una expedición en curso). */
  V.tempTag = (d) => (d && d.temp ? h('span', { class: 'badge temp', tip: t('exp.tempTip') }, DK.icon('flag', 13), t('exp.temp')) : null);
  V.shinyTag = (d) => (d && d.shiny ? h('span', { class: 'badge shiny', tip: t('tips.shiny') }, DK.icon('sparkles', 13), t('common.shiny')) : null);

  V.statusTag = (s) => {
    if (!s) return null;
    const st = D.statuses[s];
    return h('span', { class: 'badge status', style: { '--c': st.color }, tip: DK.tr('statuses', st, 'desc') }, DK.icon(st.icon, 13), DK.tr('statuses', st));
  };

  V.kindTag = (kind) => kind === 'fisico'
    ? h('span', { class: 'badge kind phys', tip: t('tips.physical') }, DK.icon('sword', 13), t('common.physical'))
    : h('span', { class: 'badge kind mag', tip: t('tips.magical') }, DK.icon('wand', 13), t('common.magical'));

  /** Etiqueta de eficacia ("Muy eficaz" / "Poco eficaz"). */
  V.effTag = (eff) => {
    if (eff === 'strong') return h('span', { class: 'badge good eff' }, DK.icon('arrowUp', 13), t('battle.effStrong'));
    if (eff === 'weak') return h('span', { class: 'badge bad eff' }, DK.icon('arrowDown', 13), t('battle.effWeak'));
    return null;
  };

  /** Barras de vida y maná (+ experiencia opcional). */
  V.vitals = (d, { exp = false } = {}) => {
    const s = DK.daskai.stats(d);
    return h('div', { class: 'vitals' },
      bar({ value: d.cur.hp, max: s.hp, kind: 'hp', icon: 'heart', label: DK.tr('stats', D.stats.hp) }),
      bar({ value: d.cur.mp, max: s.mp, kind: 'mp', icon: 'sparkle', label: DK.tr('stats', D.stats.mp) }),
      exp && d.level < DK.config.maxLevel ? bar({ value: d.exp, max: DK.daskai.expToNext(d), kind: 'exp', icon: 'star', label: t('common.exp') }) : null);
  };

  /** Chips "ATQ +6", "VEL -2"... a partir de {atk:6, spd:-2}. */
  V.statChips = (stats) => h('div', { class: 'chips' }, Object.entries(stats).map(([k, v]) =>
    h('span', { class: 'chip ' + (v < 0 ? 'neg' : 'pos'), tip: DK.tr('stats', D.stats[k]) }, DK.icon(D.stats[k].icon, 13), `${DK.tr('stats', D.stats[k], 'short')} ${v > 0 ? '+' : ''}${v}${k === 'regen' ? '%' : ''}`)));

  /** Chips de diferencia "ATQ 32 → 38 (+6)" de DK.bag.equipPreview(). */
  V.diffChips = (diff) => {
    const entries = Object.entries(diff);
    if (!entries.length) return h('span', { class: 'muted small' }, t('equip.noChange'));
    return h('div', { class: 'chips' }, entries.map(([k, x]) =>
      h('span', { class: 'chip ' + (x.diff < 0 ? 'neg' : 'pos') }, DK.icon(D.stats[k].icon, 13), `${DK.tr('stats', D.stats[k], 'short')} ${x.from} → ${x.to}`)));
  };

  /** Ficha de naturaleza. */
  V.natureInfo = (d) => {
    const n = D.natures[d.nature];
    return h('div', { class: 'info-chip', tip: t('tips.nature') }, DK.icon('leaf', 18), h('div', null, h('span', { class: 'muted small' }, t('common.nature')), h('b', null, DK.tr('natures', n)), h('span', { class: 'small' }, DK.tr('natures', n, 'desc'))));
  };
  /** Ficha de pasiva. */
  V.passiveInfo = (d) => {
    const p = D.passives[d.passive];
    return h('div', { class: 'info-chip', tip: t('tips.passive') }, DK.icon('sparkles', 18), h('div', null, h('span', { class: 'muted small' }, t('common.passive')), h('b', null, DK.tr('passives', p)), h('span', { class: 'small' }, DK.tr('passives', p, 'desc'))));
  };

  /** Ficha de una pasiva por id (la que da un objeto de Crafteo). */
  V.passiveBox = (id) => {
    const p = D.passives[id];
    return h('div', { class: 'info-chip' }, DK.icon('shield', 18), h('div', null, h('span', { class: 'muted small' }, t('craft.givesPassive')), h('b', null, DK.tr('passives', p)), h('span', { class: 'small' }, DK.tr('passives', p, 'desc'))));
  };
  /** Texto corto de lo que concede un objeto: "Ataque: X" / "Pasiva: Y". */
  V.grantsText = (it) => {
    const g = it && it.grants;
    if (!g) return '';
    return [g.move ? t('craft.grantMove', { name: D.moves[g.move].name }) : '', g.passive ? t('craft.grantPassive', { name: DK.tr('passives', D.passives[g.passive]) }) : ''].filter(Boolean).join(' · ');
  };

  /** Monedas formateadas con icono. */
  V.coins = (n) => h('span', { class: 'coins' }, DK.icon('coin', 16), h('b', null, n.toLocaleString(DK.i18n.lang)));

  /** Lista de avisos [{kind, icon, text}] (confirmar equipo, etc.). */
  V.warnings = (list, onAction) => h('div', { class: 'warnings' }, list.map((w) =>
    h('div', { class: 'warning ' + w.kind }, DK.icon(w.icon, 18), h('span', { class: 'grow' }, w.text),
      w.action === 'heal' && onAction ? DK.ui.btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'primary', onClick: () => onAction(w.action) }) : null)));
})();
