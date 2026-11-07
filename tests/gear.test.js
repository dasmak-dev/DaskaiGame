/* Equipamiento con rareza (v4.74): piezas, afijos, forja, combate, expedición e inventario. */
const { play, sleep, check, overflowX } = require('./helpers');

module.exports = {
  name: 'Equipamiento y forja',
  cases: [{
    name: 'Cada rareza sale con sus atributos y afijos (prefijos y sufijos dentro de su tope)',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const bad = [], G = DK.data.gear;
        Object.keys(DK.data.items).filter((id) => DK.data.items[id].category === 'equipo').forEach((base) => {
          G.rarityOrder.forEach((rar) => {
            for (let i = 0; i < 6; i++) {
              const x = DK.gear.create(base, { rarity: rar, ilvl: 1 + i * 15 }), R = G.rarities[rar];
              const pre = x.affixes.filter((a) => DK.gear.kindOf(a) === 'prefix').length, suf = x.affixes.length - pre;
              const keys = x.attrs.map((a) => a.k);
              if (x.attrs.length < R.attrs[0] || x.attrs.length > R.attrs[1]) bad.push(`${base}/${rar} atributos ${x.attrs.length}`);
              if (x.affixes.length < R.affixes[0] || x.affixes.length > R.affixes[1]) bad.push(`${base}/${rar} afijos ${x.affixes.length}`);
              if (pre > R.maxP || suf > R.maxS) bad.push(`${base}/${rar} ${pre}P ${suf}S`);
              if (new Set(keys).size !== keys.length || new Set(x.affixes.map((a) => a.id)).size !== x.affixes.length) bad.push(`${base}/${rar} repetidos`);
              if (x.affixes.some((a) => G.tiers.ilvl[a.t - 1] > x.ilvl)) bad.push(`${base}/${rar} tier alto en nivel ${x.ilvl}`);
              if (!DK.gear.name(x)) bad.push(`${base}/${rar} sin nombre`);
              if ((rar === 'legendario') !== !!DK.gear.passive(x)) bad.push(`${base}/${rar} pasiva`);
            }
          });
        });
        return bad.slice(0, 8);
      });
      check(!r.length, 'piezas fuera de las reglas: ' + r.join(' | '));
    }),
  }, {
    name: 'Forja: normal → mágico → raro → legendario, esquirla de jefe en un afijo y piedras que no valen',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        DK.bag.addHome({ piedra_transmutacion: 1, piedra_alteracion: 1, piedra_regia: 1, piedra_caos: 1, piedra_divina: 1, piedra_purga: 1, esquirla_jefe: 1, corazon_jefe: 1 });
        const x = DK.gear.gain('garra_afilada', { rarity: 'normal', ilvl: 70 });
        const out = { wrong: DK.gear.forge(x.uid, 'piedra_regia').ok };
        out.t = DK.gear.forge(x.uid, 'piedra_transmutacion').ok && x.rarity === 'magico';
        out.alt = DK.gear.forge(x.uid, 'piedra_alteracion').ok && x.rarity === 'magico';
        out.regal = DK.gear.forge(x.uid, 'piedra_regia').ok && x.rarity === 'raro' && x.attrs.length >= 4 && !!x.nm;
        const before = JSON.stringify(x.affixes);
        const keep = x.affixes.map((a) => a.id);
        out.shard = DK.gear.forge(x.uid, 'esquirla_jefe', { affix: 0 }).ok;
        out.oneChanged = x.affixes.slice(1).every((a, i) => a.id === keep[i + 1]) && JSON.stringify(x.affixes) !== before && DK.gear.kindOf(x.affixes[0]) === DK.data.gear.affixes[keep[0]].kind;
        out.heart = DK.gear.forge(x.uid, 'corazon_jefe').ok && x.rarity === 'legendario' && DK.gear.passive(x) === 'leg_garra_afilada';
        out.used = ['piedra_transmutacion', 'piedra_alteracion', 'piedra_regia', 'esquirla_jefe', 'corazon_jefe'].every((id) => !DK.bag.home()[id]);
        out.noStone = DK.gear.forge(x.uid, 'piedra_transmutacion').ok;
        // Desguazar da fragmentos
        const y = DK.gear.gain('escama_dura', { rarity: 'raro' });
        out.salvage = DK.gear.salvage(y.uid).ok && DK.bag.home().fragmento_forja >= 4 && !DK.gear.find(y.uid);
        return out;
      });
      check(!r.wrong && r.t && r.alt && r.regal, 'la escalera de rarezas no funciona: ' + JSON.stringify(r));
      check(r.shard && r.oneChanged, 'la esquirla debería cambiar sólo el afijo elegido (y del mismo tipo): ' + JSON.stringify(r));
      check(r.heart && r.used && !r.noStone && r.salvage, 'corazón, consumo de piedras o desguace: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Lo equipado sube atributos y da sus efectos en combate; las partidas antiguas se convierten',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const d = DK.party.leader(), s0 = DK.daskai.stats(d);
        const x = DK.gear.gain('corona_vacio', { rarity: 'legendario', ilvl: 60 });
        DK.gear.equip(d, 0, x.uid);
        const s1 = DK.daskai.stats(d), fx = DK.gear.fxOf(d);
        const out = { up: DK.data.statKeys.every((k) => s1[k] >= s0[k]) && s1.hp > s0.hp, dmg: fx.dmg > 0, passive: DK.daskai.passives(d).includes('leg_corona_vacio'), home: !DK.gear.home().includes(x) };
        DK.gear.unequip(d, 0);
        out.back = DK.gear.home().includes(x) && JSON.stringify(DK.daskai.stats(d)) === JSON.stringify(s0);
        // Partida antigua: equipo en la bolsa y equipado como ids
        const s = JSON.parse(JSON.stringify(DK.store.state)); delete s.gearV; s.gear = []; s.bag.orbe_solar = 2; s.party[0].equip = ['corona_celeste', null];
        DK.gear.migrate(s);
        out.migrated = s.gear.length === 2 && !s.bag.orbe_solar && s.party[0].equip[0].rarity === 'raro' && s.gear[0].rarity === 'magico';
        return out;
      });
      check(r.up && r.dmg && r.passive && r.home && r.back, 'equipar no aplica bien la pieza: ' + JSON.stringify(r));
      check(r.migrated, 'la partida antigua no se convierte: ' + JSON.stringify(r));
    }),
  }, {
    name: 'Piedras nuevas: alquimia, aumento, exaltación, anulación, templado, sello (sobrevive al caos) y eco; nivel del botín',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const G = DK.gear, give = (o) => DK.bag.addHome(o), out = {};
        give({ piedra_alquimia: 1, piedra_transmutacion: 1, piedra_aumento: 2, piedra_exaltacion: 3, piedra_anulacion: 1, piedra_templado: 1, sello_forja: 1, piedra_caos: 1, eco_legendario: 1 });
        const a = G.gain('garra_afilada', { rarity: 'normal', ilvl: 70 });
        out.alch = G.forge(a.uid, 'piedra_alquimia').ok && a.rarity === 'raro';
        const m = G.gain('escama_dura', { rarity: 'normal', ilvl: 30 });
        G.forge(m.uid, 'piedra_transmutacion');
        while (m.affixes.length > 1) m.affixes.pop();
        out.aug = G.forge(m.uid, 'piedra_aumento').ok && m.affixes.length === 2 && !!G.cannotForge(m, 'piedra_aumento');
        // Exaltación hasta llenar (4) y luego no deja
        let n = 0; while (!G.cannotForge(a, 'piedra_exaltacion') && n++ < 5) G.forge(a.uid, 'piedra_exaltacion');
        out.exaltFull = a.affixes.length === 4 && G.cannotForge(a, 'piedra_exaltacion') === DK.t('gear.why.full') || (a.affixes.length === 4 && !DK.bag.home().piedra_exaltacion);
        // Sello en el 0, caos: sigue; templado sube el tier
        const keep = a.affixes[0].id;
        out.needSel = !G.forge(a.uid, 'sello_forja').ok;
        out.seal = G.forge(a.uid, 'sello_forja', { affix: 0 }).ok && a.affixes[0].lock;
        out.chaos = G.forge(a.uid, 'piedra_caos').ok && a.affixes.some((x) => x.id === keep) && !a.affixes.some((x) => x.lock);
        const i = a.affixes.findIndex((x) => x.t < 5), t0 = a.affixes[i].t;
        out.temper = G.forge(a.uid, 'piedra_templado', { affix: i }).ok && a.affixes[i].t === t0 + 1;
        const before = a.affixes.length;
        out.annul = G.forge(a.uid, 'piedra_anulacion').ok && a.affixes.length === before - 1;
        out.hist = (a.hist || []).length >= 5;
        // Eco: sólo legendarios; cambia la pasiva
        out.ecoNo = !!G.cannotForge(a, 'eco_legendario');
        const l = G.gain('corona_celeste', { rarity: 'legendario' }), lp = G.passive(l);
        out.eco = G.forge(l.uid, 'eco_legendario').ok && G.passive(l) !== lp && DK.data.passives[G.passive(l)].legendary;
        // Nivel del objeto: el de quien lo suelta ±2
        const lv = []; for (let k = 0; k < 30; k++) lv.push(G.create('garra_afilada', { ilvl: 40 }).ilvl);
        out.ilvl = Math.min(...lv) >= 38 && Math.max(...lv) <= 42;
        // Afijos que pueden salir: suman 100 % por tipo
        const pool = G.affixPool(a), sum = (k) => pool.filter((x) => x.kind === k).reduce((s2, x) => s2 + x.chance, 0);
        out.pool = Math.abs(sum('prefix') - 1) < 0.01 && Math.abs(sum('suffix') - 1) < 0.01;
        return out;
      });
      const bad = Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
      check(!bad.length, 'fallan: ' + bad.join(', ') + ' ' + JSON.stringify(r));
    }),
  }, {
    name: 'Inventario → Equipamiento: ficha, «Equipar en…» (equipo, entrenando y cajas) y acceso a la forja',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => {
        DK.gear.gain('garra_afilada', { rarity: 'normal', ilvl: 12 });
        DK.gear.gain('orbe_solar', { rarity: 'raro', ilvl: 30 });
        for (let i = 0; i < 7; i++) DK.party.add(DK.daskai.create('lumino', 5 + i));
        DK.router.reset('inventory', { tab: 'gear' });
      });
      await sleep(400);
      const tiles = await p.$$('.gear-tile');
      check(tiles.length === 2, 'deberían verse 2 piezas en la armería (hay ' + tiles.length + ')');
      check(!(await overflowX(p)), 'la armería se sale de la pantalla');
      await tiles[1].click();
      const sheet = (await p.evaluate(() => DK.ui.isNarrow())) ? '.drawer' : '.inv-side';
      let opened = false; for (let k = 0; k < 20 && !opened; k++) { await sleep(150); opened = await p.evaluate((sel) => !!document.querySelector(sel + ' .gear-tip'), sheet); }
      check(opened, 'no se abre la ficha de la pieza');
      check(await p.evaluate((sel) => !!document.querySelector(sel + ' .gear-actions .btn:nth-child(2)'), sheet), 'falta «Mejorar en la forja»');
      await p.evaluate((sel) => document.querySelector(sel + ' .gear-actions .btn').click(), sheet); await sleep(500);
      const secs = await p.evaluate(() => [...document.querySelectorAll('.ep-sec > summary')].map((x) => x.textContent));
      check(secs.length >= 2 && /equipo/i.test(secs[0]) && secs.some((x) => /Caja/.test(x)), 'la ventana debería separar el equipo y las cajas: ' + secs.join(' | '));
      await p.evaluate(() => document.querySelector('.ep-row').click()); await sleep(300);
      await p.evaluate(() => document.querySelector('.ep-slot .btn').click()); await sleep(400);
      const worn = await p.evaluate(() => { const d = DK.party.leader(); return !!(d.equip[0] && d.equip[0].base === 'garra_afilada'); });
      check(worn, 'no se equipa desde la ventana');
    }),
  }, {
    name: 'Crafteo → Forja: elegir pieza y afijo, usar una piedra y ver huecos, afijos posibles e historial',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      const uid = await p.evaluate(() => {
        DK.bag.addHome({ piedra_templado: 1, piedra_divina: 1 });
        const x = DK.gear.gain('orbe_solar', { rarity: 'raro', ilvl: 80 });
        x.affixes.forEach((a) => (a.t = 1));
        DK.router.reset('craft', { tab: 'forge', fp: x.uid });
        return x.uid;
      });
      await p.waitForSelector('.fb-mesa button.gt-affix', { state: 'attached', timeout: 5000 });
      check(!(await overflowX(p)), 'la forja se sale de la pantalla');
      const r0 = await p.evaluate(() => ({ pips: document.querySelectorAll('.fb-pips i').length, pool: document.querySelectorAll('.fb-pool-row').length, temperOff: [...document.querySelectorAll('.fs-row')].find((b) => /templado/i.test(b.textContent)).disabled }));
      check(r0.pips === 4 && r0.pool > 0 && r0.temperOff, 'faltan huecos, afijos posibles o el templado debería pedir un afijo: ' + JSON.stringify(r0));
      await p.evaluate(() => document.querySelector('.fb-mesa button.gt-affix').click()); await sleep(300);
      await p.evaluate(() => [...document.querySelectorAll('.fs-row')].find((b) => /templado/i.test(b.textContent)).click()); await sleep(400);
      const r = await p.evaluate((u) => { const x = DK.gear.find(u).p, i = DK.router.current().params.fsel; return { t: i != null ? x.affixes[i].t : -1, hist: document.querySelectorAll('.fb-hist-list li').length, left: DK.bag.home().piedra_templado || 0 }; }, uid);
      check(r.t === 2 && r.left === 0 && r.hist === 1, 'el templado desde la forja no sube el afijo elegido: ' + JSON.stringify(r));
    }),
  }],
};
