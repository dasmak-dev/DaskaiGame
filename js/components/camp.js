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
    // v5.25: tesela de 96 px con más detalle: manchas de tierra tramadas, matas de hierba con luz, piedrecitas,
    // florecillas y grietas. Todo se dibuja «dando la vuelta» por los bordes para que la tesela encaje.
    const S = 96, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d'); if (!g) return '';
    const mix = (a, b, k) => { const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v * (1 - k) + B[i] * k)).join(',')})`; };
    const px = (x, y, w = 1, hh = 1) => { for (const ox of [0, -S]) for (const oy of [0, -S]) g.fillRect(x + ox, y + oy, w, hh); };
    const W = (v) => ((Math.floor(v) % S) + S) % S;
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const [c1, c2] = colors;
    const base = mix(c2, '#0b1020', 0.55), dark = mix(c2, '#0b1020', 0.68), lite = mix(c2, '#0b1020', 0.42);
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    const rnd = DK.util.seeded('terrain-' + key);
    // manchas grandes (más oscuras o más claras) con borde tramado
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * S, cy = rnd() * S, r = 8 + rnd() * 14, col = rnd() < .55 ? dark : lite; g.fillStyle = col;
      for (let y = -r; y <= r; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) { const d = Math.hypot(x / 1.4, y) / r; if (d < .7 || (d < 1 && B[((cy + y) & 3) * 4 + ((cx + x) & 3)] / 16 > (d - .7) / .3)) px(W(cx + x), W(cy + y)); }
    }
    for (let i = 0; i < 160; i++) { g.fillStyle = mix(c2, '#0b1020', 0.35 + rnd() * 0.3); px(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + Math.floor(rnd() * 3), 1); }
    // matas de hierba: tallos oscuros con la punta iluminada
    for (let i = 0; i < 34; i++) { const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
      g.fillStyle = mix(c1, c2, 0.62); px(x, y, 1, 3); px(x + 2, y + 1, 1, 2); px(x - 2, y + 1, 1, 2);
      g.fillStyle = mix(c1, c2, 0.3); px(x, y, 1, 1); px(x + 2, y + 1, 1, 1); }
    // piedrecitas con brillo arriba y sombra abajo
    for (let i = 0; i < 9; i++) { const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S), w = 2 + Math.floor(rnd() * 2);
      g.fillStyle = 'rgba(0,0,0,.35)'; px(x, y + 2, w + 1, 1); g.fillStyle = mix('#8a8290', c2, .45); px(x, y, w, 2); g.fillStyle = mix('#c9c2cf', c2, .35); px(x, y, w - 1, 1); }
    // florecillas (pocas): 4 pétalos y el centro
    const FL = ['#f9a8d4', '#fde68a', '#c4b5fd', '#ffffff'];
    for (let i = 0; i < 6; i++) { const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S); g.fillStyle = mix(FL[i % FL.length], c2, .35); px(x - 1, y); px(x + 1, y); px(x, y - 1); px(x, y + 1); g.fillStyle = mix('#facc15', c2, .2); px(x, y); }
    // grietas finas
    for (let i = 0; i < 3; i++) { let x = rnd() * S, y = rnd() * S; g.fillStyle = mix(c2, '#000000', .7); for (let k = 0; k < 10; k++) { px(W(x), W(y)); x += rnd() < .5 ? 1 : 0; y += 1; if (rnd() < .3) x -= 1; } }
    for (let i = 0; i < 6; i++) { g.fillStyle = mix(c1, '#ffffff', 0.4); px(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1); }
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
      const c = canvas(16, 24), W = ['#2a1d17', '#1f1612', '#0b0708'][shade];
      c.rect(7, 8, 2, 16, W).rect(6, 21, 4, 3, W);
      [[6, 12, -1], [9, 10, 1], [6, 6, -1], [9, 5, 1], [8, 2, 0]].forEach(([x, y, d]) => { for (let i = 0; i < 5; i++) c.set(x + d * i, y - Math.floor(i / 2), W); });
      c.rect(2, 7, 1, 3, W).rect(13, 4, 1, 3, W).rect(1, 10, 2, 1, W);
      return c;
    },
    /** Lápida o cruz de piedra. */
    grave(kind = 0) {
      const c = canvas(10, 12), ST = ['#221c22', '#1b161b', '#282127'][kind % 3]; // v5.30: más oscuras
      if (kind % 2) c.rect(4, 0, 2, 12, ST).rect(1, 3, 8, 2, ST).rect(4, 0, 1, 12, '#332a31');
      else c.rect(1, 3, 8, 9, ST).rect(2, 1, 6, 2, ST).rect(3, 0, 4, 1, ST).rect(1, 3, 1, 9, '#332a31').rect(3, 6, 4, 1, '#0e0b0e');
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
    { id: 'tent', sprite: 'tent', screen: 'inventory', nav: 'inventory', x: 17, y: 57, xm: 16.5, ym: 57, xs: 21, ys: 68, label: () => t('scene.tent') },
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
   * v5.30: paletas mucho más oscuras y tétricas (ciclo según la hora real). Sin brillos de contorno:
   * día = cielo de ceniza y un SOL NEGRO con corona pálida · amanecer / atardecer = un sol rojo que se hunde
   * en un horizonte de brasas · noche = negro casi total, luna de sangre y el resplandor del infierno abajo.
   *   sky: [arriba, medio, horizonte] · hell: resplandor del horizonte · far/mid/hill: siluetas · ground: [arriba, abajo]
   */
  const GRIM = {
    day: { sky: ['#0c0a0b', '#1b1416', '#3a221c'], hell: '#7a2e1c', hellOp: 0.35, far: '#22171a', mid: '#120c0e', hill: '#0c0809', ruin: '#0a0607', ground: ['#1e1513', '#0d0909'], cloud: '#2a2023', cloudOp: 0.5, stars: 0, body: 'blacksun', bx: 296, by: 20, disc: ['#0a0607', '#d6c7b0', '#6b5a4a'], halo: '#cbb89a', haloOp: 0.22, fire: 0.24, path: ['#1d1718', '#241c1d'], crack: '#c2410c' },
    dawn: { sky: ['#050307', '#170910', '#4a1410'], hell: '#9a3412', hellOp: 0.45, far: '#1a0b0e', mid: '#0d0608', hill: '#090405', ruin: '#070304', ground: ['#1b1110', '#0a0606'], cloud: '#1f0c12', cloudOp: 0.6, stars: 12, body: 'sun', bx: 60, by: 50, disc: ['#991b1b', '#dc2626', '#7f1d1d'], halo: '#dc2626', haloOp: 0.35, fire: 0.36, path: ['#1a1314', '#211819'], crack: '#ea580c' },
    dusk: { sky: ['#040104', '#160408', '#5c0e0a'], hell: '#b91c1c', hellOp: 0.5, far: '#1a080b', mid: '#0c0406', hill: '#080304', ruin: '#060203', ground: ['#1a0f0e', '#090505'], cloud: '#1c080d', cloudOp: 0.65, stars: 20, body: 'sun', bx: 184, by: 54, disc: ['#7f1d1d', '#b91c1c', '#450a0a'], halo: '#ef4444', haloOp: 0.4, fire: 0.42, path: ['#191213', '#201718'], crack: '#f97316' },
    night: { sky: ['#010001', '#080205', '#2a0507'], hell: '#7f1d1d', hellOp: 0.5, far: '#130609', mid: '#080305', hill: '#050203', ruin: '#040102', ground: ['#160c0c', '#060303'], cloud: '#12050a', cloudOp: 0.7, stars: 40, body: 'moon', bx: 296, by: 14, disc: ['#7f1d1d', '#b91c1c', '#450a0a'], halo: '#dc2626', haloOp: 0.32, fire: 0.5, path: ['#161011', '#1c1415'], crack: '#ef4444' },
  };

  /** Posición del sol / la luna en pantallas estrechas (arriba a la izquierda, sobre el tablón). */
  const NARROW_BODY = { day: { bx: 146, by: 22 }, dawn: { bx: 138, by: 38 }, dusk: { bx: 142, by: 30 }, night: { bx: 146, by: 20 } };

  /* ---------- v5.29: fondo del campamento por capas (pixel art dibujado en un lienzo) ---------- */
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
  const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const hex = (c) => { c = c.replace('#', ''); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixc = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
  /** Lienzo RGBA de W×H con utilidades mínimas (se repite en horizontal si `wrap`). */
  function layer(W, H, wrap = false) {
    const d = new Uint8ClampedArray(W * H * 4);
    const L = {
      d, W, H,
      set(x, y, c, a = 255) { x = Math.round(x); y = Math.round(y); if (y < 0 || y >= H) return; if (wrap) x = ((x % W) + W) % W; else if (x < 0 || x >= W) return; const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; },
      a(x, y) { if (y < 0 || y >= H) return 0; if (wrap) x = ((x % W) + W) % W; else if (x < 0 || x >= W) return 0; return d[(y * W + x) * 4 + 3]; },
      col(x, y0, y1, c, a) { for (let y = Math.max(0, Math.round(y0)); y <= Math.min(H - 1, Math.round(y1)); y++) L.set(x, y, c, a); },
      disc(cx, cy, r, c, a, ry = r) { for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if ((x / r) ** 2 + (y / ry) ** 2 <= 1) L.set(cx + x, cy + y, c, a); },
      tri(cx, yb, w, hh, c) { for (let k = 0; k < hh; k++) { const half = Math.round(w / 2 * (1 - k / hh)); for (let dx = -half; dx <= half; dx++) L.set(cx + dx, yb - k, c); } },
      /** píxeles con hueco encima → color de luz */
      rim(c, rows = 1) { const m = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (L.a(x, y) === 255) for (let k = 1; k <= rows; k++) if (!L.a(x, y - k)) { m.push([x, y, k]); break; } m.forEach(([x, y, k]) => L.set(x, y, k === 1 ? c : mixc(c, L.px(x, y), .5))); },
      px(x, y) { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; },
      /** tramado hacia `c` en las filas y0..y1 (niebla que sube del suelo) */
      haze(c, y0, y1, max) { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) { const k = (y - y0) / (y1 - y0) * max; for (let x = 0; x < W; x++) if (L.a(x, y) === 255 && bay(x, y) < k) { const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } } },
      /** v5.30: funde hacia `c` de forma continua (sin trama) en las filas y0..y1 */
      fade(c, y0, y1, max) { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) { const k = Math.max(0, (y - y0) / (y1 - y0)) * max; for (let x = 0; x < W; x++) if (L.a(x, y)) { const i = (y * W + x) * 4; d[i] += (c[0] - d[i]) * k; d[i + 1] += (c[1] - d[i + 1]) * k; d[i + 2] += (c[2] - d[i + 2]) * k; } } },
      url() { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(new ImageData(d, W, H), 0, 0); return cv.toDataURL('image/png'); },
    };
    return L;
  }
  /** Perfil de montaña que encaja por los lados (ondas de frecuencia entera + ruido suave). */
  function prof(rnd, W, base, amp, sharp, jag) {
    const ws = Array.from({ length: 4 }, (_, i) => ({ k: 1 + i + Math.floor(rnd() * (i + 2)), a: amp / (i + 1.1), p: rnd() * 6.283 }));
    const nz = Array.from({ length: Math.ceil(W / 3) + 1 }, () => rnd());
    return (x) => { let y = 0; for (const w of ws) { const s0 = Math.sin(2 * Math.PI * w.k * x / W + w.p); y += w.a * (sharp ? 1 - 2 * Math.abs(s0) : s0); }
      const c = (((x % W) + W) % W) / 3, i = Math.floor(c), f = c - i; return Math.round(base - y + ((nz[i] * (1 - f) + nz[(i + 1) % nz.length] * f) - .5) * jag); };
  }
  const campLayerCache = new Map();
  /** Lienzo 2D liso (para el cielo, el humo y los resplandores: degradados sin escalones). */
  function smooth(W, H) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return { cv, g: cv.getContext('2d'), url: () => cv.toDataURL('image/png') }; }
  /** Grano muy fino (±n) sobre un lienzo liso: rompe los escalones de los degradados oscuros. */
  function grain(S, n, rnd) { const im = S.g.getImageData(0, 0, S.cv.width, S.cv.height), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = (rnd() - .5) * n; d[i] += v; d[i + 1] += v; d[i + 2] += v; } S.g.putImageData(im, 0, 0); }
  /**
   * v5.30: las capas del fondo para un momento del día: [{ id, url, smooth }] (cacheadas). Cielo, humo y resplandor
   * son lisos (sin bandas ni tramas); las siluetas son pixel art casi negro y sin luces de contorno.
   */
  function campLayers(tod) {
    if (campLayerCache.has(tod)) return campLayerCache.get(tod);
    const W = 400, H = 180, HZ = 82, P = GRIM[tod] || GRIM.night, rnd = DK.util.seeded('camp-layers5');
    const skyH = P.sky.map(hex), hell = hex(P.hell), far = hex(P.far), midC = hex(P.mid), hill = hex(P.hill), ruin = hex(P.ruin), gT = hex(P.ground[0]), gB = hex(P.ground[1]);
    const black = [0, 0, 0], crack = hex(P.crack);
    // 1) cielo: degradado liso + resplandor rojo en el horizonte + grano fino
    const sky = smooth(W, H), g = sky.g, lg = g.createLinearGradient(0, 0, 0, HZ + 8);
    lg.addColorStop(0, P.sky[0]); lg.addColorStop(.55, P.sky[1]); lg.addColorStop(1, P.sky[2]);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(200, HZ + 10, 4, 200, HZ + 10, 230); rg.addColorStop(0, `rgba(${hell},${P.hellOp})`); rg.addColorStop(.45, `rgba(${hell},${P.hellOp * .35})`); rg.addColorStop(1, `rgba(${hell},0)`);
    g.save(); g.scale(1, .32); g.translate(0, (HZ + 10) * (1 / .32 - 1)); g.fillStyle = rg; g.fillRect(0, 0, W, H / .32); g.restore();
    grain(sky, 3, rnd);
    // 2) humo / nubes de ceniza: manchas difusas (círculos con degradado), sin bordes; se repite en horizontal
    const clouds = smooth(W, H), cg = clouds.g, cc = hex(P.cloud);
    for (let n = 0; n < 26; n++) { const x = rnd() * W, y = 6 + rnd() * 52, r = 14 + rnd() * 30, a = P.cloudOp * (.25 + rnd() * .35);
      [x, x - W, x + W].forEach((xx) => { const q = cg.createRadialGradient(xx, y, 0, xx, y, r); q.addColorStop(0, `rgba(${cc},${a})`); q.addColorStop(1, `rgba(${cc},0)`); cg.fillStyle = q; cg.save(); cg.translate(xx, y); cg.scale(2.2, .55); cg.translate(-xx, -y); cg.beginPath(); cg.arc(xx, y, r, 0, 7); cg.fill(); cg.restore(); }); }
    // 3) lejos: agujas y riscos dentados que se recortan contra el resplandor; abajo se funden con él (sin trama)
    const farL = layer(W, H), f1 = prof(rnd, W, HZ - 20, 14, true, 8);
    for (let x = 0; x < W; x++) farL.col(x, f1(x), HZ + 4, far);
    // agujas de espinas y una ciudadela con cuernos en la lejanía
    [[30, 34, 3], [58, 24, 2], [236, 36, 3], [252, 26, 2], [372, 24, 2], [340, 30, 2]].forEach(([x, hh, w]) => farL.tri(x, HZ - 4, w * 2 + 1, hh, far));
    for (let i = 0; i < 26; i++) farL.col(186 + i, HZ - 30 - (i % 6 === 0 ? 8 : 0), HZ, far);
    [190, 198, 206].forEach((x, i) => farL.tri(x, HZ - 30, 5, i === 1 ? 12 : 8, far)); // torres con chapitel
    farL.fade(hell, HZ - 30, HZ + 4, .45);
    // 4) medio: crestas negras, bosque de pinos secos y la catedral en ruinas (sus ventanas se encienden en el SVG)
    const mid = layer(W, H), m1 = prof(rnd, W, HZ - 8, 18, true, 8);
    for (let x = 0; x < W; x++) mid.col(x, m1(x), HZ + 6, midC);
    for (let x = 0; x < W; x += 2 + Math.floor(rnd() * 4)) { const hh = 5 + Math.floor(rnd() * 11); mid.tri(x, HZ + 2, Math.max(2, hh * .35), hh, midC); }
    [[86, 26, 10], [96, 38, 6], [104, 30, 8], [116, 18, 10], [150, 22, 6]].forEach(([x, hh, w]) => { for (let i = 0; i < w; i++) mid.col(x + i, HZ - hh, HZ, ruin); mid.tri(x + w / 2, HZ - hh, w, Math.round(w * 1.4), ruin); });
    for (let i = 0; i < 72; i++) mid.col(84 + i, HZ - 12 + (i % 9 === 0 ? -3 : 0), HZ, ruin);
    // cruz rota en lo alto de la torre mayor
    mid.col(99, HZ - 52, HZ - 38, ruin); for (let k = -2; k <= 2; k++) mid.set(99 + k, HZ - 48, ruin);
    mid.fade(hell, HZ - 6, HZ + 6, .22);
    // 5) colinas cercanas, negras
    const hills = layer(W, H), h1 = prof(rnd, W, HZ - 1, 6, false, 3);
    for (let x = 0; x < W; x++) hills.col(x, h1(x), HZ + 8, hill);
    // 6) suelo: degradado continuo (sin franjas), manchas suaves, piedras, huesos y grietas con brasas
    const gr = layer(W, H), nz = Array.from({ length: 64 }, () => rnd());
    // ruido suave (interpolado): manchas sin bordes de bloque
    const vn = (x, y, sx, sy, o) => { const fx = x / sx, fy = y / sy, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, at = (a, b) => nz[(a * 7 + b * 13 + o) & 63], sm = (t) => t * t * (3 - 2 * t);
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sm(u), b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sm(u); return a + (b - a) * sm(v); };
    const noise = (x, y) => vn(x, y, 22, 7, 0) * .65 + vn(x, y, 9, 4, 17) * .35;
    for (let y = HZ; y < H; y++) { const k = Math.pow((y - HZ) / (H - HZ), .8), base = mixc(gT, gB, k); for (let x = 0; x < W; x++) { const v = noise(x, y); gr.set(x, y, mixc(base, v < .5 ? black : [70, 50, 46], Math.abs(v - .5) * (v < .5 ? .7 : .3))); } }
    const cracks = layer(W, H);
    for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * W), y = HZ + 6 + Math.floor(rnd() * (H - HZ - 8)), k = (y - HZ) / (H - HZ), r = rnd();
      if (r < .4) { const w = 1 + Math.round(k * 3); for (let j = 0; j < w; j++) { gr.set(x + j, y, [38, 30, 32]); gr.set(x + j, y + 1, [10, 7, 8]); } }          // piedras
      else if (r < .75) { let cx = x, cy = y; const n = 6 + k * 10, hot = rnd() < .45; for (let j = 0; j < n; j++) { gr.set(cx, cy, mixc(gB, black, .6)); if (hot) cracks.set(cx, cy, crack, 70 + Math.round(rnd() * 90)); cx += rnd() < .6 ? 1 : 0; cy += rnd() < .35 ? 1 : 0; } } // grietas con brasas
      else if (r < .88) { gr.set(x, y, [120, 112, 100]); gr.set(x + 1, y, [120, 112, 100]); gr.set(x + 2, y + 1, [86, 80, 72]); }                                   // huesos
      else { gr.set(x, y, [52, 40, 30]); gr.set(x, y - 1, [40, 30, 22]); }                                                                                    // hierba muerta
    }
    // camino de losas oscuras hacia el portal (juntas suaves, sin brillos)
    for (let y = HZ + 2; y < H; y++) {
      const tt = (y - HZ) / (H - HZ), cx = 264 - tt * 64 + Math.round(Math.sin(tt * 5) * 6), hw = Math.round(3 + tt * 22), row = Math.floor((y - HZ) / (3 + tt * 5));
      for (let x = cx - hw; x <= cx + hw; x++) {
        const stone = Math.floor((x - cx + hw + (row % 2) * 4) / (5 + tt * 7)), edgeY = (y - HZ) % Math.max(3, Math.round(3 + tt * 5)) === 0;
        const c = mixc(hex(stone % 3 ? P.path[0] : P.path[1]), black, .25 * (1 - tt));
        gr.set(x, y, edgeY || x === cx - hw || x === cx + hw ? mixc(c, black, .4) : c);
      }
    }
    // 7) primer plano: rocas negras y zarzas de espinas en las esquinas de abajo
    const fg = layer(W, H), fgC = [4, 2, 3];
    [[0, 30], [400, 34]].forEach(([cx, w]) => { for (let k = 0; k < 4; k++) fg.disc(cx + (cx ? -1 : 1) * (k * 9 + rnd() * 6), H - 2 + rnd() * 3, w * (.5 - k * .08), fgC, 255, 7 + rnd() * 4); });
    for (let i = 0; i < 16; i++) { const side = i % 2, x0 = side ? W - 4 - rnd() * 56 : 4 + rnd() * 56, y0 = H - 6 - rnd() * 6, len = 10 + rnd() * 16, dir = (side ? -1 : 1) * (.3 + rnd() * .6);
      let x = x0, y = y0; for (let k = 0; k < len; k++) { fg.set(x, y, fgC); if (k % 4 === 2) fg.set(x + (k % 8 === 2 ? 1 : -1), y - 1, fgC); x += dir * .6; y -= .8; } }
    const out = [['sky', sky, 1], ['clouds', clouds, 1], ['far', farL, 0], ['mid', mid, 0], ['hills', hills, 0], ['ground', gr, 0], ['cracks', cracks, 0], ['fg', fg, 0]].map(([id, L, sm]) => ({ id, url: L.url(), smooth: !!sm }));
    campLayerCache.set(tod, out);
    return out;
  }

  /** v5.30: fondo oscuro y diabólico por capas: cielo liso con el resplandor del infierno, humo que pasa, agujas
   *  y una ciudadela lejanas, crestas con pinos secos y la catedral en ruinas, colinas negras, suelo agrietado con
   *  brasas que laten, camino de losas y zarzas en las esquinas. Sol negro / luna de sangre y ascuas en SVG. */
  function backdrop(tod, narrow = false) {
    const W = 400, H = 180, HZ = 82;
    let P = GRIM[tod] || GRIM.night;
    // v4.45: en el móvil sólo se ve la franja central del fondo (x ≈ 127–273): el sol / la luna se pasan ahí
    if (narrow) P = Object.assign({}, P, NARROW_BODY[tod] || NARROW_BODY.night);
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMax slice', class: 'camp-bg layered grim', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' });
    const defs = svgEl('defs');
    const glow = svgEl('radialGradient', { id: 'campGlow', cx: '50%', cy: '82%', r: '46%' });
    glow.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#ea580c', 'stop-opacity': P.fire }));
    glow.appendChild(svgEl('stop', { offset: 0.45, 'stop-color': '#7f1d1d', 'stop-opacity': P.fire / 3 }));
    glow.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#450a0a', 'stop-opacity': 0 }));
    const moonGlow = svgEl('radialGradient', { id: 'campMoon', cx: '50%', cy: '50%', r: '50%' });
    moonGlow.appendChild(svgEl('stop', { offset: 0, 'stop-color': P.halo, 'stop-opacity': P.haloOp }));
    moonGlow.appendChild(svgEl('stop', { offset: 1, 'stop-color': P.halo, 'stop-opacity': 0 }));
    const fogG = svgEl('radialGradient', { id: 'campFog', cx: '50%', cy: '50%', r: '50%' });
    fogG.appendChild(svgEl('stop', { offset: 0, 'stop-color': P.hell, 'stop-opacity': 0.28 }));
    fogG.appendChild(svgEl('stop', { offset: 1, 'stop-color': P.hell, 'stop-opacity': 0 }));
    const vig = svgEl('radialGradient', { id: 'campVig', cx: '50%', cy: '55%', r: '75%' });
    vig.appendChild(svgEl('stop', { offset: 0.55, 'stop-color': '#000', 'stop-opacity': 0 }));
    vig.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.7 }));
    defs.append(glow, moonGlow, fogG, vig); s.appendChild(defs);
    const L = Object.fromEntries(campLayers(tod).map((x) => [x.id, x]));
    const img = (id, cls = '', x = 0) => svgEl('image', { href: L[id].url, x, y: 0, width: W, height: H, preserveAspectRatio: 'none', class: 'cbl cbl-' + id + (cls ? ' ' + cls : ''), style: L[id].smooth ? 'image-rendering:auto' : 'image-rendering:pixelated' });
    s.appendChild(img('sky'));
    const rnd = DK.util.seeded('camp-grim');
    for (let i = 0; i < P.stars; i++) s.appendChild(svgEl('rect', { x: Math.floor(rnd() * W), y: Math.floor(rnd() * (HZ - 34)), width: 1, height: 1, fill: '#fca5a5', opacity: 0.12 + rnd() * 0.28, class: rnd() < 0.3 ? 'twinkle' : '' }));
    s.appendChild(svgEl('circle', { cx: P.bx + 14, cy: P.by + 14, r: P.body === 'moon' ? 36 : 40, fill: 'url(#campMoon)', 'shape-rendering': 'auto', class: 'camp-body ' + (P.body === 'moon' ? 'moon' : 'sun ' + P.body) }));
    const [c0, c1, c2] = P.disc;
    // luna de sangre con manchas · sol negro con su corona · sol rojo y apagado
    const disc = P.body === 'moon'
      ? canvas(29, 29).circle(14, 14, 14, c2).circle(14, 14, 13, c0).circle(13, 13, 11, c1).circle(9, 9, 3, c0).circle(18, 17, 3, c0).circle(16, 7, 1, c2).circle(8, 18, 2, c2)
      : P.body === 'blacksun'
        ? canvas(29, 29).circle(14, 14, 14, c2).circle(14, 14, 13, c1).circle(14, 14, 11, c0)
        : canvas(29, 29).circle(14, 14, 13, c2).circle(14, 14, 12, c0).circle(13, 13, 9, c1);
    const ds = pixSvg(disc, 1); ds.setAttribute('x', P.bx); ds.setAttribute('y', P.by); s.appendChild(ds);
    // humo que pasa (dos copias seguidas para que el bucle no se note)
    const cg = svgEl('g', { class: 'cbl-drift slow' }); cg.append(img('clouds'), img('clouds', '', W)); s.appendChild(cg);
    s.appendChild(img('far'));
    // bruma rojiza difusa entre las capas (manchas suaves que se mueven; sin bordes rectos)
    const mg = svgEl('g', { class: 'cbl-drift mist', 'shape-rendering': 'auto' });
    [0, W].forEach((ox) => [[70, 10, 90], [220, 14, 110], [340, 8, 80]].forEach(([x, y, w]) => mg.appendChild(svgEl('ellipse', { cx: ox + x, cy: HZ - 14 + y, rx: w, ry: 9, fill: 'url(#campFog)' }))));
    s.appendChild(mg);
    s.appendChild(img('mid'));
    [[98, HZ - 30], [106, HZ - 22], [119, HZ - 12], [120, HZ - 26], [140, HZ - 8]].forEach(([x, y]) => s.appendChild(svgEl('rect', { x, y, width: 2, height: 3, fill: '#dc2626', opacity: 0.7, class: 'twinkle' })));
    s.appendChild(img('hills'));
    [[6, 2], [24, 2], [46, 2], [160, 2], [176, 2], [356, 2], [380, 2]].forEach(([x, sh], i) => { const p = pixSvg(SPRITES.deadTree(sh), 1); p.setAttribute('x', x); p.setAttribute('y', HZ - 18 + (i % 2) * 2); s.appendChild(p); });
    s.appendChild(img('ground'));
    s.appendChild(img('cracks', 'cbl-pulse'));
    [[38, HZ + 6, 0], [52, HZ + 12, 1], [70, HZ + 4, 2], [348, HZ + 8, 1], [366, HZ + 14, 0], [226, HZ + 3, 2]].forEach(([x, y, k]) => { const p = pixSvg(SPRITES.grave(k), 1); p.setAttribute('x', x); p.setAttribute('y', y); s.appendChild(p); });
    // bruma baja a ras de suelo
    const lg2 = svgEl('g', { class: 'cbl-drift mist2', 'shape-rendering': 'auto' });
    [0, W].forEach((ox) => [[80, 120], [290, 140]].forEach(([x, w]) => lg2.appendChild(svgEl('ellipse', { cx: ox + x, cy: HZ + 3, rx: w, ry: 7, fill: 'url(#campFog)', opacity: 0.8 }))));
    s.appendChild(lg2);
    // ascuas que suben del horizonte
    const em = svgEl('g', { class: 'cbl-embers' });
    for (let i = 0; i < 14; i++) em.appendChild(svgEl('rect', { x: Math.floor(rnd() * W), y: HZ - 4 - Math.floor(rnd() * 10), width: 1, height: 1, fill: i % 3 ? '#f97316' : '#fdba74', style: `--d:${(rnd() * 6).toFixed(2)}s;--t:${(5 + rnd() * 5).toFixed(2)}s` }));
    s.appendChild(em);
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campGlow)' }));
    s.appendChild(img('fg'));
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campVig)', 'shape-rendering': 'auto' }));
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
      onClick: (ev) => { DK.audio.sfx('select'); const spr = ev.currentTarget.querySelector('.sprite'); DK.life.react(spr, 'hop'); setTimeout(() => DK.views.quickStats(d, { onChange: o.onChange || (() => DK.router.refresh()) }), 260); }, // v5.4: saltito antes de abrir su ficha
    }, (() => {
      const sp = DK.views.sprite(d.species, { look: DK.looks.of(d), size, shiny: d.shiny, flip: dx > 0, cls: 'alive' });
      sp.style.setProperty('--warm-x', dx > 0 ? '-7px' : '7px'); // v5.5: al calentarse se acerca al fuego
      // v5.4: de noche, algunos duermen junto al fuego (siempre los mismos esa noche)
      if (tod === 'night' && DK.life && (i + new Date().getDate()) % 2 === 0) DK.life.sleep(sp);
      return sp;
    })()); });
    // Ascuas que suben de la hoguera, niebla baja y antorchas
    const embers = h('div', { class: 'camp-embers', 'aria-hidden': 'true', style: { left: fx + '%', top: fy + '%' } }, Array.from({ length: 16 }, (_, i) => h('i', { style: { '--dx': ((i * 37) % 60 - 30) + 'px', left: ((i * 13) % 40 - 20) + 'px', animationDelay: (i * 0.35) + 's', animationDuration: (2.6 + (i % 5) * 0.5) + 's' } })));
    const fog = h('div', { class: 'camp-fog', 'aria-hidden': 'true' }, h('i'), h('i'));
    // v4.78: la luz de la hoguera parpadea en el suelo y motas de polvo flotan despacio
    const firelight = h('div', { class: 'camp-firelight', 'aria-hidden': 'true', style: { left: fx + '%', top: fy + '%' } });
    const motes = h('div', { class: 'camp-motes', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { left: ((i * 53) % 96 + 2) + '%', top: (40 + (i * 29) % 55) + '%', animationDelay: (i * 1.3).toFixed(1) + 's', animationDuration: (9 + (i % 5) * 2.5) + 's' } })));
    const torches = (narrow ? [[5, 58], [96, 62]] : mid ? [[29, 56], [79, 52], [3, 78], [97, 78]] : [[31, 62], [74, 62], [3, 78], [97, 78]]).map(([x, y], i) =>
      h('span', { class: 'camp-torch', 'aria-hidden': 'true', style: { left: x + '%', top: y + '%' } }, animArt('torch', scale * 0.8, i * 0.13) || pixSvg(SPRITES.torch(0), scale * 0.8)));
    // v5.4: de noche, luciérnagas; y el clima del campamento (cambia cada pocas horas)
    const flies = tod === 'night' || tod === 'dusk' ? h('div', { class: 'camp-fireflies', 'aria-hidden': 'true' }, Array.from({ length: narrow ? 8 : 14 }, (_, i) => h('i', { style: { left: ((i * 41) % 92 + 4) + '%', top: (48 + (i * 23) % 44) + '%', animationDelay: (-i * 1.7).toFixed(1) + 's', animationDuration: (7 + (i % 4) * 2) + 's' } }))) : null;
    const wx = DK.weather ? DK.weather.layer(DK.weather.forCamp()) : null;
    return h('section', { class: 'camp-scene grim tod-' + tod, 'aria-label': t('scene.title') },
      backdrop(tod, narrow), firelight, fog, motes, flies, wx, ...torches, embers,
      h('div', { class: 'camp-greet' }, h('span', { class: 'camp-greet-text' }, t('scene.greet.' + tod))),
      ...team, ...spots);
  };
  DK.views.campTimeOfDay = timeOfDay;
  DK.views.campBackdrop = backdrop;
  DK.pix.sprites = SPRITES;
})();
