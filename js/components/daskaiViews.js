/* =============================================================
 * components/daskaiViews.js — Vistas de daskai y ataques:
 * sprite, fila de lista, tarjeta de ataque, tabla de atributos,
 * selector de daskai, aprender ataque y comparador.
 * ============================================================= */
(function () {
  const { h, btn, modal } = DK.ui;
  const D = DK.data;
  const t = (k, v) => DK.t(k, v);
  const V = (DK.views = DK.views || {});

  /**
   * Dibujo de una especie.
   * @param {string} speciesId
   * @param {Object} [o] {size, flip, silhouette, shiny, cls}
   */
  V.sprite = (speciesId, { size = 96, flip = false, silhouette = false, shiny = false, cls = '' } = {}) => {
    const sp = D.species[speciesId];
    const pixel = DK.settings.get('pixelArt') !== false && !(sp.sprite && sp.sprite.img);
    const el = h('div', { class: `sprite ${pixel ? 'pixel' : ''} ${silhouette ? 'silhouette' : ''} ${shiny ? 'is-shiny' : ''} ${flip ? 'flip' : ''} ${cls}`, style: { width: size + 'px', height: size + 'px' } });
    // Pixel art (ajuste «pixelArt»): se usa la versión en caché o se pinta el SVG
    // mientras se genera y luego se cambia por la imagen pixelada.
    const toImg = (url) => { const img = document.createElement('img'); img.className = 'sprite-px'; img.alt = sp.name; img.draggable = false; img.src = url; el.replaceChildren(img); };
    const cached = pixel && DK.sprites.pixelCached(sp, { shiny });
    if (cached) toImg(cached);
    else {
      el.innerHTML = DK.sprites.svg(sp, { flip, shiny });
      if (pixel) DK.sprites.pixel(sp, { shiny }).then((url) => { if (url) toImg(url); });
    }
    return el;
  };
  /** Sprite de un daskai concreto (respeta variocolor). */
  V.dSprite = (d, o = {}) => V.sprite(d.species, Object.assign({ shiny: !!d.shiny }, o));

  /**
   * Fila de daskai para listas.
   * @param {Object} d
   * @param {Object} [o] {onClick, tags, selected, compact, draggable, actions}
   */
  V.daskaiRow = (d, { onClick, tags = [], selected = false, compact = false, draggable = false, actions } = {}) => {
    const sp = DK.daskai.species(d);
    const fainted = DK.daskai.isFainted(d);
    // Es un <div role="button"> (no <button>) para poder llevar botones dentro
    const el = h('div', {
      class: `dk-row ${onClick ? 'clickable' : ''} ${selected ? 'selected' : ''} ${fainted ? 'fainted' : ''} ${compact ? 'compact' : ''}`,
      role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, draggable: draggable ? 'true' : null, dataset: { uid: d.uid },
    },
      draggable ? h('span', { class: 'drag-handle', tip: t('team.dragTip') }, DK.icon('grip', 16)) : null,
      h('div', { class: 'dk-row-sprite', style: { '--c': D.houseColor(sp.house) } }, V.dSprite(d, { size: compact ? 44 : 56 })),
      h('div', { class: 'dk-row-main' },
        h('div', { class: 'dk-row-title' }, h('span', { class: 'dk-name' }, DK.daskai.name(d)), V.level(d.level)),
        h('div', { class: 'dk-row-tags' }, V.houseBadge(sp.house), V.shinyTag(d), V.tempTag(d), V.statusTag(d.status),
          fainted ? h('span', { class: 'badge bad' }, DK.icon('skull', 13), t('common.fainted')) : null,
          DK.daskai.canEvolve(d) ? h('span', { class: 'badge evo', tip: t('evo.readyTip') }, DK.icon('evolve', 13), t('evo.ready')) : null, ...V.extraTags(d), ...tags),
        V.vitals(d)),
      actions ? h('div', { class: 'dk-row-actions' }, actions) : null,
      onClick ? h('span', { class: 'dk-row-arrow' }, DK.icon('next', 18)) : null);
    if (onClick) {
      el.addEventListener('click', (e) => { if (e.target.closest('.dk-row-actions')) return; DK.audio.sfx('select'); onClick(e); });
      el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); e.stopPropagation(); onClick(e); } });
    }
    return el;
  };

  /**
   * Tarjeta compacta de daskai (cuadrícula de la colección y huecos del equipo).
   * @param {Object} d
   * @param {Object} [o] {onClick, selected, draggable, corner (nodo en la esquina), badges, big}
   */
  /** Marcas extra de un daskai: entrenando y talento por elegir. */
  V.extraTags = (d) => [
    DK.training && DK.training.isTraining(d.uid) ? h('span', { class: 'badge train', tip: t('train.inTraining') }, DK.icon('dumbbell', 12), t('train.short')) : null,
    DK.daskai.talentsPending(d).length ? h('span', { class: 'badge talent', tip: t('talent.pendingTip') }, DK.icon('star', 12)) : null,
  ].filter(Boolean);

  V.daskaiTile = (d, { onClick, selected = false, draggable = false, corner, badges = [], big = false } = {}) => {
    badges = badges.concat(V.extraTags(d));
    const sp = DK.daskai.species(d);
    const fainted = DK.daskai.isFainted(d);
    const s = DK.daskai.stats(d);
    const hpPct = Math.round((d.cur.hp / s.hp) * 100);
    const el = h('div', {
      class: `dk-tile ${big ? 'big' : ''} ${selected ? 'selected' : ''} ${fainted ? 'fainted' : ''} ${onClick ? 'clickable' : ''}`,
      role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, 'data-drag': draggable ? '1' : null,
      dataset: { uid: d.uid }, style: { '--c': D.houseColor(sp.house) }, tip: `${DK.daskai.name(d)} · ${sp.name}`,
    },
      corner ? h('div', { class: 'dk-tile-corner' }, corner) : null,
      h('div', { class: 'dk-tile-art' }, V.dSprite(d, { size: big ? 76 : 58 }),
        h('span', { class: 'dk-tile-house', tip: DK.tr('houses', D.houses[sp.house]) }, DK.icon(D.houses[sp.house].icon, 12))),
      h('div', { class: 'dk-tile-name' }, h('b', null, DK.daskai.name(d)), h('span', { class: 'muted small' }, `${t('common.lvl')} ${d.level}`)),
      h('div', { class: 'dk-tile-bars' },
        h('span', { class: 'mini-bar hp' + (hpPct < 25 ? ' low' : hpPct < 50 ? ' mid' : ''), tip: `${d.cur.hp}/${s.hp} ${t('common.hpShort')}` }, h('span', { style: { width: hpPct + '%' } })),
        h('span', { class: 'mini-bar mp', tip: `${d.cur.mp}/${s.mp} ${t('common.mpShort')}` }, h('span', { style: { width: Math.round((d.cur.mp / s.mp) * 100) + '%' } }))),
      (badges.length || d.shiny || d.temp || d.status || DK.daskai.canEvolve(d)) ? h('div', { class: 'dk-tile-badges' },
        V.shinyTag(d), V.tempTag(d), V.statusTag(d.status),
        DK.daskai.canEvolve(d) ? h('span', { class: 'badge evo', tip: t('evo.readyTip') }, DK.icon('evolve', 12)) : null, ...badges) : null);
    if (onClick) {
      el.addEventListener('click', (e) => { if (e.target.closest('.dk-tile-corner')) return; DK.audio.sfx('select'); onClick(e); });
      el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); onClick(e); } });
    }
    return el;
  };

  /** Texto del efecto de un ataque ("30% de provocar quemado"). */
  V.effectText = (m) => {
    const e = m.effect;
    if (!e) return '';
    const pct = (x) => Math.round(x * 100) + '%';
    const stat = e.stat ? DK.tr('stats', D.stats[e.stat]).toLowerCase() : '';
    switch (e.type) {
      case 'status': return e.chance >= 1 ? t('fx.statusAlways', { status: DK.tr('statuses', D.statuses[e.status]).toLowerCase() }) : t('fx.statusChance', { p: pct(e.chance), status: DK.tr('statuses', D.statuses[e.status]).toLowerCase() });
      case 'buff': return t('fx.buff', { stat }) + (e.stages > 1 ? ' x' + e.stages : '');
      case 'debuff': return e.chance && e.chance < 1 ? t('fx.debuffChance', { p: pct(e.chance), stat }) : t('fx.debuff', { stat });
      case 'heal': return t('fx.heal', { p: pct(e.pct) });
      case 'drain': return t('fx.drain', { p: pct(e.pct) });
      default: return '';
    }
  };

  /** Daño aproximado fuera de combate (contra un rival con la misma defensa). */
  V.approxDamage = (d, moveId) => {
    const m = D.moves[moveId];
    if (!m.power) return null;
    const s = DK.daskai.stats(d), phys = m.kind === 'fisico';
    return DK.battle.rawDamage({ power: m.power, kind: m.kind, attLevel: d.level, atk: s[phys ? 'atk' : 'matk'], def: s[phys ? 'def' : 'mdef'] });
  };

  /**
   * Tarjeta de ataque.
   * @param {string} moveId
   * @param {Object} [o] {d, estimate ([min,max] | número | null), eff, onClick, disabled, actions, compact, hotkey, onHover(on)}
   */
  V.moveCard = (moveId, { d, estimate, eff, onClick, disabled, actions, compact, hotkey, onHover } = {}) => {
    const m = D.moves[moveId];
    const color = m.house ? D.houseColor(m.house) : null;
    const dmg = estimate !== undefined ? estimate : d ? V.approxDamage(d, moveId) : null;
    const dmgText = Array.isArray(dmg) ? `${dmg[0]}-${dmg[1]}` : dmg;
    const el = h(onClick ? 'button' : 'div', { class: `move-card ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''}`, type: onClick ? 'button' : null, disabled: onClick && disabled, style: color ? { '--c': color } : null },
      h('div', { class: 'move-head' },
        h('span', { class: 'move-icon' }, DK.icon(m.kind === 'fisico' ? 'sword' : 'wand', 18)),
        h('span', { class: 'move-name' }, m.name),
        m.priority ? h('span', { class: 'prio-tag ' + (m.priority > 0 ? 'fast' : 'slow'), tip: t(m.priority > 0 ? 'battle.prioFastTip' : 'battle.prioSlowTip') }, DK.icon(m.priority > 0 ? 'bolt' : 'clock', 11)) : null,
        m.power ? V.effTag(eff) : null,
        V.kindTag(m.kind),
        hotkey ? h('kbd', { class: 'hotkey' }, hotkey) : null),
      h('div', { class: 'move-stats' },
        h('span', { tip: t('move.mpCost') }, DK.icon('sparkle', 14), m.kind === 'fisico' ? t('move.free') : `${d && DK.battle ? DK.battle.mpCost(d, moveId) : m.mp} ${t('common.mpShort')}`),
        h('span', { tip: t('move.powerTip') }, DK.icon('swords', 14), m.power ? t('move.power', { n: m.power }) : t('move.support')),
        dmgText != null ? h('span', { tip: t('move.dmgTip'), class: 'dmg' }, DK.icon('target', 14), t('move.dmg', { n: dmgText })) : null,
        h('span', { tip: t('move.accTip') }, DK.icon('eye', 14), `${m.acc}%`)),
      compact ? (m.effect ? h('div', { class: 'move-desc small' }, V.effectText(m)) : null) : h('div', { class: 'move-desc' }, m.desc, m.effect ? h('span', { class: 'move-effect' }, ' · ' + V.effectText(m)) : null),
      actions ? h('div', { class: 'move-actions' }, actions) : null);
    if (onClick && !disabled) el.addEventListener('click', onClick);
    if (onHover) {
      el.addEventListener('mouseenter', () => onHover(true)); el.addEventListener('mouseleave', () => onHover(false));
      el.addEventListener('focus', () => onHover(true)); el.addEventListener('blur', () => onHover(false));
    }
    return el;
  };

  /** Segmentos de la barra de atributos, en orden y con su clase de color. */
  const SEGMENTS = [
    { key: 'base', cls: 'seg-base' },
    { key: 'level', cls: 'seg-level' },
    { key: 'nature', cls: 'seg-nature' },
    { key: 'evo', cls: 'seg-evo' },
    { key: 'perm', cls: 'seg-perm' },
    { key: 'equip', cls: 'seg-equip' },
    { key: 'bonus', cls: 'seg-bonus' },
  ];

  /** Flecha de naturaleza: ▲ la potencia, ▼ la reduce, = no le afecta. */
  V.natureArrow = (d, k) => {
    const eff = D.natureEffect(d.nature, k);
    const nat = DK.tr('natures', D.natures[d.nature]);
    const [cls, sym, key] = eff > 0 ? ['up', '▲', 'stats.natUp'] : eff < 0 ? ['down', '▼', 'stats.natDown'] : ['eq', '=', 'stats.natEq'];
    return h('span', { class: 'nat-arrow ' + cls, tip: t(key, { nature: nat }), 'aria-label': t(key, { nature: nat }) }, sym);
  };

  /**
   * Ritmo de crecimiento al subir de nivel (especie + pasivas + talentos + naturaleza):
   * ▲▲ muy rápido · ▲ rápido · ● normal · ▼ lento · ▼▼ muy lento. Ver DK.daskai.growthRate.
   */
  const RATE = { high: '▲▲', up: '▲', normal: '●', down: '▼', low: '▼▼' };
  V.growthBadge = (d, k) => {
    const r = DK.daskai.growthRate(d, k);
    const w = DK.daskai.growthWeight(d, k);
    return h('span', { class: 'grow-rate r-' + r, tip: t('stats.rateTip', { rate: t('stats.rate.' + r), pct: Math.round(w * 100) }), 'aria-label': t('stats.rate.' + r) }, RATE[r]);
  };

  /** Resumen de mejoras permanentes: tónicos usados y puntos entrenados. */
  V.permInfo = (d) => {
    const used = DK.daskai.tonicsUsed(d), tr = DK.training.trainedTotal(d);
    if (!used && !tr && !DK.training.isTraining(d.uid)) return null;
    return h('div', { class: 'chips' },
      h('span', { class: 'chip', tip: t('stats.tonicTip') }, DK.icon('flask', 13), t('stats.tonics', { n: used, max: DK.config.tonic.cap })),
      h('span', { class: 'chip', tip: t('stats.trainedTip') }, DK.icon('dumbbell', 13), t('stats.trained', { n: Math.round(tr), max: DK.config.training.statMax })),
      DK.training.isTraining(d.uid) ? h('span', { class: 'chip warnc' }, DK.icon('clock', 13), t('train.inTraining')) : null);
  };

  /**
   * Barra segmentada: base | nivel | naturaleza | equipo | pasiva.
   * Lo que resta (naturaleza, equipo o pasiva negativos) se marca con rayas rojas al final.
   * @param {Object} b    resultado de DK.daskai.breakdown()
   * @param {number} ref  valor que equivale al 100% de la barra
   */
  V.statBar = (b, ref) => {
    const pos = SEGMENTS.map((sg) => ({ ...sg, n: Math.max(0, b[sg.key]) })).filter((sg) => sg.n > 0);
    const neg = SEGMENTS.reduce((sum, sg) => sum + Math.max(0, -b[sg.key]), 0);
    const posTotal = pos.reduce((sum, sg) => sum + sg.n, 0);
    const scale = Math.max(ref, posTotal);
    const pct = (n) => (n / scale) * 100 + '%';
    const label = (key) => t('stats.legend.' + key);
    const negParts = SEGMENTS.filter((sg) => b[sg.key] < 0).map((sg) => `${label(sg.key)} ${b[sg.key]}`).join(' · ');
    return h('div', { class: 'stat-bar seg-bar' },
      h('div', { class: 'seg-fill', style: { width: pct(posTotal) } },
        pos.map((sg) => h('div', { class: 'seg ' + sg.cls, style: { width: (sg.n / posTotal) * 100 + '%' }, tip: `${label(sg.key)}: +${sg.n}` }))),
      neg ? h('div', { class: 'seg seg-minus', style: { left: pct(posTotal - neg), width: pct(neg) }, tip: `${label('minus')}: ${negParts}` }) : null);
  };

  /** Leyenda de colores de la barra segmentada. */
  V.statLegend = () => h('div', { class: 'stat-legend' },
    [...SEGMENTS.map((sg) => [sg.cls, sg.key]), ['seg-minus', 'minus']].map(([cls, key]) =>
      h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch ' + cls }), t('stats.legend.' + key))),
    h('span', { class: 'legend-item' }, h('span', { class: 'nat-arrow up' }, '▲'), h('span', { class: 'nat-arrow down' }, '▼'), h('span', { class: 'nat-arrow eq' }, '='), t('stats.legend.arrows')),
    h('span', { class: 'legend-item', tip: t('stats.legend.rateTip') }, h('span', { class: 'grow-rate r-up' }, '▲'), h('span', { class: 'grow-rate r-normal' }, '●'), h('span', { class: 'grow-rate r-down' }, '▼'), t('stats.legend.rate')));

  /** Texto del desglose: "56 base · 10 nivel · +4 naturaleza · +6 equipo · +12% pasiva". */
  V.breakdownText = (b) => {
    const sg = (n) => (n > 0 ? '+' : '') + n;
    const parts = [t('stats.part.base', { n: b.base }), t('stats.part.level', { n: b.level })];
    if (b.nature) parts.push(t('stats.part.nature', { n: sg(b.nature) }));
    if (b.evo) parts.push(t('stats.part.evo', { n: sg(b.evo) }));
    if (b.tonic) parts.push(t('stats.part.tonic', { n: sg(b.tonic) }));
    if (b.trained) parts.push(t('stats.part.trained', { n: sg(b.trained) }));
    if (b.equip) parts.push(t('stats.part.equip', { n: sg(b.equip) }));
    if (b.passivePct) parts.push(t('stats.part.passive', { n: sg(Math.round(b.passivePct * 100)) }));
    else if (b.bonus) parts.push(t('stats.part.bonus', { n: sg(b.bonus) }));
    return parts.join(' · ');
  };

  /**
   * Tabla de atributos con barra por colores, flecha de naturaleza y desglose.
   * @param {Object} d
   * @param {Object} [o] {stages (mejoras en combate), compare (otro daskai), legend (mostrar leyenda, por defecto sí)}
   */
  V.statTable = (d, { stages, compare, legend = true } = {}) => {
    const s = DK.daskai.stats(d);
    const other = compare ? DK.daskai.stats(compare) : null;
    const rows = D.statKeys.map((k) => {
      const b = DK.daskai.breakdown(d, k);
      const stage = stages && stages[k];
      const diff = other ? s[k] - other[k] : 0;
      return h('div', { class: 'stat-row' },
        h('span', { class: 'stat-name' }, DK.icon(D.stats[k].icon, 16), h('span', { tip: DK.t('tips.stat.' + k) }, DK.tr('stats', D.stats[k])), V.natureArrow(d, k), V.growthBadge(d, k)),
        h('span', { class: 'stat-val' }, s[k],
          stage ? h('span', { class: 'stage ' + (stage > 0 ? 'pos' : 'neg') }, (stage > 0 ? '▲' : '▼') + Math.abs(stage)) : null,
          other && diff ? h('span', { class: 'stage ' + (diff > 0 ? 'pos' : 'neg') }, (diff > 0 ? '+' : '') + diff) : null),
        V.statBar(b, k === 'hp' ? 400 : 260),
        h('span', { class: 'stat-break muted small' }, V.breakdownText(b)));
    });
    rows.push(h('div', { class: 'stat-row' },
      h('span', { class: 'stat-name', tip: DK.t('tips.stat.regen') }, DK.icon('regen', 16), DK.tr('stats', D.stats.regen)),
      h('span', { class: 'stat-val' }, s.regen + '%'),
      h('div', { class: 'stat-bar' }, h('div', { class: 'seg seg-level', style: { width: Math.min(100, s.regen * 15) + '%' } })),
      h('span', { class: 'stat-break muted small' }, t('stats.regenPerTurn', { n: Math.max(1, Math.round((s.hp * s.regen) / 100)) }))));
    return h('div', { class: 'stat-table' }, legend ? V.statLegend() : null, rows);
  };

  /** Decidir si aprender un ataque nuevo cuando ya tiene el máximo (config.maxMoves). Devuelve promesa (true si lo aprende). */
  V.learnMovePrompt = (d, moveId) => modal({
    title: t('learn.title', { name: DK.daskai.name(d), move: D.moves[moveId].name }), icon: 'sparkles', dismissable: false, size: 'wide',
    content: (close) => h('div', null,
      h('p', { class: 'muted' }, t('learn.text', { n: DK.config.maxMoves })),
      V.moveCard(moveId, { d }),
      h('h4', { class: 'mt' }, t('learn.replace')),
      h('div', { class: 'move-grid' }, d.moves.map((mid, i) => V.moveCard(mid, { d, compact: true, onClick: () => { DK.daskai.setMove(d, moveId, i); DK.store.save(); close(true); } })))),
    actions: [{ label: t('learn.skip'), icon: 'x', variant: 'ghost', value: false }],
  }).promise;

  /** Comparador de dos daskai lado a lado. */
  V.compare = (a, b) => modal({
    title: t('compare.title'), icon: 'scale', size: 'wide',
    content: h('div', { class: 'compare-grid' }, [a, b].map((d, i) => h('div', { class: 'card compare-col' },
      h('div', { class: 'row gap-s' }, V.dSprite(d, { size: 72 }), h('div', null, h('h3', null, DK.daskai.name(d)), h('div', { class: 'row gap-s wrap' }, V.level(d.level), V.houseBadge(DK.daskai.species(d).house), V.shinyTag(d)))),
      h('div', { class: 'info-grid' }, V.natureInfo(d), V.passiveInfo(d)),
      V.statTable(d, { compare: i === 0 ? b : a }),
      h('h4', null, DK.icon('swords', 16), ' ', t('detail.moves')),
      h('div', { class: 'chips' }, d.moves.map((m) => h('span', { class: 'chip' }, DK.icon(D.moves[m].kind === 'fisico' ? 'sword' : 'wand', 13), D.moves[m].name)))))),
    actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost' }],
  });
})();
