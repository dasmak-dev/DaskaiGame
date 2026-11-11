/* =============================================================
 * screens/zones.js — Batalla.
 *   Una sola pantalla para salir de expedición:
 *   - Arriba, el mapa del mundo (camino en pixel art con las zonas
 *     desbloqueadas, la siguiente «???» y el resto «+N»; ← → cambia de zona).
 *     La zona elegida es donde empieza la expedición.
 *   - Debajo, «Preparar» (prepCard): datos del primer mapa, tipo de
 *     expedición, equipo, mochila (el editor completo en un panel) y «Partir».
 *   - Al lado, la ficha de la zona (récords plegados y combate libre).
 *
 *   DK.play.start(zona, { expedition })  → combate libre, o expedición (la zona se ignora)
 *   DK.play.quick()                      → continúa la expedición o empieza una
 *
 * params: { zone }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  /* ---------- Runas (estilo piedra rúnica: gema redonda con un glifo que brilla) ---------- */
  const RUNE_LOOK = {
    small: ['#e7e5e4', 'M12 3v18M12 8l5-4M12 14l-5 4'],
    medium: ['#818cf8', 'M7 3v18M17 3v18M7 8l10 8'],
    xl: ['#22d3ee', 'M5 4l7 8-7 8M19 4l-7 8 7 8'],
    captura: ['#4ade80', 'M12 3v18M12 12l6-6M12 12l-6-6M8 21h8'],
    combate: ['#f43f5e', 'M6 3l12 18M18 3L6 21M8 12h8'],
    desafio: ['#c084fc', 'M12 3l7 7-7 11-7-11zM12 9v6'],
    oro: ['#facc15', 'M12 3v18M7 7l5 3 5-3M7 14l5 3 5-3'],
    saber: ['#5eead4', 'M6 5h12M12 5v14M8 19h8M8 10l4 4 4-4'],
    elite: ['#fb923c', 'M4 18l3-11 5 6 5-6 3 11zM8 21h8'],
    maldito: ['#e11d48', 'M12 3v8M8 7h8M7 21l5-10 5 10M9 17h6'],
  };
  const look = (id) => RUNE_LOOK[DK.runes.parse(id).base] || ['#a78bfa', 'M12 4v16'];
  /** Nombre de una runa con su tier («Runa de la avaricia II»). */
  V.runeName = (id) => { const r = DK.runes.parse(id); return t('rune.' + r.base + '.name') + (r.tier > 1 ? ' ' + DK.runes.roman(id) : ''); };
  /** Clase de color según la rareza (rr-n, rr-m, rr-r). */
  V.runeRarity = (id) => 'rr-' + DK.runes.parse(id).rarity;
  /** Gema rúnica (SVG) de una runa. */
  V.runeGem = (id, size = 48, { dim = false } = {}) => {
    const [c, d] = look(id), tier = DK.runes.parse(id).tier;
    const svg = (tag, attrs) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
    const s = svg('svg', { viewBox: '0 0 48 48', width: size, height: size, class: 'rune-gem' + (dim ? ' dim' : ''), 'aria-hidden': 'true', style: `--rc:${c}` });
    const uid = 'rg' + Math.random().toString(36).slice(2, 8);
    const defs = svg('defs', {});
    const g = svg('radialGradient', { id: uid, cx: '40%', cy: '35%', r: '70%' });
    [[0, c, 0.55], [0.55, '#1a1220', 0.95], [1, '#07050a', 1]].forEach(([o, col, op]) => g.appendChild(svg('stop', { offset: o, 'stop-color': col, 'stop-opacity': op })));
    const f = svg('filter', { id: uid + 'f', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    f.appendChild(svg('feGaussianBlur', { stdDeviation: 1.6, result: 'b' }));
    const m = svg('feMerge', {}); m.appendChild(svg('feMergeNode', { in: 'b' })); m.appendChild(svg('feMergeNode', { in: 'SourceGraphic' })); f.appendChild(m);
    defs.append(g, f); s.appendChild(defs);
    s.appendChild(svg('circle', { cx: 24, cy: 24, r: 21, fill: `url(#${uid})`, stroke: c, 'stroke-opacity': 0.55, 'stroke-width': 1.5 }));
    s.appendChild(svg('circle', { cx: 24, cy: 24, r: 17, fill: 'none', stroke: c, 'stroke-opacity': 0.22, 'stroke-width': 1 }));
    const glyph = svg('g', { transform: 'translate(10 10) scale(1.1667)', filter: `url(#${uid}f)` });
    glyph.appendChild(svg('path', { d, fill: 'none', stroke: c, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    s.appendChild(glyph);
    s.appendChild(svg('ellipse', { cx: 18, cy: 13, rx: 7, ry: 3.5, fill: '#fff', opacity: 0.18 }));
    // Tier II: anillo doble · tier III: corona dorada y número
    if (tier >= 2) s.appendChild(svg('circle', { cx: 24, cy: 24, r: 23, fill: 'none', stroke: tier === 3 ? '#fde68a' : c, 'stroke-opacity': tier === 3 ? 0.95 : 0.7, 'stroke-width': tier === 3 ? 2 : 1.4, 'stroke-dasharray': tier === 3 ? '' : '3 2' }));
    if (tier >= 2) { const tx = svg('text', { x: 24, y: 45, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 800, fill: tier === 3 ? '#fde68a' : '#fff', stroke: '#000', 'stroke-width': 0.6, 'paint-order': 'stroke', 'font-family': 'serif' }); tx.textContent = DK.runes.roman(id); s.appendChild(tx); }
    // Rareza: mágica = halo azul, rara = halo dorado
    const rar = DK.runes.parse(id).rarity;
    if (rar !== 'n') s.insertBefore(svg('circle', { cx: 24, cy: 24, r: 22.5, fill: 'none', stroke: rar === 'l' ? '#ff8a3d' : rar === 'r' ? '#ffd84a' : '#8f8fff', 'stroke-width': rar === 'l' ? 3 : 2.4, 'stroke-opacity': 0.9, filter: `url(#${uid}f)` }), s.childNodes[1]);
    s.setAttribute('class', s.getAttribute('class') + ' t' + tier + ' rr-' + rar);
    return s;
  };
  /** Texto de lo que hace una runa (+ pisos si es de tamaño y sus modificadores). */
  V.runeEffect = (id) => {
    const r = DK.runes.get(id); if (!r) return '';
    const m = DK.runes.mult(id);
    let txt = r.group === 'bonus' ? t('rune.' + r.base + '.effect', { n: r.elites ? r.elites * r.tier : Math.round((r.coins || r.exp || r.loot || 0) * m * 100) }) : t('rune.' + r.base + '.effect');
    const fl = r.group === 'size' && (DK.config.expedition.runes.tierFloors || {})[r.value];
    if (fl) txt += ' · ' + t('rune.floors', { n: fl[r.tier - 1] });
    const emb = (r.group !== 'bonus' ? r.tier - 1 : 0) + (DK.runes.rar(r.rarity).emblems || 0); // v4.90: + legendaria
    if (emb > 0) txt += ' · ' + t('rune.tierEmblems', { n: emb });
    if (r.group === 'size' && r.base === 'xl' && r.tier === 3) txt += ' · ' + t('rune.tierCaves', { n: 2 });
    return txt;
  };
  /** Modificadores de una runa mágica/rara, como lista de textos. */
  V.runeAffixes = (id) => DK.runes.parse(id).affixes.map((a) => t(['rune', 'aff', a.k].join('.'), { n: a.v }));
  /** Nombre + rareza + efecto + modificadores (para tooltips). */
  V.runeTip = (id) => [V.runeName(id), V.runeEffect(id)].concat(V.runeAffixes(id)).join(' · ');

  DK.menus.add('nav', { id: 'battle', icon: 'swords', order: 40, pin: true, screen: 'zones', label: () => t('nav.battle'), badge: () => (DK.expedition.active() ? '!' : '') });

  /* ---------- Empezar combates desde cualquier pantalla ---------- */
  DK.play = {
    /**
     * Empieza un combate en una zona.
     * @param {string} zoneId
     * @param {Object} [o] {expedition: true para empezar/continuar una expedición}
     * @returns {boolean} false si no hay daskai en pie
     */
    start(zoneId, { expedition = false } = {}) {
      let alive = DK.party.aliveActive();
      // Fuera de expedición, si nadie del equipo está en pie se recupera lo justo para salir
      if (!alive.length && !DK.expedition.active()) { DK.expedition.afterEnd(); alive = DK.party.aliveActive(); }
      if (!alive.length) { DK.audio.sfx('error'); DK.ui.toast(t('warn.allFainted'), { icon: 'skull', kind: 'bad' }); return false; }
      const exp = DK.expedition.active();
      if (exp && !expedition) { DK.ui.toast(t('zones.expBusy'), { icon: 'flag', kind: 'bad' }); return false; }
      if (expedition) {
        // Se prepara en Batalla (zona, tipo, equipo y mochila en la misma pantalla);
        // las expediciones se juegan desde su mapa (screens/expedition.js)
        if (exp) DK.router.go('expedition');
        else if (!DK.router.current() || DK.router.current().id !== 'zones') DK.router.go('zones');
        else { const b = document.querySelector('.bt-go'); if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); b.focus(); } }
        return true;
      }
      if (!DK.world.freeUnlocked(zoneId)) { DK.audio.sfx('error'); DK.ui.toast(t('zones.freeLocked'), { icon: 'lock', kind: 'bad' }); return false; }
      DK.router.go('battle', { zone: zoneId, leaderUid: alive[0].uid });
      return true;
    },
    /** Botón "Jugar": continúa la expedición o entra en la zona recomendada. */
    quick() {
      const exp = DK.expedition.active();
      if (exp) return this.start(exp.zone, { expedition: true });
      return this.start(null, { expedition: true });
    },
  };

  /* ---------------- Ficha de la zona elegida ---------------- */
  /** Récords de una zona en una tira de iconos: mapas, profundidad, XL, jefe oculto y el mapa más rápido. */
  function recordsStrip(z) {
    const r = DK.world.progress(z.id).rec || { maps: 0, best: 0, sizes: {}, fastest: null };
    const sec = DK.world.secret(z.id);
    const cell = (icon, label, value, dim) => h('div', { class: 'bz-stat' + (dim ? ' dim' : ''), tip: label }, DK.icon(icon, 16), h('b', null, value), h('small', null, label));
    return h('div', { class: 'bz-stats', 'aria-label': t('zones.records') },
      cell('trophy', t('zones.winsShort'), String(DK.world.progress(z.id).wins || 0), !DK.world.progress(z.id).wins),
      cell('book', t('zones.codexShort'), Math.round(DK.codex.completion(z.id) * 100) + '%', !DK.codex.completion(z.id)),
      cell('map', t('zones.recMaps'), String(r.maps), !r.maps),
      cell('compass', t('zones.recDepth'), r.best ? String(r.best) : '—', !r.best),
      cell('mountain', t('zones.recXl'), String(r.sizes.xl || 0), !r.sizes.xl),
      cell('cave', t('zones.recSecret'), sec.defeated ? '×' + sec.defeated : '?', !sec.defeated),
      cell('clock', t('zones.recFast'), r.fastest ? DK.util.duration(Math.round(r.fastest / 1000)) : '—', !r.fastest));
  }

  /** Ficha compacta de una zona: dibujo con sus daskai, datos, récords y combate libre. */
  function zoneCard(z) {
    const exp = DK.expedition.active();
    const ok = DK.party.aliveActive().length > 0;
    const bossDone = DK.world.boss(z.id).defeated > 0;
    const free = DK.world.freeUnlocked(z.id);
    const art = h('div', { class: 'bz-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('div', { class: 'bz-mons' }, z.enemies.map((e) => V.sprite(e.species, { size: 46, silhouette: !DK.codex.getEntry(z.id, e.species), cls: 'float' }))));
    return h('section', { class: 'card bz-card', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, art,
      h('div', { class: 'bz-body' },
        h('div', { class: 'bz-title' }, h('span', { class: 'bz-icon' }, DK.icon(z.icon, 22)),
          h('div', { class: 'grow' }, h('h3', null, z.name), h('span', { class: 'muted small' }, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)),
          z.boss ? h('span', { class: 'chip' + (bossDone ? ' pos' : '') }, DK.icon('crown', 13), bossDone ? t('zones.bossDone') : t('zones.bossLevel', { n: z.boss.level })) : null),
        h('p', { class: 'muted small bz-desc' }, z.desc),
        h('details', { class: 'bz-records' }, h('summary', null, DK.icon('trophy', 14), ' ', t('zones.records')), recordsStrip(z)),
        h('div', { class: 'bz-actions' },
          free
            ? btn({ icon: 'swords', label: t('zones.free'), desc: t('zones.freeDesc'), variant: 'tone', disabled: !ok || !!exp, tip: exp ? t('zones.expBusy') : null, onClick: () => DK.play.start(z.id) })
            : btn({ icon: 'lock', label: t('zones.free'), desc: t('zones.freeLocked'), variant: 'tone', disabled: true }))));
  }

  /* ---------------- Cartel de la expedición ---------------- */
  /** Empezar una expedición nueva o seguir la que está en curso: una línea y un botón grande. */
  function expeditionHero(refresh) {
    const exp = DK.expedition.active();
    const ok = DK.party.aliveActive().length > 0;
    const team = DK.party.active();
    const pv = exp ? null : DK.expedition.preview();
    const z = D.zones[exp ? exp.zone : pv.zone];
    const best = DK.expedition.bestDepth();
    const chips = exp
      ? [h('span', { class: 'chip' }, DK.icon('compass', 13), t('exp.depth', { n: exp.depth || 1 })),
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(exp.step, exp.total), total: exp.total })),
        h('span', { class: 'chip' }, DK.icon('gift', 13), t('exp.lootNow', { items: DK.expedition.lootCount(), coins: exp.loot.coins }))]
      : [h('span', { class: 'chip' }, DK.icon(z.icon, 13), t('exp.nextZone', { zone: z.name })), V.kindChip(pv.kind), V.sizeChip(pv.size), V.modChip(pv.mod),
        best ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('exp.best', { n: best })) : null,
        DK.rules.permadeath() ? h('span', { class: 'chip neg', tip: t('zones.permadeath') }, DK.icon('skull', 13), t('zones.hardMode')) : null];
    const problems = DK.world.warnings(z.id).filter((w) => w.kind !== 'good');
    return h('section', { class: 'bt-hero' + (exp ? ' on' : ''), style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'bt-hero-bg', 'aria-hidden': 'true' }, DK.scenes.render(z.scene, z.colors)),
      h('div', { class: 'bt-hero-main' },
        h('div', { class: 'bt-hero-text' },
          h('span', { class: 'bt-kicker' }, DK.icon(exp ? 'flag' : 'compass', 14), exp ? t('home.expedition') : t('zones.heroNew')),
          h('h2', null, exp ? z.name : t('exp.start')),
          h('p', null, exp ? t('zones.heroOnLine') : t('zones.heroLine')),
          h('div', { class: 'chips' }, chips)),
        h('div', { class: 'bt-hero-go' },
          btn({ icon: exp ? 'map' : 'flag', label: exp ? t('exp.openMap') : t('exp.start'), size: 'lg', variant: 'primary', disabled: !ok, hotkey: '↵', cls: 'play-btn', onClick: () => DK.play.quick() }),
          exp ? h('span', { class: 'bt-hero-note', tip: t('exp.exitRuleTip') }, DK.icon('campfire', 13), ' ', t('exp.exitRule')) : null)),
      problems.length ? V.warnings(problems, async () => { if (await V.healDialog(team)) refresh(); }) : null);
  }

  /* ================= Mesa de guerra (v5.44): preparar la expedición =================
   * Izquierda: carta del destino (zona, peligro, datos, tipo de expedición) y el contrato semanal.
   * Derecha: runas, reglas de la aventura (Abismo, Corrupción, Pesadilla, grabadas), formación,
   * mochila y la barra de embarque con «Partir». Todo se redibuja solo (sin tocar el mapa del mundo).
   */
  let offEnter = null;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const wtHead = (title, sub, ...extra) => h('div', { class: 'wt-h' }, h('span', { class: 'wt-h-t' }, title), sub ? h('span', { class: 'wt-h-s' }, sub) : null, ...extra);

  /** Peligro de 1 a 5: nivel de la zona frente a tu equipo, más Corrupción, Pesadilla y Abismo. */
  function dangerOf(n, z, lvBonus) {
    const avg = DK.party.avgLevel(), top = (z.levels ? z.levels[1] : 100) + lvBonus, diff = top - avg;
    let d = diff < -8 ? 1 : diff < -2 ? 2 : diff < 3 ? 3 : diff < 8 ? 4 : 5;
    d += Math.floor((n.corruption || 0) / 2) + (n.nightmare && n.nightmare === n.zone ? 1 : 0) + (n.kind === 'abismo' ? 1 : 0);
    return Math.max(1, Math.min(5, d));
  }

  /** Ventana con los récords de la zona (antes en un desplegable). */
  const recordsModal = (z) => DK.ui.modal({ title: `${t('zones.records')} · ${z.name}`, icon: 'trophy', content: () => recordsStrip(z) });

  /** Carta del destino. */
  function destCard(n, pv, refresh) {
    const E = DK.expedition, z = D.zones[pv.zone], AVR = DK.averno;
    const averno = AVR.isZone(pv.zone), abyss = pv.kind === 'abismo';
    const lvBonus = E.levelBonus(1) + ((pv.mod && D.mapMods[pv.mod].levels) || 0);
    const bossDone = z.boss && DK.world.boss(z.id).defeated > 0;
    const art = h('div', { class: 'wt-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('span', { class: 'wt-zic' }, DK.icon(z.icon, 18)),
      abyss ? h('div', { class: 'wt-series' }, DK.abyss.series(n.zone).map((zz) => V.sprite(D.zones[zz].boss.species, { size: 46, silhouette: true })))
        : z.boss ? h('span', { class: 'wt-boss' + (bossDone ? ' seen' : '') }, V.sprite(z.boss.species, { size: 84, silhouette: !bossDone })) : null,
      averno ? h('span', { class: 'wt-tag bad' }, DK.icon('flame', 11), t('averno.exitRule'))
        : abyss ? h('span', { class: 'wt-tag abyss' }, DK.icon('moon', 11), t('wt.series'))
          : bossDone ? h('span', { class: 'wt-tag good' }, DK.icon('crown', 11), t('zones.bossDone')) : null);
    const danger = dangerOf(n, z, lvBonus);
    const fact = (icon, b, s, cls = '', tip = null) => h('div', { class: 'wt-fact ' + cls, tip }, DK.icon(icon, 15), h('span', null, h('b', null, b), h('small', null, s)));
    const facts = averno ? (() => { const r = AVR.rec(), A = D.endgame.averno;
      return [fact('flame', `${t('common.lvl')} ${A.level.start}–${A.level.cap}`, t('wt.foes'), 'bad'), fact('trophy', r.best && r.best.floors ? String(r.best.floors) : '—', t('averno.bestTitle')),
        fact('campfire', t('wt.noExit'), t('averno.rule3')), fact('paw', t('wt.noRecruits'), t('averno.rule4'))]; })()
      : abyss ? [fact('crown', String(DK.abyss.series(n.zone).length), t('wt.bossesRow')), fact('trophy', String(DK.abyss.best(n.zone)), t('wt.record')),
        fact('campfire', t('wt.betweenShort'), t('wt.between')), fact('gift', t('wt.roundPrize'), t('wt.roundPrizeSub'), 'good')]
        : [fact(DK.config.expedition.sizes[pv.size] ? DK.config.expedition.sizes[pv.size].icon : 'map', t('size.' + pv.size + '.name'), t('wt.floors', { n: E.sizeFloors(pv.size) })),
          pv.mod && D.mapMods[pv.mod] ? fact(D.mapMods[pv.mod].icon, t('mod.' + pv.mod + '.name'), t('wt.modifier'), 'good', t('mod.' + pv.mod + '.desc')) : fact('sun', t('wt.noMod'), t('wt.modifier')),
          fact('emblem', '+' + E.bossEmblems(pv.size, pv.kind), t('wt.perBoss'), 'good'),
          z.boss ? fact('crown', D.species[z.boss.species] && bossDone ? D.species[z.boss.species].name : '???', t('wt.boss')) : fact('crown', '—', t('wt.boss'))];
    // Tipo de expedición: una línea con sus probabilidades en pequeño
    const cur = E.kindDef(pv.kind), chances = E.kindChances(), sel = DK.runes.selected();
    const kline = averno ? null : h('div', { class: 'wt-kind' },
      h('span', { class: 'wt-kind-ic' }, DK.icon(cur.icon, 16)),
      h('div', { class: 'wt-kind-t' }, h('small', null, t('kind.rolled'), sel.kind ? h('span', { class: 'wt-mini' }, ' · ', DK.icon('rune', 10), t('kind.byRune')) : null),
        h('b', { tip: t('kind.' + cur.id + '.desc') }, t('kind.' + cur.id + '.name'))),
      sel.kind || cur.special ? h('small', { class: 'wt-kind-d' }, t('kind.' + cur.id + '.desc')) : h('div', { class: 'wt-odds bt-kind', tip: t('kind.chancesHint') },
        E.kinds().map((k) => h('span', { class: 'bt-odd wt-odd' + (k.id === cur.id ? ' on' : '') + (k.locked ? ' locked' : ''), tip: k.locked ? t('kind.locked') : `${t('kind.' + k.id + '.name')} · ${Math.round((chances[k.id] || 0) * 100)}%` },
          DK.icon(k.locked ? 'lock' : k.icon, 11), h('i', null, k.locked ? '—' : Math.round((chances[k.id] || 0) * 100) + '%')))));
    const free = DK.world.freeUnlocked(z.id), ok = DK.party.aliveActive().length > 0;
    return h('section', { class: 'wt-dest', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, art,
      h('div', { class: 'wt-dbody' },
        h('div', null, h('span', { class: 'wt-kick' }, t('wt.dest')), h('h3', null, abyss ? t('abyss.title') : z.name), abyss ? h('small', { class: 'wt-from' }, t('wt.from', { zone: z.name })) : null),
        h('div', { class: 'wt-danger', tip: t('wt.dangerTip') }, h('small', null, t('wt.danger')), h('span', { class: 'wt-skulls' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= danger ? 'on' : '' }))),
          averno ? null : h('small', { class: 'wt-foes' }, t('wt.foes'), ' ', h('b', null, `${t('common.lvl')} ${z.levels[0] + lvBonus}–${z.levels[1] + lvBonus}`))),
        h('div', { class: 'wt-facts' }, facts),
        kline,
        h('div', { class: 'wt-links' },
          h('button', { class: 'wt-link', type: 'button', onClick: () => recordsModal(z) }, DK.icon('trophy', 13), t('zones.records')),
          h('button', { class: 'wt-link', type: 'button', disabled: !free || !ok, tip: free ? t('zones.freeDesc') : t('zones.freeLocked'), onClick: () => DK.play.start(z.id) }, DK.icon(free ? 'swords' : 'lock', 13), t('zones.free')))));
  }

  /** Contrato semanal (el desafío): un pergamino. */
  function contractCard(params) {
    if (!DK.weekly.unlocked()) return null;
    const W = DK.weekly, w = W.def(), z = D.zones[w.zone], best = W.best(), rw = W.reward(), done = W.rec().rewarded;
    const go = () => {
      if (!DK.party.aliveActive().length) { DK.ui.toast(t('weekly.noTeam'), { icon: 'alert', kind: 'bad' }); return; }
      if (!W.start(params.pack || {})) return;
      params.pack = {}; DK.audio.sfx('select'); DK.router.reset('expedition');
    };
    const term = (icon, txt, cls = '', tip = null) => h('div', { class: 'wt-term ' + cls, tip }, DK.icon(icon, 13), h('span', null, txt));
    return h('section', { class: 'wt-contract' },
      h('div', { class: 'wt-c-rib' }, t('wt.week', { n: w.week, d: W.daysLeft() })),
      h('div', { class: 'wt-c-kick' }, t('wt.contract')),
      h('div', { class: 'wt-c-title' }, z.name),
      h('div', { class: 'wt-c-sub' }, t('wt.contractSub', { n: W.teamLevel() })),
      h('div', { class: 'wt-c-terms' },
        term(z.icon, z.name), term(DK.config.expedition.sizes[w.size] ? DK.config.expedition.sizes[w.size].icon : 'map', t('size.' + w.size + '.name')),
        w.mod && D.mapMods[w.mod] ? term(D.mapMods[w.mod].icon, t('mod.' + w.mod + '.name'), '', t('mod.' + w.mod + '.desc')) : null,
        term(DK.expedition.kindDef(w.kind).icon, t('kind.' + w.kind + '.name'), '', t('kind.' + w.kind + '.desc')),
        w.curses.map((id) => term(D.curses[id].icon, t('curse.' + id + '.name'), 'bad', t('curse.' + id + '.desc')))),
      h('div', { class: 'wt-c-foot' },
        h('div', null, h('small', null, t('wt.reward')), done ? h('span', { class: 'wt-c-r done' }, DK.icon('check', 12), t('wt.rewarded'))
          : h('span', { class: 'wt-c-rs' }, h('span', { class: 'wt-c-r' }, DK.icon('emblem', 13), '×' + rw.emblems), DK.runes.enabled() ? h('span', { class: 'wt-c-r' }, DK.icon('rune', 13), t('wt.runeN', { n: ROMAN[rw.runeTier - 1] })) : null)),
        h('div', { class: 'wt-c-best', tip: t('weekly.bestTip', { n: W.tries() }) }, h('small', null, t('wt.yourBest')), h('b', null, best ? best.toLocaleString(DK.i18n.lang) : '—'))),
      h('div', { class: 'wt-c-btns' },
        h('button', { class: 'wt-c-go', type: 'button', onClick: go }, DK.icon('edit', 14), t('wt.sign')),
        h('button', { class: 'wt-c-ic', type: 'button', tip: t('weekly.board'), 'aria-label': t('weekly.board'), onClick: () => weeklyBoard() }, DK.icon('list', 15)),
        DK.online.enabled() ? h('button', { class: 'wt-c-ic', type: 'button', tip: t('online.boardsBtn'), 'aria-label': t('online.boardsBtn'), onClick: () => V.leaderboard({ board: 'weekly' }) }, DK.icon('globe', 15)) : null));
  }

  /** Runas: una fila fina con los huecos. */
  function runesRow(refresh) {
    if (!DK.runes.enabled()) return null;
    const slots = DK.runes.slots(), N = DK.runes.slotCount();
    const sockets = Array.from({ length: N }, (_, i) => {
      const id = slots[i];
      if (!id) return h('button', { class: 'rune-socket empty', type: 'button', 'aria-label': t('rune.add'), tip: DK.runes.total() ? t('rune.add') : t('rune.none'), onClick: () => runePicker(refresh) }, h('span', { class: 'rune-socket-ring' }, DK.icon('plus', 11)));
      return h('button', { class: 'rune-socket full g-' + DK.runes.get(id).group, type: 'button', style: { '--rc': look(id)[0] }, 'aria-label': t('rune.remove', { name: V.runeName(id) }),
        tip: `${V.runeTip(id)} · ${t('rune.tapOff')}`, onClick: () => { DK.runes.unsocket(i); DK.audio.sfx('click'); refresh(); } },
        h('span', { class: 'rune-socket-ring' }, V.runeGem(id, 28)), h('span', { class: 'rune-socket-x' }, DK.icon('x', 10)));
    });
    return h('section', { class: 'wt-panel wt-runes' },
      h('div', { class: 'wt-runes-t' }, h('span', { class: 'wt-h-t' }, t('rune.title')),
        h('button', { class: 'wt-h-s linkish', type: 'button', tip: t('rune.help'), onClick: () => DK.ui.toast(t('rune.help'), { icon: 'info' }) }, DK.icon('info', 11), ' ', t('rune.have', { n: DK.runes.total() }))),
      h('div', { class: 'rune-sockets' }, sockets),
      h('small', { class: 'wt-runes-fx' }, slots.length ? slots.map(V.runeEffect).join(' · ') : t('wt.runesEmpty')));
  }

  /** Reglas de la aventura: casillas iguales (Abismo, Corrupción, Pesadilla, grabadas) y una línea de lo que cambia. */
  function rulesBox(refresh) {
    const E = DK.expedition, n = E.nextStart(), C = DK.corruption, G = D.endgame, AVR = DK.averno;
    const cells = [], harder = [], better = [];
    let extra = null;
    const cell = (kind, icon, title, control, sub, on) => h('div', { class: 'wt-rule k-' + kind + (on ? ' on' : '') },
      h('div', { class: 'wt-rule-h' }, DK.icon(icon, 15), h('b', null, title)), control, sub ? h('small', null, sub) : null);
    if (AVR.isZone(n.zone)) {
      const A = G.averno;
      harder.push(t('averno.rule1'), t('averno.rule2'));
      cells.push(cell('averno', 'flame', t('averno.title'), h('div', { class: 'wt-av-rules' }, [t('averno.rule3'), t('averno.rule4')].map((x) => h('span', null, x))), `${t('common.lvl')} ${A.level.start}–${A.level.cap}`, true));
      cells.push(cell('board', 'trophy', t('online.boardsBtn'), btn({ icon: 'trophy', label: t('online.boardBtn'), size: 'sm', variant: 'ghost', onClick: () => V.leaderboard({ board: 'averno' }) }), null, false));
    } else {
      if (!AVR.unlocked() && C.visible() && n.zone === AVR.lastZone() && D.zones[AVR.zoneId()])
        cells.push(cell('averno', 'lock', t('averno.lockedTitle'), h('small', { class: 'muted' }, t('averno.lockedHint', { zone: D.zones[n.zone].name, n: ROMAN[C.levels().length - 1] || C.levels().length })), null, false));
      if (DK.abyss.unlocked()) {
        const can = DK.abyss.available(n.zone);
        if (n.kind === 'abismo' && !can) DK.abyss.set(false);
        const on = n.kind === 'abismo' && can;
        cells.push(cell('abyss', 'moon', t('abyss.title'), h('div', { class: 'wt-seg egx-seg' },
          h('button', { class: on ? '' : 'on', type: 'button', 'aria-pressed': String(!on), onClick: () => { DK.abyss.set(false); refresh(); } }, t('abyss.normal')),
          h('button', { class: on ? 'on' : '', type: 'button', disabled: !can, tip: can ? null : t('abyss.locked'), 'aria-pressed': String(on), onClick: () => { DK.abyss.set(true); DK.audio.sfx('select'); refresh(); } }, DK.icon(can ? 'moon' : 'lock', 11), t('abyss.enter'))),
          can ? t('abyss.best', { n: DK.abyss.best(n.zone) }) : t('abyss.locked'), on));
        if (on) {
          const rounds = DK.abyss.rounds(n.zone);
          extra = h('div', { class: 'wt-series-row abx-series' },
            h('span', { class: 'wt-h-s' }, DK.icon('crown', 11), t('abyss.series'), rounds ? ' · ' + t('abyss.rounds', { n: rounds }) : ' · ' + t('abyss.first')),
            h('div', { class: 'abx-row' }, DK.abyss.series(n.zone).map((z, i, a) => { const b = D.zones[z].boss;
              return h('div', { class: 'abx-boss' + (i === a.length - 1 ? ' last' : ''), tip: `${b.title} · ${t('abyss.seriesTip', { lv: DK.abyss.bossLevel(n.zone, i) + E.levelBonus(1), zone: D.zones[z].name })}` },
                h('span', { class: 'abx-n' }, i + 1), V.sprite(b.species, { size: 40 }), h('small', null, `${t('common.lvl')} ${DK.abyss.bossLevel(n.zone, i) + E.levelBonus(1)}`)); })));
        }
      }
      if (C.visible()) {
        const cur = n.corruption || 0, max = C.max(), def = C.def(cur);
        const opt = (lv) => h('button', { class: (lv === cur ? 'on' : '') + (lv > max ? ' locked' : ''), type: 'button', disabled: lv > max, 'aria-pressed': String(lv === cur),
          tip: lv > max ? t('corruption.lockedTip', { n: lv - 1 }) : lv ? t('corruption.levelN', { n: lv }) : t('corruption.none'),
          onClick: () => { C.set(lv); DK.audio.sfx(lv ? 'select' : 'click'); refresh(); } }, lv > max ? DK.icon('lock', 10) : lv ? ROMAN[lv - 1] : '—');
        cells.push(cell('cor', 'skull', t('corruption.title'), h('div', { class: 'wt-pips egx-levels' }, (max > 0 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]).map(opt)),
          def ? t('corruption.foes', { lv: def.levels, n: Math.round(def.stat * 100) }) : (max < C.levels().length ? t('corruption.help', { n: max }) : t('corruption.helpMax')), cur > 0));
        if (def) {
          harder.push(t('corruption.foes', { lv: def.levels, n: Math.round(def.stat * 100) }), ...C.levels().slice(0, cur).map((l) => l.rule).filter(Boolean).map((r) => t('corruption.rule.' + r)));
          better.push(t('corruption.rewardEmblems', { n: def.emblems }), '+' + Math.round(def.coins * 100) + '% ' + t('wt.coins'), t('corruption.rewardShiny', { n: Math.round(def.shiny * 100) }), t('corruption.rewardTier', { n: Math.round(def.tier * 100) }));
        }
      }
      if (DK.nightmare.available(n.zone) && n.kind !== 'abismo') {
        const on = n.nightmare === n.zone, N = G.nightmare;
        cells.push(cell('nightmare', 'demon', t('nightmare.title'),
          h('button', { class: 'wt-switch egx-switch' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(on), onClick: () => { DK.nightmare.toggle(); DK.audio.sfx('select'); refresh(); } }, h('i'), h('span', null, on ? t('nightmare.on') : t('nightmare.off'))),
          t('wt.nightmareShort', { lv: N.levels, n: Math.round(N.stat * 100), c: Math.round(N.coins * 100) }), on));
        if (on) { harder.push(t('wt.nmHarder', { lv: N.levels, n: Math.round(N.stat * 100) })); better.push('+' + Math.round(N.coins * 100) + '% ' + t('wt.coins'), t('wt.nmEmblem', { n: N.emblems })); }
      }
    }
    const eng = DK.engrave.list();
    if (eng.length) cells.push(cell('engrave', 'amulet', t('engrave.title'), h('div', { class: 'wt-eng' }, eng.map((id) => h('span', { class: 'wt-eng-r', tip: V.relicText ? V.relicText(D.relics[id]) : '' }, DK.icon(D.relics[id].icon, 11), D.relics[id].name))), t('wt.engraveSub'), false));
    if (!cells.length) return null;
    return h('section', { class: 'wt-panel wt-rules' }, wtHead(t('wt.rules'), t('wt.rulesSub')),
      h('div', { class: 'wt-rgrid' + (cells.length === 1 ? ' one' : '') }, cells), extra,
      harder.length || better.length ? h('div', { class: 'wt-sum' },
        harder.length ? h('span', { class: 'bad' }, DK.icon('alert', 11), harder.join(' · ')) : null,
        better.length ? h('span', { class: 'good' }, DK.icon('gift', 11), better.join(' · ')) : null) : null);
  }

  /** Formación: seis puestos; arrastra uno sobre otro para cambiar el orden, pulsa para ver su ficha. */
  function formationBox(refresh) {
    const E = DK.expedition, team = DK.party.active();
    const healCost = E.healCost(team), poor = healCost && DK.wallet.get() < healCost;
    let drag = null;
    const cards = Array.from({ length: DK.config.maxTeam }, (_, i) => {
      const d = team[i];
      if (!d) return h('button', { class: 'wt-pc bt-mon empty', type: 'button', tip: t('home.manage'), 'aria-label': t('home.manage'), onClick: () => DK.router.go('team') }, DK.icon('plus', 16));
      const s = DK.daskai.stats(d), sp = DK.daskai.species(d), hp = DK.util.percent(d.cur.hp, s.hp), mp = DK.util.percent(d.cur.mp, s.mp);
      const c = h('button', { class: 'wt-pc bt-mon' + (i ? '' : ' lead') + (DK.daskai.isFainted(d) ? ' ko' : ''), type: 'button', draggable: 'true', style: { '--hc': D.houseColor(sp.house) },
        tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level} · ${d.cur.hp}/${s.hp}` + (i ? '' : ' · ' + t('wt.lead')),
        onClick: () => { DK.audio.sfx('select'); V.quickStats(d, { onChange: refresh }); } },
        i ? null : h('span', { class: 'wt-pc-crown', 'aria-label': t('wt.lead') }, '♛'),
        h('span', { class: 'wt-pc-spr' }, V.dSprite(d, { size: 38 })),
        h('span', { class: 'wt-pc-txt' }, h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`)),
        h('span', { class: 'wt-pc-bars' }, h('span', { class: 'wt-bar hp' + (hp < 30 ? ' crit' : '') }, h('i', { style: { width: hp + '%' } })), h('span', { class: 'wt-bar mp' }, h('i', { style: { width: mp + '%' } }))));
      c.addEventListener('dragstart', (e) => { drag = d.uid; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', d.uid); e.dataTransfer.effectAllowed = 'move'; } catch (er) { /* */ } });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
      c.addEventListener('dragover', (e) => { if (drag && drag !== d.uid) { e.preventDefault(); c.classList.add('over'); } });
      c.addEventListener('dragleave', () => c.classList.remove('over'));
      c.addEventListener('drop', (e) => { e.preventDefault(); c.classList.remove('over'); if (drag && drag !== d.uid) { DK.party.moveInTeam(drag, i); DK.audio.sfx('select'); drag = null; refresh(); } });
      return c;
    });
    return h('section', { class: 'wt-panel wt-form' },
      wtHead(t('wt.formation'), `${team.length}/${DK.config.maxTeam} · ${t('wt.dragHint')}`,
        h('span', { class: 'wt-tools' },
          healCost ? h('button', { class: 'wt-tool good' + (poor ? ' poor' : ''), type: 'button', disabled: poor, tip: poor ? t('healPay.poor', { n: healCost - DK.wallet.get() }) : t('healPay.tip'),
            onClick: async () => {
              if (!(await DK.ui.confirm(t('healPay.title'), t('healPay.text', { n: healCost.toLocaleString(DK.i18n.lang) }), { okLabel: t('healPay.ok', { n: healCost.toLocaleString(DK.i18n.lang) }) }))) return;
              if (E.healPaid(team)) { DK.audio.sfx('heal'); DK.ui.toast(t('healPay.done', { n: healCost.toLocaleString(DK.i18n.lang) }), { icon: 'heart', kind: 'good' }); DK.app.renderRes && DK.app.renderRes(); refresh(); }
            } }, DK.icon('heart', 12), t('wt.heal'), h('i', null, DK.icon('coin', 11), healCost.toLocaleString(DK.i18n.lang))) : null,
          h('button', { class: 'wt-tool', type: 'button', tip: t('heal.button'), onClick: async () => { if (await V.healDialog(team)) refresh(); } }, DK.icon('flask', 12), t('wt.items')),
          h('button', { class: 'wt-tool', type: 'button', tip: t('home.manage'), onClick: () => DK.router.go('team') }, DK.icon('edit', 12), t('wt.change')))),
      h('div', { class: 'wt-party bt-team6' }, cards));
  }

  /** Mochila: anillo de capacidad, acciones y bolsillos con icono, nombre y cantidad; «+» abre la bolsa. */
  function bagBox(params, refresh) {
    const E = DK.expedition, pack = params.pack, cap = E.packCapacity(), used = E.packSize(pack), home = DK.bag.home();
    const chosen = Object.keys(pack).filter((id) => pack[id] > 0 && D.items[id]);
    const last = V.lastPack();
    const openPack = () => { V.packModal(params, null).promise.then(() => refresh()); };
    const minus = (id) => { const k = (pack[id] || 0) - 1; if (k > 0) pack[id] = k; else delete pack[id]; DK.audio.sfx('click'); refresh(); };
    const C = 2 * Math.PI * 15, pct = Math.min(1, used / Math.max(1, cap));
    const ring = h('span', { class: 'wt-ring' + (used >= cap ? ' full' : ''), tip: t('pack.capTip') });
    ring.innerHTML = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg>`;
    ring.append(h('b', null, String(used), h('small', null, '/' + cap)));
    const effect = (it) => (it.use ? V.useText(it) : it.desc) || '';
    // un bolsillo por objeto distinto; luego «+» y huecos hasta completar 10 (o los que quepan)
    const pockets = chosen.map((id) => { const it = D.items[id];
      return h('div', { class: 'wt-pk full pk-row r-' + it.rarity, tip: `${it.name} · ${effect(it)}` },
        h('button', { class: 'wt-pk-main', type: 'button', onClick: openPack }, h('span', { class: 'wt-pk-ic' }, V.itemIcon(it, 22)), h('span', { class: 'wt-pk-n' }, it.name), h('b', null, '×' + pack[id])),
        h('button', { class: 'wt-pk-x', type: 'button', 'aria-label': t('pack.tapRemove', { name: it.name }), tip: t('pack.tapRemove', { name: it.name }), onClick: () => minus(id) }, DK.icon('minus', 10))); });
    const slotsN = Math.max(10, Math.ceil((chosen.length + 1) / 5) * 5);
    if (chosen.length < slotsN) pockets.push(h('button', { class: 'wt-pk add' + (chosen.length ? '' : ' pk-empty'), type: 'button', disabled: used >= cap && chosen.length > 0, onClick: openPack, 'aria-label': t('pack.choose') },
      DK.icon('plus', 14), h('span', null, chosen.length ? t('wt.add') : t('pack.choose'))));
    while (pockets.length < slotsN) pockets.push(h('div', { class: 'wt-pk' }));
    return h('section', { class: 'wt-panel wt-bag' },
      h('div', { class: 'wt-bag-h' }, ring,
        h('div', { class: 'wt-bag-t' }, h('span', { class: 'wt-h-t' }, t('pack.backpack')), h('small', null, t('wt.bagSub'))),
        h('div', { class: 'wt-tools' },
          h('button', { class: 'wt-tool acc', type: 'button', tip: t('pack.suggest'), onClick: () => { params.pack = E.suggestPack(); DK.audio.sfx('select'); refresh(); } }, DK.icon('sparkles', 12), t('pack.suggestShort')),
          Object.keys(last).length ? h('button', { class: 'wt-tool', type: 'button', tip: t('pack.repeat'), onClick: () => { params.pack = Object.assign({}, last); DK.audio.sfx('select'); refresh(); } }, DK.icon('repeat', 12), t('wt.repeat')) : null,
          chosen.length ? h('button', { class: 'wt-tool', type: 'button', tip: t('pack.clear'), onClick: () => { params.pack = {}; refresh(); } }, t('pack.clearShort')) : null)),
      h('div', { class: 'wt-pockets' }, pockets),
      Object.keys(home).length ? null : h('small', { class: 'muted' }, t('wt.noItems')));
  }

  /** Barra de embarque: zona, insignias, iconos (con su explicación al pasar el ratón) y «Partir». */
  function launchBar(n, pv, params, go, ok) {
    const E = DK.expedition, z = D.zones[pv.zone], team = DK.party.active(), used = E.packSize(params.pack), cap = E.packCapacity();
    const abyss = pv.kind === 'abismo', averno = DK.averno.isZone(pv.zone);
    const cur = E.kindDef(pv.kind), cor = n.corruption || 0, nm = n.nightmare && n.nightmare === n.zone;
    const problems = DK.world.warnings(pv.zone).filter((w) => w.kind !== 'good');
    const healCost = E.healCost(team);
    const ic = (icon, txt, cls, tip, onClick) => h(onClick ? 'button' : 'span', { class: 'wt-li ' + (cls || ''), tip, 'aria-label': tip, type: onClick ? 'button' : null, onClick }, DK.icon(icon, 13), txt != null ? h('em', null, txt) : null);
    const icons = [
      ic('bag', `${used}/${cap}`, used >= cap ? 'w' : '', t('wt.icBag')),
      ic('paw', String(team.length), '', t('wt.icTeam')),
      healCost ? ic('coin', healCost.toLocaleString(DK.i18n.lang), '', t('wt.icHeal', { n: healCost.toLocaleString(DK.i18n.lang) })) : null,
      ...problems.map((w) => ic(w.icon, null, w.kind === 'bad' ? 'd' : 'w', w.text, w.action === 'heal' ? async () => { if (await V.healDialog(team)) DK.router.refresh(); } : null)),
      DK.rules.permadeath() ? ic('skull', null, 'd', t('zones.permadeath')) : null,
      DK.store.state.consolation ? ic('crown', null, 's', t('pack.consolation')) : null,
      DK.camp.value('provisiones') ? ic('flask', '+' + DK.camp.value('provisiones'), 's', t('pack.free', { n: DK.camp.value('provisiones') })) : null,
      DK.rules.keepPack() ? ic('shield', null, 's', t('pack.riskKeep') + ' ' + t('exp.exitRuleTip')) : ic('info', null, 'w', t('pack.risk') + ' ' + t('exp.exitRuleTip')),
    ].filter(Boolean);
    const summary = [averno ? t('averno.title') : t('kind.' + cur.id + '.name'), cor ? t('corruption.short', { n: ROMAN[cor - 1] }) : null, nm ? t('nightmare.title') : null].filter(Boolean).join(' · ');
    return h('section', { class: 'wt-launch bt-prep-foot' },
      h('div', { class: 'wt-launch-info' },
        h('div', { class: 'wt-route' }, h('span', { class: 'wt-route-z', style: { '--z1': z.colors[0] } }, DK.icon(z.icon, 13)), h('b', null, abyss ? t('abyss.title') : z.name),
          averno ? null : h('span', { class: 'wt-badge k', tip: t('kind.' + cur.id + '.name') }, DK.icon(cur.icon, 11)),
          cor ? h('span', { class: 'wt-badge c', tip: t('corruption.levelN', { n: cor }) }, ROMAN[cor - 1]) : null,
          nm ? h('span', { class: 'wt-badge c', tip: t('nightmare.title') }, DK.icon('demon', 11)) : null),
        h('div', { class: 'wt-icons' }, icons)),
      h('button', { class: 'wt-go bt-go play-btn', type: 'button', disabled: !ok, tip: summary, 'aria-label': `${t('wt.go')} · ${summary}`, onClick: go },
        h('span', { class: 'wt-go-ar' }, DK.icon('next', 14)), h('b', null, averno ? t('wt.goAverno') : abyss ? t('wt.goAbyss') : t('wt.go')), h('kbd', null, '↵')));
  }

  /** La mesa de guerra entera. */
  function warTable(params, refresh) {
    const E = DK.expedition, n = E.nextStart(), pv = E.preview();
    const ok = DK.party.aliveActive().length > 0;
    params.pack = params.pack || {};
    const go = () => { if (!ok) return; E.start(params.pack); params.pack = {}; DK.audio.sfx('select'); DK.router.reset('expedition'); };
    if (offEnter) offEnter(); offEnter = DK.keys.on('Enter', go); // (sólo uno, aunque se redibuje)
    return h('div', { class: 'wt bt-prep' },
      h('div', { class: 'wt-left' }, destCard(n, pv, refresh), contractCard(params)),
      h('div', { class: 'wt-right' }, runesRow(refresh), rulesBox(refresh), formationBox(refresh), bagBox(params, refresh), launchBar(n, pv, params, go, ok)));
  }

  /** Tabla de récords local: intentos de esta semana y mejores de las anteriores. */
  function weeklyBoard() {
    const W = DK.weekly, board = W.board(), past = W.past();
    const when = (ts) => new Date(ts).toLocaleDateString(DK.i18n.lang, { weekday: 'short', day: 'numeric', month: 'short' });
    DK.ui.modal({ title: t('weekly.boardTitle', { n: W.weekNo() }), icon: 'trophy', cls: 'wk-modal', content: () => h('div', { class: 'stack' },
      board.length ? h('ol', { class: 'wk-board' }, board.map((r, i) => h('li', { class: i === 0 ? 'top' : '' },
        h('span', { class: 'wk-pos' }, i + 1), h('b', null, r.score.toLocaleString(DK.i18n.lang)),
        h('span', { class: 'muted small' }, t('weekly.runInfo', { f: r.floors, d: r.depth })),
        h('span', { class: 'chip ' + (r.outcome === 'completed' ? 'pos' : r.outcome.startsWith('lost') ? 'neg' : '') }, t('weekly.out.' + (r.outcome.startsWith('lost') ? 'lost' : r.outcome === 'completed' ? 'won' : 'left'))),
        h('span', { class: 'muted small' }, when(r.at)))))
        : h('p', { class: 'muted' }, t('weekly.noRuns')),
      past.length ? h('div', { class: 'stack-s' }, h('span', { class: 'bt-label' }, t('weekly.past')),
        h('div', { class: 'chips' }, past.map((p) => h('span', { class: 'chip' }, DK.icon('trophy', 12), t('weekly.pastItem', { n: p.week, s: p.best.toLocaleString(DK.i18n.lang) }))))) : null,
      h('p', { class: 'muted small' }, t('weekly.scoring'))) });
  }

  /**
   * Elegir qué runa engastar: AGRUPADAS POR TIER (III → I), con un filtro por
   * clase (tamaño, tipo, bonificación). Dentro de cada tier, las raras
   * primero. Cada ficha enseña su rareza, efecto y modificadores.
   */
  function runePicker(refresh) {
    const ord = { r: 0, m: 1, n: 2 }, gOrd = { size: 0, kind: 1, bonus: 2 };
    let filter = 'all';
    const tile = (id, close) => {
      const r = DK.runes.get(id), free = DK.runes.free(id), locked = DK.runes.locked(id), ok = DK.runes.canSocket(id);
      const sel = DK.runes.selected(), swap = r.group !== 'bonus' && sel[r.group];
      return h('button', { class: 'rune-pick ' + V.runeRarity(id) + (ok ? '' : ' off'), type: 'button', disabled: !ok, style: { '--rc': look(id)[0] },
        tip: locked ? t('rune.locked') : swap && ok ? t('rune.swap', { name: V.runeName(sel[r.group]) }) : null,
        onClick: () => { if (DK.runes.socket(id)) { DK.audio.sfx('thud'); DK.vibrate(25); close(); refresh(); setTimeout(() => { const s = document.querySelectorAll('.rune-socket.full'); const el = s[s.length - 1]; if (el) { el.classList.add('just-set'); setTimeout(() => el.classList.remove('just-set'), 500); } }, 30); } } },
        V.runeGem(id, 44, { dim: !free }),
        h('span', { class: 'rune-pick-text' },
          h('b', null, V.runeName(id)),
          h('span', { class: 'rune-pick-meta' }, h('i', { class: 'rr-dot' }), t('rune.rar.' + r.rarity), ' · ', t('rune.' + r.group)),
          h('small', null, V.runeEffect(id)),
          V.runeAffixes(id).map((x) => h('small', { class: 'rune-aff' }, x))),
        h('span', { class: 'rune-pick-n' }, locked ? DK.icon('lock', 12) : '×' + Math.max(0, free)));
    };
    // v5.44: filtro por clase y, dentro, por runa concreta (p. ej. Tamaño → Pequeño · Mediano · XL)
    let sub = 'all';
    const GROUPS = [['all', 'rune.allGroups', 'rune'], ['size', 'rune.size', 'map'], ['kind', 'rune.kind', 'flag'], ['bonus', 'rune.bonus', 'coin']];
    DK.ui.modal({ title: t('rune.title'), icon: 'rune', cls: 'rune-modal rp2', size: 'wide', content: (close) => {
      const host = h('div', { class: 'rp' });
      const have = () => Object.keys(DK.runes.all()).filter((id) => DK.runes.count(id) > 0 && DK.runes.get(id));
      const n = (list) => list.reduce((a, id) => a + DK.runes.count(id), 0);
      const draw = () => {
        const all = have();
        const inGroup = all.filter((id) => filter === 'all' || DK.runes.get(id).group === filter);
        const ids = inGroup.filter((id) => sub === 'all' || DK.runes.parse(id).base === sub);
        const groups = h('div', { class: 'rp-groups', role: 'tablist' }, GROUPS.map(([g, key, ic]) => { const c = n(all.filter((id) => g === 'all' || DK.runes.get(id).group === g));
          return h('button', { class: 'rp-g' + (g === filter ? ' on' : ''), type: 'button', role: 'tab', disabled: !c && g !== 'all', onClick: () => { filter = g; sub = 'all'; draw(); } }, DK.icon(ic, 14), h('span', null, t(key)), h('i', null, String(c))); }));
        // runas concretas de la clase elegida (con las que tienes de cada una)
        const bases = filter === 'all' ? [] : DK.runes.defs(filter).filter((d) => !d.late || DK.corruption.visible() || inGroup.some((id) => DK.runes.parse(id).base === d.id)).map((d) => d.id);
        const subs = bases.length ? h('div', { class: 'rp-subs' },
          h('button', { class: 'rp-s' + (sub === 'all' ? ' on' : ''), type: 'button', onClick: () => { sub = 'all'; draw(); } }, t('rune.allGroups'), h('i', null, String(n(inGroup)))),
          bases.map((b) => { const c = n(inGroup.filter((id) => DK.runes.parse(id).base === b)), def = DK.runes.defs(filter).find((d) => d.id === b);
            return h('button', { class: 'rp-s' + (sub === b ? ' on' : '') + (c ? '' : ' none'), type: 'button', disabled: !c, onClick: () => { sub = b; draw(); } }, DK.icon(def.icon, 12), t('wt.sub.' + b), h('i', null, String(c))); })) : null;
        host.replaceChildren(
          h('div', { class: 'rp-top' }, groups, h('small', { class: 'muted rp-help' }, t('rune.pickHelp2'))),
          subs,
          h('div', { class: 'rp-list' },
            ...[3, 2, 1].map((tier) => {
              const list = ids.filter((id) => DK.runes.parse(id).tier === tier).sort((a, b) => ord[DK.runes.parse(a).rarity] - ord[DK.runes.parse(b).rarity] || gOrd[DK.runes.get(a).group] - gOrd[DK.runes.get(b).group]);
              if (!list.length) return null;
              return h('div', { class: 'rune-tier-group t' + tier }, h('span', { class: 'rp-tier' }, t('rune.tierN', { n: ['I', 'II', 'III'][tier - 1] }), h('i', null, String(n(list)))),
                h('div', { class: 'rune-pick-grid' }, list.map((id) => tile(id, close))));
            }).filter(Boolean),
            ids.length ? null : h('div', { class: 'rp-empty' }, DK.icon('rune', 26), h('p', { class: 'muted' }, all.length ? t('wt.runeNoneFilter') : t('rune.none')))));
      };
      draw();
      return host;
    } });
  }

  /* ---------------- Mapa del mundo ----------------
   * Un camino en pixel art que une las zonas desbloqueadas; después, la
   * siguiente como «???» (con la pista para abrirla) y el resto como «+N».
   * Tu líder espera sobre la zona elegida. */
  const STEP = 168, MAP_H = 262, PAD = 90;
  const yAt = (i) => [172, 108, 180, 102, 164, 112][i % 6];

  function worldMap(sel, choose) {
    const rec = DK.world.recommended();
    const exp = DK.expedition.active();
    // La zona secreta final no se ve hasta que se abre (DK.endgame.checkFinalZone)
    const all = Object.values(D.zones).filter((z) => !z.secretZone || DK.world.isUnlocked(z.id));
    const unlocked = all.filter((z) => DK.world.isUnlocked(z.id));
    const next = all.find((z) => !DK.world.isUnlocked(z.id));
    const hidden = all.filter((z) => !DK.world.isUnlocked(z.id) && z !== next).length;
    const stops = unlocked.map((z) => ({ z })).concat(next ? [{ z: next, locked: true }] : [], hidden ? [{ more: hidden }] : []);
    const W = PAD * 2 + STEP * (stops.length - 1);
    const pts = stops.map((s, i) => [PAD + i * STEP, yAt(i)]);

    // v5.27: el terreno es una ilustración en pixel art (components/worldArt.js): un bioma por zona, con transiciones
    // tramadas, árboles, rocas, agua, lava, ruinas… con sombra, y niebla en lo que aún no conoces. Se dibuja SIDE px
    // más allá de cada extremo porque el mapa puede ser más ancho que el recorrido.
    const SIDE = 700;
    const cx = (x) => `calc(50% + ${Math.round(x - W / 2)}px)`;
    const art = h('span', { class: 'wm2-art', style: { left: cx(-SIDE), width: (W + SIDE * 2) + 'px', height: MAP_H + 'px',
      backgroundImage: `url(${DK.worldArt.render({ stops: stops.map((s) => (s.z && !s.locked ? { scene: s.z.scene, colors: s.z.colors } : { fog: true })), pts, W, H: MAP_H, SIDE, STEP, PAD })})` } });
    const regions = [art];

    // Camino: curvas suaves entre paradas (de tierra hasta la última conocida, de puntos después)
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'wm2-road'); svg.setAttribute('width', W); svg.setAttribute('height', MAP_H); svg.setAttribute('aria-hidden', 'true');
    svg.style.left = cx(0);
    const seg = (a, b) => { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; };
    pts.slice(1).forEach((b, i) => {
      const lockedSeg = !!(stops[i + 1].locked || stops[i + 1].more);
      ['edge', 'fill', 'dash'].forEach((k) => {
        if (lockedSeg && k === 'dash') return;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', seg(pts[i], b)); path.setAttribute('class', 'r-' + k + (lockedSeg ? ' locked' : ''));
        svg.appendChild(path);
      });
    });

    const decor = []; // v5.27: los adornos ya van dibujados en la ilustración

    // Paradas
    const leader = DK.party.active()[0];
    const start = exp ? null : DK.expedition.nextStart().zone;
    const nodes = stops.map((s, i) => {
      const [x, y] = pts[i];
      const pos = { left: cx(x), top: y + 'px' };
      if (s.more) return h('div', { class: 'wm2-node more', style: pos, tip: t('zones.moreHidden', { n: s.more }) },
        h('span', { class: 'wm2-pin' }, h('b', null, '+' + s.more)), h('span', { class: 'wm2-label' }, h('b', null, t('zones.moreShort'))));
      const z = s.z;
      if (s.locked) {
        const hint = t('zones.unlockHint2', { zone: D.zones[z.unlock] ? D.zones[z.unlock].name : t('zones.previous') });
        return h('div', { class: 'wm2-node locked', style: pos, tip: hint },
          h('span', { class: 'wm2-pin' }, DK.icon('lock', 22)),
          h('span', { class: 'wm2-label' }, h('b', null, '???'), h('small', null, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)));
      }
      const bossDone = DK.world.boss(z.id).defeated > 0, isSel = sel && sel.id === z.id;
      const isRec = rec && rec.id === z.id, here = exp && exp.zone === z.id;
      return h('button', { class: 'wm2-node' + (isSel ? ' selected' : '') + (bossDone ? ' done' : ''), type: 'button', style: { ...pos, '--z1': z.colors[0], '--z2': z.colors[1] },
        'aria-pressed': String(!!isSel), 'aria-label': z.name, onClick: () => { DK.audio.sfx('select'); choose(z); } },
        isSel && leader ? h('span', { class: 'wm2-leader', 'aria-hidden': 'true' }, V.dSprite(leader, { size: 46 })) : null,
        h('span', { class: 'wm2-pin' }, DK.icon(z.icon, 24), bossDone ? h('span', { class: 'wm2-crown', tip: t('zones.bossDone') }, DK.icon('crown', 12)) : null),
        h('span', { class: 'wm2-label' }, h('b', null, z.name), h('small', null, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)),
        here ? h('span', { class: 'wm2-tag exp' }, DK.icon('flag', 11), t('zones.inExpedition'))
          : !exp && start === z.id ? h('span', { class: 'wm2-tag start' }, DK.icon('flag', 11), t('zones.startTag'))
          : isRec ? h('span', { class: 'wm2-tag' }, DK.icon('star', 11), t('zones.recommended')) : null);
    });

    const map = h('div', { class: 'wm2-map', style: { width: W + 'px', height: MAP_H + 'px' } }, regions, svg, decor, nodes);
    const scroll = h('div', { class: 'wm2-scroll' }, map);
    // Centra la zona elegida (sólo se desplaza la caja del mapa)
    setTimeout(() => {
      const i = stops.findIndex((s) => s.z && sel && s.z.id === sel.id);
      if (i >= 0 && scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft = Math.max(0, pts[i][0] - scroll.clientWidth / 2);
    }, 0);
    return h('section', { class: 'card wm2-card' },
      h('div', { class: 'panel-head' }, DK.icon('map', 18), h('h3', null, t('zones.worldMap')),
        h('span', { class: 'wm2-count' }, DK.icon('flag', 12), t('zones.unlockedN', { n: unlocked.length, total: all.length })),
        h('span', { class: 'muted small wm2-help' }, t('zones.pickHint'))),
      scroll);
  }

  DK.screens.register('zones', {
    title: () => t('zones.title'), icon: 'map', section: 'battle', tutorial: 'zones', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      const rec = DK.world.recommended();
      const exp = DK.expedition.active();
      // La zona elegida en el mapa es donde empieza la próxima expedición (DK.expedition.setStart)
      if (!params.zone || !DK.world.isUnlocked(params.zone)) params.zone = exp ? exp.zone : DK.expedition.nextStart().zone;
      else if (!exp) DK.expedition.setStart({ zone: params.zone });
      const sel = D.zones[params.zone];
      const unlocked = Object.values(D.zones).filter((z) => DK.world.isUnlocked(z.id));

      const choose = (z) => {
        params.zone = z.id;
        if (!exp) DK.expedition.setStart({ zone: z.id });
        refresh();
        // En el móvil la ficha queda debajo del mapa: se lleva a la vista
        if (DK.ui.isNarrow()) setTimeout(() => { const c = document.querySelector('.bt-prep'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      };
      const step = (dir) => { const i = unlocked.findIndex((z) => z.id === params.zone); const z = unlocked[(i + dir + unlocked.length) % unlocked.length]; if (z) { DK.audio.sfx('select'); choose(z); } };
      DK.keys.on('ArrowLeft', () => step(-1)); DK.keys.on('ArrowRight', () => step(1));
      if (exp) {
        // (durante una expedición esta pantalla no se abre: el router lleva al mapa)
        DK.keys.on('Enter', () => DK.play.quick());
        return h('div', { class: 'screen zones-screen bt-screen' }, expeditionHero(refresh), worldMap(sel, choose), sel ? zoneCard(sel) : null);
      }
      // La preparación se redibuja SOLA (runas, pesadilla, corrupción, mochila…) para que
      // el mapa del mundo y el resto de la página no parpadeen al tocarla.
      const prepHost = h('div', { class: 'bt-prep-host wt-host' });
      const redrawPrep = () => { const y = window.scrollY; prepHost.replaceChildren(warTable(params, redrawPrep)); window.scrollTo(0, y); };
      redrawPrep();
      return h('div', { class: 'screen zones-screen bt-screen wt-screen' }, worldMap(sel, choose), prepHost);
    },
  });
})();
