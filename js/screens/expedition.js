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
    if (size === 'abyss') return null; // v5.1: el Abismo no tiene tamaño (es una serie de jefes)
    const sz = DK.config.expedition.sizes[size] || { icon: 'map' };
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

  /** v5.1: texto de un jefe de la serie del Abismo («Jefe 2 de 5: …»). */
  function abossText(n) {
    const e = E().active(), list = DK.abyss.series(e.startZone || e.zone), b = D.zones[n.bossZone].boss;
    return t('exp.nodeDesc.abossOf', { i: (n.round || 0) + 1, n: list.length, title: b.title, zone: D.zones[n.bossZone].name });
  }

  /** Daskai que luchará en el siguiente combate (el elegido o el primero en pie). */
  function fighter() {
    const e = E().active(), alive = DK.party.aliveActive();
    // v5.10: si cambiaste el primero del equipo (Equipo → líder), ése pasa a luchar en el siguiente combate
    const first = DK.party.active()[0];
    if (first && e.leaderFirst !== first.uid) { e.leaderFirst = first.uid; e.leader = first.uid; DK.store.save(); }
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
    // v5.1: jefes de la serie del Abismo (en el fondo de su propia zona, no son el jefe del final)
    if (type === 'aboss') { DK.router.go('battle', { zone: n.bossZone, leaderUid: d.uid, boss: true, final: false, abyssRound: n.round, node: n.id }); return; }
    DK.router.go('battle', { zone: e.zone, leaderUid: d.uid, boss: type === 'boss' || type === 'secret', secret, final: type === 'boss', elite: type === 'elite', node: n.id, abyssRound: n.round != null ? n.round : undefined, wave: !kind && type === 'fight' && (n.special === 'chain' || n.special === 'swap') ? n.special : undefined });
  }

  /** Va a un nodo del mapa. */
  /** v4.68: dónde estabas mirando el mapa (página y caja del mapa) al entrar en un piso; al volver se recupera. */
  let mapMem = null;
  const memKey = (e) => `${e.seed}|${e.depth || 1}`;
  /** v5.4: dónde estaba el líder en el mapa la última vez (para que camine de un nodo al siguiente). */
  let heroPrev = null;
  // Mover la página también cuenta (sólo mientras se ve el mapa completo)
  let memBound = false, memQuiet = 0; // memQuiet: tras pintar el mapa, un momento sin apuntar (la app sube la página al cambiar de pantalla)
  function bindMem() {
    if (memBound) return; memBound = true;
    const onScroll = () => { if (Date.now() > memQuiet && DK.router.current().id === 'expedition' && document.querySelector('.exp-map-card .exp-scroll:not(.flying)') && !document.querySelector('.exp-focus')) rememberMap(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  }
  function rememberMap() {
    const e = E().active(), box = document.querySelector('.exp-map-card .exp-scroll');
    if (!e || !box) return;
    const host = document.querySelector('.screen-host') || document.scrollingElement;
    mapMem = { key: memKey(e), box: box.scrollTop, win: window.scrollY, host: host ? host.scrollTop : 0 };
  }
  function go(id, refresh) {
    rememberMap();
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

  /**
   * v4.67: recorrido de entrada del mapa. Empieza arriba del todo con el jefe resaltado, espera a que se
   * vaya la cortinilla y baja suave hasta los nodos de salida. Tocar o mover la rueda lo corta.
   */
  function flyIn(box, map, target) {
    const reduced = document.documentElement.dataset.motion === 'reduced' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced) { box.scrollTop = target; return; }
    box.scrollTop = 0;
    const boss = map.querySelector('.exp-node.t-boss');
    box.classList.add('flying');
    let stop = false;
    const cancel = () => { stop = true; };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, cancel, { once: true, passive: true }));
    const end = () => { box.classList.remove('flying'); if (boss) boss.classList.remove('fly-focus'); };
    (async () => {
      // v5.7: arranca en cuanto la cortinilla empieza a abrirse (antes esperaba a que desapareciera y 0,9 s más)
      const waiting = () => { const c = document.querySelector('.curtain'); return c && !c.classList.contains('opening'); };
      for (let i = 0; i < 120 && waiting(); i++) await DK.util.sleep(30);
      if (stop || !box.isConnected) { end(); return; }
      if (boss) boss.classList.add('fly-focus');
      await DK.util.sleep(document.querySelector('.curtain') ? 260 : 120);
      const from = box.scrollTop, dist = target - from, dur = Math.min(2600, 900 + Math.abs(dist) * 1.1), t0 = performance.now();
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      // v4.68: la página baja a la vez y llega al fondo justo al acabar (en PC la caja bajaba pero la página no)
      const host = document.querySelector('.screen-host');
      const pageEl = host && host.scrollHeight > host.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(host).overflowY) ? host : document.scrollingElement || document.documentElement;
      const pFrom = pageEl.scrollTop, pTo = Math.max(0, pageEl.scrollHeight - pageEl.clientHeight);
      const step = (now) => {
        if (stop || !box.isConnected) { end(); return; }
        const k = Math.min(1, (now - t0) / dur);
        box.scrollTop = from + dist * ease(k);
        if (pTo > pFrom) pageEl.scrollTop = pFrom + (pTo - pFrom) * ease(k);
        if (k < 1) requestAnimationFrame(step); else end();
      };
      if (boss) setTimeout(() => boss.classList.remove('fly-focus'), 600);
      requestAnimationFrame(step);
    })();
  }

  function mapView(refresh, src, readonly, { compact = false } = {}) {
    const e = src || E().active();
    if (!readonly && !compact) memQuiet = Date.now() + 600;
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
    const xRaw = (n) => Math.min(0.95, Math.max(0.05, 0.5 + (n.x - 0.5) * 1.45));
    // v5.19.1: en pantallas estrechas los nodos de un mismo piso se pisaban (uno bloqueado encima de uno abierto
    // se «comía» el toque). Se separan lo justo para que quepan: un nodo de ancho y un margen.
    const zoom = Number(DK.settings.get('uiScale')) || 1;
    const mapW = Math.max(200, Math.min(1100, (document.documentElement.clientWidth || 1024) / zoom - 62));
    const nodeW = compact ? 40 : mapW < 640 ? 54 : 62;
    const xFix = new Map();
    rows.forEach((row) => {
      const list = row.map((n) => ({ n, x: xRaw(n) })).sort((a, b) => a.x - b.x), k = list.length;
      if (k < 2) { list.forEach((o) => xFix.set(o.n.id, o.x)); return; }
      const lo = 0.05, hi = 0.95, gap = Math.min((nodeW + 6) / mapW, (hi - lo) / (k - 1));
      for (let i = 1; i < k; i++) list[i].x = Math.max(list[i].x, list[i - 1].x + gap);
      if (list[k - 1].x > hi) { list[k - 1].x = hi; for (let i = k - 2; i >= 0; i--) list[i].x = Math.min(list[i].x, list[i + 1].x - gap); }
      list.forEach((o) => xFix.set(o.n.id, Math.max(lo, o.x)));
    });
    const xOf = (n) => (xFix.has(n.id) ? xFix.get(n.id) : xRaw(n));
    const all = rows.flat();
    const byId = Object.fromEntries(all.map((n) => [n.id, n]));

    // v5.4: si el líder ha cambiado de nodo desde la última vez, camina por el camino y éste se ilumina
    const heroNow = e.pending || e.pos;
    const walkFrom = !readonly && !compact && heroPrev && heroPrev.key === memKey(e) && heroPrev.id !== heroNow && byId[heroPrev.id] && heroNow && byId[heroNow] ? heroPrev.id : null;
    if (!readonly && !compact) heroPrev = { key: memKey(e), id: heroNow };
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
      if (walkFrom === n.id && lid === heroNow) lines += `<line ${xy} pathLength="1" class="road-lit"/>`;
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
      if (fogged(n)) return h('span', { class: 'exp-node fog', style: { left: xOf(n) * 100 + '%', top: yOf(n.row) + 'px' }, tip: t('mod.fogNode') }, DK.nodeArt ? DK.nodeArt('fog') : DK.icon('question', 18));
      const ty = E().TYPES[n.type];
      const state = cleared.has(n.id) ? 'done' : e.pending === n.id ? (readonly && e.outcome === 'lost' ? 'lost' : 'pending') : avail.includes(n.id) ? 'open' : 'locked';
      const key = order.indexOf(n.id);
      const b = h('button', {
        class: `exp-node t-${n.type} s-${state}` + (e.pos === n.id ? ' here' : '') + (n.secret ? ' secret' : '') + (n.special ? ' special sp-' + n.special : ''), type: 'button',
        style: { left: xOf(n) * 100 + '%', top: yOf(n.row) + 'px' }, disabled: state !== 'open',
        tip: n.secret ? `${t('exp.node.secretBoss')} — ${D.secretBosses[e.zone].title}` : n.bossZone ? abossText(n) : n.special ? `★ ${t('exp.special.' + n.special + '.name')} — ${t('exp.special.' + n.special + '.desc')}` : `${t('exp.node.' + n.type)} — ${t('exp.nodeDesc.' + n.type)}`, 'aria-label': t('exp.node.' + n.type),
        onClick: () => go(n.id, refresh),
      }, n.bossZone && state !== 'done' ? V.sprite(D.zones[n.bossZone].boss.species, { size: n.type === 'boss' ? 64 : 50 }) : DK.nodeArt ? DK.nodeArt(n.secret ? 'secret' : n.type) : DK.icon(state === 'done' ? 'check' : ty.icon, n.type === 'boss' ? 40 : 28),
      // v5.7: ya visitado: el icono queda apagado con una marca de hecho
      state === 'done' ? h('span', { class: 'node-done' }, DK.icon('check', 12)) : null,
      // v5.1: en el Abismo cada jefe lleva su nombre debajo
      n.bossZone ? h('span', { class: 'node-boss-lbl' }, D.zones[n.bossZone].boss.title) : null,
      key >= 0 && key < 9 ? h('kbd', { class: 'hotkey' }, key + 1) : null,
      // Los mini jefes (élite) dan una reliquia: se marca en el mapa
      n.type === 'elite' && state !== 'done' ? h('span', { class: 'node-relic' }, DK.icon('amulet', 12)) : null,
      // v5.5: piso especial: estrella dorada
      n.special && state !== 'done' ? h('span', { class: 'node-special' }, DK.icon('star', 11)) : null);
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
    if (hero && walkFrom && !DK.settings.reducedMotion() && !DK.settings.get('skipAnims')) {
      const a = byId[walkFrom], b = byId[heroId];
      hero.animate([{ left: xOf(a) * 100 + '%', top: yOf(a.row) + 'px' }, { left: xOf(b) * 100 + '%', top: yOf(b.row) + 'px' }], { duration: 750, easing: 'ease-in-out' });
      hero.classList.add('walking'); setTimeout(() => hero.classList.remove('walking'), 760);
    }
    const amb = !compact && DK.ambient ? DK.ambient.map(zone.scene, H) : null; // v5.7: el mapa también se mueve
    const map = h('div', { class: 'exp-map' + (compact ? ' compact' : '') + (editing ? ' is-drawing' : ''), style: { height: H + 'px', '--z1': zone.colors[0], '--z2': zone.colors[1] } }, decor, amb, floors, svg, nodes, hero, layer);
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
      const target = el ? Math.max(0, el.offsetTop - box.clientHeight / 2) : 0;
      // v4.68: volviendo de un piso o de un combate, todo queda como lo dejaste (sin recentrar)
      if (!readonly && !compact) { bindMem(); memQuiet = Date.now() + 500; }
      if (!readonly && !compact && mapMem && mapMem.key === memKey(e)) {
        const m = mapMem;
        box.scrollTop = m.box;
        const host = document.querySelector('.screen-host');
        const restore = () => { if (host) host.scrollTop = m.host; window.scrollTo(0, m.win); };
        restore(); requestAnimationFrame(restore); setTimeout(restore, 120);
        return;
      }
      // v4.67: la primera vez que ves un mapa nuevo (tras prepararte), la vista baja desde el jefe hasta el inicio
      const flyKey = `${e.depth || 1}|${e.seed}`;
      if (!readonly && !compact && !e.cleared.length && !e.pos && e.flyShown !== flyKey && box.scrollHeight > box.clientHeight + 40) {
        e.flyShown = flyKey; DK.store.save();
        flyIn(box, map, target);
      } else if (el) box.scrollTop = target;
    }, 30);
    // Mientras se dibuja, se conserva la posición del mapa entre repintados
    if (!readonly) setTimeout(() => { const box = map.parentElement; if (box) box.addEventListener('scroll', () => { if (draw.on) keepScroll = box.scrollTop; if (!compact && !box.classList.contains('flying') && Date.now() > memQuiet) rememberMap(); }, { passive: true }); }, 400);
    if (!readonly && !draw.on) keepScroll = null;
    const terrain = { backgroundImage: `url(${DK.pix.terrain(zone.colors, e.zone)})`, '--z1': zone.colors[0], '--z2': zone.colors[1] };
    if (compact) return h('div', { class: 'exp-map-compact' }, h('div', { class: 'exp-scroll terrain', style: terrain }, map), legend());
    return h('div', { class: 'card exp-map-card' },
      // v4.67: cabecera sutil. Título y «Dibujar» arriba; debajo, una línea de datos del mapa todos del mismo
      // tamaño (sin cajas) y las reliquias como iconos (pulsar «ver» las despliega con su nombre).
      h('div', { class: 'panel-head exp-head2' }, DK.icon(zone.icon, 18), h('h3', null, zone.name),
        readonly ? null : h('span', { class: 'grow' }),
        readonly ? null : btn({ icon: 'edit', label: draw.on ? t('draw.stop') : t('draw.start'), size: 'sm', variant: draw.on ? 'primary' : 'ghost', tip: t('draw.tip'), onClick: () => { draw.on = !draw.on; draw.tool = 'pen'; refresh(); } })),
      h('div', { class: 'exp-meta' }, V.kindChip(e.kind || (e.map && e.map.kind)), V.sizeChip(e.size || (e.map && e.map.size)), V.modChip(e.mod || (e.map && e.map.mod)), V.endgameChips(e), ...progressChips(e)),
      readonly ? null : relicBar(undefined, { compact: true, refresh }),
      editing ? drawBar(refresh) : null,
      h('div', { class: 'exp-scroll terrain', style: terrain }, map),
      legend());
  }
  /** Mapa de sólo lectura (resumen, vista previa en Zonas). opts: { compact } */
  DK.views.expMap = (src, opts) => mapView(() => {}, src, true, opts);

  /** Fila de reliquias activas (con su efecto en el tooltip). */
  // v4.67: { compact } → sólo iconos con un aro del color de su rareza (nombre y efecto en el «tip»);
  // «Ver» las despliega con nombre (se recuerda mientras dure la partida abierta)
  let relicsOpen = false;
  function relicBar(list = DK.relics.list(), { compact = false, refresh } = {}) {
    if (!list.length) return null;
    const open = compact && relicsOpen;
    const chips = list.map((r) => h('span', { class: 'relic-chip r-' + r.rarity + (compact && !open ? ' ico' : ''), tip: `${r.name} — ${relicText(r)}`, 'aria-label': r.name }, DK.icon(r.icon, compact && !open ? 14 : 15), compact && !open ? null : h('span', null, r.name)));
    if (!compact) return h('div', { class: 'relic-bar' }, chips);
    return h('div', { class: 'relic-bar compact' + (open ? ' open' : '') },
      h('span', { class: 'rb-lbl' }, DK.icon('amulet', 13), h('b', null, list.length), t('exp.relicsShort')),
      chips,
      refresh ? h('button', { type: 'button', class: 'rb-toggle', onClick: () => { relicsOpen = !relicsOpen; DK.audio.sfx('click'); refresh(); } }, DK.icon('chevronDown', 12), open ? t('exp.relicsLess') : t('exp.relicsMore')) : null);
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
    const nz = D.zones[c.next.zone], ab = E().active() && E().active().kind === 'abismo';
    const goOn = () => { E().continueRun(); DK.audio.sfx('select'); refresh(); };
    const stop = () => { const s = E().complete(); DK.ui.toast(t('exp.cashed', { coins: s.coins }), { icon: 'coin', kind: 'good' }); DK.router.reset('expSummary'); };
    DK.keys.on('1', goOn); DK.keys.on('2', stop);
    return h('div', { class: 'card stack exp-choice' },
      h('div', { class: 'exp-node-head t-boss' }, h('span', { class: 'exp-node-big t-boss' }, DK.icon('crown', 28)),
        h('div', null, h('h3', null, t('exp.mapCleared', { n: c.depth })), h('p', { class: 'muted small' }, t('exp.choiceText')))),
      V.questResult(c.quest),
      h('div', { class: 'exp-choice-grid' },
        h('div', { class: 'exp-choice-card go', style: { '--z1': nz.colors[0], '--z2': nz.colors[1] } },
          h('span', { class: 'muted small' }, ab ? t('abyss.floor', { n: c.depth + 1 }) : t('exp.nextMap', { n: c.depth + 1 })),
          h('h3', null, DK.icon(nz.icon, 20), ' ', nz.name),
          h('div', { class: 'chips' }, V.sizeChip(c.next.size, { big: true }), V.modChip(c.next.mod, { big: true }),
            // v5.1: en el Abismo, el nivel de los jefes de la siguiente ronda
            h('span', { class: 'chip' }, ab ? `${t('abyss.series')} · ${t('common.lvl')} ${DK.abyss.bossLevel(c.next.zone, 0) + c.nextBonus}-${DK.abyss.bossLevel(c.next.zone) + c.nextBonus}` : `${t('common.lvl')} ${nz.levels[0] + c.nextBonus}-${nz.levels[1] + c.nextBonus}`),
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
      h('span', { class: 'legend-item', tip: t('exp.nodeDesc.' + k) }, h('span', { class: 'exp-legend-icon t-' + k }, DK.nodeArt && DK.nodeArt.has(k) ? DK.nodeArt(k) : DK.icon(ty.icon, 13)), t('exp.node.' + k))));
  }

  /** Fichas de profundidad y piso (barra del mapa y barra del modo foco). */
  const progressChips = (e) => [
    h('span', { class: 'chip', tip: t('exp.depthTip') }, DK.icon('compass', 13), t('exp.depth', { n: e.depth || 1 })),
    h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(e.step, e.total), total: e.total }))];

  /* ---------- Panel del nodo ---------- */
  const cont = (refresh) => btn({ icon: 'next', label: t('exp.continuePath'), variant: 'primary', hotkey: '↵', cls: 'exp-cont', onClick: () => { E().completeNode(); refresh(); } });
  // v4.60: opciones del suceso en una fila compacta (antes, botones grandes uno debajo de otro)
  const opts = (...b) => h('div', { class: 'exp-opts' }, b.flat().filter(Boolean));
  // v4.63: los sucesos con personaje llevan su silueta (npc = { key, color, icon })
  const head = (type, title, text, npc) => h('div', { class: 'exp-node-head t-' + type + (npc ? ' has-npc' : '') },
    npc ? null : h('span', { class: 'exp-node-big t-' + type }, DK.nodeArt && DK.nodeArt.has(type) ? DK.nodeArt(type) : DK.icon(E().TYPES[type].icon, 28)), h('div', { class: 'enh-txt' }, h('h3', null, title), text ? h('p', { class: 'muted small' }, text) : null),
    npc ? h('button', { class: 'npc-btn', type: 'button', tip: t('exp.npcLook'), 'aria-label': t('exp.npcLook'), onClick: () => npcZoom(npc, npc.role || title) }, V.npc(npc.key, npc)) : null);
  const NPC_COLOR = { traveler: '#f59e0b', hermit: '#a78bfa', smith: '#fb923c', cartographer: '#38bdf8', bandits: '#ef4444', gamble: '#4ade80', trainer: '#f472b6', collector: '#facc15' };
  const npcOf = (e, id, icon) => (NPC_COLOR[id] ? { key: id + '|' + e.seed + '|' + e.pending, color: NPC_COLOR[id], icon } : null);

  /**
   * v5.5: escenario de los sucesos: el personaje grande (silueta oscura; al pulsarlo se ve más de cerca, aún
   * oculto), un bocadillo con lo que dice y, debajo, las opciones como tarjetas.
   * o = { npc, role, icon, title, text, tone, result, special }
   */
  function stage(o, ...below) {
    const e = E().active(), z = D.zones[e.zone];
    const who = o.npc
      ? h('button', { class: 'ev-npc', type: 'button', style: { '--npc': o.npc.color }, tip: t('exp.npcLook'), 'aria-label': t('exp.npcLook'), onClick: () => npcZoom(o.npc, o.role || o.title) },
        h('span', { class: 'ev-npc-glow' }), V.npc(o.npc.key, Object.assign({}, o.npc, { size: 150 })), h('span', { class: 'ev-npc-hint' }, DK.icon('search', 12)))
      : h('span', { class: 'ev-emblem' + (o.art ? ' has-art' : '') }, h('span', { class: 'ev-emblem-ring' }), o.art || DK.icon(o.icon || 'question', 46));
    return h('div', { class: 'card ev-stage' + (o.cls ? ' ' + o.cls : '') + (o.special ? ' special' : '') + (o.result ? ' is-result tone-' + (o.tone || 'good') : ''), style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'ev-scene' },
        h('span', { class: 'ev-sky' }), h('span', { class: 'ev-ground' }), h('span', { class: 'ev-motes' }, Array.from({ length: 10 }, (_, i) => h('i', { style: { left: (i * 37) % 96 + 2 + '%', animationDelay: (-i * 1.3) + 's' } }))),
        o.special ? h('span', { class: 'ev-ribbon' }, DK.icon('star', 12), t('exp.special.tag')) : null,
        who,
        h('div', { class: 'ev-bubble' }, h('h3', null, o.title), o.text ? h('p', null, o.text) : null)),
      h('div', { class: 'ev-below' }, ...below));
  }
  /** v5.5: ver al personaje de cerca (sigue siendo una silueta: no se sabe qué daskai es). */
  function npcZoom(npc, role) {
    DK.audio.sfx('select');
    DK.ui.modal({ title: role || t('exp.npcUnknown'), icon: npc.icon || 'question', cls: 'npc-zoom-modal',
      content: h('div', { class: 'npc-zoom', style: { '--npc': npc.color } }, h('span', { class: 'nz-rays' }), V.npc(npc.key, Object.assign({}, npc, { size: 260 })),
        h('p', { class: 'muted small center' }, t('exp.npcHidden'))),
      actions: [{ label: t('common.close'), variant: 'primary', value: true }] });
  }
  /** v5.5: elegir un regalo (encuentro especial o mercader generoso). */
  function giftPanel(e, refresh, o) {
    const npc = { key: o.npcKey, color: o.color, icon: o.icon };
    if (e.giftTaken) {
      enterContFor(refresh);
      const it = D.items[e.giftTaken];
      return stage({ npc, role: o.role, title: o.title, text: t('exp.giftTaken', { item: it.name }), result: true, special: true },
        h('div', { class: 'gift-row' }, giftCard(e.giftTaken, true)), cont(refresh));
    }
    const choose = (id) => { if (E().takeGift(id)) { DK.audio.sfx('achievement'); DK.app.renderNav(); refresh(); } };
    // (partida antigua o sin regalos que ofrecer: nunca te quedas atascado en el piso)
    if (!(e.giftChoice || []).length) { enterContFor(refresh); return stage({ npc, role: o.role, title: o.title, text: o.text, special: true }, cont(refresh)); }
    (e.giftChoice || []).forEach((id, i) => DK.keys.on(String(i + 1), () => choose(id)));
    return stage({ npc, role: o.role, title: o.title, text: o.text, special: true },
      h('div', { class: 'gift-row' }, (e.giftChoice || []).map((id, i) => giftCard(id, false, () => choose(id), i + 1))));
  }
  function giftCard(id, taken, onClick, key) {
    const it = D.items[id];
    return h(taken ? 'div' : 'button', { class: 'gift-card r-' + it.rarity + (taken ? ' taken' : ''), type: taken ? null : 'button', onClick, tip: it.desc },
      h('span', { class: 'gift-ico' }, V.itemIcon(it, 44)), h('b', null, it.name), V.rarity(it.rarity),
      h('small', { class: 'muted' }, V.useText(it) || it.desc),
      taken ? h('span', { class: 'badge good' }, DK.icon('check', 12), t('exp.giftGot')) : h('span', { class: 'gift-take' }, DK.icon('gift', 13), t('exp.giftTake')),
      key ? h('kbd', { class: 'hotkey' }, String(key)) : null);
  }
  const enterContFor = (refresh) => DK.keys.on('Enter', () => { E().completeNode(); refresh(); });

  /** v4.88: pista de la expedición: la de la zona, o misterio en sucesos y santuarios sin resolver. */
  function expTrack() {
    const e = E().active(), pn = e && E().pendingNode();
    return pn && (pn.type === 'event' || pn.type === 'shrine') && !e.result ? 'mystery' : DK.audio.zoneTrack();
  }

  /** Volver a casa desde la hoguera (la mitad del botín y TODOS los reclutas). Una sola vez aunque se pulse dos veces. */
  let campAsking = false;
  async function campHome() {
    if (campAsking || !E().canCampfireExit()) return;
    const pv = E().campfirePreview();
    const text = t('exp.campExitText', { pct: pv.pct, coins: pv.coins, items: pv.items }) + (pv.recruits.length ? ' ' + t('exp.campExitRecruits', { names: pv.recruits.join(', ') }) : '');
    campAsking = true;
    try { if (!(await DK.ui.confirm(t('exp.campExitQ'), text, { okLabel: t('exp.campExit'), okIcon: 'home', icon: 'campfire' }))) return; } finally { campAsking = false; }
    if (!E().active()) return;
    const r = E().campfireExit();
    DK.ui.toast(t('exp.campExited', { coins: r.coins }), { icon: 'campfire', kind: 'good' });
    DK.router.reset('expSummary');
  }

  /** v5.19.1: red de seguridad: si un piso no sabe pintarse (datos de una versión vieja), al menos se puede seguir. */
  function stuckPanel(refresh) {
    console.warn('Piso sin panel: se ofrece «Continuar»', E().pendingNode());
    enterContFor(refresh);
    return h('div', { class: 'card stack-s' }, cont(refresh));
  }

  function nodePanel(n, refresh) {
    const e = E().active();
    const done = (key, vars) => h('div', { class: 'stack-s' }, h('div', { class: 'warning good' }, DK.icon('check', 18), h('span', null, t(key, vars))), cont(refresh));
    const enterCont = () => DK.keys.on('Enter', () => { E().completeNode(); refresh(); });

    if (E().TYPES[n.type].battle) {
      DK.keys.on('Enter', () => fight());
      return h('div', { class: 'card stack-s' }, head(n.type, t('exp.node.' + n.type), n.bossZone ? abossText(n) : t('exp.nodeDesc.' + n.type)),
        btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', hotkey: '↵', cls: 'exp-cont', onClick: () => fight() }));
    }

    if (n.type === 'treasure') {
      // v5.16: el cofre se abre nada más entrar (sin esperar), con un sonido suave, y el botín entra en cascada
      let justOpened = false;
      if (!e.result) {
        const r = E().openTreasure(); e.result = { key: 'treasure', items: r.items, coins: r.coins, recipe: r.recipe, relic: r.relic, runes: r.runes }; DK.store.save();
        justOpened = true; DK.audio.sfx('chestSoft');
      }
      enterCont();
      // Botín del cofre en tarjetas: lo que es, para qué sirve y adónde va (mochila: ya; botín: al volver)
      const counts = {}; (e.result.items || []).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      let k = 0;
      const delay = () => ({ animationDelay: ((justOpened ? 0.28 : 0) + k++ * 0.12) + 's' }); // (tras el «pop» del cofre)
      const cards = [
        e.result.coins ? h('div', { class: 'loot-card coins', style: delay() }, h('span', { class: 'loot-icon' }, DK.icon('coin', 34)), h('b', null, '+' + e.result.coins.toLocaleString(DK.i18n.lang)), h('small', null, t('hub.coins')), h('span', { class: 'loot-dest loot' }, DK.icon('gift', 11), t('exp.destLoot'))) : null,
        ...Object.entries(counts).map(([id, n]) => {
          const it = D.items[id], bag = E().toBag(id);
          return h('div', { class: 'loot-card r-' + it.rarity, style: delay(), tip: it.desc, tipNode: () => V.infoCard('item', id) },
            h('span', { class: 'loot-icon' }, V.itemIcon(it, 40), n > 1 ? h('span', { class: 'loot-n' }, '×' + n) : null),
            h('b', null, it.name), V.rarity(it.rarity),
            h('small', { class: 'muted' }, V.useText(it) || it.desc),
            h('span', { class: 'loot-dest ' + (bag ? 'bag' : 'loot'), tip: bag ? t('exp.toBagTip') : t('exp.toLoot') }, DK.icon(bag ? 'bag' : 'gift', 11), bag ? t('exp.destBag') : t('exp.destLoot')));
        }),
        e.result.relic ? (() => { const r = D.relics[e.result.relic]; return h('div', { class: 'loot-card relic r-' + r.rarity, style: delay() }, h('span', { class: 'loot-icon' }, DK.icon(r.icon, 36)), h('b', null, r.name), V.rarity(r.rarity), h('small', { class: 'muted' }, relicText(r)), h('span', { class: 'loot-dest relic' }, DK.icon('amulet', 11), t('exp.destRelic'))); })() : null,
        ...(e.result.runes || []).map((id) => { return h('div', { class: 'loot-card rune ' + V.runeRarity(id), style: delay(), tip: t('rune.help'), tipNode: () => V.infoCard('rune', id) }, h('span', { class: 'loot-icon' }, V.runeGem(id, 52)), h('b', null, V.runeName(id)), h('small', { class: 'muted' }, V.runeEffect(id)), ...V.runeAffixes(id).map((x) => h('small', { class: 'rune-aff' }, x)), h('span', { class: 'loot-dest rune' }, DK.icon('rune', 11), t('rune.dest'))); }),
        e.result.recipe ? (() => { const it = D.items[D.recipes.find((r) => r.id === e.result.recipe).result]; return h('div', { class: 'loot-card recipe', style: delay() }, h('span', { class: 'loot-icon' }, DK.icon('scroll', 34)), h('b', null, t('exp.newRecipe', { item: it.name })), h('small', { class: 'muted' }, t('exp.recipeShort')), h('span', { class: 'loot-dest relic' }, DK.icon('anvil', 11), t('nav.craft'))); })() : null,
      ];
      // v5.17: el cofre con el mismo escenario que los sucesos (título grande, el cofre a la izquierda y el botín debajo)
      const nItems = cards.filter(Boolean).length;
      return stage({ art: h('span', { class: 'chest-big open' + (justOpened ? ' just' : ''), 'aria-hidden': 'true' }, DK.nodeArt && DK.nodeArt.has('treasure') ? DK.nodeArt('treasure') : DK.icon('gift', 56), h('span', { class: 'chest-glow' })),
        title: t('exp.node.treasure'), text: t('exp.chestFound', { n: nItems }), cls: 'chest-stage' },
        h('div', { class: 'loot-grid', style: { '--n': nItems || 1 } }, cards), // v4.68: filas equilibradas y centradas
        h('p', { class: 'muted small chest-legend', tip: t('exp.destBagHelp') + ' · ' + t('exp.destLootHelp') }, h('span', { class: 'loot-dest bag' }, DK.icon('bag', 11), t('exp.destBag')), ' ', h('span', { class: 'loot-dest loot' }, DK.icon('gift', 11), t('exp.destLoot')), ' ', DK.icon('info', 12)),
        cont(refresh));
    }

    if (n.type === 'rest') {
      if (e.result) {
        enterCont();
        const pv0 = E().campfirePreview();
        return h('div', { class: 'card stack-s' }, head('rest', t('exp.node.rest')), done(e.result.key, e.result.vars),
          E().canCampfireExit() ? btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv0.pct, coins: pv0.coins }), variant: 'ghost', onClick: campHome }) : null);
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
      const pv = E().campfirePreview(), goHome = campHome;
      if (E().canCampfireExit()) DK.keys.on('3', goHome);
      const exitBox = E().canCampfireExit()
        ? h('div', { class: 'camp-exit' },
          btn({ icon: 'home', label: t('exp.campExit'), desc: t('exp.campExitDesc', { pct: pv.pct, coins: pv.coins }), variant: 'ghost', showDesc: true, hotkey: '3', onClick: goHome }),
          pv.recruits.length ? h('p', { class: 'small good-text' }, DK.icon('paw', 12), ' ', t('exp.campExitKeeps', { names: pv.recruits.join(', ') })) : null)
        : h('p', { class: 'muted small' }, DK.icon('lock', 12), ' ', t('exp.noRetreat'));
      // v4.70: rediseño. A la izquierda tu equipo UNA vez, uno debajo de otro: vida actual, lo que curaría
      // descansar (franja clara) y nivel. Pulsar una fila elige a quién entrenar. A la derecha, las dos acciones.
      const restPct = Math.min(1, DK.config.expedition.restHeal + DK.camp.value('hoguera')) * (DK.corruption && DK.corruption.has('restHalf') ? D.endgame.corruption.restMult : 1);
      let gain = 0;
      const rows = team.map((d) => {
        const s = DK.daskai.stats(d), hp = DK.util.percent(d.cur.hp, s.hp), to = Math.min(s.hp, d.cur.hp + Math.ceil(s.hp * restPct)), maxed = d.level >= DK.config.maxLevel;
        gain += to - d.cur.hp;
        return { d, el: h('button', { class: 'rt-row' + (d.uid === e.trainUid ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(d.uid === e.trainUid), disabled: maxed,
          tip: `${DK.daskai.name(d)} · ${d.cur.hp}/${s.hp} ${t('common.hpShort')}`, onClick: (ev) => pick(d, ev.currentTarget) },
          h('span', { class: 'rt-spr' }, V.dSprite(d, { size: 44 })),
          h('span', { class: 'rt-main' },
            h('span', { class: 'rt-top' }, h('b', null, DK.daskai.name(d)), h('small', { class: 'rt-lv' }, `${t('common.lvl')} ${d.level}`, h('span', { class: 'rt-up' }, ` → ${d.level + 1}`))),
            h('span', { class: 'rt-hp' }, h('i', { class: 'heal', style: { width: DK.util.percent(to, s.hp) + '%' } }), h('i', { class: 'cur', style: { width: hp + '%' } })),
            h('small', { class: 'rt-num' }, `${d.cur.hp}/${s.hp}`, to > d.cur.hp ? h('span', { class: 'rt-plus' }, ` +${to - d.cur.hp}`) : null)),
          h('span', { class: 'rt-check' }, DK.icon('star', 13))) };
      });
      const whoLine = h('p', { class: 'rt-who' });
      const setWho = (d) => whoLine.replaceChildren(d ? h('span', null, V.dSprite(d, { size: 22 }), h('b', null, DK.daskai.name(d)), ` ${t('common.lvl')} ${d.level} → ${d.level + 1}`) : '');
      const trainBtn = (d) => btn({ icon: 'star', label: t('exp.train'), variant: 'tone', hotkey: '2', cls: 'rest-train-btn', disabled: !d || d.level >= DK.config.maxLevel, onClick: train });
      let tBtn = trainBtn(DK.party.get(e.trainUid));
      const pick = (d, el) => {
        e.trainUid = d.uid; DK.audio.sfx('select');
        el.parentElement.querySelectorAll('.rt-row').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        const nb = trainBtn(d); tBtn.replaceWith(nb); tBtn = nb; setWho(d);
      };
      setWho(DK.party.get(e.trainUid));
      return h('div', { class: 'card stack rest-panel rest2' }, head('rest', t('exp.node.rest'), t('exp.restText')),
        h('div', { class: 'rt-grid' },
          h('div', { class: 'rt-team', role: 'radiogroup', 'aria-label': t('exp.trainWho') }, h('span', { class: 'rt-lbl' }, t('exp.trainWho')), rows.map((r) => r.el)),
          h('div', { class: 'rt-acts' },
            h('section', { class: 'rt-act heal' },
              h('div', { class: 'rt-act-h' }, h('span', { class: 'rest-opt-icon heal' }, DK.icon('bed', 22)), h('div', null, h('b', null, t('exp.restHeal')), h('p', { class: 'muted small' }, t('exp.restHealDesc', { n: Math.round(restPct * 100) })))),
              gain ? h('p', { class: 'rt-gain' }, DK.icon('heart', 13), t('exp.restGain', { n: gain })) : h('p', { class: 'rt-gain full' }, DK.icon('check', 13), t('exp.restFull')),
              btn({ icon: 'bed', label: t('exp.restHeal'), variant: 'primary', hotkey: '1', onClick: rest })),
            h('section', { class: 'rt-act train' },
              h('div', { class: 'rt-act-h' }, h('span', { class: 'rest-opt-icon train' }, DK.icon('star', 22)), h('div', null, h('b', null, t('exp.train')), h('p', { class: 'muted small' }, t('exp.trainDescLevel')))),
              whoLine, tBtn))),
        exitBox);
    }

    if (n.type === 'cave') return cavePanel(e, refresh);
    if (n.type === 'shortcut') return shortcutPanel(n, refresh);

    if (n.type === 'recruit') return recruitPanel(e, refresh);
    if (n.type === 'shrine') return shrinePanel(e, refresh);

    if (n.type === 'shop' && n.special === 'gift') return giftPanel(e, refresh, { npcKey: 'shop|' + e.seed + '|' + e.pending, color: '#fbbf24', icon: 'gift', title: t('exp.special.gift.name'), text: t('exp.giftText.gift'), role: t('exp.npcRole.merchant') });
    if (n.type === 'shop') return merchantPanel(e, refresh, n.special === 'curio');

    if (n.type === 'event') {
      // v5.5: encuentro especial: un personaje misterioso regala uno de tres objetos especiales
      if (e.event === 'special') return giftPanel(e, refresh, { npcKey: 'special|' + e.seed + '|' + e.pending, color: '#fbbf24', icon: 'gift', title: t('exp.special.rare.name'), text: t('exp.giftText.rare'), role: t('exp.npcRole.special') });
      const ev = D.events.find((x) => x.id === e.event) || D.events[0];
      const T = (k, v) => t(`events.${ev.id}.${k}`, v);
      const npc = npcOf(e, ev.id, ev.icon);
      const role = npc ? T('title') : null;
      if (e.result) {
        const r = e.result;
        if (r.fight) DK.keys.on('Enter', () => fight(r.fight)); else enterCont();
        return stage({ npc, role, icon: ev.icon, title: T('title'), text: T('results.' + r.key, r.vars), tone: r.fight ? 'warn' : 'good', result: true },
          r.fight ? btn({ icon: 'swords', label: t('exp.fightNow'), variant: 'primary', hotkey: '↵', cls: 'exp-cont', onClick: () => fight(r.fight) }) : cont(refresh));
      }
      const ctx = E().ctx();
      return stage({ npc, role, icon: ev.icon, title: T('title'), text: T('text') },
        h('div', { class: 'ev-choices n' + ev.choices.length }, ev.choices.map((c, i) => {
          const ok = !c.req || c.req(ctx);
          const pick = () => { if (E().resolveEvent(c.id)) { DK.audio.sfx('select'); DK.app.renderNav(); refresh(); } };
          if (ok) DK.keys.on(String(i + 1), pick);
          return h('button', { class: 'ev-choice' + (i === 0 ? ' main' : '') + (ok ? '' : ' off'), type: 'button', disabled: !ok, onClick: pick },
            h('span', { class: 'evc-ico' }, DK.icon(c.icon, 20)),
            h('span', { class: 'evc-txt' }, h('b', null, T('choices.' + c.id)), h('small', null, ok ? T('desc.' + c.id) : T('need.' + c.id))),
            h('kbd', { class: 'hotkey' }, String(i + 1)));
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
  function merchantPanel(e, refresh, curio = false) {
    if (shopUi.node !== e.pending) { shopUi.node = e.pending; shopUi.mode = 'buy'; shopUi.qty = {}; }
    DK.keys.on('Enter', () => { E().completeNode(); refresh(); });
    const card = h('div', { class: 'card stack-s merchant' + (curio ? ' curio' : '') });
    const flash = (text, icon, id) => {
      shopUi.flash = { text, icon, id, at: Date.now() };
      clearTimeout(shopUi.flashT); shopUi.flashT = setTimeout(() => { shopUi.flash = null; if (card.isConnected) draw(); }, 3200);
    };
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
          // v4.60b: sin avisos flotantes (tapaban «Seguir el camino»): confirmación en la propia tienda
          if (sell) { DK.shop.sell(id, n); DK.audio.sfx('coin'); flash(t('shop.soldN', { item: it.name, n, coins: total }), 'coin', id); }
          else if (E().buyOffer(k, n)) { DK.audio.sfx('coin'); flash(t('shop.bought', { item: it.name, n }), 'bag', id); }
          else { DK.audio.sfx('error'); return; }
          shopUi.qty[shopUi.mode + k] = 1; draw();
          // el botín de la cabecera y de la barra también cambian (sin repintar la pantalla)
          if (DK.app.renderRes) DK.app.renderRes();
          document.querySelectorAll('[data-loot-coins]').forEach((el) => { el.textContent = t('exp.lootNow', { items: E().lootCount(), coins: e.loot.coins }); });
        };
        const special = !sell && e.offers && e.offers[k] && e.offers[k].special;
        return h('div', { class: 'mr-row r-' + it.rarity + (special ? ' special' : '') + (sold ? ' sold' : '') + (shopUi.flash && shopUi.flash.id === id && Date.now() - shopUi.flash.at < 900 ? ' just' : ''), tip: it.desc },
          h('span', { class: 'mr-icon' }, V.itemIcon(it, 26)),
          h('span', { class: 'mr-main' }, h('b', null, special ? h('span', { class: 'mr-star', tip: t('exp.special.tag') }, DK.icon('star', 11)) : null, it.name), h('span', { class: 'muted small' }, V.useText(it) || it.desc),
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
      // v4.67: sin el botón de seguir arriba. Cabecera con el mercader y tu bolsa de monedas; abajo, una
      // barra que se queda pegada al borde (siempre a mano al bajar por la lista) con el aviso y «Seguir el camino».
      card.replaceChildren(
        h('div', { class: 'mr-top' }, head('shop', curio ? '★ ' + t('exp.special.curio.name') : t('exp.node.shop'), curio ? t('exp.special.curio.desc') : t('exp.shopText2'), { key: 'shop|' + e.seed + '|' + e.pending, color: curio ? '#c084fc' : '#fbbf24', icon: 'coin', role: t('exp.npcRole.merchant') }),
          h('span', { class: 'mr-purse', tip: t('exp.lootCoinsTip') }, h('small', null, DK.icon('gift', 13), t('exp.loot')), V.coins(coins))),
        h('div', { class: 'mr-bar' }, tabs, h('p', { class: 'muted small mr-note' }, shopUi.mode === 'buy' ? t('exp.payNoteLoot') : t('shop.sellHelpLoot', { n: Math.round(DK.config.sellRatio * 100) }))),
        list.length ? h('div', { class: 'mr-list' }, list) : DK.ui.empty('coin', t('shop.nothingToSell'), ''),
        h('div', { class: 'mr-foot' },
          shopUi.flash ? h('span', { class: 'mr-flash', role: 'status' }, DK.icon('check', 13), DK.icon(shopUi.flash.icon, 13), h('span', null, shopUi.flash.text)) : h('span', { class: 'mr-foot-hint muted small' }, t('exp.shopLeaveHint')),
          cont(refresh)));
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
        opts(btn({ icon: 'compass', label: t('exp.caveExplore'), desc: t('exp.caveExploreDesc'), variant: 'primary', hotkey: '1', showDesc: true, onClick: explore }),
          btn({ icon: 'next', label: t('exp.caveSkip'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } })));
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
        opts(btn({ icon: 'swords', label: t('exp.secretFight'), variant: 'primary', hotkey: '1', onClick: () => fight('secret') }),
          btn({ icon: 'next', label: t('exp.secretLeave'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } })));
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
    // v4.60: lo esencial en una línea (coste, pisos y adónde llegas); la explicación, al pasar el ratón
    return h('div', { class: 'card stack-s' }, head('shortcut', t('exp.node.shortcut'), t('exp.shortcutText', { n: skip })),
      h('div', { class: 'exp-facts', tip: t('exp.shortcutHint') },
        h('span', { class: 'neg' }, DK.icon('heart', 12), t('exp.shortcutCost', { n: cost })),
        h('span', { class: 'pos' }, DK.icon('next', 12), t('exp.shortcutSkip', { n: skip })),
        h('span', null, DK.icon(E().TYPES[target.type].icon, 12), t('exp.shortcutTo', { node: t('exp.node.' + target.type) })),
        DK.icon('info', 12)),
      opts(btn({ icon: 'shortcut', label: t('exp.shortcutTake'), variant: 'primary', hotkey: '1', onClick: take }),
        btn({ icon: 'next', label: t('exp.shortcutNo'), variant: 'ghost', hotkey: '2', onClick: () => { E().completeNode(); refresh(); } })));
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
      // v4.60: fichas pequeñas (dibujo, nombre, vida): pulsar una la bendice
      h('div', { class: 'exp-picks' }, team.map((d, i) => {
        const pick = () => { E().bless(d.uid); DK.audio.sfx('levelup'); refresh(); };
        DK.keys.on(String(i + 1), pick);
        const s2 = DK.daskai.stats(d), hp = DK.util.percent(d.cur.hp, s2.hp);
        return h('button', { class: 'exp-pick' + (e.blessed === d.uid ? ' on' : ''), type: 'button', style: { '--c': D.houseColor(DK.daskai.species(d).house) }, tip: `${t('exp.bless')} · ${DK.daskai.name(d)}`, onClick: pick },
          h('span', { class: 'exp-pick-art' }, V.dSprite(d, { size: 44 }), e.blessed === d.uid ? h('span', { class: 'exp-pick-mark' }, DK.icon('sparkles', 12)) : null),
          h('b', null, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`),
          h('span', { class: 'exp-pick-hp' }, h('i', { style: { width: hp + '%' } })),
          h('kbd', { class: 'hotkey' }, String(i + 1)));
      })),
      e.blessed ? h('p', { class: 'muted small' }, t('exp.blessReplace')) : null,
      btn({ icon: 'next', label: t('exp.shrineSkip'), variant: 'ghost', cls: 'exp-cont', onClick: () => { E().completeNode(); refresh(); } }));
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
        h('div', { class: 'row gap-s wrap' }, V.housesBadge(x), V.roleBadge(x), extra ? V.tempTag(x) : null)));
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
      h('div', { class: 'recruit-grid', style: { '--n': Math.max(1, cands.length) } }, cands.map((c, i) => {
        const sp = D.species[c.species];
        const pick = () => { if (E().recruit(i)) { DK.audio.sfx('levelup'); DK.app.renderNav(); refresh(); } };
        DK.keys.on(String(i + 1), pick);
        const s = DK.daskai.stats(Object.assign({}, c, { wild: false }));
        return h('div', { class: 'recruit-card', style: { '--c': D.houseColor(sp.house) } },
          h('button', { type: 'button', class: 'recruit-art sc-open', tip: t('detail.viewBig'), 'aria-label': t('detail.viewBig'), onClick: (ev) => { ev.stopPropagation(); V.showcase(c, { bare: true }); } }, V.dSprite(c, { size: 64, cls: 'float' }), h('span', { class: 'sc-open-hint' }, DK.icon('maximize', 12))),
          h('div', { class: 'row gap-s wrap' }, h('b', null, DK.daskai.name(c)), V.level(c.level), V.shinyTag(c)),
          h('span', { class: 'muted small rc-sp' }, sp.name),
          h('div', { class: 'row gap-s wrap' }, V.housesBadge(c), V.roleBadge(c)),
          h('div', { class: 'chips' },
            h('span', { class: 'chip', tip: DK.tr('natures', D.natures[c.nature], 'desc') }, DK.icon('leaf', 13), DK.tr('natures', D.natures[c.nature])),
            h('span', { class: 'chip', tip: DK.tr('passives', D.passives[c.passive], 'desc') }, DK.icon('sparkle', 13), DK.tr('passives', D.passives[c.passive])),
            DK.tracking.count(c.species) ? h('span', { class: 'chip track-chip', tip: t('track.tip', { n: DK.tracking.count(c.species) }) }, DK.icon('target', 13), t('track.chip', { n: (DK.tracking.bonus(c.species) * 100).toFixed(1).replace('.0', '') })) : null),
          h('div', { class: 'recruit-stats' }, ['hp', 'atk', 'matk', 'spd'].map((k) => h('span', { tip: DK.tr('stats', D.stats[k]) }, DK.icon(D.stats[k].icon, 13), h('b', null, s[k])))),
          btn({ icon: 'plus', label: t('exp.recruitPick'), variant: 'primary', hotkey: String(i + 1), onClick: pick }));
      })),
      btn({ icon: 'next', label: t('exp.recruitSkip'), variant: 'ghost', cls: 'exp-cont', onClick: () => { E().completeNode(); refresh(); } }));
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
      bd.replaceChildren(h('div', { class: 'zb-sky' }), DK.scenes.render(z.scene, z.colors), DK.ambient ? DK.ambient.page(z.scene) : null); // v5.9: paisaje animado a los lados
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
    icon: 'flag', section: 'battle', music: () => expTrack(), tutorial: 'expedition',
    render(params) {
      const refresh = () => DK.router.refresh();
      const e = E().active();
      if (!e) return h('div', { class: 'screen' }, DK.ui.empty('flag', t('exp.none'), t('exp.noneText')),
        btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') }));
      E().ensureMap(); E().ensureFields();
      // Al pasar a un mapa nuevo cambia la música de la zona; v4.88: en sucesos y santuarios, música de misterio
      DK.audio.music(expTrack());
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
      const focus = e.awaitingChoice ? choicePanel(refresh) : e.curseOffer ? cursePanel(e, params, refresh) : (e.relicChoice && e.relicChoice.length) ? relicPanel(e, refresh) : pend && !E().TYPES[pend.type].battle ? (nodePanel(pend, refresh) || stuckPanel(refresh)) : null;
      if (focus) {
        setTimeout(() => window.scrollTo({ top: 0 }), 0);
        const zone = D.zones[e.zone];
        return h('div', { class: 'screen exp-screen exp-focus' },
          h('div', { class: 'exp-focus-bar', style: { '--z1': zone.colors[0], '--z2': zone.colors[1] } },
            DK.icon(zone.icon, 18), h('b', null, zone.name),
            V.kindChip(e.kind), V.sizeChip(e.size), V.modChip(e.mod), e.awaitingChoice ? null : V.questChip(),
            ...progressChips(e),
            h('span', { class: 'chip', tip: t('exp.lootCoinsTip') }, DK.icon('gift', 13), h('span', { 'data-loot-coins': '1' }, t('exp.lootNow', { items: E().lootCount(), coins: e.loot.coins }))),
            h('span', { class: 'grow' }), relicBar(undefined, { compact: true })),
          h('div', { class: 'exp-focus-body' }, focus));
      }
      // Mapa a todo el ancho con la barra de estado encima (o el nodo pendiente al lado)
      return h('div', { class: 'screen exp-screen' }, hud(params, refresh),
        pend ? h('div', { class: 'exp-layout' }, mapView(refresh), h('div', { class: 'exp-side' }, nodePanel(pend, refresh))) : mapView(refresh));
    },
  });
})();
