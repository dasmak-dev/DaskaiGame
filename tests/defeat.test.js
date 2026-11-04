/* Al caer derrotado: sólo vuelve lo que metiste en la mochila (Normal y Difícil); en Pesadilla, nada. */
const { play, check } = require('./helpers');

const run = (diff, boss) => async (p) => p.evaluate(([diff, boss]) => {
  DK.store.state.difficulty = diff;
  DK.bag.addHome({ pocion: 5, eter: 2 });
  DK.store.state.nextExpedition = { zone: 'pradera', seed: 'd', size: 'small', kind: 'normal', mod: null };
  DK.expedition.start({ pocion: 3, eter: 2 });
  const home0 = { pocion: DK.bag.home().pocion || 0, eter: DK.bag.home().eter || 0 };
  DK.bag.remove('pocion', 1);           // gastas una de las tuyas
  DK.bag.add('pocion', 2);              // encuentras dos por el camino
  DK.bag.add('antidoto', 1);            // y algo nuevo
  DK.expedition.addLoot([], 300); DK.expedition.active().loot.items = { escama: 4 };
  DK.expedition.fail({ boss });
  const h = DK.bag.home(), last = DK.store.state.lastExpedition;
  return { pocion: (h.pocion || 0) - home0.pocion, eter: (h.eter || 0) - home0.eter, antidoto: h.antidoto || 0, escama: h.escama || 0, lostPack: last.lostPack, packBack: last.packBack };
}, [diff, boss]);

module.exports = {
  name: 'Derrota y mochila',
  cases: [{
    name: 'Normal y Difícil: vuelve lo que metiste y no gastaste; lo encontrado se pierde',
    run: (browser, view) => play(browser, view, async (p) => {
      for (const d of ['normal', 'dificil']) {
        const r = await run(d, false)(p);
        // Se gasta primero lo encontrado: de 4 pociones (3 tuyas − 1 + 2 encontradas) vuelven las 3 tuyas
        check(r.pocion === 3 && r.eter === 2, d + ': deberían volver tus 3 pociones y 2 éteres: ' + JSON.stringify(r));
        check(r.antidoto === 0 && r.escama === 0, d + ': lo encontrado no debería volver: ' + JSON.stringify(r));
        check(r.lostPack.pocion === 1 && r.lostPack.antidoto === 1, d + ': el resumen debería mostrar lo perdido: ' + JSON.stringify(r.lostPack));
      }
      const b = await run('dificil', true)(p);
      check(b.pocion === 3 && b.eter === 2 && b.escama === 0, 'ante el jefe también vuelve sólo lo tuyo: ' + JSON.stringify(b));
    }),
  }, {
    name: 'Pesadilla: al perder, también se pierde la mochila',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await run('pesadilla', false)(p);
      check(r.pocion === 0 && r.eter === 0 && r.antidoto === 0, 'en Pesadilla no debería volver nada: ' + JSON.stringify(r));
      const b = await run('pesadilla', true)(p);
      check(b.pocion === 0 && b.eter === 0, 'en Pesadilla ante el jefe tampoco: ' + JSON.stringify(b));
    }),
  }],
};
