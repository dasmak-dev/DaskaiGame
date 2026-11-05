/* Todas las pantallas principales se abren sin errores ni scroll horizontal. */
const { play, sleep, check, overflowX } = require('./helpers');

const SCREENS = [['hub', {}], ['team', {}], ['inventory', {}], ['craft', {}], ['zones', {}], ['codex', {}], ['codex', { tab: 'items' }], ['codex', { tab: 'bosses' }], ['codex', { tab: 'zones' }], ['codex', { tab: 'wiki' }],
  ['progress', {}], ['progress', { tab: 'ach' }], ['profile', {}], ['settings', {}], ['training', {}], ['expPrepare', {}]];

module.exports = {
  name: 'Pantallas',
  cases: [{
    name: 'Iniciales al azar (lo que ves es lo que te llevas) y pixel art con colas que no se cortan',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const w = (ms) => new Promise((res) => setTimeout(res, ms));
        DK.router.reset('newGame', { slot: 9, step: 'starter', name: 'Prueba' }); await w(250);
        const prm = DK.router.current().params, d = prm.rolls[prm.pick];
        const out = { traits: !!document.querySelector('.st-traits .info-chip'), luck: document.querySelectorAll('.st-luck').length > 0 || Object.values(d.genes).every((g) => Math.abs(g) < 0.005) };
        // Dos visitas sortean daskai distintos
        const again = DK.daskai.create(prm.pick, DK.config.starterLevel);
        out.random = JSON.stringify(again.genes) !== JSON.stringify(d.genes) || again.nature !== d.nature;
        // Pixel art: un daskai con cola larga ocupa más de 64 px de ancho
        const sp = Object.values(DK.data.species).find((x) => x.id === 'draconyx') || Object.values(DK.data.species)[0];
        const url = await DK.sprites.pixel(sp, {});
        const img = new Image(); await new Promise((res) => { img.onload = res; img.src = url; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data; let maxX = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 200) maxX = Math.max(maxX, ((i - 3) / 4) % c.width);
        out.pixW = img.width; out.reach = maxX;
        return out;
      });
      check(r.traits && r.luck && r.random, 'la pantalla de iniciales debería enseñar el daskai sorteado: ' + JSON.stringify(r));
      check(r.pixW > 64 && r.reach > 82, 'la cola debería verse en el pixel art: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Se abren todas sin errores ni scroll horizontal',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        ['umbrix', 'aquelo', 'terron'].forEach((s, i) => DK.party.add(DK.daskai.create(s, 6 + i)));
        Object.keys(DK.data.items).slice(0, 25).forEach((id) => DK.bag.add(id, 2));
        DK.wallet.add(2000, { silent: true });
      });
      for (const [id, params] of SCREENS) {
        await p.evaluate(([id, params]) => DK.router.reset(id, params), [id, params]);
        await sleep(250);
        const over = await overflowX(p);
        check(over <= 1, `«${id}» se sale ${over}px por la derecha`);
      }
      // Expedición: mapa, barra de estado y resumen
      await p.evaluate(() => { DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0); DK.router.reset('expedition'); });
      await sleep(400);
      check((await overflowX(p)) <= 1, 'el mapa de la expedición se sale por la derecha');
      await p.evaluate(() => { DK.expedition.retreat() || DK.expedition.complete(); DK.ui.closeAll(); DK.router.reset('expSummary'); });
      await sleep(300);
    }),
  }, {
    name: 'Batalla: mapa del mundo con las zonas desbloqueadas, la siguiente «???» y la ficha de la elegida',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { const ids = Object.keys(DK.data.zones); ids.slice(0, 3).forEach((id) => (DK.world.progress(id).unlocked = true)); DK.router.reset('zones'); });
      await sleep(500);
      const r = await p.evaluate(() => ({ open: document.querySelectorAll('button.wm2-node').length, locked: document.querySelectorAll('.wm2-node.locked').length, more: document.querySelectorAll('.wm2-node.more').length, leader: !!document.querySelector('.wm2-node.selected .wm2-leader'), card: document.querySelector('.bz-card h3') && document.querySelector('.bz-card h3').textContent, hero: !!document.querySelector('.bt-prep .bt-go') }));
      check(r.open === 3 && r.locked === 1 && r.more === 1, 'el mapa del mundo no muestra bien las zonas: ' + JSON.stringify(r));
      check(r.leader && r.card && r.hero, 'faltan el líder, la ficha o el botón de la expedición');
      await p.click('button.wm2-node >> nth=2'); await sleep(300);
      const same = await p.evaluate(() => document.querySelector('.bz-card h3').textContent === Object.values(DK.data.zones)[2].name);
      check(same, 'pulsar una zona no cambia la ficha');
      check((await overflowX(p)) <= 1, 'la pantalla de batalla se sale por la derecha');
    }),
  }],
};
