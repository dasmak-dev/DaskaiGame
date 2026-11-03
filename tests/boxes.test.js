/* Equipo de hasta 5 y cajas de daskai. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Equipo y cajas',
  cases: [{
    name: 'Los que no están en el equipo se guardan en las cajas y se pueden mover',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const sp = Object.keys(DK.data.species);
        for (let i = 0; i < 12; i++) DK.party.add(DK.daskai.create(sp[i], 5));
        DK.boxes.sync();
        const team = DK.store.state.team.slice();
        const boxed = DK.boxes.list().reduce((a, b) => a + b.slots.filter(Boolean).length, 0);
        const first = DK.boxes.box(0).slots.find(Boolean);
        const okSwap = DK.boxes.toTeam(first, 0);
        const back = DK.boxes.locate(team[0]);
        const okMove = DK.boxes.moveTo(DK.store.state.team[1], 1, 5);
        DK.boxes.rename(1, 'Reserva'); DK.boxes.setBg(1, 'lava');
        return { max: DK.config.maxTeam, team: team.length, boxed, total: DK.party.all().length, okSwap, swapped: DK.store.state.team[0] === first, back: !!back, okMove, at: DK.boxes.box(1).slots[5] != null, name: DK.boxes.name(1), bg: DK.boxes.box(1).bg };
      });
      check(r.max === 6 && r.team === 6, 'el equipo debería ser de 6');
      check(r.boxed + r.team === r.total, 'algún daskai no está ni en el equipo ni en una caja');
      check(r.okSwap && r.swapped && r.back, 'pasar de la caja al equipo lleno debería intercambiarlos');
      check(r.okMove && r.at, 'no se ha podido guardar en la caja');
      check(r.name === 'Reserva' && r.bg === 'lava', 'no se guarda el nombre o el fondo de la caja');
    }),
  }, {
    name: 'La pantalla de equipo muestra la caja y el equipo; arrastrar mueve daskai',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { const sp = Object.keys(DK.data.species); for (let i = 0; i < 8; i++) DK.party.add(DK.daskai.create(sp[i], 5)); DK.router.reset('team'); });
      await sleep(500);
      check((await p.$$('.party-mon')).length === 6, 'faltan daskai en el equipo');
      check((await p.$$('.pc-slot')).length === 30, 'la caja debería tener 30 huecos');
      if (!view.touch) {
        const src = await p.$('.pc-mon'), dst = (await p.$$('.pc-slot.is-empty'))[0];
        const a = await src.boundingBox(), c = await dst.boundingBox();
        const uid = await src.getAttribute('data-uid');
        await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
        await p.mouse.move(c.x + 8, c.y + 8, { steps: 8 }); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 4 }); await p.mouse.up();
        await sleep(400);
        const idx = await dst.getAttribute('data-index');
        check((await p.evaluate((u) => DK.boxes.locate(u), uid)).i === +idx, 'arrastrar a otro hueco no lo ha movido');
      }
      const m = await p.$('.pc-mon'); if (view.touch) await m.tap(); else await m.click();
      await sleep(400);
      check(await p.$('.drawer .dk-panel, .drawer-body'), 'pulsar un daskai debería abrir su ficha');
    }),
  }, {
    name: 'En expedición no se ven las cajas: sólo el equipo y quien va contigo',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { const sp = Object.keys(DK.data.species); for (let i = 0; i < 6; i++) DK.party.add(DK.daskai.create(sp[i + 1], 5)); DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0); });
      await sleep(1500);
      await p.evaluate(() => { DK.ui.closeAll && DK.ui.closeAll(); DK.router.reset('team'); });
      await sleep(600);
      const r = await p.evaluate(() => ({ tabs: !!document.querySelector('.pc-tabs'), away: !!document.querySelector('.pc-away'), lock: !!document.querySelector('.pc-away .warning'), boxedMons: document.querySelectorAll('.pc-box:not(.pc-away) .pc-mon').length, team: document.querySelectorAll('.party-mon').length }));
      check(!r.tabs && !r.boxedMons, 'durante la expedición no deberían verse las cajas');
      check(r.away && r.lock, 'falta el panel de quien va contigo');
      check(r.team >= 1, 'el equipo debería seguir visible');
    }),
  }, {
    name: 'Batalla: se prepara y se sale de expedición en la misma pantalla',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.bag.add('pocion', 3); DK.router.reset('expPrepare'); });
      await sleep(600);
      const r = await p.evaluate(() => ({ id: DK.router.current().id, prep: !!document.querySelector('.bt-prep'), pills: document.querySelectorAll('.bt-kind .bt-odd').length, team: document.querySelectorAll('.bt-mon').length }));
      check(r.id === 'zones' && r.prep, 'Preparar debería estar en la pantalla de Batalla: ' + JSON.stringify(r));
      check(r.pills >= 4 && r.team >= 1, 'faltan el tipo de expedición o el equipo');
      await p.click('.bt-pack-btn'); await sleep(400);
      check(await p.$('.drawer .pk-pack') && await p.$('.drawer .pk-bag'), 'el panel de objetos no muestra mochila y bolsa');
      await p.click('.drawer .pk-bag .pk-btn.add'); await sleep(300);
      await p.keyboard.press('Escape'); await sleep(300);
      check((await p.$$('.bt-item')).length === 1, 'el objeto elegido no aparece en la mochila');
      await p.click('.bt-go'); await sleep(800);
      const e = await p.evaluate(() => DK.expedition.active() && DK.expedition.active().pack);
      check(e && e.pocion === 1, 'la expedición no sale con la mochila elegida');
    }),
  }],
};
