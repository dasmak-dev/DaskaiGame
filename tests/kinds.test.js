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
        // Al azar, y las Mejoras «Rumbo» suben la probabilidad de un tipo
        const before = DK.expedition.kindChances().captura;
        DK.store.state.camp = Object.assign({}, DK.store.state.camp, { rumbo_captura: 2 });
        const after = DK.expedition.kindChances().captura;
        const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(DK.expedition.pickKind());
        return { n, c, f, kind: e.kind, locked: DK.expedition.kinds().find((k) => k.id === 'desafio').locked, before, after, seen: seen.size };
      });
      check(r.c.size === 'short' && r.c.floors < r.n.floors, 'la expedición de captura debería ser corta');
      check(r.c.recruit / r.c.floors > (r.n.recruit || 0) / r.n.floors * 2, 'la de captura debería tener muchos más reclutas: ' + JSON.stringify(r.c));
      check((r.f.fight + r.f.elite) / r.f.floors > (r.n.fight + r.n.elite) / r.n.floors, 'la de combate debería tener más peleas');
      check(r.kind === 'captura', 'la expedición no guarda su tipo');
      check(r.locked, 'el desafío debería estar bloqueado sin haber vencido a ningún jefe');
      check(r.seen >= 3, 'el tipo debería salir al azar');
      check(r.after > r.before * 1.5, 'el Rumbo de captura debería subir su probabilidad: ' + r.before + ' → ' + r.after);
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
