/* =============================================================
 * tests/helpers.js — Utilidades para las pruebas en el navegador.
 *
 * Abren index.html en Chromium (Playwright) con una partida nueva.
 * Las pruebas no tocan tus partidas: cada página es un perfil nuevo.
 * ============================================================= */
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Vistas en las que se repite cada prueba de interfaz. */
const VIEWS = {
  desktop: { width: 1366, height: 900, touch: false },
  mobile: { width: 390, height: 844, touch: true },
};

/**
 * Abre el juego con una partida nueva (sin tutoriales ni animaciones).
 * @returns {Promise<Page>} página con `errors` (errores de JavaScript de la página)
 */
async function newGame(browser, view = VIEWS.desktop, { name = 'Prueba', slot = 3 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, colorScheme: 'dark', hasTouch: view.touch, isMobile: view.touch });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.DK && DK.router);
  await page.evaluate((slot) => { DK.settings.set('tutorials', false); DK.settings.set('skipAnims', true); DK.router.reset('newGame', { slot }); }, slot);
  await sleep(250);
  await page.fill('.hero-card input', name);
  await page.keyboard.press('Enter'); await sleep(250);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.waitForFunction(() => !!DK.store.state);
  return page;
}

/** Comprobación con mensaje claro. */
function check(cond, msg) { if (!cond) throw new Error(msg); }

/**
 * Abre una partida nueva, ejecuta `fn(page)`, comprueba que no ha habido
 * errores de JavaScript y cierra la página.
 */
async function play(browser, view, fn, opts) {
  const page = await newGame(browser, view, opts);
  try {
    await fn(page);
    check(!page.errors.length, 'Errores de JavaScript en la página: ' + page.errors.join(' | '));
  } finally { await page.context().close(); }
}

/** Ancho del documento mayor que la ventana = scroll horizontal (algo se sale). */
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

module.exports = { URL, VIEWS, sleep, newGame, play, check, overflowX };
