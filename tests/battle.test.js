/* Combate: casas y daño, ruptura, cura en automático y un combate completo. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Combate',
  cases: [{
    name: 'Pasivas al entrar: bajan al rival o suben al propio durante unos turnos y se acaban',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, a = DK.party.active()[0];
        a.passive = 'mirada_fiera';
        const st = B.start('pradera', a.uid, {});
        st.enemy.passive = 'equilibrio';
        st.timed.enemy = st.timed.enemy.filter((x) => x.src === 'mirada_fiera'); st.timed.ally = [];
        const base = DK.daskai.stats(st.enemy).atk * B.stageMult(st.stages.enemy.atk || 0), now = B.stat(st, 'enemy', 'atk');
        const tags = B.timedOf(st, 'enemy').length, log = (st.entryLog || []).length;
        const lefts = [];
        for (let i = 0; i < 4; i++) { st.enemy.cur.hp = 9999; a.cur.hp = 9999; B.turn(st, { type: 'guard' }); lefts.push(B.timedOf(st, 'enemy').length ? B.timedOf(st, 'enemy')[0].left : 0); }
        // Arranque: +25% velocidad propia; al cambiar se va con él
        a.passive = 'arranque';
        const st2 = B.start('pradera', a.uid, {}); st2.enemy.passive = 'equilibrio';
        st2.timed.ally = st2.timed.ally.filter((x) => x.src === 'arranque'); const spd = B.timedMult(st2, 'ally', 'spd');
        return { ratio: now / base, tags, log, lefts, spd };
      });
      check(Math.abs(r.ratio - 0.85) < 0.02 && r.tags === 1 && r.log >= 1, 'mirada fiera no baja el ataque del rival: ' + JSON.stringify(r));
      check(r.lefts.join(',') === '3,2,1,0', 'el efecto debería durar 3 turnos: ' + r.lefts.join(','));
      check(Math.abs(r.spd - 1.25) < 0.02, 'arranque no sube la velocidad: ' + r.spd);
    }),
  }, {
    name: 'La fórmula de daño es coherente (sin NaN, crítico, defensa, defenderse y estimación)',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, raw = (o) => B.rawDamage(Object.assign({ power: 50, kind: 'fisico', attLevel: 10, atk: 40, def: 40 }, o));
        const a = DK.party.active()[0], st = B.start('pradera', a.uid, {});
        const mv = DK.data.moves[DK.daskai.battleMoves(a).find((m) => DK.data.moves[m].power > 0)];
        const plain = B.damage(st, 'enemy', mv, { random: false }).dmg; st.guarding = true;
        const guarded = B.damage(st, 'enemy', mv, { random: false }).dmg; st.guarding = false;
        const est = B.estimate(st, mv.id), max = B.damage(st, 'ally', mv, { random: false, ignoreHouse: !st.known, hideWeak: true }).dmg;
        const rolls = Array.from({ length: 200 }, () => B.damage(st, 'ally', mv, { ignoreHouse: !st.known, hideWeak: true }));
        const noCrit = rolls.filter((x) => !x.crit).map((x) => x.dmg);
        return {
          zero: raw({ atk: 0, def: 0 }), nan: raw({ atk: NaN, def: undefined }),
          crit: raw({ crit: true }) > raw({}), def: raw({ def: 80 }) < raw({ def: 20 }), power: raw({ power: 100 }) > raw({ power: 50 }),
          burn: raw({ burned: true }) < raw({}), burnMagic: raw({ kind: 'magico', burned: true }) === raw({ kind: 'magico' }),
          guard: guarded < plain, est, max, inRange: noCrit.every((x) => x >= est[0] - 1 && x <= est[1]),
          timed: (st.timed.enemy.push({ stat: 'atk', pct: -2, left: 3 }), B.timedMult(st, 'enemy', 'atk')),
        };
      });
      check(r.zero >= 1 && r.nan >= 1, 'el daño no puede ser NaN ni 0: ' + JSON.stringify(r));
      check(r.crit && r.def && r.power, 'crítico, defensa o potencia no influyen como deberían: ' + JSON.stringify(r));
      check(r.burn && r.burnMagic, 'la quemadura sólo debe bajar el daño físico: ' + JSON.stringify(r));
      check(r.guard, 'defenderse debería reducir el daño recibido');
      check(r.est[1] === r.max && r.inRange, 'la estimación no coincide con el daño real: ' + JSON.stringify(r));
      check(r.timed > 0, 'un efecto temporal no puede dejar el atributo a 0 o negativo: ' + r.timed);
    }),
  }, {
    name: 'Doble casa: iniciales, jefes, eficacia combinada, misma casa y ataques de la segunda',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, D = DK.data;
        const st0 = DK.daskai.create('lumino', 5, { starter: true });
        const w = Array.from({ length: 300 }, () => DK.daskai.create('lumino', 10, { wild: true, dual: Math.random() < DK.config.dual.wild })).filter((d) => DK.daskai.isDual(d)).length;
        const zb = Object.values(D.zones)[0].boss, b1 = DK.daskai.create(zb.species, 20, { boss: true, dual: true }), b2 = DK.daskai.create(zb.species, 20, { boss: true, dual: true });
        const d = DK.daskai.create('lumino', 30, { house2: 'agua' });
        const h1 = D.species.lumino.house, strongVs = D.houses.fuego.strongVs;
        const mul = B.houseMult('fuego', [strongVs, strongVs === 'luz' ? 'agua' : 'luz']).mult;
        const single = B.houseMult('fuego', strongVs).mult;
        const waterMove = Object.values(D.moves).find((m) => m.house === 'agua' && m.power);
        return { starterDual: DK.daskai.isDual(st0), starter2: st0.house2 !== D.species.lumino.house, wildPct: w / 300, boss2: b1.house2 === b2.house2 && !!b1.house2,
          houses: DK.daskai.houses(d), stab: B.isStab(d, waterMove), learns: DK.daskai.learnset(d).some(([, m]) => D.moves[m].house === 'agua'), knows: d.learned.some((m) => D.moves[m].house === 'agua'),
          mulOk: Math.abs(mul - single * B.houseMult('fuego', strongVs === 'luz' ? 'agua' : 'luz').mult) < 1e-9, look: !!(DK.looks.of(d) || {}).h2, h1 };
      });
      check(r.starterDual && r.starter2, 'el inicial debería ser de doble casa (con otra casa distinta): ' + JSON.stringify(r));
      check(r.wildPct < 0.15, 'demasiados salvajes de doble casa: ' + r.wildPct);
      check(r.boss2, 'cada jefe debería tener siempre la misma segunda casa');
      check(r.houses.length === 2 && r.houses[1] === 'agua', 'houses() no devuelve las dos casas: ' + r.houses);
      check(r.stab, 'un ataque de su segunda casa debería tener el bonus de misma casa');
      check(r.learns && r.knows, 'debería aprender (y conocer) ataques de su segunda casa');
      check(r.mulOk, 'la eficacia contra doble casa debería multiplicar las dos');
      check(r.look, 'el aspecto debería llevar la segunda casa (h2)');
    }),
  }, {
    name: 'La eficacia usa la casa del ataque y la misma casa da bonus',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, D = DK.data;
        const lumino = DK.daskai.create('lumino', 10); DK.party.add(lumino);
        const st = B.start('pradera', lumino.uid, {}); st.known = true;
        const fire = Object.keys(D.species).find((k) => D.species[k].house === 'fuego');
        st.enemy = DK.daskai.create(fire, 5, { wild: true });
        const luzMove = Object.values(D.moves).find((m) => m.house === 'luz' && m.power);
        const f = (m) => B.factors(st, 'ally', D.moves[m] || m);
        return {
          water: B.effOf(st, 'burbuja'),                         // Agua contra Fuego: eficaz aunque Lumino sea de Luz
          neutral: B.effOf(st, 'placaje'),                       // sin casa → la del daskai (Luz contra Fuego: normal)
          stab: f(luzMove).parts.some((x) => x.k === 'stab'),
          noStab: f('burbuja').parts.some((x) => x.k === 'stab'),
          houseMult: f('burbuja').parts.find((x) => x.k === 'house').v,
        };
      });
      check(r.water === 'strong', `Burbuja contra Fuego debería ser eficaz (es ${r.water})`);
      check(r.neutral == null, 'Placaje de un daskai de Luz contra Fuego debería ser normal');
      check(r.stab && !r.noStab, 'el bonus de misma casa no se aplica bien');
      check(r.houseMult === 1.5, 'el multiplicador de casa fuerte no es ×1,5');
    }),
  }, {
    name: 'La ruptura aturde al jefe un turno y luego se recupera',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, st = B.start('pradera', DK.party.active()[0].uid, { boss: true });
        const ev = []; B.addBreak(st, 9999, ev);
        const stunned = B.intentInfo(st).type === 'stunned';
        const t1 = B.turn(st, { type: 'guard' });
        const actedWhileBroken = t1.some((e) => e.anim === 'attack' && e.side === 'enemy');
        const t2 = B.turn(st, { type: 'guard' });
        return { stunned, actedWhileBroken, recovered: !st.broken, actsAfter: t2.some((e) => e.anim === 'attack' && e.side === 'enemy'), max: st.breakMax };
      });
      check(r.stunned && !r.actedWhileBroken, 'el jefe roto no debería actuar');
      check(r.recovered && r.actsAfter, 'el jefe debería recuperarse y volver a atacar');
      check(r.max > 100, 'la barra de ruptura debería crecer tras romperse');
    }),
  }, {
    name: 'El automático cura con un objeto en zona crítica',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        DK.bag.add('pocion', 2); DK.bag.add('superpocion', 1);
        const st = DK.battle.start('pradera', DK.party.active()[0].uid, {});
        const a = DK.battle.ally(st); a.cur.hp = Math.floor(DK.daskai.stats(a).hp * 0.28);
        // Lo esperado depende de su vida máxima (aleatoria): la Poción si cubre al menos la mitad de lo
        // que falta; si no, la Superpoción (antes daba por hecho la Poción y fallaba con inicial de mucha vida)
        const missing = DK.daskai.stats(a).hp - a.cur.hp;
        const expected = DK.bag.potency('pocion', a).hp >= missing * 0.5 ? 'pocion' : 'superpocion';
        return { should: DK.battle.autoShouldHeal(st), item: DK.battle.autoHealItem(st), expected };
      });
      check(r.should, 'debería querer curarse por debajo del umbral');
      check(r.item === r.expected, `debería usar el objeto más barato que sirva (usa ${r.item}, tocaba ${r.expected})`);
    }),
  }, {
    name: 'Un combate completo con el teclado o el dedo',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.go('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid }));
      await sleep(600);
      await p.evaluate(() => { DK.router.current().params.state.enemy.cur.hp = 1; });
      for (let i = 0; i < 20 && !(await p.$('.end-panel, .end-exp')); i++) {
        // el primer ataque que haga daño (desde la v4.71 el inicial también tiene ataques de apoyo de su segunda casa)
        const k = await p.evaluate(() => { const a = DK.battle.ally(DK.router.current().params.state); const i = a.moves.findIndex((m) => DK.data.moves[m].power > 0); return Math.max(0, i); });
        const b = (await p.$$('.bmove'))[k];
        if (b && !(await b.evaluate((x) => x.disabled))) { if (view.touch) await b.tap(); else await p.keyboard.press(String(k + 1)); }
        await sleep(500);
        const m = await p.$('.modal .btn-primary'); if (m) { await m.click().catch(() => {}); await sleep(200); }
      }
      check(await p.$('.end-panel, .end-exp'), 'el combate no ha terminado');
    }),
  }],
};
