// Genera css/cursor.css: guantelete de metal que señala (dorado; turquesa sobre lo que se puede pulsar)
const fs = require('fs');
const defs = () => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset=".35" stop-color="#e9c46a"/><stop offset=".7" stop-color="#b07d2b"/><stop offset="1" stop-color="#6b4513"/></linearGradient>
${metal('gold')}${metal('teal')}<filter id="sh" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="1.3" dy="1.6" stdDeviation=".9" flood-color="#000" flood-opacity=".55"/></filter></defs>`;
// v4.95: GUANTELETE con volumen: mano derecha vista por el dorso, índice estirado (3 placas),
// corazón/anular/meñique doblados (sólo se ven sus nudillos), pulgar recogido a un lado,
// placa del dorso con remache-gema y brazal acampanado. Luz arriba a la izquierda, sombra
// proyectada (feDropShadow) y reflejos. Se dibuja derecho (punta del dedo en 9,0), se gira -36°.
const PAL = {
  gold: { hi: '#fff4c8', a: '#f3d27a', b: '#c9973c', c: '#8a5a1c', d: '#4a2c0c', line: '#3a220a', gem: ['#ffd1d1', '#e0413a', '#7a1010'] },
  teal: { hi: '#e8fffd', a: '#8fe9e2', b: '#2fb4b0', c: '#16737a', d: '#0a3a40', line: '#06282d', gem: ['#fff6c8', '#f2b632', '#7a4f08'] },
};
const metal = (k) => `<linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PAL[k].hi}"/><stop offset=".3" stop-color="${PAL[k].a}"/><stop offset=".65" stop-color="${PAL[k].b}"/><stop offset="1" stop-color="${PAL[k].c}"/></linearGradient>
<linearGradient id="${k}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${PAL[k].a}"/><stop offset=".45" stop-color="${PAL[k].b}"/><stop offset="1" stop-color="${PAL[k].d}"/></linearGradient>
<radialGradient id="${k}g" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="${PAL[k].gem[0]}"/><stop offset=".45" stop-color="${PAL[k].gem[1]}"/><stop offset="1" stop-color="${PAL[k].gem[2]}"/></radialGradient>`;
const gauntlet = (tone = 'gold') => {
  const P = PAL[tone], M = `url(#${tone}m)`, S = `url(#${tone}s)`, O = P.line, sw = 1.1;
  const plate = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${S}" stroke="${O}" stroke-width="${sw}"/><path d="M${x + 1.1} ${y + r} V${y + h - 1}" stroke="${P.hi}" stroke-opacity=".85" stroke-width=".9" stroke-linecap="round"/>`;
  return `<g filter="url(#sh)"><g transform="translate(2 2) scale(.8) rotate(-36) translate(-9 0)" stroke-linejoin="round" stroke-linecap="round">
  <!-- brazal acampanado -->
  <path d="M5 25.5 L23.5 25.5 L26.5 35 L2 35 Z" fill="${M}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M4.6 28.4 L24.4 28.4" stroke="${P.d}" stroke-width="1"/><path d="M3 33.6 L25.6 33.6" stroke="${P.hi}" stroke-opacity=".6" stroke-width=".8"/>
  <circle cx="7.5" cy="31" r=".95" fill="${P.hi}" stroke="${P.d}" stroke-width=".4"/><circle cx="14.2" cy="31" r=".95" fill="${P.hi}" stroke="${P.d}" stroke-width=".4"/><circle cx="20.9" cy="31" r=".95" fill="${P.hi}" stroke="${P.d}" stroke-width=".4"/>
  <!-- nudillos de los dedos doblados (corazón, anular, meñique) -->
  <path d="M12 17 Q12 11.2 14.6 11.2 Q17.2 11.2 17.2 16 Z" fill="${S}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M16.6 17 Q16.6 11.8 19.1 11.8 Q21.6 11.8 21.6 16.4 Z" fill="${S}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M21 17.4 Q21 13.2 23 13.2 Q25 13.2 25 17.4 Z" fill="${S}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M13.3 12.8 Q14.4 12 15.6 12.6 M17.9 13.4 Q19 12.6 20.2 13.2 M22 14.6 Q22.9 14 23.8 14.5" fill="none" stroke="${P.hi}" stroke-opacity=".9" stroke-width=".8"/>
  <!-- dorso de la mano -->
  <path d="M5.2 16 Q5 14.4 6.8 14.4 L23.8 15.6 Q25.6 15.8 25.4 17.8 L24.4 25 Q24.2 26.6 22.4 26.6 L7 26.6 Q5.2 26.6 5.2 24.8 Z" fill="${M}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M7.4 16.4 L22.6 17.2" stroke="${P.hi}" stroke-opacity=".7" stroke-width=".9"/>
  <path d="M15.2 17.4 L14.8 25.6" stroke="${P.d}" stroke-opacity=".55" stroke-width=".8"/>
  <path d="M6.2 22.6 Q15 24 24.4 22.2" fill="none" stroke="${P.d}" stroke-opacity=".5" stroke-width=".8"/>
  <circle cx="15" cy="20.6" r="2.1" fill="url(#${tone}g)" stroke="${O}" stroke-width=".8"/><circle cx="14.3" cy="19.9" r=".6" fill="#fff"/>
  <!-- pulgar recogido a la izquierda -->
  <path d="M5.8 25 Q2 23.6 1.6 19.6 Q1.4 16.6 4 15.8 Q6 15.4 6.8 17.6 Q7.6 20.4 8.4 22.4 Z" fill="${S}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M2.6 19.4 Q2.8 17.2 4.3 16.8" fill="none" stroke="${P.hi}" stroke-opacity=".9" stroke-width=".8"/><path d="M2.4 21 Q4.4 20.4 6.4 21.2" fill="none" stroke="${P.d}" stroke-opacity=".6" stroke-width=".7"/>
  <!-- índice estirado: tres placas que se solapan (la de la punta, redondeada) -->
  ${plate(6.6, 10, 6, 7.6, 1.6)}
  ${plate(6.2, 5.2, 6.4, 5.8, 1.6)}
  <path d="M6 2.8 Q6 0 9.2 0 Q12.4 0 12.4 2.8 L12.4 6.4 L6 6.4 Z" fill="${S}" stroke="${O}" stroke-width="${sw}"/>
  <path d="M7.1 2.6 Q7.4 1.1 9 1" fill="none" stroke="${P.hi}" stroke-width=".9"/>
  <path d="M6.4 6.3 H12.2 M6.8 11 H12.4" stroke="${P.d}" stroke-width=".8"/>
</g></g>`;
};
// Insignia abajo a la izquierda (el hueco que deja el guantelete)
const badge = (inner) => `<g transform="translate(-15.8 1.5)"><circle cx="23.5" cy="23.5" r="6.6" fill="#1a1020" stroke="#e9c46a" stroke-width="1.5"/>${inner}</g>`;
const arrow = () => gauntlet('gold');
const C = {
  default: [gauntlet('gold'), 2, 2, 'default'],
  pointer: [gauntlet('teal'), 2, 2, 'pointer'],
  help: [arrow() + badge(`<path d="M21 21.2c0-1.6 1.2-2.6 2.6-2.6s2.6 1 2.6 2.4c0 1.9-2.4 1.9-2.4 3.7" fill="none" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round"/><circle cx="23.8" cy="27.4" r="1.1" fill="#fde68a"/>`), 2, 2, 'help'],
  notAllowed: [arrow() + badge(`<circle cx="23.5" cy="23.5" r="4.2" fill="none" stroke="#ef4444" stroke-width="1.8"/><path d="M20.6 26.4 L26.4 20.6" stroke="#ef4444" stroke-width="1.8"/>`), 2, 2, 'not-allowed'],
  wait: [arrow() + badge(`<path d="M20.5 19.5h6M20.5 27.5h6M21.2 19.5c0 3 4.6 3 4.6 4s-4.6 1-4.6 4M25.8 19.5c0 3-4.6 3-4.6 4s4.6 1 4.6 4" fill="none" stroke="#fde68a" stroke-width="1.3" stroke-linecap="round"/>`), 2, 2, 'progress'],
  grab: [`<g filter="url(#sh)"><path d="M9 14V7.5a1.6 1.6 0 0 1 3.2 0V13V5.6a1.6 1.6 0 0 1 3.2 0V13V6.6a1.6 1.6 0 0 1 3.2 0V13.6V9a1.6 1.6 0 0 1 3.2 0v8.6c0 5-3 8.4-7.6 8.4c-3.4 0-5.2-1.6-6.8-4.2l-3-5a1.7 1.7 0 0 1 2.8-1.9z" fill="url(#g)" stroke="#1a0f0a" stroke-width="1.5" stroke-linejoin="round"/></g>`, 14, 14, 'grab'],
  grabbing: [`<g filter="url(#sh)"><path d="M8 15.5v-3a1.6 1.6 0 0 1 3.2 0V12a1.6 1.6 0 0 1 3.2 0v-.4a1.6 1.6 0 0 1 3.2 0v.6a1.6 1.6 0 0 1 3.2 0v5.8c0 5-3 8.4-7.6 8.4c-3.4 0-5.6-1.6-7-4.4z" fill="url(#g)" stroke="#1a0f0a" stroke-width="1.5" stroke-linejoin="round"/></g>`, 14, 14, 'grabbing'],
  text: [`<g filter="url(#sh)"><path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="#1a0f0a" stroke-width="3.6" stroke-linecap="round"/><path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="url(#g)" stroke-width="1.8" stroke-linecap="round"/></g>`, 16, 16, 'text'],
  zoom: [arrow() + badge(`<circle cx="22.8" cy="22.8" r="3" fill="none" stroke="#fde68a" stroke-width="1.6"/><path d="M25 25l2.4 2.4" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round"/>`), 2, 2, 'zoom-in'],
};
const url = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${defs()}${body}</svg>`).replace(/'/g, '%27')}")`;
const vars = Object.entries(C).map(([k, [b, x, y, fb]]) => `  --cur-${k}: ${url(b)} ${x} ${y}, ${fb};`).join('\n');
const nat = Object.entries(C).map(([k, [, , , fb]]) => `--cur-${k}: ${fb};`).join(' ');
const css = `/* =============================================================
 * css/cursor.css — Cursores propios (v4.93), generados con node tools/cursors.js.
 * Guantelete de metal con el índice apuntando: dorado normal y TURQUESA sobre botones y
 * enlaces; variantes con insignia: ayuda (?), prohibido, espera y lupa; texto y agarrar.
 * Las hojas de estilo usan var(--cur-*) en vez de los cursores del sistema. Se carga la PRIMERA
 * y con :where() (especificidad 0) para que cualquier regla del juego mande.
 * Ajustes → Cursor del juego (settings.customCursor) → html[data-cursor="native"].
 * ============================================================= */
:root {
${vars}
}
:root[data-cursor="native"] { ${nat} }
@media (pointer: coarse) { :root { ${nat} } }
html { cursor: var(--cur-default); }
:where(a[href], button:not(:disabled), [role="button"], [role="tab"], summary, label[for], select, input[type="checkbox"], input[type="radio"], input[type="range"]) { cursor: var(--cur-pointer); }
:where(input:not([type]), input[type="text"], input[type="search"], input[type="number"], textarea, [contenteditable="true"]) { cursor: var(--cur-text); }
:where(button:disabled, [aria-disabled="true"]) { cursor: var(--cur-notAllowed); }
html.is-busy, html.is-busy * { cursor: var(--cur-wait) !important; }
`;
fs.writeFileSync(require('path').join(__dirname, '..', 'css', 'cursor.css'), css);
console.log(css.length);
// vista previa

