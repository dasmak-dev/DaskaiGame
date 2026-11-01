/* Caché de atributos: siempre igual que el cálculo completo, y más rápida. */
const { play, check } = require('./helpers');

module.exports = {
  name: 'Atributos',
  cases: [{
    name: 'La caché se actualiza con nivel, equipo, tónicos, entrenamiento, talentos y reliquias',
    run: (browser, view) => play(browser, view, async (p) => {
      const bad = await p.evaluate(() => {
        const out = [], d = DK.party.active()[0];
        const same = (label) => { const a = DK.daskai.stats(d), b = DK.daskai.stats(d, d.equip.slice()); if (JSON.stringify(a) !== JSON.stringify(b)) out.push(label); };
        same('inicio');
        DK.daskai.gainExp(d, 5000); same('subir de nivel');
        const eq = Object.values(DK.data.items).find((i) => i.category === 'equipo' && i.stats);
        d.equip[0] = eq.id; same('equipar');
        DK.daskai.applyTonic(d, 'atk'); same('tónico');
        d.trained = { def: 3 }; DK.daskai.touch(); same('entrenamiento (a mano + touch)');
        DK.daskai.chooseTalent(d, 10, DK.daskai.talentOptions(d, 10)[0]); same('talento');
        const s = DK.daskai.stats(d); s.hp = 1; same('modificar el resultado no estropea la caché');
        DK.store.state.difficulty = Object.keys(DK.data.difficulties).pop(); same('dificultad');
        d.genes = { hp: 0.1 }; DK.store.save(); same('cualquier cambio guardado');
        DK.expedition.start({}); DK.curses.accept([]);
        const rel = Object.values(DK.data.relics).find((r) => r.effect.type === 'stat');
        if (rel) { DK.relics.give(rel.id); same('reliquia de atributo'); }
        return out;
      });
      check(!bad.length, 'La caché da un valor distinto al real tras: ' + bad.join(', '));
    }),
  }, {
    name: 'Calcular atributos con caché es mucho más rápido',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const d = DK.daskai.create('lumino', 30), N = 20000;
        let t = performance.now(); for (let i = 0; i < N; i++) DK.daskai.stats(d); const cached = performance.now() - t;
        t = performance.now(); for (let i = 0; i < N; i++) DK.daskai.stats(d, d.equip); const full = performance.now() - t;
        return { cached, full };
      });
      console.log(`      ${Math.round(r.full)} ms sin caché → ${Math.round(r.cached)} ms con caché (20.000 cálculos)`);
      check(r.cached < r.full, 'la caché no es más rápida');
    }),
  }],
};
