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
        DK.daskai.chooseTalent(d, 25, DK.daskai.talentOptions(d, 25)[0]); same('talento');
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
  }, {
    name: 'Talentos v4.96: cada 25 niveles, 3 opciones distintas, recomendación y efectos de combate',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const D = DK.daskai, out = {};
        out.every = DK.config.talentEvery === 25;
        const d = D.create('raptil', 1); DK.party.add ? DK.party.add(d) : null;
        const o25 = D.talentOptions(d, 25), o50 = D.talentOptions(d, 50);
        out.three = o25.length === 3 && new Set(o25).size === 3 && o25.every((id) => DK.data.talents[id]);
        out.stable = JSON.stringify(o25) === JSON.stringify(D.talentOptions(d, 25));
        D.chooseTalent(d, 25, o25[0]);
        out.noRepeat = !D.talentOptions(d, 50).includes(o25[0]);
        d.moves = ['aranazo', 'mordisco', 'embestida']; const prof = D.talentProfile(d), fv = D.talentFit(d, 'verdugo', prof), fa = D.talentFit(d, 'archimago', prof);
        out.fit = fv.score > fa.score && fv.why === 'phys'; // Raptil pega físico
        const e = D.create('lumino', 30); e.talents = { 25: 'halcon' };
        out.fx = (DK.gear.fxOf(e).crit || 0) >= 0.12;
        // la cola: subir de golpe de 20 a 30 con el daskai en el equipo apunta el talento
        const m = DK.party.all()[0]; m.level = 24; m.exp = 0; m.talents = {};
        document.querySelectorAll('.modal-backdrop').forEach((x) => x.remove());
        D.gainExp(m, D.expToNext ? D.expToNext(m) * 3 : 99999);
        await new Promise((res) => setTimeout(res, 50));
        await Promise.race([DK.views.talentFlush(), new Promise((res) => setTimeout(res, 400))]);
        out.flush = !!document.querySelector('.tl-modal');
        document.querySelectorAll('.modal-backdrop').forEach((x) => x.remove());
        return out;
      });
      check(Object.values(r).every(Boolean), 'talentos: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Siluetas nuevas (dino, escorpión, bestia, concha) y rasgos v4.96 se dibujan',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const L = DK.looks, bad = [];
        ['raptil', 'raptorex', 'tiranox', 'escorpix', 'aguijonyx', 'conchin', 'caracolon', 'lobrillo', 'lobaurum'].forEach((s) => {
          for (let k = 0; k < 6; k++) {
            const look = k ? { s: ((k * 7919) << 8 | 0xa9) >>> 0 } : null, svg = L.svg(s, look);
            if (!svg || /NaN|undefined/.test(svg)) bad.push(s + k);
            if (L.ind(s, look).arch !== DK.data.species[s].sprite.arch) bad.push(s + ' sin silueta');
          }
        });
        for (let k = 0; k < 300; k++) { const svg = L.svg('pyrex', { s: ((k * 104729) << 8 | 0xa9) >>> 0 }); if (/NaN|undefined/.test(svg)) bad.push('pyrex' + k); }
        // v4.96b: criterio en las combinaciones
        const sp = Object.keys(DK.data.species), okRaptor = ['round', 'chubby', 'egg', 'bean', 'blob', 'drop', 'squat', 'pear', 'mound', 'potato', 'gourd', 'puff', 'bulb', 'heart', 'bubble', 'wide', 'lumpy', 'acorn', 'saddle', 'cloud', 'dino'];
        const pointy = { heart: ['stubby', 'paws', 'hover', 'slime'], star5: ['stubby', 'spring', 'peg', 'hover'], kite: ['bird', 'talon', 'stilts', 'hover'] };
        const earsOk = { dino: ['crest', 'horns', 'spikes', 'nubs', 'none', 'trihorn', 'fins', 'mohawk', 'curved'], scorpion: ['antenna', 'feelers', 'none', 'nubs', 'horns'], shell: ['antenna', 'feelers', 'nubs', 'none', 'sprout', 'mushroom'] };
        for (let k = 1; k < 4000; k++) {
          const sid = sp[k % sp.length], i = L.ind(sid, { s: ((k * 2654435761 >>> 8) << 8 | 0xa9) >>> 0 }), tag = sid + '#' + k;
          if (i.arch && ['ghost', 'long'].includes(i.body)) bad.push(tag + ' silueta en fantasma/serpiente');
          if (i.legs === 'raptor' && !okRaptor.includes(i.body)) bad.push(tag + ' raptor en ' + i.body);
          if (pointy[i.body] && !pointy[i.body].includes(i.legs)) bad.push(tag + ' ' + i.body + ' con ' + i.legs);
          if (earsOk[i.arch] && !earsOk[i.arch].includes(i.ears)) bad.push(tag + ' orejas ' + i.ears + ' en ' + i.arch);
        }
        return bad;
      });
      check(!r.length, 'looks rotos: ' + r.slice(0, 8).join(', '));
    }),
  }],
};
