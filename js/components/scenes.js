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

  const SCENES = {
    meadow: { far: (c) => hills(250, 60, 'rgba(255,255,255,.35)', 1) + hills(300, 40, 'rgba(22,101,52,.25)', 2), particles: { type: 'firefly', n: 10 } },
    forest: { far: () => trees(300, 'rgba(5,46,22,.35)', 9, 1, 55) + trees(330, 'rgba(5,46,22,.5)', 7, 3, 45), particles: { type: 'leaf', n: 10 } },
    beach: { far: () => hills(270, 25, 'rgba(255,255,255,.3)', 4, 10) + `<rect x="0" y="300" width="${W}" height="100" fill="rgba(253,230,138,.35)"/>`, particles: { type: 'bubble', n: 12 } },
    cave: { far: () => peaks(70, 70, 'rgba(15,10,40,.55)', 2, 12, true) + peaks(320, 60, 'rgba(15,10,40,.4)', 5, 10), particles: { type: 'sparkle', n: 14 } },
    volcano: { far: () => peaks(260, 150, 'rgba(60,10,10,.45)', 1, 3) + `<circle cx="500" cy="95" r="26" fill="rgba(253,186,116,.45)"/>`, particles: { type: 'ember', n: 18 } },
    temple: { far: () => pillars(320, 'rgba(120,80,10,.25)', 6), particles: { type: 'dust', n: 14 } },
    abyss: { far: () => peaks(330, 80, 'rgba(2,6,23,.6)', 7, 9), particles: { type: 'bubble', n: 14 } },
    sky: { far: () => hills(330, 30, 'rgba(255,255,255,.5)', 3, 5), particles: { type: 'cloud', n: 6 } },

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
  };
  Object.entries(darker).forEach(([id, extra]) => { const sc = SCENES[id]; if (!sc) return; const far = sc.far; sc.far = (c) => far(c) + extra(c); });

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
      return layer;
    },
  };
})();
