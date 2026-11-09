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
  }, {
    name: 'v5.0: zonas intermedias (Pantano y Glaciar) encadenadas, con escena, música y hallazgos; las partidas avanzadas las tienen abiertas',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.data, out = {};
        out.order = Object.keys(D.zones).filter((z) => !D.zones[z].secretZone).join(',');
        out.chain = D.zones.pantano.unlock === 'templo' && D.zones.abismo.unlock === 'pantano' && D.zones.glaciar.unlock === 'abismo' && D.zones.cumbre.unlock === 'glaciar';
        out.levels = ['templo', 'pantano', 'abismo', 'glaciar', 'cumbre'].every((z, i, a) => !i || D.zones[a[i - 1]].levels[1] === D.zones[z].levels[0]);
        out.scenes = !!DK.scenes.list.swamp && !!DK.scenes.list.glacier && DK.scenes.bossScene(D.zones.glaciar) === 'boss_glacier';
        out.finds = !!DK.explore.finds('pantano') && D.items[DK.explore.finds('glaciar').rare].use.exp > 0;
        // migración: una partida con el Abismo abierto recibe el Pantano y, con la Cumbre, el Glaciar
        const s = DK.store.state, keep = s.zones;
        s.zones = { pradera: { unlocked: true, wins: 0 }, abismo: { unlocked: true, wins: 0 }, cumbre: { unlocked: true, wins: 0 } };
        DK.store.migrate();
        out.migrated = !!(s.zones.pantano && s.zones.pantano.unlocked && s.zones.glaciar && s.zones.glaciar.unlocked);
        s.zones = keep;
        // rivales más fuertes con el nivel (C.enemyScale)
        const a = DK.daskai.create('chispon', 10, { wild: true }), b = DK.daskai.create('chispon', 80, { wild: true });
        out.scale = DK.daskai.mult(b, 'atk') > DK.daskai.mult(a, 'atk');
        return out;
      });
      check(r.order.includes('templo,pantano,abismo,glaciar,cumbre') && r.chain && r.levels, 'las zonas nuevas no están bien encadenadas: ' + JSON.stringify(r));
      check(r.scenes && r.finds, 'faltan escenas o hallazgos de las zonas nuevas: ' + JSON.stringify(r));
      check(r.migrated, 'las partidas avanzadas deberían tener abiertas las zonas nuevas');
      check(r.scale, 'los rivales deberían escalar con su nivel');
    }),
  }],
};
