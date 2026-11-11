/* =============================================================
 * components/pixelScene.js — v5.25: fondos por capas en pixel art (ajuste «Pixel art»).
 *
 *   DK.pixelScene.build('forest', ['#4ade80', '#14532d'], { boss })  → nodo .pxs con las capas
 *   DK.pixelScene.has('forest')                                       → ¿hay kit para esa escena?
 *
 * Inspirado en los fondos «por planos» de los metroidvania: cada escena se dibuja, píxel a píxel y sin
 * imágenes externas, en varias capas que se desplazan a distinta velocidad (paralaje):
 *   sky   cielo en bandas con tramado (dither), estrellas, luna/sol, auroras…   (quieto)
 *   far   siluetas lejanas, casi del color del cielo                             (muy lento)
 *   fog   bandas de niebla tramadas                                              (lento)
 *   mid   siluetas medias con luz de contorno arriba                             (medio)
 *   rays  haces de luz diagonales que «respiran»                                 (quieto)
 *   near  primer plano casi negro: hierba, rocas, raíces o estalactitas          (rápido)
 * Cada capa es una tira de TW×TH píxeles que encaja consigo misma por los lados, se escala sin suavizar
 * (alto = alto de la escena) y se mueve con transform (sin saltos: suave y por GPU). Ver css/pixel.css (.pxs).
 *
 * Para añadir una escena: escribe su kit en KITS (recibe la paleta P y las herramientas de dibujo).
 * Las capas generadas se guardan en caché por escena + colores + tema.
 * ============================================================= */
(function () {
  const TW = 400, TH = 200;           // tamaño de cada tira (se repite en horizontal)
  const HOR = 122;                    // línea del horizonte
  const cache = new Map();
  const remember = (k, v) => { cache.set(k, v); if (cache.size > 30) cache.delete(cache.keys().next().value); return v; };

  /* ---------- color ---------- */
  const rgb = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  /* ---------- azar con semilla ---------- */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hashStr = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  /* ---------- lienzo de píxeles que se repite en horizontal ---------- */
  function Layer() {
    const d = new Uint8ClampedArray(TW * TH * 4);
    const L = {
      d,
      set(x, y, c, a = 255) { x = Math.round(x); y = Math.round(y); if (y < 0 || y >= TH) return; x = ((x % TW) + TW) % TW; const i = (y * TW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; },
      alpha(x, y) { if (y < 0 || y >= TH) return 0; x = ((x % TW) + TW) % TW; return d[(y * TW + x) * 4 + 3]; },
      get(x, y) { x = ((x % TW) + TW) % TW; const i = (y * TW + x) * 4; return [d[i], d[i + 1], d[i + 2]]; },
      span(x, y0, y1, c, a) { for (let y = Math.max(0, Math.round(y0)); y <= Math.min(TH - 1, Math.round(y1)); y++) L.set(x, y, c, a); },
      rect(x, y, w, hh, c, a) { for (let i = 0; i < w; i++) L.span(x + i, y, y + hh - 1, c, a); },
      disc(cx, cy, r, c, a) { for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) { const w = Math.sqrt(Math.max(0, r * r - dy * dy)); for (let dx = -Math.round(w); dx <= Math.round(w); dx++) L.set(cx + dx, cy + dy, c, a); } },
      /** triángulo con la punta arriba (o abajo si hh < 0) */
      tri(cx, yb, w, hh, c, a) { const n = Math.abs(hh); for (let k = 0; k < n; k++) { const half = Math.round((w / 2) * (1 - k / n)); for (let dx = -half; dx <= half; dx++) L.set(cx + dx, hh > 0 ? yb - k : yb + k, c, a); } },
      line(x0, y0, x1, y1, c, t = 1, a) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; L.rect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c, a); } },
      /** relleno bajo (o sobre) una curva y(x) */
      below(yf, c) { for (let x = 0; x < TW; x++) L.span(x, yf(x), TH - 1, c); },
      above(yf, c) { for (let x = 0; x < TW; x++) L.span(x, 0, yf(x), c); },
      /** luz de contorno: los píxeles con hueco encima (o debajo) toman el color `c` */
      rim(c, rows = 1, from = 'top', c2) {
        const mark = [];
        for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
          if (!L.alpha(x, y) || L.d[(y * TW + x) * 4 + 3] < 255) continue;
          for (let k = 1; k <= rows; k++) { const yy = from === 'top' ? y - k : y + k; if (!L.alpha(x, yy)) { mark.push([x, y, k]); break; } }
        }
        mark.forEach(([x, y, k]) => L.set(x, y, k === 1 ? c : (c2 || c)));
      },
      /** tramado hacia un color en un rango de alturas (niebla que sube del suelo, sombra…) */
      shade(c, y0, y1, max = .7) {
        for (let y = Math.max(0, y0); y < Math.min(TH, y1); y++) { const t = (y - y0) / (y1 - y0) * max;
          for (let x = 0; x < TW; x++) { const i = (y * TW + x) * 4; if (d[i + 3] === 255 && bay(x, y) < t) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } } }
      },
      /** textura: motas de otro tono dentro de la silueta (sin tocar el borde) */
      speckle(c, R, n = 400) { for (let i = 0; i < n; i++) { const x = R() * TW | 0, y = R() * TH | 0; if (L.alpha(x, y) === 255 && L.alpha(x, y - 2) === 255 && L.alpha(x - 1, y) === 255 && L.alpha(x + 1, y) === 255) { L.set(x, y, c); if (R() < .5) L.set(x + 1, y, c); } } },
      /** v5.25b: versión suave (estilo sin pixel art): el doble de tamaño, suavizada y con desenfoque de profundidad.
       *  Se pinta tres veces (a los lados también) para que el desenfoque «dé la vuelta» y la tira siga encajando. */
      smoothUrl(blur) { const src = document.createElement('canvas'); src.width = TW; src.height = TH; src.getContext('2d').putImageData(new ImageData(d, TW, TH), 0, 0);
        const cv = document.createElement('canvas'); cv.width = TW * 2; cv.height = TH * 2; const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        if (blur) g.filter = `blur(${blur}px)`; for (const ox of [-1, 0, 1]) g.drawImage(src, ox * TW * 2, 0, TW * 2, TH * 2); return cv.toDataURL('image/png'); },
      url() { const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH; cv.getContext('2d').putImageData(new ImageData(d, TW, TH), 0, 0); return cv.toDataURL('image/png'); },
    };
    return L;
  }

  /* ---------- curvas que encajan por los lados (frecuencias enteras) ---------- */
  function ridge(R, base, amp, { waves = 4, jag = 0, sharp = false } = {}) {
    const ws = Array.from({ length: waves }, (_, i) => ({ k: 1 + i + Math.floor(R() * (i + 1)), a: amp / (i + 1.2), p: R() * 6.283 }));
    const cells = Math.ceil(TW / 3), nz = Array.from({ length: cells }, () => R());
    const noise = Array.from({ length: TW }, (_, x) => { const c = x / 3, i = Math.floor(c), f = c - i; return nz[i % cells] * (1 - f) + nz[(i + 1) % cells] * f; });
    return (x) => {
      let y = 0; for (const w of ws) { const s = Math.sin(2 * Math.PI * w.k * x / TW + w.p); y += w.a * (sharp ? 1 - 2 * Math.abs(s) : s); }
      return Math.round(base - y + (jag ? (noise[((x % TW) + TW) % TW] - .5) * jag : 0));
    };
  }

  /* ---------- objetos ---------- */
  const T = {
    pine(L, x, yb, hh, c, R) { const w = hh * .42; for (let k = 0; k < 3; k++) L.tri(x, yb - hh * k * .26, w * (1 - k * .22), hh * .48, c); L.rect(x - 1, yb - 2, 2, 4, c); },
    round(L, x, yb, hh, c, R) { L.rect(x - 1, yb - hh * .45, 3, hh * .45 + 2, c); const r = hh * .3; L.disc(x, yb - hh * .62, r, c); L.disc(x - r * .7, yb - hh * .5, r * .75, c); L.disc(x + r * .7, yb - hh * .52, r * .78, c); },
    dead(L, x, yb, hh, c, R, t = 2) {
      const grow = (x0, y0, ang, len, th, depth) => { const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len; L.line(x0, y0, x1, y1, c, th);
        if (depth > 0) { const n = 2 + (R() < .4 ? 1 : 0); for (let i = 0; i < n; i++) grow(x1, y1, ang + (R() - .5) * 1.4, len * (.55 + R() * .2), Math.max(1, th - 1), depth - 1); } };
      grow(x, yb, Math.PI / 2 + (R() - .5) * .25, hh * .45, t, 3);
    },
    cross(L, x, yb, c) { L.rect(x - 1, yb - 14, 2, 15, c); L.rect(x - 4, yb - 11, 8, 2, c); },
    tomb(L, x, yb, c) { L.rect(x - 4, yb - 8, 9, 9, c); L.disc(x, yb - 8, 4.5, c); },
    rock(L, x, yb, w, c, R) { const n = 3 + Math.floor(R() * 3); for (let i = 0; i < n; i++) L.disc(x + (R() - .5) * w, yb - R() * w * .25, w * (.25 + R() * .25), c); },
    tuft(L, x, yb, hh, c, R) { for (let i = -2; i <= 2; i++) L.line(x + i, yb, x + i * 2 + (R() - .5) * 2, yb - hh * (1 - Math.abs(i) * .22), c, 1); },
    column(L, x, yb, w, hh, c, broken, R) { L.rect(x - w / 2, yb - hh, w, hh, c); L.rect(x - w / 2 - 2, yb - 3, w + 4, 3, c);
      if (broken) { for (let i = 0; i < w; i++) L.span(x - w / 2 + i, yb - hh - 1 - Math.floor(R() * 6), yb - hh, c); } else L.rect(x - w / 2 - 2, yb - hh - 3, w + 4, 3, c); },
    arch(L, x, yb, w, hh, c, R) { const cw = Math.max(4, Math.round(w * .16)); T.column(L, x - w / 2, yb, cw, hh, c, false, R); T.column(L, x + w / 2, yb, cw, hh, c, false, R);
      const r0 = w / 2, cy = yb - hh; for (let dy = 0; dy <= r0 + cw; dy++) for (let dx = -r0 - cw; dx <= r0 + cw; dx++) { const r = Math.hypot(dx, dy); if (r <= r0 + cw / 2 + 1 && r >= r0 - cw / 2) L.set(x + dx, cy - dy, c); } },
    stalac(L, x, len, w, c) { L.tri(x, 0, w, -len, c); },
    stalag(L, x, yb, len, w, c) { L.tri(x, yb, w, len, c); },
    crystal(L, x, yb, hh, w, c, hi) { L.rect(x - w / 2, yb - hh * .7, w, hh * .7, c); L.tri(x, yb - hh * .7, w, hh * .3, c); if (hi) L.span(x - Math.floor(w / 2) + 1, yb - hh * .85, yb - 2, hi); },
    kelp(L, x, yb, hh, c, R) { const ph = R() * 6; for (let y = 0; y < hh; y++) { const xx = x + Math.sin(y * .12 + ph) * 3; L.rect(xx, yb - y, 2, 1, c); if (y % 9 === 4) L.line(xx, yb - y, xx + (y % 18 ? 4 : -4), yb - y - 3, c); } },
    coral(L, x, yb, hh, c, R) { const grow = (x0, y0, ang, len, d) => { const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len; L.line(x0, y0, x1, y1, c, 2); if (d) { grow(x1, y1, ang + .5 + R() * .3, len * .7, d - 1); grow(x1, y1, ang - .5 - R() * .3, len * .7, d - 1); } else L.disc(x1, y1, 1.5, c); }; grow(x, yb, Math.PI / 2, hh * .4, 2); },
    reed(L, x, yb, hh, c, R) { const lean = (R() - .5) * 4; L.line(x, yb, x + lean, yb - hh, c, 1); if (R() < .6) L.rect(Math.round(x + lean * .8) - 1, yb - hh * .9, 2, 5, c); },
    palm(L, x, yb, hh, c, R) { const bend = (R() < .5 ? -1 : 1) * hh * .3; let px = x, py = yb; for (let i = 1; i <= 8; i++) { const nx = x + bend * (i / 8) ** 2, ny = yb - hh * i / 8; L.line(px, py, nx, ny, c, 2); px = nx; py = ny; }
      for (let f = 0; f < 6; f++) { const a = f / 6 * 6.283; let fx = px, fy = py; for (let s = 1; s <= 6; s++) { const nx = px + Math.cos(a) * s * 3, ny = py + Math.sin(a) * s * 1.2 + s * s * .25; L.line(fx, fy, nx, ny, c, 1); fx = nx; fy = ny; } } },
    spike(L, x, yb, hh, w, c, hi) { L.tri(x, yb, w, hh, c); if (hi) for (let k = 0; k < hh * .8; k++) L.set(x - Math.round(w / 2 * (1 - k / hh)) + 1, yb - k, hi); },
    cloud(L, x, y, w, c, sh, a) { // cúmulo de discos con la base plana (y) y una franja de sombra debajo
      const n = Math.max(3, Math.round(w / 9)); for (let i = 0; i < n; i++) { const t = i / (n - 1), r = (w / n) * (.9 + Math.sin(t * 3.14) * 1.1), cx = x - w / 2 + t * w, cy = y - r * .55;
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) { if (cy + dy > y) break; const hw = Math.sqrt(Math.max(0, r * r - dy * dy)); for (let dx = -Math.round(hw); dx <= Math.round(hw); dx++) L.set(cx + dx, cy + dy, c, a); } }
      if (sh) for (let i = -w / 2 - 2; i < w / 2 + 2; i++) if (L.alpha(x + i, y)) L.span(x + i, y - 1, y, sh, a); },
    island(L, x, y, w, c, top, R) { const hh = w * .6; for (let i = -w / 2; i <= w / 2; i++) { const t = 1 - Math.abs(i) / (w / 2), depth = Math.round(hh * t ** 1.5 * (.7 + R() * .3)); L.span(x + i, y - 2, y + depth, c); L.set(x + i, y - 3, top); } },
  };

  /* ---------- capas genéricas ---------- */
  function sky(P, R, o = {}) {
    const L = Layer();
    for (let y = 0; y < TH; y++) { const t = Math.min(1, y / HOR); const lv = Math.floor(t * 10 + bay(0, y) * 0 + .0); for (let x = 0; x < TW; x++) { const q = Math.min(10, Math.floor(t * 10 + bay(x, y))); L.set(x, y, mix(P.top, P.hor, q / 10)); } void lv; }
    if (o.aurora) for (let b = 0; b < 3; b++) { const f = ridge(R, 26 + b * 10, 9, { waves: 3 }); for (let x = 0; x < TW; x++) { const y0 = f(x); for (let k = 0; k < 18; k++) { const lv = Math.floor((1 - k / 18) * 3) / 3; if (lv > 0 && y0 + k >= 0) L.set(x, y0 + k, mix(L.get(x, y0 + k), o.aurora[b % o.aurora.length], .32 * lv)); } } }
    if (o.stars) for (let i = 0; i < o.stars; i++) { const x = R() * TW | 0, y = R() * HOR * .8 | 0, c = mix(L.get(x, y), WHITE, .35 + R() * .5); L.set(x, y, c); if (R() < .08) { L.set(x + 1, y, mix(c, L.get(x + 1, y), .5)); L.set(x - 1, y, mix(c, L.get(x - 1, y), .5)); L.set(x, y + 1, mix(c, L.get(x, y + 1), .5)); L.set(x, y - 1, mix(c, L.get(x, y - 1), .5)); } }
    if (o.orb) { const { x, y, r, c } = o.orb; for (let k = 3; k >= 1; k--) for (let dy = -r - k * 4; dy <= r + k * 4; dy++) for (let dx = -r - k * 4; dx <= r + k * 4; dx++) { const d = Math.hypot(dx, dy); if (d <= r + k * 4 && bay(x + dx, y + dy) < .22 / k) L.set(x + dx, y + dy, mix(L.get(x + dx, y + dy), c, .35)); }
      L.disc(x, y, r, c); if (o.orb.moon) L.disc(x + r * .45, y - r * .25, r * .8, mix(P.top, P.hor, y / HOR)); else L.disc(x - r * .3, y - r * .3, r * .45, mix(c, WHITE, .4)); }
    return L;
  }
  function fog(P, R, y, hh, a = 110, c = P.fog) {
    const L = Layer(), f = ridge(R, 0, hh * .35, { waves: 3 });
    const g = ridge(R, 0, hh * .25, { waves: 4 });
    for (let x = 0; x < TW; x++) { const off = f(x), th = hh + g(x); for (let k = -th; k <= th; k++) { const t = 1 - Math.abs(k) / th, yy = y + k + off; const lv = Math.floor(t * 4) / 4; if (lv > 0) L.set(x, yy, c, Math.round(a * lv)); } }
    return L;
  }
  function rays(P, R, n = 4, c = P.light) {
    const L = Layer();
    for (let i = 0; i < n; i++) { const x0 = R() * TW, s = .35 + R() * .15, w = 8 + R() * 14, len = 110 + R() * 70;
      for (let y = 0; y < len; y++) for (let k = -w; k <= w; k++) { const x = Math.round(x0 + y * s + k), t = (1 - y / len) * (1 - Math.abs(k) / w); const lv = Math.floor(t * 3) / 3; if (lv > 0 && !L.alpha(x, y)) L.set(x, y, c, Math.round(64 * lv)); } }
    return L;
  }

  /* ---------- paleta a partir de los dos colores de la zona ---------- */
  function palette(colors, o) {
    const z1 = rgb(colors[0]), z2 = rgb(colors[1]), light = o.light;
    let top = light ? mix(z1, WHITE, .55) : mix(z2, [6, 5, 12], .62), hor = light ? mix(z1, WHITE, .2) : mix(mix(z1, z2, .5), [10, 8, 14], .3);
    if (o.boss) { top = mix(top, [40, 4, 6], .55); hor = mix(hor, [120, 24, 16], .45); }
    if (o.secret) { top = [12, 5, 22]; hor = [52, 20, 78]; }
    const ink = light ? mix(z2, BLACK, .35) : mix(z2, [4, 3, 8], .82);
    return {
      z1, z2, top, hor, ink,
      far: mix(hor, ink, light ? .3 : .22), far2: mix(hor, ink, light ? .45 : .42),
      mid: mix(hor, ink, light ? .68 : .66), near: mix(ink, BLACK, light ? .2 : .6),
      fog: mix(hor, WHITE, light ? .45 : .18), light: mix(z1, WHITE, .55),
      rimFar: mix(mix(hor, ink, .22), mix(z1, WHITE, .3), .35), rimMid: mix(mix(hor, ink, .66), mix(z1, WHITE, .2), .55),
      accent: o.secret ? [196, 120, 255] : o.boss ? [255, 96, 64] : mix(z1, WHITE, .25),
    };
  }

  /* ---------- kits por escena: devuelven { sky, far, fog, mid, rays, near } (capas o null) ---------- */
  const KITS = {
    meadow(P, R) {
      const far = Layer(); far.below(ridge(R, HOR - 6, 14, { waves: 3 }), P.far); far.rim(P.rimFar); far.shade(P.fog, HOR, TH, .5);
      const mid = Layer(); const g = ridge(R, HOR + 22, 8, { waves: 3 }); mid.below(g, P.mid);
      for (let i = 0; i < 5; i++) { const x = (i + R() * .6) * TW / 5 | 0; T.dead(mid, x, g(x), 46 + R() * 22, P.mid, R); }
      for (let i = 0; i < 9; i++) { const x = R() * TW | 0; (R() < .5 ? T.cross : T.tomb)(mid, x, g(x) + 1, P.mid); }
      mid.rim(P.rimMid); mid.speckle(mix(P.mid, P.ink, .4), R, 400);
      const near = Layer(); const n = ridge(R, TH - 7, 3, { waves: 4, jag: 2 }); near.below(n, P.near); for (let i = 0; i < 46; i++) { const x = R() * TW | 0; T.tuft(near, x, n(x), 5 + R() * 8, P.near, R); }
      return { sky: sky(P, R, { stars: 50, orb: { x: 300, y: 38, r: 9, c: mix(P.light, WHITE, .3), moon: true } }), far, fog: fog(P, R, HOR + 8, 9), mid, near };
    },
    forest(P, R) {
      const far = Layer(); const f = ridge(R, HOR - 2, 6, { waves: 3 }); far.below(f, P.far); for (let x = 0; x < TW; x += 5 + (R() * 6 | 0)) T.pine(far, x, f(x) + 2, 26 + R() * 26, P.far, R); far.shade(P.fog, HOR - 20, TH, .55);
      const mid = Layer(); const g = ridge(R, HOR + 30, 6, { waves: 3 }); mid.below(g, P.mid); for (let x = 0; x < TW; x += 14 + (R() * 16 | 0)) T.pine(mid, x, g(x) + 2, 60 + R() * 40, P.mid, R); mid.rim(P.rimMid);
      const near = Layer(); const n = ridge(R, TH - 6, 3, { waves: 4, jag: 2 }); near.below(n, P.near);
      for (let i = 0; i < 3; i++) { const x = (i + R() * .5) * TW / 3 | 0, w = 6 + (R() * 4 | 0); near.rect(x, 0, w, TH, P.near); near.span(x + w - 1, 0, TH, mix(P.near, P.rimMid, .35)); for (let k = 0; k < 4; k++) near.line(x + 3, 30 + R() * 120, x + (R() < .5 ? -14 : 20), 20 + R() * 120, P.near, 2); }
      for (let i = 0; i < 30; i++) { const x = R() * TW | 0; T.tuft(near, x, n(x), 4 + R() * 7, P.near, R); }
      for (let x = 0; x < TW; x += 3) if (R() < .5) near.span(x, 0, 3 + R() * 10, P.near); // hojas colgando
      return { sky: sky(P, R, { stars: 20 }), far, fog: fog(P, R, HOR + 4, 12, 120), mid, rays: rays(P, R, 4), near };
    },
    beach(P, R) {
      const s = sky(P, R, { orb: { x: 200, y: HOR - 30, r: 14, c: mix(P.accent, [255, 236, 170], .6) } });
      for (let y = HOR; y < TH; y++) for (let x = 0; x < TW; x++) { const t = (y - HOR) / (TH - HOR); s.set(x, y, mix(mix(P.z2, P.ink, .45), P.ink, Math.floor(t * 4 + bay(x, y)) / 4)); }
      for (let i = 0; i < 90; i++) { const y = HOR + 2 + (R() * (TH - HOR - 30) | 0), x = R() * TW | 0, w = 2 + R() * 7; const nearSun = Math.abs(x - 200) < 18; for (let k = 0; k < w; k++) s.set(x + k, y, mix(P.fog, P.accent, nearSun ? .7 : .1)); }
      const far = Layer(); for (let i = 0; i < 3; i++) T.cloud(far, R() * TW, 30 + R() * 50, 50 + R() * 40, mix(P.hor, WHITE, .25), mix(P.hor, P.top, .3), 230);
      const mid = Layer(); const g = ridge(R, TH - 34, 4, { waves: 2 }); mid.below(g, P.mid); for (let i = 0; i < 3; i++) { const x = R() * TW | 0; T.rock(mid, x, g(x) + 2, 26, P.mid, R); } for (let i = 0; i < 3; i++) { const x = R() * TW | 0; T.palm(mid, x, g(x), 50 + R() * 20, P.mid, R); } mid.rim(P.rimMid);
      const near = Layer(); const n = ridge(R, TH - 8, 4, { waves: 3 }); near.below(n, P.near); for (let i = 0; i < 18; i++) { const x = R() * TW | 0; T.tuft(near, x, n(x), 3 + R() * 5, P.near, R); }
      return { sky: s, far, fog: fog(P, R, HOR + 2, 5, 80), mid, near };
    },
    cave(P, R) {
      const glow = P.accent;
      const far = Layer(); far.above(ridge(R, 30, 10, { waves: 4, sharp: true, jag: 4 }), P.far); far.below(ridge(R, HOR, 12, { waves: 4, sharp: true, jag: 4 }), P.far);
      for (let i = 0; i < 6; i++) { const x = R() * TW | 0; T.crystal(far, x, HOR + 4, 10 + R() * 12, 4, mix(P.far, glow, .45)); } far.rim(P.rimFar);
      const mid = Layer(); for (let i = 0; i < 14; i++) T.stalac(mid, R() * TW | 0, 18 + R() * 40, 6 + R() * 10, P.mid); const g = ridge(R, HOR + 34, 6, { waves: 3, jag: 2 }); mid.below(g, P.mid);
      for (let i = 0; i < 8; i++) { const x = R() * TW | 0; T.stalag(mid, x, g(x) + 1, 18 + R() * 40, 8 + R() * 10, P.mid); } mid.rim(P.rimMid); mid.speckle(mix(P.mid, P.ink, .45), R, 600);
      for (let i = 0; i < 7; i++) { const x = R() * TW | 0, y = g(x); T.crystal(mid, x, y + 2, 12 + R() * 14, 5, mix(P.mid, glow, .75), mix(glow, WHITE, .5)); for (let k = 0; k < 40; k++) { const a = R() * 6.28, d = 4 + R() * 12; const xx = x + Math.cos(a) * d | 0, yy = y - 8 + Math.sin(a) * d | 0; if (!mid.alpha(xx, yy) && bay(xx, yy) < .5) mid.set(xx, yy, glow, 60); } }
      const near = Layer(); near.above(ridge(R, 6, 4, { waves: 4, jag: 3 }), P.near); for (let i = 0; i < 10; i++) T.stalac(near, R() * TW | 0, 10 + R() * 22, 5 + R() * 6, P.near); near.below(ridge(R, TH - 6, 4, { waves: 4, jag: 3 }), P.near);
      return { sky: sky(P, R, {}), far, fog: fog(P, R, HOR + 14, 10, 90), mid, near };
    },
    volcano(P, R) {
      const lava = [255, 120, 30], hot = [255, 196, 90];
      const s = sky(P, R, { stars: 0 });
      for (let i = 0; i < 5; i++) T.cloud(s, R() * TW, 26 + R() * 50, 60 + R() * 50, mix(P.top, [110, 30, 20], .45), mix(P.top, [160, 60, 30], .5), 255);
      const far = Layer(); const cx = 140, base = ridge(R, HOR + 2, 8);
      for (let y = 0; y < HOR; y++) for (let x = cx - 70; x <= cx + 70; x++) { const d = Math.hypot(x - cx, (y - HOR + 74) * 1.3), lv = Math.floor(Math.max(0, 1 - d / 70) * 4) / 4; if (lv > 0) s.set(x, y, mix(s.get(x, y), [255, 110, 40], .14 * lv)); } // resplandor del cráter
      far.below((x) => { const d = Math.min(Math.abs(x - cx), TW - Math.abs(x - cx)); return Math.min(base(x), d < 10 ? HOR - 70 : HOR - 70 + (d - 10) * .85); }, P.far2);
      for (let k = -10; k <= 10; k++) far.span(cx + k, HOR - 71, HOR - 69, mix(lava, P.far2, .2));
      for (let s2 = 0; s2 < 3; s2++) { let x = cx - 6 + s2 * 6; for (let y = HOR - 68; y < HOR + 4; y += 2) { x += (R() - .5) * 3 + (s2 - 1) * .8; far.rect(x, y, 2, 2, mix(lava, P.far2, .15 + (y - HOR + 68) / 110)); } }
      for (let i = 0; i < 7; i++) { const y = HOR - 82 - i * 11, r = 6 + i * 2.2; T.cloud(far, cx + Math.sin(i * 1.3) * 6 + i * 3, y, r * 2.2, mix(P.far2, [120, 60, 50], .5 - i * .05), null, 210 - i * 22); }
      far.rim(mix(P.rimFar, lava, .3));
      const mid = Layer(); const g = ridge(R, HOR + 30, 16, { waves: 4, sharp: true, jag: 4 }); mid.below(g, P.mid); mid.rim(mix(P.mid, lava, .7), 2, 'top', mix(P.mid, lava, .35)); mid.speckle(mix(P.mid, P.ink, .5), R, 700); mid.speckle(mix(P.mid, lava, .25), R, 120);
      for (let i = 0; i < 4; i++) { let x = R() * TW | 0; for (let y = g(x) + 3; y < TH; y += 2) { x += (R() - .5) * 3; mid.rect(x, y, 2, 2, mix(lava, P.mid, (y - HOR) / 120)); } }
      const near = Layer(); const n = ridge(R, TH - 8, 5, { waves: 4, sharp: true, jag: 3 }); near.below(n, P.near); near.rim(mix(P.near, lava, .5));
      return { sky: s, far, fog: fog(P, R, HOR + 6, 10, 90, mix(P.hor, lava, .35)), mid, near };
    },
    temple(P, R) {
      const far = Layer(); const f = ridge(R, HOR + 4, 5, { waves: 2 }); far.below(f, P.far);
      for (let i = 0; i < 4; i++) { const x = (i + .5) * TW / 4 + (R() - .5) * 30 | 0; T.arch(far, x, f(x), 30 + R() * 14, 34 + R() * 18, P.far, R); }
      for (let i = 0; i < 6; i++) { const x = R() * TW | 0; T.column(far, x, f(x), 5, 30 + R() * 30, P.far, R() < .6, R); } far.rim(P.rimFar); far.shade(P.fog, HOR - 10, TH, .5);
      const mid = Layer(); const g = ridge(R, HOR + 34, 4, { waves: 2 }); mid.below(g, P.mid);
      for (let i = 0; i < 5; i++) { const x = (i + R() * .5) * TW / 5 | 0, hh = 40 + R() * 50 | 0; T.column(mid, x, g(x), 10, hh, P.mid, R() < .5, R);
        for (const fx of [-3, 0, 3]) mid.span(x + fx, g(x) - hh + 3, g(x) - 5, mix(P.mid, P.ink, .45)); } // estrías
      for (let i = 0; i < 6; i++) { const x = R() * TW | 0; mid.rect(x, g(x) - 5, 8 + R() * 8, 6, P.mid); } mid.rim(mix(P.rimMid, [253, 230, 138], .3)); mid.speckle(mix(P.mid, P.ink, .4), R, 500);
      const near = Layer(); const n = ridge(R, TH - 7, 3, { waves: 3 }); near.below(n, P.near); for (let i = 0; i < 10; i++) { const x = R() * TW | 0; T.rock(near, x, n(x) + 2, 10, P.near, R); }
      for (let i = 0; i < 6; i++) { const x = R() * TW | 0; let y = 0; for (let k = 0; k < 30 + R() * 30; k++) { near.set(x + Math.round(Math.sin(k * .3) * 2), y++, P.near); } } // enredaderas
      return { sky: sky(P, R, { stars: 30, orb: { x: 90, y: 40, r: 11, c: mix(P.accent, [255, 230, 160], .5) } }), far, fog: fog(P, R, HOR + 10, 8, 90), mid, rays: rays(P, R, 3, mix(P.light, [255, 230, 160], .5)), near };
    },
    abyss(P, R) {
      const s = sky(P, R, {});
      const far = Layer(); const f = ridge(R, HOR + 10, 20, { waves: 4, sharp: true, jag: 3 }); far.below(f, P.far); for (let i = 0; i < 10; i++) { const x = R() * TW | 0; T.kelp(far, x, f(x), 40 + R() * 40, P.far, R); } far.shade(P.fog, HOR - 30, TH, .4);
      const mid = Layer(); const g = ridge(R, HOR + 40, 8, { waves: 3, jag: 2 }); mid.below(g, P.mid); for (let i = 0; i < 8; i++) { const x = R() * TW | 0; T.coral(mid, x, g(x), 30 + R() * 30, P.mid, R); } for (let i = 0; i < 8; i++) { const x = R() * TW | 0; T.kelp(mid, x, g(x), 50 + R() * 50, P.mid, R); }
      mid.rim(P.rimMid); for (let i = 0; i < 16; i++) { const x = R() * TW | 0, y = g(x) - (R() * 40 | 0); if (mid.alpha(x, y)) mid.set(x, y, P.accent); }
      const near = Layer(); const n = ridge(R, TH - 6, 4, { waves: 3, jag: 3 }); near.below(n, P.near); for (let i = 0; i < 7; i++) { const x = R() * TW | 0; T.kelp(near, x, n(x), 30 + R() * 50, P.near, R); }
      return { sky: s, far, fog: fog(P, R, HOR - 20, 14, 70), mid, rays: rays(P, R, 5), near };
    },
    sky(P, R) {
      const far = Layer(); for (let i = 0; i < 5; i++) T.cloud(far, R() * TW, 40 + R() * 70, 50 + R() * 60, mix(P.hor, WHITE, .3), mix(P.hor, P.top, .25), 255);
      const mid = Layer(); for (let i = 0; i < 3; i++) { const x = (i + R() * .5) * TW / 3 | 0, y = 70 + R() * 50 | 0, w = 40 + R() * 30 | 0; T.island(mid, x, y, w, P.mid, P.rimMid, R); for (let k = 0; k < 2; k++) T.round(mid, x + (R() - .5) * w * .6, y - 2, 14 + R() * 8, P.mid, R); }
      mid.rim(P.rimMid);
      const near = Layer(); for (let i = 0; i < 4; i++) T.cloud(near, R() * TW, TH - 8, 80 + R() * 60, mix(P.hor, WHITE, .55), null, 255);
      return { sky: sky(P, R, { stars: 0, orb: { x: 320, y: 40, r: 12, c: [255, 240, 200] } }), far, fog: fog(P, R, HOR + 20, 14, 110, mix(P.hor, WHITE, .5)), mid, near };
    },
    swamp(P, R) {
      const far = Layer(); const f = ridge(R, HOR, 6, { waves: 3 }); far.below(f, P.far); for (let i = 0; i < 9; i++) { const x = R() * TW | 0; T.dead(far, x, f(x), 30 + R() * 30, P.far, R, 1); } far.shade(P.fog, HOR - 30, TH, .6);
      const mid = Layer(); const g = ridge(R, HOR + 36, 3, { waves: 2 }); mid.below(g, P.mid);
      for (let i = 0; i < 5; i++) { const x = (i + R() * .5) * TW / 5 | 0; T.dead(mid, x, g(x), 50 + R() * 30, P.mid, R, 3); }
      const moss = Layer(); for (let x = 0; x < TW; x++) for (let y = 0; y < TH - 1; y++) if (mid.alpha(x, y) && !mid.alpha(x, y + 1) && y < g(x) - 20 && R() < .35) { const len = 3 + R() * 9; for (let k = 1; k <= len; k++) moss.set(x, y + k, P.mid); }
      for (let i = 0; i < TW * TH * 4; i += 4) if (moss.d[i + 3]) { mid.d.set(moss.d.subarray(i, i + 4), i); }
      for (let y = g(0) + 2; y < TH; y += 3) for (let x = 0; x < TW; x += 1) if (bay(x, y) < .15) mid.set(x, y, mix(P.mid, P.accent, .3));
      mid.rim(P.rimMid);
      const near = Layer(); const n = ridge(R, TH - 5, 2, { waves: 3 }); near.below(n, P.near); for (let i = 0; i < 40; i++) { const x = R() * TW | 0; T.reed(near, x, n(x), 12 + R() * 22, P.near, R); }
      return { sky: sky(P, R, { stars: 25, orb: { x: 260, y: 34, r: 8, c: mix(P.accent, WHITE, .4), moon: true } }), far, fog: fog(P, R, HOR + 14, 16, 130), mid, near };
    },
    glacier(P, R) {
      const ice = mix(P.z1, WHITE, .4);
      const far = Layer(); far.below(ridge(R, HOR - 10, 34, { waves: 5, sharp: true, jag: 2 }), P.far); far.rim(mix(P.rimFar, WHITE, .3), 2, 'top', P.rimFar); far.shade(P.fog, HOR - 10, TH, .5);
      const mid = Layer(); const g = ridge(R, HOR + 30, 6, { waves: 3 }); mid.below(g, P.mid); for (let i = 0; i < 9; i++) { const x = R() * TW | 0; T.spike(mid, x, g(x) + 1, 18 + R() * 40, 8 + R() * 10, P.mid, mix(P.mid, ice, .4)); } mid.rim(mix(P.rimMid, WHITE, .3)); mid.speckle(mix(P.mid, ice, .18), R, 500);
      const near = Layer(); const n = ridge(R, TH - 8, 4, { waves: 4 }); near.below(n, P.near); near.rim(mix(P.near, ice, .35)); for (let i = 0; i < 6; i++) T.stalac(near, R() * TW | 0, 6 + R() * 12, 3 + R() * 3, mix(P.near, ice, .25));
      return { sky: sky(P, R, { stars: 70, aurora: [[94, 234, 212], [129, 140, 248], [167, 243, 208]] }), far, fog: fog(P, R, HOR + 6, 10, 110, mix(P.fog, WHITE, .2)), mid, near };
    },
  };

  /** v5.25b: capa intermedia (entre la lejana y la media) para las 7 capas: loma con elementos de la escena */
  const FAR2 = {
    meadow: (L, P, R, g) => { for (let i = 0; i < 7; i++) { const x = R() * TW | 0; T.dead(L, x, g(x), 26 + R() * 14, L.c, R, 1); } },
    forest: (L, P, R, g) => { for (let x = 0; x < TW; x += 8 + (R() * 8 | 0)) T.pine(L, x, g(x) + 2, 34 + R() * 26, L.c, R); },
    beach: (L, P, R, g) => { for (let i = 0; i < 6; i++) { const x = R() * TW | 0; T.rock(L, x, g(x) + 2, 16 + R() * 10, L.c, R); } },
    cave: (L, P, R, g) => { for (let i = 0; i < 12; i++) { const x = R() * TW | 0; T.stalag(L, x, g(x) + 1, 14 + R() * 26, 6 + R() * 6, L.c); } for (let i = 0; i < 10; i++) T.stalac(L, R() * TW | 0, 10 + R() * 24, 4 + R() * 6, L.c); },
    volcano: (L, P, R, g) => { for (let i = 0; i < 8; i++) { const x = R() * TW | 0; T.spike(L, x, g(x) + 1, 12 + R() * 20, 10 + R() * 10, L.c); } },
    temple: (L, P, R, g) => { for (let i = 0; i < 7; i++) { const x = R() * TW | 0; T.column(L, x, g(x), 6, 22 + R() * 26, L.c, R() < .7, R); } },
    abyss: (L, P, R, g) => { for (let i = 0; i < 12; i++) { const x = R() * TW | 0; T.kelp(L, x, g(x), 30 + R() * 40, L.c, R); } },
    sky: (L, P, R) => { for (let i = 0; i < 5; i++) T.cloud(L, R() * TW, 110 + R() * 40, 60 + R() * 50, mix(P.hor, WHITE, .4), mix(P.hor, P.top, .15), 235); },
    swamp: (L, P, R, g) => { for (let i = 0; i < 8; i++) { const x = R() * TW | 0; T.dead(L, x, g(x), 30 + R() * 20, L.c, R, 2); } for (let i = 0; i < 30; i++) { const x = R() * TW | 0; T.reed(L, x, g(x), 6 + R() * 10, L.c, R); } },
    glacier: (L, P, R, g) => { for (let i = 0; i < 10; i++) { const x = R() * TW | 0; T.spike(L, x, g(x) + 1, 14 + R() * 26, 7 + R() * 8, L.c, mix(L.c, WHITE, .25)); } },
  };
  function far2(kit, P, R) {
    const L = Layer(); L.c = mix(P.far, P.mid, .45);
    const g = ridge(R, HOR + 14, 7, { waves: 3, jag: kit === 'volcano' || kit === 'cave' ? 3 : 0 });
    if (kit !== 'sky') L.below(g, L.c);
    FAR2[kit](L, P, R, g);
    L.rim(mix(L.c, P.rimMid, .55)); L.shade(P.fog, HOR + 4, TH, .45);
    return L;
  }

  /** escena (también las de jefe: boss_forest → kit forest en rojo) → kit */
  const kitOf = (id) => { const base = String(id || '').replace(/^boss_/, ''); return base === 'secret' ? 'abyss' : KITS[base] ? base : null; };
  // v5.25b: 7 capas siempre, en este orden; segundos que tarda cada una en recorrer una tira (más rápido = más cerca)
  const ORDER = ['sky', 'far', 'far2', 'fog', 'mid', 'rays', 'near'];
  const SPEED = { sky: 0, far: 150, far2: 100, fog: 55, mid: 65, rays: 0, near: 30 };
  // desenfoque de cada capa en la versión suave (profundidad de campo: el fondo y el primer plano, borrosos)
  const BLUR = { sky: 3, far: 2.4, far2: 1.5, fog: 3, mid: .5, rays: 2.5, near: 2 };

  function layers(id, colors, smooth) {
    const light = document.documentElement.dataset.theme === 'light';
    const key = [id, colors[0], colors[1], light, smooth ? 's' : 'p'].join('|');
    if (cache.has(key)) return cache.get(key);
    const kit = kitOf(id), R = rng(hashStr(id));
    const P = palette(colors, { light, boss: /^boss_/.test(id) && id !== 'boss_secret', secret: id === 'boss_secret' });
    const out = KITS[kit](P, R);
    if (!out.far2) out.far2 = far2(kit, P, R);
    if (!out.rays) out.rays = rays(P, R, 3, kit === 'volcano' ? [255, 160, 90] : P.light);
    return remember(key, ORDER.filter((n) => out[n]).map((name) => ({ name, url: smooth ? out[name].smoothUrl(BLUR[name]) : out[name].url() })));
  }

  DK.pixelScene = {
    TW, TH, KITS, SPEED,
    has: (id) => !!kitOf(id),
    /** nodos de las capas (para meter dentro de .scene) */
    ORDER,
    build(id, colors, { smooth = false } = {}) {
      const frag = document.createDocumentFragment();
      layers(id, colors, smooth).forEach(({ name, url }, i) => {
        const el = document.createElement('div');
        el.className = 'pxs-l pxs-' + name + (SPEED[name] ? ' pxs-move' : '');
        el.style.backgroundImage = `url(${url})`;
        if (SPEED[name]) { el.style.animationDuration = SPEED[name] + 's'; el.style.animationDelay = -((i * 37) % SPEED[name]) + 's'; }
        frag.append(el);
      });
      return frag;
    },
    cacheSize: () => cache.size,
  };
  DK.on('settings:changed', ({ key }) => { if (key === 'theme') cache.clear(); });
})();
