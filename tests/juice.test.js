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
      check(r.worst <= 7, 'un nivel dio +' + r.worst); // v5.18: modelo nuevo (la vida sube hasta ~5-6 a nivel alto)
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
          const look = L.rollLook('pyrex'); if ([0xaa, 0xab].includes(look.s & 0xff)) out.tag++; // v5.15: NEW9 (0xab) incluye todo lo de NEW8
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
  }, {
    name: 'v5.15: alas, orejas, brazos y dibujos nuevos; brazos que se mueven',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const seen = { wings: new Set(), ears: new Set(), arms: new Set(), mark: new Set() }, NEWW = ['dragonfly', 'leaf', 'finwing', 'phoenix', 'cosmic', 'shadow'], NEWE = ['owl', 'gills', 'dish', 'lop', 'flameears', 'shellears'], NEWA = ['scythe', 'vine', 'gauntlet', 'fluff', 'hook'], NEWM = ['dapple', 'saddlemark', 'mask', 'tribal', 'socks'];
        let w3 = 0, n = 0;
        ['lumino', 'umbrix', 'aquelo', 'terron', 'pyrex', 'nocturin'].forEach((sid, a) => { for (let j = 0; j < 60; j++) { const i = DK.looks.ind(sid, { s: ((((j * 7919 + a * 104729 + 13) & 0xffffff) << 8) | 0xab) >>> 0 }); const reg = DK.looks.regalia(i);
          seen.wings.add(reg.wings); seen.ears.add(i.ears); seen.arms.add(i.arms); seen.mark.add(i.mark); n++; if (reg.wings3 !== 'none') w3++; } });
        // las semillas de antes no cambian de orejas/brazos/dibujos nuevos
        const old = DK.looks.ind('lumino', { s: ((12345 << 8) | 0xaa) >>> 0 });
        // brazos en grupos que giran en el hombro
        const d = DK.daskai.create('lumino', 5); let armG = 0;
        for (let j = 0; j < 30 && !armG; j++) { d.look = { s: ((((j + 3) * 7919) & 0xffffff) << 8 | 0xab) >>> 0 }; const el = DK.views.dSprite(Object.assign({}, d, { forms: 4, form: 1 }), { size: 80 }); armG = el.querySelectorAll('.dk-arm').length; }
        return { w: NEWW.filter((k) => seen.wings.has(k)).length, e: NEWE.filter((k) => seen.ears.has(k)).length, a: NEWA.filter((k) => seen.arms.has(k)).length, m: NEWM.filter((k) => seen.mark.has(k)).length, w3: w3 / n,
          oldOk: !NEWE.includes(old.ears) && !NEWA.includes(old.arms) && !NEWM.includes(old.mark), armG };
      });
      check(r.w >= 5 && r.e >= 5 && r.a >= 4 && r.m >= 4, 'faltan piezas nuevas: ' + JSON.stringify(r));
      check(r.w3 > 0.15 && r.w3 < 0.5, 'alitas de la 3.ª forma: ' + r.w3);
      check(r.oldOk, 'un aspecto antiguo ha cambiado');
      check(r.armG >= 1, 'los brazos no van en su grupo (.dk-arm)');
    }),
  }, {
    name: 'v5.17: cofre con escenario, música electrónica para jefes/oleadas con fundido, avisos discretos',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => { const E = DK.expedition; E.start({}); DK.curses.accept([]); DK.relics.choose(0);
        const e = E.active(); const tn = e.map.rows.flat().find((n) => n.type === 'treasure') || Object.assign(e.map.rows[1][0], { type: 'treasure' }); e.pending = tn.id; DK.router.reset('expedition');
        const stage = !!document.querySelector('.ev-stage.chest-stage .ev-bubble h3') && document.querySelectorAll('.chest-stage .loot-card').length > 0;
        const tracks = ['boss_synth', 'boss_synth_rage', 'horde'].every((x) => DK.audio.has(x));
        DK.ui.toast('prueba'); const tst = document.querySelector('.toast-host .toast'); const tw = tst ? tst.getBoundingClientRect().width : 999;
        return { stage, tracks, tw };
      });
      check(r.stage, 'el cofre no usa el escenario');
      check(r.tracks, 'faltan pistas electrónicas');
      check(r.tw < 300, 'el aviso sigue siendo grande: ' + r.tw);
    }),
  }, {
    name: 'v5.18: atributos por forma (≈200/300/400/500, ~1000 a Nv.100), legendarios que se unen, objetos y piezas nuevas',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const K = DK.data.statKeys, sum = (o) => K.reduce((a, k) => a + o[k], 0), out = {};
        const d = DK.daskai.create('lumino', 1); d.forms = 4; d.form = 0; DK.party.add(d);
        out.tiers = [0, 1, 2, 3].map((f) => { d.form = f; DK.daskai.touch(); return Math.round(K.reduce((a, k) => a + DK.daskai.baseOf(d, k), 0)); });
        d.form = 3; DK.daskai.gainExp(d, 1e9); DK.daskai.touch(); out.lv = d.level; out.total100 = sum(DK.daskai.stats(d, []));
        // legendario: fuerza el sorteo, vence dos veces y se une
        DK.store.state.nextExpedition = { zone: 'pradera', seed: 'leg', size: 'small', kind: 'normal', mod: null }; DK.expedition.start({}); DK.curses.accept([]); DK.relics.choose(0);
        DK.config.legends.join = [0, 0, 1]; DK.config.legends.list = [{ species: 'volcanor', key: 'volcanor' }];
        const B = DK.battle; let offer = null, legSp = null;
        for (let i = 0; i < 2; i++) { const st = B.start('pradera', DK.party.active()[0].uid, { boss: true, forceLegend: true }); legSp = st.legend; DK.legends.state(st.legend); st.enemy.cur.hp = 0; st.outcome = 'won'; const rw = B.rewards(st); offer = rw.legend; }
        out.legend = { legSp, first: DK.legends.state(legSp).defeated, offer: offer && offer.offer };
        const j = DK.legends.join(legSp, 20); out.joined = { leg: !!j.legendary, tier: DK.daskai.tierTotal(j), boss: !!DK.looks.of(j).boss };
        out.items = ['pocion_total', 'eter_total', 'restaurador', 'pocion_media', 'eter_medio', 'tonico_vigor'].every((id) => DK.data.items[id]);
        out.parts = ['compound', 'ember'].every((k) => DK.looks.allKeys('eyes').includes(k)) && ['maw', 'fishlips'].every((k) => DK.looks.allKeys('mouth').includes(k)) && ['shieldarm', 'flamearm'].every((k) => DK.looks.allKeys('arms').includes(k)) && ['pistons', 'crystal'].every((k) => DK.looks.allKeys('legs').includes(k));
        return out;
      });
      check(r.tiers[0] > 170 && r.tiers[0] < 235 && r.tiers[3] > 440 && r.tiers[3] < 570 && r.tiers[1] < r.tiers[2], 'totales de base por forma: ' + r.tiers);
      check(r.total100 > 900 && r.total100 < 1200, 'suma a Nv.100 (sin equipo): ' + r.total100);
      check(r.legend.legSp && r.legend.first === 2 && r.legend.offer, 'legendario: ' + JSON.stringify(r.legend));
      check(r.joined.leg && r.joined.tier === 600 && r.joined.boss, 'el legendario unido: ' + JSON.stringify(r.joined));
      check(r.items, 'faltan objetos nuevos');
      check(r.parts, 'faltan piezas nuevas');
    }),
    }, {
    name: 'v5.19: sin alas dobles, accesorios que se adaptan al cuerpo, accesorios y colores nuevos',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const L = DK.looks, T = L.typical('lumino'), out = {}, norm = (x) => x.replace(/lk\d+/g, 'ID');
        const base = Object.assign({}, T, { ears: 'cat', arms: 'none', winged: false, final: 'none' });
        const reg = (w) => Object.assign({}, L.regalia(Object.assign({}, base, { _reg: null })), { wings: w, wings3: 'none' });
        const d = (ind, w) => norm(L.draw(Object.assign({}, ind, { _reg: reg(w) }), 3, { final: true, tier: 4 }));
        out.plainDiff = d(base, 'mecha') !== d(base, 'none'); // sin alas propias: sí lleva las épicas
        out.headwings = d(Object.assign({}, base, { ears: 'headwings' }), 'mecha') === d(Object.assign({}, base, { ears: 'headwings' }), 'none');
        out.wingarm = d(Object.assign({}, base, { arms: 'wingarm' }), 'storm') === d(Object.assign({}, base, { arms: 'wingarm' }), 'none');
        out.finals = ['cap', 'pirate', 'propeller', 'necklace', 'backpack', 'glasses'].filter((k) => !L.allKeys('final').includes(k));
        out.errs = 0; try { for (let i = 1; i < 400; i++) L.draw(L.roll(['luz', 'fuego', 'agua', 'tierra', 'oscuridad'][i % 5], ((i * 40503) << 8 | 0xab) >>> 0), 3, { final: true, tier: i % 5 }); } catch (e) { out.errs = String(e); }
        return out;
      });
      check(r.plainDiff, 'sin alas propias deberían verse las alas épicas');
      check(r.headwings && r.wingarm, 'con alas propias no deben superponerse otras: ' + JSON.stringify(r));
      check(!r.finals.length, 'faltan accesorios: ' + r.finals);
      check(r.errs === 0, 'error dibujando aspectos nuevos: ' + r.errs);
    }),
  }, {
    name: 'v5.19.1: nodos del mapa sin solaparse en el móvil, pisos que nunca te dejan atascado',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      let worst = 0;
      for (let s = 0; s < 6; s++) {
        const c = await p.evaluate((s) => {
          DK.store.state.nextExpedition = { zone: 'pradera', seed: 'ov' + s, size: ['small', 'medium', 'xl'][s % 3], kind: 'normal', mod: null };
          DK.expedition.start({}); const e = DK.expedition.active(); e.curseOffer = null; e.relicChoice = null; e.introShown = `1|${e.seed}`; e.flyShown = `1|${e.seed}`;
          DK.router.reset('expedition');
          const ns = [...document.querySelectorAll('.exp-map-card .exp-node')].map((n) => n.getBoundingClientRect()); let n = 0;
          for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) n++; }
          return n;
        }, s);
        worst = Math.max(worst, c);
      }
      check(worst === 0, 'nodos solapados en el mapa: ' + worst);
      // un encuentro especial sin regalos (partida antigua) ofrece «Seguir»
      const r = await p.evaluate(() => { const e = DK.expedition.active(); const n = e.map.rows[1][0]; n.type = 'event'; n.special = 'rare'; e.pending = n.id; e.result = null; e.event = 'special'; e.giftChoice = []; DK.router.refresh(); return !!document.querySelector('.exp-cont'); });
      check(r, 'el encuentro sin regalos no deja seguir');
    }),
  }, {
    name: 'v5.19.1: cambiar de música en mitad de un fundido no rompe nada (regla estricta de Firefox)',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.mouse.click(3, 3);
      const r = await p.evaluate(async () => {
        // Firefox no deja añadir eventos dentro de una curva ya programada (aquí se emula en Chromium)

  const P = AudioParam.prototype, K = '__curves';
  const curves = (p) => (p[K] = p[K] || []);
  const check = (p, t) => { for (const c of curves(p)) if (t > c.s && t < c.s + c.d) throw new DOMException("AudioParam.setValueAtTime: Can't add events during a curve event", 'NotSupportedError'); };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) { const o = P[m]; P[m] = function (v, t, ...r) { check(this, t); return o.call(this, v, t, ...r); }; }
  const oc = P.setValueCurveAtTime; P.setValueCurveAtTime = function (v, t, d) { check(this, t); curves(this).push({ s: t, d }); return oc.call(this, v, t, d); };
  const ocs = P.cancelScheduledValues; P.cancelScheduledValues = function (t) { this[K] = curves(this).filter((c) => c.s < t); return ocs.call(this, t); };
  delete P.cancelAndHoldAtTime; // Firefox no lo tiene

        DK.settings.set('muted', false); DK.settings.set('musicVol', 0.5);
        const S = (ms) => new Promise((res) => setTimeout(res, ms)), errs = [];
        for (const tr of ['menu', 'mystery', 'boss', 'menu', 'danger', 'horde', 'menu']) { try { DK.audio.music(tr); } catch (e) { errs.push(e.message); } await S(700); }
        return { errs, playing: DK.audio.playing(), ctx: DK.audio.playing() !== null };
      });
      check(!r.errs.length, 'la música lanzó: ' + r.errs.join(' · '));
    }),
  }, {
    name: 'v5.20: fondos en pixel art, marcos por grupos y tarjeta de perfil personalizable',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const S = (ms) => new Promise((r) => setTimeout(r, ms));
      // Fondos: con pixel art la escena es una imagen; sin él, el SVG de siempre
      const px = {};
      for (const on of [true, false]) {
        await p.evaluate((on) => { DK.settings.set('pixelArt', on); const z = DK.data.zones[Object.keys(DK.data.zones)[0]]; document.querySelector('#app, body').append(Object.assign(document.createElement('div'), { id: 'pxtest' })); document.getElementById('pxtest').append(DK.scenes.render(z.scene, z.colors), DK.ambient.page(z.scene)); }, on);
        await S(900);
        px[on] = await p.evaluate(() => { const r = { img: document.querySelectorAll('#pxtest img.px-layer, #pxtest .pxs-l').length, /* v5.25: el paisaje va por capas (.pxs-l) */ svg: document.querySelectorAll('#pxtest svg').length, attr: document.documentElement.dataset.px }; document.getElementById('pxtest').remove(); return r; });
      }
      check(px.true.img >= 3 && px.true.svg === 0 && px.true.attr === 'on', 'con pixel art el fondo debería ser imagen: ' + JSON.stringify(px.true));
      check(px.false.attr === 'off' && px.false.img >= 7, 'sin pixel art el paisaje también va por capas (suaves): ' + JSON.stringify(px.false)); // v5.25b
      // Marcos: todos con su CSS y su nombre, en grupos; los básicos siempre están
      const fr = await p.evaluate(() => { const all = DK.avatars.frames(); return { n: all.length, noCss: all.filter((f) => !f.css || !f.group).map((f) => f.id), basicLocked: DK.avatars.framesOf('basic').filter((f) => !f.unlocked).length, names: all.filter((f) => /^profile\.|^pass\./.test(DK.avatars.frameName(f))).map((f) => f.id), feats: DK.avatars.framesOf('feat').length }; });
      check(fr.n >= 30 && !fr.noCss.length && !fr.basicLocked && fr.feats >= 8, 'marcos: ' + JSON.stringify(fr));
      check(!fr.names.length, 'marcos sin nombre: ' + fr.names);
      // Tarjeta: todas las combinaciones de tema se dibujan; opciones raras se corrigen
      const card = await p.evaluate(async () => {
        const out = [], SC = DK.shareCard;
        for (const th of Object.keys(SC.THEMES)) { const c = await SC.render({ theme: th, pattern: 'stars', border: 'gold', show: 'team', stats: Object.keys(SC.STATS).slice(0, 6) }); out.push(c.width + 'x' + c.height); }
        DK.store.state.player.card = { theme: 'nope', stats: ['x', 'battles'] };
        const o = SC.options();
        return { sizes: [...new Set(out)], theme: o.theme, stats: o.stats };
      });
      check(card.sizes.length === 1 && card.sizes[0] === '1200x630', 'tarjeta: ' + JSON.stringify(card));
      check(card.theme === 'night' && card.stats.join() === 'battles', 'opciones de la tarjeta sin corregir: ' + JSON.stringify(card));
      // El editor del perfil abre sus tres pestañas
      for (const tab of ['pic', 'frame', 'card']) {
        await p.evaluate((tab) => DK.router.reset('profile', { edit: true, edTab: tab }), tab); await S(400);
        check(await p.evaluate(() => !!document.querySelector('.profile-editor')), 'no se abre la pestaña ' + tab);
      }
    }),
  }, {
    name: 'v5.21: iconos de objetos en pixel art (hoja items-px) con el ajuste «Pixel art»',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const A = DK.itemsPx, ids = Object.keys(DK.data.items);
        const missing = ids.filter((k) => A.ids[k] === undefined), idx = Object.values(A.ids);
        const img = await new Promise((res) => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = A.src; });
        DK.settings.set('pixelArt', true); const on = DK.views.itemIcon(DK.data.items.pocion);
        const gear = DK.views.itemIcon(DK.data.items.anillo_brasas, 22, { ring: '#c084fc' });
        DK.settings.set('pixelArt', false); const off = DK.views.itemIcon(DK.data.items.pocion);
        const unknown = (DK.settings.set('pixelArt', true), DK.views.itemIcon(Object.assign({}, DK.data.items.pocion, { id: 'nuevo_sin_icono' })));
        return { missing, dup: idx.length - new Set(idx).size, img, max: Math.max(...idx), cols: A.cols, rows: A.rows,
          on: on.classList.contains('ii-px') && !!on.querySelector('.ii-spr'), off: !off.classList.contains('ii-px') && !!off.querySelector('svg'),
          ring: gear.classList.contains('has-ring') && gear.style.getPropertyValue('--ring') === '#c084fc', unknown: !unknown.classList.contains('ii-px') };
      });
      check(!r.missing.length && r.dup === 0, 'objetos sin icono o repetidos: ' + JSON.stringify(r));
      check(r.img && r.img[0] === r.cols * 16 && r.img[1] === r.rows * 16 && r.max < r.cols * r.rows, 'la hoja no cuadra: ' + JSON.stringify(r));
      check(r.on && r.off && r.ring && r.unknown, 'icono en pixel art / vectorial / rareza / objeto nuevo: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.22: iconos de la interfaz del dataset (pixel art en tonos / silueta limpia) y siluetas de objetos',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const A = DK.iconsPx, names = Object.keys(A.ids);
        DK.settings.set('pixelArt', true);
        const px = DK.icon('swords', 32), arrow = DK.icon('back', 32), small = DK.icon('swords', 18);
        DK.settings.set('pixelArt', false);
        const gl = DK.icon('swords', 32), skip = DK.icon('flame', 32), share = DK.icon.svg('trophy');
        const item = DK.views.itemIcon(DK.data.items.pocion);
        DK.settings.set('pixelArt', true);
        return { n: names.length, mask: A.src.startsWith('data:image/png'), px: px.classList.contains('icon-px') && !!px.querySelector('.ipx') && px.style.width === '32px', small: !small.classList.contains('icon-px') && !!small.querySelector('svg'),
          ipx16: px.querySelector('.ipx').style.width, arrow: !!arrow.querySelector('svg') && !arrow.classList.contains('icon-px'),
          gl: gl.classList.contains('icon-gl') && gl.querySelector('path').getAttribute('fill-rule') === 'evenodd', skip: !skip.classList.contains('icon-gl') && !!skip.querySelector('svg'),
          share: share.includes('evenodd'), itemGlyph: !!item.querySelector('path[fill-rule="evenodd"]'),
          glyphsItems: Object.keys(DK.itemsPx.glyphs).length, items: Object.keys(DK.data.items).length };
      });
      check(r.n >= 100 && r.mask, 'iconos de interfaz: ' + JSON.stringify(r));
      check(r.px && r.ipx16 === '32px' && r.arrow && r.small, 'pixel art: máscara nítida de 32 px, flechas de trazo y en pequeño (< 28 px) el icono de siempre: ' + JSON.stringify(r));
      check(r.gl && r.skip && r.share, 'estilo limpio: silueta, excepciones de trazo y tarjeta: ' + JSON.stringify(r));
      check(r.itemGlyph && r.glyphsItems === r.items, 'siluetas de objetos: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.23: iconos de Ajustes y del Equipo, compuestos (grupo, silenciado, ojo tachado) y arcón con mochila',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const A = DK.iconsPx.ids, need = ['users', 'user', 'volume', 'volumeOff', 'eye', 'eyeOff', 'accessibility', 'keyboard', 'gauge', 'image', 'type', 'layers', 'vibrate', 'play', 'pause', 'skip', 'download', 'upload', 'help'];
        const tent = DK.pix.animated('tent');
        return { missing: need.filter((n) => A[n] === undefined), tentW: tent.frames[0].w, tentBase: tent.base, frames: tent.frames.length };
      });
      check(!r.missing.length, 'faltan iconos: ' + r.missing);
      check(r.tentW === 76 && Math.abs(r.tentBase - 45.6) < 0.01 && r.frames === 3, 'arcón con mochila: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.24: iconos pequeños de trazo, barra inferior con iconos grandes (y su ajuste) y mochila del arcón',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const S = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
        out.small = !DK.icon('swords', 20).classList.contains('icon-px') && !DK.icon('swords', 20).classList.contains('icon-gl');
        DK.settings.set('dock', 'big'); DK.router.reset('hub'); await S(300);
        const slots = [...document.querySelectorAll('.dock-slot:not(.dock-more)')];
        out.big = document.documentElement.dataset.dock === 'big' && slots.every((b) => b.querySelector('.dock-icon .icon').style.width === '32px' || !!b.querySelector('.dock-icon svg'));
        out.hidden = slots.filter((b) => !b.classList.contains('active')).every((b) => getComputedStyle(b.querySelector('.dock-label')).position === 'absolute');
        DK.settings.set('dock', 'classic'); DK.app.renderNav(); await S(100);
        out.classic = document.documentElement.dataset.dock === 'classic' && getComputedStyle(document.querySelector('.dock-slot:not(.active) .dock-label')).position !== 'absolute';
        DK.settings.set('dock', 'big');
        out.tentW = DK.pix.animated('tent').frames[0].w;
        return out;
      });
      check(r.small, 'los iconos pequeños deberían ser los de trazo');
      check(r.big && r.hidden && r.classic, 'barra inferior: ' + JSON.stringify(r));
      check(r.tentW === 76, 'arcón con mochila: ' + r.tentW);
    }),
  }, {
    name: 'v5.25: fondos por capas en pixel art (suaves), icono de equipo, terreno con detalle y botín con registro',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const S = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
        DK.settings.set('pixelArt', true);
        const host = document.createElement('div'); host.className = 'arena'; host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:360px';
        document.body.append(host);
        out.kits = Object.keys(DK.scenes.list).filter((id) => !DK.pixelScene.has(id));
        const sc = DK.scenes.render('forest', ['#4ade80', '#14532d']); host.append(sc); await S(200);
        const ls = [...sc.querySelectorAll('.pxs-l')];
        out.layers = ls.map((l) => l.className.replace('pxs-l pxs-', '').split(' ')[0]);
        const mv = sc.querySelector('.pxs-mid'), cs = getComputedStyle(mv);
        out.drift = cs.animationName === 'pxsDrift' && cs.animationTimingFunction === 'linear';
        out.svg = sc.querySelectorAll('svg').length;
        const sp = sc.querySelector('.sp'); out.sp = sp ? getComputedStyle(sp).animationTimingFunction : 'none';
        out.wide = mv.getBoundingClientRect().width > 800;
        DK.settings.set('pixelArt', false);
        const clean = DK.scenes.render('forest', ['#4ade80', '#14532d']); out.clean = clean.classList.contains('pxs-smooth') && clean.querySelectorAll('.pxs-l').length === 7 && !clean.querySelector('svg.scene-far');
        DK.settings.set('pixelArt', true); host.remove();
        out.users = DK.icon('users', 20).innerHTML.includes('<ellipse'); // v5.27: zarpa de oso
        // v5.25b: avisos del equipo
        const d0 = DK.party.all()[0]; out.needs = Array.isArray(DK.daskai.needs(d0));
        const lv = d0.level; d0.level = Math.max(d0.level, DK.config.talentEvery); out.needTalent = DK.daskai.needs(d0).includes('talent') || !!(d0.talents && Object.keys(d0.talents).length);
        out.badge = DK.menus.list ? true : true; d0.level = lv;
        const im = new Image(); im.src = DK.pix.terrain(['#86efac', '#16a34a'], 'v525'); await im.decode(); out.terrain = im.width;
        out.lang = ['battle.endLog', 'battle.endPeek', 'battle.endShow'].every((k) => DK.i18n.t(k) !== k);
        return out;
      });
      check(!r.kits.length, 'escenas sin kit de capas: ' + r.kits);
      check(r.layers.join() === 'sky,far,far2,fog,mid,rays,near' && r.svg === 0, 'las 7 capas del bosque: ' + JSON.stringify(r.layers));
      check(r.drift && r.wide, 'las capas deberían desplazarse en bucle y suaves: ' + JSON.stringify(r));
      check(!/steps/.test(r.sp), 'partículas a saltos: ' + r.sp);
      check(r.clean, 'sin pixel art: 7 capas suaves');
      check(r.users, 'el icono de equipo pequeño debería ser la zarpa');
      check(r.needs && r.needTalent, 'avisos del equipo: ' + JSON.stringify(r));
      check(r.terrain === 96, 'tesela del terreno: ' + r.terrain);
      check(r.lang, 'faltan textos del botín');
    }),
  }, {
    name: 'v5.27: mapa del mundo ilustrado, talentos en filas compactas y fotos de perfil por cajas',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const S = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
        DK.router.reset('zones'); await S(300);
        const art = document.querySelector('.wm2-art'); out.art = !!art && /^url\("?data:image\/png/.test(art.style.backgroundImage); out.oldDeco = document.querySelectorAll('.wm2-deco, .wm2-region').length;
        const d = DK.party.all()[0]; const lv = d.level, tal = d.talents; d.level = DK.config.talentEvery; d.talents = {};
        DK.views.talentDialog(d); await S(300);
        const rows = [...document.querySelectorAll('.tl-modal .tl-opt')]; out.rows = rows.length; out.best = document.querySelectorAll('.tl-modal .tl-opt.best').length;
        const hs = rows.map((x) => x.getBoundingClientRect().height); out.modalH = document.querySelector('.tl-modal').getBoundingClientRect().height;
        out.chips = document.querySelectorAll('.tl-modal .tl-chip').length;
        document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove()); d.level = lv; d.talents = tal;
        DK.router.reset('profile', { edit: true }); await S(300);
        out.groups = [...document.querySelectorAll('.pe-groups .pe-chip')].map((b) => b.textContent);
        return out;
      });
      check(r.art && r.oldDeco === 0, 'mapa ilustrado: ' + JSON.stringify(r));
      check(r.rows === 3 && r.best === 1 && r.chips >= 3 && r.modalH < 640, 'ventana de talentos compacta: ' + JSON.stringify(r));
      check(r.groups.length >= 2, 'fotos de perfil por grupos: ' + JSON.stringify(r.groups));
    }),
}],
};
