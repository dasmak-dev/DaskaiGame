/* Expediciones: encargos, barra de estado sin repintar el mapa y cronología. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Expedición',
  cases: [{
    name: 'Un encargo cumplido se cobra al vencer al jefe y sale en la cronología',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const E = DK.expedition; E.start({}); DK.curses.accept([]); DK.relics.choose(0);
        const e = E.active(); e.quest = { id: 'breaks', target: 1, prog: 0, failed: false, done: false, claimed: false };
        E.questTrack('break');
        const coins = e.loot.coins; E.bossCleared();
        const c = E.choiceInfo();
        return { done: c.quest && !!c.quest.reward, gained: e.loot.coins - coins, tl: e.log.timeline.map((x) => x.k) };
      });
      check(r.done && r.gained > 0, 'el encargo no se ha cobrado');
      check(r.tl.includes('quest') && r.tl.includes('mapCleared'), 'falta el encargo en la cronología');
    }),
  }, {
    name: 'Usar una poción falla el encargo «Sin pociones»',
    run: (browser, view) => play(browser, view, async (p) => {
      const failed = await p.evaluate(() => {
        const E = DK.expedition; E.start({}); DK.curses.accept([]); DK.relics.choose(0);
        E.active().quest = { id: 'noItems', target: 0, prog: 0, failed: false, done: false, claimed: false };
        DK.bag.add('pocion', 1); const d = DK.party.active()[0]; d.cur.hp = 1; DK.bag.use('pocion', d);
        return E.active().quest.failed;
      });
      check(failed, 'el encargo debería fallar');
    }),
  }, {
    name: 'La barra de estado abre su detalle sin repintar el mapa',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0); DK.bag.add('pocion', 2); DK.router.reset('expedition'); });
      await sleep(500);
      await p.evaluate(() => { document.querySelector('.exp-map-card').dataset.mark = '1'; });
      const b = await p.$('.hud-btn[data-hud="pack"]');
      if (view.touch) await b.tap(); else await b.click();
      await sleep(300);
      check(await p.$('.exp-hud-pop'), 'no se abre el detalle');
      check(await p.$('.exp-map-card[data-mark="1"]'), 'el mapa se ha repintado (parpadeo)');
      await p.keyboard.press('Escape'); await sleep(200);
      check(!(await p.$('.exp-hud-pop')), 'Esc no cierra el detalle');
      const card = (await p.$$('.tb-card'))[1];
      if (card) { if (view.touch) await card.tap(); else await card.click(); await sleep(200); }
      check(await p.$('.exp-map-card[data-mark="1"]'), 'elegir quién lucha repinta el mapa');
    }),
  }],
};
