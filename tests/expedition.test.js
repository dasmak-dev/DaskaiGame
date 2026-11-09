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
  }, {
    name: 'Volver a casa desde la hoguera con equipo perdido abre el resumen (v5.14.1)',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0);
        const e = DK.expedition.active(); const base = Object.keys(DK.data.gear.typeOf)[0];
        for (let i = 0; i < 6; i++) DK.gear.found().push(DK.gear.create(base, { rarity: i % 2 ? 'raro' : 'legendario' }));
        e.loot.coins = 200; DK.config.expedition.campfireKeep = 0.01; // casi todo se pierde
        e.pending = e.map.rows.flat().find((n) => n.type === 'rest').id; DK.store.save(); DK.router.reset('expedition'); });
      await sleep(600);
      await p.keyboard.press('3'); await sleep(500);
      await (await p.$('.modal .btn-primary')).click(); await sleep(1200);
      const r = await p.evaluate(() => ({ route: DK.router.current().id, sum: !!document.querySelector('.sum-screen .sum-hero'), lost: document.querySelectorAll('.lt-gear.lost').length }));
      check(r.route === 'expSummary' && r.sum, 'no se abre el resumen: ' + JSON.stringify(r));
      check(r.lost > 0, 'no salen las piezas perdidas');
    }),
  }, {
    name: 'v5.16: cofre abierto al entrar, reclutas 2→5 (+1 en captura), menos variocolor y fondo con zoom',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => { const E = DK.expedition; E.start({}); DK.curses.accept([]); DK.relics.choose(0);
        const e = E.active(); const tn = e.map.rows.flat().find((n) => n.type === 'treasure') || Object.assign(e.map.rows[1][0], { type: 'treasure' }); e.pending = tn.id; DK.router.reset('expedition');
        const opened = !!e.result && document.querySelectorAll('.loot-card').length > 0;
        const node = { row: 2 }; e.kind = 'normal'; const c0 = E.makeCandidates(node).length; e.kind = 'captura'; const cCap = E.makeCandidates(node).length; e.kind = 'normal';
        DK.store.state.emblems = 99; let bought = 0; while (DK.camp.buy('eleccion')) bought++;
        const cMax = E.makeCandidates(node).length; e.kind = 'captura'; const cMaxCap = E.makeCandidates(node).length; e.kind = 'normal';
        return { opened, c0, cCap, cMax, cMaxCap, bought, shiny: DK.config.shinyChance, rShiny: DK.config.expedition.recruitShinyChance, capShiny: E.kindDef('captura').shiny };
      });
      check(r.opened, 'el cofre no se abre al entrar');
      check(r.c0 === 2 && r.cCap === 3, 'candidatos de base: ' + JSON.stringify(r));
      check(r.cMax === 5 && r.cMaxCap === 6 && r.bought === 3, 'candidatos con la mejora: ' + JSON.stringify(r));
      check(r.shiny < 1 / 300 && r.rShiny < 0.02 && r.capShiny > 0, 'variocolor demasiado frecuente');
      // fondo con la interfaz reducida: el lienzo cubre la pantalla
      const cover = await p.evaluate(() => { DK.settings.set('uiScale', 0.9); DK.settings.apply(); const c = document.getElementById('bgfx'); const w = parseFloat(getComputedStyle(c).width) * 0.9; DK.settings.set('uiScale', 1); DK.settings.apply(); return Math.round(w) >= innerWidth - 2; });
      check(cover, 'el fondo no cubre la pantalla con la interfaz reducida');
    }),
  }],
};
