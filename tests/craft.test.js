/* Crafteo en mesa de trabajo y estilo limpio / clásico. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Mesa de crafteo y estilos',
  cases: [{
    name: 'Fondo animado: sale en el campamento, no en la expedición y se apaga con su ajuste',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const w = (ms) => new Promise((res) => setTimeout(res, ms));
        const on = () => document.body.classList.contains('bgfx-on');
        DK.router.reset('craft'); await w(200);
        const out = { craft: on(), icon: !!DK.icon.raw('craftCog') && document.querySelector('.hud-ribbon svg').innerHTML === DK.icon('craftCog').querySelector('svg').innerHTML };
        DK.settings.set('bgFx', false); await w(100); out.off = !on();
        DK.settings.set('bgFx', true); await w(100); out.back = on();
        DK.expedition.start(); DK.router.reset('expedition'); await w(200); out.exp = !on();
        return out;
      });
      check(r.craft && r.off && r.back && r.exp, 'el fondo animado no se enciende/apaga donde debe: ' + JSON.stringify(r));
      check(r.icon, 'Crafteo debería usar el icono craftCog');
    }),
  }, {
    name: 'Bolsa: grupos por uso, materiales en Crafteo, buscar/ordenar con iconos y vista previa al usar',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const w = (ms) => new Promise((res) => setTimeout(res, ms));
        ['pocion', 'eter', 'antidoto', 'cristal_sabio', 'garra_afilada', 'hilo', 'gota'].forEach((id) => DK.bag.addHome({ [id]: 2 }));
        const d = DK.party.active()[0]; d.cur.hp = 3;
        DK.router.reset('inventory'); await w(300);
        const heads = [...document.querySelectorAll('.inv-group-head')].map((x) => x.textContent);
        const piece = [...document.querySelectorAll('.inv-row')].some((x) => /Fibra|Gota/.test(x.textContent));
        const out = { heads: heads.length, piece, mats: !!document.querySelector('.inv-mats-link'), search: !document.querySelector('.inv-search'), detail: !!document.querySelector('.inv-side') };
        DK.router.reset('inventory', { item: 'cristal_sabio' }); await w(300);
        out.exp = !!document.querySelector('.inv-side .up-row.exp.lvup') || DK.ui.isNarrow();
        DK.router.reset('inventory', { item: 'pocion' }); await w(300);
        out.hp = !!document.querySelector('.inv-side .up-row.hp .up-add') || DK.ui.isNarrow();
        out.team = !!document.querySelector('.inv-side .inv-target.in-team') || DK.ui.isNarrow();
        return out;
      });
      check(r.heads >= 5 && !r.piece && r.mats, 'la bolsa debería agruparse por uso y llevar los materiales a Crafteo: ' + JSON.stringify(r));
      check(r.search && !r.detail, 'la búsqueda y el detalle no deberían estar abiertos al entrar: ' + JSON.stringify(r));
      check(r.exp && r.hp && r.team, 'faltan las vistas previas al usar: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Mesa de trabajo: fichas con tienes/necesitas, primero las listas, dónde conseguir y forjar',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { ['pelaje', 'gota', 'polvo_brillante', 'hilo', 'escama', 'pluma'].forEach((id) => DK.bag.add(id, 3)); DK.router.reset('craft', { tab: 'equip' }); });
      await sleep(500);
      const r = await p.evaluate(() => {
        const tiles = [...document.querySelectorAll('.wb-tile')];
        const st = tiles.map((x) => (x.classList.contains('s-ready') ? 0 : x.classList.contains('s-chain') ? 1 : 2));
        return { tabs: document.querySelectorAll('.wb-tabbtn').length, n: tiles.length, mats: tiles.every((x) => x.querySelector('.wb-prog')), sorted: st.every((v, i) => !i || v >= st[i - 1]),
          ready: st.filter((v) => v === 0).length, side: !!document.querySelector('.wb-side .wb-slot') };
      });
      check(r.tabs === 3 && r.n > 10 && r.mats, 'faltan pestañas o fichas con su barra de materiales: ' + JSON.stringify(r));
      check(r.sorted && r.ready > 0, 'las recetas listas deberían ir primero: ' + JSON.stringify(r));
      const narrow = await p.evaluate(() => DK.ui.isNarrow());
      check(!r.side, 'el detalle no debería abrirse solo (v4.42)');
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
