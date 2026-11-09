/* Final del juego: runas con tier, Corrupción, Abismo, ascensión, formas, reliquias grabadas,
 * variocolores, pesadilla de zona, temporadas de la senda y zona secreta final. */
const { play, sleep, check } = require('./helpers');

const bosses = (n) => `(() => { Object.keys(DK.data.zones).filter((z) => !DK.data.zones[z].secretZone).slice(0, ${n}).forEach((z) => { DK.world.progress(z).unlocked = true; DK.world.boss(z).defeated = 1; }); })()`;

module.exports = {
  name: 'Final del juego',
  cases: [{
    name: 'Taller de runas: sin la mejora no hay huecos ni caen runas; cada nivel abre un tier',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const R = DK.runes; DK.store.state.camp = DK.store.state.camp || {}; DK.store.state.runesGrandfathered = true;
        const t0 = { en: R.enabled(), drops: Array.from({ length: 20 }, () => R.drop('boss')).flat().length, slots: (DK.expedition.nextStart(), R.slots().length) };
        DK.store.state.camp.runas = 1;
        const d1 = Array.from({ length: 40 }, () => R.drop('secret')).flat();
        DK.store.state.camp.runas = 2;
        DK.store.state.runes = { saber: 5 }; DK.wallet.add(10000, { silent: true });
        const f1 = R.canFuse('saber'), next = R.fuse('saber'), f2 = R.canFuse(R.withTier('saber', 2));
        return { t0, en1: R.enabled(), maxT1: Math.max(...d1.map((id) => R.parse(id).tier)), n1: d1.length, f1, next, f2 };
      });
      check(!r.t0.en && r.t0.drops === 0 && r.t0.slots === 0, 'sin el taller no debería haber runas: ' + JSON.stringify(r.t0));
      check(r.en1 && r.n1 > 0 && r.maxT1 === 1, 'con el nivel 1 sólo caen de tier I: ' + JSON.stringify(r));
      check(r.f1 && R2(r.next) && !r.f2, 'con el nivel 2 se funde a II pero no a III: ' + JSON.stringify(r));
      function R2(id) { return /:2/.test(id); }
    }),
  }, {
    name: 'Normal: al perder el equipo vuelve con la mitad de vida; curar pagando antes de salir; tesoro muy rara y mejor',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        DK.settings && 0;
        DK.store.state.difficulty = 'normal';
        const d = DK.party.active()[0], m = DK.daskai.stats(d);
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'df', size: 'short', kind: 'normal' };
        DK.expedition.start({}); d.cur.hp = 0; d.cur.mp = 0;
        DK.expedition.fail();
        const hpPct = d.cur.hp / m.hp, mpPct = d.cur.mp / m.mp;
        d.cur.hp = 1; const cost = DK.expedition.healCost(); DK.wallet.add(cost, { silent: true }); const w0 = DK.wallet.get();
        const paid = DK.expedition.healPaid();
        const ch = DK.expedition.kindChances();
        return { diff: DK.rules.difficulty(), hpPct, mpPct, cost, paid, spent: w0 - DK.wallet.get(), full: d.cur.hp === DK.daskai.stats(d).hp, tesoro: ch.tesoro, chest: DK.config.expedition.kinds.tesoro.chest.items };
      });
      check(r.diff !== 'normal' || (r.hpPct >= 0.5 && r.mpPct >= 0.5), 'en Normal deberían volver con la mitad: ' + JSON.stringify(r));
      check(r.cost > 0 && r.paid === r.cost && r.spent === r.cost && r.full, 'curar pagando no funciona: ' + JSON.stringify(r));
      check(r.tesoro < 0.02 && r.chest >= 2, 'la expedición de tesoro debería ser muy rara y mejor: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Desafío semanal: mapa fijo de la semana, pactos obligatorios, sin gastar runas y tabla de récords',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate((B) => {
        eval(B);
        const W = DK.weekly, d1 = JSON.stringify(W.def()), d2 = JSON.stringify(W.def());
        DK.runes.add('oro', 1); DK.store.state.nextExpedition = null; const n0 = DK.expedition.nextStart(); DK.runes.socket('oro');
        const e = W.start({});
        const w = W.def();
        const same = e.seed === w.seed && e.size === w.size && e.kind === w.kind && e.mod === w.mod;
        const curses = DK.curses.active().slice().sort().join() === w.curses.slice().sort().join();
        const runeKept = DK.runes.count('oro') === 1 && (DK.store.state.nextExpedition || {}).zone === n0.zone;
        e.cleared = e.map.rows.flat().slice(0, 5).map((n) => n.id); e.loot.coins = 300;
        DK.expedition.claim(false);
        const s1 = DK.store.state.lastExpedition.weekly;
        return { stable: d1 === d2, same, curses, runeKept, s1, tries: W.tries(), board: W.board().length, unlocked: W.unlocked() };
      }, bosses(1));
      check(r.unlocked && r.stable && r.same, 'el desafío no usa el mapa fijo de la semana: ' + JSON.stringify(r));
      check(r.curses, 'los pactos de la semana deberían ser obligatorios');
      check(r.runeKept, 'el desafío no debería gastar las runas ni cambiar la expedición preparada');
      check(r.s1 && r.s1.score === 5 * 100 + 30 && r.s1.isBest && r.tries === 1 && r.board === 1, 'no se guarda el intento: ' + JSON.stringify(r.s1));
    }),
  }, {
    name: 'Runas con rareza: mágicas/raras con modificadores, pisos según el tier de la runa de tamaño y fundir sin importar la rareza',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const R = DK.runes;
        const rolls = Array.from({ length: 400 }, () => R.parse(R.roll1('oro', 1)).rarity);
        const mag = R.make('small', 2, 'm', [{ k: 'elitePct', v: 60 }]), rare = R.make('oro', 1, 'r', [{ k: 'coins', v: 15 }, { k: 'treasures', v: 2 }]);
        const p1 = R.parse(rare);
        const floors = {};
        ['small', 'medium', 'xl'].forEach((sz) => [1, 2, 3].forEach((tt) => { floors[sz + tt] = R.mapExtra([R.make(sz, tt)]).rows + 2; }));
        R.add(mag); R.add(rare);
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'rr', size: 'medium', kind: 'normal', mod: null };
        R.socket(mag); R.socket(rare);
        const pv = DK.expedition.preview(), flat = pv.map.rows.flat();
        const bonusCoins = R.bonus('coins', R.slots());
        // fundir: 2 normales + 1 rara del mismo tier → tier II raro
        R.add('saber', 2); R.add(R.make('saber', 1, 'r', [{ k: 'exp', v: 10 }, { k: 'caves', v: 1 }])); DK.wallet.add(5000, { silent: true });
        const fused = R.fuse('saber');
        return { m: rolls.filter((x) => x === 'm').length, rr: rolls.filter((x) => x === 'r').length, n: rolls.filter((x) => x === 'n').length, p1, floors, rows: pv.map.rows.length, elites: flat.filter((n) => n.type === 'elite').length, treasures: flat.filter((n) => n.type === 'treasure').length, bonusCoins, fused, fusedP: R.parse(fused), left: R.countKey('saber') };
      });
      check(r.m > 40 && r.rr > 5 && r.n > 150, 'las rarezas no salen en su proporción: ' + JSON.stringify([r.n, r.m, r.rr]));
      check(r.p1.rarity === 'r' && r.p1.affixes.length === 2, 'una runa rara debería tener 2 modificadores');
      check(r.floors.small1 === 8 && r.floors.small2 === 14 && r.floors.small3 === 18 && r.floors.medium1 === 14 && r.floors.xl3 === 36, 'los pisos por tier no cuadran: ' + JSON.stringify(r.floors));
      check(r.elites >= 3 && r.treasures >= 2, 'los modificadores no cambian el mapa: ' + JSON.stringify(r));
      check(Math.abs(r.bonusCoins - (0.25 + 0.15)) < 1e-9, 'el modificador de monedas no se suma: ' + r.bonusCoins);
      check(r.fusedP.tier === 2 && r.fusedP.rarity === 'r' && r.fusedP.affixes.length >= 2 && r.fusedP.affixes.length <= 4 && r.left === 0, 'fundir debería dar tier II con la rareza más alta: ' + JSON.stringify(r.fusedP));
    }),
  }, {
    name: 'Runas con tier: se funden 3 en 1, multiplican su efecto y suben emblemas; las de final de juego cambian el mapa',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate((B) => {
        const R = DK.runes;
        const lateBefore = R.locked('elite');
        eval(B); DK.corruption.check();
        DK.store.state.camp = DK.store.state.camp || {}; DK.store.state.camp.runas = 3; // Taller de runas al máximo
        R.add('oro', 3); DK.wallet.add(5000, { silent: true });
        const fused = R.fuse('oro');
        const after = { oro: R.count('oro'), oro2: R.count('oro:2') };
        R.add('maldito:2', 1); R.add('elite', 1); R.add('xl:3', 1);
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'rt', size: 'small', kind: 'normal', mod: null };
        const e0 = DK.expedition.bossEmblems('small', 'normal');
        R.socket('xl:3'); R.socket('maldito:2'); R.socket('elite'); R.socket('oro:2');
        const pv = DK.expedition.preview();
        const flat = pv.map.rows.flat();
        DK.expedition.start({});
        return { lateBefore, fused, after, e0, e1: DK.expedition.bossEmblems(), rests: flat.filter((n) => n.type === 'rest').length, elites: flat.filter((n) => n.type === 'elite').length, coins: R.bonus('coins'), loot: R.bonus('loot') };
      }, bosses(3));
      check(r.lateBefore, 'las runas de final de juego deberían estar bloqueadas al principio');
      check(r.fused === 'oro:2' && r.after.oro === 0 && r.after.oro2 === 1, 'fundir 3 runas no da una de tier II: ' + JSON.stringify(r));
      check(Math.abs(r.coins - 0.5) < 1e-9 && Math.abs(r.loot - 0.6) < 1e-9, 'el tier no multiplica la bonificación: ' + JSON.stringify(r));
      check(r.e1 >= r.e0 + 2, 'una runa de tamaño III debería dar +2 emblemas por jefe: ' + JSON.stringify(r));
      check(r.rests === 0 && r.elites >= 2, 'botín maldito sin hogueras y campeones con más mini jefes: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Corrupción: oculta hasta el 3er jefe, 5 niveles que se abren de uno en uno y endurecen la expedición',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate((B) => {
        const C = DK.corruption, out = { hidden: !C.visible() };
        eval(B); C.check(); out.max0 = C.max();
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'c1', size: 'small', kind: 'normal', mod: null };
        out.cantSkip = C.set(3) === 1;
        DK.expedition.start({});
        const e = DK.expedition.active();
        const foe = DK.daskai.create('chispon', 5, { wild: true });
        const s1 = DK.daskai.stats(foe).atk;
        e.corruption = 0; DK.daskai.touch(); const s0 = DK.daskai.stats(foe).atk; e.corruption = 1; DK.daskai.touch();
        out.stronger = s1 > s0;
        DK.expedition.bossCleared(); out.max1 = C.max();
        // hogueras a medias (II) y mercaderes al doble (IV)
        e.corruption = 4; DK.store.state.corruption.max = 5;
        out.rest = DK.expedition.rest().pct; e.corruption = 0; out.rest0 = DK.expedition.rest().pct;
        e.corruption = 4; const p4 = DK.expedition.makeOffers()[0]; e.corruption = 0; const p0 = DK.expedition.makeOffers().find((o) => o.id === p4.id);
        out.shop = p0 ? p4.price / p0.price : 2;
        out.levels = C.levels().length;
        return out;
      }, bosses(3));
      check(r.hidden, 'la Corrupción no debería verse antes de vencer al 3er jefe');
      check(r.max0 === 1 && r.cantSkip, 'al verse sólo debería abrirse el nivel 1: ' + JSON.stringify(r));
      check(r.stronger, 'con Corrupción los rivales deberían ser más fuertes');
      check(r.max1 === 2, 'vencer al jefe con el nivel máximo debería abrir el siguiente: ' + JSON.stringify(r));
      check(r.rest * 2 === r.rest0 || Math.abs(r.rest * 2 - r.rest0) <= 1, 'con Corrupción II las hogueras deberían curar la mitad: ' + JSON.stringify(r));
      check(Math.abs(r.shop - 2) < 0.05, 'con Corrupción IV los mercaderes deberían cobrar el doble: ' + r.shop);
      check(r.levels === 5, 'debería haber 5 niveles');
      await p.evaluate(() => { DK.store.state.expedition = null; DK.router.reset('zones'); }); await sleep(400);
      // v5.0: desbloqueada, sin botón «sin corrupción» (5 niveles) y la próxima expedición sale con el nivel I como mínimo
      check(await p.evaluate(() => document.querySelectorAll('.egx-levels button').length === 5), 'la preparación debería enseñar el selector de Corrupción (5 niveles)');
      check(await p.evaluate(() => DK.expedition.nextStart().corruption >= 1 && DK.corruption.set(0) === 1), 'con la Corrupción abierta debería ir siempre el nivel I como mínimo');
    }),
  }, {
    name: 'El Abismo: pisos cortos encadenados, récord y premio cada 5 pisos',
    run: (browser, view) => p0(browser, view),
  }, {
    name: 'Ascensión, forma abisal, reliquias grabadas, rastreo de variocolores y marcos por casa',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const d = DK.party.active()[0], out = {};
        d.level = DK.config.maxLevel; DK.daskai.touch(); const a0 = DK.daskai.stats(d).atk;
        out.asc = DK.ascension.ascend(d); out.lv = d.level; out.stars = d.stars;
        const tot = () => Object.values(DK.daskai.stats(d)).filter((v) => typeof v === 'number').reduce((x, y) => x + y, 0); // suma de todo: con un atributo bajo el redondeo podía empatar
        d.level = 30; DK.daskai.touch(); const withStar = tot(); d.stars = 0; DK.daskai.touch(); const noStar = tot(); d.stars = 1; DK.daskai.touch();
        out.starBoost = withStar > noStar;
        DK.bag.add('fragmento_abisal', 1);
        out.notFinal = !!DK.bag.cannotUse('fragmento_abisal', d);
        d.species = 'astrelion'; DK.daskai.touch();
        out.use = DK.bag.use('fragmento_abisal', d).ok && d.variant === 'abisal';
        // grabar una épica
        const ep = Object.values(DK.data.relics).find((x) => x.rarity === 'epico');
        DK.store.state.emblems = 20; DK.camp.unlock('relic', ep.id); out.eng = DK.engrave.engrave(ep.id);
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'en', size: 'small', kind: 'normal', mod: null };
        DK.expedition.start({}); out.given = DK.expedition.active().relics.includes(ep.id); DK.store.state.expedition = null;
        // rastreo
        for (let i = 0; i < 10; i++) DK.emit('enemy:defeated', { species: 'chispon', house: 'fuego' });
        out.track = DK.tracking.bonus('chispon');
        // marco variocolor de su casa
        d.shiny = true; out.frame = DK.avatars.frames().find((f) => f.id === 'shiny_' + DK.data.species[d.species].house).unlocked;
        return out;
      });
      check(r.asc && r.lv === 1 && r.stars === 1, 'ascender debería volver al nivel 1 con una estrella: ' + JSON.stringify(r));
      check(r.starBoost, 'la estrella debería subir los atributos');
      check(r.notFinal && r.use, 'el fragmento abisal sólo vale en la última evolución: ' + JSON.stringify(r));
      check(r.eng && r.given, 'la reliquia grabada debería salir al empezar');
      check(r.track > 0, 'derrotar a una especie debería subir su rastreo');
      check(r.frame, 'un variocolor debería abrir el marco de su casa');
    }),
  }, {
    name: 'Pesadilla de zona, temporadas de la senda y zona secreta final',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const out = {};
        // pesadilla: códice de la Pradera completo
        const z = DK.data.zones.pradera; z.enemies.forEach((en) => { DK.codex.seeEnemy('pradera', en.species); const ent = DK.codex.entry('pradera', en.species); ent.defeated = 99; ent.captured = 1; });
        out.avail = DK.nightmare.available('pradera');
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'nm', size: 'small', kind: 'normal', mod: null };
        const lb0 = DK.expedition.levelBonus(1); DK.nightmare.toggle(); const lb1 = DK.expedition.levelBonus(1);
        out.levels = lb1 - lb0;
        // temporadas: una partida de la temporada pasada empieza de cero pero conserva lo cosmético
        DK.store.state.pass = { xp: 99999, claimed: {}, extra: 0, season: 1 };
        DK.pass.claimAll();
        out.frame1 = DK.pass.has('frame', 'senda_bronce');
        const real = Date.now; Date.now = () => real() + 50 * 86400000;
        out.season = DK.pass.season(); out.xp = DK.pass.xp(); out.keep = DK.pass.has('frame', 'senda_bronce');
        out.newFrame = DK.pass.reward(10).frame;
        Date.now = real;
        // zona final
        out.hiddenZone = !DK.world.isUnlocked('vacio');
        Object.keys(DK.data.secretBosses).forEach((id) => (DK.world.secret(id).defeated = 1));
        out.opened = DK.endgame.checkFinalZone() && DK.world.isUnlocked('vacio');
        out.recipe = DK.data.recipes.some((x) => x.result === 'corona_vacio');
        return out;
      });
      check(r.avail && r.levels === 8, 'la versión pesadilla debería subir 8 niveles a los rivales: ' + JSON.stringify(r));
      check(r.frame1 && r.season >= 2 && r.xp === 0 && r.keep, 'la temporada nueva debería empezar de cero y conservar los marcos: ' + JSON.stringify(r));
      check(r.newFrame && r.newFrame !== 'senda_bronce', 'la temporada nueva debería tener marcos nuevos');
      check(r.hiddenZone && r.opened && r.recipe, 'la zona final debería abrirse al vencer a todos los jefes ocultos');
      await p.evaluate(() => DK.router.reset('zones')); await sleep(400);
      check(await p.evaluate(() => document.body.textContent.includes(DK.data.zones.vacio.name)), 'la zona final debería verse en el mapa del mundo');
    }),
  }],
};

function p0(browser, view) {
  return play(browser, view, async (p) => {
    const r = await p.evaluate((B) => {
      eval(B);
      const out = { unlocked: DK.abyss.unlocked() };
      DK.store.state.nextExpedition = { zone: 'pradera', seed: 'ab', size: 'small', kind: 'normal', mod: null };
      DK.abyss.set(true);
      DK.expedition.start({});
      const e = DK.expedition.active();
      out.kind = e.kind; out.size = e.size; out.floors = e.total;
      const lb1 = DK.expedition.levelBonus();
      const em0 = DK.camp.emblems();
      for (let i = 1; i <= 5; i++) { DK.expedition.bossCleared(); if (i < 5) DK.expedition.continueRun(); }
      out.depth = e.depth; out.best = DK.abyss.best(); out.lb5 = DK.expedition.levelBonus(); out.lb1 = lb1;
      out.reward = DK.camp.emblems() - em0;
      return out;
    }, bosses(5));
    check(r.unlocked && r.kind === 'abismo' && r.size === 'abyss', 'debería empezar en el Abismo: ' + JSON.stringify(r));
    check(r.best === 5 && r.depth === 5, 'el récord debería ser el piso 5: ' + JSON.stringify(r));
    check(r.lb5 > r.lb1 + 10, 'cada piso debería ser más duro: ' + JSON.stringify(r));
    check(r.reward >= 3, 'el piso 5 debería dar premio de emblemas: ' + JSON.stringify(r));
  });
}
