/* Menú principal (ranuras alineadas) y cristales de vínculo ocultos. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Menú principal y objetos ocultos',
  cases: [{
    name: 'Sin vínculo no hay cristales: ni en la bolsa, ni en recetas, drops, tienda, códice ni misiones',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.data, hid = [...D.hiddenItems];
        DK.bag.add('cristal_vinculo', 2);
        const drops = Object.values(D.species).some((s) => (s.drops || []).some(([id]) => D.isHidden(id))) || Object.values(D.zones).some((z) => z.boss && z.boss.drops.some(([id]) => D.isHidden(id)));
        return {
          hid, bag: DK.bag.count('cristal_vinculo'), list: DK.bag.list().some((x) => D.isHidden(x.item.id)),
          recipes: D.recipes.some((r) => D.isHidden(r.result) || Object.keys(r.ingredients).some(D.isHidden)), drops,
          stock: (D.shopStock || []).some(D.isHidden), start: Object.keys(DK.config.startingBag).some(D.isHidden),
          missions: D.missions.templates.some((m) => m.type === 'capture' || D.isHidden(m.reward.item)),
        };
      });
      check(r.hid.includes('cristal_vinculo') && r.hid.includes('cristal_mayor'), 'los cristales deberían estar ocultos: ' + r.hid);
      check(r.bag === 0 && !r.list, 'no deberían entrar en la bolsa ni verse');
      check(!r.recipes && !r.drops && !r.stock && !r.start && !r.missions, 'siguen apareciendo cristales: ' + JSON.stringify(r));
      await p.evaluate(() => DK.router.reset('craft')); await sleep(400);
      check(!(await p.evaluate(() => document.body.textContent.includes(DK.data.items.cristal_vinculo.name))), 'el crafteo enseña cristales de vínculo');
    }),
  }, {
    name: 'Las ranuras del menú principal tienen sus botones alineados y todas sus estadísticas',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.store.save(); DK.store.flush && DK.store.flush(); DK.router.reset('mainMenu'); });
      await sleep(600);
      const r = await p.evaluate(() => {
        const cards = [...document.querySelectorAll('.save-slot')];
        const full = document.querySelector('.save-slot.full');
        const tools = [...full.querySelectorAll('.save-tool')].map((b) => b.getBoundingClientRect());
        const mains = cards.map((c) => c.querySelector('.save-main').getBoundingClientRect());
        return {
          n: cards.length, stats: full.querySelectorAll('.save-stat').length, tools: tools.length,
          toolsRow: tools.every((x) => Math.abs(x.top - tools[0].top) < 1 && Math.abs(x.width - tools[0].width) < 1),
          inside: cards.every((c) => [...c.querySelectorAll('button')].every((b) => b.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1)),
          mainsAligned: innerWidth < 700 || mains.every((m) => Math.abs(m.bottom - mains[0].bottom) < 2),
        };
      });
      check(r.n === 3 && r.stats === 6, 'faltan ranuras o estadísticas: ' + JSON.stringify(r));
      check(r.tools === 4 && r.toolsRow, 'las opciones de la partida deberían ir en una fila de botones iguales: ' + JSON.stringify(r));
      check(r.inside && r.mainsAligned, 'los botones no están alineados o se salen: ' + JSON.stringify(r));
    }),
  }],
};
