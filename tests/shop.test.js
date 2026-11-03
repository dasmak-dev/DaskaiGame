/* Mercader de la expedición, campo de entrenamiento y ritmo de crecimiento. */
const { play, sleep, check, overflowX } = require('./helpers');

module.exports = {
  name: 'Mercader, entrenamiento y crecimiento',
  cases: [{
    name: 'El mercader cobra sólo del botín y cambiar la cantidad no repinta la pantalla',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        DK.wallet.add(5000, { silent: true });
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'shop', size: 'small', kind: 'normal', mod: null };
        DK.expedition.start({}); const e = DK.expedition.active(); e.curseOffer = null; e.relicChoice = null; e.introShown = `1|${e.seed}`;
        e.loot.coins = 100; const n = e.map.rows[1][0]; n.type = 'shop'; e.pending = n.id; e.offers = DK.expedition.makeOffers();
        e.offers[0].price = 30; e.offers[0].left = 5; DK.router.reset('expedition');
      });
      await sleep(900);
      await p.evaluate(() => { window.__screen = document.querySelector('.exp-screen'); });
      await p.click('.mr-row >> nth=0 >> .mr-qty .pk-btn >> nth=1'); await sleep(150);
      await p.click('.mr-row >> nth=0 >> .mr-qty .pk-btn >> nth=1'); await sleep(150);
      const mid = await p.evaluate(() => ({ same: window.__screen === document.querySelector('.exp-screen'), qty: document.querySelector('.mr-row .mr-qty b').textContent }));
      check(mid.same && mid.qty === '3', 'cambiar la cantidad repinta la pantalla o no cambia: ' + JSON.stringify(mid));
      const w0 = await p.evaluate(() => DK.wallet.get());
      await p.click('.mr-row >> nth=0 >> .mr-buy .btn'); await sleep(250);
      const r = await p.evaluate(() => ({ loot: DK.expedition.active().loot.coins, wallet: DK.wallet.get(), tooMuch: DK.expedition.buyOffer(0, 2) }));
      check(r.loot === 10 && r.wallet === w0, 'debería pagarse con el botín (100 − 90) y no con el monedero: ' + JSON.stringify(r));
      check(!r.tooMuch, 'no debería poder comprar sin monedas en el botín');
      check((await overflowX(p)) <= 1, 'el mercader se sale por la derecha');
    }),
  }, {
    name: 'Entrenamiento: elegir daskai en cuadrícula y mejoras caras con monedas',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.store.state.bosses = { pradera: { defeated: 1 } }; ['brotin', 'gotin', 'plumin'].forEach((s) => DK.party.add(DK.daskai.create(s, 4))); DK.wallet.add(3000, { silent: true }); DK.router.reset('training', { pick: true }); });
      await sleep(500);
      const r = await p.evaluate(() => ({ tiles: document.querySelectorAll('.tr-tile').length, steps: document.querySelectorAll('.tr-step').length, cost: DK.training.nextLevel().cost, slots: DK.training.slotCount() }));
      check(r.tiles >= 4 && r.steps === 4, 'faltan fichas o mejoras: ' + JSON.stringify(r));
      check(r.cost >= 2000, 'las mejoras deberían costar muchas monedas');
      await p.click('.tr-up .btn'); await sleep(300);
      const after = await p.evaluate(() => ({ lv: DK.training.level(), slots: DK.training.slotCount(), statMax: DK.training.statMax() }));
      check(after.lv === 1 && after.slots === r.slots + 1, 'la mejora no se aplica: ' + JSON.stringify(after));
      await p.click('.tr-tile >> nth=0'); await sleep(300);
      check(await p.$('.train-stats, .train-plans, .panel-head'), 'pulsar una ficha no abre la configuración');
    }),
  }, {
    name: 'Las flechas de crecimiento reflejan lo que de verdad sube',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const out = [];
        ['terron', 'umbrix', 'lumino'].forEach((s) => {
          const d = DK.daskai.create(s, 1); const g0 = Object.assign({}, d.growth);
          for (let i = 0; i < 60; i++) DK.daskai.gainExp(d, DK.config.expCurve(d.level));
          DK.data.statKeys.forEach((k) => out.push({ rate: DK.daskai.growthRate(d, k), real: (d.growth[k] - g0[k]) / (d.level - 1) }));
        });
        const avg = (r) => { const xs = out.filter((o) => o.rate === r).map((o) => o.real); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
        return { high: avg('high'), up: avg('up'), normal: avg('normal'), down: avg('down'), low: avg('low') };
      });
      const seq = ['high', 'up', 'normal', 'down', 'low'].map((k) => r[k]).filter((x) => x != null);
      check(seq.every((x, i) => i === 0 || x < seq[i - 1]), 'un ritmo más alto debería subir más de media: ' + JSON.stringify(r));
      if (r.high != null && r.normal != null) check(r.high > r.normal * 1.4, '▲▲ debería subir bastante más que lo normal: ' + JSON.stringify(r));
    }),
  }],
};
