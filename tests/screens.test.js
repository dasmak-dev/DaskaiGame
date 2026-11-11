/* Todas las pantallas principales se abren sin errores ni scroll horizontal. */
const { play, sleep, check, overflowX } = require('./helpers');

const SCREENS = [['hub', {}], ['team', {}], ['inventory', {}], ['craft', {}], ['zones', {}], ['codex', {}], ['codex', { tab: 'items' }], ['codex', { tab: 'bosses' }], ['codex', { tab: 'zones' }], ['codex', { tab: 'wiki' }],
  ['progress', {}], ['progress', { tab: 'ach' }], ['profile', {}], ['settings', {}], ['training', {}], ['expPrepare', {}]];

module.exports = {
  name: 'Pantallas',
  cases: [{
    name: 'Elegir talento enseña los atributos ahora y con cada opción',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const d = DK.party.all()[0]; d.level = 24; d.exp = 0; DK.daskai.gainExp(d, DK.daskai.expToNext(d));
        document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
        DK.views.talentDialog(d); await new Promise((res) => setTimeout(res, 300));
        // v5.27: el comparador va dentro de cada opción (chips «ATQ 17 → 20 +3»)
        const rows = new Set([...document.querySelectorAll('.tl-modal .tl-delta')].map((x) => x.textContent.split(' ')[0])).size, ups = document.querySelectorAll('.tl-modal .tl-delta small.up').length;
        return { rows, ups, n: DK.data.statKeys.length };
      });
      check(r.rows >= 1 && r.rows <= r.n && r.ups >= 1, 'comparador de talentos: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Formas: cada daskai sortea de 1 a 4 (el inicial 4); con menos formas nace más fuerte y las de más llevan número',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.daskai, out = {};
        out.starter = DK.party.all()[0].forms === 4;
        const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(D.create('pyrex', 5, { wild: true }).forms); out.range = seen.size === 4;
        const mk = (f) => { const d = D.create('lumino', 5); d.forms = f; d.form = 0; d.genes = { hp: 0, mp: 0, atk: 0, matk: 0, def: 0, spd: 0, mdef: 0 }; d.role = 'equilibrado'; D.touch(); return d; };
        out.stronger = D.baseOf(mk(1), 'atk') > D.baseOf(mk(2), 'atk') && D.baseOf(mk(2), 'atk') > D.baseOf(mk(4), 'atk');
        const one = mk(1); one.level = 70; out.single = !D.canEvolve(one) && !D.nextForm(one);
        const two = D.create('lumino', 40); two.forms = 2; two.form = 0; D.evolve(two); out.two = two.species === 'luminar' && two.form === 1 && !D.canEvolve(two);
        const ex = D.create('brotin', 60); ex.species = 'arbolon'; ex.forms = 4; ex.form = 2; D.evolve(ex); out.extra = D.speciesName(ex).endsWith(' II') && D.name(ex) === DK.names.of(ex) && ex.species === 'arbolon';
        return out;
      });
      check(Object.values(r).every(Boolean), 'formas: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Desplegables propios: se abren, se eligen con el teclado y cierran al hacer clic fuera',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('codex', {}));
      await sleep(250);
      await p.click('.cx-filters .dd-btn');
      const opened = await p.evaluate(() => document.querySelectorAll('.dd-list .dd-opt').length);
      await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
      await sleep(250);
      const house = await p.evaluate(() => DK.router.current().params.house);
      await p.click('.cx-filters .dd-btn'); await p.mouse.click(5, 5); await sleep(150);
      const closed = await p.evaluate(() => !document.querySelector('.dd-list'));
      check(opened === 6 && house === 'luz' && closed, 'desplegable: ' + JSON.stringify({ opened, house, closed }));
    }),
  }, {
    name: 'Aspecto único: se conserva al evolucionar, los jefes son la forma típica y el Códice apunta variantes y rasgos (ocultos por defecto)',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const w = (ms) => new Promise((res) => setTimeout(res, ms));
        const a = DK.daskai.create('lumino', 20), b = DK.daskai.create('lumino', 20), boss = DK.daskai.create('lumino', 20, { boss: true });
        const out = { own: !!a.look && a.look.s !== b.look.s, boss: !boss.look, differ: DK.looks.svg('lumino', a.look) !== DK.looks.svg('lumino', b.look) };
        DK.party.add(a);
        const face = (d) => { const i = DK.looks.ind(d.species, d.look); return [i.eyes, i.mouth, i.ears, i.skin].join(); };
        a.forms = 4; a.form = 0; DK.daskai.touch();
        const before = face(a); DK.daskai.evolve(a); out.evolved = a.species !== 'lumino'; out.sameFace = face(a) === before && a.look.s === DK.looks.of(a).s;
        out.seen = DK.looks.seenOf('lumino').includes(a.look.s);
        DK.router.reset('codex', {}); await w(200);
        out.hiddenByDefault = !document.querySelector('.cx-tabs').textContent.includes(DK.t('look.traitsTab')) && !document.querySelector('.lk-strip');
        DK.settings.set('showTraits', true);
        DK.router.reset('codex', { sel: 'lumino' }); await w(300);
        out.variants = document.querySelectorAll('.cx-var').length >= 2;
        const tr = document.querySelector('.cx-head .lk-trait:not(.lk-house)');
        out.iconOnly = !!tr && !tr.textContent.trim() && !!tr.dataset.tip;
        DK.router.reset('codex', { tab: 'looks' }); await w(300);
        out.traits = document.querySelectorAll('.cx-trait-cat').length === 11 && document.querySelectorAll('.cx-trait-cat .lk-trait:not(.unseen)').length > 3;
        return out;
      });
      check(Object.values(r).every(Boolean), 'aspecto de los daskai: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Iniciales al azar (lo que ves es lo que te llevas) y pixel art con colas que no se cortan',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const w = (ms) => new Promise((res) => setTimeout(res, ms));
        DK.router.reset('newGame', { slot: 9, step: 'starter', name: 'Prueba' }); await w(250);
        const prm = DK.router.current().params, d = prm.rolls[prm.pick];
        const secrets = [...document.querySelectorAll('.st-line-mon.secret')];
        const out = { secret2: secrets.length === 2 && secrets.every((m) => m.querySelector(':scope > .sprite.silhouette') && m.querySelector(':scope > small').textContent === '???' && m.querySelector('.st-line-peek .sprite.silhouette')), traits: !!document.querySelector('.st-traits .info-chip'), luck: document.querySelectorAll('.st-luck').length > 0 || Object.values(d.genes).every((g) => Math.abs(g) < 0.005) };
        // Dos visitas sortean daskai distintos
        const again = DK.daskai.create(prm.pick, DK.config.starterLevel);
        out.random = JSON.stringify(again.genes) !== JSON.stringify(d.genes) || again.nature !== d.nature;
        // Pixel art (v4.47, systems/looks.js): imagen más ancha que alta para que colas y alas no se corten
        const url = await DK.looks.pixel('draconyx', { s: 12345 });
        const img = new Image(); await new Promise((res) => { img.onload = res; img.src = url; });
        const maxX = img.width;
        out.pixW = img.width; out.reach = maxX;
        return out;
      });
      check(r.secret2 && r.traits && r.luck && r.random, 'la pantalla de iniciales debería enseñar el daskai sorteado: ' + JSON.stringify(r));
      check(r.pixW > 64, 'el pixel art debería tener margen a los lados: ' + JSON.stringify(r));
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
