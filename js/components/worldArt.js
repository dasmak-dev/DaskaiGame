/* =============================================================
 * components/worldArt.js — v5.27: el mapa del mundo (pantalla de Zonas) como una ilustración en pixel art.
 *
 *   DK.worldArt.render({ stops, pts, W, H, SIDE, STEP, PAD }) → dataURL (cacheado)
 *     stops: [{ scene, colors, fog }]  una parada por zona (fog: aún no conocida → niebla)
 *     pts:   [[x, y]]                  posición de cada parada en el mapa (px de pantalla)
 *     W, H:  tamaño del recorrido; SIDE: margen dibujado a cada lado (el mapa puede ser más ancho que el recorrido)
 *
 * Se dibuja a la mitad de resolución (1 píxel = 2 px de pantalla) y se muestra sin suavizar.
 * Cada parada tiene su bioma (según la escena de la zona): suelo con textura y matices, y elementos con
 * sombra hacia abajo a la derecha (árboles, rocas, flores, charcas, lava, ruinas, hielo, nubes…).
 * Entre zonas, el suelo se mezcla con un tramado. El camino queda despejado y con la tierra pisada.
 * Para un bioma nuevo: una entrada en BIOMES (suelo + elementos).
 * ============================================================= */
(function () {
  const cache = new Map();
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const rgb = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  const W3 = [255, 255, 255], K3 = [0, 0, 0];

  function Buf(w, h) {
    const d = new Uint8ClampedArray(w * h * 4);
    const B = {
      w, h, d,
      get(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return null; const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; },
      set(x, y, c, a = 1) {
        x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = (y * w + x) * 4;
        if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } else { d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; }
        d[i + 3] = 255;
      },
      disc(cx, cy, r, c, a, ry = r) { for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if ((x / r) ** 2 + (y / ry) ** 2 <= 1.05) B.set(cx + x, cy + y, c, a); },
      rect(x, y, rw, rh, c, a) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) B.set(x + i, y + j, c, a); },
      line(x0, y0, x1, y1, c, a) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) B.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c, a); },
    };
    return B;
  }

  /* ---------- elementos (vistos desde arriba, luz arriba a la izquierda) ---------- */
  const shadow = (B, x, y, rx, ry = rx * .55) => B.disc(x + rx * .35, y + ry * .6, rx, K3, .32, ry);
  const OBJ = {
    tree(B, x, y, R, P) { const r = 3 + R() * 2.5; shadow(B, x + 1, y + 2, r + 1);
      B.rect(x, y + 1, 1, 3, P.trunk); B.disc(x, y - 1, r, P.leafD); B.disc(x - .6, y - 1.6, r * .78, P.leaf); B.disc(x - 1.4, y - 2.4, r * .38, P.leafL);
      if (R() < .3) B.set(x + r * .4, y - r * .2, P.fruit || P.leafL); },
    pine(B, x, y, R, P) { const hh = 6 + R() * 4 | 0; shadow(B, x + 1, y + 1, 3.5, 2);
      for (let k = 0; k < hh; k++) { const w = Math.round((k / hh) * 3.4); for (let i = -w; i <= w; i++) B.set(x + i, y - hh + k, i < 0 ? P.pineL : i > w / 2 ? P.pineD : P.pine); }
      B.set(x, y, P.trunk); if (P.snow) for (let k = 0; k < hh; k += 3) B.set(x - Math.round((k / hh) * 3.4), y - hh + k, P.snow); },
    bush(B, x, y, R, P) { shadow(B, x, y + 1, 3); B.disc(x, y, 2.6, P.leafD); B.disc(x - .5, y - .6, 1.8, P.leaf); B.set(x - 1, y - 1, P.leafL); if (R() < .4) B.set(x + 1, y, P.flower[0]); },
    rock(B, x, y, R, P) { const r = 1.6 + R() * 2; shadow(B, x, y + 1, r + .5); B.disc(x, y, r, P.rockD, 1, r * .8); B.disc(x - .5, y - .5, r * .7, P.rock, 1, r * .55); B.set(x - r * .5, y - r * .45, P.rockL); if (P.snow) B.line(x - r * .6, y - r * .6, x + r * .2, y - r * .7, P.snow); },
    flowers(B, x, y, R, P) { for (let i = 0; i < 5; i++) { const fx = x + (R() - .5) * 6, fy = y + (R() - .5) * 4; B.set(fx, fy + 1, P.leafD); B.set(fx, fy, P.flower[(R() * P.flower.length) | 0]); } },
    tuft(B, x, y, R, P) { B.set(x, y, P.leafL); B.set(x - 1, y + 1, P.leaf); B.set(x + 1, y + 1, P.leaf); B.set(x, y + 1, P.leafD); },
    mush(B, x, y, R, P) { B.set(x, y + 1, [230, 220, 200]); B.rect(x - 1, y, 3, 1, [200, 60, 50]); B.set(x, y - 1, [220, 80, 60]); B.set(x - 1, y, [250, 240, 230]); },
    log(B, x, y, R, P) { shadow(B, x + 2, y + 1, 5, 1.5); B.rect(x - 4, y, 9, 2, P.trunk); B.rect(x - 4, y, 9, 1, mix(P.trunk, W3, .25)); B.set(x + 5, y, mix(P.trunk, W3, .45)); B.set(x + 5, y + 1, mix(P.trunk, K3, .2)); },
    pond(B, x, y, R, P) { const r = 5 + R() * 4; B.disc(x, y, r + 1, P.shore, 1, r * .6 + 1); B.disc(x, y, r, P.waterD, 1, r * .6); B.disc(x - 1, y - 1, r * .7, P.water, 1, r * .4);
      B.line(x - r * .5, y - r * .25, x - r * .1, y - r * .25, P.waterL); if (P.lily) for (let i = 0; i < 3; i++) B.disc(x + (R() - .5) * r, y + (R() - .5) * r * .5, 1, P.lily); },
    crystal(B, x, y, R, P) { const c = P.glow; for (let k = 0; k < 18; k++) { const a = R() * 6.28, d = 2 + R() * 5; if (bay(x + Math.cos(a) * d | 0, y + Math.sin(a) * d | 0) < .5) B.set(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, c, .35); }
      shadow(B, x, y + 1, 2.5); B.rect(x - 1, y - 3, 2, 4, mix(c, K3, .25)); B.set(x - 1, y - 4, mix(c, W3, .5)); B.rect(x + 1, y - 1, 1, 2, c); B.set(x - 1, y - 2, mix(c, W3, .6)); },
    stalag(B, x, y, R, P) { shadow(B, x, y + 1, 2.5); B.disc(x, y, 2.2, P.rockD); B.disc(x - .4, y - .4, 1.4, P.rock); B.set(x - .5, y - 1, P.rockL); },
    lavaRock(B, x, y, R, P) { OBJ.rock(B, x, y, R, P); B.set(x + 1, y + 1, [255, 120, 30]); },
    column(B, x, y, R, P) { shadow(B, x + 1, y + 1, 3); B.disc(x, y, 2.6, P.rockD); B.disc(x - .4, y - .4, 2, P.rock); B.set(x - 1, y - 1, P.rockL); if (R() < .5) B.rect(x + 3, y + 1, 3, 2, P.rockD); },
    tiles(B, x, y, R, P) { for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if (R() < .8) { B.rect(x + i * 4, y + j * 3, 3, 2, P.rock); B.set(x + i * 4, y + j * 3, P.rockL); } },
    reed(B, x, y, R, P) { for (let i = 0; i < 3; i++) { const rx = x + i * 2 - 2; B.line(rx, y, rx + (R() - .5), y - 3 - R() * 2, P.leaf); B.set(rx, y - 4, P.trunk); } },
    dead(B, x, y, R, P) { shadow(B, x + 1, y + 1, 3, 1.5); B.line(x, y, x, y - 5, P.trunk); B.line(x, y - 3, x - 2, y - 5, P.trunk); B.line(x, y - 4, x + 2, y - 6, P.trunk); },
    palm(B, x, y, R, P) { shadow(B, x + 2, y + 1, 4, 2); B.line(x, y, x + 1, y - 4, P.trunk); for (const [dx, dy] of [[-3, -5], [3, -5], [-3, -3], [4, -3], [0, -7]]) B.line(x + 1, y - 4, x + 1 + dx, y - 4 + dy * .5, P.leaf); B.set(x + 1, y - 5, P.leafL); },
    shell(B, x, y, R, P) { B.set(x, y, [240, 220, 200]); B.set(x + 1, y, [220, 170, 150]); },
    iceSpike(B, x, y, R, P) { shadow(B, x + 1, y + 1, 2.5, 1.2); for (let k = 0; k < 5; k++) { B.set(x, y - k, k < 2 ? P.rock : P.rockL); if (k < 3) B.set(x + 1, y - k, P.rockD); } },
    cloud(B, x, y, R, P) { const r = 4 + R() * 4; B.disc(x + 2, y + 3, r, K3, .18, r * .5); B.disc(x, y, r, P.cloud, 1, r * .55); B.disc(x - r * .5, y - 1, r * .6, P.cloud, 1, r * .4); B.disc(x - r * .6, y - 1.5, r * .3, W3, .7, r * .2); },
    kelp(B, x, y, R, P) { for (let k = 0; k < 6; k++) B.set(x + Math.round(Math.sin(k * .9) * 1), y - k, k % 2 ? P.leaf : P.leafD); },
    glowDot(B, x, y, R, P) { B.set(x, y, P.glow); B.set(x + 1, y, P.glow, .4); B.set(x, y + 1, P.glow, .4); },
  };

  /* ---------- biomas: suelo (3 tonos + ruido) y lista de elementos con su peso ---------- */
  function biome(scene, colors) {
    const z1 = rgb(colors[0]), z2 = rgb(colors[1]);
    const g = (base, d, l) => ({ base, d, l });
    const common = { trunk: [92, 60, 34], rock: [128, 120, 132], rockD: [86, 80, 92], rockL: [176, 170, 180], flower: [[250, 250, 250], [253, 224, 71], [244, 114, 182], [196, 181, 253]],
      shore: [196, 178, 128], water: [56, 140, 190], waterD: [34, 96, 150], waterL: [170, 220, 240] };
    const leafy = (c) => ({ leaf: mix(c, [40, 120, 50], .4), leafD: mix(c, [10, 50, 20], .55), leafL: mix(c, [200, 240, 140], .45), pine: mix(c, [20, 90, 50], .55), pineD: mix(c, [8, 40, 24], .65), pineL: mix(c, [120, 200, 120], .35) });
    const B = {
      meadow: () => ({ ...common, ...leafy(mix(z1, z2, .5)), ground: g(mix(z2, [70, 140, 60], .4), mix(z2, [30, 80, 30], .5), mix(z1, [170, 220, 110], .35)),
        objs: [['tree', 3], ['bush', 3], ['flowers', 5], ['tuft', 8], ['rock', 1.5], ['pond', .35], ['pine', 1]] }),
      forest: () => ({ ...common, ...leafy(z2), ground: g(mix(z2, [40, 90, 40], .3), mix(z2, [10, 40, 15], .55), mix(z1, [90, 160, 70], .3)),
        objs: [['pine', 7], ['tree', 6], ['bush', 2], ['mush', 1.2], ['log', .6], ['tuft', 4]] }),
      beach: () => ({ ...common, ...leafy([90, 170, 90]), ground: g([222, 196, 140], [196, 166, 110], [240, 222, 176]), sea: { at: .62, c: mix(z2, [20, 110, 170], .5) },
        objs: [['palm', 2.5], ['shell', 3], ['rock', 1.5], ['tuft', 1.5]] }),
      cave: () => ({ ...common, ...leafy(z2), rock: mix(z1, [80, 74, 96], .6), rockD: mix(z2, [40, 36, 54], .5), rockL: mix(z1, [170, 160, 200], .5), glow: mix(z1, W3, .25),
        ground: g(mix(z2, [52, 46, 66], .5), mix(z2, [24, 20, 34], .6), mix(z1, [96, 88, 120], .5)), cracks: true, objs: [['stalag', 5], ['crystal', 2.5], ['rock', 3], ['glowDot', 2]] }),
      volcano: () => ({ ...common, ...leafy([90, 60, 40]), rock: [74, 58, 56], rockD: [44, 34, 34], rockL: [120, 100, 92], glow: [255, 140, 50],
        ground: g([58, 42, 40], [34, 24, 24], [92, 64, 56]), lava: true, objs: [['lavaRock', 4], ['rock', 3], ['dead', 1], ['glowDot', 2]] }),
      temple: () => ({ ...common, ...leafy([120, 150, 60]), rock: [200, 176, 120], rockD: [150, 126, 80], rockL: [236, 218, 170],
        ground: g(mix(z1, [214, 182, 110], .5), mix(z2, [170, 130, 60], .5), mix(z1, [240, 220, 160], .5)), objs: [['column', 3], ['tiles', 1.2], ['rock', 2], ['bush', 1.2], ['palm', .8]] }),
      swamp: () => ({ ...common, ...leafy(mix(z1, z2, .5)), water: [60, 90, 70], waterD: [36, 60, 48], waterL: [130, 160, 120], shore: [70, 64, 40], lily: [110, 170, 70],
        ground: g(mix(z2, [70, 76, 40], .5), mix(z2, [36, 40, 20], .6), mix(z1, [120, 130, 70], .4)), objs: [['pond', 1.4], ['reed', 5], ['dead', 3], ['bush', 2], ['mush', 1]] }),
      glacier: () => ({ ...common, ...leafy([60, 110, 110]), snow: [240, 248, 255], rock: [170, 200, 225], rockD: [110, 140, 170], rockL: [235, 245, 255],
        ground: g([214, 228, 240], [176, 196, 216], [244, 250, 255]), cracks: true, objs: [['pine', 4], ['iceSpike', 3], ['rock', 2.5], ['tuft', .5]] }),
      sky: () => ({ ...common, ...leafy([110, 170, 110]), cloud: [244, 244, 255], ground: g(mix(z1, [170, 190, 240], .5), mix(z2, [110, 120, 200], .5), mix(z1, [220, 230, 255], .5)),
        objs: [['cloud', 6], ['tree', 1], ['bush', 1]] }),
      abyss: () => ({ ...common, ...leafy(mix(z1, [30, 120, 120], .5)), glow: mix(z1, [120, 255, 230], .5), rock: mix(z2, [50, 60, 90], .5), rockD: mix(z2, [20, 24, 40], .6), rockL: mix(z1, [110, 120, 170], .5),
        ground: g(mix(z2, [16, 26, 60], .5), mix(z2, [6, 10, 26], .6), mix(z1, [40, 60, 110], .5)), objs: [['kelp', 5], ['rock', 3], ['glowDot', 5], ['crystal', 1]] }),
    };
    return (B[scene] || B.meadow)();
  }
  const FOG = { ground: { base: [58, 62, 74], d: [40, 44, 54], l: [80, 86, 100] }, rock: [70, 74, 86], rockD: [50, 54, 64], rockL: [96, 100, 112], cloud: [120, 126, 142], objs: [['rock', 2], ['cloud', 3]] };

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const noise = (R, n) => { const v = Array.from({ length: n }, () => R()); return (x) => { const i = Math.floor(x), f = x - i; const a = v[((i % n) + n) % n], b = v[(((i + 1) % n) + n) % n]; return a + (b - a) * (f * f * (3 - 2 * f)); }; };

  function render({ stops, pts, W, H, SIDE, STEP, PAD }) {
    const key = JSON.stringify([stops, pts, W, H, SIDE]);
    if (cache.has(key)) return cache.get(key);
    const S = 2, AW = Math.ceil((W + SIDE * 2) / S), AH = Math.ceil(H / S);
    const B = Buf(AW, AH), R = rng(stops.length * 7919 + W);
    const bios = stops.map((s) => (s.fog ? FOG : biome(s.scene, s.colors)));
    const toMap = (ax) => ax * S - SIDE;                         // x del dibujo → x del mapa
    const regionAt = (ax, ay) => {                               // parada que «manda» en ese punto (con borde ondulado y tramado)
      const f = (toMap(ax) - PAD) / STEP + .5 + Math.sin(ay * .19 + ax * .013) * .08;
      const k = Math.floor(f), fr = f - k;
      const N = stops.length, clamp = (v) => Math.max(0, Math.min(N - 1, v));
      if (k < 0 || k >= N) return clamp(k);
      if (fr > .86 && k + 1 < N && bay(ax, ay) < (fr - .86) / .14 * .9) return k + 1;
      if (fr < .1 && k - 1 >= 0 && bay(ax, ay) < (.1 - fr) / .1 * .45) return k - 1;
      return k;
    };
    // camino: muestras de las curvas (las mismas que dibuja el SVG)
    const road = [];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2;
      for (let t = 0; t <= 1; t += .02) { const u = 1 - t; road.push([u ** 3 * a[0] + 3 * u * u * t * mx + 3 * u * t * t * mx + t ** 3 * b[0], a[1] + (b[1] - a[1]) * (3 * t * t - 2 * t ** 3)]); } }
    const roadDist = (mx, my) => { let best = 1e9; for (const [x, y] of road) { const d = Math.hypot(x - mx, y - my); if (d < best) best = d; } return best; };
    const nodeDist = (mx, my) => Math.min(...pts.map(([x, y]) => Math.hypot(x - mx, (y - my) * 1.2)));

    // 1) suelo: tono base con manchas grandes (ruido) y grano fino, en tres tonos tramados
    const n1 = noise(R, 64), n2 = noise(R, 97);
    const reg = new Int16Array(AW * AH);
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const k = regionAt(x, y); reg[y * AW + x] = k;
      const G = bios[k].ground, v = n1(x * .07 + y * .05) * .6 + n2(x * .21 - y * .17) * .4 + (bay(x, y) - .5) * .22;
      B.set(x, y, v < .36 ? G.d : v > .66 ? G.l : G.base);
      if (((x * 7 + y * 13) % 23 === 0) && R() < .5) B.set(x, y, v > .5 ? G.l : G.d);
    }
    // 2) rasgos del suelo: mar (playa), lava (volcán), grietas (cueva, glaciar)
    for (let x = 0; x < AW; x++) for (let y = 0; y < AH; y++) {
      const k = reg[y * AW + x], bio = bios[k];
      if (bio.sea) { const shore = AH * bio.sea.at + Math.sin(x * .12) * 3 + Math.sin(x * .05 + 1) * 4;
        if (y > shore) { const deep = (y - shore) / (AH - shore); B.set(x, y, mix(bio.sea.c, [10, 40, 80], Math.floor(deep * 3 + bay(x, y)) / 4));
          if (y < shore + 2) B.set(x, y, [235, 245, 250], .8); else if ((x + y * 3) % 17 === 0 && R() < .5) B.rect(x, y, 3, 1, [150, 200, 230], .7); }
        else if (y > shore - 2) B.set(x, y, mix(bio.ground.d, [120, 110, 90], .3)); }
    }
    const regionRange = (k) => { const x0 = Math.max(0, Math.round((pts[k][0] - STEP / 2 + SIDE) / S)), x1 = Math.min(AW, Math.round((pts[k][0] + STEP / 2 + SIDE) / S));
      return [k === 0 ? 0 : x0, k === stops.length - 1 ? AW : x1]; };
    bios.forEach((bio, k) => {
      const [x0, x1] = regionRange(k);
      if (bio.lava) for (let r = 0; r < 2; r++) { let y = R() * AH; for (let x = x0; x < x1; x++) { y += (R() - .5) * 1.6 + Math.sin(x * .1 + r) * .4; y = Math.max(4, Math.min(AH - 4, y));
        if (roadDist(toMap(x), y * S) < 14) continue; B.rect(x, y - 1, 1, 3, [140, 30, 10]); B.set(x, y, [255, 120, 30]); if ((x + r) % 5 === 0) B.set(x, y, [255, 220, 120]);
        for (const dy of [-3, 3]) if (bay(x, y + dy) < .45) B.set(x, y + dy, [255, 110, 40], .35); } }
      if (bio.cracks) for (let c = 0; c < (x1 - x0) / 14; c++) { let x = x0 + R() * (x1 - x0), y = R() * AH; const col = mix(bio.ground.d, K3, .35);
        for (let s = 0; s < 8; s++) { B.set(x, y, col); x += R() < .5 ? 1 : 0; y += R() < .6 ? 1 : 0; if (R() < .25) x -= 1; } }
    });
    // 3) tierra pisada a lo largo del camino (debajo del SVG del camino)
    for (const [mx, my] of road) { const ax = (mx + SIDE) / S, ay = my / S; for (let dy = -5; dy <= 5; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dy) / 5; if (bay(ax + dx | 0, ay + dy | 0) < (1 - d) * .55) B.set(ax + dx, ay + dy, mix(bios[reg[Math.min(AH - 1, Math.max(0, ay + dy | 0)) * AW + Math.min(AW - 1, Math.max(0, ax + dx | 0))]].ground.d, [110, 84, 52], .45), .5); } }
    // 4) elementos: se reparten por cada zona, lejos del camino y de las paradas, sin pisarse
    const occ = new Uint8Array(AW * AH);
    const free = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < AW && yy < AH && occ[yy * AW + xx]) return false; } return true; };
    const mark = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < AW && yy < AH) occ[yy * AW + xx] = 1; } };
    const placed = [];
    for (let tries = 0; tries < AW * 2.2; tries++) {
      const x = R() * AW | 0, y = 3 + R() * (AH - 5) | 0, k = reg[y * AW + x], bio = bios[k];
      if (bio.sea && y > AH * bio.sea.at - 3) continue;
      const mx = toMap(x), my = y * S;
      if (roadDist(mx, my) < 18 || nodeDist(mx, my) < 46) continue;
      const tot = bio.objs.reduce((a, o) => a + o[1], 0); let r = R() * tot, kind = bio.objs[0][0];
      for (const [kname, wgt] of bio.objs) { r -= wgt; if (r <= 0) { kind = kname; break; } }
      const rad = { pond: 7, tree: 4, pine: 3, cloud: 6, tiles: 6, log: 4, palm: 4, column: 3 }[kind] || 2;
      if (!free(x, y, rad)) continue;
      mark(x, y, rad); placed.push([y, x, kind, k]);
    }
    placed.sort((a, b) => a[0] - b[0]).forEach(([y, x, kind, k]) => { const bio = bios[k]; const P = { ...bio, leaf: bio.leaf || bio.rock, leafD: bio.leafD || bio.rockD, leafL: bio.leafL || bio.rockL, flower: bio.flower || [[200, 200, 200]], cloud: bio.cloud || [200, 200, 210], glow: bio.glow || [200, 200, 255] }; (OBJ[kind] || OBJ.rock)(B, x, y, R, P); });
    // 5) niebla de lo desconocido: nubes tramadas encima de las zonas sin descubrir
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { if (!stops[reg[y * AW + x]].fog) continue;
      const v = n1(x * .05 + 40) * .5 + n2(y * .09 + x * .03) * .5; if (bay(x, y) < v * .9) B.set(x, y, [150, 156, 172], .28); }
    // 6) viñeta suave arriba y abajo
    for (let y = 0; y < AH; y++) { const e = Math.min(y, AH - 1 - y); if (e < 6) for (let x = 0; x < AW; x++) if (bay(x, y) < (6 - e) / 8) B.set(x, y, K3, .25); }

    const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
    cv.getContext('2d').putImageData(new ImageData(B.d, AW, AH), 0, 0);
    const url = cv.toDataURL('image/png');
    cache.set(key, url); if (cache.size > 8) cache.delete(cache.keys().next().value);
    return url;
  }

  DK.worldArt = { render, OBJ, biome };
})();
