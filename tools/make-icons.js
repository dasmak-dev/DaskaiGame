/* =============================================================
 * tools/make-icons.js — Genera los iconos de la app (v4.73).
 *
 *   node tools/make-icons.js [especie] [semilla] [casa2]
 *
 * Dibuja un daskai del propio juego (systems/looks.js) sobre un fondo
 * redondeado y escribe en icons/:
 *   icon.svg              favicon fijo (antes de que cargue el juego)
 *   icon-192.png, icon-512.png       app instalada (purpose any)
 *   icon-maskable-512.png            Android adaptativo (zona segura 80 %)
 *   apple-touch-icon.png (180)       iPhone / iPad
 * En el juego el favicon cambia a un daskai al azar (DK.app.favicon).
 * Necesita Playwright (npm i -D playwright) y su Chromium.
 * ============================================================= */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const [sid = 'llamarin', seed = '', h2 = ''] = process.argv.slice(2);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.DK && DK.looks && DK.data);
  // Compone el SVG: fondo (cuadrado lleno o redondeado) + resplandor de su casa + el daskai
  const make = (o) => p.evaluate(({ sid, seed, h2, round, scale }) => {
    const D = DK.data, look = seed || h2 ? Object.assign(seed ? { s: +seed >>> 0 } : {}, h2 ? { h2 } : {}) : null;
    const mon = DK.looks.svg(sid, look);
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(mon).slice(1).map(Number);
    const c1 = D.houseColor(D.species[sid].house), c2 = h2 ? D.houseColor(h2) : c1;
    // El daskai ocupa «scale» del lado, centrado (ya trae su propia sombra)
    const S = 512, side = S * scale, k = side / Math.max(vb[2], vb[3]), w = vb[2] * k, hh = vb[3] * k;
    const x = (S - w) / 2, y = (S - hh) / 2;
    const inner = mon.replace(/^<svg /, `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" `);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">` +
      `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2160"/><stop offset="1" stop-color="#0b0d1a"/></linearGradient>` +
      `<radialGradient id="gl" cx="50%" cy="58%" r="50%"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset=".6" stop-color="${c2}" stop-opacity=".18"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="${S}" height="${S}" ${round ? 'rx="112"' : ''} fill="url(#bg)"/>` +
      `<ellipse cx="256" cy="300" rx="230" ry="210" fill="url(#gl)"/>` +
      inner.replace(/ role="img"/, '') + `</svg>`;
  }, { sid, seed, h2, ...o });

  const shot = async (svg, size, file) => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(ROOT, 'icons', file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  const rounded = await make({ round: true, scale: 0.78 });
  const full = await make({ round: false, scale: 0.78 });
  const mask = await make({ round: false, scale: 0.6 }); // zona segura de Android: el 80 % central
  fs.writeFileSync(path.join(ROOT, 'icons', 'icon.svg'), rounded);
  await shot(rounded, 192, 'icon-192.png');
  await shot(rounded, 512, 'icon-512.png');
  await shot(mask, 512, 'icon-maskable-512.png');
  await shot(full, 180, 'apple-touch-icon.png'); // iOS redondea solo las esquinas
  await b.close();
  console.log('Iconos de ' + sid + ' escritos en icons/');
})();
