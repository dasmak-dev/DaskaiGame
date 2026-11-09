/* =============================================================
 * components/campArt.js — Pixel art detallado y animado del campamento.
 *
 * Sustituye los dibujos sencillos de los lugares del campamento por
 * versiones con sombreado (luz por la izquierda), contorno oscuro,
 * texturas y VARIOS FOTOGRAMAS para animarlos:
 *   tent    (Inventario) arcón/alijo alargado y robusto: al pasar el ratón la tapa se levanta un poco (3, v4.96)
 *   fire    hoguera: una sola llama grande que ondula y se mece, troncos, brasas y chispas (8, v4.95)
 *   anvil   yunque sobre tocón con lingote al rojo y chispas (3)
 *   dummy   (Exploraciones) mapa de pergamino en un atril: camino que se dibuja hasta la X (8)
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
    /* ---------- Arcón / alijo (v4.96: Inventario) ---------- */
    // El típico alijo de los ARPG: arcón alargado y robusto de tablones gruesos con tapa abombada,
    // tres flejes de hierro remachados, cantoneras, patas de hierro y una gran cerradura dorada.
    // Quieto; al pasar el ratón (css/motion.css, .a-tent) la tapa se levanta un poco (0 → 2)
    // y asoma el brillo del oro de dentro.
    tent: { base: 30, frames: 3, draw(f) {
      const c = canvas(50, 32);
      const WD = { hi: '#c98a4b', l: '#a8693a', m: '#87512a', d: '#5f3519', dd: '#3b200d' };
      const IR = { hi: '#b9c0c8', l: '#8a929c', m: '#5a616b', d: '#353a42', dd: '#1f2329' };
      const GD = { hi: '#fff3b0', l: '#f2c94c', m: '#c8952a', d: '#7a5410' };
      const lift = [0, 2, 4][f];
      const X0 = 3, X1 = 46, Y0 = 15, Y1 = 28;   // caja
      c.rect(2, 30, 46, 2, 'rgba(0,0,0,.45)');
      // patas de hierro
      [[X0 + 1, Y1 + 1], [X1 - 3, Y1 + 1]].forEach(([x, y]) => c.rect(x, y, 3, 2, IR.d).set(x, y, IR.m));
      /* caja: tablones horizontales gruesos con vetas */
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        const row = Math.floor((y - Y0) / 4.5);
        c.set(x, y, x === X0 ? WD.l : x === X1 ? WD.dd : row % 2 ? WD.m : '#94592e');
      }
      [Y0 + 4, Y0 + 9].forEach((y) => c.rect(X0, y, X1 - X0 + 1, 1, WD.dd));
      [[9, 17], [30, 21], [16, 26], [37, 17], [41, 25]].forEach(([x, y]) => c.rect(x, y, 4, 1, WD.d));
      c.rect(X0, Y1, X1 - X0 + 1, 1, WD.dd);
      /* interior y oro cuando se levanta la tapa */
      if (lift) {
        c.rect(X0 + 1, Y0 - lift, X1 - X0 - 1, lift, '#140904');
        c.rect(X0 + 3, Y0 - 1, X1 - X0 - 5, 1, f === 2 ? GD.l : GD.d);
        if (f === 2) {
          for (let x = X0 + 4; x < X1 - 3; x += 3) c.set(x, Y0 - 2, (x % 2) ? GD.hi : GD.l);
          c.rect(20, Y0 - 3, 2, 1, '#93c5fd').rect(31, Y0 - 3, 2, 1, '#f87171').set(26, Y0 - 3, GD.hi);
        }
      }
      /* tapa abombada */
      const LY1 = Y0 - 1 - lift, LH = 9;
      for (let y = LY1 - LH; y <= LY1; y++) {
        const k = (LY1 - y) / LH, inset = Math.round(Math.pow(k, 2.2) * 5);
        for (let x = X0 - 1 + inset; x <= X1 + 1 - inset; x++) {
          const col = y === LY1 ? WD.dd : y === LY1 - 1 ? WD.d : k > 0.8 ? WD.hi : x <= X0 + inset ? WD.l : x >= X1 - inset ? WD.d : k > 0.5 ? WD.l : '#9a5f31';
          c.set(x, y, col);
        }
      }
      for (let x = X0 + 2; x <= X1 - 2; x++) c.set(x, LY1 - 5, WD.m);
      /* flejes de hierro (tapa y caja) con remaches */
      const band = (bx) => {
        for (let y = LY1 - LH; y <= LY1; y++) {
          const k = (LY1 - y) / LH, inset = Math.round(Math.pow(k, 2.2) * 5);
          if (bx < X0 + inset - 1 || bx + 2 > X1 + 1 - inset) continue;
          c.set(bx, y, IR.l).set(bx + 1, y, IR.m).set(bx + 2, y, IR.d);
        }
        c.rect(bx, Y0, 1, Y1 - Y0 + 1, IR.l).rect(bx + 1, Y0, 1, Y1 - Y0 + 1, IR.m).rect(bx + 2, Y0, 1, Y1 - Y0 + 1, IR.d);
        [Y0 + 2, Y0 + 7, Y0 + 12].forEach((y) => c.set(bx + 1, y, IR.hi));
        c.set(bx + 1, LY1 - 3, IR.hi).set(bx + 1, LY1 - 7, IR.hi);
      };
      band(8); band(39);
      // fleje horizontal del borde de la tapa y de la base
      c.rect(X0 - 1, LY1 - 1, X1 - X0 + 3, 1, IR.m).rect(X0 - 1, LY1, X1 - X0 + 3, 1, IR.dd);
      c.rect(X0, Y1 - 1, X1 - X0 + 1, 1, IR.m);
      for (let x = X0 + 2; x < X1; x += 5) c.set(x, Y1 - 1, IR.hi);
      // cantoneras
      [[X0 - 1, Y0], [X1 - 2, Y0], [X0 - 1, Y1 - 3], [X1 - 2, Y1 - 3]].forEach(([x, y], i) => c.rect(x, y, 4, 4, i % 2 ? IR.d : IR.m).set(x + 1, y + 1, IR.hi));
      // asas laterales
      c.rect(X0 - 2, 19, 1, 5, IR.d).rect(X1 + 2, 19, 1, 5, IR.dd);
      /* gran cerradura dorada */
      const ly = LY1 - 2;
      c.rect(21, ly, 8, 3, GD.m).rect(21, ly, 8, 1, GD.l).rect(28, ly, 1, 3, GD.d);       // pestillo de la tapa
      c.rect(20, Y0, 10, 8, GD.m).rect(20, Y0, 10, 1, GD.hi).rect(20, Y0 + 1, 1, 7, GD.l).rect(29, Y0, 1, 8, GD.d).rect(20, Y0 + 7, 10, 1, GD.d);
      c.rect(22, Y0 + 2, 6, 4, GD.l).set(24, Y0 + 3, '#2a1a06').set(25, Y0 + 3, '#2a1a06').rect(24, Y0 + 4, 2, 1, '#2a1a06');
      [[21, Y0 + 1], [28, Y0 + 1], [21, Y0 + 6], [28, Y0 + 6]].forEach(([x, y]) => c.set(x, y, GD.hi));
      // destello en la cerradura al abrir
      if (f === 2) c.set(26, Y0 - 1 - lift - LH + 3, '#fffbe6').set(22, Y0 + 1, '#fffbe6');
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
      // v4.95: UNA sola llama grande en forma de gota: los bordes ondulan hacia arriba (onda que sube),
      // la punta se mece, el cuerpo respira y por dentro sube un corazón claro. Capas rojo → naranja →
      // amarillo → blanco cálido.
      const col = ['#991b1b', '#dc2626', '#f97316', '#fbbf24', '#fef08a', '#fffbeb'];
      const BASE = 39, H = 30 + Math.sin(ph) * 2 + Math.sin(ph * 2 + 0.7) * 1.2, Wd = 9.5 + Math.sin(ph * 2) * 0.6, best = {};
      for (let y = Math.floor(BASE - H - 1); y <= BASE; y++) {
        const t = (BASE - y) / H; if (t < 0 || t > 1) continue;
        // eje: la punta se mece; ondas que suben por el cuerpo
        const cx = 22 + Math.sin(ph + t * 2.6) * 2.4 * t * t;
        const wave = 1 + 0.13 * Math.sin(t * 11 - ph * 2) * t;
        const half = Wd * Math.pow(1 - t, 0.7) * (t < 0.1 ? 0.78 + t * 2.2 : 1) * wave + 0.3;
        for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
          const d = Math.abs(x + 0.5 - cx) / half; if (d > 1) continue;
          const core = (1 - d) * (1 - t * 0.7) + 0.08 * Math.sin(ph * 2 - t * 9);
          const i = core > 0.72 && t < 0.42 ? 5 : core > 0.56 ? 4 : core > 0.4 ? 3 : core > 0.24 ? 2 : core > 0.1 ? 1 : 0;
          best[x + ',' + y] = i;
        }
      }
      // dos lengüecitas que se escapan de los lados
      [[-1, 0.55], [1, 1.9]].forEach(([sd, o]) => { const k = (Math.sin(ph * 2 + o) + 1) / 2, x = Math.round(22 + sd * (6 + k * 2)), y = Math.round(BASE - 12 - k * 7);
        if (k > 0.35) { best[x + ',' + y] = 2; best[x + ',' + (y + 1)] = 1; } });
      Object.entries(best).forEach(([k, i]) => { const [x, y] = k.split(',').map(Number); c.set(x, y, col[i]); });
      // troncos cruzados delante de la base del fuego (corteza y corte claro)
      for (let i = 0; i < 22; i++) {
        const y = 41 - Math.floor(i / 4);
        c.set(8 + i, y, W.d).set(8 + i, y + 1, W.m).set(8 + i, y + 2, i % 4 ? W.dd : W.d);
        c.set(35 - i, y, W.l).set(35 - i, y + 1, W.m).set(35 - i, y + 2, W.d);
      }
      c.rect(6, 40, 3, 3, '#d6b48a').set(7, 41, W.m).rect(35, 40, 3, 3, '#d6b48a').set(36, 41, W.m);
      // una lengüecita que se suelta de la punta
      { const t = (f % N) / N, y = Math.round(8 - t * 6), x = 22 + Math.round(Math.sin(ph) * 1.5); if (t < 0.6) c.set(x, y, t < 0.3 ? '#f59e0b' : '#dc2626'); }
      // piedras de delante (tapan la base del fuego)
      [[3, 41], [8, 43], [14, 44], [20, 44], [26, 44], [32, 43], [37, 41]].forEach(([x, y], i) => {
        c.rect(x, y, 5, 3, STONE.m).rect(x, y, 4, 1, STONE.l).set(x, y + 1, STONE.l).rect(x + 1, y + 2, 4, 1, STONE.d);
        c.set(x + 2, y, i % 2 ? '#fdba74' : '#fb923c'); // reflejo del fuego
      });
      // chispas que suben
      for (let k = 0; k < 4; k++) {
        const t = ((f + k * 1.37) % N) / N, y = Math.round(18 - t * 17), x = Math.round(22 + Math.sin(k * 2.4 + t * 6) * (4 + t * 8));
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
    // v4.88: Exploraciones: un MAPA de pergamino sobre un atril. Animado (8 fotogramas): un caminito
    // de puntos se va dibujando hasta la X roja, que late, y las esquinas del pergamino se mecen.
    dummy: { base: 18, frames: 8, draw(f) {
      const c = canvas(34, 36);
      c.rect(6, 34, 22, 2, 'rgba(0,0,0,.35)');
      // atril: dos patas y travesaño
      line(c, 9, 20, 6, 34, W.d); line(c, 10, 20, 7, 34, W.m);
      line(c, 24, 20, 27, 34, W.d); line(c, 23, 20, 26, 34, W.m);
      c.rect(16, 22, 2, 12, W.m).rect(16, 22, 1, 12, W.l);
      c.rect(7, 23, 20, 2, W.m).rect(7, 23, 20, 1, W.l);
      // pergamino (ligeramente inclinado: la parte de arriba más estrecha)
      const P = '#ead7ac', P2 = '#d9c08a', P3 = '#c4a66c';
      for (let y = 2; y <= 22; y++) { const inset = Math.round((22 - y) * 0.08); c.rect(3 + inset, y, 28 - inset * 2, 1, P); }
      c.rect(3, 22, 28, 1, P2);
      // rollos arriba y abajo (se mecen un pelín)
      const sway = [0, 0, 1, 1, 0, 0, -1, -1][f];
      c.rect(2 + sway, 1, 30, 2, P3).rect(2 + sway, 1, 30, 1, P2).set(1 + sway, 1, W.d).set(32 + sway, 1, W.d).set(1 + sway, 2, W.d).set(32 + sway, 2, W.d);
      c.rect(2, 22, 30, 2, P3).rect(2, 22, 30, 1, P2).set(1, 22, W.d).set(32, 22, W.d).set(1, 23, W.d).set(32, 23, W.d);
      // manchas de pergamino
      [[6, 6], [25, 18], [20, 5], [8, 17]].forEach(([x, y]) => c.set(x, y, P2));
      // mar en la esquina, con su costa y olas
      const coast = [21, 20, 20, 21, 22, 24, 26, 28];
      coast.forEach((cx, k) => { const y = 3 + k; c.rect(cx, y, 31 - cx - (y < 4 ? 1 : 0), 1, '#8fb8c8').set(cx, y, '#5f8fa3'); });
      [[25, 5], [28, 4], [27, 7]].forEach(([x, y]) => c.set(x, y, '#d6edf3').set(x + 1, y, '#d6edf3'));
      // montañas (dos picos nevados)
      const peak = (x, y) => { for (let k = 0; k < 3; k++) { c.rect(x - k, y + k, k * 2 + 1, 1, k ? '#8a7558' : '#f5f0e0'); c.set(x - k, y + k, '#6b5a44'); } };
      peak(7, 9); peak(11, 8);
      // bosquecillo
      [[8, 16], [11, 15], [13, 17]].forEach(([x, y]) => c.rect(x - 1, y, 3, 1, '#4c7a5a').set(x, y - 1, '#5f9470').set(x, y + 1, '#5c3d24'));
      // camino discontinuo hasta la X y un explorador (punto dorado) que lo recorre
      const path = [[5, 20], [6, 20], [7, 21], [8, 21], [9, 21], [10, 20], [11, 20], [12, 19], [13, 19], [14, 18], [15, 17], [16, 16], [17, 15], [18, 14], [19, 14], [20, 13], [21, 13], [22, 14], [23, 14]];
      path.forEach(([x, y], i) => { if (i % 3 !== 2) c.set(x, y, '#9a3412'); });
      const at = path[Math.min(path.length - 1, Math.round((f / 7) * (path.length - 1)))];
      c.rect(at[0], at[1] - 1, 2, 2, '#fbbf24').set(at[0], at[1] - 2, '#fde68a');
      // la X (late al llegar)
      const big = f >= 6;
      [[24, 15], [25, 16], [26, 17], [26, 15], [24, 17]].forEach(([x, y]) => c.set(x, y, '#dc2626'));
      if (big) [[23, 14], [27, 18], [27, 14], [23, 18]].forEach(([x, y]) => c.set(x, y, '#f87171'));
      // rosa de los vientos
      c.set(6, 4, '#7c2d12').set(6, 3, '#dc2626').set(5, 5, '#7c2d12').set(7, 5, '#7c2d12').set(6, 6, '#7c2d12').set(6, 5, '#e7c27a');
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
    lectern: { base: 24, frames: 12, draw(f) {
      const c = canvas(40, 38), G1 = '#fbbf24', G2 = '#b45309';
      const PY = 10, SX = 19.5, L = 17, K = 0.5; // arriba de las hojas, lomo, largo de hoja, inclinación
      const LEA = { l: '#6b2a52', m: '#4a1d3a', d: '#2e1024', dd: '#1d0a17' };
      // v4.95: pequeño ATRIL de madera debajo: tablero inclinado, columna torneada y pie en cruz
      const WO = { l: '#9a6b40', m: '#74502e', d: '#4f341c', dd: '#2f1f10' };
      c.rect(6, 36, 28, 2, 'rgba(0,0,0,.38)');
      c.rect(9, 34, 22, 2, WO.m).rect(9, 34, 22, 1, WO.l).rect(29, 34, 2, 2, WO.d).rect(8, 35, 1, 1, WO.d).rect(31, 35, 1, 1, WO.dd);
      c.rect(17, 25, 6, 10, WO.m).rect(17, 25, 2, 10, WO.l).rect(22, 25, 1, 10, WO.dd);
      [27, 31].forEach((y) => c.rect(16, y, 8, 1, WO.d).set(16, y, WO.m));
      c.rect(3, PY + 13, 34, 3, WO.m).rect(3, PY + 13, 34, 1, WO.l).rect(3, PY + 15, 34, 1, WO.d).rect(2, PY + 14, 1, 1, WO.d).rect(37, PY + 14, 1, 1, WO.dd);
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
