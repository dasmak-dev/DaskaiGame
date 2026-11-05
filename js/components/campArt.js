/* =============================================================
 * components/campArt.js — Pixel art detallado y animado del campamento.
 *
 * Sustituye los dibujos sencillos de los lugares del campamento por
 * versiones con sombreado (luz por la izquierda), contorno oscuro,
 * texturas y VARIOS FOTOGRAMAS para animarlos:
 *   tent    tienda grande y cuadrada con banderín, farolillo y bajo que se mueve (3)
 *   fire    hoguera con llamas, brasas y chispas (4)
 *   anvil   yunque sobre tocón con lingote al rojo y chispas (3)
 *   dummy   muñeco de paja que se balancea (2)
 *   lectern atril con libro abierto, vela y runas que flotan (3)
 *   board   tablón con notas; una se agita con el viento (3)
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
    fire: { base: 20, frames: 4, draw(f) {
      const c = canvas(32, 30);
      c.rect(3, 27, 26, 2, 'rgba(0,0,0,.35)');
      // brasas
      c.rect(9, 23, 14, 3, '#7c2d12').rect(11, 24, 10, 1, f % 2 ? '#f97316' : '#ea580c');
      // troncos cruzados con corteza y corte
      for (let i = 0; i < 16; i++) {
        const y = 25 - Math.floor(i / 3);
        c.set(6 + i, y, W.d).set(6 + i, y + 1, W.m).set(6 + i, y + 2, i % 4 ? W.dd : W.d);
        c.set(25 - i, y, W.l).set(25 - i, y + 1, W.m).set(25 - i, y + 2, W.d);
      }
      c.rect(5, 25, 2, 3, '#d6b48a').set(5, 26, '#8b5a2b').rect(25, 25, 2, 3, '#d6b48a').set(26, 26, '#8b5a2b');
      // anillo de piedras sombreadas
      [[1, 24], [4, 26], [8, 27], [13, 28], [18, 28], [23, 27], [27, 26], [29, 24]].forEach(([x, y], i) => {
        c.rect(x, y, 4, 3, STONE.m).rect(x, y, 3, 1, STONE.l).set(x, y + 1, STONE.l).rect(x + 1, y + 2, 3, 1, STONE.d);
        if (i % 3 === 0) c.set(x + 2, y + 1, STONE.dd);
      });
      // llamas en capas (4 fotogramas)
      const sw = [0, 1, 0, -1][f], sw2 = [1, 0, -1, 0][f];
      c.tri(16 + sw, 3 + (f % 2), 23, 7, (x, y) => (y < 9 ? '#dc2626' : '#ef4444'));
      c.tri(12 + sw2, 9, 23, 4, '#ef4444').tri(20 - sw2, 8, 23, 4, '#ef4444');
      c.tri(16 - sw, 8, 23, 5, '#f97316');
      c.tri(16 + sw2, 13, 23, 3, '#fbbf24');
      c.tri(16, 17, 23, 2, '#fef3c7');
      // lenguas sueltas y chispas
      const sp = [[[9, 6], [24, 4], [14, 1]], [[10, 3], [22, 7], [18, 0]], [[8, 5], [23, 2], [13, 2]], [[11, 2], [25, 5], [17, 1]]][f];
      sp.forEach(([x, y], i) => c.set(x, y, i === 2 ? '#fde68a' : '#fb923c'));
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

    /* ---------- Atril con libro ---------- */
    lectern: { base: 18, frames: 3, draw(f) {
      const c = canvas(28, 32);
      c.rect(5, 30, 18, 2, 'rgba(0,0,0,.35)');
      // pie tallado
      c.rect(12, 14, 4, 13, W.m).rect(12, 14, 1, 13, W.l).rect(15, 14, 1, 13, W.dd);
      c.rect(10, 18, 8, 1, W.d).rect(10, 23, 8, 1, W.d);
      c.rect(7, 27, 14, 3, W.m).rect(7, 27, 14, 1, W.l).rect(7, 29, 14, 1, W.dd);
      // tablero inclinado
      c.rect(3, 12, 22, 3, W.m).rect(3, 12, 22, 1, W.l).rect(3, 14, 22, 1, W.dd);
      // libro abierto con renglones
      c.rect(4, 6, 10, 6, '#f5ecd2').rect(14, 6, 10, 6, '#e9dcb6').rect(13, 6, 2, 6, '#7c4a1e');
      c.rect(4, 6, 10, 1, '#fffaf0');
      [7, 9].forEach((y) => { c.rect(5, y, 7, 1, '#9a8f7d'); c.rect(16, y, 7, 1, '#9a8f7d'); });
      c.rect(16, 10, 4, 1, '#b45309');
      c.rect(3, 11, 22, 1, '#5b3a1a');
      // vela
      c.rect(23, 2, 2, 5, '#f1e7d0').rect(22, 7, 4, 1, '#8b8b8b');
      outline(c);
      c.set(23 + (f === 1 ? 1 : 0), 0, '#fde047').set(23, 1, '#f97316').set(24, 1, '#fbbf24');
      // runas que flotan
      const runes = [[[6, 3], [11, 1], [17, 4]], [[7, 1], [12, 3], [18, 2]], [[5, 2], [10, 4], [16, 1]]][f];
      runes.forEach(([x, y], i) => c.set(x, y, ['#c4b5fd', '#a78bfa', '#ddd6fe'][i]));
      return c;
    } },

    /* ---------- Tablón de misiones ---------- */
    board: { base: 24, frames: 3, draw(f) {
      const c = canvas(36, 34);
      c.rect(3, 32, 30, 2, 'rgba(0,0,0,.35)');
      // postes
      c.rect(3, 8, 3, 25, W.m).rect(3, 8, 1, 25, W.l).rect(30, 8, 3, 25, W.m).rect(32, 8, 1, 25, W.dd);
      // tejadillo
      c.tri(18, 0, 7, 17, (x, y, hw, dx) => (dx < 0 ? (y % 2 ? '#6b3a1f' : '#7c4524') : (y % 2 ? '#4a2614' : '#57301a')));
      c.rect(1, 7, 34, 1, W.dd);
      // tablones
      c.rect(2, 9, 32, 15, W.m);
      [9, 14, 19].forEach((y) => c.rect(2, y, 32, 1, W.l));
      [13, 18, 23].forEach((y) => c.rect(2, y, 32, 1, W.d));
      [[7, 11], [25, 16], [14, 21]].forEach(([x, y]) => c.set(x, y, W.dd));
      // notas
      c.rect(4, 10, 7, 9, '#f5ecd2').rect(5, 12, 5, 1, '#9a8f7d').rect(5, 14, 4, 1, '#9a8f7d').rect(5, 16, 5, 1, '#9a8f7d');
      c.rect(13, 11, 6, 7, '#ffffff').rect(14, 13, 4, 1, '#a8a29e').rect(14, 15, 3, 1, '#a8a29e');
      c.rect(21, 10, 8, 10, '#ecd9a0').rect(22, 12, 6, 1, '#9a8f7d').rect(22, 14, 5, 1, '#9a8f7d').rect(23, 16, 3, 2, '#b91c1c');
      // la nota de la derecha se agita (esquina)
      const flap = [[28, 19], [29, 18], [28, 20]][f];
      c.set(flap[0], flap[1], '#fff7d6').set(flap[0] - 1, flap[1] + (f === 1 ? 0 : 1), '#d9c58a');
      // chinchetas
      [[7, 10], [16, 11], [25, 10]].forEach(([x, y]) => c.set(x, y, '#dc2626'));
      return outline(c);
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
