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
        const sent = await DK.online.setPublish(true), body = (calls.find((c) => c[0].includes('submit_averno')) || [])[1]; // (v5.39: antes va el perfil)
        const rows = await DK.online.board(10);
        const boardUrl = calls[calls.length - 1][0], season = DK.online.season();
        // un récord pendiente de otra temporada ya no se pregunta ni se envía
        const me = DK.online.me(); me.publish = null; me.pending = { season: season - 1, p_floors: 5, p_maps: 0, p_level: 90, p_team: [] };
        const oldAsk = DK.online.shouldAsk(), n0 = calls.length; await DK.online.setPublish(true); const oldSent = calls.slice(n0).filter((c) => c[0].includes('submit_averno')).length;
        DK.config.online = real; DK.online.fetch = null;
        return { off, pend, ask, callsBefore, sent, floors: body && body.p_floors, secret: body && body.p_secret.length, rows: rows.length, seasonQ: boardUrl.includes('season=eq.' + season), noSeasonInBody: !('season' in body), oldAsk, oldSent };
      });
      check(!r.off.enabled && r.off.sent === null, 'sin configurar no debería enviar nada');
      check(r.pend === 'pending' && r.ask && r.callsBefore === 0, 'antes de decidir, el récord queda pendiente y se pregunta');
      check(r.seasonQ && r.noSeasonInBody && !r.oldAsk && r.oldSent === 0, 'la tabla es de la temporada actual y lo pendiente de otra temporada no se envía: ' + JSON.stringify(r));
      check(r.sent === 'new' && r.floors === 40 && r.secret >= 32 && r.rows === 1, 'al aceptar publicar se envía el récord pendiente con su secreto: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.39: clasificaciones, perfil público, amigos, regalo de una sola vez y partida editada a mano',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const real = DK.config.online; DK.config.online = { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' };
        // base de datos falsa: «AMIGO1» existe y ya me ha añadido; le debo un regalo
        const db = { players: { AMIGO1: { trainer_id: 'AMIGO1', name: 'Ana', title: 'Exploradora', avatar: {}, fav: null, team: [], records: { averno: 12, depth: 4 }, playtime: 7200 } }, mine: [], scores: [], took: {}, sent: [] };
        const calls = [];
        DK.online.fetch = async (url, o) => {
          const b = o && o.body ? JSON.parse(o.body) : null; calls.push([url, b]);
          const fn = (url.match(/rpc\/(\w+)/) || [])[1];
          let out;
          if (fn === 'profile_save') { db.me = b.p_tid; db.players[b.p_tid] = { trainer_id: b.p_tid, name: b.p_name, team: b.p_team, records: b.p_records, avatar: b.p_avatar }; out = 'new'; }
          else if (fn === 'submit_score') { db.scores.push(b); out = 'new'; }
          else if (fn === 'friend_add') out = db.players[b.p_tid] && b.p_tid !== db.me ? (db.mine.push(b.p_tid), 'ok') : 'notfound';
          else if (fn === 'friend_list') out = db.mine.map((tid) => Object.assign({}, db.players[tid], { mutual: tid === 'AMIGO1' }));
          else if (fn === 'inbox_send') { db.sent.push(b); out = db.mine.includes(b.p_to) ? 'ok' : 'notfriends'; }
          else if (fn === 'inbox_fetch') out = [{ id: 7, from_tid: 'AMIGO1', from_name: 'Ana', kind: 'gift', body: { item: 'pocion', n: 1 }, created_at: new Date().toISOString() }];
          else if (fn === 'inbox_take') { out = db.took[b.p_msg] ? 'gone' : 'claimed'; db.took[b.p_msg] = 1; }
          else if (url.includes('scores_board')) out = db.scores.map((x) => ({ board: x.p_board, period: 1, value: x.p_value, build: x.p_build, trainer_id: db.me, name: 'Yo', title: '' }));
          else if (url.includes('players_public')) { const tid = (url.match(/trainer_id=eq\.(\w+)/) || [])[1]; out = db.players[tid] ? [db.players[tid]] : []; }
          else out = [];
          return { ok: true, json: async () => out };
        };
        const me = DK.online.me(); me.publish = null; delete me.pending; delete me.pendingScores; delete me.tainted;
        // 1) un récord antes de decidir queda pendiente; al publicar se crea el perfil y se envía con el equipo
        const pend = await DK.online.submitScore('depth', 6, DK.online.buildSnap(['trebol']));
        const ask = DK.online.shouldAsk();
        await DK.online.setPublish(true);
        const order = calls.map((c) => (c[0].match(/rpc\/(\w+)/) || [])[1]).filter(Boolean);
        const sc = db.scores[0] || {};
        const rows = await DK.online.scoreBoard('depth', 10);
        const bUrl = calls[calls.length - 1][0];
        // 2) amigos y regalo (sólo se cobra una vez)
        const bad = await DK.online.addFriend('ZZZZZZ'), ok = await DK.online.addFriend('amigo1');
        const fl = await DK.online.friends();
        const gift = await DK.online.send('AMIGO1', 'gift', {});
        const pot0 = DK.bag.count('pocion'); const list = await DK.online.inbox();
        const c1 = await DK.online.claimGift(list[0]), c2 = await DK.online.claimGift(list[0]); const pot1 = DK.bag.count('pocion');
        // 3) la interfaz: pestañas, fila que abre el perfil con el equipo del récord
        DK.views.leaderboard({ board: 'depth' }); await new Promise((res) => setTimeout(res, 300));
        const tabs = document.querySelectorAll('.lb-modal .lb-tab').length, lbRows = document.querySelectorAll('.lb-modal button.lb-row').length;
        document.querySelector('.lb-modal button.lb-row').click(); await new Promise((res) => setTimeout(res, 300));
        const pp = { open: !!document.querySelector('.pp-modal'), mons: document.querySelectorAll('.pp-modal .bv-d').length, relic: document.querySelectorAll('.pp-modal .bv-relics .chip').length };
        DK.ui.closeAll(); await new Promise((res) => setTimeout(res, 200));
        DK.views.friendsDialog(); await new Promise((res) => setTimeout(res, 300));
        const fr = { rows: document.querySelectorAll('.mb-modal .mb-item').length, id: (document.querySelector('.mb-modal .mb-id b') || {}).textContent };
        DK.ui.closeAll();
        // 4) una partida editada a mano (no coincide la firma) deja de publicar
        DK.store.save(); DK.store.flush(); const s = DK.store.state; const sigOk = s._sig === DK.online.sign(s);
        s.coins += 999999; const sigBad = s._sig !== DK.online.sign(s);
        DK.emit('game:loaded'); const tainted = DK.online.tainted(), n0 = calls.length, after = await DK.online.submitScore('depth', 50);
        const noSend = calls.length === n0;
        delete me.tainted; DK.config.online = real; DK.online.fetch = null;
        return { pend, ask, order, board: sc.p_board, value: sc.p_value, relics: sc.p_build && sc.p_build.relics, team: sc.p_build && sc.p_build.team.length, gear: sc.p_build && sc.p_build.team[0] && Array.isArray(sc.p_build.team[0].gear),
          rows: rows.length, bUrl, bad, ok, mutual: fl[0] && fl[0].mutual, gift, c1, c2, pot: pot1 - pot0, tabs, lbRows, pp, fr, myId: DK.trainer.id(), sigOk, sigBad, tainted, after, noSend };
      });
      check(r.pend === 'pending' && r.ask && r.order[0] === 'profile_save' && r.order.includes('submit_score'), 'lo pendiente se envía al publicar, tras crear el perfil: ' + JSON.stringify(r.order));
      check(r.board === 'depth' && r.value === 6 && r.relics.join() === 'trebol' && r.team >= 1 && r.gear, 'el récord lleva el equipo completo y las reliquias: ' + JSON.stringify(r));
      check(r.rows === 1 && r.bUrl.includes('board=eq.depth') && r.bUrl.includes('period=eq.'), 'la tabla se pide por tabla y periodo: ' + r.bUrl);
      check(r.bad === 'notfound' && r.ok === 'ok' && r.mutual && r.gift === 'ok', 'amigos por ID: ' + JSON.stringify(r));
      check(r.c1 === 'claimed' && r.c2 === 'gone' && r.pot === 1, 'un regalo sólo se cobra una vez: ' + JSON.stringify(r));
      check(r.tabs === 5 && r.lbRows === 1 && r.pp.open && r.pp.mons >= 1 && r.pp.relic === 1, 'cinco pestañas y al pulsar una fila se ve el equipo con sus reliquias: ' + JSON.stringify(r));
      check(r.fr.rows === 1 && r.fr.id === '#' + r.myId, 'la ventana de amigos muestra tu ID y tus amigos: ' + JSON.stringify(r.fr));
      check(r.sigOk && r.sigBad && r.tainted && r.after === null && r.noSend, 'una partida editada a mano no publica: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.40: desafío semanal en la misma zona para todos, solicitudes de amistad y regalos del equipo y de las noticias',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        // 1) la zona del desafío no depende de lo que tengas abierto, y los rivales van a tu nivel
        const zs = []; for (let i = 0; i < 12; i++) zs.push(DK.weekly.def(Date.now() + i * 7 * 864e5).zone);
        const locked = zs.filter((z) => !DK.world.isUnlocked(z)).length;
        const lvA = DK.weekly.levelFor(DK.data.zones.cumbre.levels[0], 'cumbre', 12), lvB = DK.weekly.levelFor(DK.data.zones.pradera.levels[0], 'pradera', 12);
        const lvBoss = DK.weekly.levelFor(DK.data.zones.cumbre.levels[1] + 4, 'cumbre', 12);
        // 2) buzón con base de datos falsa
        const real = DK.config.online; DK.config.online = { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' };
        const db = { friends: { PEPE01: 'incoming' }, inbox: [{ id: 3, from_tid: 'PEPE01', from_name: 'Pepe', kind: 'friend', body: {}, created_at: new Date().toISOString() },
          { id: 4, from_tid: '@TEAM', from_name: 'Daskai', kind: 'agift', body: { text: 'Hola', gift: { items: { pocion: 4, nope: 9 }, coins: 500, emblems: 2 } }, created_at: new Date().toISOString() }], took: {}, claimed: [] };
        const news = [{ id: 9, title: 'Evento', body: 'Texto', gift: { items: { eter: 2 } }, pinned: true, created_at: new Date().toISOString() }];
        DK.online.fetch = async (url, o) => {
          const b = o && o.body ? JSON.parse(o.body) : null, fn = (url.match(/rpc\/(\w+)/) || [])[1]; let out = [];
          if (fn === 'profile_save') out = 'ok';
          else if (fn === 'friend_list') out = Object.entries(db.friends).map(([tid, st]) => ({ trainer_id: tid, name: 'Pepe', status: st, mutual: st === 'friend' }));
          else if (fn === 'friend_add') { out = db.friends[b.p_tid] === 'incoming' ? 'accepted' : 'sent'; db.friends[b.p_tid] = out === 'accepted' ? 'friend' : 'sent'; db.inbox = db.inbox.filter((m) => m.kind !== 'friend'); }
          else if (fn === 'friend_reject') { delete db.friends[b.p_tid]; out = 'ok'; }
          else if (fn === 'inbox_fetch') out = db.inbox;
          else if (fn === 'inbox_take') { out = db.took[b.p_msg] ? 'gone' : 'claimed'; db.took[b.p_msg] = 1; }
          else if (fn === 'news_claim') { out = db.claimed.includes(b.p_news) ? 'gone' : 'claimed'; db.claimed.push(b.p_news); }
          else if (fn === 'news_claimed') out = db.claimed;
          else if (url.includes('news_public')) out = news;
          return { ok: true, json: async () => out };
        };
        const me = DK.online.me(); me.publish = true; me.registered = true; delete me.tainted; me.inboxSeen = 0; me.newsSeen = 0;
        const unread = await DK.online.pollInbox();
        DK.views.mailbox('inbox'); await new Promise((res) => setTimeout(res, 400));
        const modal0 = document.querySelector('.mb-modal');
        const rows = { req: document.querySelectorAll('.mb-modal .mb-item.t-friend').length, gift: document.querySelectorAll('.mb-modal .mb-item.t-team').length, news: document.querySelectorAll('.mb-modal .mb-item.t-news').length };
        document.querySelector('.mb-modal .mb-item.t-team').click(); await new Promise((res) => setTimeout(res, 100));
        rows.chips = document.querySelectorAll('.mb-modal .mb-read .mb-gift').length;
        document.querySelector('.mb-modal .mb-item.t-friend').click(); await new Promise((res) => setTimeout(res, 100));
        document.querySelector('.mb-modal .mb-read .mb-acts button').click(); await new Promise((res) => setTimeout(res, 400));
        rows.same = document.querySelector('.mb-modal') === modal0 && document.querySelectorAll('.modal-backdrop').length === 1; // (sin cerrar y abrir: no parpadea)
        const status = db.friends.PEPE01;
        const pot0 = DK.bag.count('pocion'), eter0 = DK.bag.count('eter'), coins0 = DK.store.state.coins;
        const g = db.inbox.find((m) => m.kind === 'agift'); const c1 = await DK.online.claimGift(g), c2 = await DK.online.claimGift(g);
        const n1 = await DK.online.claimNews(news[0]), n2 = await DK.online.claimNews(news[0]);
        const got = { pot: DK.bag.count('pocion') - pot0, eter: DK.bag.count('eter') - eter0, coins: DK.store.state.coins - coins0 };
        DK.ui.closeAll(); DK.config.online = real; DK.online.fetch = null;
        const mailBtn = !!document.querySelector('.topbar-mail');
        return { zs, locked, lvA, lvB, lvBoss, unread, rows, status, c1, c2, n1: Array.isArray(n1) ? n1.length : n1, n2, got, mailBtn };
      });
      check(new Set(r.zs).size >= 2 && r.locked > 0 && r.lvA === r.lvB && r.lvA === 10 && r.lvBoss > 15, 'el desafío puede tocar zonas aún cerradas y los rivales van al nivel de tu equipo: ' + JSON.stringify(r));
      check(r.unread === 3 && r.rows.req === 1 && r.rows.gift === 1 && r.rows.news === 1 && r.rows.chips === 3 && r.rows.same, 'el buzón muestra la solicitud, el regalo del equipo y la noticia: ' + JSON.stringify(r));
      check(r.status === 'friend', 'al aceptar la solicitud sois amigos: ' + r.status);
      check(r.c1 === 'claimed' && r.c2 === 'gone' && r.n1 === 1 && r.n2 === 'gone' && r.got.pot === 4 && r.got.eter === 2 && r.got.coins === 500, 'cada regalo se cobra una vez y sólo con objetos que existen: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.42: chat con un amigo en el buzón (se completa solo, sin redibujar) y aviso de mensajes nuevos con dk_poll',
    run: (browser, view) => play(browser, view, async (p) => {
      const r = await p.evaluate(async () => {
        const real = DK.config.online; DK.config.online = { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' };
        const my = DK.trainer.id(), dm = [{ id: 1, from_tid: 'PEPE01', body: 'Hola', created_at: new Date().toISOString() }];
        let nid = 1;
        DK.online.fetch = async (url, o) => {
          const b = o && o.body ? JSON.parse(o.body) : null, fn = (url.match(/rpc\/(\w+)/) || [])[1]; let out = [];
          if (fn === 'profile_save') out = 'ok';
          else if (fn === 'dk_poll') out = { inbox: 0, news: 0, support: 0, dm: { PEPE01: Math.max(...dm.filter((x) => x.from_tid === 'PEPE01').map((x) => x.id)) } };
          else if (fn === 'friend_list') out = [{ trainer_id: 'PEPE01', name: 'Pepe', status: 'friend', mutual: true }];
          else if (fn === 'dm_fetch') out = dm.filter((x) => x.id > (b.p_after || 0)).slice().reverse();
          else if (fn === 'dm_send') { dm.push({ id: ++nid, from_tid: my, body: b.p_text, created_at: new Date().toISOString() }); out = 'ok'; }
          else if (fn === 'dm_threads') out = [{ with_tid: 'PEPE01', name: 'Pepe', last_id: nid, last_from: 'PEPE01', last_body: 'Hola', last_at: new Date().toISOString() }];
          return { ok: true, json: async () => out };
        };
        const me = DK.online.me(); me.publish = true; me.registered = true; delete me.tainted; me.dmSeen = {}; me.inboxSeen = 0; me.newsSeen = 0;
        const unread0 = await DK.online.pollInbox();
        DK.views.composeMessage('PEPE01'); await new Promise((res) => setTimeout(res, 500));
        const box = document.querySelector('.mb-modal .mb-dm');
        const first = document.querySelectorAll('.mb-dm .mb-bubble.them').length;
        const ta = document.querySelector('.mb-dm textarea'); ta.value = '¿Qué tal?'; ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((res) => setTimeout(res, 400));
        const mine = document.querySelectorAll('.mb-dm .mb-bubble.me').length;
        dm.push({ id: ++nid, from_tid: 'PEPE01', body: '¡Bien!', created_at: new Date().toISOString() });
        await new Promise((res) => setTimeout(res, 3600));
        const after = document.querySelectorAll('.mb-dm .mb-bubble.them').length, same = document.querySelector('.mb-modal .mb-dm') === box;
        const unread1 = DK.online.unread;
        DK.ui.closeAll(); DK.config.online = real; DK.online.fetch = null;
        return { unread0, first, mine, after, same, unread1 };
      });
      check(r.unread0 === 1, 'una conversación con mensajes nuevos cuenta como pendiente: ' + JSON.stringify(r));
      check(r.first === 1 && r.mine === 1 && r.after === 2 && r.same, 'el chat muestra lo que llega y lo que envías sin redibujar la ventana: ' + JSON.stringify(r));
      check(r.unread1 === 0, 'al leer la conversación ya no hay pendientes: ' + JSON.stringify(r));
    }),
  }, {
    name: 'v5.37: intercambio por relé (base de datos): funciona aunque uno tarde en volver, con entrenador original e historial',
    run: async (browser, view) => {
      const { newGame } = require('./helpers');
      const msgs = []; let nid = 0;
      // (como jsonb de Postgres: las claves vuelven ordenadas por longitud y luego alfabéticamente)
      const jsonb = (v) => (Array.isArray(v) ? v.map(jsonb) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort((x, y) => x.length - y.length || (x < y ? -1 : 1)).map((k) => [k, jsonb(v[k])])) : v);
      const db = (path, b) => { if (path.includes('trade_send')) { msgs.push({ id: ++nid, room: b.p_room, sender: b.p_sender, body: jsonb(b.p_body) }); return nid; }
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
