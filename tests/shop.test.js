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
      check(await p.evaluate(() => document.querySelectorAll('.merchant button.mr-skip').length === 1), 'el mercader debería tener «Seguir» también arriba');
    }),
  }, {
    name: 'Hoguera: elegir a quién entrenar no repinta la pantalla',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        ['brotin', 'gotin'].forEach((s) => DK.party.add(DK.daskai.create(s, 4)));
        DK.store.state.team = DK.party.all().slice(0, 3).map((d) => d.uid);
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'rest', size: 'small', kind: 'normal', mod: null };
        DK.expedition.start({}); const e = DK.expedition.active(); e.curseOffer = null; e.relicChoice = null; e.introShown = `1|${e.seed}`;
        const n = e.map.rows[1][0]; n.type = 'rest'; e.pending = n.id; DK.router.reset('expedition');
      });
      await sleep(900);
      await p.evaluate(() => { window.__panel = document.querySelector('.rest-panel'); });
      await p.click('.rest-pick >> nth=2'); await sleep(200);
      const r = await p.evaluate(() => ({ same: window.__panel === document.querySelector('.rest-panel'), on: [...document.querySelectorAll('.rest-pick')].findIndex((b) => b.classList.contains('on')), uid: DK.expedition.active().trainUid, want: DK.party.active()[2].uid, label: document.querySelector('.rest-train-btn').textContent }));
      check(r.same, 'elegir a quién entrenar repinta la hoguera (parpadea)');
      check(r.on === 2 && r.uid === r.want, 'no se marca el elegido');
      check(r.label.includes(await p.evaluate(() => DK.daskai.name(DK.party.active()[2]))), 'el botón de entrenar no cambia de nombre');
      const lv = await p.evaluate(() => DK.party.active()[2].level);
      await p.click('.rest-train-btn'); await sleep(600);
      await p.evaluate(async () => { for (let i = 0; i < 6; i++) { const b = document.querySelector('.modal .btn-primary, .modal-actions .btn'); if (b) b.click(); await new Promise((r) => setTimeout(r, 200)); } });
      check((await p.evaluate(() => DK.party.active()[2].level)) === lv + 1, 'entrenar no sube al elegido');
    }),
  }, {
    name: 'Entrenamiento: elegir daskai en cuadrícula y mejoras caras con monedas',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.store.state.bosses = { pradera: { defeated: 1 } }; ['brotin', 'gotin', 'plumin'].forEach((s) => DK.party.add(DK.daskai.create(s, 4))); DK.wallet.add(3500, { silent: true }); DK.store.state.emblems = 3; DK.router.reset('training', { pick: true }); });
      await sleep(500);
      const r = await p.evaluate(() => ({ tiles: document.querySelectorAll('.tr-tile').length, steps: document.querySelectorAll('.tr-step').length, cost: DK.training.nextLevel().cost, em: DK.training.nextLevel().emblems, slots: DK.training.slotCount() }));
      check(r.tiles >= 4 && r.steps === 4, 'faltan fichas o mejoras: ' + JSON.stringify(r));
      check(r.cost >= 2000 && r.em > 0, 'las mejoras deberían costar muchas monedas y emblemas');
      await p.click('.tr-up .btn'); await sleep(300);
      check(await p.evaluate(() => DK.store.state.emblems === 0 && DK.training.slotMax() === 4), 'la mejora no gasta los emblemas o hay más de 4 huecos');
      const after = await p.evaluate(() => ({ lv: DK.training.level(), slots: DK.training.slotCount(), statMax: DK.training.statMax() }));
      check(after.lv === 1 && after.slots === r.slots + 1, 'la mejora no se aplica: ' + JSON.stringify(after));
      await p.click('.tr-tile >> nth=0'); await sleep(300);
      check((await p.$$('.tr-boost')).length === 3 && (await p.$$('.tr-plan-row')).length === 5, 'falta el acelerador o la previsión');
      // Sólo experiencia: no se paga al entrar (×1), se cobra al sacarlo y crece con el tiempo
      const m = await p.evaluate(() => {
        const T = DK.training, d = DK.party.all().filter((x) => !x.temp).sort((a, b) => a.level - b.level)[0];
        const w0 = DK.wallet.get(); const ok = T.start(d.uid, 1); const w1 = DK.wallet.get();
        const s = T.get(d.uid); const lv0 = d.level;
        const at = (min) => T.progress(s, s.start + min * 60000);
        const a = at(60), b = at(240);
        const r1 = a.exp / 60, r4 = (b.exp - at(180).exp) / 60;      // exp por minuto al principio y a las 3-4 h
        const fast = T.simulate(d, 60, 3);
        const lowPct = T.pct(5), highPct = T.pct(60);
        s.start -= 600 * 60000; DK.wallet.add(100000, { silent: true });
        const fee = T.progress(s).fee, w2 = DK.wallet.get();
        const res = T.collect(d.uid, true);
        return { ok, free: w0 === w1, grows: r4 > r1, feeUp: b.fee > a.fee, boost: fast.gained > a.exp * 2.5, lvlDep: lowPct > highPct, paid: w2 - DK.wallet.get() === fee && fee > 0, up: d.level > lv0, out: !T.isTraining(d.uid), exp: res.exp > 0 };
      });
      check(Object.values(m).every(Boolean), 'el entrenamiento no cumple las reglas: ' + JSON.stringify(m));
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
  }, {
    name: 'Sin vínculo en combate, hoguera que sube 1 nivel al elegido, mover entre cajas y sin «null» en el combate',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        ['brotin', 'gotin', 'plumin'].forEach((s) => DK.party.add(DK.daskai.create(s, 4)));
        DK.store.state.team = DK.party.all().slice(0, 3).map((d) => d.uid);
        // Mover entre cajas
        DK.party.add(DK.daskai.create('chispon', 3)); DK.boxes.sync();
        const extra = DK.party.all()[3]; const i2 = DK.boxes.list().length > 1 ? 1 : DK.boxes.add();
        const okMove = DK.boxes.moveTo(extra.uid, i2, DK.boxes.box(i2).slots.indexOf(null));
        const where = DK.boxes.locate(extra.uid);
        // Expedición: hoguera
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'r', size: 'small', kind: 'normal', mod: null };
        DK.expedition.start({}); const e = DK.expedition.active();
        const d = DK.party.active()[2], lv = d.level;
        DK.expedition.train(d.uid);
        const offers = DK.expedition.makeOffers().map((o) => o.id);
        return { okMove, box: where && where.b, i2, up: d.level - lv, others: DK.party.active()[0].level, crystals: offers.filter((id) => DK.data.items[id].use && DK.data.items[id].use.capture).length, off: !!DK.battle.cannotCapture({ expedition: true }) };
      });
      check(r.okMove && r.box === r.i2, 'no se puede mover a otra caja');
      check(r.up === 1, 'entrenar en la hoguera debería subir 1 nivel al elegido: ' + r.up);
      check(r.crystals === 0 && r.off, 'con el vínculo desactivado no debería haber cristales ni poder vincular');
      await p.evaluate(() => DK.router.reset('expedition')); await sleep(600);
      const hud = await p.evaluate(() => ({ coins: !!document.querySelector('.hud-pill.coins:not(.loot)'), loot: !!document.querySelector('.hud-pill.loot') }));
      check(!hud.coins && hud.loot, 'en expedición sólo debería verse el botín, no el monedero');
      await p.evaluate(() => DK.router.go('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid })); await sleep(1500);
      const txt = await p.evaluate(() => document.querySelector('.arena').textContent);
      check(!/null|undefined/.test(txt), 'sale «null» en la pantalla de combate');
    }),
  }],
};
