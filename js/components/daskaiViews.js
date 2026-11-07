/* =============================================================
 * components/daskaiViews.js — Vistas de daskai y ataques:
 * sprite, fila de lista, tarjeta de ataque, tabla de atributos,
 * selector de daskai, aprender ataque y comparador.
 * ============================================================= */
(function () {
  const { h, btn, modal } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = (DK.views = DK.views || {});

  /**
   * Dibujo de una especie (v4.47: con el aspecto de un individuo, systems/looks.js).
   * @param {string} speciesId
   * @param {Object} [o] {size, flip, silhouette, shiny, cls, look}
   *   look: aspecto del individuo (d.look); sin él se dibuja la «forma típica» de la especie.
   */
  V.sprite = (speciesId, { size = 96, flip = false, silhouette = false, shiny = false, cls = '', look = null } = {}) => {
    const sp = D.species[speciesId];
    const img = sp.sprite && sp.sprite.img;
    const pixel = DK.settings.get('pixelArt') !== false && !img;
    const el = h('div', { class: `sprite ${pixel ? 'pixel' : ''} ${silhouette ? 'silhouette' : ''} ${shiny ? 'is-shiny' : ''} ${flip ? 'flip' : ''} ${cls}`, style: { width: size + 'px', height: size + 'px' }, dataset: { sp: speciesId } });
    // Pixel art (ajuste «pixelArt»): se usa la versión en caché o se pinta el SVG
    // mientras se genera y luego se cambia por la imagen pixelada.
    const toImg = (url) => { const im = document.createElement('img'); im.className = 'sprite-px'; im.alt = sp.name; im.draggable = false; im.src = url; el.replaceChildren(im); };
    if (img) { el.innerHTML = DK.sprites.svg(sp, { flip, shiny }); return el; }
    // v4.58: el dibujo va centrado en su recuadro; --feet = a qué altura (0–1) quedan los pies, para
    // las escenas que lo quieren apoyado en el suelo (combate: clase «grounded»)
    { const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(DK.looks.svg(speciesId, look, { shiny }) || ''); if (vb) el.style.setProperty('--feet', Math.min(1, (116 - +vb[2]) / +vb[4]).toFixed(3)); }
    const cached = pixel && DK.looks.pixelCached(speciesId, look, { shiny });
    if (cached) toImg(cached);
    else {
      el.innerHTML = DK.looks.svg(speciesId, look, { flip, shiny });
      if (pixel) DK.looks.pixel(speciesId, look, { shiny }).then((url) => { if (url) toImg(url); });
    }
    return el;
  };
  /**
   * v4.63: silueta grande de un daskai que hace de personaje (viajera, ermitaño, mercader...).
   * Sale de una clave (suceso + semilla): cada encuentro tiene su propia figura, siempre la misma
   * para ese encuentro. Silueta oscura con contorno de color, ojos que brillan y un bocadillo.
   */
  V.npc = (key, { color = '#f59e0b', icon = 'user', size = 100 } = {}) => {
    let x = 2166136261; for (const c of String(key)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; }
    const pool = Object.keys(D.species).filter((id) => !D.species[id].from && !(D.species[id].sprite && D.species[id].sprite.img));
    const sid = pool[x % pool.length];
    const look = { s: ((((x >>> 3) & 0xffffff) << 8) | 0xa6) >>> 0 };
    return h('div', { class: 'npc', style: { '--npc': color }, 'aria-hidden': 'true' },
      h('span', { class: 'npc-frame' }, h('span', { class: 'npc-glow' }), h('span', { class: 'npc-rays' }), V.sprite(sid, { look, size, cls: 'npc-sil' })),
      h('span', { class: 'npc-bubble' }, DK.icon(icon, 12)));
  };
  /** Sprite de un daskai concreto (su aspecto, variocolor y forma alternativa). */
  V.dSprite = (d, o = {}) => V.sprite(d.species, Object.assign({ shiny: !!d.shiny, look: DK.looks.of(d) }, o, d.variant ? { cls: ((o.cls || '') + ' variant-' + d.variant).trim() } : null));

  /**
   * Rasgos del aspecto como iconos (v4.47): sólo el dibujo del rasgo; el nombre sale al pasar el ratón.
   * @param {string} sid   especie
   * @param {Object|null} look  aspecto (d.look) · null = forma típica
   * @param {Object} [o] { house: true (añade el icono de la casa: manos y pelo) }
   */
  V.lookStrip = (sid, look, { house = false } = {}) => {
    const L = DK.looks, i = L.ind(sid, look), Hs = L.houses[i.house];
    const one = (svg, tip, cls = '') => { const el = h('span', { class: 'lk-trait ' + cls, tip, 'aria-label': tip, role: 'img' }); el.innerHTML = svg; return el; };
    const items = L.traits(i, { final: L.stageOf(sid).final }).map((tr) => one(L.icon(tr.cat, tr.key, { house: i.house, skin: Hs.skins[0] }), L.label(tr.cat, tr.key) + (tr.rare ? ' · ' + t('look.rare') : ''), (tr.rare ? 'rare ' : '') + 'c-' + tr.cat));
    if (house) items.unshift(h('span', { class: 'lk-trait lk-house', style: { '--c': D.houseColor(i.house) }, tip: `${DK.tr('houses', D.houses[i.house])}: ${t('look.handsFur', { hands: t('look.hands.' + Hs.hands), fur: t('look.fur.' + Hs.fur) })}`, 'aria-label': DK.tr('houses', D.houses[i.house]) }, DK.icon(D.houses[i.house].icon, 15)));
    return h('div', { class: 'lk-strip', role: 'list', 'aria-label': t('look.title') }, items);
  };

  /**
   * Fila de daskai para listas.
   * @param {Object} d
   * @param {Object} [o] {onClick, tags, selected, compact, draggable, actions}
   */
  /**
   * Vista en grande de un daskai (v4.56): al pulsar su dibujo en la ficha. Cada vez hace una
   * animación distinta al azar (salto, giro, baile…) con sus partículas y luego otra cada pocos
   * segundos (nunca la misma dos veces seguidas); pulsar el dibujo adelanta la siguiente. Cerrar: «×» arriba.
   */
  const SHOW_ANIMS = [
    { id: 'hop', fx: 'sparkles' }, { id: 'spin', fx: 'star' }, { id: 'squash', fx: 'heart' }, { id: 'sway', fx: 'music' },
    { id: 'flip', fx: 'sparkles' }, { id: 'shake', fx: 'bolt' }, { id: 'dance', fx: 'music' }, { id: 'float', fx: 'heart' }, { id: 'roar', fx: 'bolt' },
    // v4.63: más animaciones, con partículas propias (confeti, burbujas, onda, motas de su casa, estrellas fugaces)
    { id: 'wiggle', fx: 'confetti' }, { id: 'bounce3', fx: 'bubbles' }, { id: 'twirl', fx: 'ring' }, { id: 'peek', fx: 'motes' },
    { id: 'stretch', fx: 'comets' }, { id: 'nod', fx: 'notes' },
  ];
  const CONFETTI = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6'];
  /** Partículas de una animación: iconos (las de siempre) o formas dibujadas (v4.63). */
  function showFx(kind) {
    const R = (a, b) => a + Math.random() * (b - a), pc = (n) => n.toFixed(0) + '%';
    switch (kind) {
      case 'confetti': return Array.from({ length: 22 }, (_, i) => h('b', { class: 'p-confetti', style: { '--x': pc(R(-46, 46)), '--y': pc(R(-10, 30)), '--d': (i * 0.03).toFixed(2) + 's', '--r': R(-540, 540).toFixed(0) + 'deg', background: CONFETTI[i % CONFETTI.length] } }));
      case 'bubbles': return Array.from({ length: 12 }, (_, i) => h('b', { class: 'p-bubble', style: { '--x': pc(R(-34, 34)), '--d': (i * 0.12).toFixed(2) + 's', '--s': R(8, 22).toFixed(0) + 'px' } }));
      case 'ring': return [0, 0.18, 0.36].map((d) => h('b', { class: 'p-ring', style: { '--d': d + 's' } }));
      case 'motes': return Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; return h('b', { class: 'p-mote', style: { '--tx': (Math.cos(a) * R(80, 140)).toFixed(0) + 'px', '--ty': (Math.sin(a) * R(60, 110)).toFixed(0) + 'px', '--d': (R(0, 0.25)).toFixed(2) + 's' } }); });
      case 'comets': return Array.from({ length: 5 }, (_, i) => h('b', { class: 'p-comet', style: { '--y': pc(R(8, 50)), '--d': (i * 0.16).toFixed(2) + 's' } }));
      case 'notes': return Array.from({ length: 7 }, (_, i) => h('i', { class: 'p-note', style: { '--x': pc(R(-40, 40)), '--d': (i * 0.14).toFixed(2) + 's', '--r': R(-30, 30).toFixed(0) + 'deg' } }, DK.icon('music', 14 + Math.round(R(0, 10)))));
      default: return Array.from({ length: 9 }, (_, i) => h('i', { style: { '--x': (Math.random() * 80 - 40).toFixed(0) + '%', '--d': (i * 0.09).toFixed(2) + 's', '--r': (Math.random() * 60 - 30).toFixed(0) + 'deg' } }, DK.icon(kind, 14 + Math.round(Math.random() * 10))));
    }
  }
  let lastShow = '';
  /**
   * @param {Object} d daskai
   * @param {Object} [o] { bare: sólo el dibujo y su nombre, sin datos (v4.63: al reclutar) }
   */
  V.showcase = (d, { bare = false } = {}) => {
    const sp = DK.daskai.species(d);
    const stage = h('div', { class: 'sc-stage' + (bare ? ' bare' : ''), style: { '--c': D.houseColor(sp.house) } });
    // v4.65: en pantallas táctiles sin «tip» (salía al tocar) ni marco al pulsar
    const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    const mon = h('button', { class: 'sc-mon', type: 'button', tip: touch ? null : t('detail.showAgain'), 'aria-label': t('detail.showAgain') }, V.dSprite(d, { size: 260 }));
    const fx = h('div', { class: 'sc-fx', 'aria-hidden': 'true' });
    // Fondo vivo: motas que suben despacio todo el rato
    const amb = h('div', { class: 'sc-amb', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('b', { style: { left: (4 + Math.random() * 92).toFixed(0) + '%', '--d': (-Math.random() * 8).toFixed(1) + 's', '--t': (6 + Math.random() * 5).toFixed(1) + 's', '--s': (3 + Math.random() * 4).toFixed(0) + 'px' } })));
    stage.append(amb, h('span', { class: 'sc-glow' }), h('span', { class: 'sc-floor' }), mon, fx);
    const play = () => {
      const pool = SHOW_ANIMS.filter((a) => a.id !== lastShow), a = pool[Math.floor(Math.random() * pool.length)];
      lastShow = a.id;
      mon.className = 'sc-mon'; void mon.offsetWidth; mon.classList.add('a-' + a.id);
      fx.replaceChildren(...showFx(a.fx));
      DK.audio.sfx(a.id === 'roar' ? 'hit' : 'select');
    };
    mon.addEventListener('click', () => { play(); loop(); if (touch) mon.blur(); });
    // v4.57: siempre en movimiento: una animación nueva cada pocos segundos
    let timer = 0;
    const loop = () => { clearTimeout(timer); timer = setTimeout(() => { if (!stage.isConnected) return; play(); loop(); }, 2600 + Math.random() * 1600); };
    const f = DK.daskai.formsOf(d);
    const m = DK.ui.modal({ title: DK.daskai.name(d), icon: 'maximize', cls: 'showcase-modal' + (bare ? ' bare' : ''), closeX: true, content: () => h('div', { class: 'showcase' }, stage,
      bare ? null : h('div', { class: 'sc-meta' }, h('span', { class: 'dk-species' }, DK.daskai.speciesName(d)), V.level(d.level), V.housesBadge(d), V.formPips(d), V.shinyTag(d),
        h('span', { class: 'muted small' }, f.total === 1 ? t('evo.single') : t('evo.formsTip', { n: f.now + 1, total: f.total })))) });
    m.promise.then(() => clearTimeout(timer));
    setTimeout(() => { play(); loop(); }, 180);
  };

  /**
   * Resumen rápido de un daskai (v4.58, al pulsarlo en el Inicio): de un vistazo cómo está
   * —vida, maná y experiencia, atributos, naturaleza, pasiva, ataques y avisos— sin salir.
   * «Ficha completa» lleva a la pantalla de equipo.
   */
  V.quickStats = (d, { onChange = () => DK.router.refresh() } = {}) => {
    const sp = DK.daskai.species(d), st = DK.daskai.stats(d);
    const n = D.natures[d.nature], ps = D.passives[d.passive];
    const lead = DK.party.leader() && DK.party.leader().uid === d.uid;
    const notes = [
      DK.daskai.canEvolve(d) ? h('span', { class: 'qs-note evo' }, DK.icon('evolve', 13), t('evo.ready')) : null,
      DK.daskai.talentsPending(d).length ? h('span', { class: 'qs-note talent' }, DK.icon('star', 13), t('talent.pendingTip')) : null,
      DK.training && DK.training.isTraining(d.uid) ? h('span', { class: 'qs-note' }, DK.icon('dumbbell', 13), t('train.inTraining')) : null,
    ].filter(Boolean);
    let m;
    const go = () => { m.close(true); DK.router.reset('team', { uid: d.uid }); };
    m = DK.ui.modal({ title: DK.daskai.name(d), icon: lead ? 'crown' : 'paw', cls: 'qs-modal', closeX: true, content: () => h('div', { class: 'qs', style: { '--c': D.houseColor(sp.house) } },
      h('div', { class: 'qs-top' },
        h('button', { class: 'qs-art', type: 'button', tip: t('detail.viewBig'), 'aria-label': t('detail.viewBig'), onClick: () => V.showcase(d) }, V.dSprite(d, { size: 84 }), V.formPips(d)),
        h('div', { class: 'qs-id' },
          h('div', { class: 'qs-tags' }, h('span', { class: 'dk-species' }, DK.daskai.speciesName(d)), V.level(d.level), V.housesBadge(d), V.roleBadge(d, { neutral: true }), V.shinyTag(d), V.statusTag(d.status),
            DK.daskai.isFainted(d) ? h('span', { class: 'badge bad' }, DK.icon('skull', 12), t('common.fainted')) : null),
          V.vitals(d, { exp: true }))),
      h('div', { class: 'qs-stats' }, D.statKeys.map((k) => h('div', { class: 'qs-stat', tip: DK.tr('stats', D.stats[k], 'desc') || DK.tr('stats', D.stats[k]) },
        DK.icon(D.stats[k].icon, 14), h('span', null, DK.tr('stats', D.stats[k], 'short')), h('b', null, st[k])))),
      h('div', { class: 'qs-lines' },
        h('div', { class: 'qs-line', tip: `${t('common.nature')}: ${DK.tr('natures', n, 'desc')}` }, DK.icon('leaf', 14), h('b', null, DK.tr('natures', n))),
        h('div', { class: 'qs-line', tip: `${t('common.passive')}: ${DK.tr('passives', ps, 'desc')}` }, DK.icon('sparkles', 14), h('b', null, DK.tr('passives', ps)))),
      h('div', { class: 'qs-moves' }, (d.moves || []).map((id) => { const mv = D.moves[id]; return mv ? h('span', { class: 'qs-move', style: mv.house ? { '--mc': D.houseColor(mv.house) } : null, tip: mv.power ? `${mv.power} · ${mv.kind === 'fisico' ? t('move.free') : mv.mp + ' ' + t('common.mpShort')}` : null }, DK.icon(mv.kind === 'fisico' ? 'sword' : 'wand', 12), mv.name) : null; })),
      notes.length ? h('div', { class: 'qs-notes' }, notes) : null,
      h('div', { class: 'qs-foot' },
        !lead && DK.party.isActive(d.uid) ? btn({ icon: 'crown', label: t('detail.makeLeader'), size: 'sm', variant: 'ghost', onClick: () => { DK.party.setLeader(d.uid); DK.audio.sfx('swap'); m.close(true); onChange(); } }) : null,
        h('span', { class: 'grow' }),
        btn({ icon: 'next', label: t('home.fullSheet'), size: 'sm', variant: 'tone', onClick: go }))) });
    return m;
  };

  /** Punto verde de «recién conseguido» (v4.62) en las casillas de equipo y cajas; se va al abrir su ficha. */
  V.newDot = (d) => (DK.daskai.isNew(d) ? h('span', { class: 'new-dot', tip: t('newMark.tip'), 'aria-label': t('newMark.label') }) : null);

  /** Especie en pequeño junto al nombre propio (v4.54), si no coinciden. */
  V.speciesSub = (d) => { const s = DK.daskai.speciesName(d); return DK.daskai.name(d) !== s ? h('span', { class: 'dk-species' }, s) : null; };

  V.daskaiRow = (d, { onClick, tags = [], selected = false, compact = false, draggable = false, actions } = {}) => {
    const sp = DK.daskai.species(d);
    const fainted = DK.daskai.isFainted(d);
    // Es un <div role="button"> (no <button>) para poder llevar botones dentro
    const el = h('div', {
      class: `dk-row ${onClick ? 'clickable' : ''} ${selected ? 'selected' : ''} ${fainted ? 'fainted' : ''} ${compact ? 'compact' : ''}`,
      role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, draggable: draggable ? 'true' : null, dataset: { uid: d.uid },
    },
      draggable ? h('span', { class: 'drag-handle', tip: t('team.dragTip') }, DK.icon('grip', 16)) : null,
      h('div', { class: 'dk-row-sprite', style: { '--c': D.houseColor(sp.house) } }, V.dSprite(d, { size: compact ? 44 : 56 }), V.formPips(d)),
      h('div', { class: 'dk-row-main' },
        h('div', { class: 'dk-row-title' }, h('span', { class: 'dk-name' }, DK.daskai.name(d)), V.speciesSub(d), V.level(d.level)),
        h('div', { class: 'dk-row-tags' }, V.housesBadge(d), V.roleBadge(d), V.shinyTag(d), V.tempTag(d), V.statusTag(d.status),
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
  /**
   * Formas del daskai como puntitos discretos (v4.53): uno por forma, rellenos hasta la actual.
   * Con 1 forma, un único rombo («No evoluciona»). El detalle sale al pasar el ratón.
   */
  V.formPips = (d) => {
    const f = DK.daskai.formsOf(d);
    const tip = f.total === 1 ? t('evo.single') : t('evo.formsTip', { n: f.now + 1, total: f.total });
    return h('span', { class: 'fpips' + (f.total === 1 ? ' single' : ''), tip, 'aria-label': tip }, Array.from({ length: f.total }, (_, i) => h('i', { class: i <= f.now ? 'on' : '' })));
  };

  /** Marcas extra de un daskai: entrenando y talento por elegir. */
  V.extraTags = (d) => [
    DK.daskai.isNew(d) ? h('span', { class: 'badge new', tip: t('newMark.tip') }, t('newMark.label')) : null,
    d.locked ? h('span', { class: 'badge lock', tip: t('lock.locked') }, DK.icon('lock', 12)) : null,
    DK.training && DK.training.isTraining(d.uid) ? h('span', { class: 'badge train', tip: t('train.inTraining') }, DK.icon('dumbbell', 12), t('train.short')) : null,
    DK.daskai.talentsPending(d).length ? h('span', { class: 'badge talent', tip: t('talent.pendingTip') }, DK.icon('star', 12)) : null,
  ].filter(Boolean);

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
    const avg = DK.daskai.growthAvg(d, k);
    return h('span', { class: 'grow-rate r-' + r, tip: t('stats.rateTip', { rate: t('stats.rate.' + r), pct: Math.round(w * 100), n: (Math.round(avg * 10) / 10).toLocaleString(DK.i18n.lang) }), 'aria-label': t('stats.rate.' + r) }, RATE[r]);
  };

  /** Resumen de mejoras permanentes: tónicos usados y puntos entrenados. */
  V.permInfo = (d) => {
    const used = DK.daskai.tonicsUsed(d), tr = DK.training.trainedTotal(d);
    if (!used && !tr && !DK.training.isTraining(d.uid)) return null;
    return h('div', { class: 'chips' },
      h('span', { class: 'chip', tip: t('stats.tonicTip') }, DK.icon('flask', 13), t('stats.tonics', { n: used, max: DK.config.tonic.cap })),
      h('span', { class: 'chip', tip: t('stats.trainedTip') }, DK.icon('dumbbell', 13), t('stats.trained', { n: Math.round(tr), max: DK.training.statMax() })),
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
    // v4.62: escala que se curva (nunca llena la barra): con ~ref ocupa ~60%; por mucho que suba no pasa del 94%
    const fill = 94 * (1 - Math.exp(-posTotal / (ref * 1.1)));
    const scale = posTotal > 0 ? posTotal / (fill / 100) : ref;
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
    const parts = [t('stats.part.base', { n: b.base }) + (b.gene ? ' ' + t('stats.part.gene', { n: sg(Math.round(b.gene * 100)) }) : '') + (b.trait ? ' ' + t('stats.part.trait', { n: sg(Math.round(b.trait * 100)) }) : ''), t('stats.part.level', { n: b.level })];
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
   * Tabla de atributos compacta: cada fila es nombre + valor + marcas
   * (naturaleza, ritmo de crecimiento, rasgo) y debajo la barra por colores.
   * Pulsar una fila despliega su desglose en texto; «Ver todo el desglose»
   * los abre todos. La leyenda de colores va plegada.
   * @param {Object} d
   * @param {Object} [o] {stages (mejoras en combate), compare (otro daskai), legend (mostrar leyenda, por defecto sí), open (desglose abierto)}
   */
  V.statTable = (d, { stages, compare, legend = true, open = false } = {}) => {
    const s = DK.daskai.stats(d);
    const other = compare ? DK.daskai.stats(compare) : null;
    const row = (k, { val, bar, marks = [], extra = [], more }) => {
      const el = h('details', { class: 'st2-row k-' + k }, h('summary', { class: 'st2-sum' },
        h('span', { class: 'st2-name' }, DK.icon(D.stats[k].icon, 15), h('span', { tip: DK.t('tips.stat.' + k) }, DK.tr('stats', D.stats[k]))),
        h('span', { class: 'st2-marks' }, marks),
        h('span', { class: 'st2-val' }, val, extra),
        bar,
        h('span', { class: 'st2-chev', 'aria-hidden': 'true' }, DK.icon('chevronDown', 14))),
        h('p', { class: 'st2-more stat-break small' }, more));
      if (open) el.open = true;
      return el;
    };
    const rows = D.statKeys.map((k) => {
      const b = DK.daskai.breakdown(d, k);
      const stage = stages && stages[k];
      const diff = other ? s[k] - other[k] : 0;
      return row(k, {
        val: String(s[k]),
        extra: [stage ? h('span', { class: 'stage ' + (stage > 0 ? 'pos' : 'neg') }, (stage > 0 ? '▲' : '▼') + Math.abs(stage)) : null,
          other && diff ? h('span', { class: 'stage ' + (diff > 0 ? 'pos' : 'neg') }, (diff > 0 ? '+' : '') + diff) : null],
        marks: [V.natureArrow(d, k), V.growthBadge(d, k), b.trait ? h('span', { class: 'trait-mark ' + (b.trait > 0 ? 'up' : 'down'), tip: t('trait.statTip', { name: DK.tr('roles', DK.daskai.roleOf(d)), n: (b.trait > 0 ? '+' : '') + Math.round(b.trait * 100) }) }, DK.icon(DK.daskai.roleOf(d).icon, 11)) : null],
        bar: V.statBar(b, k === 'hp' ? 400 : 260),
        more: V.breakdownText(b),
      });
    });
    rows.push(row('regen', {
      val: s.regen + '%',
      bar: h('div', { class: 'stat-bar' }, h('div', { class: 'seg seg-level', style: { width: Math.min(100, s.regen * 15) + '%' } })),
      more: t('stats.regenPerTurn', { n: Math.max(1, Math.round((s.hp * s.regen) / 100)) }),
    }));
    const all = h('button', { class: 'st2-all', type: 'button', onClick: (ev) => {
      const box = ev.currentTarget.closest('.stat-table'); const list = [...box.querySelectorAll('.st2-row')];
      const to = !list.every((x) => x.open); list.forEach((x) => (x.open = to));
      ev.currentTarget.lastChild.textContent = to ? t('stats.hideAll') : t('stats.showAll');
    } }, DK.icon('list', 13), h('span', null, open ? t('stats.hideAll') : t('stats.showAll')));
    return h('div', { class: 'stat-table st2' },
      h('div', { class: 'st2-head' },
        legend ? h('details', { class: 'st2-legend' }, h('summary', null, DK.icon('info', 13), ' ', t('stats.legendTitle')), V.statLegend()) : h('span'),
        all),
      rows);
  };

  /** Decidir si aprender un ataque nuevo cuando ya tiene el máximo (config.maxMoves). Devuelve promesa (true si lo aprende). */
  /**
   * Aprender un ataque (v4.59): a la izquierda el nuevo destacado; a la derecha los 4 que ya
   * conoce en una cuadrícula de 2×2, cada uno con cuánto gana o pierde si lo cambias. Primero
   * eliges cuál olvidar (queda marcado) y luego confirmas; o lo guardas en la reserva.
   */
  V.learnMovePrompt = (d, moveId) => {
    const avg = (x) => (Array.isArray(x) ? (x[0] + x[1]) / 2 : x || 0);
    const nm = D.moves[moveId], newDmg = avg(V.approxDamage(d, moveId));
    let pick = -1;
    const confirmBtn = btn({ icon: 'check', label: t('learn.pickFirst'), variant: 'primary', disabled: true, onClick: () => { if (pick < 0) return; DK.daskai.setMove(d, moveId, pick); DK.store.save(); m.close(true); } });
    const cards = d.moves.map((mid, i) => {
      const om = D.moves[mid], oldDmg = avg(V.approxDamage(d, mid));
      const diff = nm.power && om.power ? Math.round(newDmg - oldDmg) : null;
      const delta = diff == null ? (om.power ? h('span', { class: 'lm-delta warn', tip: t('learn.losesDamage') }, DK.icon('swords', 12), t('learn.attack')) : h('span', { class: 'lm-delta', tip: t('learn.support') }, DK.icon('sparkles', 12), t('learn.supportShort')))
        : h('span', { class: 'lm-delta ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : ''), tip: t('learn.deltaTip') }, diff > 0 ? '+' + diff : diff === 0 ? '=' : String(diff), ' ', t('learn.dmg'));
      const card = h('button', { class: 'lm-old', type: 'button', 'aria-pressed': 'false', onClick: () => {
        pick = i; DK.audio.sfx('select');
        cards.forEach((c, j) => { c.classList.toggle('on', j === i); c.setAttribute('aria-pressed', String(j === i)); });
        confirmBtn.disabled = false;
        const lbl = confirmBtn.querySelector('.btn-label'); if (lbl) lbl.textContent = t('learn.confirm', { old: om.name });
      } }, V.moveCard(mid, { d, compact: true }), h('span', { class: 'lm-foot' }, delta, h('span', { class: 'lm-forget' }, DK.icon('x', 12), t('learn.forget'))));
      return card;
    });
    const m = modal({
      title: t('learn.title', { name: DK.daskai.name(d), move: nm.name }), icon: 'sparkles', dismissable: false, size: 'wide', cls: 'learn-modal',
      content: () => h('div', { class: 'lm' },
        h('div', { class: 'lm-new' }, h('span', { class: 'lm-kicker' }, DK.icon('sparkles', 13), t('learn.newMove')), V.moveCard(moveId, { d }),
          h('p', { class: 'muted small' }, t('learn.text', { n: DK.config.maxMoves }))),
        h('div', { class: 'lm-olds' }, h('span', { class: 'lm-kicker' }, t('learn.replace')), h('div', { class: 'lm-grid' }, cards))),
      actions: [{ label: t('learn.skip'), icon: 'pouch', variant: 'ghost', value: false }],
    });
    // el botón de confirmar va en el pie, junto a «Guardar en reserva»
    const foot = m.el.querySelector('.modal-actions'); if (foot) foot.append(confirmBtn);
    return m.promise;
  };

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
