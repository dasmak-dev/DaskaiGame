/* Guardado agrupado: no se pierde nada al cerrar y las partidas antiguas cargan. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Guardado',
  cases: [{
    name: 'Agrupa los guardados y escribe al cerrar la partida',
    run: (browser, view) => play(browser, view, async (p) => {
      const key = await p.evaluate(() => { DK.store.flush(); return 'daskai.slot.' + DK.store.slot; });
      const read = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).coins, key);
      await p.evaluate(() => { for (let i = 0; i < 50; i++) { DK.wallet.add(1, { silent: true }); DK.store.save(); } });
      const before = await read();
      const now = await p.evaluate(() => DK.store.state.coins);
      check(before !== now, 'debería esperar antes de escribir (50 guardados seguidos)');
      await sleep(700);
      check((await read()) === now, 'no se ha escrito tras la espera');
      await p.evaluate(() => { DK.wallet.add(5, { silent: true }); DK.store.save(); });
      const want = await p.evaluate(() => DK.store.state.coins);
      await p.evaluate(() => DK.store.close());
      check((await read()) === want, 'cerrar la partida no ha guardado lo pendiente');
    }),
  }, {
    name: 'Una partida antigua (daskai sin genes) se carga y calcula bien',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const slot = DK.store.slot; DK.store.state.party.forEach((d) => { delete d.genes; delete d.role; }); DK.store.close();
        DK.store.load(slot);
        const d = DK.store.state.party[0], s = DK.daskai.stats(d);
        return { hp: s.hp, base: !d.genes || !Object.values(d.genes).some(Boolean) ? DK.daskai.baseOf(d, 'hp') === Math.max(1, Math.round(DK.data.species[d.species].base.hp * (1 + ((DK.daskai.roleOf(d).mods || {}).hp || 0)))) : true };
      });
      check(r.hp > 0 && r.base, 'sin genes debería usar la base de la especie');
    }),
  }],
};
