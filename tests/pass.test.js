/* Progreso: Senda del aventurero, «Casi lo tienes», logros por categorías y cambiar misión. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Senda del aventurero y progreso',
  cases: [{
    name: 'Las misiones y logros dan puntos de senda; cada nivel da su premio una sola vez',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const P = DK.pass, x0 = P.xp();
        const m = DK.missions.list('daily')[0]; m.progress = m.target; DK.missions.claim(m);
        const afterMission = P.xp() - x0;
        DK.store.state.stats.wins = Math.max(1, DK.store.state.stats.wins); DK.achievements.check();
        const lv0 = P.level(); P.add(DK.data.pass.xpFor(1) * 3);
        const pend = P.pending().length, coins0 = DK.wallet.get();
        const got = P.claim(1), again = P.claim(1);
        P.add(P.total(10)); P.claimAll();
        const frame = DK.avatars.frames().find((f) => f.id === 'senda_bronce').unlocked;
        return { afterMission, lv0, pend, coinsGot: DK.wallet.get() - coins0, got: !!got, again, frame, level: P.level() };
      });
      check(r.afterMission === 25, 'una misión diaria debería dar 25 puntos: ' + r.afterMission);
      check(r.pend >= 1 && r.got && !r.again, 'el premio de un nivel debería cobrarse una sola vez: ' + JSON.stringify(r));
      check(r.coinsGot >= 200, 'el nivel 1 debería dar monedas');
      check(r.frame, 'el nivel 10 debería dar el marco de bronce');
    }),
  }, {
    name: 'Progreso: senda, «Casi lo tienes», logros por categorías con premios y cambiar una misión al día',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.store.state.stats.crits = 60; DK.pass.add(300); DK.router.reset('progress'); });
      await sleep(600);
      const r = await p.evaluate(() => ({ nodes: document.querySelectorAll('.pass-node').length, ready: document.querySelectorAll('.pass-node.ready').length, near: document.querySelectorAll('.near-row').length,
        reroll: document.querySelectorAll('.mission-reroll').length, chips: document.querySelectorAll('.mission .pass-chip').length }));
      check(r.nodes >= 30 && r.ready >= 1, 'faltan niveles de la senda: ' + JSON.stringify(r));
      check(r.near >= 1, 'debería verse «Casi lo tienes»');
      check(r.reroll >= 1 && r.chips >= 6, 'cada misión debería poder cambiarse y enseñar sus puntos: ' + JSON.stringify(r));
      const before = await p.evaluate(() => DK.missions.list('daily').map((m) => m.id).join());
      await p.click('.mission-reroll >> nth=0'); await sleep(400);
      const after = await p.evaluate(() => ({ ids: DK.missions.list('daily').map((m) => m.id).join() + '|' + DK.missions.list('weekly').map((m) => m.id).join(), left: document.querySelectorAll('.mission-reroll').length, can: DK.missions.canReroll() }));
      check(after.ids !== before + '|' && !after.can && after.left === 0, 'cambiar misión no funciona o se puede repetir: ' + JSON.stringify(after));
      await p.click('.pass-node.ready >> nth=0'); await sleep(300);
      check(await p.evaluate(() => DK.pass.claimed(1)), 'pulsar un nivel listo debería cobrarlo');
      await p.evaluate(() => DK.router.reset('progress', { tab: 'ach' })); await sleep(500);
      const a = await p.evaluate(() => ({ cats: document.querySelectorAll('.ach-cat').length, rewards: document.querySelectorAll('.ach .pass-chip').length, titles: document.querySelectorAll('.ach .title-chip').length,
        hint: [...document.querySelectorAll('.ach.secret p')].some((x) => x.textContent.includes(DK.t('achievements.hintLabel'))), capture: DK.data.achievements.some((x) => x.id === 'firstCapture') }));
      check(a.cats === 6 && a.rewards > 10 && a.titles > 5, 'logros sin categorías o sin premios visibles: ' + JSON.stringify(a));
      check(a.hint, 'los logros ocultos deberían dar una pista');
      check(!a.capture, 'sin vínculo no deberían salir logros de vincular');
      await p.click('.ach-cat >> nth=1'); await sleep(300);
      check(await p.evaluate(() => [...document.querySelectorAll('.ach')].length < DK.data.achievements.length), 'filtrar por categoría no funciona');
    }),
  }],
};
