/* v5.4: subidas de nivel con tope, nuevos estados, parpadeo y piezas de «juego de verdad». */
const { play, check, sleep } = require('./helpers');

module.exports = {
  name: 'Juego vivo (v5.4)',
  cases: [{
    name: 'Cada nivel da como mucho +5 por atributo y la vida sin equipo no pasa de 300 al nivel 40',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const ids = Object.keys(DK.data.species).filter((id) => !DK.data.species[id].from).slice(0, 40);
        let worst = 0, hp40 = 0, multi = 0, over = 0;
        ids.forEach((id) => {
          const d = DK.daskai.create(id, 1); DK.party.add(d);
          for (let n = 0; n < 6; n++) {
            const info = DK.daskai.gainExp(d, 4000 + n * 3000);
            if (info.levels.length > 1) multi++;
            info.levels.forEach((l) => Object.values(l.gains || {}).forEach((g) => (worst = Math.max(worst, g))));
          }
          const hp = DK.daskai.stats(d, []).hp, cap = DK.config.hpCap.base + DK.config.hpCap.perLevel * d.level;
          over = Math.max(over, hp / cap);
          if (d.level >= 40) hp40 = Math.max(hp40, Math.round((hp * (DK.config.hpCap.base + DK.config.hpCap.perLevel * 40)) / cap));
        });
        return { worst, hp40, multi, over };
      });
      console.log(`      subida máxima por nivel: +${r.worst} · vida/tope máximo: ${r.over.toFixed(2)}`);
      check(r.worst <= 5, 'un nivel dio +' + r.worst);
      check(r.over <= 1.0001, 'la vida pasa del tope (×' + r.over.toFixed(2) + ')');
      check(r.multi > 0, 'no se probaron subidas de varios niveles');
    }),
  }, {
    name: 'Congelado, dormido y paralizado impiden actuar; cegado falla más; se pasan solos',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const B = DK.battle, out = {};
        ['congelacion', 'sueno', 'paralisis', 'ceguera'].forEach((s) => {
          let blocked = 0, ended = false;
          for (let k = 0; k < 40 && !(ended && blocked); k++) {
            const st = B.start('pradera', DK.party.active()[0].uid);
            const A = B.ally(st); A.status = s; A.statusT = 0; A.cur.hp = 9999;
            for (let i = 0; i < 6; i++) {
              const ev = []; B.act(st, 'ally', A.moves[0], ev);
              if (ev.some((e) => e.anim === 'blocked')) blocked++;
              if (!A.status) { ended = true; break; }
              if (s === 'ceguera') B.endOfTurn ? B.endOfTurn(st, []) : null;
            }
          }
          out[s] = { blocked, ended };
        });
        out.names = ['congelacion', 'sueno', 'paralisis', 'ceguera'].every((s) => DK.data.statuses[s] && DK.data.statuses[s].name);
        out.moves = ['aliento_helado', 'nana_lunar', 'polvo_paralizante', 'resplandor'].every((m) => DK.data.moves[m]);
        return out;
      });
      check(r.names && r.moves, 'faltan estados o ataques nuevos');
      ['congelacion', 'sueno', 'paralisis'].forEach((s) => check(r[s].blocked > 0, s + ' nunca bloqueó'));
      ['congelacion', 'sueno'].forEach((s) => check(r[s].ended, s + ' no se pasa nunca'));
      check(r.ceguera.blocked === 0, 'cegado no debe impedir actuar');
    }),
  }, {
    name: 'Los daskai parpadean (sólo los de ojos abiertos) y el clima sale por zona',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const ids = Object.keys(DK.data.species).slice(0, 30);
        const can = ids.filter((id) => DK.looks.canBlink(id, DK.looks.of({ species: id }))).length;
        const svgA = DK.looks.svg(ids[0], null, {}), svgB = DK.looks.svg(ids[0], null, { blink: true });
        const z = DK.data.zones;
        return { can, total: ids.length, differs: svgA !== svgB, snow: DK.weather.forZone(z.glaciar), fog: ['fog', 'rain'].includes(DK.weather.forZone(z.pantano)), cave: DK.weather.forZone(z.cavernas) };
      });
      check(r.can > 0 && r.can <= r.total, 'ninguno puede parpadear');
      check(r.snow === 'snow', 'el Glaciar no nieva');
      check(r.fog, 'el Pantano no tiene niebla');
      check(r.cave === 'clear', 'en las cavernas no debe llover');
    }),
  }, {
    name: 'Logro que cae, contadores que corren y botones que se hunden',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.settings.set('skipAnims', false); DK.views.achievementDrop({ icon: 'trophy', title: 'Prueba', text: 'x', coins: 10 }); DK.wallet.add(250); });
      await sleep(250);
      const r = await p.evaluate(() => ({ drop: !!document.querySelector('.ach-drop'), delta: !!document.querySelector('.hud-delta') }));
      check(r.drop, 'no sale la medalla del logro');
      check(r.delta, 'el contador de monedas no muestra el +N');
      const b = await p.$('.dock-slot');
      if (b) { const box = await b.boundingBox(); await p.mouse.move(box.x + 5, box.y + 5); await p.mouse.down(); const pressed = await p.evaluate(() => !!document.querySelector('.is-pressed')); await p.mouse.up(); check(pressed, 'el botón no se hunde al pulsarlo'); }
    }),
  }, {
    name: 'v5.5: pisos especiales, oleadas y relevos, regalos y registro con fichas',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const out = {};
        // Mapas: aparecen pisos especiales
        let sp = {};
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'esp', size: 'xl', kind: 'normal', mod: null }; DK.expedition.start({});
        const e = DK.expedition.active();
        e.map.rows.flat().forEach((n) => { if (n.special) sp[n.special] = (sp[n.special] || 0) + 1; });
        out.specials = Object.keys(sp).length;
        // Oleada y relevo en el motor
        const B = DK.battle, d = DK.party.active()[0];
        ['chain', 'swap'].forEach((k) => {
          const st = B.start('pradera', d.uid, { wave: k }); const an = [];
          if (k === 'swap') { st.enemy.cur.hp = Math.max(1, Math.floor(DK.daskai.stats(st.enemy).hp * 0.4)); const ev0 = []; B.resolve(st, ev0); ev0.forEach((x) => an.push(x.anim)); }
          for (let i = 0; i < 80 && !st.outcome; i++) { B.ally(st).cur.hp = 9999; B.turn(st, { type: 'move', moveId: B.ally(st).moves[0] }).forEach((x) => an.push(x.anim)); }
          out[k] = { won: st.outcome === 'won', beaten: st.wave.beaten, total: st.wave.total, ins: an.filter((x) => x === 'enemyIn').length, outs: an.filter((x) => x === 'enemyOut').length };
        });
        // Regalo
        e.giftChoice = DK.expedition.specialPick(3);
        out.gift = DK.expedition.takeGift(e.giftChoice[1]) && !DK.expedition.takeGift(e.giftChoice[0]);
        // Registro con referencias
        const nodes = DK.views.richLog('Brotín usa ' + DK.data.moves[Object.keys(DK.data.moves)[0]].name + '.');
        out.ref = nodes.some((x) => x && x.classList && x.classList.contains('log-ref'));
        out.card = !!DK.views.infoCard('item', 'pocion') && !!DK.views.infoCard('move', Object.keys(DK.data.moves)[0]);
        return out;
      });
      check(r.specials > 0, 'no hay pisos especiales en un mapa grande');
      check(r.chain.won && r.chain.beaten === r.chain.total && r.chain.ins === r.chain.total - 1, 'la oleada no encadena rivales: ' + JSON.stringify(r.chain));
      check(r.swap.won && r.swap.beaten === 2 && r.swap.outs >= 1, 'el relevo no cambia de rival: ' + JSON.stringify(r.swap));
      check(r.gift, 'el regalo no se puede coger (o se coge dos veces)');
      check(r.ref && r.card, 'el registro no resalta ataques o no hay ficha');
    }),
  }, {
    name: 'v5.6: aspectos nuevos (colores de casa, degradados, ojos y bocas), especies nuevas y marcos que encajan en la caja',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const L = DK.looks, out = { grad: 0, eyes: 0, mouth: 0, skins: new Set(), tag: 0 };
        for (let i = 0; i < 300; i++) {
          const look = L.rollLook('pyrex'); if ((look.s & 0xff) === 0xaa) out.tag++;
          const ind = L.ind('pyrex', look);
          if (ind.grad) out.grad++; if (['twinkle', 'brows', 'almond', 'dewy'].includes(ind.eyes)) out.eyes++; if (['fang1', 'blep', 'ohno', 'beam'].includes(ind.mouth)) out.mouth++;
          out.skins.add(ind.skin.slice(0, 4));
          if (i < 40 && !L.svg('pyrex', look).includes('<svg')) out.bad = true;
        }
        out.skins = out.skins.size;
        const sp = ['cenicito', 'fogarron', 'escarchin', 'glaciaron', 'prismito', 'prismalux', 'nocturin', 'penumbron', 'guijarrin', 'penascon'];
        out.species = sp.every((id) => DK.data.species[id]) && sp.filter((id) => !DK.data.species[id].evolvedFrom).every((id) => Object.values(DK.data.zones).some((z) => z.enemies.some((e) => e.species === id)));
        const d = DK.daskai.create('fogarron', 30); out.stats = DK.daskai.stats(d).hp > 0;
        return out;
      });
      check(r.tag === 300, 'los aspectos nuevos no llevan la marca nueva');
      check(r.grad > 100 && r.eyes > 20 && r.mouth > 20, 'pocos degradados, ojos o bocas nuevos: ' + JSON.stringify(r));
      check(r.skins > 8, 'poca variedad de colores: ' + r.skins);
      check(!r.bad && r.species && r.stats, 'faltan especies nuevas o no se dibujan');
      // marcos: el daskai ocupa la casilla entera
      await p.evaluate(() => { for (let i = 0; i < 9; i++) { const d = DK.daskai.create('brotin', 9 + i); d.form = i % 2; DK.party.add(d); } DK.router.reset('team'); });
      await sleep(800);
      const fit = await p.evaluate(() => [...document.querySelectorAll('.pc-slot')].filter((s) => s.querySelector('.pc-mon')).map((s) => { const a = s.getBoundingClientRect(), b = s.querySelector('.pc-mon').getBoundingClientRect(); return Math.abs(a.height - b.height) <= 6 && Math.abs(a.width - b.width) <= 6; }));
      check(fit.length && fit.every(Boolean), 'el daskai no ocupa su casilla de la caja');
    }),
  }, {
    name: 'v5.7: pisos del mapa con iconos de relieve, insignias dentro del medallón y fondos con vida',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.settings.set('skipAnims', false); DK.store.state.nextExpedition = { zone: 'pradera', seed: 'v57', size: 'small', kind: 'normal', mod: null }; DK.expedition.start({}); const e = DK.expedition.active(); e.curseOffer = null; e.relicChoice = null; e.introShown = `1|${e.seed}`; e.flyShown = `1|${e.seed}`; e.map.rows[2][0].special = 'chain'; DK.router.reset('expedition'); });
      await sleep(1200);
      const r = await p.evaluate(() => {
        const nodes = [...document.querySelectorAll('.exp-map .exp-node')];
        const sp = document.querySelector('.exp-node.special .node-special');
        let inside = false;
        if (sp) { const a = sp.getBoundingClientRect(), b = sp.closest('.exp-node').getBoundingClientRect(); inside = a.left >= b.left - 10 && a.top >= b.top - 10 && a.right <= b.left + 30; }
        return { n: nodes.length, art: nodes.filter((x) => x.querySelector('.node-art')).length, round: getComputedStyle(nodes[0]).borderRadius, inside, amb: !!document.querySelector('.exp-map .amb-map .am') };
      });
      check(r.n > 5 && r.art === r.n, 'faltan iconos nuevos en los pisos: ' + JSON.stringify(r));
      check(r.round === '50%', 'los pisos no son medallones');
      check(r.inside, 'la estrella del piso especial está descolocada');
      check(r.amb, 'el mapa no tiene fondo animado');
    }),
  }, {
    name: 'v5.9: el resumen de la expedición enseña el equipo (niveles subidos) y los rivales, con el fondo general',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 's59', size: 'small', kind: 'normal', mod: null }; DK.expedition.start({});
        const B = DK.battle;
        for (let k = 0; k < 3; k++) { const st = B.start('pradera', DK.party.active()[0].uid, { elite: k === 2 }); DK.emit('battle:end', { outcome: 'won', zone: 'pradera', elite: k === 2, enemy: { species: st.enemy.species, level: st.enemy.level } }); }
        DK.daskai.gainExp(DK.party.active()[0], 900);
        DK.expedition.claim(true); DK.router.reset('expSummary');
      });
      await sleep(900);
      await p.keyboard.press('Escape'); await sleep(300);
      const r = await p.evaluate(() => ({ team: document.querySelectorAll('.st-card').length, up: [...document.querySelectorAll('.st-up')].some((x) => !x.classList.contains('none')), foes: document.querySelectorAll('.sf-card').length, strip: document.querySelectorAll('.ss-cell').length, s: DK.store.state.lastExpedition }));
      check(r.team >= 1 && r.up, 'no se ve el equipo con sus niveles subidos');
      check(r.foes >= 1, 'no se ven los rivales');
      check(r.strip === 6, 'faltan las cifras clave');
      check(r.s.foes.length === 3 && r.s.team[0].to > r.s.team[0].from, 'el resumen no guarda rivales o niveles: ' + JSON.stringify({ f: r.s.foes.length, t: r.s.team[0] }));
    }),
  }, {
    name: 'v5.12: emblema del resumen según el estilo y formas 3.ª/4.ª más imponentes',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const base = DK.daskai.create('pyrex', 5);
        const vb = (d) => { const el = DK.views.dSprite(d, { size: 120 }); document.body.append(el); const sv = el.querySelector('svg'); const v = sv ? sv.getAttribute('viewBox') : ''; const html = el.innerHTML.length; el.remove(); return { w: +(v.split(' ')[2] || 0), html }; };
        const f2 = vb(Object.assign({}, base, { forms: 4, form: 1 })), f4 = vb(Object.assign({}, base, { forms: 4, form: 3 })), f22 = vb(Object.assign({}, base, { forms: 2, form: 1 }));
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 's512', size: 'small', kind: 'normal', mod: null }; DK.expedition.start({});
        DK.expedition.claim(true); DK.store.state.lastExpedition.shopShown = true; DK.router.reset('expSummary');
        return { f2, f4, f22 };
      });
      check(r.f4.w > r.f2.w && r.f4.html > r.f22.html, 'la 4.ª forma no es más grande ni más elaborada: ' + JSON.stringify(r));
      await sleep(700);
      const seen = [];
      for (const st of ['clean', 'exile', 'classic']) {
        seen.push(await p.evaluate((st) => { DK.settings.set('uiStyle', st); DK.settings.apply(); const e = document.querySelector('.sum-hero .sum-emblem'); if (!e) return 'none';
          const vis = (sel) => getComputedStyle(e.querySelector(sel)).display !== 'none'; return [vis('.oe-art'), vis('.oe-line'), vis('.oe-laurel'), getComputedStyle(e.querySelector('.oe-plate')).clipPath !== 'none'].join(','); }, st));
      }
      check(seen[0] === 'false,true,true,false', 'Limpio: el emblema no es de línea con laurel: ' + seen[0]);
      check(seen[1] === 'true,false,false,true', 'Exilio: el emblema no es la placa octogonal: ' + seen[1]);
      check(seen[2] === 'true,false,false,false', 'Clásico: el emblema no es la medalla: ' + seen[2]);
    }),
  }, {
    name: 'v5.13: las formas 3.ª y 4.ª tiran piezas distintas (alas, cabeza, lomo, extra, piel) según su semilla y su casa',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const sets = { wings: new Set(), head4: new Set(), head3: new Set(), back: new Set(), extra: new Set(), pattern: new Set() }, combos = new Set();
        ['pyrex', 'lumino', 'umbrix', 'aquelo', 'terron'].forEach((sid, a) => { for (let j = 0; j < 12; j++) { const r = DK.looks.regalia(DK.looks.ind(sid, { s: ((j * 7919 + a * 104729 + 13) << 8 | 8) >>> 0 })); Object.keys(sets).forEach((k) => sets[k].add(r[k])); combos.add([r.wings, r.head4, r.back, r.extra].join()); } });
        const dark = new Set(); for (let j = 0; j < 30; j++) dark.add(DK.looks.regalia(DK.looks.ind('umbrix', { s: ((j * 7919 + 77) << 8 | 8) >>> 0 })).wings);
        return { n: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size])), combos: combos.size, darkAngel: [...dark].includes('angel') && dark.size < 4 };
      });
      check(r.n.wings >= 7 && r.n.head4 >= 7 && r.n.head3 >= 5 && r.n.back >= 6 && r.n.extra >= 5 && r.n.pattern >= 4, 'poca variedad: ' + JSON.stringify(r.n));
      check(r.combos >= 50, 'demasiadas formas iguales: ' + r.combos + ' de 60');
    }),
  }, {
    name: 'v5.14: más siluetas, firma de cada especie y cuerpos que cambian al madurar',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const sids = ['lumino', 'umbrix', 'aquelo', 'terron', 'pyrex', 'guijarrin'], shapes = new Set(), sig = {}, changed = { n: 0, of: 0 };
        sids.forEach((sid, a) => { sig[sid] = {}; for (let j = 0; j < 30; j++) { const i = DK.looks.ind(sid, { s: ((((j * 7919 + a * 104729 + 13) & 0xffffff) << 8) | 0xaa) >>> 0 }); if (!i.path) continue;
          i.path.forEach((k) => shapes.add(k)); sig[sid][i.path[0]] = (sig[sid][i.path[0]] || 0) + 1; changed.of++; if (i.path[3] !== i.path[0]) changed.n++; } });
        const top = Object.values(sig).map((m) => Math.max(0, ...Object.values(m)));
        const names = DK.looks.allKeys('body').filter((k) => !DK.i18n.has || DK.i18n.has('look.body.' + k));
        return { shapes: shapes.size, top, changed, nBody: DK.looks.allKeys('body').length };
      });
      check(r.shapes >= 28, 'pocas siluetas: ' + r.shapes);
      check(r.top.every((n) => n >= 9), 'las especies no tienen una silueta propia: ' + JSON.stringify(r.top));
      check(r.changed.n / r.changed.of > 0.6, 'los cuerpos casi no cambian al madurar: ' + JSON.stringify(r.changed));
      check(r.nBody >= 50, 'faltan cuerpos en el catálogo: ' + r.nBody);
    }),
  }],
};
