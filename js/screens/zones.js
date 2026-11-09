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

  /* ---------------- Preparar la expedición (en la misma pantalla) ----------------
   * Todo lo necesario para salir, sin abrumar:
   *   - la zona de inicio (la elegida en el mapa) con sus datos en chips,
   *   - el tipo de expedición (sale al azar; las Mejoras «Rumbo» suben uno),
   *   - tu equipo (retratos con su vida) y la mochila (objetos en chips;
   *     «Elegir objetos» abre el editor completo en un panel deslizante),
   *   - avisos en una línea y el botón «Partir».
   */
  function prepCard(params, refresh) {
    const E = DK.expedition;
    const pv = E.preview(), z = D.zones[pv.zone];
    const team = DK.party.active();
    const ok = DK.party.aliveActive().length > 0;
    params.pack = params.pack || {};
    const pack = params.pack, cap = E.packCapacity(), used = E.packSize(pack);
    const go = () => { if (!ok) return; E.start(pack); params.pack = {}; DK.audio.sfx('select'); DK.router.reset('expedition'); };
    DK.keys.on('Enter', go);
    const lvBonus = E.levelBonus(1) + ((pv.mod && D.mapMods[pv.mod].levels) || 0);
    const best = E.bestDepth();

    // Tipo de expedición: sale al azar salvo que pongas una runa de tipo (DK.runes)
    const cur = E.kindDef(pv.kind), chances = E.kindChances(), sel = DK.runes.selected();
    const kindBox = h('div', { class: 'bt-kind k-' + cur.id },
      h('span', { class: 'bt-kind-icon' }, DK.icon(cur.icon, 24)),
      h('div', { class: 'bt-kind-text' },
        h('span', { class: 'bt-label' }, t('kind.rolled'), sel.kind ? h('span', { class: 'bt-rune-tag' }, DK.icon('rune', 11), t('kind.byRune')) : null),
        h('b', { tip: t('kind.' + cur.id + '.desc') }, t('kind.' + cur.id + '.name')),
        h('span', { class: 'chips' }, V.kindEffects(cur))),
      sel.kind ? null : h('div', { class: 'bt-kind-odds', tip: t('kind.chancesHint'), 'aria-label': t('kind.chances') },
        E.kinds().map((k) => h('span', { class: 'bt-odd k-' + k.id + (k.id === cur.id ? ' on' : '') + (k.locked ? ' locked' : ''), tip: k.locked ? t('kind.locked') : `${t('kind.' + k.id + '.name')} · ${Math.round((chances[k.id] || 0) * 100)}%` },
          DK.icon(k.locked ? 'lock' : k.icon, 13), h('small', null, k.locked ? '—' : Math.round((chances[k.id] || 0) * 100) + '%')))));

    // Runas: 4 huecos; pulsa uno vacío para engastar una runa, uno lleno para quitarla
    const slots = DK.runes.slots(), N = DK.runes.slotCount();
    const sockets = Array.from({ length: N }, (_, i) => {
      const id = slots[i];
      if (!id) return h('button', { class: 'rune-socket empty', type: 'button', 'aria-label': t('rune.add'), tip: DK.runes.total() ? t('rune.add') : t('rune.none'),
        onClick: () => runePicker(refresh) }, h('span', { class: 'rune-socket-ring' }, DK.icon('plus', 11)));
      return h('button', { class: 'rune-socket full g-' + DK.runes.get(id).group, type: 'button', style: { '--rc': look(id)[0] }, 'aria-label': t('rune.remove', { name: V.runeName(id) }),
        tip: `${V.runeTip(id)} · ${t('rune.tapOff')}`,
        onClick: () => { DK.runes.unsocket(i); DK.audio.sfx('click'); refresh(); } },
        h('span', { class: 'rune-socket-ring' }, V.runeGem(id, 28)), h('span', { class: 'rune-socket-x' }, DK.icon('x', 10)));
    });
    // Sin la mejora «Taller de runas» no hay huecos (se compra con emblemas tras el primer jefe)
    const runeBox = !DK.runes.enabled() ? null : h('div', { class: 'bt-runes' },
      h('div', { class: 'bt-runes-text' },
        h('span', { class: 'bt-label' }, t('rune.title')),
        slots.length ? h('span', { class: 'small muted' }, slots.map(V.runeEffect).join(' · ')) : null, // v5.2: sin «Al azar»
        h('button', { class: 'bt-runes-help', type: 'button', tip: t('rune.help'), 'aria-label': t('rune.help'), onClick: () => DK.ui.toast(t('rune.help'), { icon: 'info' }) }, DK.icon('info', 12), ' ', t('rune.have', { n: DK.runes.total() }))),
      h('div', { class: 'rune-sockets' }, sockets));

    // Final del juego: Abismo, Corrupción, versión pesadilla y reliquias grabadas
    const lateBox = endgameBox(refresh);

    // Equipo (v4.98): dos columnas de tres con lo justo (dibujo, nombre, nivel y vida); al pulsar uno sale
    // su ficha rápida, la misma que en la hoguera del campamento
    const teamStrip = h('div', { class: 'bt-team bt-team6' }, Array.from({ length: DK.config.maxTeam }, (_, i) => {
      const d = team[i];
      if (!d) return h('button', { class: 'bt-mon empty', type: 'button', tip: t('home.manage'), 'aria-label': t('home.manage'), onClick: () => DK.router.go('team') }, DK.icon('plus', 16));
      const s = DK.daskai.stats(d), hp = DK.util.percent(d.cur.hp, s.hp);
      return h('button', { class: 'bt-mon' + V.frameCls(d) + (DK.daskai.isFainted(d) ? ' ko' : ''), type: 'button', tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level} · ${d.cur.hp}/${s.hp}`,
        onClick: () => { DK.audio.sfx('select'); V.quickStats(d, { onChange: refresh }); } },
        i === 0 ? h('span', { class: 'bt-mon-lead', tip: t('pack.lead') }, DK.icon('crown', 10)) : null,
        h('span', { class: 'bt-mon-spr' }, V.dSprite(d, { size: 48 })),
        h('span', { class: 'bt-mon-info' },
          h('span', { class: 'bt-mon-name' }, h('b', null, DK.daskai.name(d))),
          h('span', { class: 'bt-mon-hp' + (hp < 30 ? ' crit' : hp < 60 ? ' mid' : '') }, h('i', { style: { width: hp + '%' } })),
          h('small', { class: 'bt-mon-num' }, h('span', { class: 'bt-mon-lv' }, `${t('common.lvl')} ${d.level}`), ` · ${d.cur.hp}/${s.hp}`)));
    }));

    // Mochila (v4.98): lista que ocupa siempre lo mismo que el equipo (con scroll si hay muchos objetos):
    // icono, nombre, efecto y «− ×N +»; vacía, una zona grande para elegir objetos.
    const chosen = Object.keys(pack).filter((id) => pack[id] > 0);
    const last = V.lastPack();
    const openPack = () => { V.packModal(params, null).promise.then(() => refresh()); }; // v5.2: ventana centrada (antes un panel a la derecha)
    const home = DK.bag.home();
    const step = (id, n) => {
      const cur = pack[id] || 0, k = Math.max(0, Math.min(cur + n, home[id] || 0, cur + cap - used));
      if (k === cur) { if (n > 0) { DK.audio.sfx('error'); DK.ui.toast(used >= cap ? t('pack.full') : t('pack.noMore'), { icon: 'bag', kind: 'bad' }); } return; }
      if (k) pack[id] = k; else delete pack[id];
      DK.audio.sfx('select'); refresh();
    };
    const effect = (it) => (it.use ? V.useText(it) : it.desc) || '';
    const packTiles = h('div', { class: 'pk-list-wrap' }, chosen.length ? h('div', { class: 'pk-list' },
      chosen.map((id) => { const it = D.items[id]; return h('div', { class: 'pk-row r-' + it.rarity, tip: `${it.name} · ${effect(it)}` },
        h('span', { class: 'pk-row-ico' }, V.itemIcon(it, 20)),
        h('span', { class: 'pk-row-txt' }, h('b', null, it.name), h('small', null, effect(it))),
        h('span', { class: 'pk-row-n' },
          h('button', { class: 'pk-row-b', type: 'button', 'aria-label': t('pack.tapRemove', { name: it.name }), onClick: () => step(id, -1) }, DK.icon('minus', 12)),
          h('b', null, '×' + pack[id]),
          h('button', { class: 'pk-row-b', type: 'button', 'aria-label': t('pack.addOne', { name: it.name }), disabled: used >= cap || (home[id] || 0) <= pack[id], onClick: () => step(id, 1) }, DK.icon('plus', 12)))); }),
      h('button', { class: 'pk-row add', type: 'button', onClick: openPack }, DK.icon('plus', 14), h('span', null, t('pack.addMore'))))
      : h('button', { class: 'pk-empty', type: 'button', onClick: openPack }, DK.icon('bag', 28), h('b', null, t('pack.choose')), h('small', null, t('pack.emptyHint', { n: cap }))));
    const packTools = h('div', { class: 'pk-tools' },
      btn({ icon: 'sparkles', label: t('pack.suggestShort'), size: 'sm', variant: 'ghost', tip: t('pack.suggest'), onClick: () => { params.pack = E.suggestPack(); DK.audio.sfx('select'); refresh(); } }),
      Object.keys(last).length ? btn({ icon: 'repeat', label: t('pack.repeatShort'), size: 'sm', variant: 'ghost', tip: t('pack.repeat'), onClick: () => { params.pack = Object.assign({}, last); DK.audio.sfx('select'); refresh(); } }) : null,
      chosen.length ? btn({ icon: 'x', label: t('pack.clearShort'), size: 'sm', variant: 'ghost', tip: t('pack.clear'), onClick: () => { params.pack = {}; refresh(); } }) : null);

    const notes = [
      DK.rules.permadeath() ? h('span', { class: 'chip neg', tip: t('zones.permadeath') }, DK.icon('skull', 12), t('zones.hardMode')) : null,
      DK.store.state.consolation ? h('span', { class: 'chip pos', tip: t('pack.consolation') }, DK.icon('crown', 12), t('pack.consolationShort')) : null,
      DK.camp.value('provisiones') ? h('span', { class: 'chip pos', tip: t('pack.free', { n: DK.camp.value('provisiones') }) }, DK.icon('flask', 12), '+' + DK.camp.value('provisiones')) : null,
      h('span', { class: 'chip', tip: t('brief.unlocksTip', { r: DK.camp.unlocked('relic').length, c: DK.camp.unlocked('curse').length }) }, DK.icon('amulet', 12), `${DK.camp.unlocked('relic').length} · ${DK.camp.unlocked('curse').length}`),
      DK.rules.keepPack() ? h('span', { class: 'chip pos', tip: t('pack.riskKeep') + ' ' + t('exp.exitRuleTip') }, DK.icon('bag', 12), t('pack.riskKeepShort'))
        : h('span', { class: 'chip neg', tip: t('pack.risk') + ' ' + t('exp.exitRuleTip') }, DK.icon('info', 12), t('pack.riskShort')),
    ].filter(Boolean);
    const problems = DK.world.warnings(pv.zone).filter((w) => w.kind !== 'good');

    return h('section', { class: 'card bt-prep', style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'bt-prep-head' },
        h('span', { class: 'bt-prep-icon' }, DK.icon(z.icon, 22)),
        h('div', { class: 'grow' }, h('span', { class: 'bt-kicker' }, DK.icon('compass', 12), t('zones.heroNew')), h('h2', null, z.name)),
        V.emblems(DK.camp.emblems())),
      h('div', { class: 'chips bt-facts' },
        V.sizeChip(pv.size),
        h('span', { class: 'chip', tip: t('brief.levelsTip') }, DK.icon('star', 13), `${t('brief.levels')} ${t('common.lvl')} ${z.levels[0] + lvBonus}-${z.levels[1] + lvBonus}`),
        V.modChip(pv.mod),
        h('span', { class: 'chip pos', tip: t('brief.rewardTip') }, DK.icon('crown', 13), t('brief.rewardValue', { n: E.bossEmblems(pv.size, pv.kind) })),
        best ? h('span', { class: 'chip' }, DK.icon('trophy', 13), t('exp.best', { n: best })) : null),
      kindBox,
      runeBox,
      lateBox,
      h('div', { class: 'bt-prep-grid' },
        h('div', { class: 'bt-block' },
          h('div', { class: 'bt-label-row' }, h('span', { class: 'bt-label' }, t('pack.team'), ` ${team.length}/${DK.config.maxTeam}`),
            h('span', { class: 'grow' }),
            h('button', { class: 'icon-btn bt-icon', type: 'button', tip: t('heal.button'), 'aria-label': t('heal.button'), onClick: async () => { if (await V.healDialog(team)) refresh(); } }, DK.icon('flask', 16)),
            // Curar pagando monedas (caro): sólo si a alguien le falta vida o maná
            (() => {
              const c = E.healCost(team); if (!c) return null;
              const poor = DK.wallet.get() < c;
              return h('button', { class: 'bt-heal-coins' + (poor ? ' poor' : ''), type: 'button', disabled: poor, tip: poor ? t('healPay.poor', { n: c - DK.wallet.get() }) : t('healPay.tip'),
                onClick: async () => {
                  if (!(await DK.ui.confirm(t('healPay.title'), t('healPay.text', { n: c.toLocaleString(DK.i18n.lang) }), { okLabel: t('healPay.ok', { n: c.toLocaleString(DK.i18n.lang) }) }))) return;
                  if (E.healPaid(team)) { DK.audio.sfx('heal'); DK.ui.toast(t('healPay.done', { n: c.toLocaleString(DK.i18n.lang) }), { icon: 'heart', kind: 'good' }); DK.app.renderRes && DK.app.renderRes(); refresh(); }
                } }, DK.icon('heart', 13), DK.icon('coin', 12), c.toLocaleString(DK.i18n.lang));
            })(),
            h('button', { class: 'icon-btn bt-icon', type: 'button', tip: t('home.manage'), 'aria-label': t('home.manage'), onClick: () => DK.router.go('team') }, DK.icon('edit', 16))),
          teamStrip),
        h('div', { class: 'bt-block' },
          h('div', { class: 'bt-label-row' }, h('span', { class: 'bt-label' }, t('pack.backpack')), h('span', { class: 'grow' }),
            h('span', { class: 'pk-count' + (used >= cap ? ' full' : ''), tip: t('pack.capTip') }, h('b', null, used), '/' + cap)),
          h('div', { class: 'cap-bar' + (used >= cap ? ' full' : ''), style: { '--p': Math.min(100, (used / cap) * 100) + '%' } }, h('span')),
          packTiles,
          packTools)),
      problems.length ? V.warnings(problems, async () => { if (await V.healDialog(team)) refresh(); }) : null,
      h('div', { class: 'bt-prep-foot' }, h('div', { class: 'chips' }, notes),
        btn({ icon: 'flag', label: t('pack.go'), desc: t('pack.goDesc', { n: used }), size: 'lg', variant: 'primary', hotkey: '↵', disabled: !ok, cls: 'bt-go play-btn', onClick: go })));
  }

  /* ---------------- Desafío semanal (DK.weekly) ---------------- */
  /** Tarjeta compacta: el mapa fijo de la semana, sus pactos, tu récord y «Jugar». */
  function weeklyCard(params) {
    if (!DK.weekly.unlocked()) return null;
    const W = DK.weekly, w = W.def(), z = D.zones[w.zone], best = W.best(), tries = W.tries(), rw = W.reward();
    const go = () => {
      if (!DK.party.aliveActive().length) { DK.ui.toast(t('weekly.noTeam'), { icon: 'alert', kind: 'bad' }); return; }
      if (!W.start(params.pack || {})) return;
      params.pack = {}; DK.audio.sfx('select'); DK.router.reset('expedition');
    };
    return h('section', { class: 'card wk-card', style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'wk-head' },
        h('span', { class: 'wk-badge' }, DK.icon('trophy', 18)),
        h('div', { class: 'grow' },
          h('span', { class: 'bt-kicker' }, t('weekly.kicker', { n: w.week }), ' · ', t('weekly.left', { n: W.daysLeft() })),
          h('h3', null, t('weekly.title'))),
        h('div', { class: 'wk-best', tip: t('weekly.bestTip', { n: tries }) }, h('small', null, t('weekly.best')), h('b', null, best ? best.toLocaleString(DK.i18n.lang) : '—'))),
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, DK.icon(z.icon, 12), z.name),
        V.sizeChip(w.size), V.modChip(w.mod),
        h('span', { class: 'chip', tip: t('kind.' + w.kind + '.desc') }, DK.icon(DK.expedition.kindDef(w.kind).icon, 12), t('kind.' + w.kind + '.name')),
        w.curses.map((id) => h('span', { class: 'chip neg', tip: t('curse.' + id + '.desc') }, DK.icon(D.curses[id].icon, 12), t('curse.' + id + '.name')))),
      h('div', { class: 'wk-foot' },
        h('span', { class: 'small muted' }, W.rec().rewarded ? t('weekly.rewarded') : t('weekly.reward', { e: rw.emblems })),
        h('span', { class: 'grow' }),
        btn({ icon: 'list', label: t('weekly.board'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => weeklyBoard() }),
        btn({ icon: 'flag', label: t('weekly.play'), size: 'sm', variant: 'primary', onClick: go })));
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
   * Bloque del final del juego en la preparación (sólo lo que ya se ha abierto).
   * v4.60b: «Reglas de la aventura»: un panel con estilo de advertencia (rojo oscuro) y una fila
   * por regla: icono, nombre, qué hace y su control a la derecha; la activa brilla.
   */
  function endgameBox(refresh) {
    const E = DK.expedition, n = E.nextStart(), C = DK.corruption, G = D.endgame;
    const rows = [];
    const row = (kind, icon, title, desc, control, on, extra) => h('div', { class: 'egx-row k-' + kind + (on ? ' on' : '') },
      h('span', { class: 'egx-ico' }, DK.icon(icon, 18)),
      h('div', { class: 'egx-main' }, h('b', null, title), desc ? h('small', null, desc) : null),
      h('div', { class: 'egx-ctl' }, control),
      extra ? h('div', { class: 'egx-extra' }, extra) : null);
    // El Abismo (v5.1): boss rush de la zona elegida; enseña la serie de jefes con su nivel
    if (DK.abyss.unlocked()) {
      const can = DK.abyss.available(n.zone);
      if (n.kind === 'abismo' && !can) DK.abyss.set(false); // al cambiar a una zona sin su jefe vencido
      const on = n.kind === 'abismo' && can;
      const zr = DK.abyss.best(n.zone), rounds = DK.abyss.rounds(n.zone);
      const series = on ? h('div', { class: 'abx-series' },
        h('span', { class: 'abx-lbl' }, DK.icon('crown', 12), t('abyss.series'), rounds ? h('small', null, ' · ' + t('abyss.rounds', { n: rounds })) : h('small', { class: 'good-text' }, ' · ' + t('abyss.first'))),
        h('div', { class: 'abx-row' }, DK.abyss.series(n.zone).map((z, i, a) => { const b = D.zones[z].boss, last = i === a.length - 1;
          return h('div', { class: 'abx-boss' + (last ? ' last' : ''), tip: `${b.title} · ${t('abyss.seriesTip', { lv: DK.abyss.bossLevel(n.zone, i) + E.levelBonus(1), zone: D.zones[z].name })}` },
            h('span', { class: 'abx-n' }, i + 1), V.sprite(b.species, { size: 46 }), h('b', null, b.title), h('small', null, `${t('common.lvl')} ${DK.abyss.bossLevel(n.zone, i) + E.levelBonus(1)}`)); }))) : null;
      rows.push(row('abyss', 'moon', t('abyss.title'), can ? `${t('abyss.best', { n: zr })} · ${t('abyss.help')}` : t('abyss.locked'),
        h('div', { class: 'egx-seg' },
          h('button', { class: on ? '' : 'on', type: 'button', 'aria-pressed': String(!on), onClick: () => { DK.abyss.set(false); refresh(); } }, t('abyss.normal')),
          h('button', { class: on ? 'on' : '', type: 'button', disabled: !can, tip: can ? null : t('abyss.locked'), 'aria-pressed': String(on), onClick: () => { DK.abyss.set(true); DK.audio.sfx('select'); refresh(); } }, DK.icon(can ? 'moon' : 'lock', 12), t('abyss.enter'))), on, series));
    }
    // Corrupción: niveles 1-5 (se ven tras el jefe de la 3ª zona)
    if (C.visible()) {
      const cur = n.corruption || 0, max = C.max();
      const opt = (lv) => h('button', { class: (lv === cur ? 'on' : '') + (lv > max ? ' locked' : ''), type: 'button', disabled: lv > max, 'aria-pressed': String(lv === cur), tip: lv > max ? t('corruption.lockedTip', { n: lv - 1 }) : lv ? t('corruption.levelN', { n: lv }) : t('corruption.none'),
        onClick: () => { C.set(lv); DK.audio.sfx(lv ? 'select' : 'click'); refresh(); } }, lv > max ? DK.icon('lock', 11) : lv ? ['I', 'II', 'III', 'IV', 'V'][lv - 1] : '—');
      const def = C.def(cur);
      const rules = C.levels().slice(0, cur).map((l) => l.rule).filter(Boolean);
      const extra = def ? [
        h('div', { class: 'egx-list bad' }, h('span', { class: 'egx-k' }, DK.icon('alert', 12), t('endgameBox.harder')),
          h('span', null, t('corruption.foes', { lv: def.levels, n: Math.round(def.stat * 100) })), ...rules.map((r) => h('span', null, t('corruption.rule.' + r)))),
        h('div', { class: 'egx-list good' }, h('span', { class: 'egx-k' }, DK.icon('gift', 12), t('endgameBox.rewards')),
          h('span', null, DK.icon('emblem', 11), t('corruption.rewardEmblems', { n: def.emblems })), h('span', null, DK.icon('coin', 11), '+' + Math.round(def.coins * 100) + '%'),
          h('span', null, DK.icon('sparkles', 11), t('corruption.rewardShiny', { n: Math.round(def.shiny * 100) })), h('span', null, DK.icon('rune', 11), t('corruption.rewardTier', { n: Math.round(def.tier * 100) }))),
      ] : null;
      rows.push(row('cor', 'skull', t('corruption.title'), cur ? (cur === max && max < C.levels().length ? t('corruption.nextHint', { n: max + 1 }) : t('corruption.levelN', { n: cur })) : (max < C.levels().length ? t('corruption.help', { n: max }) : t('corruption.helpMax')),
        h('div', { class: 'egx-levels' }, (max > 0 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]).map(opt)), cur > 0, extra));
    }
    // Versión pesadilla de la zona (códice al 100%)
    if (DK.nightmare.available(n.zone) && n.kind !== 'abismo') {
      const on = n.nightmare === n.zone, N = G.nightmare;
      rows.push(row('nightmare', 'demon', t('nightmare.title'), t('nightmare.desc', { lv: N.levels, n: Math.round(N.stat * 100), c: Math.round(N.coins * 100), e: N.emblems }),
        h('button', { class: 'egx-switch' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(on), onClick: () => { DK.nightmare.toggle(); DK.audio.sfx('select'); refresh(); } },
          h('i'), h('span', null, on ? t('nightmare.on') : t('nightmare.off'))), on));
    }
    // Reliquias grabadas (salen siempre)
    const eng = DK.engrave.list();
    if (eng.length) rows.push(row('engrave', 'amulet', t('engrave.title'), null,
      h('div', { class: 'chips' }, eng.map((id) => h('span', { class: 'chip pos', tip: V.relicText ? V.relicText(D.relics[id]) : '' }, DK.icon(D.relics[id].icon, 12), D.relics[id].name))), false));
    if (!rows.length) return null;
    const hot = (n.corruption || 0) > 0 || n.kind === 'abismo' || (n.nightmare && n.nightmare === n.zone);
    // v4.62: sin título y sin rojo; discreto, con un filo dorado a la izquierda que se enciende si hay alguna activa
    return h('section', { class: 'egx' + (hot ? ' hot' : ''), 'aria-label': t('endgameBox.title'), tip: t('endgameBox.sub') }, rows);
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
    DK.ui.modal({ title: t('rune.title'), icon: 'rune', cls: 'rune-modal', content: (close) => {
      const host = h('div', { class: 'stack-s' });
      const draw = () => {
        const ids = Object.keys(DK.runes.all()).filter((id) => DK.runes.count(id) > 0 && DK.runes.get(id) && (filter === 'all' || DK.runes.get(id).group === filter));
        const seg = DK.ui.segmented({ value: filter, onChange: (v) => { filter = v; draw(); },
          options: [{ value: 'all', label: t('rune.allGroups') }, { value: 'size', label: t('rune.size'), icon: 'map' }, { value: 'kind', label: t('rune.kind'), icon: 'flag' }, { value: 'bonus', label: t('rune.bonus'), icon: 'coin' }] });
        host.replaceChildren(
          h('p', { class: 'muted small' }, t('rune.pickHelp2')),
          seg,
          ...[3, 2, 1].map((tier) => {
            const list = ids.filter((id) => DK.runes.parse(id).tier === tier).sort((a, b) => ord[DK.runes.parse(a).rarity] - ord[DK.runes.parse(b).rarity] || gOrd[DK.runes.get(a).group] - gOrd[DK.runes.get(b).group]);
            if (!list.length) return null;
            return h('div', { class: 'stack-s rune-tier-group t' + tier }, h('span', { class: 'bt-label' }, t('rune.tierN', { n: ['I', 'II', 'III'][tier - 1] }), h('span', { class: 'muted' }, ' · ' + list.reduce((a, id) => a + DK.runes.count(id), 0))),
              h('div', { class: 'rune-pick-grid' }, list.map((id) => tile(id, close))));
          }).filter(Boolean),
          ids.length ? null : h('p', { class: 'muted small' }, t('rune.none')));
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

    // Terreno: una franja por parada con los colores de su zona (gris si no se conoce)
    const fogCols = ['#94a3b8', '#334155'];
    // (Las posiciones van respecto al centro del mapa, que ocupa al menos todo el ancho de la tarjeta.)
    const cx = (x) => `calc(50% + ${Math.round(x - W / 2)}px)`;
    const regions = stops.map((s, i) => {
      const cols = s.z && !s.locked ? s.z.colors : fogCols;
      const first = i === 0, last = i === stops.length - 1;
      const style = { left: first ? '0' : cx(pts[i][0] - STEP / 2), right: last ? '0' : null, width: last ? null : first ? cx(pts[i][0] + STEP / 2) : STEP + 'px', backgroundImage: `url(${DK.pix.terrain(cols, 'wm-' + i)})` };
      return h('span', { class: 'wm2-region' + (s.z && !s.locked ? '' : ' fog'), style });
    });

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

    // Adornos: árboles, arbustos y rocas lejos del camino
    const rnd = DK.util.seeded('wm-decor-' + stops.length);
    const kinds = ['pine', 'pine', 'bush', 'rock', 'pine', 'bush'];
    const decor = [];
    // (también a los lados del camino, por si el mapa es más ancho que el recorrido)
    const SIDE = 420;
    for (let i = 0, tries = 0; i < stops.length * 4 + 10 && tries < 300; tries++) {
      const x = -SIDE + rnd() * (W + SIDE * 2), y = 14 + rnd() * (MAP_H - 30);
      const near = pts.some(([px, py]) => Math.abs(px - x) < 54 && Math.abs(py - y) < 62);
      const k = Math.min(stops.length - 1, Math.max(0, Math.round((x - PAD) / STEP)));
      const onRoad = Math.abs(y - (pts[k][1])) < 30;
      if (near || onRoad) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      decor.push(h('span', { class: 'wm2-deco' + (stops[k].z && !stops[k].locked ? '' : ' fog'), style: { left: cx(x), top: y + 'px' } }, DK.pix.svg(DK.pix.sprites[kind](Math.floor(rnd() * 3)), 2)));
      i++;
    }

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
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('zones.unlockedN', { n: unlocked.length, total: all.length })),
        h('span', { class: 'grow' }), h('span', { class: 'muted small wm2-help' }, t('zones.pickHint'))),
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
      const prepHost = h('div', { class: 'bt-prep-host' });
      const redrawPrep = () => { const y = window.scrollY; prepHost.replaceChildren(prepCard(params, redrawPrep)); window.scrollTo(0, y); };
      redrawPrep();
      return h('div', { class: 'screen zones-screen bt-screen' },
        worldMap(sel, choose),
        h('div', { class: 'bt-main' }, prepHost, h('div', { class: 'bt-side' }, weeklyCard(params), sel ? zoneCard(sel) : null)));
    },
  });
})();
