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
      // v4.67: «Seguir el camino» va en la barra de abajo, pegada al borde (ya no hay botón arriba)
      check(await p.evaluate(() => !document.querySelector('.merchant .mr-skip') && document.querySelectorAll('.merchant .mr-foot .exp-cont').length === 1 && getComputedStyle(document.querySelector('.merchant .mr-foot')).position === 'sticky'), 'el mercader debería tener «Seguir» en la barra fija de abajo (y no arriba)');
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
      await p.click('.rt-row >> nth=2'); await sleep(200);
      const r = await p.evaluate(() => ({ same: window.__panel === document.querySelector('.rest-panel'), on: [...document.querySelectorAll('.rt-row')].findIndex((b) => b.classList.contains('on')), uid: DK.expedition.active().trainUid, want: DK.party.active()[2].uid, label: document.querySelector('.rt-who').textContent }));
      check(r.same, 'elegir a quién entrenar repinta la hoguera (parpadea)');
      check(r.on === 2 && r.uid === r.want, 'no se marca el elegido');
      check(r.label.includes(await p.evaluate(() => DK.daskai.name(DK.party.active()[2]))), 'no cambia a quién se va a entrenar (v4.70: línea «rt-who» sobre el botón)');
      const lv = await p.evaluate(() => DK.party.active()[2].level);
      await p.click('.rest-train-btn'); await sleep(600);
      await p.evaluate(async () => { for (let i = 0; i < 6; i++) { const b = document.querySelector('.modal .btn-primary, .modal-actions .btn'); if (b) b.click(); await new Promise((r) => setTimeout(r, 200)); } });
      check((await p.evaluate(() => DK.party.active()[2].level)) === lv + 1, 'entrenar no sube al elegido');
    }),
  }, {
    name: 'Exploraciones: planificar (zona, duración, grupo), coste en monedas y raciones, riesgo, botín con informe y mejoras del puesto',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        DK.store.state.bosses = { pradera: { defeated: 1 } }; DK.world.unlockNext && DK.world.unlockNext('pradera');
        ['brotin', 'gotin', 'plumin'].forEach((s) => DK.party.add(DK.daskai.create(s, 6)));
        DK.wallet.add(5000, { silent: true }); DK.store.state.emblems = 3; DK.bag.addHome({ racion_viaje: 10 });
        DK.router.reset('training', { plan: true });
      });
      await sleep(500);
      const r = await p.evaluate(() => ({ zones: document.querySelectorAll('.ex-zt').length, durs: document.querySelectorAll('.ex-dpills button').length, tiles: document.querySelectorAll('.ex-tile').length, steps: document.querySelectorAll('.tr-step').length, slots: DK.explore.slotCount() }));
      check(r.zones >= 1 && r.durs === 3 && r.tiles >= 3 && r.steps === 4, 'faltan zonas, duraciones, daskai o mejoras: ' + JSON.stringify(r));
      // Elegir dos daskai: sale el resumen con riesgo, coste y experiencia
      await p.evaluate(() => { const ts = [...document.querySelectorAll('.ex-tile:not([disabled])')]; ts[0].click(); });
      await sleep(250);
      await p.evaluate(() => { const ts = [...document.querySelectorAll('.ex-tile:not([disabled]):not(.on)')]; ts[0].click(); });
      await sleep(250);
      const s1 = await p.evaluate(() => ({ sel: DK.router.current().params.sel.length, risk: !!document.querySelector('.ex-rk'), cost: !!document.querySelector('.ex-cost'), exp: document.querySelectorAll('.ex-exps span').length }));
      check(s1.sel === 2 && s1.risk && s1.cost && s1.exp === 2, 'el resumen del grupo no sale: ' + JSON.stringify(s1));
      check(!(await overflowX(p)), 'el planificador se sale de la pantalla');
      // v4.87: lo que puede salir (lista con probabilidades) y la lista de daskai plegable
      await p.evaluate(() => document.querySelector('.ex-seeall').click()); await sleep(400);
      const ll = await p.evaluate(() => ({ rows: document.querySelectorAll('.ex-lrow').length, mats: document.querySelectorAll('.ex-lsec')[0].querySelectorAll('.ex-lrow').length, total: DK.explore.zoneLoot(DK.router.current().params.z, 'mid', DK.router.current().params.sel).total }));
      check(ll.rows >= 6 && ll.mats >= 2 && ll.total > 2, 'la lista de lo que puede salir está incompleta: ' + JSON.stringify(ll));
      await p.evaluate(() => DK.ui.closeAll()); await sleep(200);
      await p.evaluate(() => document.querySelector('.ex-listtog').click()); await sleep(250);
      const fold = await p.evaluate(() => ({ tiles: document.querySelectorAll('.ex-tile').length, chosen: document.querySelectorAll('.ex-who-card:not(.empty)').length }));
      // v4.98: «Ocultar lista» vuelve a abrirla desde «Quién va»; pulsar a uno abre su ficha
      await p.evaluate(() => document.querySelector('.ex-who-main').click()); await sleep(350);
      check(await p.$('.modal-backdrop'), 'pulsar a uno de «Quién va» no abre su ficha');
      await p.evaluate(() => DK.ui.closeAll()); await sleep(200);
      check(fold.tiles === 0 && fold.chosen === 2, 'la lista de daskai no se pliega o no se ven los elegidos: ' + JSON.stringify(fold));
      const w0 = await p.evaluate(() => ({ c: DK.wallet.get(), r: DK.bag.count('racion_viaje') }));
      await p.evaluate(() => document.querySelector('.ex-go .btn-primary').click()); await sleep(400);
      const g = await p.evaluate(() => { const X = DK.explore, g = X.slots()[0]; return { n: X.slots().length, uids: g && g.uids.length, out: g && g.uids.every((u) => !DK.store.state.team.includes(u) && X.isTraining(u)), c: DK.wallet.get(), r: DK.bag.count('racion_viaje'), cards: document.querySelectorAll('.ex-gc:not(.free)').length }; });
      check(g.n === 1 && g.uids === 2 && g.out && g.c < w0.c && g.r < w0.r && g.cards === 1, 'mandar el grupo no cobra o no los saca del equipo: ' + JSON.stringify({ g, w0 }));
      // Volver: informe con diario y botín; experiencia; vuelven al equipo
      const rep = await p.evaluate(() => {
        const X = DK.explore, g = X.slots()[0], ds = g.uids.map((u) => DK.party.get(u)), e0 = ds.map((d) => d.level * 1e6 + d.exp);
        g.start -= (g.min + 1) * 60000;
        let i = 0; const seq = [0.99, 0.01, 0.5, 0.3, 0.7, 0.2, 0.9, 0.4]; const rnd = () => seq[i++ % seq.length];
        const r = X.collect(g.id, rnd);
        return { ok: !!r, hurt: r.hurt, items: Object.keys(r.items).length, coins: r.coins, log: r.log.length, up: ds.every((d, k) => d.level * 1e6 + d.exp > e0[k]), back: X.slots().length === 0 && ds.every((d) => !X.isTraining(d.uid)) };
      });
      check(rep.ok && !rep.hurt && rep.items > 0 && rep.coins > 0 && rep.log >= 3 && rep.up && rep.back, 'el informe de la exploración no cuadra: ' + JSON.stringify(rep));
      // v4.87: encargos del día (se cumplen y se cobran) y regalo de raciones
      const rq = await p.evaluate(() => {
        const X = DK.explore, list = X.requests(), r = list[0]; r.done = true; const c0 = DK.wallet.get(), got = X.claimRequest(r.id);
        const s = DK.store.state.training; delete s.gift; const r0 = DK.bag.count('racion_viaje'), gift = X.takeGift();
        return { n: list.length, text: list.every((x) => X.requestText(x).length > 5), got: !!got && DK.wallet.get() > c0 && r.claimed, gift: gift > 0 && DK.bag.count('racion_viaje') === r0 + gift, again: X.takeGift() === 0 };
      });
      check(rq.n >= 2 && rq.text && rq.got && rq.gift && rq.again, 'encargos o regalo de raciones: ' + JSON.stringify(rq));
      // Riesgo: más alto en una zona muy por encima; si sale mal vuelven agotados y no pueden ir
      const risk = await p.evaluate(() => {
        const X = DK.explore, d = DK.party.all().filter((x) => !x.temp)[0];
        const lo = X.risk([d], 'pradera', 'mid'), hi = X.risk([d], 'cumbre', 'mid');
        d.level = 2; const weak = X.risk([d], 'pradera', 'long'); d.level = 40; const strong = X.risk([d], 'pradera', 'short');
        d.tired = Date.now() + 60 * 60000;
        const why = X.cannotMember(d), join = DK.party.canJoin(d.uid); delete d.tired;
        return { lo, hi, weak, strong, why: !!why, join };
      });
      check(risk.hi > risk.lo && risk.weak > risk.strong && risk.why && !risk.join, 'el riesgo o el cansancio no funcionan: ' + JSON.stringify(risk));
      // v4.89: desastre (pierden todo el botín) y lo propio de cada zona (reactivo de runas con el Taller)
      const dis = await p.evaluate(() => {
        const X = DK.explore, ds = DK.party.all().filter((x) => !x.temp && !X.isTraining(x.uid)).slice(-1);
        DK.store.state.camp = DK.store.state.camp || {}; DK.store.state.camp.runas = 1; DK.bag.addHome({ racion_viaje: 4 });
        const ri = X.riskInfo(ds, 'cumbre', 'long');
        const c0 = DK.wallet.get(); const g = X.send([ds[0].uid], 'pradera', 'mid'); g.start -= (g.min + 1) * 60000;
        const c1 = DK.wallet.get(); const r = X.collect(g.id, () => 0.001), same = DK.wallet.get() === c1;
        const g2 = X.send([DK.party.all().filter((x) => !x.temp && !X.isTraining(x.uid) && !X.isTired(x))[0].uid], 'pradera', 'long'); g2.start -= (g2.min + 1) * 60000;
        const r2 = X.collect(g2.id, () => 0.97);
        return { dis: ri.disaster > 0 && ri.disaster < ri.risk, parts: ri.parts.length, out: r.outcome, items: Object.keys(r.items).length, coins: r.coins, wallet: same, tired: X.isTired(ds[0]),
          reagent: r2.items.tiza_runica || 0, own: !!X.zoneLoot('pradera', 'long').own.reagent, c0: c0 > c1 };
      });
      check(dis.dis && dis.parts >= 2 && dis.out === 'disaster' && !dis.items && !dis.coins && dis.wallet && dis.tired && dis.reagent >= 2 && dis.own, 'el desastre o lo propio de la zona no funcionan: ' + JSON.stringify(dis));
      // Sin raciones no se puede salir
      const nr = await p.evaluate(() => { const X = DK.explore, d = DK.party.all().filter((x) => !x.temp && !DK.party.isActive(x.uid))[0] || DK.party.all()[1]; DK.bag.remove('racion_viaje', DK.bag.count('racion_viaje')); return X.cannot([d.uid], 'pradera', 'mid'); });
      check(!!nr, 'debería pedir raciones de viaje');
      // Mejora del puesto: gasta emblemas y da un grupo más
      await p.evaluate(() => DK.router.reset('training')); await sleep(300);
      await p.click('.tr-up .btn'); await sleep(300);
      const up = await p.evaluate(() => ({ em: DK.store.state.emblems, lv: DK.explore.level(), slots: DK.explore.slotCount(), max: DK.explore.slotMax() }));
      check(up.em === 0 && up.lv === 1 && up.slots === r.slots + 1 && up.max === 4, 'la mejora del puesto no se aplica: ' + JSON.stringify(up));
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
