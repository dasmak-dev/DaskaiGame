/* =============================================================
 * screens/expedition.js — Mapa de la expedición.
 *
 *  Izquierda: el mapa por pisos (de abajo arriba, el jefe arriba del todo).
 *  Pulsa un nodo iluminado para ir allí (teclas 1-4 de izquierda a derecha).
 *  Derecha: lo que pasa en el nodo elegido (suceso, tienda, descanso,
 *  cofre) o, si no hay nada pendiente, tu botín, tu equipo y la retirada.
 *
 *  Los combates se abren en la pantalla 'battle' con params.node; al
 *  ganar, battle.js llama a DK.expedition.completeNode() y vuelve aquí.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const E = () => DK.expedition;
  const ROW_FULL = 112, ROW_COMPACT = 60; // alto de cada piso en el mapa (px): normal y vista previa

  /** Etiqueta del tamaño de un mapa: «Mediano · 20 pisos». */
  V.sizeChip = (size, { big = false } = {}) => {
    size = size || 'small';
    const sz = DK.config.expedition.sizes[size];
    return h('span', { class: 'chip size-chip s-' + size + (big ? ' big' : ''), tip: t('size.' + size + '.desc', { n: E().sizeFloors(size) }) },
      DK.icon(sz.icon, big ? 16 : 13), t('size.label', { name: t('size.' + size + '.name'), n: E().sizeFloors(size) }));
  };
  /** Etiquetas del final del juego de la expedición en curso: corrupción, pesadilla, piso del abismo. */
  V.endgameChips = (e) => [
    e.corruption ? h('span', { class: 'chip neg cor-chip', tip: t('corruption.levelN', { n: e.corruption }) }, DK.icon('skull', 13), t('corruption.short', { n: ['I', 'II', 'III', 'IV', 'V'][e.corruption - 1] })) : null,
    e.nightmare && e.zone === e.nightmare ? h('span', { class: 'chip neg' }, DK.icon('demon', 13), t('nightmare.title')) : null,
    e.weekly ? h('span', { class: 'chip pos', tip: t('weekly.scoring') }, DK.icon('trophy', 13), t('weekly.title')) : null,
    e.kind === 'abismo' ? h('span', { class: 'chip abyss-chip', tip: t('abyss.best', { n: DK.abyss.best() }) }, DK.icon('moon', 13), t('abyss.floor', { n: e.depth || 1 })) : null,
  ];
  /** Etiqueta del modificador de un mapa (niebla, tormenta…) o null. */
  V.modChip = (mod, { big = false } = {}) => {
    if (!mod || !D.mapMods[mod]) return null;
    const m = D.mapMods[mod];
    return h('span', { class: 'chip mod-chip m-' + mod + (big ? ' big' : ''), tip: `${t('mod.' + mod + '.desc')}\n${t('mod.reward', { n: Math.round((m.coins || 0) * 100) })}` },
      DK.icon(m.icon, big ? 16 : 13), t('mod.' + mod + '.name'));
  };
  /* ---------- Encargo del mapa ---------- */
  /** Texto del progreso o estado de un encargo. */
  const questState = (q) => q.failed ? t('quest.failed') : q.def.track ? (q.done ? t('quest.done') : `${q.prog}/${q.target}`) : t('quest.holding');
  const itemName = (id) => (D.items[id] ? D.items[id].name : '—');
  /** Pastilla compacta del encargo (barra de estado, cabeceras). */
  V.questChip = (q = E().quest()) => {
    if (!q) return null;
    const cls = q.failed ? ' bad' : q.done ? ' good' : '';
    const r = E().questReward(q);
    return h('span', { class: 'chip quest-chip' + cls, tip: `${t('quest.title')}: ${t('quest.' + q.id + '.desc', { n: q.target })}\n${t('quest.reward', { coins: r.coins, item: itemName(r.item) })}` },
      DK.icon(q.failed ? 'x' : q.done ? 'check' : q.def.icon, 13), h('span', { class: 'quest-name' }, t('quest.' + q.id + '.name')), h('b', null, questState(q)));
  };
  /** Tarjeta del encargo (detalle). */
  V.questCard = (q = E().quest()) => {
    if (!q) return null;
    const r = E().questReward(q);
    const pct = q.def.track ? Math.round((q.prog / q.target) * 100) : q.failed ? 0 : 100;
    return h('div', { class: 'quest-card' + (q.failed ? ' bad' : q.done ? ' good' : '') },
      h('span', { class: 'quest-icon' }, DK.icon(q.def.icon, 20)),
      h('div', { class: 'grow stack-xs' },
        h('div', { class: 'row gap-s between wrap' }, h('b', null, t('quest.title'), ': ', t('quest.' + q.id + '.name')), h('span', { class: 'badge' + (q.failed ? ' bad' : q.done ? ' good' : '') }, questState(q))),
        h('span', { class: 'muted small' }, t('quest.' + q.id + '.desc', { n: q.target })),
        q.def.track ? h('span', { class: 'mini-bar quest-bar' }, h('span', { style: { width: pct + '%' } })) : null,
        h('span', { class: 'small quest-reward' }, DK.icon('gift', 12), ' ', t('quest.reward', { coins: r.coins, item: itemName(r.item) }))));
  };
  /** Resultado del encargo del mapa recién superado (tras el jefe). */
  V.questResult = (lq) => {
    if (!lq || !D.mapQuests[lq.id]) return null;
    const ok = !!lq.reward;
    return h('div', { class: 'quest-card ' + (ok ? 'good' : 'bad') },
      h('span', { class: 'quest-icon' }, DK.icon(ok ? 'check' : 'x', 20)),
      h('div', { class: 'grow stack-xs' }, h('b', null, t('quest.title'), ': ', t('quest.' + lq.id + '.name')),
        h('span', { class: 'small' + (ok ? '' : ' muted') }, ok ? t('quest.paid', { coins: lq.reward.coins, item: itemName(lq.reward.item) }) : t('quest.missed'))));
  };
  DK.on('quest:done', ({ id }) => DK.ui.toast(t('quest.doneToast', { name: t('quest.' + id + '.name') }), { icon: 'check', kind: 'good' }));
  DK.on('quest:failed', ({ id }) => DK.ui.toast(t('quest.failToast', { name: t('quest.' + id + '.name') }), { icon: 'x', kind: 'bad' }));

  // Posición del mapa al dibujar (para no saltar al nodo disponible en cada trazo)
  let keepScroll = null;

  /** Daskai que luchará en el siguiente combate (el elegido o el primero en pie). */
  function fighter() {
    const e = E().active(), alive = DK.party.aliveActive();
    return alive.find((d) => d.uid === e.leader) || alive[0];
  }

  /** Abre el combate del nodo pendiente. kind: tipo forzado (suceso que acaba en combate). */
  function fight(kind) {
    const e = E().active(), n = E().pendingNode();
    const d = fighter();
    if (!d) { DK.ui.toast(t('warn.allFainted'), { icon: 'skull', kind: 'bad' }); return; }
    const type = kind || n.type;
    // 'secret' = el jefe oculto de la cueva; el jefe final también puede serlo (n.secret)
    const secret = type === 'secret' || (type === 'boss' && !!n.secret);
    DK.router.go('battle', { zone: e.zone, leaderUid: d.uid, boss: type === 'boss' || type === 'secret', secret, final: type === 'boss', elite: type === 'elite', node: n.id });
  }

  /** Va a un nodo del mapa. */
  function go(id, refresh) {
    const n = E().choose(id);
    if (!n) return;
    DK.audio.sfx('select');
    if (E().TYPES[n.type].battle) fight();
    else { refresh(); if (DK.ui.isNarrow()) setTimeout(() => { const p = document.querySelector('.exp-side'); if (p) p.scrollIntoView({ behavior: 'smooth' }); }, 50); }
  }

  /* ---------- Dibujar en el mapa ----------
   * Botón «Dibujar» (o clic derecho en el mapa): lápiz de colores, goma,
   * notas de texto, deshacer y borrar todo. Lo dibujado se guarda en la
   * expedición (DK.expedition.marks) y se ve también en el resumen.
   * Mientras se dibuja, los nodos no se pueden pulsar (y en el móvil el
   * dedo dibuja en vez de desplazar el mapa).
   */
  const PEN_COLORS = ['#facc15', '#f87171', '#4ade80', '#60a5fa', '#e879f9', '#f8fafc'];
  const draw = { on: false, tool: 'pen', color: PEN_COLORS[0] };

  /** Capa de dibujos y notas de un mapa (H = alto en px). editable = modo dibujo activo. */
  function marksLayer(marks, H, refresh, editable) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 1000 ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'map-draw' + (editable ? ' editing t-' + draw.tool : ''));
    svg.style.height = H + 'px';
    const poly = (ln) => {
      const p = document.createElementNS(svgNS, 'polyline');
      p.setAttribute('points', ln.pts.map(([x, y]) => `${(x * 1000).toFixed(1)},${y.toFixed(1)}`).join(' '));
      p.setAttribute('stroke', ln.c); return p;
    };
    (marks.lines || []).forEach((ln) => svg.append(poly(ln)));
    const notes = (marks.notes || []).map((n, i) => h('div', { class: 'map-note', style: { left: n.x * 100 + '%', top: n.y + 'px', '--nc': n.c } },
      h('span', null, n.text),
      editable ? h('button', { class: 'map-note-x', type: 'button', 'aria-label': t('draw.delNote'), onClick: (ev) => { ev.stopPropagation(); E().removeMark('notes', i); refresh(); } }, DK.icon('x', 12)) : null));
    if (!editable) return [svg, ...notes];

    // Modo dibujo
    const at = (ev) => { const r = svg.getBoundingClientRect(); return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(H, Math.max(0, ev.clientY - r.top))]; };
    const erase = (ev) => {
      const r = svg.getBoundingClientRect(), [x, y] = at(ev);
      const lines = E().marks().lines;
      const hit = lines.findIndex((ln) => ln.pts.some(([px, py]) => Math.hypot((px - x) * r.width, py - y) < 14));
      if (hit >= 0) { E().removeMark('lines', hit); refresh(); }
    };
    let cur = null, el = null;
    svg.addEventListener('pointerdown', async (ev) => {
      if (ev.button === 2) return;
      ev.preventDefault();
      if (draw.tool === 'eraser') { erase(ev); return; }
      if (draw.tool === 'note') {
        const [x, y] = at(ev);
        const text = await DK.ui.prompt(t('draw.noteTitle'), { placeholder: t('draw.notePh'), maxlength: 40, icon: 'edit' });
        if (text) { E().addNote({ x, y, text, c: draw.color }); refresh(); }
        return;
      }
      svg.setPointerCapture(ev.pointerId);
      cur = { c: draw.color, pts: [at(ev)] };
      el = poly(cur); el.classList.add('drawing'); svg.append(el);
    });
    svg.addEventListener('pointermove', (ev) => {
      if (draw.tool === 'eraser' && ev.buttons) { erase(ev); return; }
      if (!cur) return;
      const p = at(ev), last = cur.pts[cur.pts.length - 1];
      const r = svg.getBoundingClientRect();
      if (Math.hypot((p[0] - last[0]) * r.width, p[1] - last[1]) < 3) return;
      cur.pts.push(p);
      el.setAttribute('points', cur.pts.map(([x, y]) => `${(x * 1000).toFixed(1)},${y.toFixed(1)}`).join(' '));
    });
    const end = () => { if (!cur) return; const ln = cur; cur = null; if (ln.pts.length > 1) E().addLine({ c: ln.c, pts: ln.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(1)]) }); refresh(); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    return [svg, ...notes];
  }

  /** Barra de herramientas del modo dibujo. */
  function drawBar(refresh) {
    const tool = (id, icon) => h('button', { class: 'draw-tool' + (draw.tool === id ? ' on' : ''), type: 'button', tip: t('draw.tool.' + id), 'aria-label': t('draw.tool.' + id), onClick: () => { draw.tool = id; refresh(); } }, DK.icon(icon, 16), h('span', null, t('draw.tool.' + id)));
    const m = E().marks();
    return h('div', { class: 'draw-bar' },
      tool('pen', 'edit'), tool('eraser', 'trash'), tool('note', 'tag'),
      h('span', { class: 'draw-sep' }),
      h('div', { class: 'draw-colors' }, PEN_COLORS.map((c) => h('button', { class: 'draw-color' + (draw.color === c ? ' on' : ''), type: 'button', style: { '--c': c }, 'aria-label': c, onClick: () => { draw.color = c; if (draw.tool === 'eraser') draw.tool = 'pen'; refresh(); } }))),
      h('span', { class: 'grow' }),
      btn({ icon: 'back', label: t('draw.undo'), size: 'sm', variant: 'ghost', disabled: !m.lines.length && !m.notes.length, onClick: () => { E().undoMark(); refresh(); } }),
      btn({ icon: 'x', label: t('draw.clear'), size: 'sm', variant: 'ghost', disabled: !m.lines.length && !m.notes.length, onClick: async () => { if (await DK.ui.confirm(t('draw.clearQ'), t('draw.clearText'), { okLabel: t('draw.clear'), okIcon: 'trash', danger: true })) { E().clearMarks(); refresh(); } } }),
      btn({ icon: 'check', label: t('draw.done'), size: 'sm', variant: 'primary', onClick: () => { draw.on = false; refresh(); } }));
  }

  /* ---------- Mapa ---------- */
  /**
   * Mapa de la expedición.
   * @param {Function} refresh
   * @param {Object} [src]   expedición a dibujar (por defecto la activa; el resumen pasa la terminada)
   * @param {boolean} [readonly]  sin nodos pulsables (resumen)
   */
  /**
   * Decorados del mapa: árboles, matas y rocas en pixel art, siempre los
   * mismos para cada mapa (semilla), en los márgenes y en los huecos
   * entre nodos (nunca encima de uno).
   */
  function mapDecor(e, H, pts, compact) {
    const rnd = DK.util.seeded('decor-' + e.seed);
    const kinds = ['pine', 'pine', 'bush', 'rock', 'pine', 'bush'];
    const out = [], n = Math.round(H / (compact ? 90 : 60));
    const free = (x, y) => pts.every(([px, py]) => Math.abs(px - x) > 9 || Math.abs(py - y) > 44);
    const put = (x, y) => {
      const k = kinds[Math.floor(rnd() * kinds.length)], shade = Math.floor(rnd() * 3);
      const art = DK.pix.svg(DK.pix.sprites[k](shade), compact ? 1.6 : 2.4);
      out.push(h('span', { class: 'exp-deco d-' + k, style: { left: x + '%', top: y + 'px' }, 'aria-hidden': 'true' }, art));
    };
    for (let i = 0; i < n; i++) put(i % 2 ? -9 + rnd() * 6 : 103 + rnd() * 6, rnd() * H);
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) { const x = 4 + rnd() * 92, y = 20 + rnd() * (H - 40); if (free(x, y)) { put(x, y); i++; } }
    return out;
  }

  function mapView(refresh, src, readonly, { compact = false } = {}) {
    const e = src || E().active();
    const ROW_H = compact ? ROW_COMPACT : ROW_FULL;
    const rows = e.map.rows, H = rows.length * ROW_H;
    const avail = readonly ? [] : E().available();
    if (readonly && !e.pos && e.cleared.length) e.pos = e.cleared[e.cleared.length - 1];
    const cleared = new Set(e.cleared);
    const yOf = (row) => (rows.length - 1 - row) * ROW_H + ROW_H / 2;
    // Niebla (modificador): sólo se ven los nodos hasta `fog` pisos por delante
    const md = e.mod && D.mapMods[e.mod];
    const here = e.pending ? +e.pending.split('-')[0] : e.pos ? +e.pos.split('-')[0] : -1;
    const fogged = (n) => !!(md && md.fog && !readonly && n.type !== 'boss' && n.row > here + md.fog);
    // Separa los nodos hacia los lados (los mapas se generan entre 0.2 y 0.8)
    const xOf = (n) => Math.min(0.95, Math.max(0.05, 0.5 + (n.x - 0.5) * 1.45));
    const all = rows.flat();
    const byId = Object.fromEntries(all.map((n) => [n.id, n]));

    // Caminos (tierra con borde oscuro): recorridos, disponibles y el resto
    let lines = '', base = '';
    all.forEach((n) => n.links.forEach((lid) => {
      const m = byId[lid];
      const walked = cleared.has(n.id) && (cleared.has(lid) || e.pending === lid);
      const open = (e.pos === n.id && avail.includes(lid)) || (!e.pos && false);
      const cls = walked ? 'walked' : open ? 'open' : (cleared.has(n.id) || n.row < (byId[e.pos] ? byId[e.pos].row : -1)) ? 'gone' : '';
      const xy = `x1="${xOf(n) * 100}" y1="${yOf(n.row)}" x2="${xOf(m) * 100}" y2="${yOf(m.row)}"`;
      base += `<line ${xy} class="road-base ${cls}${fogged(m) ? ' fog' : ''}"/>`;
      lines += `<line ${xy} class="road ${cls}${fogged(m) ? ' fog' : ''}"/>`;
    }));
    // Atajos: línea discontinua hasta el nodo al que saltan
    all.filter((n) => n.jump && byId[n.jump]).forEach((n) => {
      const m = byId[n.jump];
      const used = (cleared.has(n.id) && (e.jumpTo === n.jump || cleared.has(n.jump) || e.pending === n.jump));
      lines += `<line x1="${xOf(n) * 100}" y1="${yOf(n.row)}" x2="${xOf(m) * 100}" y2="${yOf(m.row)}" class="jump${used ? ' walked' : ''}"/>`;
    });
    const svg = h('div', { class: 'exp-lines' });
    svg.innerHTML = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" width="100%" height="${H}">${base}${lines}</svg>`;

    // Nodos (teclas 1-n para los disponibles, de izquierda a derecha)
    const order = avail.slice().sort((a, b) => byId[a].x - byId[b].x);
    if (!readonly && !draw.on) order.forEach((id, i) => DK.keys.on(String(i + 1), () => go(id, refresh)));
    if (!readonly && draw.on) DK.keys.on('Escape', () => { draw.on = false; refresh(); });
    const nodes = all.map((n) => {
      if (fogged(n)) return h('span', { class: 'exp-node fog', style: { left: xOf(n) * 100 + '%', top: yOf(n.row) + 'px' }, tip: t('mod.fogNode') }, DK.icon('question', 18));
      const ty = E().TYPES[n.type];
      const state = cleared.has(n.id) ? 'done' : e.pending === n.id ? (readonly && e.outcome === 'lost' ? 'lost' : 'pending') : avail.includes(n.id) ? 'open' : 'locked';
      const key = order.indexOf(n.id);
      const b = h('button', {
        class: `exp-node t-${n.type} s-${state}` + (e.pos === n.id ? ' here' : '') + (n.secret ? ' secret' : ''), type: 'button',
        style: { left: xOf(n) * 100 + '%', top: yOf(n.row) + 'px' }, disabled: state !== 'open',
        tip: n.secret ? `${t('exp.node.secretBoss')} — ${D.secretBosses[e.zone].title}` : `${t('exp.node.' + n.type)} — ${t('exp.nodeDesc.' + n.type)}`, 'aria-label': t('exp.node.' + n.type),
        onClick: () => go(n.id, refresh),
      }, DK.icon(state === 'done' ? 'check' : ty.icon, n.type === 'boss' ? 40 : 28),
      key >= 0 && key < 9 ? h('kbd', { class: 'hotkey' }, key + 1) : null,
      // Los mini jefes (élite) dan una reliquia: se marca en el mapa
      n.type === 'elite' && state !== 'done' ? h('span', { class: 'node-relic' }, DK.icon('amulet', 12)) : null);
      return b;
    });
    const zone = D.zones[e.zone];
    // Tu daskai líder, de pie sobre el nodo en el que estás (o al que vas)
    const heroId = e.pending || e.pos;
    const leader = !readonly && heroId && byId[heroId] ? fighter() : null;
    const hero = leader ? h('span', { class: 'exp-hero', style: { left: xOf(byId[heroId]) * 100 + '%', top: yOf(byId[heroId].row) + 'px' }, 'aria-hidden': 'true' },
      V.sprite(leader.species, { look: DK.looks.of(leader), size: compact ? 34 : 50, shiny: leader.shiny })) : null;
    // Número de piso a la izquierda y decorados (árboles, rocas, matas) en los márgenes
    const floors = compact ? [] : rows.map((r, i) => h('span', { class: 'exp-floor', style: { top: yOf(i) + 'px' }, 'aria-hidden': 'true' }, String(i + 1)));
    const decor = mapDecor(e, H, all.map((n) => [xOf(n) * 100, yOf(n.row)]), compact);
    const editing = !readonly && draw.on;
    const marks = readonly ? e.marks || { lines: [], notes: [] } : E().marks();
    // Los dibujos se guardan en px del mapa normal: en la vista compacta se escalan
    const layer = compact ? marksLayer({ lines: (marks.lines || []).map((l) => ({ c: l.c, pts: l.pts.map(([x, y]) => [x, (y * ROW_COMPACT) / ROW_FULL]) })), notes: [] }, H, refresh, false) : marksLayer(marks, H, refresh, editing);
    const map = h('div', { class: 'exp-map' + (compact ? ' compact' : '') + (editing ? ' is-drawing' : ''), style: { height: H + 'px', '--z1': zone.colors[0], '--z2': zone.colors[1] } }, decor, floors, svg, nodes, hero, layer);
    // Clic derecho en el mapa: dibujar, nota aquí, deshacer, borrar
    if (!readonly) map.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const r = map.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = ev.clientY - r.top;
      const m = E().marks(), any = m.lines.length || m.notes.length;
      DK.ui.contextMenu({ x: ev.clientX, y: ev.clientY }, [
        { icon: 'edit', label: draw.on ? t('draw.stop') : t('draw.start'), onClick: () => { draw.on = !draw.on; draw.tool = 'pen'; refresh(); } },
        { icon: 'tag', label: t('draw.noteHere'), onClick: async () => { const text = await DK.ui.prompt(t('draw.noteTitle'), { placeholder: t('draw.notePh'), maxlength: 40, icon: 'edit' }); if (text) { E().addNote({ x, y, text, c: draw.color }); refresh(); } } },
        null,
        { icon: 'back', label: t('draw.undo'), disabled: !any, onClick: () => { E().undoMark(); refresh(); } },
        { icon: 'trash', label: t('draw.clear'), danger: true, disabled: !any, onClick: () => { E().clearMarks(); refresh(); } },
      ]);
    });
    // Centra la vista en los nodos disponibles
    // (se desplaza sólo la caja del mapa, no la página)
    setTimeout(() => {
      const box = map.parentElement; if (!box) return;
      if (!readonly && keepScroll != null) { box.scrollTop = keepScroll; return; }
      const el = map.querySelector('.s-open, .s-pending, .s-lost, .here');
      if (el) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2);
    }, 30);
    // Mientras se dibuja, se conserva la posición del mapa entre repintados
    if (!readonly) setTimeout(() => { const box = map.parentElement; if (box) box.addEventListener('scroll', () => { if (draw.on) keepScroll = box.scrollTop; }, { passive: true }); }, 40);
    if (!readonly && !draw.on) keepScroll = null;
    const terrain = { backgroundImage: `url(${DK.pix.terrain(zone.colors, e.zone)})`, '--z1': zone.colors[0], '--z2': zone.colors[1] };
    if (compact) return h('div', { class: 'exp-map-compact' }, h('div', { class: 'exp-scroll terrain', style: terrain }, map), legend());
    return h('div', { class: 'card exp-map-card' },
      h('div', { class: 'panel-head' }, DK.icon(zone.icon, 18), h('h3', null, zone.name),
        V.kindChip(e.kind || (e.map && e.map.kind)), V.sizeChip(e.size || (e.map && e.map.size)), V.modChip(e.mod || (e.map && e.map.mod)), V.endgameChips(e),
        h('span', { class: 'chip', tip: t('exp.depthTip') }, DK.icon('compass', 13), t('exp.depth', { n: e.depth || 1 })),
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(e.step, e.total), total: e.total })),
        readonly ? null : h('span', { class: 'grow' }),
        readonly ? null : btn({ icon: 'edit', label: draw.on ? t('draw.stop') : t('draw.start'), size: 'sm', variant: draw.on ? 'primary' : 'ghost', tip: t('draw.tip'), onClick: () => { draw.on = !draw.on; draw.tool = 'pen'; refresh(); } })),
      readonly ? null : relicBar(),
      editing ? drawBar(refresh) : null,
      h('div', { class: 'exp-scroll terrain', style: terrain }, map),
      legend());
  }
  /** Mapa de sólo lectura (resumen, vista previa en Zonas). opts: { compact } */
  DK.views.expMap = (src, opts) => mapView(() => {}, src, true, opts);

  /** Fila de reliquias activas (con su efecto en el tooltip). */
  function relicBar(list = DK.relics.list()) {
    if (!list.length) return null;
    return h('div', { class: 'relic-bar' }, list.map((r) => h('span', { class: 'relic-chip r-' + r.rarity, tip: `${r.name} — ${relicText(r)}` }, DK.icon(r.icon, 15), h('span', null, r.name))));
  }
  const relicText = (r) => t('relics.effect.' + r.effect.type, { n: Math.round((r.effect.pct || 0) * 100), add: r.effect.type === 'crit' || r.effect.type === 'capture' ? Math.round(r.effect.add * 100) : r.effect.add, house: r.effect.house ? DK.tr('houses', D.houses[r.effect.house]) : '', stat: r.effect.stat ? DK.tr('stats', D.stats[r.effect.stat]) : '' });
  DK.views.relicText = relicText;
  DK.views.relicBar = relicBar;

  /** Elegir reliquia (al empezar y tras vencer a un rival de élite). */
  function relicPanel(e, refresh) {
    const list = e.relicChoice.map((id) => D.relics[id]);
    const pick = (i) => { const id = DK.relics.choose(i); if (id) { DK.audio.sfx('levelup'); DK.ui.toast(t('relics.got', { name: D.relics[id].name }), { icon: D.relics[id].icon, kind: 'good' }); } refresh(); };
    list.forEach((r, i) => DK.keys.on(String(i + 1), () => pick(i)));
    const first = !e.cleared.length && !e.pending;
    return h('div', { class: 'card stack-s' },
      h('div', { class: 'exp-node-head t-relic' }, h('span', { class: 'exp-node-big t-relic' }, DK.icon('amulet', 28)),
        h('div', null, h('h3', null, first ? t('relics.startTitle') : t('relics.eliteTitle')), h('p', { class: 'muted small' }, t('relics.text')))),
      h('div', { class: 'relic-grid' }, list.map((r, i) => h('div', { class: 'relic-card r-' + r.rarity },
        h('span', { class: 'relic-icon' }, DK.icon(r.icon, 30)),
        h('b', null, r.name), V.rarity(r.rarity),
        h('p', { class: 'small' }, relicText(r)),
        btn({ icon: 'plus', label: t('relics.take'), variant: 'primary', hotkey: String(i + 1), onClick: () => pick(i) })))),
      first ? null : btn({ icon: 'next', label: t('relics.skip'), variant: 'ghost', onClick: () => pick(null) }));
  }

  /**
   * Pactos del mapa (data/curses.js): eliges cuáles aceptar antes de
   * empezar. Más dificultad a cambio de más monedas o reliquias.
   */
  function cursePanel(e, params, refresh) {
    params.curses = params.curses || [];
    const sel = params.curses;
    const toggle = (id) => { params.curses = sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat(id); DK.audio.sfx('select'); refresh(); };
    const confirm = () => { DK.curses.accept(sel); params.curses = null; if (sel.length) DK.audio.sfx('debuff'); refresh(); };
    e.curseOffer.forEach((id, i) => DK.keys.on(String(i + 1), () => toggle(id)));
    DK.keys.on('Enter', confirm);
    const coins = sel.reduce((a, id) => a + (D.curses[id].reward.coins || 0), 0);
    const relics = sel.reduce((a, id) => a + (D.curses[id].reward.relic || 0), 0);
    const reward = (c) => [c.reward.coins ? t('curse.rewardCoins', { n: Math.round(c.reward.coins * 100) }) : null, c.reward.relic ? t('curse.rewardRelic', { n: c.reward.relic }) : null].filter(Boolean).join(' · ');
    return h('div', { class: 'card stack' },
      h('div', { class: 'exp-node-head t-elite' }, h('span', { class: 'exp-node-big t-elite' }, DK.icon('skull', 28)),
        h('div', null, h('h3', null, t('curse.title', { n: e.depth || 1 })), h('p', { class: 'muted small' }, t('curse.text')))),
      h('div', { class: 'curse-grid' }, e.curseOffer.map((id, i) => {
        const c = D.curses[id], on = sel.includes(id);
        return h('button', { class: 'curse-card' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on, onClick: () => toggle(id) },
          h('span', { class: 'curse-icon' }, DK.icon(c.icon, 26)),
          h('b', null, t('curse.' + id + '.name')),
          h('p', { class: 'small' }, t('curse.' + id + '.desc')),
          h('span', { class: 'curse-reward' }, DK.icon('gift', 13), reward(c)),
          h('span', { class: 'curse-check' }, DK.icon(on ? 'check' : 'plus', 14), on ? t('curse.accepted') : t('curse.accept')),
          h('kbd', { class: 'hotkey' }, String(i + 1)));
      })),
      h('div', { class: 'row between wrap gap' },
        h('span', { class: 'small' }, sel.length ? [t('curse.total'), ' ', h('b', null, [coins ? t('curse.rewardCoins', { n: Math.round(coins * 100) }) : null, relics ? t('curse.rewardRelic', { n: relics }) : null].filter(Boolean).join(' · '))] : h('span', { class: 'muted' }, t('curse.none'))),
        btn({ icon: sel.length ? 'skull' : 'next', label: sel.length ? t('curse.go', { n: sel.length }) : t('curse.skip'), variant: sel.length ? 'primary' : 'tone', hotkey: '↵', onClick: confirm })));
  }

  /** Tras derrotar al jefe de un mapa: continuar más profundo o terminar y cobrar. */
  function choicePanel(refresh) {
    const c = E().choiceInfo();
    const nz = D.zones[c.next.zone];
    const goOn = () => { E().continueRun(); DK.audio.sfx('select'); refresh(); };
    const stop = () => { const s = E().complete(); DK.ui.toast(t('exp.cashed', { coins: s.coins }), { icon: 'coin', kind: 'good' }); DK.router.reset('expSummary'); };
    DK.keys.on('1', goOn); DK.keys.on('2', stop);
    return h('div', { class: 'card stack exp-choice' },
      h('div', { class: 'exp-node-head t-boss' }, h('span', { class: 'exp-node-big t-boss' }, DK.icon('crown', 28)),
        h('div', null, h('h3', null, t('exp.mapCleared', { n: c.depth })), h('p', { class: 'muted small' }, t('exp.choiceText')))),
      V.questResult(c.quest),
      h('div', { class: 'exp-choice-grid' },
        h('div', { class: 'exp-choice-card go', style: { '--z1': nz.colors[0], '--z2': nz.colors[1] } },
          h('span', { class: 'muted small' }, t('exp.nextMap', { n: c.depth + 1 })),
          h('h3', null, DK.icon(nz.icon, 20), ' ', nz.name),
          h('div', { class: 'chips' }, V.sizeChip(c.next.size, { big: true }), V.modChip(c.next.mod, { big: true }), h('span', { class: 'chip' }, `${t('common.lvl')} ${nz.levels[0] + c.nextBonus}-${nz.levels[1] + c.nextBonus}`),
            c.nextBonus ? h('span', { class: 'chip neg' }, DK.icon('skull', 12), t('exp.levelPlus', { n: c.nextBonus })) : null,
            h('span', { class: 'chip pos' }, DK.icon('amulet', 12), t('exp.newRelic')),
            h('span', { class: 'chip pos', tip: t('brief.rewardTip') }, DK.icon('emblem', 12), t('brief.rewardValue', { n: E().bossEmblems(c.next.size) }))),
          h('p', { class: 'small muted' }, t('exp.continueRisk')),
          btn({ icon: 'next', label: t('exp.continue'), variant: 'primary', hotkey: '1', disabled: !DK.party.aliveActive().length, onClick: goOn })),
        h('div', { class: 'exp-choice-card stop' },
          h('span', { class: 'muted small' }, t('exp.cashOut')),
          h('h3', null, V.coins(c.coins)),
          h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, `x${c.mult.toFixed(2)}`), h('span', { class: 'chip' }, DK.icon('gift', 12), t('exp.itemsN', { n: c.items }))),
          h('p', { class: 'small muted' }, t('exp.cashOutText')),
          btn({ icon: 'coin', label: t('exp.cashOut'), variant: 'tone', hotkey: '2', onClick: stop }))));
  }

  function legend() {
    return h('div', { class: 'chart-legend exp-legend' }, Object.entries(E().TYPES).map(([k, ty]) =>
      h('span', { class: 'legend-item', tip: t('exp.nodeDesc.' + k) }, h('span', { class: 'exp-legend-icon t-' + k }, DK.icon(ty.icon, 13)), t('exp.node.' + k))));
  }

  /* ---------- Panel del nodo ---------- */
  const cont = (refresh) => btn({ icon: 'next', label: t('exp.continuePath'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => { E().completeNode(); refresh(); } });
  const head = (type, title, text) => h('div', { class: 'exp-node-head t-' + type },
    h('span', { class: 'exp-node-big t-' + type }, DK.icon(E().TYPES[type].icon, 28)), h('div', null, h('h3', null, title), text ? h('p', { class: 'muted small' }, text) : null));

  function nodePanel(n, refresh) {
    const e = E().active();
    const done = (key, vars) => h('div', { class: 'stack-s' }, h('div', { class: 'warning good' }, DK.icon('check', 18), h('span', null, t(key, vars))), cont(refresh));
    const enterCont = () => DK.keys.on('Enter', () => { E().completeNode(); refresh(); });

    if (E().TYPES[n.type].battle) {
      DK.keys.on('Enter', () => fight());
      return h('div', { class: 'card stack-s' }, head(n.type, t('exp.node.' + n.type), t('exp.nodeDesc.' + n.type)),
        btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => fight() }));
    }

    if (n.type === 'treasure') {
      if (!e.result) {
        const open = () => { const r = E().openTreasure(); e.result = { key: 'treasure', items: r.items, coins: r.coins, recipe: r.recipe, relic: r.relic, runes: r.runes }; DK.audio.sfx('coin'); DK.store.save(); refresh(); };
        DK.keys.on('Enter', open);
        return h('div', { class: 'card stack chest-panel' }, head('treasure', t('exp.node.treasure'), t('exp.treasureText')),
          h('button', { class: 'chest-big closed', type: 'button', 'aria-label': t('exp.openChest'), onClick: open }, DK.icon('gift', 64), h('span', { class: 'chest-glow' })),
          btn({ icon: 'gift', label: t('exp.openChest'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: open }));
      }
      enterCont();
      // Botín del cofre en tarjetas: lo que es, para qué sirve y adónde va (mochila: ya; botín: al volver)
      const counts = {}; (e.result.items || []).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      let k = 0;
      const delay = () => ({ animationDelay: (k++ * 0.12) + 's' });
      const cards = [
        e.result.coins ? h('div', { class: 'loot-card coins', style: delay() }, h('span', { class: 'loot-icon' }, DK.icon('coin', 34)), h('b', null, '+' + e.result.coins.toLocaleString(DK.i18n.lang)), h('small', null, t('hub.coins')), h('span', { class: 'loot-dest loot' }, DK.icon('gift', 11), t('exp.destLoot'))) : null,
        ...Object.entries(counts).map(([id, n]) => {
          const it = D.items[id], bag = E().toBag(id);
          return h('div', { class: 'loot-card r-' + it.rarity, style: delay(), tip: it.desc },
            h('span', { class: 'loot-icon' }, V.itemIcon(it, 40), n > 1 ? h('span', { class: 'loot-n' }, '×' + n) : null),
            h('b', null, it.name), V.rarity(it.rarity),
            h('small', { class: 'muted' }, V.useText(it) || it.desc),
            h('span', { class: 'loot-dest ' + (bag ? 'bag' : 'loot'), tip: bag ? t('exp.toBagTip') : t('exp.toLoot') }, DK.icon(bag ? 'bag' : 'gift', 11), bag ? t('exp.destBag') : t('exp.destLoot')));
        }),
        e.result.relic ? (() => { const r = D.relics[e.result.relic]; return h('div', { class: 'loot-card relic r-' + r.rarity, style: delay() }, h('span', { class: 'loot-icon' }, DK.icon(r.icon, 36)), h('b', null, r.name), V.rarity(r.rarity), h('small', { class: 'muted' }, relicText(r)), h('span', { class: 'loot-dest relic' }, DK.icon('amulet', 11), t('exp.destRelic'))); })() : null,
        ...(e.result.runes || []).map((id) => { return h('div', { class: 'loot-card rune ' + V.runeRarity(id), style: delay(), tip: t('rune.help') }, h('span', { class: 'loot-icon' }, V.runeGem(id, 52)), h('b', null, V.runeName(id)), h('small', { class: 'muted' }, V.runeEffect(id)), ...V.runeAffixes(id).map((x) => h('small', { class: 'rune-aff' }, x)), h('span', { class: 'loot-dest rune' }, DK.icon('rune', 11), t('rune.dest'))); }),
        e.result.recipe ? (() => { const it = D.items[D.recipes.find((r) => r.id === e.result.recipe).result]; return h('div', { class: 'loot-card recipe', style: delay() }, h('span', { class: 'loot-icon' }, DK.icon('scroll', 34)), h('b', null, t('exp.newRecipe', { item: it.name })), h('small', { class: 'muted' }, t('exp.recipeShort')), h('span', { class: 'loot-dest relic' }, DK.icon('anvil', 11), t('nav.craft'))); })() : null,
      ];
      return h('div', { class: 'card stack chest-panel' }, head('treasure', t('exp.node.treasure'), t('exp.chestOpened')),
        h('div', { class: 'chest-big open', 'aria-hidden': 'true' }, DK.icon('gift', 48), h('span', { class: 'chest-glow' })),
        h('div', { class: 'loot-grid' }, cards),
        h('p', { class: 'muted small chest-legend' }, h('span', { class: 'loot-dest bag' }, DK.icon('bag', 11), t('exp.destBag')), ' ', t('exp.destBagHelp'), ' · ', h('span', { class: 'loot-dest loot' }, DK.icon('gift', 11), t('exp.destLoot')), ' ', t('exp.destLootHelp')),
        cont(refresh));
    }

    if (n.type === 'rest') {
      if (e.result) {
        enterCont();
        const pv0 = E().campfirePreview();
        return h('div', { class: 'card stack-s' }, head('rest', t('exp.node.rest')), done(e.result.key, e.result.vars),
          E().canCampfireExit() ? btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv0.pct, coins: pv0.coins }), variant: 'ghost', onClick: async () => {
            if (!(await DK.ui.confirm(t('exp.campExitQ'), t('exp.campExitText', { pct: pv0.pct, coins: pv0.coins, items: pv0.items }) + (pv0.recruits.length ? ' ' + t('exp.campExitRecruits', { names: pv0.recruits.join(', ') }) : ''), { okLabel: t('exp.campExit'), okIcon: 'home', icon: 'campfire' }))) return;
            const r = E().campfireExit(); DK.ui.toast(t('exp.campExited', { coins: r.coins }), { icon: 'campfire', kind: 'good' }); DK.router.reset('expSummary');
          } }) : null);
      }
      const team = DK.party.active();
      if (!e.trainUid || !team.some((d) => d.uid === e.trainUid)) e.trainUid = (fighter() || team[0]).uid;
      const rest = () => { const r = E().rest(); e.result = { key: 'exp.rested', vars: { n: r.pct } }; DK.audio.sfx('heal'); DK.store.save(); refresh(); };
      const train = async () => {
        const r = E().train(e.trainUid);
        if (!r) { DK.audio.sfx('error'); return; }
        e.result = { key: 'exp.trainedLevel', vars: { name: DK.daskai.name(r.d), n: r.d.level } };
        DK.store.save();
        if (r.levelInfo.levels.length) await V.levelUpDialog(r.d, r.levelInfo);
        for (const m of r.levelInfo.pending) await V.learnMovePrompt(r.d, m);
        if (r.levelInfo.evolveReady) await V.evolveDialog(r.d);
        refresh();
      };
      DK.keys.on('1', rest); DK.keys.on('2', train);
      // Volver a casa desde la hoguera: la mitad del botín y TODOS los daskai reclutados
      const pv = E().campfirePreview();
      const goHome = async () => {
        if (!E().canCampfireExit()) return;
        const text = t('exp.campExitText', { pct: pv.pct, coins: pv.coins, items: pv.items }) + (pv.recruits.length ? ' ' + t('exp.campExitRecruits', { names: pv.recruits.join(', ') }) : '');
        if (!(await DK.ui.confirm(t('exp.campExitQ'), text, { okLabel: t('exp.campExit'), okIcon: 'home', icon: 'campfire' }))) return;
        const r = E().campfireExit();
        DK.ui.toast(t('exp.campExited', { coins: r.coins }), { icon: 'campfire', kind: 'good' });
        DK.router.reset('expSummary');
      };
      if (E().canCampfireExit()) DK.keys.on('3', goHome);
      const exitBox = E().canCampfireExit()
        ? h('div', { class: 'camp-exit' },
          btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv.pct, coins: pv.coins }), variant: 'ghost', size: 'lg', hotkey: '3', onClick: goHome }),
          pv.recruits.length ? h('p', { class: 'small good-text' }, DK.icon('paw', 12), ' ', t('exp.campExitKeeps', { names: pv.recruits.join(', ') })) : null)
        : h('p', { class: 'muted small' }, DK.icon('lock', 12), ' ', t('exp.noRetreat'));
      // Dos opciones grandes: descansar (todo el equipo) o entrenar (eliges a quién: sube 1 nivel)
      const who = DK.party.get(e.trainUid);
      const trainBtn = (d) => btn({ icon: 'star', label: d ? t('exp.trainBtn', { name: DK.daskai.name(d), n: d.level + 1 }) : t('exp.train'), variant: 'tone', size: 'lg', hotkey: '2', cls: 'rest-train-btn', disabled: !d || d.level >= DK.config.maxLevel, onClick: train });
      let tBtn = trainBtn(who);
      const pick = (d, el) => {
        e.trainUid = d.uid; DK.audio.sfx('select');
        el.parentElement.querySelectorAll('.rest-pick').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        const nb = trainBtn(d); tBtn.replaceWith(nb); tBtn = nb;
      };
      const picks = h('div', { class: 'rest-picks', role: 'radiogroup', 'aria-label': t('exp.trainWho') }, team.map((d) => {
        const s = DK.daskai.stats(d), hp = DK.util.percent(d.cur.hp, s.hp), on = d.uid === e.trainUid, maxed = d.level >= DK.config.maxLevel;
        return h('button', { class: 'rest-pick' + (on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), disabled: maxed, tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`,
          onClick: (ev) => pick(d, ev.currentTarget) },
          V.dSprite(d, { size: 52 }), h('b', null, DK.daskai.name(d)),
          h('small', null, `${t('common.lvl')} ${d.level}`, h('span', { class: 'rest-up' }, ` → ${d.level + 1}`)),
          h('span', { class: 'rest-hp' }, h('i', { style: { width: hp + '%' } })));
      }));
      return h('div', { class: 'card stack rest-panel' }, head('rest', t('exp.node.rest'), t('exp.restText')),
        h('div', { class: 'rest-options' },
          h('section', { class: 'rest-opt' },
            h('span', { class: 'rest-opt-icon heal' }, DK.icon('bed', 28)),
            h('b', null, t('exp.restHeal')), h('p', { class: 'muted small' }, t('exp.restHealDesc', { n: Math.round(DK.config.expedition.restHeal * 100) })),
            h('div', { class: 'rest-team' }, team.map((d) => { const s = DK.daskai.stats(d); return h('span', { class: 'rest-mini', tip: `${DK.daskai.name(d)} ${d.cur.hp}/${s.hp}` }, V.dSprite(d, { size: 34 }), h('span', { class: 'rest-hp' }, h('i', { style: { width: DK.util.percent(d.cur.hp, s.hp) + '%' } }))); })),
            btn({ icon: 'bed', label: t('exp.restHeal'), variant: 'primary', size: 'lg', hotkey: '1', onClick: rest })),
          h('section', { class: 'rest-opt' },
            h('span', { class: 'rest-opt-icon train' }, DK.icon('star', 28)),
            h('b', null, t('exp.train')), h('p', { class: 'muted small' }, t('exp.trainDescLevel')),
            picks,
            tBtn)),
        exitBox);
    }

    if (n.type === 'cave') return cavePanel(e, refresh);
    if (n.type === 'shortcut') return shortcutPanel(n, refresh);

    if (n.type === 'recruit') return recruitPanel(e, refresh);
    if (n.type === 'shrine') return shrinePanel(e, refresh);

    if (n.type === 'shop') return merchantPanel(e, refresh);

    if (n.type === 'event') {
      const ev = D.events.find((x) => x.id === e.event) || D.events[0];
      const T = (k, v) => t(`events.${ev.id}.${k}`, v);
      if (e.result) {
        const r = e.result;
        if (r.fight) DK.keys.on('Enter', () => fight(r.fight)); else enterCont();
        return h('div', { class: 'card stack-s' }, head('event', T('title')),
          h('div', { class: 'warning ' + (r.fight ? 'warn' : 'good') }, DK.icon(r.fight ? 'skull' : ev.icon, 18), h('span', null, T('results.' + r.key, r.vars))),
          r.fight ? btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', size: 'lg', hotkey: '↵', onClick: () => fight(r.fight) }) : cont(refresh));
      }
      const ctx = E().ctx();
      return h('div', { class: 'card stack-s' }, head('event', T('title'), T('text')),
        h('div', { class: 'stack-s' }, ev.choices.map((c, i) => {
          const ok = !c.req || c.req(ctx);
          const pick = () => { if (E().resolveEvent(c.id)) { DK.audio.sfx('select'); DK.app.renderNav(); refresh(); } };
          if (ok) DK.keys.on(String(i + 1), pick);
          return btn({ icon: c.icon, label: T('choices.' + c.id), desc: ok ? T('desc.' + c.id) : T('need.' + c.id), variant: i === 0 ? 'primary' : 'tone', size: 'lg', hotkey: String(i + 1), disabled: !ok, onClick: pick });
        })));
    }
    return null;
  }

  /**
   * Mercader: la única tienda del juego. Comprar (unidades limitadas por
   * oferta) o vender lo que llevas. Se paga SÓLO con las monedas del botín
   * de esta expedición (lo vendido también va al botín).
   * Lista de filas (todas iguales, sin huecos raros). Cambiar la cantidad
   * o comprar redibuja sólo este panel, no la pantalla (sin parpadeos).
   */
  const shopUi = { mode: 'buy', qty: {} };
  function merchantPanel(e, refresh) {
    if (shopUi.node !== e.pending) { shopUi.node = e.pending; shopUi.mode = 'buy'; shopUi.qty = {}; }
    DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
    const card = h('div', { class: 'card stack-s merchant' });
    const draw = () => {
      const coins = e.loot.coins;
      const q = (k) => shopUi.qty[shopUi.mode + k] || 1;
      const sellable = DK.bag.list().filter((x) => DK.shop.canSell(x.item.id));
      const stepper = (k, n, max) => h('span', { class: 'mr-qty', role: 'group', 'aria-label': t('shop.qty') },
        h('button', { type: 'button', class: 'pk-btn', 'aria-label': '−', disabled: n <= 1, onClick: () => { shopUi.qty[shopUi.mode + k] = Math.max(1, n - 1); DK.audio.sfx('click'); draw(); } }, DK.icon('minus', 13)),
        h('b', null, String(n)),
        h('button', { type: 'button', class: 'pk-btn', 'aria-label': '+', disabled: n >= max, onClick: () => { shopUi.qty[shopUi.mode + k] = Math.min(max, n + 1); DK.audio.sfx('click'); draw(); } }, DK.icon('plus', 13)));
      const row = ({ id, price, left, k, sell, owned }) => {
        const it = D.items[id];
        const max = sell ? owned : left;
        const n = Math.max(1, Math.min(q(k), max || 1));
        const total = price * n, sold = !sell && left <= 0, cant = !sell && total > coins;
        const act = () => {
          if (sell) { DK.shop.sell(id, n); DK.audio.sfx('coin'); DK.ui.toast(t('shop.soldN', { item: it.name, n, coins: total }), { icon: 'coin', kind: 'good' }); }
          else if (E().buyOffer(k, n)) { DK.audio.sfx('coin'); DK.ui.toast(t('shop.bought', { item: it.name, n }), { icon: 'bag', kind: 'good' }); }
          else { DK.audio.sfx('error'); return; }
          shopUi.qty[shopUi.mode + k] = 1; draw();
          // el botín de la cabecera y de la barra también cambian (sin repintar la pantalla)
          if (DK.app.renderRes) DK.app.renderRes();
          document.querySelectorAll('[data-loot-coins]').forEach((el) => { el.textContent = t('exp.lootNow', { items: E().lootCount(), coins: e.loot.coins }); });
        };
        return h('div', { class: 'mr-row r-' + it.rarity + (sold ? ' sold' : ''), tip: it.desc },
          h('span', { class: 'mr-icon' }, V.itemIcon(it, 26)),
          h('span', { class: 'mr-main' }, h('b', null, it.name), h('span', { class: 'muted small' }, V.useText(it) || it.desc),
            h('span', { class: 'mr-meta small' }, V.rarity(it.rarity),
              sell ? h('span', { class: 'muted' }, t('shop.haveN', { n: owned })) : h('span', { class: left ? '' : 'muted' }, t('shop.left', { n: left })),
              h('span', { class: 'muted' }, DK.icon('bag', 11), ' ', DK.bag.count(id)))),
          h('span', { class: 'mr-price' }, DK.icon('coin', 15), h('b', null, price.toLocaleString(DK.i18n.lang))),
          sold ? h('span', { class: 'badge good mr-sold' }, DK.icon('check', 13), t('exp.sold'))
            : h('span', { class: 'mr-buy' }, max > 1 ? stepper(k, n, max) : null,
              btn({ icon: sell ? 'coin' : 'bag', label: (sell ? t('shop.sellFor', { n: total }) : t('shop.buyFor', { n: total })), size: 'sm', variant: sell ? 'tone' : cant ? 'ghost' : 'primary', disabled: cant,
                tip: cant ? t('shop.missing', { n: total - coins }) : null, onClick: act })));
      };
      const list = shopUi.mode === 'buy'
        ? (e.offers || []).map((o, i) => { if (o.left == null) o.left = o.sold ? 0 : 1; return row({ id: o.id, price: o.price, left: o.left, k: i }); })
        : sellable.map(({ item, qty }) => row({ id: item.id, price: DK.shop.sellPrice(item.id), k: item.id, sell: true, owned: qty }));
      const tabs = h('div', { class: 'mr-tabs', role: 'tablist' }, [['buy', 'bag', t('shop.buy')], ['sell', 'coin', `${t('shop.sell')} (${sellable.length})`]].map(([id, ic, label]) =>
        h('button', { class: 'mr-tab' + (shopUi.mode === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(shopUi.mode === id), onClick: () => { shopUi.mode = id; DK.audio.sfx('select'); draw(); } }, DK.icon(ic, 15), label)));
      card.replaceChildren(
        // «Seguir el camino» también arriba: no hace falta bajar si no quieres comprar
        h('div', { class: 'mr-top' }, head('shop', t('exp.node.shop'), t('exp.shopText2')),
          btn({ icon: 'next', label: t('exp.continuePath'), variant: 'tone', size: 'sm', cls: 'mr-skip', onClick: () => { E().completeNode(); refresh(); } })),
        h('div', { class: 'mr-bar' }, tabs,
          h('span', { class: 'mr-purse', tip: t('exp.lootCoinsTip') }, DK.icon('gift', 15), h('small', null, t('exp.loot')), V.coins(coins))),
        h('p', { class: 'muted small mr-note' }, shopUi.mode === 'buy' ? t('exp.payNoteLoot') : t('shop.sellHelpLoot', { n: Math.round(DK.config.sellRatio * 100) })),
        list.length ? h('div', { class: 'mr-list' }, list) : DK.ui.empty('coin', t('shop.nothingToSell'), ''),
        cont(refresh));
    };
    draw();
    return card;
  }

  /**
   * Cueva: guarida del jefe oculto de la zona (o un tesoro escondido).
   * Vencer al jefe oculto por primera vez lo desbloquea: desde entonces
   * puede aparecer como jefe final de los mapas de esta zona.
   */
  function cavePanel(e, refresh) {
    const sb = E().secretBoss();
    const rec = DK.world.secret(e.zone);
    const headEl = head('cave', t('exp.node.cave'), rec.defeated ? t('exp.caveTextKnown', { title: sb.title }) : t('exp.caveText'));
    if (!e.result) {
      const explore = () => { E().exploreCave(); DK.audio.sfx('select'); refresh(); };
      DK.keys.on('1', explore); DK.keys.on('2', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl,
        rec.defeated ? h('div', { class: 'warning good' }, DK.icon('check', 16), h('span', null, t('exp.secretKnown', { title: sb.title }))) : null,
        btn({ icon: 'compass', label: t('exp.caveExplore'), desc: t('exp.caveExploreDesc'), variant: 'primary', size: 'lg', hotkey: '1', onClick: explore }),
        btn({ icon: 'next', label: t('exp.caveSkip'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
    }
    const r = e.result;
    if (r.fight === 'secret') {
      DK.keys.on('1', () => fight('secret')); DK.keys.on('2', () => { E().completeNode(); refresh(); });
      const lvl = sb.level + E().levelBonus();
      return h('div', { class: 'card stack-s cave-lair' }, headEl,
        h('div', { class: 'lair' }, h('div', { class: 'lair-art' }, V.sprite(sb.species, { size: 120, cls: 'idle' })),
          h('div', { class: 'stack-s' }, h('span', { class: 'badge leader' }, DK.icon('crown', 12), t('exp.secretBoss')),
            h('h3', null, sb.title), h('span', { class: 'muted small' }, `${D.species[sb.species].name} · ${t('common.lvl')} ${lvl}`),
            h('p', { class: 'small' }, t('exp.events.' + r.key, r.vars)),
            h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('emblem', 12), t('emblem.plus', { n: E().bossEmblems() })),
              rec.defeated ? null : h('span', { class: 'chip pos' }, DK.icon('crown', 12), t('exp.secretUnlockChip')),
              sb.drops.slice(0, 2).map(([id]) => h('span', { class: 'chip' }, DK.icon(D.items[id].icon, 12), D.items[id].name))))),
        h('p', { class: 'muted small' }, DK.icon('alert', 12), ' ', t('exp.secretRisk')),
        btn({ icon: 'swords', label: t('exp.secretFight'), variant: 'primary', size: 'lg', hotkey: '1', onClick: () => fight('secret') }),
        btn({ icon: 'next', label: t('exp.secretLeave'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
    }
    DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'warning good' }, DK.icon('gift', 16), h('span', null, t('exp.events.caveTreasure'))),
      h('div', { class: 'chips' }, h('span', { class: 'chip pos' }, DK.icon('coin', 13), `+${r.coins}`),
        r.items.map((id) => h('span', { class: 'chip pos' }, DK.icon(D.items[id].icon, 13), D.items[id].name))), cont(refresh));
  }

  /** Atajo: saltar varios pisos a cambio de vida del equipo. */
  function shortcutPanel(n, refresh) {
    const e = E().active();
    const target = E().node(n.jump);
    const skip = target.row - n.row - 1;
    const cost = Math.round(DK.config.expedition.shortcutHpCost * 100);
    const take = () => { const r = E().takeShortcut(); if (!r) return; DK.audio.sfx('swap'); DK.ui.toast(t('exp.shortcutTaken', { n: r.skipped }), { icon: 'shortcut', kind: 'good' }); refresh(); };
    DK.keys.on('1', take); DK.keys.on('2', () => { E().completeNode(); refresh(); });
    return h('div', { class: 'card stack-s' }, head('shortcut', t('exp.node.shortcut'), t('exp.shortcutText', { n: skip })),
      h('div', { class: 'chips' }, h('span', { class: 'chip neg' }, DK.icon('heart', 12), t('exp.shortcutCost', { n: cost })),
        h('span', { class: 'chip pos' }, DK.icon('next', 12), t('exp.shortcutSkip', { n: skip })),
        h('span', { class: 'chip' }, DK.icon(E().TYPES[target.type].icon, 12), t('exp.shortcutTo', { node: t('exp.node.' + target.type) }))),
      h('p', { class: 'muted small' }, t('exp.shortcutHint')),
      btn({ icon: 'shortcut', label: t('exp.shortcutTake'), variant: 'primary', size: 'lg', hotkey: '1', onClick: take }),
      btn({ icon: 'next', label: t('exp.shortcutNo'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /** Santuario: bendice a un daskai para que se salve de la muerte una vez en esta expedición. */
  function shrinePanel(e, refresh) {
    const headEl = head('shrine', t('exp.node.shrine'), t('exp.shrineText'));
    if (e.result) {
      DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl, h('div', { class: 'warning good' }, DK.icon('sparkles', 18), h('span', null, t(e.result.key, e.result.vars))), cont(refresh));
    }
    const team = DK.party.active();
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'list' }, team.map((d, i) => {
        const pick = () => { E().bless(d.uid); DK.audio.sfx('levelup'); refresh(); };
        DK.keys.on(String(i + 1), pick);
        return V.daskaiRow(d, { compact: true, tags: e.blessed === d.uid ? [h('span', { class: 'badge good' }, DK.icon('sparkles', 13), t('exp.blessedTag'))] : [],
          actions: btn({ icon: 'sparkles', label: t('exp.bless'), size: 'sm', variant: 'primary', hotkey: String(i + 1), onClick: pick }) });
      })),
      e.blessed ? h('p', { class: 'muted small' }, t('exp.blessReplace')) : null,
      btn({ icon: 'next', label: t('exp.shrineSkip'), variant: 'ghost', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /**
   * Equipo completo al reclutar: el nuevo a la izquierda con TODOS sus
   * atributos y, al lado, cada miembro del equipo con los suyos y la
   * diferencia (▲ el nuevo tiene más · ▼ menos). «Sustituir» lo mete en ese
   * hueco; si no, se queda en reserva (sigue siendo tuyo al acabar).
   */
  function joinCompare(d, team, refresh) {
    const ns = DK.daskai.stats(d), keys = D.statKeys;
    const total = (st) => keys.reduce((a, k) => a + (st[k] || 0), 0);
    const head = (x, extra) => h('div', { class: 'rj-head' },
      h('span', { class: 'rj-art', style: { '--c': D.houseColor(DK.daskai.species(x).house) } }, V.dSprite(x, { size: extra ? 72 : 46 })),
      h('div', { class: 'grow stack-xs' },
        h('div', { class: 'row gap-s wrap' }, h('b', null, DK.daskai.name(x)), V.level(x.level), V.shinyTag(x)),
        h('div', { class: 'row gap-s wrap' }, V.houseBadge(DK.daskai.species(x).house), V.roleBadge(x), extra ? V.tempTag(x) : null)));
    const statRows = (st, ref) => h('div', { class: 'rj-stats' }, keys.map((k) => {
      const diff = ref ? ns[k] - st[k] : 0;
      return h('div', { class: 'rj-stat k-' + k, tip: DK.tr('stats', D.stats[k]) },
        DK.icon(D.stats[k].icon, 13), h('span', { class: 'rj-k' }, D.stats[k].short || k), h('b', null, st[k]),
        ref ? h('span', { class: 'rj-diff ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'eq') }, diff > 0 ? '▲' + diff : diff < 0 ? '▼' + -diff : '=') : null);
    }));
    const nTot = total(ns);
    const newCard = h('div', { class: 'rj-new' },
      h('span', { class: 'rj-tag' }, DK.icon('paw', 12), t('exp.joinNew')),
      head(d, true),
      h('div', { class: 'chips' },
        h('span', { class: 'chip', tip: DK.tr('natures', D.natures[d.nature], 'desc') }, DK.icon('leaf', 12), DK.tr('natures', D.natures[d.nature])),
        h('span', { class: 'chip', tip: DK.tr('passives', D.passives[d.passive], 'desc') }, DK.icon('sparkle', 12), DK.tr('passives', D.passives[d.passive]))),
      statRows(ns),
      h('div', { class: 'rj-total' }, t('exp.joinTotal'), h('b', null, nTot)));
    const mates = team.map((x, i) => {
      const st = DK.daskai.stats(x), tTot = total(st), hp = DK.daskai.hpPct(x);
      const better = keys.filter((k) => ns[k] > st[k]).length;
      return h('div', { class: 'rj-mate' + (nTot > tTot ? ' weaker' : '') },
        head(x),
        h('div', { class: 'rj-hp', tip: `${x.hp}/${st.hp}` }, h('i', { style: { width: Math.round(hp * 100) + '%' } })),
        statRows(st, true),
        h('div', { class: 'rj-foot' },
          h('span', { class: 'small ' + (better >= 4 ? 'good-text' : 'muted') }, t('exp.joinBetter', { n: better, max: keys.length })),
          btn({ icon: 'swap', label: t('detail.replaceHere'), size: 'sm', variant: nTot > tTot ? 'primary' : 'tone', onClick: () => { DK.party.placeAt(d.uid, i); DK.audio.sfx('select'); refresh(); } })));
    });
    return h('div', { class: 'rj' },
      h('p', { class: 'small' }, DK.icon('swap', 14), ' ', t('exp.teamFull', { name: DK.daskai.name(d) })),
      h('div', { class: 'rj-body' }, newCard, h('div', { class: 'rj-team' }, mates)),
      h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('exp.joinHelp')));
  }

  /** Nodo de reclutamiento: eliges uno de los daskai (se une como temporal). */
  function recruitPanel(e, refresh) {
    const headEl = head('recruit', t('exp.node.recruit'), t('exp.recruitText'));
    if (e.result) {
      const d = DK.party.get(e.result.uid);
      const team = DK.party.active();
      const full = d && !DK.party.isActive(d.uid);
      DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
      return h('div', { class: 'card stack-s' }, headEl,
        h('div', { class: 'warning good' }, DK.icon('paw', 18), h('span', null, t(e.result.key, e.result.vars))),
        h('p', { class: 'muted small' }, t('exp.tempRule')),
        full ? joinCompare(d, team, refresh) : null,
        cont(refresh));
    }
    const cands = e.candidates || [];
    return h('div', { class: 'card stack-s' }, headEl,
      h('div', { class: 'recruit-grid' }, cands.map((c, i) => {
        const sp = D.species[c.species];
        const pick = () => { if (E().recruit(i)) { DK.audio.sfx('levelup'); DK.app.renderNav(); refresh(); } };
        DK.keys.on(String(i + 1), pick);
        const s = DK.daskai.stats(Object.assign({}, c, { wild: false }));
        return h('div', { class: 'recruit-card', style: { '--c': D.houseColor(sp.house) } },
          h('div', { class: 'recruit-art' }, V.dSprite(c, { size: 84, cls: 'float' })),
          h('div', { class: 'row gap-s wrap' }, h('b', null, sp.name), V.level(c.level), V.shinyTag(c)),
          h('div', { class: 'row gap-s wrap' }, V.houseBadge(sp.house), V.roleBadge(c)),
          h('div', { class: 'chips' },
            h('span', { class: 'chip', tip: DK.tr('natures', D.natures[c.nature], 'desc') }, DK.icon('leaf', 13), DK.tr('natures', D.natures[c.nature])),
            h('span', { class: 'chip', tip: DK.tr('passives', D.passives[c.passive], 'desc') }, DK.icon('sparkle', 13), DK.tr('passives', D.passives[c.passive])),
            DK.tracking.count(c.species) ? h('span', { class: 'chip track-chip', tip: t('track.tip', { n: DK.tracking.count(c.species) }) }, DK.icon('target', 13), t('track.chip', { n: (DK.tracking.bonus(c.species) * 100).toFixed(1).replace('.0', '') })) : null),
          h('div', { class: 'recruit-stats' }, ['hp', 'atk', 'matk', 'spd'].map((k) => h('span', { tip: DK.tr('stats', D.stats[k]) }, DK.icon(D.stats[k].icon, 13), h('b', null, s[k])))),
          btn({ icon: 'plus', label: t('exp.recruitPick'), variant: 'primary', hotkey: String(i + 1), onClick: pick }));
      })),
      btn({ icon: 'next', label: t('exp.recruitSkip'), variant: 'ghost', onClick: () => { E().completeNode(); refresh(); } }));
  }

  /* ---------- Panel de estado (sin nada pendiente) ---------- */
  /* ---------- Barra de estado (iconos sobre el mapa) ----------
   * Cada icono muestra un número y, al pulsarlo, despliega su detalle
   * debajo (params.hud = id). El equipo se ve como mini retratos con su
   * vida: pulsar uno lo elige para el siguiente combate.
   */
  function hudDetail(id, refresh) {
    const e = E().active();
    const items = Object.entries(e.loot.items);
    switch (id) {
      case 'loot': return h('div', { class: 'stack-s' },
        h('div', { class: 'row gap-s wrap' }, h('b', null, t('exp.loot')), V.coins(e.loot.coins)),
        items.length ? h('div', { class: 'chips' }, items.map(([iid, n]) => h('span', { class: 'chip' }, DK.icon(D.items[iid].icon, 13), `${D.items[iid].name} x${n}`))) : h('p', { class: 'muted small' }, t('exp.lootEmpty')),
        h('p', { class: 'muted small' }, t('exp.lootRule', { n: Math.round((E().bonusMult(Math.max(1, e.zones.length)) - 1) * 100) })));
      case 'relics': return DK.relics.list().length
        ? h('div', { class: 'list' }, DK.relics.list().map((r) => h('div', { class: 'relic-row r-' + r.rarity }, h('span', { class: 'relic-icon sm' }, DK.icon(r.icon, 18)), h('div', { class: 'grow' }, h('b', null, r.name), h('div', { class: 'muted small' }, relicText(r))))))
        : h('p', { class: 'muted small' }, t('exp.noRelics'));
      case 'saves': return h('div', { class: 'stack-s' },
        h('p', { class: 'small' }, t('exp.revivesLeft', { n: E().revivesLeft() }), DK.bag.count('pluma_fenix') ? ' · ' + t('exp.feathers', { n: DK.bag.count('pluma_fenix') }) : ''),
        e.blessed && DK.party.get(e.blessed) ? h('p', { class: 'small' }, DK.icon('sparkles', 13), ' ', t('exp.blessedNow', { name: DK.daskai.name(DK.party.get(e.blessed)) })) : null,
        h('p', { class: 'muted small' }, t('exp.revivesHelp')));
      case 'recruits': return E().recruits().length
        ? h('div', { class: 'stack-s' }, h('div', { class: 'chips' }, E().recruits().map((d) => h('span', { class: 'chip' }, DK.icon('paw', 13), `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`))), h('p', { class: 'muted small' }, t('exp.tempRule')))
        : h('p', { class: 'muted small' }, t('exp.noRecruits'));
      case 'pack': {
        const list = DK.bag.list().filter(({ item }) => item.category !== 'pieza');
        return h('div', { class: 'stack-s' },
          list.length ? h('div', { class: 'chips' }, list.map(({ item, qty }) => h('span', { class: 'chip' }, DK.icon(item.icon, 13), `${item.name} x${qty}`))) : h('p', { class: 'muted small' }, t('pack.empty')),
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'bag', label: t('nav.pack'), size: 'sm', variant: 'tone', onClick: () => DK.router.go('inventory') }),
            btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(DK.party.active())) refresh(); } })));
      }
      case 'emblems': return h('div', { class: 'stack-s' },
        h('p', { class: 'small' }, t('emblem.have', { n: DK.camp.emblems() }), (e.log.emblems ? ' · ' + t('emblem.thisRun', { n: e.log.emblems }) : '')),
        h('p', { class: 'muted small' }, t('emblem.help')));
      case 'quest': return V.questCard();
      case 'curses': return h('div', { class: 'list' }, DK.curses.active().map((cid) => h('div', { class: 'relic-row' }, h('span', { class: 'relic-icon sm' }, DK.icon(D.curses[cid].icon, 18)),
        h('div', { class: 'grow' }, h('b', null, t('curse.' + cid + '.name')), h('div', { class: 'muted small' }, t('curse.' + cid + '.desc'))))));
      default: return null;
    }
  }

  /* ---------- Barra del equipo ----------
   * Vida y maná de cada miembro con números, su estado y un botón para
   * curarlo con un toque (DK.healer elige los objetos más baratos que
   * bastan). Pulsar la tarjeta lo elige para el siguiente combate.
   */
  function quickHeal(d, refresh) {
    const plan = DK.healer.plan([d]);
    if (!plan.uses.length) { DK.audio.sfx('error'); DK.ui.toast(t('heal.noItems'), { icon: 'flask', kind: 'bad' }); return; }
    DK.healer.apply(plan);
    DK.audio.sfx('heal');
    const used = Object.entries(plan.totals).map(([id, n]) => `${D.items[id].name}${n > 1 ? ' x' + n : ''}`).join(', ');
    DK.ui.toast(t('team.healed', { name: DK.daskai.name(d), items: used }), { icon: 'heart', kind: 'good' });
    refresh();
  }
  /*
   * Siempre DK.config.maxTeam huecos (como el equipo de Pokémon): con uno
   * o dos daskai no se estiran, y los huecos libres llevan a Equipo para
   * meter a quien va contigo. Cada ficha: retrato, nombre y nivel, vida y
   * maná finos, y un frasco para curarlo de un toque. El que lucha el
   * siguiente combate lleva el marco dorado y la cinta «Lucha».
   */
  function teamBar(refresh) {
    const e = E().active(), cur = fighter();
    const team = DK.party.active();
    const hurt = (d) => !DK.daskai.isFainted(d) && (DK.daskai.hpPct(d) < 1 || d.cur.mp < DK.daskai.stats(d).mp || !!d.status);
    const canHeal = (d) => hurt(d) && DK.healer.plan([d]).uses.length > 0;   // herido y con objetos que sirvan
    const anyHurt = team.some(canHeal);
    const waiting = DK.party.all().some((d) => !DK.party.isActive(d.uid) && DK.party.canJoin(d.uid));
    const slots = [];
    for (let i = 0; i < DK.config.maxTeam; i++) {
      const d = team[i];
      if (!d) {
        slots.push(h('button', { class: 'tb-slot tb-empty', type: 'button', tip: waiting ? t('team.emptyExpTip') : t('party.empty'), 'aria-label': t('party.empty'), onClick: () => DK.router.go('team') },
          h('span', { class: 'tb-ball', 'aria-hidden': 'true' }), waiting ? DK.icon('plus', 14) : null));
        continue;
      }
      const sp = DK.daskai.species(d), s = DK.daskai.stats(d), dead = DK.daskai.isFainted(d), lead = cur && cur.uid === d.uid;
      const hp = DK.util.percent(d.cur.hp, s.hp), mp = DK.util.percent(d.cur.mp, s.mp);
      const pick = () => { if (dead) return; e.leader = d.uid; DK.store.save(); DK.audio.sfx('select'); refresh(); };
      slots.push(h('div', { class: 'tb-slot tb-card' + (lead ? ' leader' : '') + (dead ? ' ko' : hp < 35 ? ' low' : '') + (d.status ? ' has-status' : ''), role: 'button', tabindex: dead ? '-1' : '0', 'aria-pressed': String(!!lead), style: { '--c': D.houseColor(sp.house) },
        tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level} · ${t('common.hpShort')} ${d.cur.hp}/${s.hp}` + (dead ? ' · ' + t('common.fainted') : lead ? ' · ' + t('battle.nextFighter') : ' · ' + t('team.pickNext', { name: DK.daskai.name(d) })),
        onClick: pick, onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } } },
        lead ? h('span', { class: 'tb-lead' }, DK.icon('swords', 11), h('span', null, t('team.fights'))) : null,
        h('span', { class: 'tb-sprite' }, V.sprite(d.species, { look: DK.looks.of(d), size: 44, shiny: d.shiny }), dead ? h('span', { class: 'tb-ko' }, DK.icon('skull', 14)) : null),
        h('span', { class: 'tb-body' },
          h('span', { class: 'tb-name' }, h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`), d.status ? V.statusTag(d.status) : null),
          h('span', { class: 'tb-bar hp' + (hp < 25 ? ' crit' : hp < 50 ? ' mid' : '') }, h('span', { style: { width: hp + '%' } })),
          h('span', { class: 'tb-nums' }, h('em', null, `${d.cur.hp}/${s.hp}`), h('i', { class: 'tb-bar mp' }, h('span', { style: { width: mp + '%' } })))),
        canHeal(d) ? h('button', { class: 'tb-heal', type: 'button', 'aria-label': t('team.healOne', { name: DK.daskai.name(d) }), tip: t('team.healOne', { name: DK.daskai.name(d) }),
          onClick: (ev) => { ev.stopPropagation(); quickHeal(d, refresh); } }, DK.icon('flask', 15)) : null));
    }
    return h('section', { class: 'tb-wrap', 'aria-label': t('team.barTitle') },
      h('div', { class: 'tb-grid' }, slots),
      h('button', { class: 'tb-all', type: 'button', disabled: !anyHurt, tip: anyHurt ? t('team.healAll') : t('heal.nothingToHeal'), 'aria-label': t('team.healAll'),
        onClick: async () => { if (await V.healDialog(team)) refresh(); } }, DK.icon('flask', 18), h('span', null, t('team.healAllShort'))));
  }

  /**
   * Barra del equipo + barra de estado. Ninguna de las dos repinta la
   * pantalla entera al usarlas (así el mapa no parpadea): se rehacen solas
   * con `redraw`. El detalle de cada icono se abre en una ventanita flotante
   * bajo la barra (no empuja el mapa) y se cierra al pulsar fuera o con Esc.
   */
  let hudOutside = null;
  function hud(params, refresh) {
    let teamEl, barEl;
    const redraw = () => {
      if (!teamEl.isConnected) return;
      const t2 = teamBar(redraw), b2 = hudBar(params, redraw);
      teamEl.replaceWith(t2); barEl.replaceWith(b2); teamEl = t2; barEl = b2;
    };
    teamEl = teamBar(redraw); barEl = hudBar(params, redraw);
    return [teamEl, barEl];
  }
  function hudBar(params, redraw) {
    const e = E().active();
    if (hudOutside) { document.removeEventListener('pointerdown', hudOutside, true); document.removeEventListener('keydown', hudOutside, true); hudOutside = null; }
    const toggle = (id) => { params.hud = params.hud === id ? null : id; DK.audio.sfx('select'); redraw(); };
    const item = (id, ic, value, label, cls = '') => h('button', { class: 'hud-btn ' + cls + (params.hud === id ? ' on' : ''), type: 'button', 'data-hud': id, tip: label, 'aria-label': `${label}: ${value}`, 'aria-expanded': String(params.hud === id), onClick: () => toggle(id) },
      DK.icon(ic, 17), h('span', { class: 'hud-val' }, h('b', null, String(value)), h('small', { class: 'hud-cap' }, label)));
    const pack = DK.bag.list().filter(({ item: it }) => it.category !== 'pieza').reduce((a, x) => a + x.qty, 0);
    const bar = h('div', { class: 'exp-hud' },
      h('div', { class: 'hud-group' },
        item('loot', 'gift', e.loot.coins, t('exp.loot'), 'gold'),
        item('pack', 'bag', pack, t('nav.pack')),
        item('relics', 'amulet', DK.relics.list().length, t('relics.title')),
        DK.rules.permadeath() || E().revivesLeft() ? item('saves', 'sparkles', E().revivesLeft(), t('exp.revivesTitle')) : null,
        E().recruits().length ? item('recruits', 'paw', E().recruits().length, t('exp.recruits')) : null,
        DK.curses.active().length ? item('curses', 'skull', DK.curses.active().length, t('curse.active'), 'bad') : null,
        item('emblems', 'emblem', DK.camp.emblems(), t('emblem.title'), 'emblem')),
      E().quest() ? h('button', { class: 'hud-quest' + (params.hud === 'quest' ? ' on' : ''), type: 'button', 'data-hud': 'quest', 'aria-expanded': String(params.hud === 'quest'), onClick: () => toggle('quest') }, V.questChip()) : null,
      h('span', { class: 'grow' }),
      // Ya no hay retirada en cualquier momento: se vuelve a casa desde las hogueras
      h('span', { class: 'hud-lock muted small', tip: DK.rules.canRetreat() ? t('exp.exitRuleTip') : t('exp.noRetreat') }, DK.icon(DK.rules.canRetreat() ? 'campfire' : 'lock', 14), h('span', { class: 'hud-label' }, DK.rules.canRetreat() ? t('exp.exitRule') : '')));
    const content = params.hud ? hudDetail(params.hud, redraw) : null;
    const LABEL = { loot: t('exp.loot'), pack: t('nav.pack'), relics: t('relics.title'), saves: t('exp.revivesTitle'), recruits: t('exp.recruits'), curses: t('curse.active'), emblems: t('emblem.title'), quest: t('quest.title') };
    const pop = content ? h('div', { class: 'exp-hud-pop', role: 'dialog', 'aria-label': LABEL[params.hud] || '' },
      h('div', { class: 'hud-pop-head' }, h('b', null, LABEL[params.hud] || ''),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onClick: () => toggle(params.hud) }, DK.icon('x', 15))),
      content) : null;
    const wrap = h('div', { class: 'exp-hud-wrap' }, bar, pop);
    if (pop) {
      // Coloca la ventanita bajo su botón (en móvil, a todo el ancho)
      requestAnimationFrame(() => {
        const b = bar.querySelector(`[data-hud="${params.hud}"]`);
        if (!b || !wrap.isConnected) return;
        const wr = wrap.getBoundingClientRect(), br = b.getBoundingClientRect();
        if (wr.width > 640) pop.style.left = Math.max(0, Math.min(br.left - wr.left, wr.width - pop.offsetWidth)) + 'px';
      });
      hudOutside = (ev) => {
        if (!wrap.isConnected) { document.removeEventListener('pointerdown', hudOutside, true); document.removeEventListener('keydown', hudOutside, true); hudOutside = null; return; }
        if (ev.type === 'keydown' ? ev.key === 'Escape' : !wrap.contains(ev.target)) { params.hud = null; redraw(); if (ev.type === 'keydown') ev.stopPropagation(); }
      };
      setTimeout(() => { if (hudOutside) { document.addEventListener('pointerdown', hudOutside, true); document.addEventListener('keydown', hudOutside, true); } }, 0);
    }
    return wrap;
  }

  /* ---------- Modo expedición ----------
   * Mientras hay una expedición en curso sólo se puede ir a estas
   * pantallas: el resto (inicio, crafteo, mejoras, códice...) espera en
   * casa. La navegación sólo muestra Mapa, Equipo y Mochila (`expedition`
   * en DK.menus.add('nav', ...)).
   */
  const EXP_SCREENS = ['expedition', 'battle', 'team', 'inventory', 'expSummary', 'gameOver', 'mainMenu', 'newGame', 'goodbye'];
  DK.router.guard = (id) => {
    if (!DK.store.state || !E().active() || EXP_SCREENS.includes(id)) return null;
    // Aviso sólo si se intenta salir desde la propia expedición (no al cargar la partida)
    const cur = DK.router.current();
    if (cur && !['mainMenu', 'newGame', 'battle'].includes(cur.id)) DK.ui.toast(t('exp.focusOnly'), { icon: 'flag' });
    return { id: 'expedition' };
  };
  /*
   * Fondo de la zona durante la expedición: la escena de la zona actual,
   * oscurecida, detrás de todas las pantallas (mapa, equipo, mochila).
   * En combate la escena va dentro de la arena.
   */
  DK.on('screen:enter', ({ id }) => {
    const e = E().active();
    let bd = document.getElementById('zone-backdrop');
    const on = !!e && ['expedition', 'team', 'inventory', 'battle'].includes(id);
    document.body.classList.toggle('in-exp', on);
    if (!on) { if (bd) bd.classList.remove('on'); return; }
    const z = D.zones[e.zone];
    if (!bd) { bd = h('div', { id: 'zone-backdrop', 'aria-hidden': 'true' }); document.body.prepend(bd); }
    if (bd.dataset.zone !== z.id) {
      bd.dataset.zone = z.id;
      bd.style.setProperty('--z1', z.colors[0]); bd.style.setProperty('--z2', z.colors[1]);
      bd.replaceChildren(h('div', { class: 'zb-sky' }), DK.scenes.render(z.scene, z.colors));
    }
    requestAnimationFrame(() => bd.classList.add('on'));
  });

  DK.menus.add('nav', { id: 'expmap', icon: 'map', order: 5, screen: 'expedition', expedition: 'only', label: () => t('nav.expMap'), badge: () => (E().active() && E().active().awaitingChoice ? '!' : '') });

  /** Tarjeta de la barra lateral durante una expedición: zona, mapa y piso. */
  DK.views.expNavCard = (e) => {
    const z = D.zones[e.zone];
    return h('button', { class: 'nav-exp', type: 'button', style: { '--z1': z.colors[0], '--z2': z.colors[1] }, onClick: () => DK.router.reset('expedition') },
      h('span', { class: 'nav-exp-icon' }, DK.icon(z.icon, 20)),
      h('span', { class: 'nav-profile-text' }, h('b', null, z.name),
        h('span', { class: 'muted small' }, `${t('exp.depth', { n: e.depth || 1 })} · ${t('exp.floor', { step: Math.min(e.step, e.total), total: e.total })}`)));
  };

  DK.screens.register('expedition', {
    title: () => { const e = E().active(); return e ? t('exp.title', { zone: D.zones[e.zone].name }) : t('exp.titleNone'); },
    icon: 'flag', section: 'battle', music: () => DK.audio.zoneTrack(), tutorial: 'expedition',
    render(params) {
      const refresh = () => DK.router.refresh();
      const e = E().active();
      if (!e) return h('div', { class: 'screen' }, DK.ui.empty('flag', t('exp.none'), t('exp.noneText')),
        btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') }));
      E().ensureMap(); E().ensureFields();
      DK.audio.music(DK.audio.zoneTrack()); // al pasar a un mapa nuevo cambia la música de la zona
      // Cortinilla al llegar a un mapa nuevo (una vez por mapa)
      const introKey = `${e.depth || 1}|${e.seed}`;
      if (e.introShown !== introKey) {
        e.introShown = introKey; DK.store.save();
        const z = D.zones[e.zone];
        const sub = [t('exp.depth', { n: e.depth || 1 }), t('size.label', { name: t('size.' + (e.size || 'small') + '.name'), n: E().sizeFloors(e.size) }), e.mod ? t('mod.' + e.mod + '.name') : null].filter(Boolean).join(' · ');
        DK.fx.curtain({ title: z.name, subtitle: sub, icon: z.icon, colors: z.colors, kind: 'zone' });
      }
      const pend = E().pendingNode();
      // Vista centrada: mientras eliges una reliquia o estás en un nodo sin combate
      // (mercader, suceso, descanso, cofre, reclutas) el mapa se oculta.
      const focus = e.awaitingChoice ? choicePanel(refresh) : e.curseOffer ? cursePanel(e, params, refresh) : (e.relicChoice && e.relicChoice.length) ? relicPanel(e, refresh) : pend && !E().TYPES[pend.type].battle ? nodePanel(pend, refresh) : null;
      if (focus) {
        setTimeout(() => window.scrollTo({ top: 0 }), 0);
        const zone = D.zones[e.zone];
        return h('div', { class: 'screen exp-screen exp-focus' },
          h('div', { class: 'exp-focus-bar', style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
            DK.icon(zone.icon, 18), h('b', null, zone.name),
            V.kindChip(e.kind), V.sizeChip(e.size), V.modChip(e.mod), e.awaitingChoice ? null : V.questChip(),
            h('span', { class: 'chip', tip: t('exp.depthTip') }, DK.icon('compass', 13), t('exp.depth', { n: e.depth || 1 })),
            h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(e.step, e.total), total: e.total })),
            h('span', { class: 'chip', tip: t('exp.lootCoinsTip') }, DK.icon('gift', 13), h('span', { 'data-loot-coins': '1' }, t('exp.lootNow', { items: E().lootCount(), coins: e.loot.coins }))),
            h('span', { class: 'grow' }), relicBar()),
          h('div', { class: 'exp-focus-body' }, focus));
      }
      // Mapa a todo el ancho con la barra de estado encima (o el nodo pendiente al lado)
      return h('div', { class: 'screen exp-screen' }, hud(params, refresh),
        pend ? h('div', { class: 'exp-layout' }, mapView(refresh), h('div', { class: 'exp-side' }, nodePanel(pend, refresh))) : mapView(refresh));
    },
  });
})();
