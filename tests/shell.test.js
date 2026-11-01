/* Aspecto de juego: campamento, HUD, barra de accesos, menú de pausa y cortinillas. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Campamento y carcasa',
  cases: [{
    name: 'El campamento lleva a cada sección y el muñeco está bloqueado al empezar',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('hub')); await sleep(400);
      const n = await p.$$eval('.camp-spot', (els) => els.length);
      check(n === 7, `deberían verse 7 lugares (hay ${n})`);
      check(await p.$('.camp-spot.s-dummy.locked'), 'el entrenamiento debería estar bloqueado');
      const tent = await p.$('.camp-spot.s-tent');
      if (view.touch) await tent.tap(); else await tent.click();
      await sleep(400);
      check((await p.evaluate(() => DK.router.current().id)) === 'inventory', 'la tienda debería abrir el inventario');
      check(await p.$('.game-dock .dock-slot'), 'falta la barra de accesos');
      check(!(await p.$('.side-nav .nav-item')), 'no debería quedar barra lateral');
    }),
  }, {
    name: 'Esc en el campamento abre el menú de pausa',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('hub')); await sleep(300);
      await p.keyboard.press('Escape'); await sleep(300);
      check(await p.$('.pause-menu'), 'no se abre la pausa');
      await p.keyboard.press('Escape'); await sleep(300);
      check(!(await p.$('.pause-menu')), 'Esc debería cerrar la pausa');
    }),
  }, {
    name: 'Al entrar en un mapa sale la cortinilla de la zona sin bloquear la pantalla',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.expedition.start({}); DK.router.reset('expedition'); });
      await sleep(150);
      const r = await p.evaluate(() => { const c = document.querySelector('.curtain'); return c ? { pe: getComputedStyle(c).pointerEvents, text: c.textContent } : null; });
      check(r, 'no sale la cortinilla');
      check(r.pe === 'none', 'la cortinilla no debe bloquear los clics');
      check(r.text.includes(await p.evaluate(() => DK.data.zones[DK.expedition.active().zone].name)), 'la cortinilla no lleva el nombre de la zona');
      await p.evaluate(() => DK.router.refresh()); await sleep(1100);
      check(!(await p.$('.curtain')), 'la cortinilla no desaparece o se repite al repintar');
    }),
  }, {
    name: 'Al entrar en combate, la cortinilla tapa la pantalla y el combate aparece detrás',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.settings.set('skipAnims', false); DK.router.go('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid, boss: true, final: true }); });
      await sleep(60);
      const before = await p.evaluate(() => ({ curtain: !!document.querySelector('.curtain.k-boss'), screen: DK.router.current().id }));
      check(before.curtain, 'no sale la cortinilla del jefe');
      check(before.screen !== 'battle', 'el combate no debería verse antes de tapar la pantalla');
      await sleep(600);
      check((await p.evaluate(() => DK.router.current().id)) === 'battle', 'el combate no se ha montado tras la cortinilla');
      check(await p.$('.curtain.show .curtain-card'), 'falta la cinta con el nombre del jefe');
      await sleep(1700);
      check(!(await p.$('.curtain')), 'la cortinilla no desaparece');
    }),
  }, {
    name: 'La música se pausa al minimizar el juego y vuelve al abrirlo',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.mouse.click(5, 300); await sleep(300); // primera interacción: crea el audio
      await p.evaluate(() => { DK.settings.set('muted', false); DK.audio.music(null); DK.audio.music('menu'); });
      await sleep(400);
      const vis = (state) => p.evaluate((st) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st }); document.dispatchEvent(new Event('visibilitychange')); }, state);
      const before = await p.evaluate(() => DK.audio.playing());
      await vis('hidden'); await sleep(400);
      const hiddenNow = await p.evaluate(() => DK.audio.playing());
      await vis('visible'); await sleep(500);
      const after = await p.evaluate(() => DK.audio.playing());
      check(before, 'la música no estaba sonando al empezar la prueba');
      check(!hiddenNow, 'la música sigue sonando con el juego minimizado');
      check(after, 'la música no vuelve al abrir el juego');
    }),
  }],
};
