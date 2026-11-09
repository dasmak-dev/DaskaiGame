/* =============================================================
 * components/camp.js — El campamento (pantalla principal).
 *
 * Una escena en pixel art con lugares que se pueden pulsar:
 *   hoguera → Equipo · tienda → Inventario · yunque → Crafteo
 *   muñeco → Entrenamiento · atril → Códice · tablón → Progreso (misiones)
 *   portal de piedra → Batalla (expediciones)
 * Estética oscura (estilo «dark fantasy»): luna roja, ruinas de una
 * catedral, árboles muertos, tumbas, niebla y ascuas. La hora real sólo
 * cambia el saludo y un poco la luz. Tu equipo descansa junto a la hoguera.
 *
 * Los dibujos se hacen con DK.pix: una cuadrícula de píxeles que se
 * pinta como SVG (nítido a cualquier tamaño). Para añadir un lugar,
 * añade un dibujo a SPRITES y una entrada a SPOTS.
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const { t } = DK;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };

  /* ---------------- Pixel art ---------------- */
  /** Lienzo de píxeles: set, rect, tri (triángulo de vértice arriba), circle. */
  function canvas(w, hgt) {
    const g = Array.from({ length: hgt }, () => Array(w).fill(null));
    const api = {
      w, h: hgt, g,
      set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < hgt) g[y][x] = c; return api; },
      rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) api.set(x + i, y + j, c); return api; },
      /** Triángulo con el vértice en (cx, top) y la base en `bottom` de media anchura `half`. color(x, y) o color fijo. */
      tri(cx, top, bottom, half, color) {
        for (let y = top; y <= bottom; y++) {
          const hw = Math.round(((y - top) / Math.max(1, bottom - top)) * half);
          for (let x = cx - hw; x <= cx + hw; x++) api.set(x, y, typeof color === 'function' ? color(x, y, hw, x - cx) : color);
        }
        return api;
      },
      circle(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) api.set(cx + x, cy + y, c); return api; },
    };
    return api;
  }
  /** Pinta un lienzo como <svg> (tramos horizontales del mismo color en un solo rect). */
  function pixSvg(cv, scale, cls = '') {
    const s = svgEl('svg', { viewBox: `0 0 ${cv.w} ${cv.h}`, width: cv.w * scale, height: cv.h * scale, 'shape-rendering': 'crispEdges', class: 'pix ' + cls, 'aria-hidden': 'true' });
    cv.g.forEach((row, y) => {
      let x = 0;
      while (x < cv.w) {
        const c = row[x];
        if (!c) { x++; continue; }
        let n = 1; while (x + n < cv.w && row[x + n] === c) n++;
        s.appendChild(svgEl('rect', { x, y, width: n, height: 1, fill: c }));
        x += n;
      }
    });
    return s;
  }
  DK.pix = { canvas, svg: pixSvg };

  /**
   * Textura de terreno en pixel art (imagen pequeña que se repite) a
   * partir de los colores de una zona. Se guarda en caché por colores.
   * @returns {string} data URL
   */
  const terrainCache = {};
  DK.pix.terrain = (colors, seed = 't') => {
    const key = colors.join('|') + seed;
    if (terrainCache[key]) return terrainCache[key];
    const S = 48, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d'); if (!g) return '';
    const mix = (a, b, k) => { const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v * (1 - k) + B[i] * k)).join(',')})`; };
    const [c1, c2] = colors;
    g.fillStyle = mix(c2, '#0b1020', 0.55); g.fillRect(0, 0, S, S);
    const rnd = DK.util.seeded('terrain-' + key);
    for (let i = 0; i < 70; i++) { g.fillStyle = mix(c2, '#0b1020', 0.35 + rnd() * 0.25); g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 2 + Math.floor(rnd() * 3), 2); }
    for (let i = 0; i < 26; i++) { const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S); g.fillStyle = mix(c1, c2, 0.45); g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y + 1, 1, 1); }
    for (let i = 0; i < 4; i++) { g.fillStyle = mix(c1, '#ffffff', 0.4); g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1); }
    return (terrainCache[key] = cv.toDataURL());
  };

  /* ---------------- Dibujos ---------------- */
  const WOOD = '#8b5a2b', WOOD_D = '#5c3a1c', WOOD_L = '#b07a43', OUT = '#2a1a10';
  const SPRITES = {
    tent() {
      const c = canvas(26, 20);
      c.rect(13, 0, 1, 4, WOOD_D).rect(14, 0, 4, 3, '#991b1b').rect(14, 3, 2, 1, '#7f1d1d');
      c.tri(13, 3, 19, 12, (x, y, hw, dx) => (Math.abs(dx) === hw ? OUT : Math.floor((x + 1) / 3) % 2 ? '#7f1d1d' : '#57493a'));
      c.tri(13, 9, 19, 4, (x, y, hw, dx) => (Math.abs(dx) === hw ? '#3b1d0e' : '#140b06'));
      c.rect(1, 19, 25, 1, '#3b2414');
      return c;
    },
    fire(frame) {
      const c = canvas(20, 18);
      // piedras
      [[1, 15], [4, 16], [8, 17], [12, 17], [15, 16], [17, 15]].forEach(([x, y]) => c.rect(x, y, 3, 2, '#6b7280').set(x, y, '#9ca3af'));
      // troncos cruzados
      for (let i = 0; i < 10; i++) { c.set(4 + i, 15 - Math.floor(i / 3), WOOD_D).set(4 + i, 16 - Math.floor(i / 3), WOOD); c.set(15 - i, 15 - Math.floor(i / 3), WOOD).set(15 - i, 16 - Math.floor(i / 3), WOOD_L); }
      // llamas (dos fotogramas)
      const j = frame ? 1 : -1;
      c.tri(10 + j, 2, 13, 5, '#ef4444');
      c.tri(10, 5, 13, 4, '#f97316');
      c.tri(10 - j, 8, 13, 2, '#fde047');
      c.set(6 - j, 6, '#f97316').set(14 + j, 4, '#fbbf24');
      return c;
    },
    anvil() {
      const c = canvas(22, 18);
      c.rect(6, 11, 10, 7, WOOD).rect(6, 11, 10, 1, WOOD_L).rect(8, 13, 6, 1, WOOD_D).rect(7, 15, 8, 1, WOOD_D);
      c.rect(3, 4, 16, 3, '#6b7280').rect(3, 4, 16, 1, '#cbd5e1');
      c.tri(2, 4, 6, 2, '#6b7280').set(0, 5, '#6b7280').set(1, 5, '#9ca3af');
      c.rect(8, 7, 6, 2, '#4b5563').rect(6, 9, 10, 2, '#374151');
      // martillo
      c.rect(16, 1, 1, 4, WOOD_D).rect(14, 0, 5, 2, '#94a3b8');
      return c;
    },
    dummy() {
      const c = canvas(16, 26);
      c.rect(7, 9, 2, 17, WOOD_D).rect(1, 11, 14, 2, WOOD).rect(1, 11, 14, 1, WOOD_L);
      c.circle(8, 5, 4, '#eab308').rect(6, 4, 1, 1, OUT).rect(9, 4, 1, 1, OUT).rect(7, 7, 2, 1, '#a16207');
      c.rect(4, 10, 8, 9, '#d4a017').rect(4, 10, 8, 1, '#facc15');
      c.circle(8, 14, 2, '#ef4444').set(8, 14, '#fde68a');
      c.rect(5, 25, 6, 1, '#3b2414');
      return c;
    },
    lectern() {
      const c = canvas(18, 20);
      c.rect(8, 10, 2, 8, WOOD_D).rect(5, 18, 8, 2, WOOD);
      c.rect(2, 8, 14, 3, WOOD).rect(2, 8, 14, 1, WOOD_L);
      c.rect(3, 4, 6, 4, '#fef3c7').rect(9, 4, 6, 4, '#fde68a').rect(9, 4, 1, 4, '#92400e');
      [5, 6].forEach((y) => { c.rect(4, y, 4, 1, '#a8a29e'); c.rect(10, y, 4, 1, '#a8a29e'); });
      c.set(3, 2, '#c4b5fd').set(14, 1, '#c4b5fd').set(8, 0, '#ddd6fe');
      return c;
    },
    board() {
      const c = canvas(24, 22);
      c.rect(2, 6, 2, 16, WOOD_D).rect(20, 6, 2, 16, WOOD_D);
      c.tri(12, 0, 4, 12, WOOD_D);
      c.rect(1, 4, 22, 11, WOOD).rect(1, 4, 22, 1, WOOD_L).rect(1, 8, 22, 1, WOOD_D).rect(1, 12, 22, 1, WOOD_D);
      c.rect(3, 5, 5, 6, '#fef9c3').rect(10, 6, 4, 5, '#ffffff').rect(16, 5, 5, 7, '#fde68a');
      [[4, 7], [4, 9], [11, 8], [17, 7], [17, 9]].forEach(([x, y]) => c.rect(x, y, 3, 1, '#a8a29e'));
      c.set(5, 5, '#ef4444').set(12, 6, '#ef4444').set(18, 5, '#ef4444');
      return c;
    },
    sign() {
      const c = canvas(22, 26);
      c.rect(10, 2, 2, 24, WOOD_D);
      c.rect(4, 4, 13, 5, WOOD).rect(4, 4, 13, 1, WOOD_L).tri(18, 4, 8, 0, WOOD).rect(17, 5, 2, 3, WOOD).set(19, 6, WOOD);
      c.rect(6, 6, 8, 1, '#3b2414');
      c.rect(5, 11, 12, 4, WOOD).rect(5, 11, 12, 1, WOOD_L).rect(3, 12, 2, 2, WOOD).set(2, 12, WOOD);
      c.rect(7, 12, 7, 1, '#3b2414');
      c.rect(9, 0, 4, 2, '#facc15');
      return c;
    },
    rock() {
      const c = canvas(12, 8);
      c.rect(2, 2, 8, 6, '#6b7280').rect(1, 4, 10, 4, '#6b7280').rect(3, 2, 5, 1, '#9ca3af').rect(2, 3, 2, 2, '#9ca3af').rect(1, 7, 10, 1, '#374151');
      return c;
    },
    bush(shade = 0) {
      const g1 = ['#15803d', '#166534', '#14532d'][shade], g2 = ['#22c55e', '#16a34a', '#15803d'][shade];
      const c = canvas(12, 8);
      c.circle(3, 4, 3, g1).circle(8, 4, 3, g1).circle(6, 3, 3, g2).set(5, 2, '#86efac').set(9, 3, '#f472b6');
      return c;
    },
    /** Portal de piedra con una runa encendida (camino a las expediciones). */
    portal(frame = 0) {
      const c = canvas(26, 30);
      const ST = '#4b4350', STL = '#6b6270', STD = '#2a2430';
      c.rect(2, 8, 5, 22, ST).rect(19, 8, 5, 22, ST).rect(2, 8, 1, 22, STL).rect(19, 8, 1, 22, STL);
      c.rect(0, 4, 26, 5, ST).rect(0, 4, 26, 1, STL).rect(0, 8, 26, 1, STD).rect(10, 1, 6, 4, ST).rect(10, 1, 6, 1, STL);
      c.rect(1, 28, 7, 2, STD).rect(18, 28, 7, 2, STD);
      // vórtice rojo
      const red = frame ? ['#7f1d1d', '#dc2626', '#f97316'] : ['#991b1b', '#ef4444', '#fb923c'];
      c.rect(7, 9, 12, 20, red[0]).rect(9, 11, 8, 16, red[1]).rect(11, 14, 4, 10, red[2]).rect(12, 17, 2, 4, '#fde68a');
      c.set(12, 2, '#f97316').set(13, 2, '#fde047');
      return c;
    },
    /** Árbol muerto (ramas desnudas). */
    deadTree(shade = 0) {
      const c = canvas(16, 24), W = ['#2a1d17', '#1f1612', '#17100d'][shade];
      c.rect(7, 8, 2, 16, W).rect(6, 21, 4, 3, W);
      [[6, 12, -1], [9, 10, 1], [6, 6, -1], [9, 5, 1], [8, 2, 0]].forEach(([x, y, d]) => { for (let i = 0; i < 5; i++) c.set(x + d * i, y - Math.floor(i / 2), W); });
      c.rect(2, 7, 1, 3, W).rect(13, 4, 1, 3, W).rect(1, 10, 2, 1, W);
      return c;
    },
    /** Lápida o cruz de piedra. */
    grave(kind = 0) {
      const c = canvas(10, 12), ST = ['#4b4350', '#3f3844', '#57505c'][kind % 3];
      if (kind % 2) c.rect(4, 0, 2, 12, ST).rect(1, 3, 8, 2, ST).rect(4, 0, 1, 12, '#6b6270');
      else c.rect(1, 3, 8, 9, ST).rect(2, 1, 6, 2, ST).rect(3, 0, 4, 1, ST).rect(1, 3, 1, 9, '#6b6270').rect(3, 6, 4, 1, '#2a2430');
      return c;
    },
    /** Antorcha en un poste. */
    torch(frame = 0) {
      const c = canvas(8, 22);
      c.rect(3, 8, 2, 14, '#3b2414').rect(2, 7, 4, 2, '#57534e');
      c.tri(4, frame ? 0 : 1, 6, 2, '#f97316').rect(3, 3, 2, 3, '#fde047').set(frame ? 2 : 5, 2, '#ef4444');
      return c;
    },
    pine(shade = 0) {
      const c = canvas(14, 22);
      const g1 = ['#14532d', '#0f3d22', '#0b2a18'][shade], g2 = ['#166534', '#14532d', '#0f3d22'][shade];
      c.rect(6, 18, 2, 4, WOOD_D);
      c.tri(7, 0, 8, 4, g1).tri(7, 4, 13, 5, g2).tri(7, 8, 18, 6, g1);
      return c;
    },
  };

  /* ---------------- Lugares del campamento ----------------
   * x, y: posición (en %) del pie del dibujo dentro de la escena.
   * xs, ys: posición en pantallas estrechas (móvil); xm, ym: en las medianas (< 1100 px), si hace falta. */
  // v4.58: recolocados para que nada se toque (fila del fondo: tienda, tablón, portal; delante: códice, hoguera, yunque, muñeco)
  const SPOTS = [
    { id: 'path', sprite: 'portal', screen: 'zones', nav: 'battle', x: 66, y: 54, xm: 66, ym: 53, xs: 72, ys: 54, label: () => t('scene.path'), main: true },
    { id: 'board', sprite: 'board', screen: 'progress', nav: 'progress', x: 40, y: 50, xm: 39, ym: 48, xs: 28, ys: 51, label: () => t('scene.board') },
    { id: 'tent', sprite: 'tent', screen: 'inventory', nav: 'inventory', x: 16, y: 57, xm: 15, ym: 57, xs: 20, ys: 68, label: () => t('scene.tent') },
    { id: 'anvil', sprite: 'anvil', screen: 'craft', nav: 'craft', x: 83, y: 71, xm: 84, ym: 71, xs: 84, ys: 71, label: () => t('scene.anvil') },
    { id: 'fire', sprite: 'fire', screen: 'team', nav: 'team', x: 49, y: 82, xm: 48, ym: 82, xs: 52, ys: 85, label: () => t('scene.fire'), fire: true },
    { id: 'lectern', sprite: 'lectern', screen: 'codex', nav: 'codex', x: 10, y: 92, xm: 12, ym: 94, xs: 13, ys: 94, label: () => t('scene.lectern') },
    { id: 'dummy', sprite: 'dummy', screen: 'training', nav: 'training', x: 92, y: 93, xm: 89, ym: 93, xs: 85, ys: 93, label: () => t('scene.dummy'), unlock: 'training' },
  ];


  /** Momento del día según la hora real. */
  function timeOfDay(d = new Date()) {
    const hr = d.getHours();
    return hr >= 7 && hr < 18 ? 'day' : hr >= 18 && hr < 21 ? 'dusk' : hr >= 5 && hr < 7 ? 'dawn' : 'night';
  }
  const SKY = {
    day: ['#7dd3fc', '#bae6fd', '#e0f2fe'], dawn: ['#6366f1', '#f9a8d4', '#fed7aa'],
    dusk: ['#312e81', '#c026d3', '#fb923c'], night: ['#020617', '#0f172a', '#1e1b4b'],
  };

  /** Perfil de montañas en escalones de `step` px (picos: [x, altura, pendiente]). */
  function ridge(W, base, peaks, step = 4) {
    const pts = [[0, base + 40]];
    for (let x = 0; x <= W; x += step) {
      const hgt = Math.max(0, ...peaks.map(([px, ph, sl]) => ph - Math.abs(x - px) * sl));
      const y = Math.round((base - hgt) / 2) * 2;
      pts.push([x, y], [x + step, y]);
    }
    pts.push([W, base + 40]);
    return pts.map(([x, y]) => `${x},${y}`).join(' ');
  }

  /*
   * Paletas oscuras para cada momento del día (ciclo según la hora real):
   * día = cielo ceniciento con un sol pálido; amanecer/atardecer = brasas en el
   * horizonte; noche = cielo negro, estrellas y luna de sangre.
   */
  const GRIM = {
    day: { sky: ['#3a3540', '#5b4c50', '#8a6a58'], mtn: '#342a30', ruin: '#231a1e', hill: '#2a2024', ground: ['#3a2c26', '#30241f', '#261c18'], cloud: '#4a4048', cloudOp: 0.55, stars: 0, body: 'sun', bx: 300, by: 26, disc: ['#e8dcb4', '#f5ecd0', '#d8c79a'], halo: '#f5e6b8', haloOp: 0.35, fire: 0.3, path: ['#40343a', '#4e4146'] },
    dawn: { sky: ['#1b1428', '#4c2238', '#b0502e'], mtn: '#24141c', ruin: '#160b10', hill: '#1d1015', ground: ['#2c1d1b', '#221716', '#1a1110'], cloud: '#2e1620', cloudOp: 0.7, stars: 14, body: 'sun', bx: 56, by: 44, disc: ['#f97316', '#fdba74', '#ea580c'], halo: '#fb923c', haloOp: 0.5, fire: 0.42, path: ['#2e2329', '#3a2d32'] },
    dusk: { sky: ['#120916', '#3b0f24', '#8f2c14'], mtn: '#1e0c12', ruin: '#12070b', hill: '#170a0e', ground: ['#271816', '#1e1312', '#170e0d'], cloud: '#220c14', cloudOp: 0.75, stars: 24, body: 'sun', bx: 182, by: 48, disc: ['#dc2626', '#f87171', '#b91c1c'], halo: '#ef4444', haloOp: 0.5, fire: 0.5, path: ['#2a2026', '#362a2e'] },
    night: { sky: ['#050308', '#14070c', '#3d0c10'], mtn: '#1c0d12', ruin: '#0f070a', hill: '#140a0d', ground: ['#231716', '#1b1211', '#140d0c'], cloud: '#1a0a0e', cloudOp: 0.75, stars: 46, body: 'moon', bx: 298, by: 16, disc: ['#dc2626', '#ef4444', '#b91c1c'], halo: '#ef4444', haloOp: 0.45, fire: 0.6, path: ['#2a2026', '#362a2e'] },
  };

  /** Posición del sol / la luna en pantallas estrechas (arriba a la izquierda, sobre el tablón). */
  const NARROW_BODY = { day: { bx: 146, by: 22 }, dawn: { bx: 138, by: 38 }, dusk: { bx: 142, by: 30 }, night: { bx: 146, by: 20 } };

  /** Fondo oscuro: cielo según la hora, sol pálido o luna roja, ruinas, montañas, tierra yerma, tumbas y el camino al portal. */
  function backdrop(tod, narrow = false) {
    const W = 400, H = 180, HZ = 82;
    let P = GRIM[tod] || GRIM.night;
    // v4.45: en el móvil sólo se ve la franja central del fondo (x ≈ 127–273): el sol / la luna se pasan ahí
    if (narrow) P = Object.assign({}, P, NARROW_BODY[tod] || NARROW_BODY.night);
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMax slice', class: 'camp-bg', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' });
    const defs = svgEl('defs');
    const lg = svgEl('linearGradient', { id: 'campSky', x1: 0, y1: 0, x2: 0, y2: 1 });
    P.sky.forEach((c, i) => lg.appendChild(svgEl('stop', { offset: i / 2, 'stop-color': c })));
    const glow = svgEl('radialGradient', { id: 'campGlow', cx: '50%', cy: '82%', r: '46%' });
    glow.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#f97316', 'stop-opacity': P.fire }));
    glow.appendChild(svgEl('stop', { offset: 0.45, 'stop-color': '#b91c1c', 'stop-opacity': P.fire / 3 }));
    glow.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#7f1d1d', 'stop-opacity': 0 }));
    const moonGlow = svgEl('radialGradient', { id: 'campMoon', cx: '50%', cy: '50%', r: '50%' });
    moonGlow.appendChild(svgEl('stop', { offset: 0, 'stop-color': P.halo, 'stop-opacity': P.haloOp }));
    moonGlow.appendChild(svgEl('stop', { offset: 1, 'stop-color': P.halo, 'stop-opacity': 0 }));
    defs.append(lg, glow, moonGlow); s.appendChild(defs);
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campSky)' }));
    const rnd = DK.util.seeded('camp-grim');
    // Estrellas tenues (más cuanto más oscuro)
    for (let i = 0; i < P.stars; i++) s.appendChild(svgEl('rect', { x: Math.floor(rnd() * W), y: Math.floor(rnd() * (HZ - 30)), width: 1, height: 1, fill: '#fecaca', opacity: 0.25 + rnd() * 0.4, class: rnd() < 0.3 ? 'twinkle' : '' }));
    // Sol pálido / sol de brasas / luna roja, con halo
    s.appendChild(svgEl('circle', { cx: P.bx + 14, cy: P.by + 14, r: P.body === 'moon' ? 34 : 40, fill: 'url(#campMoon)', 'shape-rendering': 'auto', class: 'camp-body ' + P.body }));
    const [c0, c1, c2] = P.disc;
    const disc = P.body === 'moon'
      ? canvas(29, 29).circle(14, 14, 14, c0).circle(14, 14, 12, c1).circle(10, 9, 3, c2).circle(18, 17, 2, c2).circle(16, 7, 1, '#f87171')
      : canvas(29, 29).circle(14, 14, 13, c2).circle(14, 14, 11, c0).circle(12, 11, 6, c1);
    const ds = pixSvg(disc, 1); ds.setAttribute('x', P.bx); ds.setAttribute('y', P.by); s.appendChild(ds);
    // Nubes oscuras que pasan delante
    [[250, 26, 1.2], [60, 14, 1], [170, 40, 0.9]].concat(tod === 'day' ? [[330, 8, 1.4], [110, 30, 1.1]] : []).forEach(([x, y, k], n) => {
      const g = svgEl('g', { class: 'camp-cloud', style: `animation-delay:${-n * 18}s` });
      [[0, 4, 30, 3], [6, 1, 14, 3], [16, 0, 10, 3], [3, 7, 22, 2]].forEach(([cx, cy, cw, ch]) => g.appendChild(svgEl('rect', { x: x + cx * k, y: y + cy, width: cw * k, height: ch, fill: P.cloud, opacity: P.cloudOp })));
      s.appendChild(g);
    });
    // Montañas afiladas
    s.appendChild(svgEl('polygon', { points: ridge(W, HZ, [[30, 30, 0.9], [120, 44, 1.1], [215, 28, 0.8], [330, 40, 1.0], [395, 26, 0.9]]), fill: P.mtn }));
    // Ruinas de una catedral en el horizonte (ventanas encendidas)
    const ru = P.ruin;
    [[86, 26, 10], [96, 38, 6], [104, 30, 8], [116, 18, 10], [150, 22, 6]].forEach(([x, hgt, w]) => {
      s.appendChild(svgEl('rect', { x, y: HZ - hgt, width: w, height: hgt, fill: ru }));
      s.appendChild(svgEl('polygon', { points: `${x},${HZ - hgt} ${x + w / 2},${HZ - hgt - w * 0.9} ${x + w},${HZ - hgt}`, fill: ru }));
    });
    s.appendChild(svgEl('rect', { x: 84, y: HZ - 12, width: 72, height: 12, fill: ru }));
    [[98, HZ - 30], [106, HZ - 22], [119, HZ - 12], [120, HZ - 26], [140, HZ - 8]].forEach(([x, y]) => s.appendChild(svgEl('rect', { x, y, width: 2, height: 3, fill: '#f97316', opacity: 0.8, class: 'twinkle' })));
    // Colinas cercanas
    s.appendChild(svgEl('polygon', { points: ridge(W, HZ, [[0, 16, 0.35], [95, 12, 0.3], [205, 18, 0.4], [300, 14, 0.35], [400, 16, 0.4]]), fill: P.hill }));
    // Tierra yerma
    s.appendChild(svgEl('rect', { x: 0, y: HZ, width: W, height: 10, fill: P.ground[0] }));
    s.appendChild(svgEl('rect', { x: 0, y: HZ + 10, width: W, height: 40, fill: P.ground[1] }));
    s.appendChild(svgEl('rect', { x: 0, y: HZ + 50, width: W, height: H - HZ - 50, fill: P.ground[2] }));
    // Árboles muertos y tumbas
    [[6, 0], [24, 1], [46, 2], [160, 1], [176, 0], [356, 1], [380, 0]].forEach(([x, sh]) => { const p = pixSvg(SPRITES.deadTree(sh), 1); p.setAttribute('x', x); p.setAttribute('y', HZ - 22 + sh * 2); s.appendChild(p); });
    [[38, HZ + 6, 0], [52, HZ + 12, 1], [70, HZ + 4, 2], [348, HZ + 8, 1], [366, HZ + 14, 0], [226, HZ + 3, 2]].forEach(([x, y, k]) => { const p = pixSvg(SPRITES.grave(k), 1); p.setAttribute('x', x); p.setAttribute('y', y); s.appendChild(p); });
    // Camino de losas hacia el portal
    for (let y = HZ + 2; y < H; y += 2) {
      const tt = (y - HZ) / (H - HZ);
      const cx = 264 - tt * 64 + Math.round(Math.sin(tt * 5) * 6);
      const hw = Math.round(3 + tt * 22);
      s.appendChild(svgEl('rect', { x: cx - hw, y, width: hw * 2, height: 2, fill: y % 8 < 2 ? P.path[0] : P.path[1] }));
      if (y % 6 === 0) s.appendChild(svgEl('rect', { x: cx - hw + 2 + Math.floor(rnd() * Math.max(1, hw * 2 - 6)), y, width: 3, height: 1, fill: '#4b3d42' }));
    }
    // Hierba seca y huesos
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rnd() * W), y = HZ + 6 + Math.floor(rnd() * (H - HZ - 8));
      s.appendChild(svgEl('rect', { x, y, width: 1, height: 2, fill: '#4a3a24', opacity: 0.8 }));
      if (i % 11 === 0) s.appendChild(svgEl('rect', { x: x + 1, y: y + 1, width: 3, height: 1, fill: '#d6cfc0', opacity: 0.55 }));
    }
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campGlow)' }));
    return s;
  }

  /**
   * Dibujo animado (components/campArt.js): fotogramas apilados que
   * css/motion.css alterna (.camp-anim.n3 …). Conserva el tamaño del dibujo
   * antiguo (`base`). null si no hay versión animada.
   */
  function animArt(name, scale, delay = 0) {
    const a = DK.pix.animated && DK.pix.animated(name); if (!a) return null;
    const k = (scale * a.base) / a.frames[0].w;
    return h('span', { class: `camp-anim a-${name} n${a.frames.length}`, style: delay ? { '--d': delay + 's' } : null },
      ...a.frames.map((cv, i) => { const el = pixSvg(cv, k, 'fr fr' + i); el.style.setProperty('--i', i); return el; }),
      a.over ? pixSvg(a.over, k, 'fr-top') : null);
  }

  /**
   * Escena del campamento.
   * @param {Object} o  team: daskai junto a la hoguera · onSpot(spot) al pulsar un lugar
   * @returns {HTMLElement}
   */
  DK.views.campScene = (o = {}) => {
    const tod = o.tod || timeOfDay();
    const narrow = window.innerWidth <= 600;
    // v4.54: en el Inicio la escena va en una columna (o.compact) → dibujos y posiciones de pantalla mediana
    const mid = !narrow && (window.innerWidth < 1100 || !!o.compact); // v4.95: en el Inicio la escena nunca es ancha (antes, a ≥1800 px se solapaba todo)
    const scale = narrow ? 2.8 : mid ? 4 : 5;
    const nav = Object.fromEntries(DK.menus.items('nav').map((it) => [it.id, it]));
    const spots = SPOTS.map((sp) => {
      const locked = sp.unlock && !DK.unlocks.has(sp.unlock);
      const it = nav[sp.nav];
      const badge = !locked && it && it.badge ? it.badge() : '';
      const art0 = animArt(sp.sprite, scale) || pixSvg(SPRITES[sp.sprite](), scale);
      // v4.80: el códice es pixel art animado por fotogramas (campArt.js); aquí sólo un halo suave y las chispas que suben
      const art = sp.id === 'lectern' ? h('span', { class: 'codex-wrap' }, h('i', { class: 'codex-halo', 'aria-hidden': 'true' }), art0,
        h('span', { class: 'codex-sparks', 'aria-hidden': 'true' },
        Array.from({ length: 8 }, (_, i) => h('i', { class: i % 3 === 0 ? 'rune' : i % 3 === 1 ? 'gold' : '', style: { left: (14 + ((i * 37) % 72)) + '%', animationDelay: (i * 0.5).toFixed(2) + 's', animationDuration: (2.8 + (i % 4) * 0.5).toFixed(2) + 's', '--dx': (((i * 23) % 30) - 15) + 'px' } }, i % 3 === 0 ? 'ᚱᚨᛟᛞ'[i % 4] : '')))) : art0;
      const label = typeof sp.label === 'function' ? sp.label() : sp.label;
      return h('button', {
        class: `camp-spot s-${sp.id}` + (locked ? ' locked' : '') + (sp.main ? ' main' : ''), type: 'button',
        style: { left: (narrow ? sp.xs : mid && sp.xm != null ? sp.xm : sp.x) + '%', top: (narrow ? sp.ys : mid && sp.ym != null ? sp.ym : sp.y) + '%' },
        'aria-label': locked ? `${label} · ${t('scene.locked')}` : label,
        tip: locked ? t('unlock.trainingLocked') : label,
        onClick: () => { if (locked) { DK.audio.sfx('error'); DK.ui.toast(t('unlock.trainingLocked'), { icon: 'lock' }); return; } DK.audio.sfx('select'); if (o.onSpot) o.onSpot(sp); else DK.router.reset(sp.screen); },
      }, h('span', { class: 'camp-art' }, art, locked ? h('span', { class: 'camp-lock' }, DK.icon('lock', 16)) : null, badge ? h('span', { class: 'nav-dot' }, badge) : null),
      // v4.54: etiqueta moderna con el icono de su sección
      h('span', { class: 'camp-plaque' }, DK.icon(locked ? 'lock' : (it && it.icon) || 'next', 13), h('span', null, label)));
    });
    // Tu equipo descansando junto a la hoguera
    const fire = SPOTS.find((sp) => sp.fire);
    const fx = narrow ? fire.xs : mid && fire.xm != null ? fire.xm : fire.x, fy = narrow ? fire.ys : mid && fire.ym != null ? fire.ym : fire.y;
    // v4.98: el equipo en corro alrededor de la hoguera. Seis sitios fijos simétricos (dentro, lejos y delante a
    // cada lado), que se llenan del centro hacia fuera; los de delante tapan a los de atrás. Comprobado a
    // 390, 768, 1024, 1366 y 1920 px para no pisar la hoguera, su cartel ni los demás lugares.
    const ring = narrow ? [[-15, -2], [15, -2], [-12, -12], [13, -12], [-17, 10], [17, 10]]
      : [[-12, -4], [12, -4], [-24, -1], [24, -3], [-21, 12], [20, 12]];
    const size = narrow ? 44 : 84;
    const team = (o.team || []).slice(0, ring.length).map((d, i) => { const [dx, dy] = ring[i]; return h('button', {
      class: 'camp-mon', type: 'button', style: { left: fx + dx + '%', top: fy + dy + '%', zIndex: 2 + Math.round(dy + 20), animationDelay: (i * 0.4) + 's' },
      'aria-label': DK.daskai.name(d), tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`,
      // v4.67: el mismo resumen rápido que «Tu equipo» (antes llevaba a la pantalla de equipo)
      onClick: () => { DK.audio.sfx('select'); DK.views.quickStats(d, { onChange: o.onChange || (() => DK.router.refresh()) }); },
    }, DK.views.sprite(d.species, { look: DK.looks.of(d), size, shiny: d.shiny, flip: dx > 0 })); });
    // Ascuas que suben de la hoguera, niebla baja y antorchas
    const embers = h('div', { class: 'camp-embers', 'aria-hidden': 'true', style: { left: fx + '%', top: fy + '%' } }, Array.from({ length: 16 }, (_, i) => h('i', { style: { '--dx': ((i * 37) % 60 - 30) + 'px', left: ((i * 13) % 40 - 20) + 'px', animationDelay: (i * 0.35) + 's', animationDuration: (2.6 + (i % 5) * 0.5) + 's' } })));
    const fog = h('div', { class: 'camp-fog', 'aria-hidden': 'true' }, h('i'), h('i'));
    // v4.78: la luz de la hoguera parpadea en el suelo y motas de polvo flotan despacio
    const firelight = h('div', { class: 'camp-firelight', 'aria-hidden': 'true', style: { left: fx + '%', top: fy + '%' } });
    const motes = h('div', { class: 'camp-motes', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { left: ((i * 53) % 96 + 2) + '%', top: (40 + (i * 29) % 55) + '%', animationDelay: (i * 1.3).toFixed(1) + 's', animationDuration: (9 + (i % 5) * 2.5) + 's' } })));
    const torches = (narrow ? [[5, 58], [96, 62]] : mid ? [[29, 56], [79, 52], [3, 78], [97, 78]] : [[31, 62], [74, 62], [3, 78], [97, 78]]).map(([x, y], i) =>
      h('span', { class: 'camp-torch', 'aria-hidden': 'true', style: { left: x + '%', top: y + '%' } }, animArt('torch', scale * 0.8, i * 0.13) || pixSvg(SPRITES.torch(0), scale * 0.8)));
    return h('section', { class: 'camp-scene grim tod-' + tod, 'aria-label': t('scene.title') },
      backdrop(tod, narrow), firelight, fog, motes, ...torches, embers,
      h('div', { class: 'camp-greet' }, h('span', { class: 'camp-greet-text' }, t('scene.greet.' + tod))),
      ...team, ...spots);
  };
  DK.views.campTimeOfDay = timeOfDay;
  DK.views.campBackdrop = backdrop;
  DK.pix.sprites = SPRITES;
})();
