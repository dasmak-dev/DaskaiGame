#!/usr/bin/env node
/* =============================================================
 * tests/run.js — Ejecuta todas las pruebas.
 *
 *     npm test                     (o: node tests/run.js)
 *     node tests/run.js battle     sólo las pruebas cuyo nombre contenga «battle»
 *
 * 1. tools/check.js (sintaxis, datos JSON y textos en los dos idiomas).
 * 2. Cada tests/*.test.js en Chromium, en escritorio y en móvil si la
 *    prueba lo pide (`views`). Necesita Playwright:
 *        npm install            (una vez)
 *        npx playwright install chromium
 * Termina con código 1 si algo falla.
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { VIEWS } = require('./helpers');

const filter = process.argv[2] || '';
let failed = 0, passed = 0;
const t0 = Date.now();
const ok = (name, ms) => { passed++; console.log(`  ✓ ${name} (${(ms / 1000).toFixed(1)} s)`); };
const ko = (name, e) => { failed++; console.log(`  ✗ ${name}\n      ${String(e && e.message || e).split('\n').join('\n      ')}`); };

(async () => {
  // 1. Comprobaciones estáticas
  console.log('Comprobaciones');
  const s0 = Date.now();
  try { execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'check.js')], { stdio: 'pipe' }); ok('tools/check.js', Date.now() - s0); }
  catch (e) { ko('tools/check.js', String(e.stdout || e.message).trim()); }

  // 2. Pruebas en el navegador
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) {
    console.log('\n⚠ Falta Playwright para las pruebas en el navegador: npm install && npx playwright install chromium');
    process.exit(failed ? 1 : 0);
  }
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js') && f.includes(filter)).sort();
  for (const f of files) {
    const test = require(path.join(__dirname, f));
    console.log(`\n${test.name || f}`);
    for (const c of test.cases) {
      for (const v of c.views || ['desktop']) {
        const name = `${c.name}${(c.views || []).length > 1 ? ` [${v}]` : ''}`;
        const s = Date.now();
        try {
          await Promise.race([c.run(browser, VIEWS[v], v), new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo agotado (60 s)')), 60000))]);
          ok(name, Date.now() - s);
        } catch (e) { ko(name, e); }
      }
    }
  }
  await browser.close();
  console.log(`\n${failed ? '✗' : '✓'} ${passed} correctas, ${failed} fallidas · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(failed ? 1 : 0);
})();
