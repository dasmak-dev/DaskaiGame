/* Desbloqueos y logros ocultos. */
const { play, check } = require('./helpers');

module.exports = {
  name: 'Progreso',
  cases: [{
    name: 'El entrenamiento se desbloquea al derrotar al primer jefe',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const before = [DK.unlocks.has('training'), DK.app.navItems().some((i) => i.id === 'training'), !!DK.training.cannot(DK.party.active()[0])];
        DK.world.boss('pradera').defeated = 1; DK.unlocks.check(true);
        return { before, after: [DK.unlocks.has('training'), DK.app.navItems().some((i) => i.id === 'training')] };
      });
      check(!r.before[0] && !r.before[1] && r.before[2], 'el entrenamiento debería estar bloqueado al empezar');
      check(r.after[0] && r.after[1], 'el entrenamiento debería abrirse tras el primer jefe');
    }),
  }, {
    name: 'Los logros ocultos se ven como «???» hasta conseguirlos',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const hidden = DK.data.achievements.filter((a) => a.hidden).length;
        DK.world.boss('pradera').defeated = 1; DK.achievements.check();
        return { hidden, got: !!DK.store.state.achievements.boss_pradera, name: DK.achievements.name(DK.data.achievements.find((a) => a.id === 'boss_pradera')) };
      });
      check(r.hidden >= 10, 'faltan logros ocultos');
      check(r.got, 'derrotar al jefe de la Pradera debería dar su logro oculto');
      check(r.name.includes('Pradera'), 'el nombre del logro por zona no lleva la zona');
    }),
  }],
};
