/* Tipos de expedición, zona de inicio elegida en el mapa y especies (papeles y evoluciones). */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Tipos de expedición y especies',
  cases: [{
    name: 'Cada tipo cambia el mapa (captura: corta y llena de reclutas; combate: más peleas)',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const count = (kind) => { const tot = {}; for (let i = 0; i < 6; i++) { DK.store.state.nextExpedition = null; DK.expedition.setStart({ kind }); const pv = DK.expedition.preview(); pv.map.rows.flat().forEach((n) => (tot[n.type] = (tot[n.type] || 0) + 1)); tot.floors = (tot.floors || 0) + pv.map.rows.length; tot.size = pv.size; } return tot; };
        const n = count('normal'), c = count('captura'), f = count('combate');
        DK.expedition.setStart({ kind: 'captura' }); DK.expedition.start({}); const e = DK.expedition.active();
        DK.store.state.expedition = null;
        const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(DK.expedition.pickKind());
        return { n, c, f, kind: e.kind, locked: DK.expedition.kinds().find((k) => k.id === 'desafio').locked, seen: seen.size };
      });
      check(r.c.size === 'short' && r.c.floors < r.n.floors, 'la expedición de captura debería ser corta');
      check(r.c.recruit / r.c.floors > (r.n.recruit || 0) / r.n.floors * 2, 'la de captura debería tener muchos más reclutas: ' + JSON.stringify(r.c));
      check((r.f.fight + r.f.elite) / r.f.floors > (r.n.fight + r.n.elite) / r.n.floors, 'la de combate debería tener más peleas');
      check(r.kind === 'captura', 'la expedición no guarda su tipo');
      check(r.locked, 'el desafío debería estar bloqueado sin haber vencido a ningún jefe');
      check(r.seen >= 3, 'el tipo debería salir al azar');
    }),
  }, {
    name: 'Runas de expedición: caen, fijan tamaño y tipo, se quitan sin re-sortear y se gastan al partir',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const E = DK.expedition, R = DK.runes;
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'r1', size: 'small', kind: 'normal', mod: null };
        R.add('xl', 1); R.add('captura', 2); R.add('desafio', 1);
        const lockedDesafio = !R.usable('desafio') && !R.toggle('desafio');
        R.toggle('captura');
        const k1 = E.nextStart().kind, s1 = E.nextStart().size; // captura → mapa corto
        R.toggle('xl');
        const s2 = E.nextStart().size;
        R.toggle('captura'); // quitarla: vuelve a lo que salió al azar
        const k3 = E.nextStart().kind, s3 = E.nextStart().size;
        R.toggle('xl');
        const back = E.nextStart().size;
        R.toggle('captura'); R.toggle('xl');
        // cambiar de zona no quita las runas
        DK.world.progress(Object.keys(DK.data.zones)[1]).unlocked = true; E.setStart({ zone: Object.keys(DK.data.zones)[1] });
        const keep = R.selected();
        E.start({});
        const e = E.active();
        const after = { xl: R.count('xl'), captura: R.count('captura') };
        // caen en cofres y jefes
        const before = R.total();
        DK.config.expedition.runes.drop.treasure = 1; const tr = E.openTreasure();
        const dropped = R.total() - before;
        return { lockedDesafio, k1, s1, s2, k3, s3, back, keep, kind: e.kind, size: e.size, used: e.runesUsed, after, tr: tr.runes, dropped, next: DK.store.state.nextExpedition };
      });
      check(r.lockedDesafio, 'la runa de desafío no debería poder usarse sin haber vencido a un jefe');
      check(r.k1 === 'captura' && r.s1 === 'short', 'la runa de captura debería fijar el tipo (y su mapa corto): ' + r.k1 + ' ' + r.s1);
      check(r.s2 === 'xl', 'la runa XL debería fijar el tamaño aunque el tipo sea de captura: ' + r.s2);
      check(r.k3 === 'normal' && r.s3 === 'xl', 'al quitar la runa de tipo vuelve el tipo que salió al azar: ' + r.k3 + ' ' + r.s3);
      check(r.back === 'small', 'al quitar la runa de tamaño vuelve el tamaño que salió al azar: ' + r.back);
      check(r.keep.kind === 'captura' && r.keep.size === 'xl', 'cambiar de zona no debería quitar las runas');
      check(r.kind === 'captura' && r.size === 'xl', 'la expedición no sale con lo fijado por las runas');
      check(r.used.length === 2 && r.after.xl === 0 && r.after.captura === 1, 'las runas no se gastan al partir: ' + JSON.stringify(r.after));
      check(r.tr.length === 1 && r.dropped === 1, 'el cofre debería dar una runa');
      check(!r.next, 'la próxima expedición debería volver a sortearse');
    }),
  }, {
    name: 'Runas en la preparación: 4 huecos en una fila, se engastan desde el selector y se quitan con un toque',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.store.state.nextExpedition = { zone: 'pradera', seed: 'r2', size: 'small', kind: 'normal', mod: null }; DK.runes.add('medium', 1); DK.runes.add('oro', 3); DK.runes.add('saber', 1); DK.store.state.camp.rumbo_captura = 2; DK.store.state.emblems = 0; DK.store.migrate(); DK.router.reset('zones'); });
      await sleep(400);
      const row = await p.evaluate(() => { const s = [...document.querySelectorAll('.rune-socket')].map((b) => b.getBoundingClientRect()); return { n: s.length, oneLine: s.every((r) => Math.abs(r.top - s[0].top) < 2), inside: s.every((r) => r.right <= innerWidth) }; });
      check(row.n === 4 && row.oneLine && row.inside, 'deberían verse 4 huecos de runa en una sola línea: ' + JSON.stringify(row));
      await p.click('.rune-socket.empty >> nth=0'); await sleep(300);
      const picks = await p.locator('.rune-pick').count();
      await p.click('.rune-pick:has-text("' + (await p.evaluate(() => DK.t('rune.medium.name'))) + '")'); await sleep(300);
      const r1 = await p.evaluate(() => ({ full: document.querySelectorAll('.rune-socket.full').length, size: DK.expedition.nextStart().size, emblems: DK.store.state.emblems, rumbo: DK.store.state.camp.rumbo_captura, modal: !!document.querySelector('.rune-modal') }));
      check(picks === 8, 'el selector debería enseñar las 8 runas: ' + picks);
      check(r1.full === 1 && r1.size === 'medium' && !r1.modal, 'la runa no se engasta: ' + JSON.stringify(r1));
      check(r1.emblems === 5 && r1.rumbo === undefined, 'el Rumbo antiguo debería devolver sus emblemas: ' + r1.emblems);
      // Bonificaciones repetibles hasta llenar los 4 huecos
      const r2 = await p.evaluate(() => { const a = DK.runes.socket('oro'), b = DK.runes.socket('oro'), c = DK.runes.socket('saber'), d = DK.runes.socket('oro'); return { a, b, c, d, slots: DK.runes.slots() }; });
      check(r2.a && r2.b && r2.c && !r2.d && r2.slots.length === 4, 'las runas de bonificación deberían repetirse hasta llenar los huecos: ' + JSON.stringify(r2));
      await p.evaluate(() => DK.router.refresh()); await sleep(300);
      await p.click('.rune-socket.full >> nth=0'); await sleep(300);
      const r3 = await p.evaluate(() => ({ full: document.querySelectorAll('.rune-socket.full').length, size: DK.expedition.nextStart().size }));
      check(r3.full === 3 && r3.size === 'small', 'quitar la runa debería vaciar el hueco y volver al tamaño al azar: ' + JSON.stringify(r3));
      const r4 = await p.evaluate(() => { DK.expedition.start({}); return { coins: DK.runes.bonus('coins'), exp: DK.runes.bonus('exp'), oro: DK.runes.count('oro') }; });
      check(Math.abs(r4.coins - 0.5) < 1e-9 && Math.abs(r4.exp - 0.25) < 1e-9 && r4.oro === 1, 'las bonificaciones no se aplican o no se gastan: ' + JSON.stringify(r4));
    }),
  }, {
    name: 'Campamento: ciclo de día y noche oscuro (cielo, sol o luna y estrellas según la hora)',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => ['day', 'dawn', 'dusk', 'night'].map((tod) => {
        const s = DK.views.campBackdrop(tod);
        return { tod, sky: [...s.querySelectorAll('#campSky stop')].map((x) => x.getAttribute('stop-color')).join(), moon: !!s.querySelector('.camp-body.moon'), sun: !!s.querySelector('.camp-body.sun'), stars: s.querySelectorAll('rect[fill="#fecaca"]').length };
      }));
      const by = Object.fromEntries(r.map((x) => [x.tod, x]));
      check(new Set(r.map((x) => x.sky)).size === 4, 'cada momento del día debería tener su cielo');
      check(by.night.moon && !by.day.moon && by.day.sun, 'de noche luna y de día sol');
      check(by.day.stars === 0 && by.night.stars > by.dusk.stars, 'las estrellas sólo de noche (y menos al atardecer)');
      const hours = await p.evaluate(() => [3, 6, 12, 19].map((hr) => { const d = new Date(); d.setHours(hr); return DK.views.campTimeOfDay(d); }));
      check(hours.join() === 'night,dawn,day,dusk', 'la hora no da el momento del día: ' + hours);
    }),
  }, {
    name: 'Los caminos del mapa no se cruzan y avanzan a carriles cercanos',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        let cross = 0, jump = 0;
        ['a', 'b', 'c', 'd', 'e'].forEach((seed) => {
          DK.store.state.nextExpedition = { zone: 'pradera', seed, size: 'xl', kind: 'normal', mod: null };
          const rows = DK.expedition.preview().map.rows;
          rows.forEach((row, i) => { const nx = rows[i + 1]; if (!nx || nx.length === 1) return;
            const E = []; row.forEach((n) => n.links.forEach((id) => { const m = nx.find((q) => q.id === id); if (m) { E.push([n.x, m.x]); jump = Math.max(jump, Math.abs(n.x - m.x)); } }));
            for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) if ((E[a][0] - E[b][0]) * (E[a][1] - E[b][1]) < -1e-9) cross++; });
        });
        return { cross, jump };
      });
      check(r.cross === 0, 'hay ' + r.cross + ' cruces de caminos');
      check(r.jump < 0.2, 'algún camino salta demasiado de lado: ' + r.jump);
    }),
  }, {
    name: 'La zona pulsada en el mapa del mundo es donde empieza la expedición',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { const ids = Object.keys(DK.data.zones); ids.slice(0, 3).forEach((id) => (DK.world.progress(id).unlocked = true)); DK.router.reset('zones'); });
      await sleep(400);
      await p.click('button.wm2-node >> nth=2'); await sleep(300);
      await p.click('.bt-go'); await sleep(600);
      const r = await p.evaluate(() => ({ want: Object.keys(DK.data.zones)[2], got: DK.expedition.active() && DK.expedition.active().zone }));
      check(r.got === r.want, `la expedición empieza en ${r.got} y no en ${r.want}`);
    }),
  }, {
    name: 'Los iniciales tienen tres evoluciones y el papel en combate es raro (≈20%)',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const S = DK.data.species;
        const lines = Object.values(S).filter((s) => s.starter).map((s) => { let n = 0, x = s; while (x.evolve) { x = S[x.evolve.into]; n++; } return n; });
        let roles = 0; const N = 2000;
        for (let i = 0; i < N; i++) if (DK.daskai.rollRole() !== 'equilibrado') roles++;
        const d = DK.daskai.create('lumino', 5); d.role = 'tanque'; DK.daskai.touch();
        const t = DK.daskai.stats(d).def; d.role = 'equilibrado'; DK.daskai.touch();
        return { lines, pct: roles / N, better: t > DK.daskai.stats(d).def };
      });
      check(r.lines.length === 5 && r.lines.every((n) => n === 3), 'cada inicial debería evolucionar 3 veces: ' + r.lines);
      check(r.pct > 0.15 && r.pct < 0.25, 'el papel debería salir ~20% de las veces: ' + r.pct);
      check(r.better, 'tener papel debería mejorar sus atributos');
    }),
  }],
};
