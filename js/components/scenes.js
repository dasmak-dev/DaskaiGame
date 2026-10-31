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

  const SCENES = {
    meadow: { far: (c) => hills(250, 60, 'rgba(255,255,255,.35)', 1) + hills(300, 40, 'rgba(22,101,52,.25)', 2), particles: { type: 'firefly', n: 10 } },
    forest: { far: () => trees(300, 'rgba(5,46,22,.35)', 9, 1, 55) + trees(330, 'rgba(5,46,22,.5)', 7, 3, 45), particles: { type: 'leaf', n: 10 } },
    beach: { far: () => hills(270, 25, 'rgba(255,255,255,.3)', 4, 10) + `<rect x="0" y="300" width="${W}" height="100" fill="rgba(253,230,138,.35)"/>`, particles: { type: 'bubble', n: 12 } },
    cave: { far: () => peaks(70, 70, 'rgba(15,10,40,.55)', 2, 12, true) + peaks(320, 60, 'rgba(15,10,40,.4)', 5, 10), particles: { type: 'sparkle', n: 14 } },
    volcano: { far: () => peaks(260, 150, 'rgba(60,10,10,.45)', 1, 3) + `<circle cx="500" cy="95" r="26" fill="rgba(253,186,116,.45)"/>`, particles: { type: 'ember', n: 18 } },
    temple: { far: () => pillars(320, 'rgba(120,80,10,.25)', 6), particles: { type: 'dust', n: 14 } },
    abyss: { far: () => peaks(330, 80, 'rgba(2,6,23,.6)', 7, 9), particles: { type: 'bubble', n: 14 } },
    sky: { far: () => hills(330, 30, 'rgba(255,255,255,.5)', 3, 5), particles: { type: 'cloud', n: 6 } },
  };

  DK.scenes = {
    list: SCENES,
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
