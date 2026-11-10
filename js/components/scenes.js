/* =============================================================
 * components/scenes.js — Fondos animados de cada zona.
 *
 *   DK.scenes.render('volcano', ['#fdba74', '#7f1d1d'])  → nodo con capas
 *
 * Cada escena tiene:
 *   far:   función que devuelve el SVG del fondo lejano (siluetas)
 *   near:  SVG del primer plano (opcional)
 *   particles: {type, n}  partículas animadas por CSS
 *     'firefly' | 'ember' | 'bubble' | 'sparkle' | 'leaf' | 'cloud' | 'dust' | 'snow'
 * Para crear una escena nueva añade una entrada a SCENES y úsala en
 * data/zones.js con `scene: 'nombre'`.
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const W = 1000, H = 400;

  /** Cordillera de colinas suaves (para el fondo). */
  function hills(y, amp, color, seed, n = 6) {
    let d = `M0 ${H} L0 ${y}`;
    for (let i = 0; i <= n; i++) {
      const x = (W / n) * i, yy = y - Math.abs(Math.sin(seed + i * 1.7)) * amp;
      d += ` Q ${x - W / n / 2} ${yy - amp * 0.4} ${x} ${yy}`;
    }
    return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
  }
  /** Picos afilados (montañas, volcán, cuevas). */
  function peaks(y, amp, color, seed, n = 8, invert = false) {
    let d = invert ? `M0 0 L0 ${y}` : `M0 ${H} L0 ${y}`;
    for (let i = 0; i <= n; i++) {
      const x = (W / n) * i, a = amp * (0.5 + Math.abs(Math.sin(seed * 3 + i * 2.3)) * 0.5);
      d += ` L${x - W / n / 2} ${invert ? y + a : y - a} L${x} ${y}`;
    }
    return `<path d="${d} L${W} ${invert ? 0 : H} Z" fill="${color}"/>`;
  }
  /** Árboles de copa redonda. */
  function trees(y, color, n, seed, size = 40) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + Math.sin(seed + i) * 30, r = size * (0.7 + Math.abs(Math.sin(seed * 2 + i)) * 0.6);
      s += `<rect x="${x - 4}" y="${y - r * 0.3}" width="8" height="${r}" fill="${color}"/><circle cx="${x}" cy="${y - r * 0.6}" r="${r * 0.7}" fill="${color}"/>`;
    }
    return s;
  }
  /** Columnas de templo. */
  function pillars(y, color, n) {
    let s = '';
    for (let i = 0; i < n; i++) { const x = ((i + 0.5) / n) * W; s += `<rect x="${x - 18}" y="${y - 170}" width="36" height="170" fill="${color}"/><rect x="${x - 26}" y="${y - 182}" width="52" height="14" fill="${color}"/>`; }
    return s;
  }
  const svg = (inner, cls) => `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`;

  /* ---------- Siluetas extra (estilo oscuro) ---------- */
  /** Árboles muertos: tronco y ramas desnudas. */
  function deadTrees(y, color, n, seed, size = 90) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + Math.sin(seed + i * 1.3) * 40, hh = size * (0.7 + Math.abs(Math.sin(seed * 2 + i)) * 0.6);
      s += `<path d="M${x - 5} ${y} L${x - 3} ${y - hh} L${x + 3} ${y - hh} L${x + 5} ${y} Z" fill="${color}"/>`;
      [[-1, 0.55, 0.35], [1, 0.7, 0.3], [-1, 0.85, 0.25], [1, 0.95, 0.2]].forEach(([d, at, len]) => {
        const yy = y - hh * at, ex = x + d * hh * len, ey = yy - hh * len * 0.6;
        s += `<path d="M${x} ${yy} Q${(x + ex) / 2} ${yy - 4} ${ex} ${ey}" stroke="${color}" stroke-width="${Math.max(2, 6 - at * 4)}" fill="none" stroke-linecap="round"/>`;
      });
    }
    return s;
  }
  /** Lápidas y cruces. */
  function graves(y, color, n, seed) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.3) / n) * W + Math.sin(seed + i * 2.1) * 60, k = Math.abs(Math.sin(seed + i)) ;
      s += k > 0.5 ? `<rect x="${x - 3}" y="${y - 34}" width="6" height="34" fill="${color}"/><rect x="${x - 12}" y="${y - 26}" width="24" height="6" fill="${color}"/>`
        : `<path d="M${x - 12} ${y} L${x - 12} ${y - 22} Q${x} ${y - 36} ${x + 12} ${y - 22} L${x + 12} ${y} Z" fill="${color}"/>`;
    }
    return s;
  }
  /** Luna grande con halo. */
  const moon = (x, y, r, c, halo = 0.25) => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${c}" opacity="${halo * 0.5}"/><circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="${c}" opacity="${halo}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".85"/>`;
  /** Ruinas: muros rotos y torres con agujas. */
  function ruins(y, color, seed) {
    let s = '';
    [[0.12, 120, 50], [0.2, 170, 36], [0.27, 90, 60], [0.72, 140, 44], [0.8, 200, 34], [0.88, 110, 56]].forEach(([fx, hh, w], i) => {
      const x = fx * W + Math.sin(seed + i) * 20;
      s += `<rect x="${x}" y="${y - hh}" width="${w}" height="${hh}" fill="${color}"/>`;
      if (i % 2) s += `<path d="M${x - 4} ${y - hh} L${x + w / 2} ${y - hh - w * 1.3} L${x + w + 4} ${y - hh} Z" fill="${color}"/>`;
      else s += `<path d="M${x} ${y - hh} l8 -14 l8 14 l8 -10 l8 10 l8 -16 l${w - 40} 16 Z" fill="${color}"/>`;
    });
    return s;
  }
  /** Rayos (tormenta). */
  const bolt = (x, y, c) => `<path d="M${x} ${y} l-22 70 l18 0 l-26 80 l60 -100 l-20 0 l24 -50 Z" fill="${c}" opacity=".55" class="scene-bolt"/>`;
  /** Tentáculos que salen del suelo. */
  function tentacles(y, color, n, seed) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + Math.sin(seed + i) * 40, hh = 120 + Math.abs(Math.sin(seed * 3 + i)) * 120, d = i % 2 ? 1 : -1;
      s += `<path d="M${x - 16} ${y} C${x - 20} ${y - hh * 0.4} ${x + d * 60} ${y - hh * 0.6} ${x + d * 20} ${y - hh} C${x + d * 70} ${y - hh * 0.55} ${x + 24} ${y - hh * 0.35} ${x + 18} ${y} Z" fill="${color}"/>`;
    }
    return s;
  }
  /** Cristales afilados. */
  function crystals(y, color, n, seed) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + Math.sin(seed + i * 1.7) * 30, hh = 60 + Math.abs(Math.sin(seed + i * 2.2)) * 150, w = 16 + (i % 3) * 8;
      s += `<path d="M${x - w} ${y} L${x - w * 0.4} ${y - hh * 0.8} L${x} ${y - hh} L${x + w * 0.5} ${y - hh * 0.75} L${x + w} ${y} Z" fill="${color}"/>`;
    }
    return s;
  }

  /** v5.0: cañas y juncos del pantano. */
  function reeds(y, color, n, seed) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + Math.sin(seed + i * 1.9) * 18, hh = 30 + Math.abs(Math.sin(seed + i * 2.7)) * 60, d = Math.sin(seed + i) * 10;
      s += `<path d="M${x} ${y} Q${x + d * 0.4} ${y - hh * 0.6} ${x + d} ${y - hh}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      if (i % 3 === 0) s += `<ellipse cx="${x + d}" cy="${y - hh - 6}" rx="3.5" ry="9" fill="${color}"/>`;
    }
    return s;
  }
  /** v5.0: aurora (dos cortinas de luz). */
  const aurora = (c1, c2) => `<path d="M0 110 C200 40 380 160 560 80 S880 30 ${W} 90 L${W} 170 C820 120 640 220 470 150 S160 160 0 200 Z" fill="${c1}"/><path d="M0 60 C240 120 420 20 640 70 S900 120 ${W} 50 L${W} 100 C840 150 620 80 420 110 S140 120 0 120 Z" fill="${c2}"/>`;

  const SCENES = {
    meadow: { far: (c) => hills(250, 60, 'rgba(255,255,255,.35)', 1) + hills(300, 40, 'rgba(22,101,52,.25)', 2), particles: { type: 'firefly', n: 10 } },
    forest: { far: () => trees(300, 'rgba(5,46,22,.35)', 9, 1, 55) + trees(330, 'rgba(5,46,22,.5)', 7, 3, 45), particles: { type: 'leaf', n: 10 } },
    beach: { far: () => hills(270, 25, 'rgba(255,255,255,.3)', 4, 10) + `<rect x="0" y="300" width="${W}" height="100" fill="rgba(253,230,138,.35)"/>`, particles: { type: 'bubble', n: 12 } },
    cave: { far: () => peaks(70, 70, 'rgba(15,10,40,.55)', 2, 12, true) + peaks(320, 60, 'rgba(15,10,40,.4)', 5, 10), particles: { type: 'sparkle', n: 14 } },
    volcano: { far: () => peaks(260, 150, 'rgba(60,10,10,.45)', 1, 3) + `<circle cx="500" cy="95" r="26" fill="rgba(253,186,116,.45)"/>`, particles: { type: 'ember', n: 18 } },
    temple: { far: () => pillars(320, 'rgba(120,80,10,.25)', 6), particles: { type: 'dust', n: 14 } },
    abyss: { far: () => peaks(330, 80, 'rgba(2,6,23,.6)', 7, 9), particles: { type: 'bubble', n: 14 } },
    sky: { far: () => hills(330, 30, 'rgba(255,255,255,.5)', 3, 5), particles: { type: 'cloud', n: 6 } },
    // v5.0: Pantano Brumoso (cañas, árboles hundidos y charcas) y Glaciar Eterno (icebergs y aurora)
    swamp: { far: () => trees(310, 'rgba(20,40,10,.4)', 6, 4, 50) + hills(330, 14, 'rgba(101,163,13,.22)', 6, 9) + reeds(360, 'rgba(26,46,5,.55)', 22, 3) + `<ellipse cx="300" cy="372" rx="120" ry="10" fill="rgba(190,242,100,.12)"/><ellipse cx="760" cy="384" rx="150" ry="12" fill="rgba(190,242,100,.1)"/>`, particles: { type: 'firefly', n: 14 } },
    glacier: { far: () => aurora('rgba(94,234,212,.22)', 'rgba(167,139,250,.16)') + peaks(250, 130, 'rgba(224,242,254,.32)', 7, 5) + crystals(360, 'rgba(186,230,253,.35)', 8, 4), particles: { type: 'sparkle', n: 12 } },

    /* ---- Fondos de JEFE (uno por zona): DK.scenes.bossScene(zona) ---- */
    // Pradera: círculo de menhires bajo una luna roja
    boss_meadow: { far: () => moon(780, 90, 46, '#ef4444') + hills(300, 50, 'rgba(10,5,5,.6)', 2) + [200, 330, 460, 590, 720].map((x, i) => `<rect x="${x}" y="${190 - (i % 2) * 30}" width="44" height="${150 + (i % 2) * 30}" rx="8" fill="rgba(12,8,10,.85)"/>`).join(''), particles: { type: 'ember', n: 14 } },
    // Bosque: árboles muertos retorcidos y niebla verde
    boss_forest: { far: () => moon(500, 110, 60, '#a3e635', 0.18) + deadTrees(340, 'rgba(6,10,6,.85)', 7, 2, 210) + deadTrees(380, 'rgba(3,6,3,.95)', 5, 5, 150), particles: { type: 'firefly', n: 12 } },
    // Costa: barco naufragado y tormenta
    boss_beach: { far: () => bolt(240, 20, '#e0f2fe') + `<path d="M520 300 L560 140 L572 140 L566 300 Z M450 300 Q600 360 760 280 L740 330 L470 340 Z M566 160 L680 230 L566 230 Z" fill="rgba(6,10,20,.85)"/>` + hills(330, 20, 'rgba(2,6,23,.8)', 4, 10), particles: { type: 'bubble', n: 14 } },
    // Cavernas: bosque de cristales
    boss_cave: { far: () => peaks(70, 80, 'rgba(10,4,30,.75)', 2, 12, true) + crystals(380, 'rgba(167,139,250,.35)', 9, 3) + crystals(400, 'rgba(30,10,60,.85)', 7, 6), particles: { type: 'sparkle', n: 18 } },
    // Volcán: forja con ríos de lava
    boss_volcano: { far: () => peaks(260, 170, 'rgba(40,6,6,.8)', 1, 3) + `<path d="M470 120 Q480 260 430 400 L470 400 Q520 260 500 120 Z" fill="rgba(251,146,60,.55)"/><path d="M640 160 Q650 280 610 400 L640 400 Q680 280 664 160 Z" fill="rgba(239,68,68,.45)"/>` + ruins(400, 'rgba(10,3,3,.9)', 4), particles: { type: 'ember', n: 26 } },
    // Templo: santuario en ruinas con estatua
    boss_temple: { far: () => pillars(340, 'rgba(40,25,5,.6)', 6) + `<path d="M440 340 L450 160 Q500 100 550 160 L560 340 Z" fill="rgba(20,12,4,.85)"/><circle cx="500" cy="130" r="30" fill="rgba(20,12,4,.9)"/><circle cx="490" cy="126" r="4" fill="#facc15"/><circle cx="510" cy="126" r="4" fill="#facc15"/>`, particles: { type: 'dust', n: 18 } },
    // Abismo: fauces y tentáculos
    boss_abyss: { far: () => tentacles(420, 'rgba(10,6,30,.85)', 7, 2) + peaks(60, 60, 'rgba(2,2,10,.9)', 3, 14, true) + `<circle cx="500" cy="150" r="40" fill="rgba(99,102,241,.2)"/><circle cx="500" cy="150" r="14" fill="rgba(165,180,252,.7)"/>`, particles: { type: 'bubble', n: 18 } },
    // Pantano: árbol gigante muerto con ojos en la niebla
    boss_swamp: { far: () => moon(780, 100, 40, '#bef264', 0.15) + deadTrees(360, 'rgba(10,20,4,.9)', 4, 6, 260) + reeds(390, 'rgba(6,12,2,.95)', 26, 8) + [[300, 230], [340, 228], [640, 250], [676, 248]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="rgba(217,249,157,.75)"/>`).join(''), particles: { type: 'firefly', n: 18 } },
    // Glaciar: muralla de hielo con aurora y un trono helado
    boss_glacier: { far: () => aurora('rgba(94,234,212,.35)', 'rgba(244,114,182,.22)') + crystals(380, 'rgba(14,30,50,.85)', 10, 9) + `<path d="M430 360 L450 200 L500 150 L550 200 L570 360 Z" fill="rgba(186,230,253,.25)"/><circle cx="500" cy="210" r="12" fill="rgba(224,242,254,.7)"/>`, particles: { type: 'sparkle', n: 18 } },
    // Cumbre: ruinas en las nubes y rayos
    boss_sky: { far: () => bolt(180, 0, '#fef08a') + bolt(820, 30, '#c7d2fe') + ruins(360, 'rgba(15,12,40,.75)', 2) + hills(360, 30, 'rgba(255,255,255,.18)', 3, 5), particles: { type: 'cloud', n: 8 } },
    // Jefe oculto (cuevas): cripta con tumbas
    boss_secret: { far: () => moon(500, 80, 40, '#c084fc', 0.2) + ruins(340, 'rgba(20,8,30,.85)', 6) + graves(380, 'rgba(10,4,16,.95)', 9, 3), particles: { type: 'sparkle', n: 16 } },
  };
  // Zonas: un poco más sombrías (árboles muertos, ruinas y tumbas al fondo)
  const darker = {
    meadow: (c) => graves(330, 'rgba(10,20,10,.35)', 6, 2) + deadTrees(320, 'rgba(10,20,10,.25)', 3, 4, 120),
    forest: () => deadTrees(320, 'rgba(3,15,8,.45)', 4, 7, 160),
    beach: () => `<path d="M800 320 L812 230 L820 230 L816 320 Z" fill="rgba(2,6,23,.4)"/>`,
    cave: () => crystals(400, 'rgba(15,10,40,.45)', 6, 2),
    volcano: () => ruins(400, 'rgba(30,5,5,.45)', 1),
    temple: () => graves(380, 'rgba(60,40,5,.25)', 5, 9),
    abyss: () => tentacles(420, 'rgba(2,6,23,.45)', 4, 5),
    sky: () => ruins(380, 'rgba(30,30,80,.25)', 8),
    swamp: () => deadTrees(330, 'rgba(10,25,5,.4)', 3, 9, 140),
    glacier: () => crystals(410, 'rgba(8,20,40,.4)', 5, 7),
  };
  Object.entries(darker).forEach(([id, extra]) => { const sc = SCENES[id]; if (!sc) return; const far = sc.far; sc.far = (c) => far(c) + extra(c); });

  /* ---------- v5.7: piezas animadas de cada zona (nubes, olas, humo, cristales, islas…) ----------
   * Elementos SVG con clase scn-*: el movimiento lo pone css/juice.css (transform-box: fill-box). */
  const cloud = (x, y, k, op = 0.35, cls = 'scn-cloud') => `<g class="${cls}" style="--d:${(40 + (x % 7) * 6)}s;--o:${-(x % 23)}s"><g opacity="${op}" fill="#fff"><ellipse cx="${x}" cy="${y}" rx="${46 * k}" ry="${14 * k}"/><ellipse cx="${x - 22 * k}" cy="${y - 8 * k}" rx="${22 * k}" ry="${14 * k}"/><ellipse cx="${x + 14 * k}" cy="${y - 12 * k}" rx="${26 * k}" ry="${17 * k}"/></g></g>`;
  const birds = (x, y, n) => Array.from({ length: n }, (_, i) => `<path class="scn-bird" style="--o:${-i * 0.7}s" d="M${x + i * 26} ${y + (i % 2) * 12} q6 -6 12 0 q6 -6 12 0" stroke="rgba(20,20,30,.55)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('');
  const flowers = (y, n, seed) => Array.from({ length: n }, (_, i) => { const x = ((i + 0.5) / n) * W + Math.sin(seed + i * 3.1) * 25, c = ['#f9a8d4', '#fde047', '#c4b5fd', '#fca5a5', '#fff'][i % 5], yy = y + Math.sin(seed + i) * 8; return `<g class="scn-sway" style="--o:${-(i % 5)}s"><path d="M${x} ${yy + 16} L${x} ${yy}" stroke="rgba(22,101,52,.6)" stroke-width="2"/><circle cx="${x}" cy="${yy}" r="4" fill="${c}" opacity=".8"/></g>`; }).join('');
  const pines = (y, color, n, seed, size) => Array.from({ length: n }, (_, i) => { const x = ((i + 0.5) / n) * W + Math.sin(seed + i * 1.3) * 30, hh = size * (0.8 + Math.abs(Math.sin(seed * 2 + i)) * 0.5); return `<path d="M${x} ${y - hh} L${x + hh * 0.32} ${y - hh * 0.45} L${x + hh * 0.18} ${y - hh * 0.45} L${x + hh * 0.42} ${y} L${x - hh * 0.42} ${y} L${x - hh * 0.18} ${y - hh * 0.45} L${x - hh * 0.32} ${y - hh * 0.45} Z" fill="${color}"/>`; }).join('');
  const smoke = (x, y) => Array.from({ length: 5 }, (_, i) => `<circle class="scn-smoke" style="--o:${-i * 1.1}s" cx="${x}" cy="${y}" r="${18 + i * 3}" fill="rgba(60,40,40,.45)"/>`).join('');
  const islands = (list) => list.map(([x, y, k], i) => `<g class="scn-bob" style="--o:${-i * 1.7}s"><path d="M${x - 60 * k} ${y} Q${x} ${y - 14 * k} ${x + 60 * k} ${y} L${x + 30 * k} ${y + 22 * k} L${x} ${y + 48 * k} L${x - 26 * k} ${y + 24 * k} Z" fill="rgba(80,70,110,.45)"/><path d="M${x - 60 * k} ${y} Q${x} ${y - 14 * k} ${x + 60 * k} ${y}" stroke="rgba(134,239,172,.55)" stroke-width="${5 * k}" fill="none"/></g>`).join('');
  const glowRocks = (list, c) => list.map(([x, y, r], i) => `<circle class="scn-glow" style="--o:${-i * 0.9}s" cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const DECO = {
    meadow: { far: () => cloud(180, 70, 1.2) + cloud(620, 50, 1) + cloud(880, 95, 0.8, 0.25) + birds(380, 60, 3), near: () => flowers(392, 26, 3) },
    forest: { far: () => pines(310, 'rgba(5,46,22,.28)', 12, 2, 120) + cloud(760, 60, 0.8, 0.18), near: () => glowRocks([[140, 380, 3], [260, 372, 2.5], [720, 384, 3], [860, 376, 2.5]], 'rgba(190,242,100,.8)') },
    beach: { far: () => `<circle cx="760" cy="120" r="44" fill="rgba(254,240,138,.45)"/><circle cx="760" cy="120" r="80" fill="rgba(254,240,138,.12)"/>` + `<rect x="0" y="250" width="${W}" height="55" fill="rgba(14,116,144,.22)"/>` + [262, 276, 290].map((y, i) => `<path class="scn-wave" style="--o:${-i}s" d="M-40 ${y} q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>`).join('') + `<g class="scn-bob"><path d="M300 248 L330 248 L326 256 L304 256 Z M314 248 L314 214 L330 244 Z" fill="rgba(30,30,40,.4)"/></g>` + cloud(240, 70, 1) + birds(560, 80, 3) },
    cave: { far: () => Array.from({ length: 14 }, (_, i) => { const x = 30 + i * 72 + (i % 3) * 10, hh = 40 + (i * 37) % 70; return `<path d="M${x - 12} 0 L${x} ${hh} L${x + 12} 0 Z" fill="rgba(15,10,40,.45)"/>`; }).join('') + glowRocks([[160, 330, 9], [420, 350, 7], [690, 320, 10], [880, 345, 8]], 'rgba(103,232,249,.55)') },
    volcano: { far: () => `<path d="M330 300 L460 120 L540 120 L670 300 Z" fill="rgba(70,12,12,.55)"/><path d="M460 120 Q500 108 540 120 Q500 132 460 120 Z" fill="rgba(253,186,116,.75)" class="scn-glow"/><path d="M492 124 Q486 200 470 300 L486 300 Q504 210 506 124 Z" fill="rgba(249,115,22,.55)" class="scn-glow" style="--o:-1s"/>` + smoke(500, 100) },
    temple: { far: () => `<g class="scn-spin" style="transform-origin:500px 110px">${Array.from({ length: 12 }, (_, i) => `<rect x="497" y="20" width="6" height="70" fill="rgba(254,240,138,.12)" transform="rotate(${i * 30} 500 110)"/>`).join('')}</g><circle cx="500" cy="110" r="34" fill="rgba(254,240,138,.35)"/>` + islands([[200, 150, 0.35], [820, 120, 0.3]]) },
    swamp: { far: () => glowRocks([[220, 300, 5], [470, 280, 4], [610, 310, 5], [830, 290, 4]], 'rgba(190,242,100,.7)') + `<ellipse class="scn-drift" cx="300" cy="350" rx="260" ry="26" fill="rgba(203,213,225,.12)"/><ellipse class="scn-drift" style="--o:-9s" cx="760" cy="360" rx="240" ry="22" fill="rgba(203,213,225,.1)"/>` },
    abyss: { far: () => `<ellipse class="scn-glow" cx="500" cy="160" rx="160" ry="20" fill="rgba(124,58,237,.25)"/><path class="scn-glow" style="--o:-2s" d="M380 160 Q500 120 620 160 Q500 200 380 160 Z" fill="rgba(196,181,253,.25)"/>` + islands([[180, 200, 0.45], [800, 170, 0.4], [520, 280, 0.25]]) },
    glacier: { far: () => `<g class="scn-aurora">${aurora('rgba(94,234,212,.18)', 'rgba(244,114,182,.12)')}</g>` + cloud(820, 70, 0.9, 0.3) },
    sky: { far: () => islands([[180, 210, 0.55], [520, 140, 0.4], [840, 230, 0.6]]) + cloud(300, 90, 1.4, 0.5) + cloud(700, 60, 1.1, 0.45) + cloud(950, 120, 1.2, 0.4) + birds(420, 100, 4) },
  };
  Object.entries(DECO).forEach(([id, d]) => {
    const sc = SCENES[id]; if (!sc) return;
    const far = sc.far; sc.far = (c) => far(c) + (d.far ? d.far(c) : '');
    if (d.near) { const near = sc.near; sc.near = (c) => (near ? near(c) : '') + d.near(c); }
  });

  DK.scenes = {
    list: SCENES,
    /** Escena de jefe de una zona (o la del jefe oculto). */
    bossScene(zone, secret = false) { const id = secret ? 'boss_secret' : 'boss_' + zone.scene; return SCENES[id] ? id : zone.scene; },
    /** Añade o sustituye una escena. */
    register(id, def) { SCENES[id] = def; },

    /**
     * Pinta el fondo de una escena.
     * @param {string} id      escena
     * @param {Array} colors   [claro, oscuro] de la zona
     */
    render(id, colors) {
      const sc = SCENES[id] || SCENES.meadow;
      const layer = h('div', { class: 'scene scene-' + id, style: { '--z1': colors[0], '--z2': colors[1] } });
      layer.innerHTML = svg(sc.far(colors), 'scene-far') + (sc.near ? svg(sc.near(colors), 'scene-near') : '');
      const pWrap = h('div', { class: 'scene-particles' });
      const p = sc.particles;
      if (p) for (let i = 0; i < p.n; i++) {
        pWrap.append(h('span', { class: 'sp sp-' + p.type, style: { left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', animationDelay: -Math.random() * 12 + 's', animationDuration: 6 + Math.random() * 8 + 's' } }));
      }
      layer.append(pWrap);
      return DK.pixelBg ? DK.pixelBg.swap(layer) : layer; // v5.20: en pixel art si está activo
    },
  };
})();
