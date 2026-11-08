/* =============================================================
 * components/campArt.js — Pixel art detallado y animado del campamento.
 *
 * Sustituye los dibujos sencillos de los lugares del campamento por
 * versiones con sombreado (luz por la izquierda), contorno oscuro,
 * texturas y VARIOS FOTOGRAMAS para animarlos:
 *   tent    tienda grande y cuadrada con banderín, farolillo y bajo que se mueve (3)
 *   fire    hoguera grande: llamas procedurales, troncos en tipi, brasas y chispas (8, v4.54)
 *   anvil   yunque sobre tocón con lingote al rojo y chispas (3)
 *   dummy   muñeco de paja que se balancea (2)
 *   lectern (códice) grimorio con el lomo a la vista: reposo con runa que late y hoja que pasa (12, v4.80)
 *   board   tablón con tejas, notas, sello y mapa; farol que se mece; nota al viento (6, v4.54)
 *   portal  arco de piedra (capa fija) con runas y un vórtice que gira (12, fluido)
 *   torch   antorcha (3)
 * DK.pix.animated(name) → { frames: [lienzo…], base, over } (over = capa fija encima; base = ancho con el
 * que se veía el dibujo antiguo, para conservar el tamaño en pantalla).
 * camp.js pinta los fotogramas apilados (.camp-anim) y css/motion.css los
 * alterna. Se carga después de camp.js.
 * ============================================================= */
(function () {
  const { canvas } = DK.pix;
  const OUT = '#1a0f0a';

  /** Contorno de 1 px alrededor de lo dibujado (sólo en huecos vacíos). */
  function outline(c, color = OUT) {
    const pts = [];
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      if (c.g[y][x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const r = c.g[y + dy]; const v = r && r[x + dx]; return v && v !== color && !String(v).startsWith('rgba'); });
      if (n) pts.push([x, y]);
    }
    pts.forEach(([x, y]) => c.set(x, y, color));
    return c;
  }
  const line = (c, x0, y0, x1, y1, col) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col);
    return c;
  };
  const W = { l: '#b07a43', m: '#8b5a2b', d: '#5c3a1c', dd: '#3b2414' };
  const STONE = { l: '#8a8290', m: '#625a68', d: '#433c48', dd: '#2a2430' };

  const ART = {
    /* ---------- Tienda de lona ---------- */
    // v4.45: tienda de campaña grande y cuadrada (paredes rectas, tejado a dos aguas, faldón festoneado)
    tent: { base: 38, frames: 3, draw(f) {
      const c = canvas(52, 42);
      const RED = ['#a32a22', '#86211b', '#5e1513'], BONE = ['#c9bba0', '#a89a80', '#6d6253'];
      const stripe = (x, shade) => (Math.floor((x - 2) / 5) % 2 ? RED : BONE)[shade];
      // sombra
      c.rect(3, 39, 46, 2, 'rgba(0,0,0,.35)');
      // vientos y estacas
      line(c, 5, 18, 0, 39, '#a8957a'); line(c, 46, 18, 51, 39, '#a8957a');
      c.rect(0, 38, 2, 3, W.d).rect(50, 38, 2, 3, W.d);
      // paredes rectas (lado derecho en sombra)
      for (let y = 19; y <= 38; y++) for (let x = 6; x <= 45; x++) c.set(x, y, stripe(x, x < 9 ? 0 : x > 36 ? 2 : 1));
      // tejado a dos aguas (trapecio) con el alero que sobresale
      for (let y = 7; y <= 18; y++) {
        const k = (y - 7) / 11, x0 = Math.round(13 - k * 10), x1 = Math.round(38 + k * 10);
        for (let x = x0; x <= x1; x++) c.set(x, y, stripe(x, y < 9 ? 0 : x > 36 ? 2 : x < 16 ? 0 : 1));
      }
      c.rect(13, 7, 26, 1, '#e3d6bb');
      // faldón festoneado bajo el alero
      for (let x = 3; x <= 48; x++) { c.set(x, 19, '#3b1d0e'); if (x % 4 !== 0) c.set(x, 20, (Math.floor(x / 4) % 2 ? RED : BONE)[1]); }
      // costuras y remiendo
      for (let y = 22; y < 38; y += 3) { c.set(6, y, '#3b1d0e'); c.set(45, y, '#2a140a'); }
      c.rect(10, 27, 4, 3, '#7a6a4f').set(10, 27, '#c9bba0').set(13, 29, '#4d3f2e');
      // bajo que ondea con el viento
      for (let x = 6; x <= 45; x++) if ((x + f * 2) % 6 < 2) c.set(x, 38, stripe(x, 2));
      // entrada con luz cálida dentro y solapas recogidas
      c.rect(20, 23, 12, 16, '#140a05').rect(21, 30, 10, 9, '#2a1408').rect(22, 34, 8, 5, f === 1 ? '#7c3a0e' : '#6a300c');
      c.rect(24, 36, 4, 2, f === 1 ? '#f59e0b' : '#d97706').set(25, 35, '#fde68a');
      c.tri(19, 22, 34, 3, (x, y, hw, dx) => (dx < 0 ? '#c9bba0' : '#a89a80'));
      c.tri(32, 22, 34, 3, (x, y, hw, dx) => (dx > 0 ? '#6d6253' : '#a89a80'));
      line(c, 17, 29, 21, 29, W.d); line(c, 31, 29, 35, 29, W.d);
      // farolillo junto a la puerta
      c.rect(35, 23, 1, 2, W.dd).rect(34, 25, 3, 3, '#3b2414').set(35, 26, ['#fbbf24', '#fde68a', '#f59e0b'][f]);
      // postes de las esquinas y mástil con banderín
      c.rect(12, 4, 1, 4, W.d).rect(39, 4, 1, 4, W.d).set(12, 3, W.l).set(39, 3, W.l);
      c.rect(25, 0, 1, 8, W.d);
      for (let x = 0; x < 9; x++) {
        const off = Math.round(Math.sin((x + f * 2) * 0.9) * (x / 5));
        const hh = Math.max(1, 3 - Math.floor(x / 4));
        c.rect(26 + x, 1 + off, 1, hh, x % 3 === 2 ? '#7f1d1d' : '#b91c1c');
      }
      c.set(26, 1, '#fca5a5');
      return outline(c);
    } },

    /* ---------- Hoguera ---------- */
    // v4.54: más grande (base 30) y con llamas procedurales en 8 fotogramas que suben y se enroscan
    // (todo depende del ángulo de fase → el bucle no da saltos), troncos en tipi, lecho de brasas y chispas.
    fire: { base: 30, frames: 8, draw(f) {
      const c = canvas(44, 48), N = 8, ph = (f / N) * Math.PI * 2;
      c.rect(4, 45, 36, 2, 'rgba(0,0,0,.4)');
      // piedras de detrás
      [[6, 38], [11, 36], [17, 35], [23, 35], [29, 36], [34, 38]].forEach(([x, y]) => c.rect(x, y, 5, 3, STONE.d).rect(x, y, 4, 1, STONE.m));
      // lecho de brasas que late
      const bed = ['#7c2d12', '#9a3412', '#c2410c', '#ea580c'];
      for (let x = 9; x <= 34; x++) for (let y = 38; y <= 41; y++) {
        const k = Math.sin(x * 1.7 + y * 2.3 + ph * 2) * 0.5 + 0.5;
        c.set(x, y, bed[Math.min(3, Math.floor(k * 3 + (y === 39 ? 1 : 0)))]);
      }
      // llamas: cuerpo rojo y naranja, lenguas amarillas y un corazón claro pequeño
      const col = ['#7f1d1d', '#dc2626', '#f97316', '#fbbf24', '#fde68a', '#fffbeb'];
      for (let y = 8; y <= 39; y++) {
        const up = (39 - y) / 31; // 0 abajo → 1 arriba
        const cx = 22 + Math.sin(y * 0.35 - ph) * 2.4 * up + Math.sin(ph) * 0.7 * up;
        const half = 12 * Math.pow(1 - up, 0.65) + 0.8;
        for (let x = 4; x <= 40; x++) {
          const d = Math.abs(x - cx) / half;
          if (d > 1.4) continue;
          const n = Math.sin(x * 0.95 + y * 0.6 + ph * 2) * Math.sin(y * 0.85 - x * 0.35 + ph * 3) + Math.sin(y * 0.5 + x * 0.2 + ph) * 0.45;
          const v = (1 - d) - up * 0.6 + n * 0.2;
          const i = v > 0.78 ? 5 : v > 0.6 ? 4 : v > 0.44 ? 3 : v > 0.26 ? 2 : v > 0.12 ? 1 : v > 0.04 ? 0 : -1;
          if (i >= 0) c.set(x, y, col[i]);
        }
      }
      // troncos cruzados delante de la base del fuego (corteza y corte claro)
      for (let i = 0; i < 22; i++) {
        const y = 41 - Math.floor(i / 4);
        c.set(8 + i, y, W.d).set(8 + i, y + 1, W.m).set(8 + i, y + 2, i % 4 ? W.dd : W.d);
        c.set(35 - i, y, W.l).set(35 - i, y + 1, W.m).set(35 - i, y + 2, W.d);
      }
      c.rect(6, 40, 3, 3, '#d6b48a').set(7, 41, W.m).rect(35, 40, 3, 3, '#d6b48a').set(36, 41, W.m);
      // lenguas sueltas que se escapan arriba
      [[0, -6], [2, 5], [5, 1]].forEach(([o, dx]) => {
        const t = ((f + o) % N) / N, y = Math.round(16 - t * 10), x = 22 + dx + Math.round(Math.sin(ph + o) * 1.5);
        if (t < 0.85) c.rect(x, y, 1, 2, t < 0.4 ? '#f97316' : '#dc2626');
      });
      // piedras de delante (tapan la base del fuego)
      [[3, 41], [8, 43], [14, 44], [20, 44], [26, 44], [32, 43], [37, 41]].forEach(([x, y], i) => {
        c.rect(x, y, 5, 3, STONE.m).rect(x, y, 4, 1, STONE.l).set(x, y + 1, STONE.l).rect(x + 1, y + 2, 4, 1, STONE.d);
        c.set(x + 2, y, i % 2 ? '#fdba74' : '#fb923c'); // reflejo del fuego
      });
      // chispas que suben
      for (let k = 0; k < 6; k++) {
        const t = ((f + k * 1.37) % N) / N, y = Math.round(26 - t * 25), x = Math.round(22 + Math.sin(k * 2.4 + t * 6) * (4 + t * 9));
        if (y >= 0) c.set(x, y, t < 0.5 ? '#fde047' : '#fb923c');
      }
      return c; // sin contorno: el fuego brilla
    } },

    /* ---------- Yunque ---------- */
    anvil: { base: 22, frames: 3, draw(f) {
      const c = canvas(34, 28);
      c.rect(6, 26, 22, 2, 'rgba(0,0,0,.35)');
      // tocón con corteza y anillos
      c.rect(9, 16, 16, 10, W.m).rect(9, 16, 16, 2, '#c9a27a').rect(11, 16, 12, 1, '#e0c39c');
      [[13, 17], [16, 17], [19, 17]].forEach(([x, y]) => c.set(x, y, '#a07850'));
      for (let y = 18; y < 26; y++) { c.set(9, y, W.l).set(24, y, W.dd); if (y % 3 === 0) c.set(13, y, W.d).set(19, y + 1, W.d); }
      c.rect(8, 24, 18, 2, W.d).set(7, 25, W.d).set(26, 25, W.d);
      // yunque: cara, cintura, pie y cuerno
      c.rect(6, 7, 22, 4, STONE.m).rect(6, 7, 22, 1, '#d1d5db').rect(6, 10, 22, 1, STONE.d);
      c.tri(4, 7, 10, 2, STONE.m).rect(1, 8, 5, 2, STONE.m).set(0, 8, STONE.l).rect(1, 8, 5, 1, '#cbd5e1');
      c.rect(11, 11, 12, 3, STONE.d).rect(12, 11, 10, 1, STONE.m);
      c.rect(9, 14, 16, 2, STONE.dd).rect(9, 14, 16, 1, STONE.d);
      c.rect(25, 8, 2, 2, STONE.dd);
      // lingote al rojo
      const hot = ['#f97316', '#fb923c', '#ea580c'][f];
      c.rect(13, 5, 8, 2, hot).rect(14, 5, 6, 1, '#fde68a');
      // martillo apoyado
      line(c, 26, 2, 30, 14, W.d); c.rect(23, 0, 6, 3, '#94a3b8').rect(23, 0, 6, 1, '#e2e8f0').set(28, 2, '#475569');
      outline(c);
      // chispas (encima del contorno)
      const sp = [[], [[11, 2], [22, 1], [17, 0]], [[9, 0], [24, 3], [15, 1], [20, 0]]][f];
      sp.forEach(([x, y]) => c.set(x, y, '#fde047'));
      return c;
    } },

    /* ---------- Muñeco de paja ---------- */
    dummy: { base: 16, frames: 2, draw(f) {
      const c = canvas(26, 40);
      c.rect(6, 38, 14, 2, 'rgba(0,0,0,.35)');
      const lean = f;
      // poste y travesaño
      c.rect(12, 14, 3, 25, W.m).rect(12, 14, 1, 25, W.l).rect(14, 14, 1, 25, W.d);
      c.rect(1 + lean, 15, 24, 3, W.m).rect(1 + lean, 15, 24, 1, W.l).rect(1 + lean, 17, 24, 1, W.d);
      // cuerpo de paja con textura
      c.rect(6 + lean, 14, 14, 15, '#c69a2a');
      for (let y = 14; y < 29; y++) for (let x = 6; x < 20; x++) if ((x * 3 + y * 5) % 7 === 0) c.set(x + lean, y, '#e2b84a'); else if ((x + y * 2) % 9 === 0) c.set(x + lean, y, '#9a7418');
      c.rect(6 + lean, 14, 2, 15, '#ddb446');
      // cuerdas
      c.rect(6 + lean, 19, 14, 1, '#7a5a30').rect(6 + lean, 25, 14, 1, '#7a5a30');
      // diana
      c.circle(13 + lean, 22, 3, '#f5f0e0').circle(13 + lean, 22, 2, '#dc2626').set(13 + lean, 22, '#f5f0e0');
      // paja que asoma
      [[5, 29], [8, 30], [17, 30], [20, 29], [4, 14], [21, 15]].forEach(([x, y]) => c.set(x + lean, y, '#e2b84a'));
      // cabeza de saco con costuras
      c.circle(13 + lean, 8, 6, '#b8a07a').circle(12 + lean, 7, 4, '#cdb68e');
      c.rect(10 + lean, 6, 2, 2, '#2a1a10').rect(15 + lean, 6, 2, 2, '#2a1a10');
      line(c, 10 + lean, 11, 16 + lean, 11, '#6b5537'); [11, 13, 15].forEach((x) => c.set(x + lean, 12, '#6b5537'));
      c.rect(8 + lean, 2, 10, 1, '#8a6a3a');
      return outline(c);
    } },

    /* ---------- Códice: grimorio que flota sobre un pedestal ---------- */
    // v4.54: pedestal de piedra con runas, círculo mágico que gira, libro abierto que flota
    // y pasa una página, y motas de luz que suben (8 fotogramas).
    // v4.79: el grimorio es UN dibujo quieto (abierto, sin sombra ni motas): el vaivén, la hoja
    // que pasa (giro 3D) y las chispas son CSS continuo en camp.js (.codex-*), mucho más fluido.
    // v4.80: grimorio pixel art de 12 fotogramas (como la hoguera): visto un poco desde delante,
    // con el canto de las hojas, las tapas y el LOMO redondeado con nervios dorados asomando
    // por debajo. 7 fotogramas de reposo (la runa de la ilustración late) y 5 en los que una
    // hoja se levanta desde el lomo, se pone de canto y cae al otro lado.
    lectern: { base: 22, frames: 12, draw(f) {
      const c = canvas(40, 26), G1 = '#fbbf24', G2 = '#b45309';
      const PY = 10, SX = 19.5, L = 17, K = 0.5; // arriba de las hojas, lomo, largo de hoja, inclinación
      const LEA = { l: '#6b2a52', m: '#4a1d3a', d: '#2e1024', dd: '#1d0a17' };
      // Sombra
      c.rect(4, 24, 32, 2, 'rgba(0,0,0,.38)');
      // Tapas (asoman bajo las hojas) con esquinas doradas
      c.rect(1, PY + 10, 38, 3, LEA.m).rect(1, PY + 10, 38, 1, LEA.l).rect(1, PY + 12, 38, 1, LEA.d);
      [[1, PY + 10], [37, PY + 10], [1, PY + 12], [37, PY + 12]].forEach(([x, y]) => c.rect(x, y, 2, 1, G1));
      // Canto del bloque de hojas (rayitas) a cada lado
      for (let x = 2; x <= 37; x++) { if (x >= 18 && x <= 21) continue; c.set(x, PY + 9, '#e6d6ac').set(x, PY + 10, x % 2 ? '#cdb985' : '#d9c79a'); }
      // LOMO: sale por debajo, redondeado, con nervios dorados
      for (let y = PY + 9; y <= PY + 15; y++) {
        const w = y >= PY + 14 ? 2 : 3;
        for (let x = 20 - w; x < 20 + w; x++) c.set(x, y, x < 19 ? LEA.l : x > 20 ? LEA.d : LEA.m);
      }
      [PY + 11, PY + 13].forEach((y) => c.rect(17, y, 6, 1, G2).set(18, y, G1).set(19, y, G1));
      c.rect(18, PY + 16, 4, 1, LEA.dd);
      // Hojas abiertas: el borde de arriba se curva hacia el lomo
      const pageTop = (x) => PY + (Math.abs(x - SX) < 4 ? 2 : Math.abs(x - SX) < 8 ? 1 : 0);
      const paper = (x, left) => (left ? (x < 5 ? '#efe3c2' : '#f7edd3') : x > 34 ? '#e8d9b2' : '#f1e5c6');
      for (let x = 2; x <= 37; x++) {
        if (x === 19 || x === 20) continue;
        for (let y = pageTop(x); y <= PY + 8; y++) c.set(x, y, paper(x, x < 19));
        c.set(x, pageTop(x), x < 19 ? '#fffaf0' : '#fbf3dc');
      }
      c.rect(19, PY + 2, 2, 7, '#7c4a1e').set(19, PY + 2, '#5c3414');
      // Texto (izquierda) e ilustración con runa que late (derecha)
      [[4, PY + 2, 11], [4, PY + 4, 12], [4, PY + 6, 8]].forEach(([x, y, w]) => c.rect(x, y, w, 1, '#a89a80'));
      c.set(4, PY + 2, '#7c2d12').set(5, PY + 2, '#7c2d12'); // capitular
      [[23, PY + 6, 11], [23, PY + 7, 8]].forEach(([x, y, w]) => c.rect(x, y, w, 1, '#a89a80'));
      const pulse = f < 7 ? [0, 1, 2, 2, 1, 0, 0][f] : 0;
      const RUNE = ['#7c3aed', '#a78bfa', '#ddd6fe'];
      c.circle(28, PY + 3, 2, '#c4b5fd').set(28, PY + 3, RUNE[pulse]).set(27, PY + 2, RUNE[Math.min(2, pulse + 1)]).set(29, PY + 4, '#7c3aed');
      if (pulse === 2) c.set(28, PY, '#ede9fe').set(31, PY + 2, '#ede9fe');
      // Hoja que pasa (fotogramas 7-11): gira sobre el lomo y cae a la izquierda
      if (f >= 7) {
        const th = [20, 55, 90, 125, 156][f - 7] * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
        const back = cs < 0, edge = Math.abs(cs) < 0.18;
        for (let i = 0; i <= 60; i++) {
          const t = i / 60, x = Math.round(SX + t * L * cs), lift = t * L * K * sn;
          const y0 = Math.round(PY + 1 - lift), y1 = Math.round(PY + 8 - lift);
          for (let y = y0; y <= y1; y++) c.set(x, y, edge ? '#d9c79a' : back ? (t > 0.85 ? '#d8c69a' : '#e9dcb8') : (t > 0.85 ? '#efe2bf' : '#fbf3dc'));
          if (!edge) c.set(x, y0, back ? '#cdb985' : '#fffaf0');
          if (!edge && !back && i % 12 === 6 && t < 0.8) c.set(x, Math.round(PY + 5 - lift), '#a89a80');
        }
        if (f === 9) c.set(20, Math.round(PY - 7), '#fffaf0'); // brillo en el canto
      }
      outline(c);
      return c;
    } },

    /* ---------- Tablón de misiones ---------- */
    // v4.54: tablón con tejadillo de tejas, notas (una con sello de lacre y otra con un mapa),
    // un farol colgado que se mece y titila, y una nota que se agita con el viento (6 fotogramas).
    board: { base: 30, frames: 6, draw(f) {
      const c = canvas(44, 40), N = 6, ph = (f / N) * Math.PI * 2;
      c.rect(3, 38, 34, 2, 'rgba(0,0,0,.35)');
      // postes
      c.rect(4, 9, 3, 30, W.m).rect(4, 9, 1, 30, W.l).rect(6, 9, 1, 30, W.dd);
      c.rect(31, 9, 3, 30, W.m).rect(31, 9, 1, 30, W.l).rect(33, 9, 1, 30, W.dd);
      // tejadillo de tejas con alero
      for (let y = 1; y <= 8; y++) {
        const half = 6 + y * 2.1;
        for (let x = Math.round(19 - half); x <= Math.round(19 + half); x++) {
          const row = y % 2, tile = Math.floor((x + row * 2) / 4) % 2;
          c.set(x, y, x < 19 ? (tile ? '#7c3a24' : '#8f4529') : (tile ? '#5a2918' : '#6a301d'));
          if ((x + row * 2) % 4 === 0) c.set(x, y, '#3a1a10');
        }
      }
      c.rect(1, 9, 37, 1, '#2a120b');
      [[9, 3], [26, 5], [15, 7]].forEach(([x, y]) => c.set(x, y, '#3f5a2a').set(x + 1, y, '#4d6b33')); // musgo
      // tablones
      c.rect(3, 10, 32, 17, W.m);
      [10, 16, 22].forEach((y) => c.rect(3, y, 32, 1, W.l));
      [15, 21, 26].forEach((y) => c.rect(3, y, 32, 1, W.d));
      [[8, 12], [27, 18], [14, 24], [30, 13]].forEach(([x, y]) => c.set(x, y, W.dd));
      // notas: lista, cartel con sello de lacre, mapa
      c.rect(5, 11, 8, 10, '#f5ecd2').rect(6, 13, 6, 1, '#9a8f7d').rect(6, 15, 5, 1, '#9a8f7d').rect(6, 17, 6, 1, '#9a8f7d').rect(6, 19, 3, 1, '#9a8f7d');
      c.rect(14, 12, 8, 11, '#fffaf0').rect(15, 14, 6, 1, '#a8a29e').rect(15, 16, 4, 1, '#a8a29e').circle(18, 20, 1, '#b91c1c').set(18, 20, '#ef4444');
      c.rect(23, 11, 10, 9, '#ecd9a0');
      line(c, 24, 18, 27, 14, '#92400e'); line(c, 27, 14, 31, 16, '#92400e'); c.set(31, 16, '#b91c1c').set(30, 15, '#b91c1c').set(32, 17, '#b91c1c');
      c.set(25, 13, '#4d6b33').set(29, 18, '#38bdf8');
      // la esquina de la nota de la lista se agita
      const flap = [0, 1, 2, 1, 0, 0][f];
      if (flap) c.rect(12 - flap + 1, 20 - flap, flap, flap, '#fffaf0').set(12, 20, W.m);
      // chinchetas
      [[8, 11], [18, 12], [28, 11]].forEach(([x, y]) => c.set(x, y, '#dc2626'));
      outline(c);
      // farol colgado del alero (se mece y titila)
      const sw = Math.round(Math.sin(ph) * 1.4);
      line(c, 38, 9, 38 + sw, 13, '#57534e');
      const lx = 36 + sw, lit = ['#fde047', '#fbbf24', '#fde68a', '#fbbf24', '#fef3c7', '#fbbf24'][f];
      c.rect(lx, 13, 5, 1, '#292524').rect(lx, 14, 5, 5, '#44403c').rect(lx + 1, 15, 3, 3, lit).set(lx + 2, 16, '#fffbeb').rect(lx, 19, 5, 1, '#292524');
      c.set(lx - 1, 16, 'rgba(253,224,71,.35)').set(lx + 5, 16, 'rgba(253,224,71,.35)').set(lx + 2, 20, 'rgba(253,224,71,.3)');
      return c;
    } },

    /* ---------- Portal de piedra ---------- */
    portal: { base: 26, frames: 12, size: [38, 44],
      // v4.45: el arco de piedra va en una capa fija (over) y sólo el vórtice y las runas cambian,
      // en 12 fotogramas que dan media vuelta a las bandas → giro continuo y fluido
      draw(f) {
        const c = canvas(38, 44);
        c.rect(2, 42, 34, 2, 'rgba(0,0,0,.4)');
        const cx = 19, cy = 26, N = 12;
        const pulse = 0.5 + 0.5 * Math.cos((f / N) * Math.PI * 2);
        for (let y = 11; y <= 41; y++) for (let x = 9; x <= 28; x++) {
          const dx = (x - cx) / 10, dy = (y - cy) / 15, r = Math.sqrt(dx * dx + dy * dy);
          if (r > 1.02) continue;
          const a = Math.atan2(dy, dx) + r * 5 - (f / N) * Math.PI;
          const band = (Math.sin(a * 2) + 1) / 2;
          const core = 0.16 + pulse * 0.05;
          const col = r < core ? '#fef3c7' : r < 0.35 ? (band > 0.5 ? '#fde68a' : '#fb923c') : r < 0.7 ? (band > 0.5 ? '#f97316' : '#dc2626') : (band > 0.55 ? '#b91c1c' : '#5b0f12');
          c.set(x, y, col);
        }
        // runas que laten en los pilares y la clave (encima del arco)
        const on = ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'];
        [[5, 16], [5, 24], [5, 32], [32, 16], [32, 24], [32, 32]].forEach(([x, y], i) => { const col = on[(f + i * 2) % N]; c.rect(x, y, 1, 3, col).set(x - 1, y + 1, col); });
        c.rect(18, 2, 2, 2, on[(f + 6) % N]).set(17, 3, '#fde047');
        return c;
      },
      over() {
        const c = canvas(38, 44);
        const pillar = (x0) => {
          c.rect(x0, 10, 7, 32, STONE.m).rect(x0, 10, 1, 32, STONE.l).rect(x0 + 6, 10, 1, 32, STONE.dd);
          for (let y = 10; y < 42; y += 5) { c.rect(x0, y, 7, 1, STONE.d); c.set(x0 + ((y / 5) % 2 ? 3 : 4), y + 2, STONE.d); }
        };
        pillar(2); pillar(29);
        c.rect(1, 39, 9, 3, STONE.d).rect(28, 39, 9, 3, STONE.d).rect(1, 39, 9, 1, STONE.m).rect(28, 39, 9, 1, STONE.m);
        c.rect(0, 5, 38, 6, STONE.m).rect(0, 5, 38, 1, STONE.l).rect(0, 10, 38, 1, STONE.dd);
        [9, 19, 28].forEach((x) => c.rect(x, 5, 1, 6, STONE.d));
        c.rect(14, 0, 10, 6, STONE.m).rect(14, 0, 10, 1, STONE.l).rect(23, 0, 1, 6, STONE.dd);
        [[3, 11], [4, 12], [33, 14], [34, 13], [8, 5], [27, 5], [2, 30], [35, 33]].forEach(([x, y]) => c.set(x, y, '#3f5a2a'));
        outline(c);
        // huecos de las runas (se ven las de los fotogramas por debajo)
        [[5, 16], [5, 24], [5, 32], [32, 16], [32, 24], [32, 32]].forEach(([x, y]) => { for (let k = 0; k < 3; k++) c.g[y + k][x] = null; c.g[y + 1][x - 1] = null; });
        c.g[2][18] = c.g[2][19] = c.g[3][18] = c.g[3][19] = c.g[3][17] = null;
        return c;
      } },

    /* ---------- Antorcha ---------- */
    torch: { base: 8, frames: 3, draw(f) {
      const c = canvas(12, 30);
      c.rect(5, 11, 2, 19, W.m).rect(5, 11, 1, 19, W.l);
      c.rect(3, 9, 6, 3, '#57534e').rect(3, 9, 6, 1, '#a8a29e').rect(4, 12, 4, 1, '#44403c');
      const sw = [0, 1, -1][f];
      c.tri(6 + sw, 1 + (f === 2 ? 1 : 0), 8, 3, '#ef4444').tri(6, 3, 8, 2, '#f97316').rect(5, 5, 2, 3, '#fde047').set(6, 6, '#fffbeb');
      c.set([2, 9, 3][f], [3, 1, 0][f], '#fb923c');
      return c;
    } },
  };

  const cache = {};
  /** Fotogramas de un dibujo animado (en caché). */
  DK.pix.animated = (name) => {
    const a = ART[name]; if (!a) return null;
    if (!cache[name]) cache[name] = { base: a.base, frames: Array.from({ length: a.frames }, (_, i) => a.draw(i)), over: a.over ? a.over() : null };
    return cache[name];
  };
  DK.pix.outline = outline;
})();
