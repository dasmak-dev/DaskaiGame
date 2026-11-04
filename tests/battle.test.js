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
        return { should: DK.battle.autoShouldHeal(st), item: DK.battle.autoHealItem(st) };
      });
      check(r.should, 'debería querer curarse por debajo del umbral');
      check(r.item === 'pocion', `debería usar el objeto más barato que sirva (usa ${r.item})`);
    }),
  }, {
    name: 'Un combate completo con el teclado o el dedo',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.go('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid }));
      await sleep(600);
      await p.evaluate(() => { DK.router.current().params.state.enemy.cur.hp = 1; });
      for (let i = 0; i < 20 && !(await p.$('.end-panel')); i++) {
        const b = await p.$('.bmove:not([disabled])');
        if (b) { if (view.touch) await b.tap(); else await p.keyboard.press('1'); }
        await sleep(500);
        const m = await p.$('.modal .btn-primary'); if (m) { await m.click().catch(() => {}); await sleep(200); }
      }
      check(await p.$('.end-panel'), 'el combate no ha terminado');
    }),
  }],
};
