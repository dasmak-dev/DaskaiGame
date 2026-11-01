/* =============================================================
 * components/camp.js — El campamento (pantalla principal).
 *
 * Una escena en pixel art con lugares que se pueden pulsar:
 *   hoguera → Equipo · tienda → Inventario · yunque → Crafteo
 *   muñeco → Entrenamiento · atril → Códice · tablón → Progreso (misiones)
 *   camino con el cartel → Batalla (expediciones)
 * El cielo cambia con la hora real (día, atardecer, noche) y tu equipo
 * descansa junto a la hoguera.
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
      c.rect(13, 0, 1, 4, WOOD_D).rect(14, 0, 4, 2, '#facc15').rect(14, 2, 2, 1, '#eab308');
      c.tri(13, 3, 19, 12, (x, y, hw, dx) => (Math.abs(dx) === hw ? OUT : Math.floor((x + 1) / 3) % 2 ? '#dc2626' : '#fde9c4'));
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
   * xs, ys: posición en pantallas estrechas (móvil). */
  const SPOTS = [
    { id: 'path', sprite: 'sign', screen: 'zones', nav: 'battle', x: 66, y: 55, xs: 73, ys: 45, label: () => t('scene.path'), main: true },
    { id: 'board', sprite: 'board', screen: 'progress', nav: 'progress', x: 37, y: 57, xs: 31, ys: 43, label: () => t('scene.board') },
    { id: 'tent', sprite: 'tent', screen: 'inventory', nav: 'inventory', x: 17, y: 70, xs: 17, ys: 66, label: () => t('scene.tent') },
    { id: 'anvil', sprite: 'anvil', screen: 'craft', nav: 'craft', x: 82, y: 72, xs: 83, ys: 65, label: () => t('scene.anvil') },
    { id: 'fire', sprite: 'fire', screen: 'team', nav: 'team', x: 50, y: 82, xs: 50, ys: 84, label: () => t('scene.fire'), fire: true },
    { id: 'lectern', sprite: 'lectern', screen: 'codex', nav: 'codex', x: 9, y: 88, xs: 14, ys: 91, label: () => t('scene.lectern') },
    { id: 'dummy', sprite: 'dummy', screen: 'training', nav: 'training', x: 91, y: 88, xs: 85, ys: 93, label: () => t('scene.dummy'), unlock: 'training' },
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

  /** Fondo: cielo, astro, nubes, montañas, bosque, suelo y el camino hacia el cartel. */
  function backdrop(tod) {
    const W = 400, H = 180, HZ = 80, sky = SKY[tod];   // HZ: línea del horizonte
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMax slice', class: 'camp-bg', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' });
    const defs = svgEl('defs');
    const lg = svgEl('linearGradient', { id: 'campSky', x1: 0, y1: 0, x2: 0, y2: 1 });
    sky.forEach((c, i) => lg.appendChild(svgEl('stop', { offset: i / 2, 'stop-color': c })));
    const glow = svgEl('radialGradient', { id: 'campGlow', cx: '50%', cy: '80%', r: '42%' });
    glow.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#fb923c', 'stop-opacity': tod === 'day' ? 0.12 : 0.5 }));
    glow.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#fb923c', 'stop-opacity': 0 }));
    defs.append(lg, glow); s.appendChild(defs);
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campSky)' }));
    const rnd = DK.util.seeded('camp-' + tod);
    // Estrellas
    if (tod === 'night' || tod === 'dusk') {
      for (let i = 0; i < 60; i++) s.appendChild(svgEl('rect', { x: Math.floor(rnd() * W), y: Math.floor(rnd() * (HZ - 20)), width: rnd() < 0.2 ? 2 : 1, height: 1, fill: '#fff', opacity: tod === 'dusk' ? 0.45 : 0.9, class: rnd() < 0.35 ? 'twinkle' : '' }));
    }
    // Sol o luna (círculo en escalones)
    const astro = tod === 'night' ? { x: 300, y: 26, r: 9, c: '#f8fafc' } : tod === 'day' ? { x: 110, y: 24, r: 10, c: '#fde047' } : { x: 290, y: 58, r: 12, c: '#fdba74' };
    const disc = canvas(astro.r * 2 + 1, astro.r * 2 + 1).circle(astro.r, astro.r, astro.r, astro.c);
    if (tod === 'night') disc.circle(astro.r + 4, astro.r - 2, astro.r - 1, null);
    const ds = pixSvg(disc, 1); ds.setAttribute('x', astro.x - astro.r); ds.setAttribute('y', astro.y - astro.r); s.appendChild(ds);
    if (tod === 'day' || tod === 'dawn') s.appendChild(svgEl('circle', { cx: astro.x, cy: astro.y, r: astro.r + 6, fill: astro.c, opacity: 0.18, 'shape-rendering': 'auto' }));
    // Nubes de píxeles (de día y al amanecer), se mueven despacio
    if (tod === 'day' || tod === 'dawn') {
      [[40, 18, 1], [190, 12, 0.8], [330, 30, 1.1]].forEach(([x, y, k], n) => {
        const g = svgEl('g', { class: 'camp-cloud', style: `animation-delay:${-n * 14}s` });
        const c = '#ffffff', o = tod === 'dawn' ? 0.55 : 0.9;
        [[0, 4, 26, 5], [5, 1, 12, 4], [14, 0, 9, 4], [3, 8, 20, 2]].forEach(([cx, cy, cw, ch]) => g.appendChild(svgEl('rect', { x: x + cx * k, y: y + cy, width: cw * k, height: ch, fill: c, opacity: o })));
        s.appendChild(g);
      });
    }
    // Montañas lejanas y colinas
    const mtn = { day: ['#94a3b8', '#64748b', '#475569'], dawn: ['#7c3aed', '#6b21a8', '#4c1d95'], dusk: ['#5b21b6', '#4c1d95', '#2e1065'], night: ['#334155', '#1e293b', '#0f172a'] }[tod];
    s.appendChild(svgEl('polygon', { points: ridge(W, HZ, [[40, 34, 0.7], [150, 40, 0.75], [250, 30, 0.6], [350, 42, 0.8]]), fill: mtn[0] }));
    // Nieve en las cumbres
    if (tod !== 'night') [[40, 34], [150, 40], [350, 42]].forEach(([px, ph]) => { const y = Math.round((HZ - ph) / 2) * 2; s.appendChild(svgEl('rect', { x: px - 4, y, width: 8, height: 2, fill: '#f8fafc', opacity: 0.85 })); s.appendChild(svgEl('rect', { x: px - 8, y: y + 2, width: 4, height: 2, fill: '#f8fafc', opacity: 0.6 })); });
    s.appendChild(svgEl('polygon', { points: ridge(W, HZ, [[0, 18, 0.35], [95, 22, 0.4], [205, 16, 0.35], [300, 24, 0.45], [400, 18, 0.4]]), fill: mtn[1] }));
    // Suelo
    const grass = { day: ['#4ade80', '#22c55e', '#16a34a'], dawn: ['#65a30d', '#4d7c0f', '#3f6212'], dusk: ['#3f6212', '#365314', '#1a2e05'], night: ['#14532d', '#0f3d22', '#052e16'] }[tod];
    s.appendChild(svgEl('rect', { x: 0, y: HZ, width: W, height: 10, fill: grass[0] }));
    s.appendChild(svgEl('rect', { x: 0, y: HZ + 10, width: W, height: 40, fill: grass[1] }));
    s.appendChild(svgEl('rect', { x: 0, y: HZ + 50, width: W, height: H - HZ - 50, fill: grass[2] }));
    // Bosque en el horizonte
    [[4, 2], [18, 1], [33, 2], [62, 0], [104, 1], [118, 2], [168, 0], [286, 1], [302, 2], [330, 0], [350, 1], [366, 2], [382, 1]].forEach(([x, sh]) => {
      const p = pixSvg(SPRITES.pine(sh), 1); p.setAttribute('x', x); p.setAttribute('y', HZ - 20 + (sh === 1 ? 2 : sh === 0 ? -2 : 0)); s.appendChild(p);
    });
    // Camino de tierra: de la hoguera (abajo) al cartel (horizonte), cada vez más estrecho
    const dirt = tod === 'night' ? '#4a3220' : tod === 'dusk' ? '#6b4423' : '#a16207';
    const dirtL = tod === 'night' ? '#5c3d26' : tod === 'dusk' ? '#7c4f2a' : '#ca8a04';
    for (let y = HZ + 2; y < H; y += 2) {
      const tt = (y - HZ) / (H - HZ);               // 0 en el horizonte, 1 abajo
      const cx = 264 - tt * 64 + Math.round(Math.sin(tt * 5) * 6);
      const hw = Math.round(3 + tt * 22);
      s.appendChild(svgEl('rect', { x: cx - hw, y, width: hw * 2, height: 2, fill: dirt }));
      if (y % 6 === 0) s.appendChild(svgEl('rect', { x: cx - hw + 2 + Math.floor(rnd() * Math.max(1, hw * 2 - 6)), y, width: 2, height: 1, fill: dirtL }));
    }
    // Matas de hierba y flores
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rnd() * W), y = HZ + 6 + Math.floor(rnd() * (H - HZ - 8));
      s.appendChild(svgEl('rect', { x, y, width: 1, height: 2, fill: grass[0], opacity: 0.8 })); s.appendChild(svgEl('rect', { x: x + 2, y: y + 1, width: 1, height: 1, fill: grass[0], opacity: 0.8 }));
      if (i % 9 === 0 && tod !== 'night') s.appendChild(svgEl('rect', { x: x + 1, y: y - 1, width: 1, height: 1, fill: ['#fde047', '#f472b6', '#f8fafc'][i % 3] }));
    }
    s.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#campGlow)' }));
    return s;
  }

  /**
   * Escena del campamento.
   * @param {Object} o  team: daskai junto a la hoguera · onSpot(spot) al pulsar un lugar
   * @returns {HTMLElement}
   */
  DK.views.campScene = (o = {}) => {
    const tod = timeOfDay();
    const narrow = window.innerWidth <= 600;
    const scale = narrow ? 2.8 : 5;
    const nav = Object.fromEntries(DK.menus.items('nav').map((it) => [it.id, it]));
    const spots = SPOTS.map((sp) => {
      const locked = sp.unlock && !DK.unlocks.has(sp.unlock);
      const it = nav[sp.nav];
      const badge = !locked && it && it.badge ? it.badge() : '';
      const art = sp.fire ? h('span', { class: 'camp-fire' }, pixSvg(SPRITES.fire(0), scale, 'f0'), pixSvg(SPRITES.fire(1), scale, 'f1')) : pixSvg(SPRITES[sp.sprite](), scale);
      const label = typeof sp.label === 'function' ? sp.label() : sp.label;
      return h('button', {
        class: `camp-spot s-${sp.id}` + (locked ? ' locked' : '') + (sp.main ? ' main' : ''), type: 'button',
        style: { left: (narrow ? sp.xs : sp.x) + '%', top: (narrow ? sp.ys : sp.y) + '%' },
        'aria-label': locked ? `${label} · ${t('scene.locked')}` : label,
        tip: locked ? t('unlock.trainingLocked') : label,
        onClick: () => { if (locked) { DK.audio.sfx('error'); DK.ui.toast(t('unlock.trainingLocked'), { icon: 'lock' }); return; } DK.audio.sfx('select'); if (o.onSpot) o.onSpot(sp); else DK.router.reset(sp.screen); },
      }, h('span', { class: 'camp-art' }, art, locked ? h('span', { class: 'camp-lock' }, DK.icon('lock', 16)) : null, badge ? h('span', { class: 'nav-dot' }, badge) : null),
      h('span', { class: 'camp-plaque' }, label));
    });
    // Tu equipo descansando junto a la hoguera
    const fire = SPOTS.find((sp) => sp.fire);
    const fx = narrow ? fire.xs : fire.x, fy = narrow ? fire.ys : fire.y;
    const offs = narrow ? [[-19, 1], [19, 1], [-10, -12], [10, -12], [0, -16]] : [[-12, -3], [12, -3], [-21, 5], [21, 5], [0, -14]];
    const team = (o.team || []).slice(0, 5).map((d, i) => h('button', {
      class: 'camp-mon', type: 'button', style: { left: fx + offs[i][0] + '%', top: fy + offs[i][1] + '%', animationDelay: (i * 0.4) + 's' },
      'aria-label': DK.daskai.name(d), tip: `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`,
      onClick: () => { DK.audio.sfx('select'); DK.router.reset('team', { uid: d.uid }); },
    }, DK.views.sprite(d.species, { size: narrow ? 54 : 76, shiny: d.shiny, flip: offs[i][0] > 0 })));
    const flies = tod === 'night' || tod === 'dusk' ? h('div', { class: 'camp-flies', 'aria-hidden': 'true' }, Array.from({ length: 10 }, (_, i) => h('i', { style: { left: (8 + i * 9) % 96 + '%', top: 50 + ((i * 37) % 40) + '%', animationDelay: (i * 0.7) + 's' } }))) : null;
    return h('section', { class: 'camp-scene tod-' + tod, 'aria-label': t('scene.title') },
      backdrop(tod), flies,
      h('div', { class: 'camp-greet' }, h('span', { class: 'camp-greet-text' }, t('scene.greet.' + tod))),
      ...team, ...spots);
  };
  DK.views.campTimeOfDay = timeOfDay;
  DK.pix.sprites = SPRITES;
})();
