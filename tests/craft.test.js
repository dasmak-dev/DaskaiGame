/* Crafteo en mesa de trabajo y estilo limpio / clásico. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Mesa de crafteo y estilos',
  cases: [{
    name: 'Mesa de trabajo: fichas con tienes/necesitas, primero las listas, dónde conseguir y forjar',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { ['pelaje', 'gota', 'polvo_brillante', 'hilo', 'escama', 'pluma'].forEach((id) => DK.bag.add(id, 3)); DK.router.reset('craft', { tab: 'equip' }); });
      await sleep(500);
      const r = await p.evaluate(() => {
        const tiles = [...document.querySelectorAll('.wb-tile')];
        const st = tiles.map((x) => (x.classList.contains('s-ready') ? 0 : x.classList.contains('s-chain') ? 1 : 2));
        return { tabs: document.querySelectorAll('.wb-tabbtn').length, n: tiles.length, mats: tiles.every((x) => x.querySelector('.wb-mat')), sorted: st.every((v, i) => !i || v >= st[i - 1]),
          ready: st.filter((v) => v === 0).length, side: !!document.querySelector('.wb-side .wb-slot') };
      });
      check(r.tabs === 3 && r.n > 10 && r.mats, 'faltan pestañas o fichas con sus materiales: ' + JSON.stringify(r));
      check(r.sorted && r.ready > 0, 'las recetas listas deberían ir primero: ' + JSON.stringify(r));
      const narrow = await p.evaluate(() => DK.ui.isNarrow());
      check(narrow || r.side, 'en escritorio la mesa debería estar siempre a la derecha');
      // Elegir una receta lista y forjarla
      await p.click('.wb-tile.s-ready >> nth=0'); await sleep(500);
      const before = await p.evaluate(() => { const sel = document.querySelector('.wb-detail h3').textContent; return { sel, n: Object.values(DK.data.items).filter((it) => it.name === sel).map((it) => DK.bag.count(it.id))[0] }; });
      await p.click('.wb-forge'); await sleep(500);
      await p.evaluate(() => { const b = document.querySelector('.modal .btn-ghost'); if (b) b.click(); }); await sleep(300);
      const after = await p.evaluate((name) => Object.values(DK.data.items).filter((it) => it.name === name).map((it) => DK.bag.count(it.id))[0], before.sel);
      check(after === before.n + 1, 'forjar no da el objeto: ' + before.sel + ' ' + before.n + ' → ' + after);
    }),
  }, {
    name: 'Un material que falta enseña su zona con «Ir» y lleva a Batalla con esa zona',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { const r = DK.data.recipes.find((x) => DK.data.items[x.result].category === 'equipo'); DK.router.reset('craft', { tab: 'equip', sel: r.id }); });
      await sleep(500);
      const has = await p.evaluate(() => !!document.querySelector('.wb-slot.no .wb-zone.go.need'));
      check(has, 'el material que falta debería tener una zona con «Ir»');
      await p.click('.wb-slot.no .wb-zone.go.need >> nth=0'); await sleep(500);
      check(await p.evaluate(() => DK.router.current().id === 'zones'), '«Ir» debería llevar a Batalla');
    }),
  }, {
    name: 'Estilo limpio por defecto y el clásico se puede elegir en Ajustes',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const a = document.documentElement.dataset.style;
        const card = () => getComputedStyle(document.querySelector('.card')).borderTopWidth;
        DK.router.reset('progress');
        const clean = card();
        DK.settings.set('uiStyle', 'classic'); const b = document.documentElement.dataset.style; const classic = card();
        DK.settings.set('uiStyle', 'clean');
        return { a, b, clean, classic };
      });
      check(r.a === 'clean' && r.b === 'classic', 'el estilo no cambia: ' + JSON.stringify(r));
      check(r.clean === '1px' && r.classic !== '1px', 'el estilo limpio debería tener bordes finos y el clásico no: ' + JSON.stringify(r));
    }),
  }],
};
