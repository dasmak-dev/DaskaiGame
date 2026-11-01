/* Todas las pantallas principales se abren sin errores ni scroll horizontal. */
const { play, sleep, check, overflowX } = require('./helpers');

const SCREENS = [['hub', {}], ['team', {}], ['inventory', {}], ['craft', {}], ['zones', {}], ['codex', {}], ['codex', { tab: 'items' }], ['codex', { tab: 'bosses' }],
  ['progress', {}], ['progress', { tab: 'ach' }], ['profile', {}], ['settings', {}], ['training', {}], ['expPrepare', {}]];

module.exports = {
  name: 'Pantallas',
  cases: [{
    name: 'Se abren todas sin errores ni scroll horizontal',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        ['umbrix', 'aquelo', 'terron'].forEach((s, i) => DK.party.add(DK.daskai.create(s, 6 + i)));
        Object.keys(DK.data.items).slice(0, 25).forEach((id) => DK.bag.add(id, 2));
        DK.wallet.add(2000, { silent: true });
      });
      for (const [id, params] of SCREENS) {
        await p.evaluate(([id, params]) => DK.router.reset(id, params), [id, params]);
        await sleep(250);
        const over = await overflowX(p);
        check(over <= 1, `«${id}» se sale ${over}px por la derecha`);
      }
      // Expedición: mapa, barra de estado y resumen
      await p.evaluate(() => { DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0); DK.router.reset('expedition'); });
      await sleep(400);
      check((await overflowX(p)) <= 1, 'el mapa de la expedición se sale por la derecha');
      await p.evaluate(() => { DK.expedition.retreat() || DK.expedition.complete(); DK.ui.closeAll(); DK.router.reset('expSummary'); });
      await sleep(300);
    }),
  }],
};
