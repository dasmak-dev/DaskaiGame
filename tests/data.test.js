/* Datos de data/*.json cargados en el juego y daskai únicos. */
const { play, check } = require('./helpers');

module.exports = {
  name: 'Datos',
  cases: [{
    name: 'Las especies, ataques, objetos y zonas se cargan completos y enlazados',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.data, out = [];
        ['species', 'moves', 'items', 'zones'].forEach((k) => { if (Object.keys(D[k]).length !== Object.keys(DK.raw[k]).length) out.push(`${k}: faltan entradas`); });
        Object.values(D.species).forEach((s) => {
          if (!D.houses[s.house]) out.push(`${s.id}: sin casa`);
          if (!s.passives.length) out.push(`${s.id}: sin pasivas`);
          s.learn.forEach(([, m]) => { if (!D.moves[m]) out.push(`${s.id}: ataque ${m}`); });
          if (s.evolve && D.species[s.evolve.into].evolvedFrom !== s.id) out.push(`${s.id}: evolución rota`);
        });
        Object.values(D.zones).forEach((z) => z.enemies.forEach((e) => { if (!D.species[e.species]) out.push(`${z.id}: ${e.species}`); }));
        if (!Object.keys(D.secretBosses).length || !Object.keys(D.bossPhases).length) out.push('faltan jefes ocultos o fases');
        if (Object.keys(D.tonicFor).length !== 7) out.push('tónicos incompletos');
        return out;
      });
      check(!r.length, r.join(', '));
    }),
  }, {
    name: 'Cada daskai nace distinto: genes, pasiva y naturaleza al azar',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const g = DK.config.genes, list = Array.from({ length: 40 }, () => DK.daskai.create('lumino', 1));
        const hp = new Set(list.map((d) => DK.daskai.baseOf(d, 'hp')));
        const inRange = list.every((d) => Object.values(d.genes).every((x) => x >= -g - 1e-9 && x <= g + 1e-9));
        const passives = new Set(list.map((d) => d.passive)), natures = new Set(list.map((d) => d.nature));
        const allowed = list.every((d) => DK.data.species.lumino.passives.includes(d.passive));
        return { hp: hp.size, inRange, passives: passives.size, natures: natures.size, allowed };
      });
      check(r.inRange, 'genes fuera de ±config.genes');
      check(r.hp > 3, 'la vida base no varía entre daskai de la misma especie');
      check(r.passives > 1 && r.natures > 3, 'pasivas o naturalezas no salen al azar');
      check(r.allowed, 'sale una pasiva que la especie no permite');
    }),
  }],
};
