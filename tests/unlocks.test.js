/* Pactos y reliquias iniciales desbloqueables con emblemas, y el equipo en la expedición. */
const { play, sleep, check, overflowX } = require('./helpers');

module.exports = {
  name: 'Desbloqueos y equipo en expedición',
  cases: [{
    name: 'Sin desbloquear no hay pactos ni reliquia inicial; al desbloquear sólo salen ésos',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        DK.expedition.start({}); const e = DK.expedition.active();
        const before = { offer: e.curseOffer, relics: (e.relicChoice || []).length, blocked: DK.expedition.available().length > 0 };
        DK.store.state.expedition = null;
        const poor = DK.camp.unlock('relic', 'trebol');
        DK.camp.addEmblems(3);
        const ok1 = DK.camp.unlock('relic', 'trebol'), ok2 = DK.camp.unlock('curse', 'feroces'), again = DK.camp.unlock('relic', 'trebol');
        DK.expedition.start({}); const e2 = DK.expedition.active();
        return { before, poor, ok1, ok2, again, left: DK.camp.emblems(), offer: e2.curseOffer, relics: e2.relicChoice };
      });
      check(r.before.offer === null && r.before.relics === 0, 'sin desbloqueos no debería haber pactos ni reliquia inicial');
      check(r.before.blocked, 'sin pactos ni reliquia el mapa debería poder jugarse');
      check(!r.poor && r.ok1 && r.ok2 && !r.again, 'desbloquear no cobra o no comprueba los emblemas');
      check(r.left === 0, 'el precio no es el esperado (1 + 2 emblemas)');
      check(JSON.stringify(r.offer) === '["feroces"]' && JSON.stringify(r.relics) === '["trebol"]', 'salen pactos o reliquias no desbloqueados');
    }),
  }, {
    name: 'El menú de Mejoras tiene pestañas de reliquias y pactos',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.camp.addEmblems(2); DK.views.upgradeMenu(); });
      await sleep(400);
      check((await p.$$('.um-tab')).length === 3, 'faltan pestañas');
      await p.click('.um-tab >> nth=1'); await sleep(250);
      check((await p.$$('.um-tile.r-comun')).length >= 1, 'no salen las reliquias');
      await p.click('.um-tile.r-comun .um-buy >> nth=0'); await sleep(250);
      check((await p.$$('.um-tile.owned')).length === 1, 'no se desbloquea desde el menú');
      await p.click('.um-tab >> nth=2'); await sleep(250);
      check((await p.$$('.um-tile.is-curse')).length >= 1, 'no salen los pactos');
      check((await overflowX(p)) <= 1, 'el menú se sale por la derecha');
    }),
  }, {
    name: 'En la expedición el equipo ocupa siempre 6 huecos del mismo tamaño',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.expedition.start({}); DK.router.reset('expedition'); });
      await sleep(1200);
      const r = await p.evaluate(() => ({ slots: [...document.querySelectorAll('.tb-slot')].map((e) => Math.round(e.getBoundingClientRect().width)), cards: document.querySelectorAll('.tb-card').length }));
      check(r.slots.length === 6 && r.cards === 1, 'deberían ser 6 huecos con 1 daskai: ' + JSON.stringify(r));
      check(Math.max(...r.slots) - Math.min(...r.slots) <= 2, 'los huecos no miden lo mismo: ' + JSON.stringify(r.slots));
      check((await overflowX(p)) <= 1, 'la barra del equipo se sale por la derecha');
    }),
  }],
};
