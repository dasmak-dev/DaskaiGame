/* =============================================================
 * systems/looks.js — Aspecto de cada daskai (DK.looks, v4.47).
 *
 * Cada daskai nace con su propio aspecto, sorteado UNA vez (d.look = { s: semilla }):
 *   · La CASA fija el tono de piel, las manos y el pelo (se reconoce de un vistazo):
 *       Luz: almohadillas + pelusa · Oscuridad: garras de sombra + humo ·
 *       Fuego: garras de brasa + llamas · Agua: aletas + escamas · Tierra: puños de piedra + musgo
 *   · La ESPECIE fija su cola (y algunas su cuerpo: fantasmas, serpientes).
 *   · El INDIVIDUO sortea tamaño (0,78–1,22×), cuerpo, camino de patas, ojos, boca,
 *     orejas/cuernos, marca, si tendrá alas (y cuándo) y su adorno final.
 *   · Al EVOLUCIONAR conserva la cara y la piel; el cuerpo crece y madura, cambian las
 *     patas, pueden salir alas y la última forma luce su adorno.
 * Los jefes no se sortean: usan la «forma típica» de su especie (la del Códice), que
 * sale de una semilla fija por línea evolutiva.
 *
 *   DK.looks.svg(speciesId, look|null, { flip, shiny }) → texto SVG
 *   DK.looks.pixel(...) / pixelCached(...)              → pixel art (caché)
 *   DK.looks.of(d) · typical(sid) · ind(sid, look)       → aspecto resuelto
 *   DK.looks.traits(ind) → [{ cat, key, rare }] · icon(cat, key, o) → SVG pequeño del rasgo
 *   DK.looks.see(d) → apunta en el Códice la variante y sus rasgos
 * Textos: lang look.cat.*, look.<cat>.<clave>, look.hands.*, look.fur.*
 * ============================================================= */
(function () {
  const D = DK.data;
  const f = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* ---------- Color ---------- */
  function hex2rgb(h) { h = h.replace('#', ''); const n = parseInt(h, 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function shade(h, a) { const [r, g, b] = hex2rgb(h); const t = a < 0 ? 0 : 255, k = Math.abs(a); return rgb2hex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); }
  function mix(h1, h2, k) { const a = hex2rgb(h1), b = hex2rgb(h2); return rgb2hex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k); }
  function hue(h, deg) {
    let [r, g, b] = hex2rgb(h).map((x) => x / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; }
    hh = ((hh + deg / 360) % 1 + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const c = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return s ? rgb2hex(c(hh + 1 / 3) * 255, c(hh) * 255, c(hh - 1 / 3) * 255) : h;
  }

  /* ---------- Casas: piel, manos, pelo ---------- */
  const HOUSES = {
    luz: { skins: ['#ffd65a', '#ffe08a', '#f6c453', '#ffcf8a', '#fff0b8', '#f2b84b'], belly: '#fff7dc', hands: 'paw', fur: 'fluff', horn: '#fff3c4', wing: 'feather', name: 'Luz' },
    oscuridad: { skins: ['#6d4bd8', '#5a3fb8', '#7d5fd1', '#46378a', '#8e6fe0', '#3a2f66'], belly: '#c9b8ff', hands: 'claw', fur: 'smoke', horn: '#2b2140', wing: 'bat', name: 'Oscuridad' },
    fuego: { skins: ['#f97316', '#ef5a3c', '#fb923c', '#e2552b', '#f59e0b', '#dc4a1a'], belly: '#ffe1b8', hands: 'ember', fur: 'flame', horn: '#3b1d10', wing: 'bat', name: 'Fuego' },
    agua: { skins: ['#38bdf8', '#2aa6e8', '#22d3ee', '#4f8df5', '#2dd4bf', '#60a5fa'], belly: '#e0f7ff', hands: 'flipper', fur: 'scales', horn: '#e6fbff', wing: 'fin', name: 'Agua' },
    tierra: { skins: ['#b07a3a', '#7c9a3a', '#8b5a2b', '#a68a5b', '#6b8e23', '#9a7448'], belly: '#f1e3bf', hands: 'fist', fur: 'moss', horn: '#e8dcc0', wing: 'crystal', name: 'Tierra' },
  };

  /* ---------- Catálogo (peso; ≤ 2 = raro) ---------- */
  const BODIES = { round: 10, chubby: 9, egg: 8, bean: 7, block: 6, tall: 6, blob: 5, drop: 5, squat: 6, ghost: 3, long: 4 };
  const BODY_PATH = { // cómo madura el cuerpo en cada etapa
    round: ['round', 'chubby', 'chubby', 'squat'], chubby: ['chubby', 'chubby', 'squat', 'squat'], egg: ['egg', 'egg', 'tall', 'tall'],
    bean: ['bean', 'bean', 'long', 'long'], block: ['block', 'block', 'block', 'block'], tall: ['tall', 'tall', 'tall', 'egg'],
    blob: ['blob', 'blob', 'chubby', 'squat'], drop: ['drop', 'egg', 'tall', 'tall'], squat: ['squat', 'squat', 'block', 'block'],
    ghost: ['ghost', 'ghost', 'ghost', 'ghost'], long: ['long', 'long', 'long', 'long'],
  };
  const LEG_PATHS = { // patas en cada etapa
    stubby: [['stubby', 'paws', 'quad', 'quad'], 9], digi: [['stubby', 'digi', 'digi', 'pillars'], 6], paws: [['paws', 'paws', 'quad', 'pillars'], 8],
    bird: [['tall', 'tall', 'tall', 'digi'], 5], tent: [['tentacles', 'tentacles', 'tentacles', 'tentacles'], 3], hover: [['hover', 'hover', 'hover', 'hover'], 3],
    late: [['stubby', 'stubby', 'paws', 'quad'], 6], pillar: [['paws', 'pillars', 'pillars', 'pillars'], 4],
  };
  const SLITHER = ['none', 'none', 'none', 'none'];
  const EYES = { big: 10, sharp: 9, slit: 6, sleepy: 5, happy: 5, glow: 5, dot: 6, angry: 6, star: 3, button: 3, uneven: 2, cyclops: 1.5, three: 1.2, visor: 1.2 };
  const MOUTHS = { w: 7, smile: 8, open: 6, grin: 5, tiny: 6, flat: 4, fangs: 6, tusks: 3, buck: 3, tongue: 4, beak: 2 };
  const EARS = { cat: 9, bunny: 6, bear: 7, droopy: 5, horns: 7, unicorn: 2, antenna: 4, crest: 6, sprout: 4, fins: 5, spikes: 5, tuft: 6, none: 3 };
  const MARKS = { none: 9, star: 4, moon: 4, heart: 3, spots: 6, stripes: 6, zigzag: 3, gem: 3 };
  const FINALS = { mane: 6, crown: 3, halo: 3, aura: 4, gemstone: 3, none: 3 };
  // La casa tira un poco de algunos rasgos
  const HOUSE_BIAS = {
    luz: { ears: { bunny: 2, cat: 1.5, tuft: 1.5 }, eyes: { big: 1.6, star: 2 }, finals: { halo: 4, crown: 2 }, mark: { star: 3 } },
    oscuridad: { ears: { horns: 2, cat: 1.6, spikes: 1.5 }, eyes: { slit: 2, glow: 2, sharp: 1.5 }, finals: { aura: 3 }, mark: { moon: 3 } },
    fuego: { ears: { horns: 2, crest: 1.6, tuft: 1.5 }, eyes: { angry: 2, sharp: 1.5 }, mouths: { fangs: 2 }, finals: { mane: 2 } },
    agua: { ears: { fins: 3, crest: 1.5, droopy: 1.3 }, eyes: { big: 1.5, dot: 1.5 }, mark: { spots: 2 }, bodies: { long: 2, drop: 2 } },
    tierra: { ears: { sprout: 2.5, horns: 1.6, bear: 1.6 }, eyes: { sleepy: 2, dot: 1.5 }, mark: { gem: 2.5 }, bodies: { block: 2, squat: 1.6 }, mouths: { tusks: 2.5 } },
  };
  const EYE_COLORS = ['#1b1b2f', '#1b1b2f', '#2b1a0e', '#0f3b57', '#7c3aed', '#16a34a', '#dc2626', '#f59e0b', '#0891b2'];
  const GLOW_COLORS = ['#fde047', '#22d3ee', '#f472b6', '#a3e635', '#f87171', '#c4b5fd'];

  const rare = (table, k) => (table[k] || 99) <= 2;
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function pick(table, R, bias = {}) {
    const e = Object.entries(table).map(([k, w]) => [k, (Array.isArray(w) ? w[1] : w) * (bias[k] || 1)]);
    let t = e.reduce((a, [, w]) => a + w, 0) * R();
    for (const [k, w] of e) if ((t -= w) <= 0) return k;
    return e[0][0];
  }

  /** Sortea un daskai de una casa. */
  function roll(house, seed) {
    const R = rng(seed), H = HOUSES[house], B = HOUSE_BIAS[house] || {};
    const skin = hue(H.skins[Math.floor(R() * H.skins.length)], Math.round(R() * 14 - 7));
    const size = 0.78 + R() * 0.44; // 0,78 – 1,22
    const body = pick(BODIES, R, B.bodies);
    const legs = body === 'ghost' ? 'hover' : body === 'long' ? pick({ stubby: 3, tent: 2, hover: 2, paws: 3 }, R) : pick(LEG_PATHS, R);
    const eyes = pick(EYES, R, B.eyes);
    let mouth = pick(MOUTHS, R, B.mouths);
    if (eyes === 'visor' && mouth === 'beak') mouth = 'smile';
    const ind = {
      house, seed, skin, size, body, legs, eyes, mouth,
      ears: pick(EARS, R, B.ears), mark: pick(MARKS, R, B.mark), final: pick(FINALS, R, B.finals),
      eyeColor: eyes === 'glow' || eyes === 'visor' ? GLOW_COLORS[Math.floor(R() * GLOW_COLORS.length)] : EYE_COLORS[Math.floor(R() * EYE_COLORS.length)],
      eyeScale: 0.85 + R() * 0.4, earScale: 0.8 + R() * 0.45, armScale: 0.8 + R() * 0.4,
      winged: R() < 0.42, wingStage: R() < 0.5 ? 2 : 3, cheeks: R() < 0.7, furAmt: 0.6 + R() * 0.8,
      wob: R() * 6.28, lean: R() * 0.12 - 0.06,
      code: (seed >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, '0'),
    };
    ind.rare = rare(EYES, eyes) || rare(MOUTHS, mouth) || rare(EARS, ind.ears) || ind.size > 1.18 || ind.size < 0.82 || rare(BODIES, body);
    return ind;
  }

  /* ---------- Formas ---------- */
  function smooth(pts) { // Catmull-Rom cerrada → Bézier
    const n = pts.length; let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + ' Z';
  }
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const PRESET = {
    round: { w: 1, h: 1, n: 2 }, chubby: { w: 1.08, h: 0.95, n: 2.2, pear: 0.2 }, egg: { w: 0.9, h: 1.1, n: 2, pear: 0.24 },
    bean: { w: 1.22, h: 0.84, n: 2.5, wob: 0.03, k: 2 }, block: { w: 1.05, h: 0.95, n: 3.8, pear: 0.04 }, tall: { w: 0.8, h: 1.24, n: 2.3, pear: 0.1 },
    blob: { w: 1.05, h: 0.96, n: 2, wob: 0.07, k: 5 }, drop: { w: 0.92, h: 1.12, n: 2, drop: 0.6 }, squat: { w: 1.25, h: 0.8, n: 2.8, pear: 0.06 },
    ghost: { w: 0.95, h: 1.05, n: 2 }, long: { w: 1.02, h: 0.86, n: 2.4 },
  };
  function bodyPath(kind, cx, cy, W, H, ind) {
    const P = PRESET[kind] || PRESET.round, N = 44, pts = [];
    if (kind === 'ghost') { // cabeza redonda y faldón ondulado
      for (let i = 0; i <= 22; i++) { const a = Math.PI + (i / 22) * Math.PI; pts.push([cx + W * Math.cos(a), cy + H * 0.15 + H * 0.95 * Math.sin(a)]); }
      const yb = cy + H * 0.95, n = 4;
      for (let i = 0; i <= n * 2; i++) { const x = cx + W - (i / (n * 2)) * W * 2; pts.push([x, yb + (i % 2 ? 7 : 0)]); }
      return smooth(pts);
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let x = W * sp(Math.cos(a), 2 / P.n), y = H * sp(Math.sin(a), 2 / P.n);
      if (P.pear) x *= 1 + P.pear * (y / H);
      if (P.drop && y < 0) { const k = -y / H; x *= Math.pow(1 - k * P.drop, 1.2); y *= 1 + k * 0.18; }
      if (P.wob) { const r = 1 + P.wob * Math.sin(a * P.k + ind.wob); x *= r; y *= r; }
      pts.push([cx + x, cy + y]);
    }
    return smooth(pts);
  }

  /* ---------- Piezas ---------- */
  const STROKE = (dk, w = 2.2) => `stroke="${dk}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  function eyesSvg(ind, P) {
    const { fx, ey, er, dk } = P, col = ind.eyeColor;
    const e1 = [fx - er * 1.25, ey + 0.5], e2 = [fx + er * 1.25, ey - 0.8];
    const shine = (x, y, r) => `<circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.38)}" r="${f(r * 0.3)}" fill="#fff"/><circle cx="${f(x + r * 0.3)}" cy="${f(y + r * 0.3)}" r="${f(r * 0.13)}" fill="#fff" opacity=".85"/>`;
    const big = ([x, y], r = er) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/>` +
      `<circle cx="${f(x - r * 0.12)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.7)}" fill="${col}"/><circle cx="${f(x - r * 0.12)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.36)}" fill="#0b0a12"/>` + shine(x - r * 0.12, y + r * 0.1, r * 0.7);
    switch (ind.eyes) {
      case 'sharp': return [e1, e2].map(([x, y], i) => `<path d="M ${f(x - er)} ${f(y + 1)} Q ${f(x)} ${f(y - er * 1.15)} ${f(x + er)} ${f(y - (i ? 2.4 : 1))} Q ${f(x)} ${f(y + er * 0.85)} ${f(x - er)} ${f(y + 1)} Z" fill="#fff" ${STROKE(dk, 1.5)}/>` +
        `<circle cx="${f(x - 0.6)}" cy="${f(y)}" r="${f(er * 0.45)}" fill="${col}"/><circle cx="${f(x - 0.6)}" cy="${f(y)}" r="${f(er * 0.22)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.35)}" cy="${f(y - er * 0.25)}" r="${f(er * 0.15)}" fill="#fff"/>`).join('');
      case 'slit': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.05)}" fill="${col === '#1b1b2f' ? '#facc15' : col}" ${STROKE(dk, 1.4)}/><ellipse cx="${f(x - 0.4)}" cy="${f(y)}" rx="${f(er * 0.2)}" ry="${f(er * 0.85)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.4)}" cy="${f(y - er * 0.4)}" r="${f(er * 0.2)}" fill="#fff"/>`).join('');
      case 'sleepy': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er)} ${f(y)} Q ${f(x)} ${f(y + er * 0.9)} ${f(x + er)} ${f(y)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'happy': return [e1, e2].map(([x, y]) => `<path d="M ${f(x - er)} ${f(y + 2)} Q ${f(x)} ${f(y - er * 1.1)} ${f(x + er)} ${f(y + 2)}" fill="none" ${STROKE(dk, 2.4)}/>`).join('');
      case 'glow': return [e1, e2].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 1.5)}" fill="${col}" opacity=".28"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.85)}" ry="${f(er * 0.95)}" fill="${col}" ${STROKE(dk, 1.2)}/><ellipse cx="${f(x - er * 0.25)}" cy="${f(y - er * 0.3)}" rx="${f(er * 0.3)}" ry="${f(er * 0.2)}" fill="#fff" opacity=".9"/>`).join('');
      case 'dot': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er * 0.42)}" ry="${f(er * 0.55)}" fill="#0b0a12"/><circle cx="${f(x - er * 0.15)}" cy="${f(y - er * 0.22)}" r="${f(er * 0.16)}" fill="#fff"/>`).join('');
      case 'angry': return big(e1) + big(e2) + `<path d="M ${f(e1[0] - er * 1.1)} ${f(e1[1] - er * 1.45)} L ${f(e1[0] + er * 0.9)} ${f(e1[1] - er * 0.8)} M ${f(e2[0] - er * 0.9)} ${f(e2[1] - er * 0.8)} L ${f(e2[0] + er * 1.1)} ${f(e2[1] - er * 1.5)}" ${STROKE(dk, 2.6)}/>`;
      case 'star': return [e1, e2].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(er)}" ry="${f(er * 1.08)}" fill="#fff" ${STROKE(dk, 1.4)}/>` + star(x - er * 0.08, y + er * 0.1, er * 0.72, er * 0.32, col === '#1b1b2f' ? '#f59e0b' : col)).join('');
      case 'button': return [e1, e2].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.95)}" fill="#0b0a12"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.6)}" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="${f(x - er * 0.3)}" cy="${f(y - er * 0.3)}" r="${f(er * 0.18)}" fill="#fff"/>`).join('');
      case 'uneven': return big(e1, er * 1.3) + big(e2, er * 0.75);
      case 'cyclops': return big([fx, ey - 0.5], er * 1.7);
      case 'three': return big(e1, er * 0.9) + big(e2, er * 0.9) + big([fx, ey - er * 2.1], er * 0.65);
      case 'visor': return `<rect x="${f(e1[0] - er * 1.3)}" y="${f(ey - er * 0.75)}" width="${f(e2[0] - e1[0] + er * 2.6)}" height="${f(er * 1.4)}" rx="${f(er * 0.7)}" fill="#120f1d" ${STROKE(dk, 1.4)}/><rect x="${f(e1[0] - er * 0.6)}" y="${f(ey - er * 0.2)}" width="${f(e2[0] - e1[0] + er * 1.2)}" height="${f(er * 0.4)}" rx="${f(er * 0.2)}" fill="${col}"/><rect x="${f(e1[0] - er * 0.6)}" y="${f(ey - er * 0.55)}" width="${f(e2[0] - e1[0] + er * 1.2)}" height="${f(er * 1.1)}" rx="${f(er * 0.5)}" fill="${col}" opacity=".25"/>`;
      default: return big(e1) + big(e2);
    }
  }
  function star(x, y, R, r, fill) {
    return `<polygon points="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; return f(x + q * Math.cos(a)) + ',' + f(y + q * Math.sin(a)); }).join(' ')}" fill="${fill}"/>`;
  }

  function mouthSvg(ind, P) {
    const { mx, my, dk, s } = P, w = 4.2 * s;
    switch (ind.mouth) {
      case 'smile': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/>`;
      case 'open': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 2)} ${f(mx + w)} ${f(my - 1)} Z" fill="#4a0f1c" ${STROKE(dk, 1.6)}/><ellipse cx="${f(mx)}" cy="${f(my + w * 0.75)}" rx="${f(w * 0.55)}" ry="${f(w * 0.32)}" fill="#f472b6"/>`;
      case 'grin': return `<path d="M ${f(mx - w * 1.3)} ${f(my - 1.5)} Q ${f(mx)} ${f(my + w * 1.5)} ${f(mx + w * 1.3)} ${f(my - 1.5)} Z" fill="#fff" ${STROKE(dk, 1.6)}/><path d="M ${f(mx - w * 0.45)} ${f(my - 1)} v ${f(w * 0.8)} M ${f(mx + w * 0.45)} ${f(my - 1)} v ${f(w * 0.8)}" stroke="${dk}" stroke-width="1"/>`;
      case 'tiny': return `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(w * 0.4)}" ry="${f(w * 0.36)}" fill="${dk}"/>`;
      case 'flat': return `<path d="M ${f(mx - w * 0.9)} ${f(my + 1)} L ${f(mx + w * 0.9)} ${f(my)}" fill="none" ${STROKE(dk, 2.2)}/>`;
      case 'fangs': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.9)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.75)} ${f(my)} l ${f(w * 0.3)} ${f(w * 0.75)} l ${f(w * 0.3)} ${f(-w * 0.65)} Z M ${f(mx + w * 0.15)} ${f(my + 0.4)} l ${f(w * 0.3)} ${f(w * 0.75)} l ${f(w * 0.3)} ${f(-w * 0.75)} Z" fill="#fff" ${STROKE(dk, 0.8)}/>`;
      case 'tusks': return `<path d="M ${f(mx - w)} ${f(my)} Q ${f(mx)} ${f(my + w * 0.6)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx - w * 0.9)} ${f(my + 0.5)} q ${f(-w * 0.4)} ${f(-w * 0.9)} ${f(-w * 0.1)} ${f(-w * 1.5)} q ${f(w * 0.25)} ${f(w * 0.7)} ${f(w * 0.45)} ${f(w * 1.4)} Z M ${f(mx + w * 0.9)} ${f(my + 0.5)} q ${f(w * 0.4)} ${f(-w * 0.9)} ${f(w * 0.1)} ${f(-w * 1.5)} q ${f(-w * 0.25)} ${f(w * 0.7)} ${f(-w * 0.45)} ${f(w * 1.4)} Z" fill="#fffaf0" ${STROKE(dk, 1)}/>`;
      case 'buck': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 0.8)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><rect x="${f(mx - w * 0.5)}" y="${f(my + w * 0.15)}" width="${f(w)}" height="${f(w * 0.75)}" rx="1" fill="#fff" ${STROKE(dk, 1)}/><path d="M ${f(mx)} ${f(my + w * 0.15)} v ${f(w * 0.75)}" stroke="${dk}" stroke-width=".8"/>`;
      case 'tongue': return `<path d="M ${f(mx - w)} ${f(my - 1)} Q ${f(mx)} ${f(my + w * 1.1)} ${f(mx + w)} ${f(my - 1)}" fill="none" ${STROKE(dk, 2)}/><path d="M ${f(mx + w * 0.05)} ${f(my + w * 0.45)} q ${f(w * 0.2)} ${f(w * 1.1)} ${f(w * 0.75)} ${f(w * 0.5)} q ${f(w * 0.1)} ${f(-w * 0.5)} ${f(-w * 0.05)} ${f(-w * 0.75)} Z" fill="#f472b6" ${STROKE(dk, 1)}/>`;
      case 'beak': return `<path d="M ${f(mx + w * 0.6)} ${f(my - w * 0.9)} L ${f(mx - w * 2.3)} ${f(my + w * 0.1)} L ${f(mx + w * 0.6)} ${f(my + w * 0.8)} Z" fill="#f59e0b" ${STROKE(dk, 1.4)}/><path d="M ${f(mx + w * 0.6)} ${f(my)} L ${f(mx - w * 2.1)} ${f(my + w * 0.1)}" stroke="${dk}" stroke-width="1"/>`;
      default: return `<path d="M ${f(mx - w)} ${f(my)} Q ${f(mx - w / 2)} ${f(my + w * 0.85)} ${f(mx)} ${f(my)} Q ${f(mx + w / 2)} ${f(my + w * 0.85)} ${f(mx + w)} ${f(my)}" fill="none" ${STROKE(dk, 2)}/>`;
    }
  }

  // Orejas y cabeza (detrás o delante del cuerpo)
  function earsSvg(ind, P, front) {
    const { cx, W, top, skin, inner, dk, hornC, s } = P, k = ind.earScale * s;
    const L = cx - W * 0.45, Rr = cx + W * 0.2, yL = top(L), yR = top(Rr);
    switch (ind.ears) {
      case 'cat': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 7 * k)} ${f(y + 6)} L ${f(x + d * 2 * k)} ${f(y - 15 * k)} L ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${skin}" ${STROKE(dk)}/><path d="M ${f(x - 3.5 * k)} ${f(y + 3)} L ${f(x + d * 1.5 * k)} ${f(y - 8 * k)} L ${f(x + 4 * k)} ${f(y + 3)} Z" fill="${inner}"/>`).join('');
      case 'bunny': return front ? '' : [[L, yL, -14], [Rr, yR, 12]].map(([x, y, r]) => `<g transform="rotate(${r} ${f(x)} ${f(y + 4)})"><ellipse cx="${f(x)}" cy="${f(y - 12 * k)}" rx="${f(6 * k)}" ry="${f(17 * k)}" fill="${skin}" ${STROKE(dk)}/><ellipse cx="${f(x)}" cy="${f(y - 11 * k)}" rx="${f(2.8 * k)}" ry="${f(11 * k)}" fill="${inner}"/></g>`).join('');
      case 'bear': return front ? '' : [[L, yL], [Rr, yR]].map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(7 * k)}" fill="${skin}" ${STROKE(dk)}/><circle cx="${f(x)}" cy="${f(y + 0.5)}" r="${f(3.6 * k)}" fill="${inner}"/>`).join('');
      case 'droopy': return !front ? '' : [[cx - W * 0.82, P.ey - 2, 1], [cx + W * 0.55, P.ey - 3, -1]].map(([x, y, d]) => `<path d="M ${f(x + d * 3)} ${f(y - 6)} q ${f(-d * 9 * k)} ${f(2 * k)} ${f(-d * 7 * k)} ${f(17 * k)} q ${f(d * 5 * k)} ${f(3 * k)} ${f(d * 9 * k)} ${f(-6 * k)} Z" fill="${shade(skin, -0.18)}" ${STROKE(dk, 2)}/>`).join('');
      case 'horns': return front ? '' : [[L, yL, -1], [Rr, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x - 4 * k)} ${f(y + 5)} Q ${f(x + d * 9 * k)} ${f(y - 4 * k)} ${f(x + d * 5 * k)} ${f(y - 17 * k)} Q ${f(x + d * 1 * k)} ${f(y - 6 * k)} ${f(x + 4 * k)} ${f(y + 5)} Z" fill="${hornC}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2 * k)} ${f(y - 4 * k)} l ${f(d * 3)} -1 M ${f(x + d * 3.5 * k)} ${f(y - 9 * k)} l ${f(d * 2.5)} -1" stroke="${dk}" stroke-width="1" opacity=".5"/>`).join('');
      case 'unicorn': { const x = cx - W * 0.18, y = top(x); return front ? '' : `<path d="M ${f(x - 5 * k)} ${f(y + 4)} L ${f(x - 1 * k)} ${f(y - 22 * k)} L ${f(x + 5 * k)} ${f(y + 4)} Z" fill="${hornC}" ${STROKE(dk, 1.8)}/><path d="M ${f(x - 3.5 * k)} ${f(y - 2)} l ${f(6 * k)} -3 M ${f(x - 2.6 * k)} ${f(y - 8 * k)} l ${f(4.5 * k)} -2.5 M ${f(x - 1.8 * k)} ${f(y - 14 * k)} l ${f(3 * k)} -2" stroke="${dk}" stroke-width="1" opacity=".55"/>`; }
      case 'antenna': return front ? '' : [[L + 3, yL, -1], [Rr - 2, yR, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 3)} Q ${f(x + d * 6 * k)} ${f(y - 10 * k)} ${f(x + d * 3 * k)} ${f(y - 18 * k)}" fill="none" ${STROKE(dk, 2)}/><circle cx="${f(x + d * 3 * k)}" cy="${f(y - 19 * k)}" r="${f(3.6 * k)}" fill="${inner}" ${STROKE(dk, 1.6)}/>`).join('');
      case 'crest': { const xs = [-0.5, -0.18, 0.14]; return front ? '' : xs.map((o, i) => { const x = cx + W * o, y = top(x); const h = (14 - i * 2.5) * k; return `<path d="M ${f(x - 5 * k)} ${f(y + 5)} Q ${f(x - 2)} ${f(y - h)} ${f(x + 5 * k)} ${f(y - h * 0.9)} Q ${f(x + 2)} ${f(y - 2)} ${f(x + 5 * k)} ${f(y + 5)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/>`; }).join(''); }
      case 'sprout': { const x = cx - W * 0.12, y = top(x); return front ? '' : `<path d="M ${f(x)} ${f(y + 3)} q -1 ${f(-8 * k)} 1 ${f(-12 * k)}" fill="none" ${STROKE('#3f6212', 2.2)}/><path d="M ${f(x + 1)} ${f(y - 9 * k)} q ${f(-12 * k)} ${f(-8 * k)} ${f(-14 * k)} ${f(2 * k)} q ${f(8 * k)} ${f(5 * k)} ${f(14 * k)} ${f(-2 * k)} Z" fill="#65a30d" ${STROKE('#365314', 1.5)}/><path d="M ${f(x + 1)} ${f(y - 11 * k)} q ${f(10 * k)} ${f(-9 * k)} ${f(13 * k)} ${f(0)} q ${f(-6 * k)} ${f(5 * k)} ${f(-13 * k)} ${f(0)} Z" fill="#84cc16" ${STROKE('#365314', 1.5)}/>`; }
      case 'fins': return front ? '' : [[cx - W * 0.86, P.ey - 4, -1], [cx + W * 0.62, P.ey - 6, 1]].map(([x, y, d]) => `<path d="M ${f(x)} ${f(y + 6)} L ${f(x + d * 13 * k)} ${f(y - 10 * k)} Q ${f(x + d * 8 * k)} ${f(y - 1)} ${f(x + d * 11 * k)} ${f(y + 8 * k)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + d * 2)} ${f(y + 4)} L ${f(x + d * 9 * k)} ${f(y - 5 * k)} M ${f(x + d * 2)} ${f(y + 6)} L ${f(x + d * 9 * k)} ${f(y + 3 * k)}" stroke="${dk}" stroke-width=".9" opacity=".5"/>`).join('');
      case 'spikes': return front ? '' : [-0.3, 0.05, 0.38, 0.68].map((o, i) => { const x = cx + W * o, y = top(x); const h = (11 - Math.abs(i - 1.2) * 2) * k; return `<path d="M ${f(x - 5 * k)} ${f(y + 4)} L ${f(x + 1.5 * k)} ${f(y - h)} L ${f(x + 6 * k)} ${f(y + 4)} Z" fill="${hornC}" ${STROKE(dk, 1.6)}/>`; }).join('');
      case 'tuft': { const x = cx - W * 0.2, y = top(x); return front ? '' : `<path d="M ${f(x - 9 * k)} ${f(y + 5)} Q ${f(x - 10 * k)} ${f(y - 12 * k)} ${f(x + 2 * k)} ${f(y - 13 * k)} Q ${f(x - 4 * k)} ${f(y - 7 * k)} ${f(x + 3 * k)} ${f(y - 4 * k)} Q ${f(x + 10 * k)} ${f(y - 10 * k)} ${f(x + 11 * k)} ${f(y - 5 * k)} Q ${f(x + 8 * k)} ${f(y + 1)} ${f(x + 8 * k)} ${f(y + 5)} Z" fill="${shade(skin, -0.12)}" ${STROKE(dk, 1.8)}/>`; }
      default: return '';
    }
  }

  // Manos según la casa
  function armSvg(ind, P, side) {
    const { cx, cy, W, H, skin, dk, s, house } = P, k = ind.armScale * s * (0.75 + P.stage * 0.12);
    const near = side === 'near', d = near ? -1 : 1;
    const sx = near ? cx - W * 0.9 : cx + W * 0.74, sy = cy + H * 0.08;
    const hx = sx + d * 5 * k, hy = sy + 9 * k;
    const arm = `<path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${dk}" stroke-width="${f(7.5 * k)}" stroke-linecap="round"/><path d="M ${f(sx)} ${f(sy - 3 * k)} Q ${f(sx + d * 6 * k)} ${f(sy)} ${f(hx)} ${f(hy - 2 * k)}" fill="none" stroke="${skin}" stroke-width="${f(4.6 * k)}" stroke-linecap="round"/>`;
    const H_ = HOUSES[house];
    switch (H_.hands) {
      case 'paw': return arm + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(4.8 * k)}" ry="${f(4.2 * k)}" fill="${shade(skin, 0.25)}" ${STROKE(dk, 1.6)}/>` + [-1, 0, 1].map((i) => `<circle cx="${f(hx + i * 1.9 * k)}" cy="${f(hy + 1.6 * k)}" r="${f(0.9 * k)}" fill="#f9a8d4"/>`).join('');
      case 'claw': return arm.replace(`stroke-width="${f(4.6 * k)}"`, `stroke-width="${f(3.6 * k)}"`) + [-1, 0, 1].map((i) => `<path d="M ${f(hx + i * 1.6 * k)} ${f(hy - 1 * k)} q ${f(d * 1.5 * k + i * k)} ${f(4 * k)} ${f(d * -1 * k + i * 1.5 * k)} ${f(6 * k)}" fill="none" stroke="#1a1430" stroke-width="${f(1.8 * k)}" stroke-linecap="round"/>`).join('');
      case 'ember': return arm + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(4.2 * k)}" ry="${f(3.8 * k)}" fill="${skin}" ${STROKE(dk, 1.6)}/>` + [-1, 0, 1].map((i) => `<path d="M ${f(hx + i * 2.2 * k - 1)} ${f(hy + 2.5 * k)} l ${f(1 * k)} ${f(3.4 * k)} l ${f(1 * k)} ${f(-3.4 * k)} Z" fill="#fde047" ${STROKE('#7c2d12', 0.8)}/>`).join('');
      case 'flipper': return arm + `<path d="M ${f(hx - 3 * k)} ${f(hy - 3 * k)} Q ${f(hx + d * 9 * k)} ${f(hy)} ${f(hx + d * 3 * k)} ${f(hy + 8 * k)} Q ${f(hx - d * 2 * k)} ${f(hy + 4 * k)} ${f(hx - 3 * k)} ${f(hy - 3 * k)} Z" fill="${shade(skin, 0.2)}" ${STROKE(dk, 1.6)}/><path d="M ${f(hx)} ${f(hy - 1 * k)} L ${f(hx + d * 3 * k)} ${f(hy + 5 * k)} M ${f(hx - d * 1 * k)} ${f(hy)} L ${f(hx + d * 0.5 * k)} ${f(hy + 5.5 * k)}" stroke="${dk}" stroke-width=".8" opacity=".55"/>`;
      case 'fist': return arm.replace(`stroke-width="${f(7.5 * k)}"`, `stroke-width="${f(9 * k)}"`).replace(`stroke-width="${f(4.6 * k)}"`, `stroke-width="${f(6 * k)}"`) + `<rect x="${f(hx - 5.5 * k)}" y="${f(hy - 4.5 * k)}" width="${f(11 * k)}" height="${f(9 * k)}" rx="${f(2.6 * k)}" fill="#a8a29e" ${STROKE('#44403c', 1.6)}/><path d="M ${f(hx - 3 * k)} ${f(hy - 4.5 * k)} v ${f(4 * k)} M ${f(hx)} ${f(hy - 4.5 * k)} v ${f(4 * k)} M ${f(hx + 3 * k)} ${f(hy - 4.5 * k)} v ${f(4 * k)}" stroke="#57534e" stroke-width="1"/>`;
      default: return arm;
    }
  }

  // Patas (detrás = far, delante = near)
  function legsSvg(kind, P, layer) {
    const { cx, cy, W, H, skin, dk, groundY, s } = P, y0 = cy + H * 0.78, dark = shade(skin, -0.22);
    const foot = (x, y, rx, ry, c) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${STROKE(dk, 1.8)}/>`;
    const toes = (x, y, r) => [-1, 0, 1].map((i) => `<path d="M ${f(x + i * r * 0.55)} ${f(y + r * 0.2)} v ${f(-r * 0.5)}" stroke="${dk}" stroke-width=".9" opacity=".6"/>`).join('');
    const pillar = (x, w, c) => `<path d="M ${f(x - w / 2)} ${f(y0 - 4)} C ${f(x - w * 0.62)} ${f((y0 + groundY) / 2)} ${f(x - w * 0.62)} ${f(groundY - 2)} ${f(x - w * 0.3)} ${f(groundY)} L ${f(x + w * 0.3)} ${f(groundY)} C ${f(x + w * 0.62)} ${f(groundY - 2)} ${f(x + w * 0.55)} ${f((y0 + groundY) / 2)} ${f(x + w / 2)} ${f(y0 - 4)} Z" fill="${c}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + w * 0.22)} ${f(y0)} Q ${f(x + w * 0.3)} ${f((y0 + groundY) / 2)} ${f(x + w * 0.2)} ${f(groundY - 3)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="${f(w * 0.25)}" stroke-linecap="round"/>`;
    switch (kind) {
      case 'stubby': return layer === 'near' ? foot(cx - W * 0.42, groundY - 2.5, 7 * s, 4.6 * s, dark) + foot(cx + W * 0.36, groundY - 2.5, 7 * s, 4.6 * s, dark) : '';
      case 'paws': return layer === 'near' ? [cx - W * 0.42, cx + W * 0.34].map((x) => pillar(x, 9 * s, skin) + foot(x - 1.5, groundY - 2.2, 6.5 * s, 4 * s, shade(skin, 0.15)) + toes(x - 1.5, groundY - 2.2, 4 * s)).join('') : '';
      case 'quad': return (layer === 'far' ? [cx - W * 0.2, cx + W * 0.62] : [cx - W * 0.55, cx + W * 0.3]).map((x) => pillar(x, 9 * s, layer === 'far' ? dark : skin) + foot(x - 1, groundY - 2, 6 * s, 3.6 * s, shade(skin, layer === 'far' ? -0.3 : 0.1))).join('');
      case 'pillars': return (layer === 'far' ? [cx - W * 0.15, cx + W * 0.6] : [cx - W * 0.55, cx + W * 0.28]).map((x) => pillar(x, 13 * s, layer === 'far' ? dark : skin) + [-1, 0, 1].map((i) => `<ellipse cx="${f(x + i * 3.6 * s)}" cy="${f(groundY - 1.5)}" rx="${f(1.6 * s)}" ry="${f(1.1 * s)}" fill="#f5f0e6" opacity=".9"/>`).join('')).join('');
      case 'digi': return (layer === 'far' ? [cx + W * 0.5] : [cx - W * 0.42]).map((x) => `<ellipse cx="${f(x)}" cy="${f(y0 - 2)}" rx="${f(8 * s)}" ry="${f(10 * s)}" fill="${layer === 'far' ? dark : skin}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + 2 * s)} ${f(y0 + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${dk}" stroke-width="${f(6 * s)}" stroke-linecap="round"/><path d="M ${f(x + 2 * s)} ${f(y0 + 6 * s)} L ${f(x + 1 * s)} ${f(groundY - 3)}" stroke="${layer === 'far' ? dark : skin}" stroke-width="${f(3.6 * s)}" stroke-linecap="round"/>` + foot(x - 2, groundY - 2.4, 8 * s, 3.4 * s, shade(skin, -0.25)) + toes(x - 4, groundY - 2.4, 4 * s)).join('');
      case 'tall': return layer === 'near' ? [cx - W * 0.25, cx + W * 0.22].map((x) => `<path d="M ${f(x)} ${f(y0 - 3)} L ${f(x)} ${f(groundY - 2)} M ${f(x)} ${f(groundY - 2)} l ${f(-5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(4.5 * s)} ${f(2)} M ${f(x)} ${f(groundY - 2)} l ${f(-0.5)} ${f(2.4)}" fill="none" stroke="#c2410c" stroke-width="${f(2.6 * s)}" stroke-linecap="round"/>`).join('') : '';
      case 'tentacles': return layer === 'near' ? [-0.55, -0.15, 0.25, 0.6].map((o, i) => { const x = cx + W * o; return `<path d="M ${f(x - 3)} ${f(y0 - 6)} Q ${f(x - 6 + (i % 2) * 9)} ${f(groundY - 6)} ${f(x + (i % 2 ? 4 : -5))} ${f(groundY - 1)} Q ${f(x + (i % 2 ? 1 : -1))} ${f(groundY - 6)} ${f(x + 4)} ${f(y0 - 6)} Z" fill="${i % 2 ? dark : skin}" ${STROKE(dk, 1.6)}/>`; }).join('') : '';
      default: return '';
    }
  }
  const LIFT = { none: 0, stubby: 0, paws: 4, quad: 9, pillars: 8, digi: 9, tall: 13, tentacles: 7, hover: 9 };

  // Pelo / textura según la casa (recortado al cuerpo)
  function furSvg(ind, P, clip) {
    const { cx, cy, W, H, skin, dk, stage, house, top } = P, amt = ind.furAmt * (0.7 + stage * 0.25);
    const R = rng(ind.seed + 7);
    switch (HOUSES[house].fur) {
      case 'fluff': { // mechones suaves en la cabeza y mejillas
        const n = Math.round(3 + amt * 2), out = [];
        for (let i = 0; i < n; i++) { const x = cx - W * 0.6 + (i / (n - 1)) * W * 1.1, y = top(x) + 2; out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(3.4 + R() * 2.2)}" fill="${shade(skin, 0.35)}" ${STROKE(dk, 1.4)}/>`); }
        out.push(`<path d="M ${f(cx - W * 0.98)} ${f(cy + 2)} q -4 3 0 6 q -3 3 1 5" fill="${shade(skin, 0.3)}" ${STROKE(dk, 1.3)}/>`);
        return { back: out.join(''), clip: [0, 1, 2].map(() => `<path d="M ${f(cx - W + R() * W * 1.6)} ${f(cy - H * 0.2 + R() * H * 0.9)} l 1.5 -2.5 l 1.5 2.5 l -1.5 2.5 Z" fill="#fff" opacity=".7"/>`).join('') };
      }
      case 'smoke': { // volutas que suben de la espalda
        const out = [];
        for (let i = 0; i < Math.round(2 + amt); i++) { const x = cx + W * (0.1 + i * 0.25), y = top(x); out.push(`<path d="M ${f(x)} ${f(y + 3)} q ${f(-6 + R() * 4)} ${f(-6)} 0 ${f(-11 - i * 2)} q ${f(6)} ${f(-5)} ${f(-1)} ${f(-11)}" fill="none" stroke="${shade(skin, -0.45)}" stroke-width="${f(3.4 - i * 0.6)}" stroke-linecap="round" opacity=".55"/>`); }
        return { back: out.join(''), clip: `<path d="M ${f(cx + W * 0.1)} ${f(cy - H)} Q ${f(cx + W * 1.2)} ${f(cy - H * 0.3)} ${f(cx + W)} ${f(cy + H)} L ${f(cx + W * 1.3)} ${f(cy + H)} L ${f(cx + W * 1.3)} ${f(cy - H)} Z" fill="#0b0716" opacity=".28"/>` };
      }
      case 'flame': { // llamitas en la cabeza y brasas
        const out = [], n = Math.round(1 + amt * 1.5);
        for (let i = 0; i < n; i++) { const x = cx - W * 0.35 + i * W * 0.32, y = top(x) + 3, h = 12 + R() * 6 + stage * 2; out.push(`<path d="M ${f(x - 5)} ${f(y)} Q ${f(x - 6)} ${f(y - h * 0.6)} ${f(x + 1)} ${f(y - h)} Q ${f(x - 1)} ${f(y - h * 0.5)} ${f(x + 5)} ${f(y - h * 0.65)} Q ${f(x + 7)} ${f(y - h * 0.2)} ${f(x + 5)} ${f(y)} Z" fill="#fb923c" ${STROKE('#9a3412', 1.5)}/><path d="M ${f(x - 2)} ${f(y)} Q ${f(x - 2)} ${f(y - h * 0.4)} ${f(x + 1)} ${f(y - h * 0.6)} Q ${f(x + 3)} ${f(y - h * 0.3)} ${f(x + 2.5)} ${f(y)} Z" fill="#fde047"/>`); }
        return { back: out.join(''), clip: [0, 1, 2, 3].map(() => `<circle cx="${f(cx - W * 0.2 + R() * W * 1.1)}" cy="${f(cy - H * 0.1 + R() * H * 0.8)}" r="${f(1.2 + R() * 1.3)}" fill="#fde68a" opacity=".75"/>`).join('') };
      }
      case 'scales': { // escamas en la espalda y brillo húmedo
        let sc = '';
        for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = cx + W * 0.05 + c * 6 + (r % 2) * 3, y = cy - H * 0.75 + r * 6.5; sc += `<path d="M ${f(x - 3.5)} ${f(y)} q 3.5 4.5 7 0" fill="none" stroke="${shade(skin, -0.3)}" stroke-width="1.2" opacity=".6"/>`; }
        return { back: '', clip: sc + `<path d="M ${f(cx - W * 0.7)} ${f(cy - H * 0.55)} q ${f(W * 0.3)} ${f(-H * 0.3)} ${f(W * 0.7)} ${f(-H * 0.25)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>` };
      }
      case 'moss': { // musgo arriba y piedrecitas
        const pts = []; for (let i = 0; i <= 10; i++) { const x = cx - W * 1.1 + i * W * 0.22; pts.push(`${f(x)} ${f(cy - H * 0.66 + (i % 2 ? 4 : 0) + R() * 3)}`); }
        const moss = `<path d="M ${f(cx - W * 1.2)} ${f(cy - H * 1.3)} L ${pts.join(' L ')} L ${f(cx + W * 1.2)} ${f(cy - H * 1.3)} Z" fill="#4d7c0f" opacity=".85"/>`;
        const stones = [0, 1, 2].map((i) => `<ellipse cx="${f(cx + W * (0.15 + i * 0.25))}" cy="${f(cy + H * (-0.05 + (i % 2) * 0.3))}" rx="${f(3.4 + R() * 2)}" ry="${f(2.6 + R())}" fill="#a8a29e" stroke="#57534e" stroke-width="1.1"/>`).join('');
        return { back: '', clip: moss + stones };
      }
      default: return { back: '', clip: '' };
    }
  }

  function wingsSvg(ind, P) {
    const { cx, cy, W, H, skin, dk, house, s } = P, x = cx + W * 0.2, y = cy - H * 0.55, k = s * 1.05;
    switch (HOUSES[house].wing) {
      case 'feather': return [0, 1].map((i) => `<path d="M ${f(x - i * 6)} ${f(y + 6)} Q ${f(x + 18 * k)} ${f(y - 30 * k)} ${f(x + 34 * k - i * 8)} ${f(y - 20 * k + i * 4)} Q ${f(x + 26 * k)} ${f(y - 10 * k)} ${f(x + 30 * k - i * 6)} ${f(y - 4 * k)} Q ${f(x + 20 * k)} ${f(y)} ${f(x + 24 * k - i * 4)} ${f(y + 8 * k)} Q ${f(x + 10)} ${f(y + 8)} ${f(x - i * 6)} ${f(y + 6)} Z" fill="${i ? '#fff7dc' : '#fffdf5'}" ${STROKE(dk, 1.8)}/>`).join('');
      case 'bat': return `<path d="M ${f(x)} ${f(y + 6)} L ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 34 * k)} ${f(y - 16 * k)} Q ${f(x + 28 * k)} ${f(y - 6 * k)} ${f(x + 30 * k)} ${f(y + 2 * k)} Q ${f(x + 22 * k)} ${f(y - 2 * k)} ${f(x + 20 * k)} ${f(y + 8 * k)} Q ${f(x + 12 * k)} ${f(y + 2 * k)} ${f(x + 6)} ${f(y + 10)} Z" fill="${shade(skin, -0.35)}" ${STROKE(dk, 1.8)}/><path d="M ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 20 * k)} ${f(y + 8 * k)} M ${f(x + 12 * k)} ${f(y - 24 * k)} L ${f(x + 30 * k)} ${f(y + 2 * k)}" stroke="${dk}" stroke-width="1.1" opacity=".6"/>`;
      case 'fin': return `<path d="M ${f(x)} ${f(y + 8)} Q ${f(x + 10 * k)} ${f(y - 26 * k)} ${f(x + 32 * k)} ${f(y - 18 * k)} Q ${f(x + 22 * k)} ${f(y - 4 * k)} ${f(x + 26 * k)} ${f(y + 8 * k)} Q ${f(x + 14 * k)} ${f(y + 2)} ${f(x)} ${f(y + 8)} Z" fill="${shade(skin, 0.35)}" opacity=".95" ${STROKE(dk, 1.8)}/>` + [0, 1, 2].map((i) => `<path d="M ${f(x + 3)} ${f(y + 6)} L ${f(x + (16 + i * 6) * k)} ${f(y - (18 - i * 7) * k)}" stroke="${dk}" stroke-width=".9" opacity=".45"/>`).join('');
      case 'crystal': return [[0.0, 20, -10], [0.3, 26, 6], [0.6, 18, 18]].map(([o, h, r]) => { const xx = cx + W * o, yy = P.top(xx) + 4; return `<path d="M ${f(xx - 5)} ${f(yy)} L ${f(xx - 1 + r * 0.15)} ${f(yy - h * k)} L ${f(xx + 5)} ${f(yy)} Z" fill="#a5f3fc" ${STROKE('#0e7490', 1.6)}/><path d="M ${f(xx - 1 + r * 0.15)} ${f(yy - h * k)} L ${f(xx + 0.5)} ${f(yy)}" stroke="#fff" stroke-width="1" opacity=".7"/>`; }).join('');
      default: return '';
    }
  }

  function tailSvg(tail, P) {
    const { cx, cy, W, H, skin, inner, dk, s, kind } = P, x = cx + W * (kind === 'long' ? 1.75 : 0.88), y = cy + H * (kind === 'long' ? 0.35 : 0.2), k = s;
    switch (tail) {
      case 'orb': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 12 * k)} ${f(y - 2)} ${f(x + 14 * k)} ${f(y - 18 * k)}" fill="none" stroke="${dk}" stroke-width="${f(6.5 * k)}" stroke-linecap="round"/><path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 12 * k)} ${f(y - 2)} ${f(x + 14 * k)} ${f(y - 18 * k)}" fill="none" stroke="${skin}" stroke-width="${f(3.8 * k)}" stroke-linecap="round"/><circle cx="${f(x + 14 * k)}" cy="${f(y - 21 * k)}" r="${f(6.5 * k)}" fill="#fff6c2" opacity=".5"/><circle cx="${f(x + 14 * k)}" cy="${f(y - 21 * k)}" r="${f(4.4 * k)}" fill="#fffbe8" ${STROKE(dk, 1.6)}/>`;
      case 'curl': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 18 * k)} ${f(y + 2)} ${f(x + 16 * k)} ${f(y - 16 * k)} Q ${f(x + 14 * k)} ${f(y - 26 * k)} ${f(x + 6 * k)} ${f(y - 20 * k)} Q ${f(x + 2 * k)} ${f(y - 14 * k)} ${f(x + 9 * k)} ${f(y - 12 * k)}" fill="none" stroke="${dk}" stroke-width="${f(7 * k)}" stroke-linecap="round"/><path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 18 * k)} ${f(y + 2)} ${f(x + 16 * k)} ${f(y - 16 * k)} Q ${f(x + 14 * k)} ${f(y - 26 * k)} ${f(x + 6 * k)} ${f(y - 20 * k)} Q ${f(x + 2 * k)} ${f(y - 14 * k)} ${f(x + 9 * k)} ${f(y - 12 * k)}" fill="none" stroke="${skin}" stroke-width="${f(4.2 * k)}" stroke-linecap="round"/>`;
      case 'flame': return `<path d="M ${f(x - 5)} ${f(y + 4)} Q ${f(x + 10 * k)} ${f(y + 2)} ${f(x + 12 * k)} ${f(y - 6 * k)}" fill="none" stroke="${skin}" stroke-width="${f(5 * k)}" stroke-linecap="round"/><path d="M ${f(x + 6 * k)} ${f(y - 2 * k)} Q ${f(x + 2 * k)} ${f(y - 18 * k)} ${f(x + 14 * k)} ${f(y - 30 * k)} Q ${f(x + 14 * k)} ${f(y - 20 * k)} ${f(x + 22 * k)} ${f(y - 18 * k)} Q ${f(x + 24 * k)} ${f(y - 4 * k)} ${f(x + 6 * k)} ${f(y - 2 * k)} Z" fill="#fb923c" ${STROKE('#9a3412', 1.6)}/><path d="M ${f(x + 9 * k)} ${f(y - 4 * k)} Q ${f(x + 8 * k)} ${f(y - 14 * k)} ${f(x + 15 * k)} ${f(y - 20 * k)} Q ${f(x + 19 * k)} ${f(y - 9 * k)} ${f(x + 9 * k)} ${f(y - 4 * k)} Z" fill="#fde047"/>`;
      case 'fin': return `<path d="M ${f(x - 5)} ${f(y + 2)} Q ${f(x + 8 * k)} ${f(y)} ${f(x + 12 * k)} ${f(y - 4 * k)} L ${f(x + 24 * k)} ${f(y - 16 * k)} Q ${f(x + 20 * k)} ${f(y - 2 * k)} ${f(x + 25 * k)} ${f(y + 10 * k)} L ${f(x + 12 * k)} ${f(y + 2 * k)} Q ${f(x + 4 * k)} ${f(y + 8 * k)} ${f(x - 5)} ${f(y + 6)} Z" fill="${inner}" ${STROKE(dk, 1.8)}/>`;
      case 'spike': return `<path d="M ${f(x - 5)} ${f(y - 4)} Q ${f(x + 14 * k)} ${f(y - 6 * k)} ${f(x + 22 * k)} ${f(y - 12 * k)} Q ${f(x + 16 * k)} ${f(y + 2 * k)} ${f(x - 5)} ${f(y + 6)} Z" fill="${skin}" ${STROKE(dk, 1.8)}/>` + [0, 1, 2].map((i) => `<path d="M ${f(x + (2 + i * 6) * k)} ${f(y - (3 + i * 2.5) * k)} l ${f(2 * k)} ${f(-7 * k)} l ${f(3 * k)} ${f(6 * k)} Z" fill="#e7e5e4" ${STROKE(dk, 1.2)}/>`).join('');
      case 'leaf': return `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 10 * k)} ${f(y)} ${f(x + 12 * k)} ${f(y - 8 * k)}" fill="none" stroke="#3f6212" stroke-width="${f(3 * k)}" stroke-linecap="round"/><path d="M ${f(x + 12 * k)} ${f(y - 8 * k)} Q ${f(x + 4 * k)} ${f(y - 26 * k)} ${f(x + 24 * k)} ${f(y - 30 * k)} Q ${f(x + 28 * k)} ${f(y - 12 * k)} ${f(x + 12 * k)} ${f(y - 8 * k)} Z" fill="#84cc16" ${STROKE('#365314', 1.6)}/><path d="M ${f(x + 12 * k)} ${f(y - 8 * k)} L ${f(x + 22 * k)} ${f(y - 26 * k)}" stroke="#365314" stroke-width="1"/>`;
      default: return '';
    }
  }

  function markSvg(ind, P) {
    const { cx, cy, W, H, inner, dk } = P, x = cx + W * 0.28, y = cy - H * 0.18;
    switch (ind.mark) {
      case 'star': return star(x, y, 5.5, 2.4, inner);
      case 'moon': return `<path d="M ${f(x + 2)} ${f(y - 5.5)} A 5.5 5.5 0 1 0 ${f(x + 2)} ${f(y + 5.5)} A 4.2 4.2 0 1 1 ${f(x + 2)} ${f(y - 5.5)} Z" fill="${inner}"/>`;
      case 'heart': return `<path d="M ${f(x)} ${f(y + 4.5)} C ${f(x - 8)} ${f(y - 1)} ${f(x - 4)} ${f(y - 7)} ${f(x)} ${f(y - 3)} C ${f(x + 4)} ${f(y - 7)} ${f(x + 8)} ${f(y - 1)} ${f(x)} ${f(y + 4.5)} Z" fill="#f472b6"/>`;
      case 'spots': return [[0.35, -0.5, 3.6], [0.62, -0.1, 2.8], [0.2, 0.1, 2.2], [0.55, 0.35, 2]].map(([ox, oy, r]) => `<circle cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" r="${f(r)}" fill="${shade(P.skin, -0.25)}" opacity=".7"/>`).join('');
      case 'stripes': return [0, 1, 2].map((i) => `<path d="M ${f(cx + W * 0.2 + i * 7)} ${f(cy - H * 0.95)} q 4 ${f(H * 0.4)} 0 ${f(H * 0.75)}" fill="none" stroke="${shade(P.skin, -0.35)}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`).join('');
      case 'zigzag': return `<path d="M ${f(cx + W * 0.15)} ${f(cy - H * 0.55)} l 4 4 l 4 -4 l 4 4 l 4 -4 l 4 4" fill="none" stroke="${inner}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      case 'gem': return `<path d="M ${f(x)} ${f(y - 6)} L ${f(x + 5)} ${f(y)} L ${f(x)} ${f(y + 6)} L ${f(x - 5)} ${f(y)} Z" fill="#22d3ee" ${STROKE(dk, 1.3)}/><path d="M ${f(x - 2)} ${f(y - 2)} L ${f(x)} ${f(y - 4)}" stroke="#fff" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  function finalSvg(ind, P, layer) {
    const { cx, cy, W, H, dk, skin, top } = P;
    const hx = cx - W * 0.15, hy = top(hx);
    switch (ind.final) {
      case 'mane': if (layer !== 'back') return ''; return `<path d="${smooth(Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2, r = (i % 2 ? 1.0 : 1.22); return [cx - W * 0.25 + Math.cos(a) * W * 0.85 * r, cy - H * 0.2 + Math.sin(a) * H * 0.85 * r]; }))}" fill="${shade(skin, -0.3)}" ${STROKE(dk, 1.8)}/>`;
      case 'crown': if (layer !== 'front') return ''; return `<path d="M ${f(hx - 11)} ${f(hy + 3)} L ${f(hx - 12)} ${f(hy - 9)} L ${f(hx - 5.5)} ${f(hy - 3)} L ${f(hx)} ${f(hy - 13)} L ${f(hx + 5.5)} ${f(hy - 3)} L ${f(hx + 12)} ${f(hy - 9)} L ${f(hx + 11)} ${f(hy + 3)} Z" fill="#facc15" ${STROKE('#713f12', 1.6)}/><circle cx="${f(hx)}" cy="${f(hy - 2)}" r="2.3" fill="#ef4444"/>`;
      case 'halo': if (layer !== 'back') return ''; return `<ellipse cx="${f(hx)}" cy="${f(hy - 12)}" rx="13" ry="4" fill="none" stroke="#fde047" stroke-width="3"/><ellipse cx="${f(hx)}" cy="${f(hy - 12)}" rx="13" ry="4" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>`;
      case 'aura': if (layer !== 'back') return ''; return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(W * 1.55)}" ry="${f(H * 1.5)}" fill="url(#aura${P.id})"/>`;
      case 'gemstone': if (layer !== 'front') return ''; return `<path d="M ${f(cx - W * 0.2)} ${f(cy - H * 0.62)} l 5 -6 h 8 l 5 6 l -9 10 Z" fill="#c084fc" ${STROKE('#581c87', 1.5)}/><path d="M ${f(cx - W * 0.2 + 3)} ${f(cy - H * 0.62 - 3)} l 3 -2" stroke="#fff" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  let SEQ = 0;
  const GROWTH = [1, 1.16, 1.3, 1.4];
  const VIEW_SIDE = [96, 108, 122, 138]; // encuadre cuadrado por etapa (las primeras formas se ven más pequeñas)

  /**
   * Dibuja un individuo en una etapa visual (0..3).
   * o: { tail, final (¿forma final?), flip, shiny, focus ('eyes'|'mouth'|'ears'|'legs'|'mark'|'full'), plain (sin pelo/brazos/cola) }
   */
  function draw(ind, st, o = {}) {
    const id = 'lk' + (++SEQ), H_ = HOUSES[ind.house] || HOUSES.luz;
    const grow = GROWTH[st] * ind.size, s = clamp(0.85 + (grow - 1) * 0.55, 0.75, 1.25);
    const kind = ind.bodyFixed || (BODY_PATH[ind.body] || BODY_PATH.round)[st];
    const legKind = ind.legs === 'slither' ? 'none' : ind.legs === 'hover' ? 'hover' : (LEG_PATHS[ind.legs] ? LEG_PATHS[ind.legs][0][st] : ['stubby', 'paws', 'quad', 'quad'][st]);
    const Pm = PRESET[kind] || PRESET.round;
    const W = clamp(23 * grow * Pm.w, 16, 46), H = clamp(21 * grow * Pm.h, 15, 40);
    const groundY = 112, lift = LIFT[legKind] || 0;
    const cx = kind === 'long' ? 60 : 70, cy = groundY - H * (kind === 'ghost' ? 1.1 : 1) - lift - (kind === 'ghost' ? 6 : 0);
    const skin = o.shiny ? hue(ind.skin, 150) : ind.skin, dk = shade(skin, -0.58), inner = H_.belly, hornC = H_.horn;
    const top = (x) => { const u = clamp((x - cx) / W, -0.98, 0.98); return cy - H * Math.pow(1 - Math.pow(Math.abs(u), Pm.n || 2), 1 / (Pm.n || 2)) * (1 + (Pm.pear || 0) * -0.1); };
    const fx = cx - W * 0.3, er = clamp(W * 0.16, 3.6, 7) * ind.eyeScale;
    const ey = cy - H * 0.22, mx = fx + 0.5, my = ey + er * 1.6 + 2;
    const P = { id, cx, cy, W, H, skin, dk, inner, hornC, house: ind.house, stage: st, s, fx, ey, er, mx, my, top, groundY, kind };
    const body = bodyPath(kind, cx, cy, W, H, ind);
    const plain = !!o.plain;
    const fur = plain ? { back: '', clip: '' } : furSvg(ind, P);
    const wings = !plain && ind.winged && st >= ind.wingStage ? wingsSvg(ind, P) : '';
    const isFinal = !!o.final;
    const segs = kind === 'long' ? [[0.95, 0.66, 0.2], [1.45, 0.48, 0.38]].map(([ox, r, oy]) => `<ellipse cx="${f(cx + W * ox)}" cy="${f(cy + H * oy)}" rx="${f(H * r * 1.15)}" ry="${f(H * r)}" fill="url(#b${id})" ${STROKE(dk)}/><ellipse cx="${f(cx + W * ox - 2)}" cy="${f(cy + H * oy + H * r * 0.35)}" rx="${f(H * r * 0.6)}" ry="${f(H * r * 0.32)}" fill="${inner}" opacity=".8"/>`).reverse().join('') : '';
    const shadowRx = W * (legKind === 'hover' ? 0.7 : 1.05) * (kind === 'long' ? 1.6 : 1);
    const cheeks = ind.cheeks && !['glow', 'visor'].includes(ind.eyes) ? `<ellipse cx="${f(fx - er * 2.1)}" cy="${f(ey + er * 1.4)}" rx="${f(er * 0.75)}" ry="${f(er * 0.5)}" fill="#ff6b9a" opacity=".38"/><ellipse cx="${f(fx + er * 2.3)}" cy="${f(ey + er * 1.2)}" rx="${f(er * 0.7)}" ry="${f(er * 0.45)}" fill="#ff6b9a" opacity=".32"/>` : '';
    const belly = kind === 'ghost' ? '' : `<ellipse cx="${f(cx - W * 0.18)}" cy="${f(cy + H * 0.42)}" rx="${f(W * 0.58)}" ry="${f(H * 0.52)}" fill="${inner}" opacity=".9"/>`;
    // Encuadre: cuadrado por etapa, o un recorte para los iconos de rasgos
    let vb;
    const sq = (x, y, side) => [x - side / 2, y - side / 2, side, side];
    switch (o.focus) {
      case 'eyes': vb = sq(fx, ey, Math.max(er * 6.2, 24)); break;
      case 'mouth': vb = sq(mx, my + 1, Math.max(er * 4, 18)); break;
      case 'ears': vb = sq(cx - W * 0.12, cy - H * 0.92, W * 2.3); break;
      case 'legs': vb = sq(cx, groundY - 12, W * 2.6); break;
      case 'mark': vb = sq(cx + W * 0.25, cy - H * 0.2, W * 1.3); break;
      case 'full': { const side = Math.max(W, H) * 2.9; vb = [74 - side / 2, groundY + 6 - side, side, side]; break; }
      default: { const side = VIEW_SIDE[st]; vb = [76 - side / 2, 118 - side, side, side]; }
    }
    const flip = o.flip ? `transform="translate(${f(vb[0] * 2 + vb[2])} 0) scale(-1 1)"` : '';
    const sparkles = o.shiny ? `<g fill="#fff8b0">${star(vb[0] + vb[2] * 0.14, vb[1] + vb[3] * 0.2, 5, 1.6, '#fff8b0')}${star(vb[0] + vb[2] * 0.86, vb[1] + vb[3] * 0.12, 4, 1.3, '#fff8b0')}${star(vb[0] + vb[2] * 0.9, vb[1] + vb[3] * 0.62, 3.4, 1.1, '#fff8b0')}</g>` : '';
    return `<svg viewBox="${vb.map(f).join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img">` +
      `<defs><radialGradient id="b${id}" cx="34%" cy="26%" r="85%"><stop offset="0%" stop-color="${shade(skin, 0.42)}"/><stop offset="50%" stop-color="${skin}"/><stop offset="100%" stop-color="${shade(skin, -0.3)}"/></radialGradient>` +
      `<linearGradient id="ao${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/></linearGradient>` +
      `<radialGradient id="hl${id}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity=".55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="aura${id}"><stop offset="40%" stop-color="${H_.skins[0]}" stop-opacity=".0"/><stop offset="75%" stop-color="${H_.skins[0]}" stop-opacity=".35"/><stop offset="100%" stop-color="${H_.skins[0]}" stop-opacity="0"/></radialGradient>` +
      `<clipPath id="c${id}"><path d="${body}"/></clipPath></defs>` +
      `<g ${flip}><g class="sprite-body">` +
      (o.focus ? '' : `<ellipse class="sprite-shadow" cx="${f(cx + (kind === 'long' ? W * 0.5 : 0))}" cy="${groundY + 1}" rx="${f(shadowRx)}" ry="5" fill="#000" opacity="${legKind === 'hover' ? 0.12 : 0.22}"/>`) +
      (isFinal ? finalSvg(ind, P, 'back') : '') +
      `<g transform="rotate(${f(ind.lean * 10)} ${f(cx)} ${groundY})">` +
      (plain ? '' : tailSvg(o.tail, P)) + wings + fur.back + earsSvg(ind, P, false) + segs +
      legsSvg(legKind, P, 'far') + (plain ? '' : armSvg(ind, P, 'far')) +
      `<path d="${body}" fill="url(#b${id})"/>` +
      `<g clip-path="url(#c${id})">${belly}${fur.clip}${markSvg(ind, P)}<path d="${body}" fill="url(#ao${id})"/><ellipse cx="${f(cx - W * 0.35)}" cy="${f(cy - H * 0.55)}" rx="${f(W * 0.42)}" ry="${f(H * 0.28)}" fill="url(#hl${id})"/></g>` +
      `<path d="${body}" fill="none" ${STROKE(dk, 2.4)}/>` +
      legsSvg(legKind, P, 'near') + (plain ? '' : armSvg(ind, P, 'near')) + earsSvg(ind, P, true) +
      eyesSvg(ind, P) + cheeks + mouthSvg(ind, P) + (isFinal ? finalSvg(ind, P, 'front') : '') +
      `</g></g></g>${sparkles}</svg>`;
  }

  /* ======================= API del juego ======================= */
  const hash = (str) => { let x = 2166136261; for (const ch of String(str)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  const rootOf = (sid) => { let r = sid, i = 0; while (D.species[r] && D.species[r].evolvedFrom && i++ < 8) r = D.species[r].evolvedFrom; return r; };
  const lineOf = (sid) => { const out = []; for (let c = rootOf(sid), i = 0; c && i < 8; i++) { out.push(c); c = D.species[c].evolve && D.species[c].evolve.into; } return out; };
  const VIS = { 1: [1], 2: [0, 2], 3: [0, 1, 3], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 3] };
  /** Etapa visual de una especie dentro de su línea: { st, final } */
  function stageOf(sid) {
    const line = lineOf(sid), i = Math.max(0, line.indexOf(sid)), n = Math.min(5, line.length);
    return { st: (VIS[n] || VIS[4])[Math.min(i, 4)], final: n > 1 && i === line.length - 1, index: i, length: line.length };
  }
  const indCache = new Map();
  /** Individuo resuelto para una especie y una semilla (cacheado). */
  function ind(sid, look) {
    const sp = D.species[sid], root = rootOf(sid);
    const seed = look && look.s != null ? look.s >>> 0 : hash('typ:' + root);
    const key = root + ':' + seed;
    if (indCache.has(key)) return indCache.get(key);
    const r = roll(sp.house || 'luz', seed);
    // La especie fija su cola y, en algunas, el cuerpo (fantasmas, serpientes sin patas)
    const sprite = (D.species[root] && D.species[root].sprite) || sp.sprite || {};
    r.tail = sprite.tail || 'none';
    if (sprite.body === 'ghost') { r.body = 'ghost'; r.legs = 'hover'; }
    else if (sprite.body === 'long' && sprite.legs === 'none') { r.body = 'long'; r.legs = 'slither'; }
    if (indCache.size > 600) indCache.clear();
    indCache.set(key, r);
    return r;
  }
  /** Aspecto nuevo al nacer (los jefes: el típico). */
  function rollLook(sid, o = {}) { return o.boss ? null : { s: Math.floor(Math.random() * 4294967295) }; }
  /** Aspecto de un daskai (las partidas antiguas: sale fijo de su uid). */
  function lookOf(d) {
    if (!d) return null;
    if (d.boss) return null;
    if (!d.look) d.look = { s: hash('uid:' + (d.uid || d.species)) };
    return d.look;
  }
  /** SVG para la interfaz. */
  function svg(sid, look, { flip = false, shiny = false } = {}) {
    const g = stageOf(sid), i = ind(sid, look);
    return draw(i, g.st, { tail: i.tail, final: g.final, flip, shiny });
  }

  /* ---------- Pixel art (bordes duros, pocos colores, contorno) ---------- */
  const PAD = 0.25, PIX_H = 64, PIX_W = Math.round(PIX_H * (1 + PAD * 2)), LEVELS = 8;
  const pxCache = new Map(), pxPending = new Map();
  const pxKey = (sid, look, shiny) => sid + ':' + (look && look.s != null ? look.s : 't') + (shiny ? '*' : '');
  function pixelCached(sid, look, { shiny = false } = {}) { return pxCache.get(pxKey(sid, look, shiny)) || null; }
  function pixel(sid, look, { shiny = false } = {}) {
    const key = pxKey(sid, look, shiny);
    if (pxCache.has(key)) return Promise.resolve(pxCache.get(key));
    if (pxPending.has(key)) return pxPending.get(key);
    let text = svg(sid, look, { shiny });
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(text);
    const [x, y, w, hh] = m.slice(1).map(Number);
    text = text.replace(m[0], `viewBox="${f(x - w * PAD)} ${f(y)} ${f(w * (1 + PAD * 2))} ${f(hh)}" width="${PIX_W}" height="${PIX_H}"`);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = PIX_W; c.height = PIX_H;
          const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, PIX_W, PIX_H);
          const data = ctx.getImageData(0, 0, PIX_W, PIX_H), px = data.data, step = 255 / (LEVELS - 1), solid = new Uint8Array(PIX_W * PIX_H);
          for (let i = 0; i < px.length; i += 4) {
            const a = px[i + 3], dark = px[i] + px[i + 1] + px[i + 2] < 90;
            if (a >= 120) { for (let k = 0; k < 3; k++) px[i + k] = Math.round(Math.round(px[i + k] / step) * step); px[i + 3] = 255; solid[i / 4] = 1; }
            else if (a >= 25 && dark) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 70; } else px[i + 3] = 0;
          }
          for (let yy = 0; yy < PIX_H; yy++) for (let xx = 0; xx < PIX_W; xx++) {
            const j = yy * PIX_W + xx; if (solid[j]) continue;
            if ((xx > 0 && solid[j - 1]) || (xx < PIX_W - 1 && solid[j + 1]) || (yy > 0 && solid[j - PIX_W]) || (yy < PIX_H - 1 && solid[j + PIX_W])) { const i = j * 4; px[i] = 12; px[i + 1] = 9; px[i + 2] = 22; px[i + 3] = 255; }
          }
          ctx.putImageData(data, 0, 0);
          const url = c.toDataURL('image/png');
          if (pxCache.size > 400) pxCache.delete(pxCache.keys().next().value);
          pxCache.set(key, url); resolve(url);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    }).finally(() => pxPending.delete(key));
    pxPending.set(key, p);
    return p;
  }

  /* ---------- Rasgos: lista, iconos y colección del Códice ---------- */
  const CATS = { body: BODIES, legs: Object.fromEntries(Object.entries(LEG_PATHS).map(([k, v]) => [k, v[1]])), eyes: EYES, mouth: MOUTHS, ears: EARS, mark: MARKS, final: FINALS };
  const CAT_ICON = { size: 'maximize', body: 'paw', legs: 'footprints', eyes: 'eye', mouth: 'smile', ears: 'sparkles', mark: 'star', wings: 'feather', final: 'crown' };
  const sizeKey = (z) => (z < 0.86 ? 'xs' : z < 0.95 ? 's' : z <= 1.06 ? 'm' : z <= 1.15 ? 'l' : 'xl');
  /** Rasgos de un individuo, para pintarlos como iconos. */
  function traits(i) {
    const out = [{ cat: 'size', key: sizeKey(i.size), rare: i.size > 1.18 || i.size < 0.82 }];
    ['body', 'legs', 'eyes', 'mouth', 'ears', 'mark', 'final'].forEach((cat) => {
      const key = cat === 'body' ? i.body : i[cat];
      if ((cat === 'mark' || cat === 'final') && key === 'none') return;
      if (cat === 'legs' && (key === 'slither' || (key === 'hover' && i.body === 'ghost'))) return;
      out.push({ cat, key, rare: rare(CATS[cat] || {}, key) });
    });
    if (i.winged) out.push({ cat: 'wings', key: String(i.wingStage), rare: false });
    return out;
  }
  // Modelo neutro para dibujar un rasgo suelto
  const TEMPLATE = { house: 'luz', seed: 1, skin: '#d9c3a5', size: 1, body: 'round', legs: 'stubby', eyes: 'big', mouth: 'w', ears: 'none', mark: 'none', final: 'none', eyeColor: '#1b1b2f', eyeScale: 1, earScale: 1, armScale: 1, winged: false, wingStage: 2, cheeks: true, furAmt: 0.5, wob: 1, lean: 0 };
  const iconCache = new Map();
  /** Icono (SVG) de un rasgo. o.house/o.skin para teñirlo como su dueño. */
  function icon(cat, key, o = {}) {
    const ck = [cat, key, o.house, o.skin].join('|');
    if (iconCache.has(ck)) return iconCache.get(ck);
    const t = Object.assign({}, TEMPLATE, o.house ? { house: o.house } : null, o.skin ? { skin: o.skin } : null);
    let out;
    switch (cat) {
      case 'eyes': out = draw(Object.assign(t, { eyes: key, eyeColor: ['glow', 'visor'].includes(key) ? '#22d3ee' : t.eyeColor }), 1, { focus: 'eyes', plain: true }); break;
      case 'mouth': out = draw(Object.assign(t, { mouth: key, eyes: 'dot', eyeScale: 0.6, cheeks: false }), 1, { focus: 'mouth', plain: true }); break;
      case 'ears': out = draw(Object.assign(t, { ears: key, eyes: 'dot' }), 1, { focus: 'ears', plain: true }); break;
      case 'mark': out = draw(Object.assign(t, { mark: key, eyes: 'dot' }), 1, { focus: 'mark', plain: true }); break;
      case 'legs': out = draw(Object.assign(t, { legs: key, eyes: 'dot' }), key === 'bird' ? 0 : 2, { focus: 'legs', plain: true }); break;
      case 'body': out = draw(Object.assign(t, { body: key, bodyFixed: key, eyes: 'dot', legs: key === 'ghost' ? 'hover' : 'stubby' }), 1, { focus: 'full', plain: true }); break;
      case 'final': out = draw(Object.assign(t, { final: key, eyes: 'dot' }), 3, { focus: 'full', plain: true, final: true }); break;
      case 'wings': out = draw(Object.assign(t, { winged: true, wingStage: 0, eyes: 'dot', house: o.house || 'luz' }), 2, { focus: 'full' }); break;
      case 'size': { const z = { xs: 0.45, s: 0.6, m: 0.75, l: 0.88, xl: 1 }[key] || 0.75; out = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 22h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/><ellipse cx="12" cy="${f(21 - 9 * z)}" rx="${f(10 * z)}" ry="${f(9 * z)}" fill="currentColor" opacity=".85"/><circle cx="${f(12 - 4 * z)}" cy="${f(19 - 11 * z)}" r="${f(1.3 * z + 0.5)}" fill="#0b0a12"/></svg>`; break; }
      default: out = '';
    }
    iconCache.set(ck, out);
    return out;
  }
  /** Todas las claves de una categoría (para la colección del Códice). */
  const allKeys = (cat) => Object.keys(CATS[cat] || {}).filter((k) => !(cat === 'mark' || cat === 'final') || k !== 'none');

  /* ---------- Códice: variantes vistas y rasgos descubiertos ---------- */
  const MAX_SEEN = 18;
  const book = () => { const s = DK.store.state; s.looks = s.looks || { seen: {}, traits: {} }; return s.looks; };
  /** Apunta un daskai visto (en combate, reclutado, tuyo). */
  function see(d) {
    if (!d || !DK.store.state || !D.species[d.species]) return;
    const lk = lookOf(d), b = book(), root = rootOf(d.species);
    if (lk) { const arr = (b.seen[root] = b.seen[root] || []); if (!arr.includes(lk.s)) { arr.unshift(lk.s); if (arr.length > MAX_SEEN) arr.length = MAX_SEEN; } b.count = b.count || {}; b.count[root] = (b.count[root] || 0) + (arr[0] === lk.s ? 1 : 0); }
    traits(ind(d.species, lk)).forEach(({ cat, key }) => { if (cat === 'size' || cat === 'wings') return; const t = (b.traits[cat] = b.traits[cat] || {}); t[key] = (t[key] || 0) + 1; });
  }
  const seenOf = (sid) => { const b = DK.store.state && DK.store.state.looks; return (b && b.seen[rootOf(sid)]) || []; };
  const traitSeen = (cat, key) => { const b = DK.store.state && DK.store.state.looks; return !!(b && b.traits[cat] && b.traits[cat][key]); };
  function collection() {
    const cats = ['body', 'legs', 'eyes', 'mouth', 'ears', 'mark', 'final'];
    const list = cats.map((cat) => ({ cat, keys: allKeys(cat).map((key) => ({ key, seen: traitSeen(cat, key), rare: rare(CATS[cat], key) })) }));
    const total = list.reduce((a, c) => a + c.keys.length, 0), got = list.reduce((a, c) => a + c.keys.filter((k) => k.seen).length, 0);
    return { list, total, got };
  }
  /** Texto del rasgo para el tooltip: «Ojos: de gato». */
  function label(cat, key) {
    const t = DK.t;
    if (cat === 'wings') return t('look.cat.wings');
    return `${t('look.cat.' + cat)}: ${t(`look.${cat}.${key}`)}`;
  }

  DK.looks = {
    svg, pixel, pixelCached, ind, stageOf, lineOf, rootOf, rollLook, of: lookOf, see, seenOf, traitSeen, collection, traits, icon, label,
    typical: (sid) => ind(sid, null), houses: HOUSES, catIcon: CAT_ICON, allKeys, draw, hash,
    /** Para pruebas: genera el aspecto de una casa con una semilla. */
    roll,
  };
})();
