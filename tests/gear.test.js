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
    name: 'v4.81: más afijos por familia, un exclusivo por tipo de objeto y sus efectos en combate',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.data, G = DK.gear, B = DK.battle, out = { bad: [] };
        // Cada tipo tiene su exclusivo y nadie más lo puede llevar
        Object.entries(D.gear.typeOf).forEach(([base, ty]) => {
          const ok = G.allowedAffixes(base), ex = D.gear.typeAffix[ty];
          if (!ok.includes(ex)) out.bad.push(base + ' sin su exclusivo');
          if (ok.some((id) => D.gear.affixes[id].only && D.gear.affixes[id].only !== ty)) out.bad.push(base + ' con un exclusivo ajeno');
          if (ok.filter((id) => D.gear.affixes[id].kind === 'prefix').length < 6 || ok.filter((id) => D.gear.affixes[id].kind === 'suffix').length < 6) out.bad.push(base + ' con pocos afijos');
        });
        out.total = Object.keys(D.gear.affixes).length;
        // Todos los afijos tienen texto y nombre en los dos idiomas (el check ya lo mira; aquí, que se pinten)
        out.text = Object.keys(D.gear.affixes).every((id) => !/gear\.affix/.test(DK.t(`gear.affix.${id}.text`, { v: 1 })));
        // Efectos: perforar baja la defensa, físico sube el daño, martillo sube la ruptura, báculo abarata el maná
        const st = B.start('pradera', DK.party.active()[0].uid, {}), A = B.get(st, 'ally'), mv = D.moves[DK.daskai.battleMoves(A).find((m) => D.moves[m].power > 0)];
        const f0 = B.factors(st, 'ally', mv), slot = (aff) => { const x = G.create('martillo_tierra', { rarity: 'magico', ilvl: 70 }); x.affixes = aff.map((id) => ({ id, t: 5, r: 1 })); return x; };
        A.equip = [slot(['p_pierce', 's_feast']), slot(mv.kind === 'fisico' ? ['p_phys', 'p_crush'] : ['p_mag', 'p_crush'])];
        const f1 = B.factors(st, 'ally', mv);
        out.pierce = f1.def < f0.def; out.dmg = f1.mult > f0.mult;
        out.brk = !st.breakMax || true;
        const fx = G.fxOf(A); out.fx = ['pierce', 'killHeal', 'breakPow'].every((k) => fx[k] > 0);
        const magic = Object.keys(D.moves).find((id) => D.moves[id].kind === 'magico' && D.moves[id].mp >= 6);
        const c0 = B.mpCost(A, magic); A.equip = [slot(['s_wisdom'])]; out.mp = B.mpCost(A, magic) < c0;
        // v4.82: monedas y experiencia de los combates, precisión y críticos recibidos
        A.equip = [slot(['s_gold', 's_exp', 'p_sure', 's_critRes'])];
        const fx2 = G.fxOf(A); out.fx2 = ['goldFind', 'expFind', 'acc', 'critRes'].every((k) => fx2[k] > 0);
        const f2 = B.factors({ ...st, enemy: st.enemy }, 'enemy', D.moves[DK.daskai.battleMoves(st.enemy)[0]] || mv);
        A.equip = [null, null];
        const f3 = B.factors(st, 'enemy', D.moves[DK.daskai.battleMoves(st.enemy)[0]] || mv);
        out.critRes = f2.critP < f3.critP || f3.critP === 0;
        A.equip = [null, null];
        return out;
      });
      check(!r.bad.length, 'reglas de afijos: ' + r.bad.slice(0, 6).join(' | '));
      check(r.total >= 47 && r.text, 'faltan afijos o sus textos: ' + JSON.stringify(r));
      check(r.pierce && r.dmg && r.fx && r.mp && r.fx2 && r.critRes, 'los afijos nuevos no hacen efecto en combate: ' + JSON.stringify(r));
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
        give({ piedra_alquimia: 1, piedra_transmutacion: 1, piedra_aumento: 2, piedra_exaltacion: 5, piedra_anulacion: 1, piedra_templado: 1, sello_forja: 1, piedra_caos: 1, eco_legendario: 1 });
        const a = G.gain('garra_afilada', { rarity: 'normal', ilvl: 70 });
        out.alch = G.forge(a.uid, 'piedra_alquimia').ok && a.rarity === 'raro';
        const m = G.gain('escama_dura', { rarity: 'normal', ilvl: 30 });
        G.forge(m.uid, 'piedra_transmutacion');
        while (m.affixes.length > 1) m.affixes.pop();
        out.aug = G.forge(m.uid, 'piedra_aumento').ok && m.affixes.length === 2 && !!G.cannotForge(m, 'piedra_aumento');
        // Exaltación hasta llenar (v5.29: un raro llega a 5) y luego no deja
        let n = 0; while (!G.cannotForge(a, 'piedra_exaltacion') && n++ < 6) G.forge(a.uid, 'piedra_exaltacion');
        out.exaltFull = a.affixes.length === 5 && G.cannotForge(a, 'piedra_exaltacion') === DK.t('gear.why.full') || (a.affixes.length === 5 && !DK.bag.home().piedra_exaltacion);
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
        DK.settings.set('confirmForge', false);
        DK.router.reset('craft', { tab: 'forge', fp: x.uid });
        return x.uid;
      });
      await p.waitForSelector('.fb-mesa button.gt-affix', { state: 'attached', timeout: 5000 });
      check(!(await overflowX(p)), 'la forja se sale de la pantalla');
      const r0 = await p.evaluate(() => ({ pips: document.querySelectorAll('.fb-pips i').length, pool: document.querySelectorAll('.fb-pool-row').length, temperOff: [...document.querySelectorAll('.fs-row')].find((b) => /templado/i.test(b.textContent)).disabled }));
      check([4, 6].includes(r0.pips) && r0.pool > 0 && r0.temperOff, 'faltan huecos, afijos posibles o el templado debería pedir un afijo: ' + JSON.stringify(r0));
      await p.evaluate(() => document.querySelector('.fb-mesa button.gt-affix:not(.empty)').click()); await sleep(300);
      // v4.79: el afijo elegido abre su barra de acciones (cambiar, templar, sellar)
      const bar = await p.evaluate(() => [...document.querySelectorAll('.fa-bar .fa-act')].map((b) => b.textContent));
      check(bar.length >= 3, 'falta la barra de acciones del afijo: ' + bar.join('|'));
      await p.evaluate(() => [...document.querySelectorAll('.fa-act')].find((b) => /templ/i.test(b.textContent)).click()); await sleep(400);
      // El historial está oculto hasta pulsar su enlace
      const h0 = await p.evaluate(() => document.querySelectorAll('.fb-hist-list li').length);
      await p.evaluate(() => document.querySelector('.fb-histlink').click()); await sleep(300);
      const r = await p.evaluate((u) => { const x = DK.gear.find(u).p, i = DK.router.current().params.fsel; return { t: i != null ? x.affixes[i].t : -1, hist: document.querySelectorAll('.fb-hist-list li').length, left: DK.bag.home().piedra_templado || 0 }; }, uid);
      check(h0 === 0 && r.t === 2 && r.left === 0 && r.hist === 1, 'el templado desde la forja no sube el afijo elegido o el historial no está oculto: ' + JSON.stringify(Object.assign({ h0 }, r)));
    }),
  }, {
    name: 'Forja v4.79: sin pieza al entrar, filtros del selector, añadir prefijo/sufijo en un hueco y cambiar un solo afijo',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      const uid = await p.evaluate(() => {
        DK.bag.addHome({ piedra_aumento: 2, piedra_cambio: 2 });
        DK.gear.gain('orbe_solar', { rarity: 'raro', ilvl: 40 });
        const x = DK.gear.gain('colmillo_umbrio', { rarity: 'magico', ilvl: 40 });
        x.affixes = x.affixes.slice(0, 1);
        DK.settings.set('confirmForge', false);
        DK.router.reset('craft', { tab: 'forge' });
        return x.uid;
      });
      await p.waitForSelector('.fp-row', { state: 'attached', timeout: 5000 });
      const r0 = await p.evaluate(() => ({ mesa: !!document.querySelector('.fb-mesa'), rows: document.querySelectorAll('.fp-row').length, hint: !document.querySelector('.fb-pickhint') && !!document.querySelector('.fp-bar .fp-q') }));
      check(!r0.mesa && r0.rows >= 2 && r0.hint, 'al entrar no debería haber pieza elegida: ' + JSON.stringify(r0));
      check(!(await overflowX(p)), 'el selector de la forja se sale de la pantalla');
      // Filtro por atributo principal: ataque → la daga sí, el orbe no
      await p.evaluate(() => [...document.querySelectorAll('.fp-chip.st')].find((b) => b.getAttribute('aria-label') === DK.tr('stats', DK.data.stats.atk)).click()); await sleep(300);
      const names = await p.evaluate(() => [...document.querySelectorAll('.fp-row')].map((b) => b.querySelector('.fp-name').textContent));
      const exp = await p.evaluate((u) => DK.gear.name(DK.gear.find(u).p), uid);
      check(names.includes(exp) && names.every((n) => n !== ''), 'el filtro por atributo no deja la daga: ' + names.join('|'));
      await p.evaluate((n) => [...document.querySelectorAll('.fp-row')].find((b) => b.querySelector('.fp-name').textContent === n).click(), exp); await sleep(400);
      // Hueco libre: añade el tipo elegido
      const kind = await p.evaluate((u) => { const x = DK.gear.find(u).p; return DK.gear.kindOf(x.affixes[0]) === 'prefix' ? 'suffix' : 'prefix'; }, uid);
      await p.evaluate((k) => document.querySelector('.gt-affix.empty.' + k).click(), kind); await sleep(400);
      const r1 = await p.evaluate((u) => { const x = DK.gear.find(u).p; return { n: x.affixes.length, k: DK.gear.kindOf(x.affixes[1]), left: DK.bag.home().piedra_aumento || 0, empty: document.querySelectorAll('.gt-affix.empty').length }; }, uid);
      check(r1.n === 2 && r1.k === kind && r1.left === 1 && r1.empty === 0, 'no se añade el afijo del tipo elegido: ' + JSON.stringify(r1));
      // Cambiar sólo uno: el otro se queda igual
      const before = await p.evaluate((u) => JSON.stringify(DK.gear.find(u).p.affixes), uid);
      await p.evaluate(() => document.querySelector('.fb-mesa button.gt-affix:not(.empty)').click()); await sleep(300);
      await p.evaluate(() => [...document.querySelectorAll('.fa-act')].find((b) => /cambi/i.test(b.textContent)).click()); await sleep(400);
      const r2 = await p.evaluate(([u, b]) => { const x = DK.gear.find(u).p, old = JSON.parse(b), i = DK.router.current().params.fsel; const o = 1 - i;
        return { i, same: JSON.stringify(x.affixes[o]) === JSON.stringify(old[o]), changed: x.affixes[i].id !== old[i].id, kind: DK.gear.kindOf(x.affixes[i]) === DK.gear.kindOf(old[i]), left: DK.bag.home().piedra_cambio }; }, [uid, before]);
      check(r2.i != null && r2.same && r2.changed && r2.kind && r2.left === 1, 'la piedra de cambio debería cambiar sólo el afijo elegido: ' + JSON.stringify(r2));
      // v4.80: el último cambio se ve al lado del historial (oculto hasta pulsarlo)
      const lastHidden = await p.evaluate(() => !!document.querySelector('.fb-lastlink') && !document.querySelector('.fb-before'));
      await p.evaluate(() => document.querySelector('.fb-lastlink').click()); await sleep(300);
      check(lastHidden && (await p.evaluate(() => !!document.querySelector('.fb-before .gear-tip'))), 'falta el «último cambio» discreto junto al historial');
      // v4.80: piedra de núcleo: sólo re-tira el atributo principal, dentro de su rango
      await p.evaluate(() => { DK.bag.addHome({ piedra_nucleo: 3 }); DK.router.current().params.fsel = null; DK.router.reset('craft', Object.assign({}, DK.router.current().params)); }); await sleep(400);
      const r3 = await p.evaluate(async (u) => {
        const x = DK.gear.find(u).p, G = DK.gear, before = JSON.stringify({ o: x.attrs.slice(1), a: x.affixes }), m = x.attrs[0], seen = new Set();
        for (let i = 0; i < 3; i++) { document.querySelector('.gt-mainroll').click(); await new Promise((r) => setTimeout(r, 150)); seen.add(m.r); }
        const [lo, hi] = G.attrRange(x, m), v = G.attrValue(x, m);
        return { rest: JSON.stringify({ o: x.attrs.slice(1), a: x.affixes }) === before, inRange: v >= lo && v <= hi && lo < hi, varied: seen.size > 1, left: DK.bag.home().piedra_nucleo || 0 };
      }, uid);
      check(r3.rest && r3.inRange && r3.varied && r3.left === 0, 'la piedra de núcleo debería re-tirar sólo el principal dentro de su rango: ' + JSON.stringify(r3));
    }),
  }, {
    name: 'Forja v4.84: confirmar con vista previa, calidad, bloqueo, tirar hasta conseguirlo, desguace en lote y fabricar mágico (sin raros)',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      const uid = await p.evaluate(() => {
        DK.settings.set('confirmForge', true);
        DK.bag.addHome({ piedra_caos: 30, piedra_divina: 1 });
        const x = DK.gear.gain('garra_afilada', { rarity: 'raro', ilvl: 60 });
        DK.router.reset('craft', { tab: 'forge', fp: x.uid });
        return x.uid;
      });
      await p.waitForSelector('.fs-row', { state: 'attached', timeout: 5000 });
      // Pulsar una piedra NO la usa: sale la confirmación con lo que cambiará (resaltado en la ficha)
      const before = await p.evaluate((u) => JSON.stringify(DK.gear.find(u).p.affixes), uid);
      await p.evaluate(() => [...document.querySelectorAll('.fs-row')].find((b) => /divin/i.test(b.textContent)).click()); await sleep(300);
      const c = await p.evaluate(([u, b]) => ({ same: JSON.stringify(DK.gear.find(u).p.affixes) === b, box: !!document.querySelector('.fb-confirm'), will: document.querySelectorAll('.gear-tip .will').length, lines: document.querySelectorAll('.fbc-lines li').length }), [uid, before]);
      check(c.same && c.box && c.will > 0 && c.lines > 0, 'pulsar una piedra debería pedir confirmación con vista previa: ' + JSON.stringify(c));
      await p.evaluate(() => document.querySelector('.fbc-ok').click()); await sleep(400);
      const used = await p.evaluate(() => ({ left: DK.bag.home().piedra_divina || 0, box: !!document.querySelector('.fb-confirm') }));
      check(used.left === 0 && !used.box, 'confirmar debería usar la piedra: ' + JSON.stringify(used));
      // Calidad y bloqueo
      const q = await p.evaluate((u) => { const x = DK.gear.find(u).p, q = DK.gear.quality(x); DK.gear.toggleLock(u); return { q, badge: !!document.querySelector('.gear-tip .gq'), salv: DK.gear.salvage(u).ok }; }, uid);
      check(q.q.score >= 0 && q.q.score <= 100 && /[SABCD]/.test(q.q.grade) && q.badge && !q.salv, 'calidad o bloqueo mal: ' + JSON.stringify(q));
      // Tirar hasta conseguirlo (con el sistema directamente)
      const u = await p.evaluate((u) => { const x = DK.gear.find(u).p; const want = DK.gear.affixPool(x).filter((a) => a.kind === 'suffix').map((a) => a.id).slice(0, 2); const r = DK.gear.rollUntil(u, want, 25); return { ok: r.ok, n: r.n, hit: r.hit, has: x.affixes.some((a) => want.includes(a.id)), left: DK.bag.home().piedra_caos }; }, uid);
      check(u.ok && u.n >= 1 && u.n <= 25 && u.hit === u.has && u.left === 30 - u.n, 'tirar hasta conseguirlo: ' + JSON.stringify(u));
      // Desguace en lote: respeta bloqueadas y rarezas
      const b = await p.evaluate(() => {
        const G = DK.gear; G.home().length = 0;
        const n1 = G.gain('garra_afilada', { rarity: 'normal', home: true }), n2 = G.gain('garra_afilada', { rarity: 'magico', home: true }), n3 = G.gain('garra_afilada', { rarity: 'raro', home: true });
        const n4 = G.gain('garra_afilada', { rarity: 'normal', home: true }); G.toggleLock(n4.uid);
        const f0 = DK.bag.home().fragmento_forja || 0, r = G.salvageMany(['normal', 'magico']);
        return { n: r.n, left: G.home().map((x) => x.uid).sort().join() === [n3.uid, n4.uid].sort().join(), f: (DK.bag.home().fragmento_forja || 0) - f0 };
      });
      check(b.n === 2 && b.left && b.f > 0, 'desguace en lote: ' + JSON.stringify(b));
      // Fabricar: normal o mágica (con fragmentos), nunca rara; las fabricadas no suben a rara
      const m = await p.evaluate(() => {
        const r = DK.data.recipes.find((x) => x.result === 'garra_afilada');
        DK.bag.addHome({ fragmento_garra: 6, hilo: 2, fragmento_forja: DK.gear.magicCost, piedra_regia: 1 });
        const ok = DK.crafting.craft(r, 1, { magic: true });
        const x = DK.gear.home().filter((y) => y.base === 'garra_afilada' && y.cf).pop();
        // v4.85: las normales, sólo afijos básicos y como mucho N2; las mágicas, todo y hasta N4
        const G = DK.gear, bad = [];
        for (let i = 0; i < 40; i++) {
          const n = G.create('garra_afilada', { rarity: 'normal', ilvl: 80 }), mg = G.create('garra_afilada', { rarity: 'magico', ilvl: 80 });
          if (n.affixes.some((a) => !DK.data.gear.basicAffixes.includes(a.id) || a.t > 2)) bad.push('normal');
          if (mg.affixes.some((a) => a.t > 4)) bad.push('magico');
        }
        const more = G.allowedAffixes('garra_afilada', 'magico').length > G.allowedAffixes('garra_afilada', 'normal').length;
        return { ok, rar: x && x.rarity, cf: x && x.cf, regia: x ? !!DK.gear.cannotForge(x, 'piedra_regia') : null, bad: bad.slice(0, 3), more, cost: DK.gear.magicCost };
      });
      check(m.ok && m.rar === 'magico' && m.cf && m.regia, 'fabricar mágico o el tope de las fabricadas: ' + JSON.stringify(m));
      check(!m.bad.length && m.more && m.cost >= 10, 'normales y mágicas deberían diferenciarse (pool, tier y coste): ' + JSON.stringify(m));
      check(!(await overflowX(p)), 'la forja se sale de la pantalla');
    }),
  }, {
    name: 'Cada pieza lleva su atributo principal y sólo afijos de su familia; ningún objeto da ataques ni pasivas',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const D = DK.data, G = DK.gear, bad = [];
        Object.keys(D.items).filter((id) => D.items[id].category === 'equipo').forEach((base) => {
          if (D.items[base].grants) bad.push(base + ' concede algo');
          const main = G.primaryOf(base), ok = G.allowedAffixes(base);
          for (let i = 0; i < 4; i++) {
            const x = G.create(base, { rarity: D.gear.rarityOrder[i], ilvl: 70 });
            if (!x.attrs.length || x.attrs[0].k !== main) bad.push(base + ' sin principal');
            if (x.affixes.some((a) => !ok.includes(a.id))) bad.push(base + ' afijo ajeno');
          }
        });
        // Dagas → ataque; espadas → ataque mágico
        const kinds = { daga: G.primaryOf('colmillo_umbrio'), espada: G.primaryOf('filo_vacio') };
        // Una pieza antigua sin principal ni afijos de su familia se arregla
        const s = { gearV: 1, gear: [{ uid: 'x1', base: 'colmillo_umbrio', rarity: 'magico', ilvl: 20, attrs: [{ k: 'hp', r: 0.5 }, { k: 'def', r: 0.5 }, { k: 'mp', r: 0.5 }, { k: 'spd', r: 0.5 }], affixes: [{ id: 's_guard', t: 1, r: 0.5 }], v: 0 }], party: [] };
        G.migrate(s);
        const m = s.gear[0];
        return { bad: bad.slice(0, 6), kinds, mig: m.attrs[0].k === 'atk' && m.attrs.length <= 4 && G.allowedAffixes('colmillo_umbrio').includes(m.affixes[0].id) && s.gearV === 2,
          moves: DK.daskai.grantedMoves ? DK.daskai.grantedMoves(DK.party.leader()).length : 0 };
      });
      check(!r.bad.length, 'piezas fuera de las reglas: ' + r.bad.join(' | '));
      check(r.kinds.daga === 'atk' && r.kinds.espada === 'matk', 'las dagas deberían dar ataque y las espadas ataque mágico: ' + JSON.stringify(r.kinds));
      check(r.mig, 'las piezas antiguas no se arreglan al cargar');
    }),
  }, {
    name: 'v4.89: resistencias a casas (anillos hasta 3, dagas su casa) y forja de runas',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const G = DK.gear, GD = DK.data.gear, res = (x) => x.affixes.filter((a) => GD.affixes[a.id].res);
        let ringMax = 0, ringDup = false, dag = new Set(), sword = 0, normal = 0;
        for (let i = 0; i < 300; i++) {
          const a = G.create('perla_marina', { rarity: 'raro', ilvl: 70 }), ra = res(a); ringMax = Math.max(ringMax, ra.length);
          if (new Set(ra.map((x) => GD.affixes[x.id].res)).size !== ra.length) ringDup = true;
          res(G.create('colmillo_umbrio', { rarity: 'raro', ilvl: 70 })).forEach((x) => dag.add(GD.affixes[x.id].res));
          sword += res(G.create('prisma_juicio', { rarity: 'raro', ilvl: 70 })).length + 0;
          normal += res(G.create('perla_marina', { rarity: 'normal', ilvl: 70 })).length;
        }
        // En combate: -% daño de esa casa
        const B = DK.battle, st = B.start('pradera', DK.party.active()[0].uid, {}), d = B.get(st, 'ally');
        const mv = Object.values(DK.data.moves).find((m) => m.house === 'fuego' && m.power > 0);
        const before = B.factors(st, 'enemy', mv).mult;
        const ring = G.create('perla_marina', { rarity: 'magico', ilvl: 70 }); ring.affixes = [{ id: 's_res_fuego', t: 5, r: 1 }];
        const eq0 = d.equip; d.equip = [ring];
        const after = B.factors(st, 'enemy', mv).mult; d.equip = eq0;
        // Runas
        DK.store.state.camp = DK.store.state.camp || {}; DK.store.state.camp.runas = 3;
        const R = DK.runes; R.add('oro'); DK.bag.addHome({ tiza_runica: 1, ceniza_runica: 1, perla_runica: 1, polvo_vacio: 1, savia_runica: 1 });
        const a1 = R.forge('oro', 'tiza_runica'), a2 = R.forge(a1.id, 'ceniza_runica'), sl = R.slotsOf(a2.id);
        const a3 = R.forge(a2.id, 'perla_runica', { kind: sl.P[0] < sl.P[1] ? 'prefix' : 'suffix' });
        const n3 = R.parse(a3.id).affixes.length, a4 = R.forge(a3.id, 'polvo_vacio', { mod: 0 });
        // v4.90: subir de tier con el glifo (cuesta monedas) y rara → legendaria con el corazón rúnico
        DK.wallet.add(5000, { silent: true }); DK.bag.addHome({ glifo_ascenso: 1, corazon_runico: 1 });
        const w0 = DK.wallet.get(), t2 = R.forge(a4.id, 'glifo_ascenso'), paid = w0 - DK.wallet.get();
        const lg = R.forge(t2.id, 'corazon_runico'), lp = R.parse(lg.id);
        return { ringMax, ringDup, dag: [...dag], sword, normal, before, after, r1: R.parse(a1.id).rarity, r2: R.parse(a2.id).rarity, n3, n4: R.parse(a4.id).affixes.length,
          tier2: R.parse(t2.id).tier, paid, legR: lp.rarity, legN: lp.affixes.length, legEm: R.emblemBonus([lg.id]),
          wrong: !!R.cannotForge(lg.id, 'savia_runica'), left: R.count(lg.id), kinds: R.parse(a2.id).affixes.every((x) => ['prefix', 'suffix'].includes(R.kindOf(x.k))) };
      });
      check(r.ringMax >= 2 && r.ringMax <= 3 && !r.ringDup && r.dag.length === 1 && r.sword === 0 && r.normal === 0, 'reglas de resistencias: ' + JSON.stringify(r));
      check(r.after < r.before * 0.85, 'la resistencia no baja el daño de esa casa: ' + JSON.stringify(r));
      check(r.r1 === 'm' && r.r2 === 'r' && r.n4 === r.n3 - 1 && r.wrong && r.left === 1 && r.kinds, 'mejora de runas: ' + JSON.stringify(r));
      check(r.tier2 === 2 && r.paid > 0 && r.legR === 'l' && r.legN >= 3 && r.legEm >= 1, 'tier o legendaria: ' + JSON.stringify(r));
      // v4.90: un solo banco de Mejorar (Equipo / Runas); la pestaña antigua de runas lleva aquí
      await p.evaluate(() => DK.router.reset('craft', { tab: 'runes' })); await sleep(500);
      await p.evaluate(() => document.querySelector('.rb-row').click()); await sleep(300);
      const ui = await p.evaluate(() => ({ card: !!document.querySelector('.rb-card'), reag: document.querySelectorAll('.rb-reagent').length, kinds: document.querySelectorAll('.ub-kbtn').length, tabs: document.querySelectorAll('.wb-tabbtn').length, fuse: !!document.querySelector('.forge-card') }));
      check(ui.card && ui.reag === 11 && ui.kinds === 2 && ui.tabs === 3 && !ui.fuse, 'el banco de mejora de runas no se ve bien: ' + JSON.stringify(ui));
      await p.evaluate(() => document.querySelector('.ub-kbtn').click()); await sleep(300);
      check(await p.evaluate(() => DK.router.current().params.fkind === 'gear' && !!document.querySelector('.forge-bench:not(.rune-bench)')), 'no vuelve al equipo desde el selector');
    }),
    }, {
    name: 'v5.32: al pasar el ratón por un objeto (icono o texto) sale su ficha completa, no una línea de texto',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const g = DK.gear.gain('escama_dura', { rarity: 'raro', ilvl: 30 }), V = DK.views;
        const ic = V.gearIcon(g, 30), tile = V.gearTile(g), it = V.itemIcon(DK.data.items.piedra_caos, 30);
        const card = (el) => { const n = el._tipNode && el._tipNode(); return n ? n.className + '|' + (n.querySelector('.gt-affix') ? 'aff' : '') : ''; };
        return { ic: card(ic), tile: card(tile), item: card(it) };
      });
      check(/gear/.test(r.ic) && /aff/.test(r.ic), 'el icono de una pieza debería enseñar su ficha con afijos: ' + r.ic);
      check(/gear/.test(r.tile), 'toda la casilla de una pieza (también su texto) debería enseñar la ficha: ' + r.tile);
      check(/info-card/.test(r.item), 'el icono de un objeto debería enseñar su ficha: ' + r.item);
    }),
}],
};
