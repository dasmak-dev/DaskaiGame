/* Aspecto de juego: campamento, HUD, barra de accesos, menú de pausa y cortinillas. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Campamento y carcasa',
  cases: [{
    name: 'El campamento lleva a cada sección y el muñeco está bloqueado al empezar',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('hub')); await sleep(400);
      const n = await p.$$eval('.camp-spot', (els) => els.length);
      check(n === 7, `deberían verse 7 lugares (hay ${n})`);
      check(await p.$('.camp-spot.s-dummy.locked'), 'el entrenamiento debería estar bloqueado');
      const tent = await p.$('.camp-spot.s-tent');
      if (view.touch) await tent.tap(); else await tent.click();
      await sleep(400);
      check((await p.evaluate(() => DK.router.current().id)) === 'inventory', 'la tienda debería abrir el inventario');
      check(await p.$('.game-dock .dock-slot'), 'falta la barra de accesos');
      check(!(await p.$('.side-nav .nav-item')), 'no debería quedar barra lateral');
    }),
  }, {
    name: 'Esc en el campamento abre el menú de pausa',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('hub')); await sleep(300);
      await p.keyboard.press('Escape'); await sleep(300);
      check(await p.$('.pause-menu'), 'no se abre la pausa');
      await p.keyboard.press('Escape'); await sleep(300);
      check(!(await p.$('.pause-menu')), 'Esc debería cerrar la pausa');
    }),
  }, {
    name: 'Al entrar en un mapa sale la cortinilla de la zona sin bloquear la pantalla',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.expedition.start({}); DK.router.reset('expedition'); });
      await sleep(150);
      const r = await p.evaluate(() => { const c = document.querySelector('.curtain'); return c ? { pe: getComputedStyle(c).pointerEvents, text: c.textContent } : null; });
      check(r, 'no sale la cortinilla');
      check(r.pe === 'none', 'la cortinilla no debe bloquear los clics');
      check(r.text.includes(await p.evaluate(() => DK.data.zones[DK.expedition.active().zone].name)), 'la cortinilla no lleva el nombre de la zona');
      await p.evaluate(() => DK.router.refresh()); await sleep(1100);
      check(!(await p.$('.curtain')), 'la cortinilla no desaparece o se repite al repintar');
    }),
  }, {
    name: 'Al entrar en combate, la cortinilla tapa la pantalla y el combate aparece detrás',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.settings.set('skipAnims', false); DK.router.go('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid, boss: true, final: true }); });
      await sleep(60);
      const before = await p.evaluate(() => ({ curtain: !!document.querySelector('.curtain.k-boss'), screen: DK.router.current().id }));
      check(before.curtain, 'no sale la cortinilla del jefe');
      check(before.screen !== 'battle', 'el combate no debería verse antes de tapar la pantalla');
      await sleep(600);
      check((await p.evaluate(() => DK.router.current().id)) === 'battle', 'el combate no se ha montado tras la cortinilla');
      check(await p.$('.curtain.show .curtain-card'), 'falta la cinta con el nombre del jefe');
      await sleep(1700);
      check(!(await p.$('.curtain')), 'la cortinilla no desaparece');
    }),
  }, {
    name: 'La música se pausa al minimizar el juego y vuelve al abrirlo',
    run: (browser, view) => play(browser, view, async (p) => {
      await p.mouse.click(5, 300); await sleep(300); // primera interacción: crea el audio
      await p.evaluate(() => { DK.settings.set('muted', false); DK.audio.music(null); DK.audio.music('menu'); });
      await sleep(400);
      const vis = (state) => p.evaluate((st) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st }); document.dispatchEvent(new Event('visibilitychange')); }, state);
      const before = await p.evaluate(() => DK.audio.playing());
      await vis('hidden'); await sleep(400);
      const hiddenNow = await p.evaluate(() => DK.audio.playing());
      await vis('visible'); await sleep(500);
      const after = await p.evaluate(() => DK.audio.playing());
      check(before, 'la música no estaba sonando al empezar la prueba');
      check(!hiddenNow, 'la música sigue sonando con el juego minimizado');
      check(after, 'la música no vuelve al abrir el juego');
    }),
  }, {
    name: 'Cada zona tiene su música y su fondo de jefe; en expedición suena la de la zona',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(() => {
        const zones = Object.values(DK.data.zones);
        const bossScenes = zones.map((z) => DK.scenes.bossScene(z)).filter((id) => id.startsWith('boss_')).length;
        DK.world.progress('volcan').unlocked = true;
        DK.store.state.nextExpedition = { zone: 'volcan', seed: 't', size: 'small', kind: 'normal', mod: null };
        DK.expedition.start({});
        return { bossScenes, n: zones.length, track: DK.audio.zoneTrack(), secret: DK.scenes.bossScene(zones[0], true) };
      });
      check(r.bossScenes === r.n, 'faltan fondos de jefe: ' + r.bossScenes + '/' + r.n);
      check(r.secret === 'boss_secret', 'el jefe oculto debería tener su fondo');
      check(r.track === 'volcano', 'en expedición debería sonar la música de la zona: ' + r.track);
    }),
  }, {
    name: 'v4.88: música nueva: misterio en el menú principal, variante de combate de la zona, élites, latido con poca vida y furia del jefe',
    views: ['desktop'],
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const out = { has: ['title', 'mystery', 'elite', 'danger', 'boss_rage', 'meadow:fight', 'volcano:fight'].every((n) => DK.audio.has(n)), bad: DK.audio.has('meadow:nope') };
        DK.router.reset('battle', { zone: 'pradera', leaderUid: DK.party.active()[0].uid }); await new Promise((r) => setTimeout(r, 2600));
        out.fight = DK.audio.current();
        const st = DK.router.current().params.state, a = DK.battle.ally(st);
        a.cur.hp = 1; DK.router.refresh(); await new Promise((r) => setTimeout(r, 300)); out.low = DK.audio.current();
        DK.router.reset('mainMenu'); await new Promise((r) => setTimeout(r, 300)); out.menu = DK.audio.current();
        return out;
      });
      check(r.has && !r.bad, 'faltan pistas nuevas');
      check(r.menu === 'title', 'el menú principal debería sonar con la pista de misterio: ' + r.menu);
      check(r.fight === 'meadow:fight', 'un combate normal debería usar la variante de combate de su zona: ' + r.fight);
      check(r.low === 'danger', 'con poca vida debería sonar el latido: ' + r.low);
    }),
    }, {
    name: 'v5.33: intercambio de daskai entre dos partidas (sala con código, ofertas, aceptar y cambio a la vez) y paquete saneado',
    run: async (browser, view) => {
      const { newGame } = require('./helpers');
      const A = await newGame(browser, view, { name: 'Ana', slot: 7 }), B = await newGame(browser, view, { name: 'Beto', slot: 8 });
      const pages = [A, B];
      for (const [i, p] of pages.entries()) {
        await p.exposeFunction('__relaySend', (m) => { pages[1 - i].evaluate((m) => window.__relayRecv && window.__relayRecv(m), m).catch(() => {}); });
        await p.evaluate(() => DK.trade.useTransport((h) => {
          window.__relayRecv = (m) => { if (m === '__open') return h.open(); if (m === '__close') return h.closed(); h.message(m); };
          return { async host(c) { h.ready(c); }, async join(c) { h.ready(c); window.__relaySend('__open'); setTimeout(() => h.open(), 50); }, send(m) { window.__relaySend(m); }, close() { window.__relaySend('__close'); } };
        }));
      }
      await A.evaluate(() => { const d = DK.party.all()[0]; d.level = 33; d.nickname = 'Chispi'; const g = DK.gear.gain('escama_dura', { rarity: 'raro', ilvl: 30 }); DK.gear.equip(d, 0, g.uid); DK.views.tradeDialog(); DK.trade.host(); });
      await sleep(200);
      const code = await A.evaluate(() => DK.trade.session.code);
      await B.evaluate((c) => { DK.views.tradeDialog(); DK.trade.join(c); }, code); await sleep(400);
      await A.evaluate(() => DK.trade.offer(DK.party.all()[0].uid)); await B.evaluate(() => DK.trade.offer(DK.party.all()[0].uid)); await sleep(300);
      const half = await A.evaluate(() => { DK.trade.lock(); return DK.trade.session.status; });
      await sleep(200);
      const notYet = await B.evaluate(() => DK.party.all()[0].level);
      await B.evaluate(() => DK.trade.lock()); await sleep(500);
      const a = await A.evaluate(() => ({ st: DK.trade.session.status, lv: DK.party.all().map((d) => d.level), gear: DK.gear.home().length, team: DK.store.state.team.length }));
      const b = await B.evaluate(() => ({ st: DK.trade.session.status, d: DK.party.all().map((d) => [d.level, d.nickname, (d.equip || []).filter(Boolean).length]) }));
      // un paquete manipulado se sanea (nivel, genes, movimientos y nombre)
      const bad = await B.evaluate(() => { const d = DK.trade.importD({ species: Object.keys(DK.data.species)[0], level: 9999, genes: { atk: 50 }, moves: ['nope', '<b>'], nickname: '<script>x</script>'.repeat(5), growth: { atk: 1e9 } });
        return { lv: d.level, gene: d.genes.atk, moves: d.moves.length > 0 && d.moves.every((m) => DK.data.moves[m]), nick: d.nickname, atk: d.growth.atk, none: DK.trade.importD({ species: 'nope' }) }; });
      await A.context().close(); await B.context().close();
      check(code.length === 6 && half === 'open' && notYet === 5, 'la sala tiene código y nada cambia hasta que aceptan los dos');
      check(a.st === 'done' && b.st === 'done', 'el intercambio debería terminar en las dos partidas: ' + JSON.stringify([a, b]));
      check(a.lv.join() === '5' && b.d[0][0] === 33 && b.d[0][1] === 'Chispi', 'cada uno debería tener el daskai del otro: ' + JSON.stringify([a, b]));
      check(a.gear === 1 && b.d[0][2] === 0 && a.team === 1, 'el equipo de la pieza se queda en casa y el nuevo entra en el equipo');
      check(bad.lv === 100 && bad.gene <= 0.1 && bad.moves && !/[<>]/.test(bad.nick) && bad.nick.length <= 24 && bad.atk < 1e9 && bad.none === null, 'un paquete manipulado debería sanearse: ' + JSON.stringify(bad));
    },
  }, {
    name: 'v5.33: tabla global (sin configurar no envía nada; configurada pregunta antes de publicar y envía el récord)',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const real = DK.config.online; DK.config.online = { supabaseUrl: '', supabaseKey: '' }; // (las pruebas no tocan la tabla de verdad)
        const off = { enabled: DK.online.enabled(), sent: await DK.online.submitAverno({ floors: 10, maps: 1, level: 93 }) };
        DK.config.online = { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' };
        const calls = []; DK.online.fetch = async (url, o) => { calls.push([url, o.body ? JSON.parse(o.body) : null]); return { ok: true, json: async () => (url.includes('rpc') ? 'new' : [{ player_id: 'a', name: 'X', floors: 50, maps: 5, level: 105, team: [] }]) }; };
        const pend = await DK.online.submitAverno({ floors: 40, maps: 4, level: 102 }), ask = DK.online.shouldAsk(), callsBefore = calls.length;
        const sent = await DK.online.setPublish(true), body = calls[0] && calls[0][1];
        const rows = await DK.online.board(10);
        const boardUrl = calls[calls.length - 1][0], season = DK.online.season();
        // un récord pendiente de otra temporada ya no se pregunta ni se envía
        const me = DK.online.me(); me.publish = null; me.pending = { season: season - 1, p_floors: 5, p_maps: 0, p_level: 90, p_team: [] };
        const oldAsk = DK.online.shouldAsk(), n0 = calls.length; await DK.online.setPublish(true); const oldSent = calls.length - n0;
        DK.config.online = real; DK.online.fetch = null;
        return { off, pend, ask, callsBefore, sent, floors: body && body.p_floors, secret: body && body.p_secret.length, rows: rows.length, seasonQ: boardUrl.includes('season=eq.' + season), noSeasonInBody: !('season' in body), oldAsk, oldSent };
      });
      check(!r.off.enabled && r.off.sent === null, 'sin configurar no debería enviar nada');
      check(r.pend === 'pending' && r.ask && r.callsBefore === 0, 'antes de decidir, el récord queda pendiente y se pregunta');
      check(r.seasonQ && r.noSeasonInBody && !r.oldAsk && r.oldSent === 0, 'la tabla es de la temporada actual y lo pendiente de otra temporada no se envía: ' + JSON.stringify(r));
      check(r.sent === 'new' && r.floors === 40 && r.secret >= 32 && r.rows === 1, 'al aceptar publicar se envía el récord pendiente con su secreto: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.37: intercambio por relé (base de datos): funciona aunque uno tarde en volver, con entrenador original e historial',
    run: async (browser, view) => {
      const { newGame } = require('./helpers');
      const msgs = []; let nid = 0;
      const db = (path, b) => { if (path.includes('trade_send')) { msgs.push({ id: ++nid, room: b.p_room, sender: b.p_sender, body: b.p_body }); return nid; }
        if (path.includes('trade_poll')) return msgs.filter((m) => m.room === b.p_room && m.id > (b.p_after || 0)).map(({ id, sender, body }) => ({ id, sender, body })); return []; };
      const A = await newGame(browser, view, { name: 'Ana', slot: 7 }), B = await newGame(browser, view, { name: 'Beto', slot: 8 });
      for (const p of [A, B]) { await p.exposeFunction('__db', db); await p.evaluate(() => { DK.trade.useTransport(null); DK.online.fetch = async (url, o) => ({ ok: true, json: async () => window.__db(url, o.body ? JSON.parse(o.body) : null) }); }); }
      const ids = await Promise.all([A, B].map((p) => p.evaluate(() => ({ tid: DK.trainer.id(), ot: DK.party.all()[0].ot && DK.party.all()[0].ot.id }))));
      await A.evaluate(() => { DK.party.all()[0].level = 30; DK.views.tradeDialog(); DK.trade.host(); }); await sleep(300);
      const code = await A.evaluate(() => DK.trade.session.code);
      await B.evaluate((c) => { DK.views.tradeDialog(); DK.trade.join(c); }, code); await sleep(3500);
      const open = await Promise.all([A, B].map((p) => p.evaluate(() => [DK.trade.session.status, !!DK.trade.session.tx.relay])));
      await A.evaluate(() => DK.trade.offer(DK.party.all()[0].uid)); await B.evaluate(() => DK.trade.offer(DK.party.all()[0].uid)); await sleep(2600);
      await A.evaluate(() => DK.trade.lock()); await B.evaluate(() => DK.trade.lock()); await sleep(4000);
      const r = await Promise.all([A, B].map((p) => p.evaluate(() => { const d = DK.party.all()[0]; return { st: DK.trade.session.status, lv: d.level, ot: d.ot, mine: DK.trainer.isMine(d), log: (DK.store.state.tradeLog || []).length, panel: (() => { const el = DK.views.daskaiPanel(d, {}); return !!el.querySelector('.badge.ot.other'); })() }; })));
      await A.context().close(); await B.context().close();
      check(ids.every((x) => /^[A-Z0-9]{6}$/.test(x.tid) && x.ot === x.tid), 'cada partida tiene su ID de entrenador y sus daskai lo llevan: ' + JSON.stringify(ids));
      check(open.every((x) => x[0] === 'open' && x[1]), 'los dos deberían conectarse por el relé: ' + JSON.stringify(open));
      check(r[0].st === 'done' && r[1].st === 'done' && r[1].lv === 30 && r[0].lv === 5, 'el intercambio por relé debería completarse: ' + JSON.stringify(r));
      check(r[1].ot && r[1].ot.name === 'Ana' && r[1].ot.id === ids[0].tid && !r[1].mine && r[1].panel, 'el recibido conserva su entrenador original y se marca: ' + JSON.stringify(r[1]));
      check(r[0].log === 1 && r[1].log === 1, 'queda en el historial de intercambios');
    },
}],
};
