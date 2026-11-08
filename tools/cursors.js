// Genera css/cursor.css: guantelete de metal que señala (dorado; turquesa sobre lo que se puede pulsar)
const fs = require('fs');
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset=".35" stop-color="#e9c46a"/><stop offset=".7" stop-color="#b07d2b"/><stop offset="1" stop-color="#6b4513"/></linearGradient>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eafffd"/><stop offset=".35" stop-color="#6fe0d8"/><stop offset=".7" stop-color="#1f8f96"/><stop offset="1" stop-color="#0d4650"/></linearGradient></defs>`;
// v4.94: GUANTELETE de metal con el índice apuntando arriba a la izquierda (punta en 2,2).
// Se dibuja derecho (punta del dedo en 8,0) y se gira -38° y se escala.
const metal = { gold: 'g', teal: 'm' };
const gauntlet = (tone = 'gold') => {
  const F = `url(#${metal[tone]})`, O = '#1a0f0a', HL = tone === 'teal' ? '#e9fffd' : '#fff8dc', SH = tone === 'teal' ? '#0b3a42' : '#5b3a10';
  return `<g transform="translate(2 2) scale(.85) rotate(-38) translate(-8 0)" stroke-linejoin="round">
  <path d="M5.5 24 L20.5 24 L23 32 L3.5 32 Z" fill="${F}" stroke="${O}" stroke-width="1.5"/>
  <path d="M4.6 27.6 L21.8 27.6" stroke="${SH}" stroke-width="1"/><circle cx="8" cy="30" r=".9" fill="${HL}"/><circle cx="13.3" cy="30" r=".9" fill="${HL}"/><circle cx="18.6" cy="30" r=".9" fill="${HL}"/>
  <circle cx="13.6" cy="12.6" r="2.5" fill="${F}" stroke="${O}" stroke-width="1.3"/><circle cx="17.2" cy="12.9" r="2.5" fill="${F}" stroke="${O}" stroke-width="1.3"/><circle cx="20.6" cy="13.8" r="2.4" fill="${F}" stroke="${O}" stroke-width="1.3"/>
  <path d="M3.5 14 Q3.5 11.2 6.5 11.2 L19.5 11.4 Q23 11.6 23 15.2 L23 21 Q23 25 19 25 L7.2 25 Q3.5 25 3.5 21.2 Z" fill="${F}" stroke="${O}" stroke-width="1.5"/>
  <path d="M12 14 V20.5 M15.6 14 V20.8 M19.2 14.4 V20.6" stroke="${SH}" stroke-width=".9" stroke-linecap="round"/>
  <path d="M5 2.6 Q5 0 8 0 Q11 0 11 2.6 L11 14.5 L5 14.5 Z" fill="${F}" stroke="${O}" stroke-width="1.5"/>
  <path d="M5.4 5.6 H10.6 M5.4 10 H10.6" stroke="${SH}" stroke-width=".9"/><path d="M6.4 1.8 V13" stroke="${HL}" stroke-opacity=".8" stroke-width="1" stroke-linecap="round"/>
  <path d="M3.6 16.2 Q8.4 15.2 12.4 18 Q13.4 20.8 10.6 21.3 Q7 20.4 3.6 20.6 Z" fill="${F}" stroke="${O}" stroke-width="1.3"/>
  <path d="M4.6 17 Q8 16.4 11 18.2" fill="none" stroke="${HL}" stroke-opacity=".75" stroke-width=".9" stroke-linecap="round"/>
  <path d="M7 24.6 L19.4 24.6" stroke="${HL}" stroke-opacity=".5" stroke-width=".8"/>
</g>`;
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
  grab: [`<path d="M9 14V7.5a1.6 1.6 0 0 1 3.2 0V13V5.6a1.6 1.6 0 0 1 3.2 0V13V6.6a1.6 1.6 0 0 1 3.2 0V13.6V9a1.6 1.6 0 0 1 3.2 0v8.6c0 5-3 8.4-7.6 8.4c-3.4 0-5.2-1.6-6.8-4.2l-3-5a1.7 1.7 0 0 1 2.8-1.9z" fill="url(#g)" stroke="#1a0f0a" stroke-width="1.5" stroke-linejoin="round"/>`, 14, 14, 'grab'],
  grabbing: [`<path d="M8 15.5v-3a1.6 1.6 0 0 1 3.2 0V12a1.6 1.6 0 0 1 3.2 0v-.4a1.6 1.6 0 0 1 3.2 0v.6a1.6 1.6 0 0 1 3.2 0v5.8c0 5-3 8.4-7.6 8.4c-3.4 0-5.6-1.6-7-4.4z" fill="url(#g)" stroke="#1a0f0a" stroke-width="1.5" stroke-linejoin="round"/>`, 14, 14, 'grabbing'],
  text: [`<path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="#1a0f0a" stroke-width="3.6" stroke-linecap="round"/><path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="url(#g)" stroke-width="1.8" stroke-linecap="round"/>`, 16, 16, 'text'],
  zoom: [arrow() + badge(`<circle cx="22.8" cy="22.8" r="3" fill="none" stroke="#fde68a" stroke-width="1.6"/><path d="M25 25l2.4 2.4" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round"/>`), 2, 2, 'zoom-in'],
};
const url = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${defs}${body}</svg>`).replace(/'/g, '%27')}")`;
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

