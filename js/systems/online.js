/* =============================================================
 * systems/online.js — v5.33: tabla de puntuaciones global (Supabase, sin servidor propio).
 *
 * Guarda el récord de cada jugador en el Averno (pisos, jefes, nivel de los rivales y su equipo) en una base
 * de datos gratuita de Supabase. Se configura en DK.config.online (supabaseUrl + supabaseKey, la clave PÚBLICA
 * «anon»); sin configurar, la tabla dice que no está disponible y no se envía nada.
 *
 * Seguridad: nadie escribe en la tabla directamente. Se llama a la función submit_averno(), que comprueba los
 * valores, sólo sube el récord si es mejor y exige el «secreto» de ese jugador (se guarda en su partida). La
 * tabla se lee por una vista sin el secreto. El SQL para crearlo está en docs/ONLINE-SUPABASE.md.
 *
 *   DK.online.enabled()             → ¿configurado?
 *   DK.online.me()                  → { id, secret, publish, pending } (state.online)
 *   DK.online.submitAverno(rec)     → envía un récord (o lo deja pendiente si aún no has dicho si publicar)
 *   DK.online.setPublish(on)        → decide publicar (y envía lo pendiente)
 *   DK.online.board(limit)          → Promise<[{ player_id, name, floors, maps, level, team, version, updated_at }]>
 * ============================================================= */
(function () {
  const st = () => DK.store.state;
  const cfg = () => DK.config.online || {};
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const secret = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); };

  async function call(path, { method = 'GET', body = null } = {}) {
    const c = cfg(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    try {
      const res = await (DK.online.fetch || fetch)(c.supabaseUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/' + path, {
        method, signal: ctl.signal, body: body ? JSON.stringify(body) : null,
        // v5.33.1: las claves nuevas (sb_publishable_…) van sólo en «apikey»; las antiguas «anon» (JWT), también como Bearer
        headers: Object.assign({ apikey: c.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' }, /^sb_/.test(c.supabaseKey) ? {} : { Authorization: 'Bearer ' + c.supabaseKey }),
      });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally { clearTimeout(to); }
  }

  /** v5.34: temporada actual (la misma que la de la Senda: data/endgame.js → seasons) y días que le quedan. */
  const SEA = () => DK.data.endgame.seasons, DAY = 86400000;
  const t0 = () => new Date(SEA().start + 'T00:00:00').getTime();
  const seasonNow = () => Math.max(1, 1 + Math.floor((Date.now() - t0()) / (SEA().days * DAY)));

  /** Huella corta (FNV-1a) para la firma de la partida. */
  const fnv = (x) => { let h = 0x811c9dc5; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  /**
   * v5.39: firma de la partida. Al guardar se firman los datos que cuentan para las tablas; si al cargar no
   * coinciden (alguien ha editado la partida a mano), esa partida deja de enviar récords (state.online.tainted).
   */
  const SALT = 'dk-online-5.39';
  function sigOf(s) {
    if (!s) return '';
    const S = s.stats || {}, lv = (s.party || []).reduce((a, d) => a + (d.level | 0), 0);
    const ab = s.abyss || {}, av = s.averno || {}, wk = Object.entries(s.weekly || {}).map(([k, v]) => k + ':' + ((v && v.best) | 0)).sort().join(',');
    return fnv(SALT + [S.bestDepth | 0, S.shinies | 0, S.playTime | 0, ab.best | 0, (av.best && av.best.floors) | 0, wk, lv, (s.party || []).length, s.coins | 0].join('|'));
  }
  /** ¿Datos imposibles? (niveles por encima del máximo, crecimiento absurdo…) */
  function impossible(s) {
    const C = DK.config;
    return (s.party || []).some((d) => (d.level | 0) > C.maxLevel || Object.values(d.growth || {}).some((v) => v > (d.level | 0) * 12 + 5));
  }

  DK.online = {
    fetch: null, // (las pruebas ponen aquí un fetch falso)
    /** v5.37: llamada a una función de la base de datos (la usa el intercambio por relé) */
    rpc(name, body) { return call('rpc/' + name, { method: 'POST', body: body || {} }); },
    get(path) { return call(path); },
    /** v5.34: la tabla es por temporada: al empezar una nueva queda vacía (las anteriores se guardan) */
    season() { return seasonNow(); },
    daysLeft() { return Math.max(0, Math.ceil((t0() + seasonNow() * SEA().days * DAY - Date.now()) / DAY)); },
    week() { return DK.weekly ? DK.weekly.weekNo() : 1; },
    enabled() { const c = cfg(); return !!(c.supabaseUrl && c.supabaseKey); },
    me() {
      const s = st(); if (!s) return null;
      s.online = s.online || {};
      if (!s.online.id) { s.online.id = uuid(); s.online.secret = secret(); DK.store.save(); }
      if (s.online.publish === undefined) s.online.publish = null; // null = aún no lo has decidido
      return s.online;
    },
    /** v5.39: ¿puede enviar? (configurado, perfil público activado y partida sin manipular) */
    ready() { const me = this.enabled() ? this.me() : null; return !!(me && me.publish === true && !me.tainted); },
    tainted() { const me = this.me(); return !!(me && me.tainted); },
    sign(s) { return sigOf(s); },

    /* ---------- Instantánea del equipo (para la tabla y el perfil) ---------- */
    /** Un daskai con lo necesario para dibujarlo y ver cómo está montado. */
    snapD(d) {
      const s = DK.daskai.stats(d), eq = (d.equip || []).filter((p) => p && typeof p === 'object');
      return {
        s: d.species, l: d.level, sh: d.shiny ? 1 : 0, n: DK.daskai.name(d).slice(0, 24), lk: d.look || null, h2: d.house2 || null, f: d.form || 0, fs: d.forms || 0,
        st: { hp: s.hp, mp: s.mp, atk: s.atk, matk: s.matk, def: s.def, mdef: s.mdef, spd: s.spd },
        nat: d.nature, pas: d.passive, role: d.role || null, mv: (d.moves || []).slice(0, 6), tal: Object.values(d.talents || {}).slice(0, 12), stars: d.stars || 0, v: d.variant || null,
        gear: eq.map((p) => ({ n: DK.gear.name(p).slice(0, 40), r: p.rarity, b: p.base, i: p.ilvl, a: (p.affixes || []).slice(0, 8).map((a) => { try { return DK.gear.affixText(a).slice(0, 60); } catch (e) { return ''; } }).filter(Boolean) })),
        ot: d.ot ? d.ot.id : null,
      };
    },
    /** Equipo activo (y reliquias, si las hay) */
    buildSnap(relics) { return { team: DK.party.active().slice(0, 6).map((d) => this.snapD(d)), relics: (relics || []).slice(0, 40) }; },
    /** Equipo para la tabla del Averno (compatible: especie, nivel y variocolor + el resto) */
    teamSnap() { return this.buildSnap().team; },
    /** Récords de la partida para el perfil público. */
    records() {
      const s = st() || {}, S = s.stats || {};
      return {
        averno: (s.averno && s.averno.best && s.averno.best.floors) || 0, avernoLv: (s.averno && s.averno.best && s.averno.best.level) || 0,
        depth: S.bestDepth || 0, abyss: (s.abyss && s.abyss.best) || 0, shinies: S.shinies || 0, weekly: DK.weekly ? DK.weekly.best() : 0,
        battles: S.battles || 0, captures: S.captures || 0, daskai: (s.party || []).length, trades: S.trades || 0,
        achievements: Object.keys(s.achievements || {}).length, maxLv: Math.max(0, ...(s.party || []).map((d) => d.level | 0)),
      };
    },

    /**
     * v5.40: lo que sólo ve el admin en su panel: todos tus daskai (especie, nivel, variocolor, mote, estrellas),
     * monedas, emblemas y la bolsa de casa. No sale en el perfil público.
     */
    privateSnap() {
      const s = st() || {}, bag = {};
      Object.entries(DK.bag.home() || {}).forEach(([id, n]) => { if (n > 0 && Object.keys(bag).length < 400) bag[id] = n | 0; });
      return { box: (s.party || []).slice(0, 2500).map((d) => [d.species, d.level | 0, d.shiny ? 1 : 0, d.nickname ? String(d.nickname).slice(0, 16) : '', d.stars | 0]),
        team: DK.party.active().map((d) => d.uid), coins: s.coins | 0, emblems: s.emblems | 0, bag, slot: DK.store.slot | 0, lang: DK.i18n.lang };
    },

    /* ---------- Perfil público ---------- */
    async saveProfile(force = false) {
      if (!this.ready()) return null;
      const me = this.me(), s = st();
      if (!force && me.profileAt && Date.now() - me.profileAt < 5 * 60000) return 'cached';
      const p = s.player || {}, mu = DK.party.mostUsed && DK.party.mostUsed(), fav = (mu && mu.d) || DK.party.leader();
      const avatar = p.avatar && p.avatar.kind !== 'image' ? { av: p.avatar, fr: p.frame || null } : { av: fav ? { kind: 'daskai', species: fav.species, shiny: !!fav.shiny } : null, fr: p.frame || null };
      const body = { p_id: me.id, p_secret: me.secret, p_tid: DK.trainer.id(), p_name: (p.name || '?').slice(0, 20), p_title: (DK.avatars && DK.avatars.titleText ? String(DK.avatars.titleText(p) || '') : '').slice(0, 40),
        p_avatar: avatar, p_fav: fav ? this.snapD(fav) : null, p_team: this.buildSnap().team, p_records: this.records(), p_playtime: (s.stats && s.stats.playTime) | 0,
        p_private: this.privateSnap(), p_version: DK.version };
      let r;
      try { r = await this.rpc('profile_save', body); }
      catch (e) { delete body.p_private; delete body.p_version; r = await this.rpc('profile_save', body); } // (base de datos de la v5.39)
      if (r === 'tid_taken') { DK.trainer.reroll(); body.p_tid = DK.trainer.id(); r = await this.rpc('profile_save', body); }
      if (r === 'new' || r === 'ok' || r === 'slow') { me.profileAt = Date.now(); me.registered = true; DK.store.save(); }
      if (r === 'banned') { me.banned = true; DK.store.save(); }
      return r;
    },
    async profile(tid) {
      const rows = await call(`players_public?trainer_id=eq.${encodeURIComponent(String(tid).toUpperCase())}&select=trainer_id,name,title,avatar,fav,team,records,playtime,updated_at,created_at`);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    },

    /* ---------- Tablas ---------- */
    /** v5.39: otras tablas: 'depth' (expedición más profunda), 'weekly' (desafío semanal), 'abyss' (jefes seguidos), 'shiny' (variocolores). */
    BOARDS: ['averno', 'depth', 'weekly', 'abyss', 'shiny'],
    periodOf(board) { return board === 'weekly' ? this.week() : seasonNow(); },
    async submitScore(board, value, build) {
      if (!this.enabled() || !(value > 0)) return null;
      const me = this.me(); if (!me || me.tainted) return null;
      if (!this.ready()) { // pendiente hasta que decidas publicar (el mejor de cada tabla, de este periodo)
        if (me.publish === null) { me.pendingScores = me.pendingScores || {}; const k = board + ':' + this.periodOf(board), o = me.pendingScores[k]; if (!o || value > o.v) me.pendingScores[k] = { v: value, b: build || null }; DK.store.save(); }
        return 'pending';
      }
      try {
        await this.saveProfile();
        return await this.rpc('submit_score', { p_id: me.id, p_secret: me.secret, p_board: board, p_value: value | 0, p_build: build || null, p_playtime: (st().stats && st().stats.playTime) | 0 });
      } catch (e) { return 'error'; }
    },
    /** Una tabla (por defecto, la de este periodo). */
    async scoreBoard(board, limit = 50, period = this.periodOf(board)) {
      if (!this.enabled()) return [];
      const rows = await call(`scores_board?select=board,period,value,build,updated_at,trainer_id,name,avatar,title&board=eq.${board}&period=eq.${period | 0}&order=value.desc,updated_at.asc&limit=${Math.max(1, Math.min(200, limit | 0))}`);
      return Array.isArray(rows) ? rows : [];
    },
    async submitAverno(rec) {
      if (!this.enabled() || !rec) return null;
      const me = this.me(); if (!me || me.tainted) return null;
      const payload = { season: seasonNow(), p_id: me.id, p_secret: me.secret, p_name: ((st().player && st().player.name) || '?').slice(0, 20), p_floors: rec.floors | 0, p_maps: rec.maps | 0, p_level: rec.level | 0, p_team: rec.team || this.teamSnap(), p_version: DK.version, p_relics: rec.relics || [] };
      // sólo se guarda pendiente el mejor (para enviarlo si luego decides publicar)
      if (me.publish !== true) { if (me.publish === null && (!me.pending || payload.p_floors > me.pending.p_floors)) { me.pending = payload; DK.store.save(); } return 'pending'; }
      const { season, ...body } = payload; // (la temporada la decide el servidor; aquí sólo sirve para lo pendiente)
      try {
        if (this.ready()) await this.saveProfile().catch(() => null);
        let r;
        try { r = await call('rpc/submit_averno', { method: 'POST', body: Object.assign({}, body, { p_playtime: (st().stats && st().stats.playTime) | 0 }) }); }
        catch (e) { const { p_relics, ...old } = body; r = await call('rpc/submit_averno', { method: 'POST', body: old }); } // (base de datos sin la v5.39)
        me.lastSent = Date.now(); delete me.pending; DK.store.save(); return r;
      } catch (e) { me.pending = payload; DK.store.save(); return 'error'; }
    },
    async setPublish(on) {
      const me = this.me(); if (!me) return null;
      me.publish = !!on; DK.store.save();
      if (me.pending && me.pending.season !== seasonNow()) delete me.pending; // un récord de otra temporada ya no cuenta
      let out = null;
      if (on) {
        await this.saveProfile(true).catch(() => null);
        if (me.pending) { const p = me.pending; out = await this.submitAverno({ floors: p.p_floors, maps: p.p_maps, level: p.p_level, team: p.p_team, relics: p.p_relics }); }
        const ps = me.pendingScores || {}; delete me.pendingScores; DK.store.save();
        for (const [k, o] of Object.entries(ps)) { const [b, per] = k.split(':'); if (+per === this.periodOf(b)) await this.submitScore(b, o.v, o.b); }
      } else { delete me.pending; delete me.pendingScores; DK.store.save(); }
      return out;
    },
    /** ¿Hay que preguntar si publicar? (configurado, sin decidir y con algo que enviar) */
    shouldAsk() { const me = this.enabled() ? this.me() : null; return !!(me && me.publish === null && !me.tainted && ((me.pending && me.pending.season === seasonNow()) || (me.pendingScores && Object.keys(me.pendingScores).length))); },
    /** Tabla del Averno de una temporada (por defecto, la actual). */
    async board(limit = 50, season = seasonNow()) {
      if (!this.enabled()) return [];
      const q = `select=player_id,season,name,floors,maps,level,team,relics,trainer_id,version,updated_at&season=eq.${season | 0}&order=floors.desc,maps.desc,updated_at.asc&limit=${Math.max(1, Math.min(200, limit | 0))}`;
      let rows;
      try { rows = await call('averno_board?' + q); }
      catch (e) { // (base de datos más antigua: sin reliquias / sin temporadas)
        try { rows = await call('averno_board?' + q.replace('relics,trainer_id,', '')); }
        catch (e2) { if (season !== seasonNow()) throw e2; rows = await call('averno_board?' + q.replace('relics,trainer_id,', '').replace('player_id,season,', 'player_id,').replace(/&season=eq\.\d+/, '')); }
      }
      return Array.isArray(rows) ? rows : [];
    },

    /* ---------- Amigos y buzón ---------- */
    /** Llamada que nunca falla: si no hay red devuelve 'error'. */
    srpc(name, body) { return this.rpc(name, body).then((r) => (r == null ? 'ok' : r), () => 'error'); },
    auth() { const me = this.me(); return { p_id: me.id, p_secret: me.secret }; },
    /** Amigos y solicitudes: status = friend · sent (la enviaste tú) · incoming (te la han enviado) */
    async friends() { await this.saveProfile().catch(() => null); const r = await this.rpc('friend_list', this.auth()); return (Array.isArray(r) ? r : []).map((f) => Object.assign(f, { status: f.status || (f.mutual ? 'friend' : 'sent') })); },
    async addFriend(tid) { await this.saveProfile().catch(() => null); return this.srpc('friend_add', Object.assign(this.auth(), { p_tid: String(tid || '').toUpperCase() })); },
    removeFriend(tid) { return this.srpc('friend_remove', Object.assign(this.auth(), { p_tid: tid })); },
    /** v5.40: rechazar una solicitud de amistad (aceptar = addFriend) */
    rejectFriend(tid) { return this.srpc('friend_reject', Object.assign(this.auth(), { p_tid: tid })); },
    async inbox() { const r = await this.rpc('inbox_fetch', this.auth()); const list = Array.isArray(r) ? r : []; const me = this.me(); const muted = me.muted || []; return list.filter((m) => !muted.includes(m.from_tid)); },
    send(tid, kind, body) { return this.srpc('inbox_send', Object.assign(this.auth(), { p_to: tid, p_kind: kind, p_body: body || {} })); },
    take(id) { return this.srpc('inbox_take', Object.assign(this.auth(), { p_msg: id })); },
    /** Recoge un regalo (sólo se cobra si el servidor confirma que no se había recogido ya). */
    async claimGift(m) {
      const r = await this.take(m.id);
      if (r === 'claimed') { if (m.kind === 'agift') this.applyGift(m.body && m.body.gift); else { DK.bag.addHome({ pocion: 1 }); DK.store.save(); } }
      return r;
    },
    /**
     * v5.40: aplica un regalo del equipo {items: {id: n}, coins, emblems}. Sólo objetos que existen y cantidades
     * razonables (por si acaso). Devuelve lo que se ha dado, para el aviso.
     */
    applyGift(g) {
      if (!g || typeof g !== 'object') return [];
      const out = [], items = {};
      Object.entries(g.items || {}).slice(0, 30).forEach(([id, n]) => { n = Math.max(0, Math.min(999, n | 0)); if (n && DK.data.items[id]) { items[id] = n; out.push({ id, n }); } });
      if (Object.keys(items).length) DK.bag.addHome(items);
      const coins = Math.max(0, Math.min(1e6, g.coins | 0)); if (coins) { DK.wallet.add(coins, { silent: true }); out.push({ coins }); }
      const em = Math.max(0, Math.min(500, g.emblems | 0)); if (em) { DK.camp.addEmblems(em); out.push({ emblems: em }); }
      DK.store.save(); DK.emit('online:gift', { gift: out });
      return out;
    },
    /* ---------- Noticias (del admin, para todos) ---------- */
    async news() {
      if (!this.enabled()) return [];
      const q = (cols) => call(`news_public?select=${cols}&order=pinned.desc,id.desc&limit=30`);
      try { const r = await q('id,title,body,gift,pinned,created_at,expires_at,img'); return Array.isArray(r) ? r : []; }
      catch (e) { try { const r = await q('id,title,body,gift,pinned,created_at,expires_at'); return Array.isArray(r) ? r : []; } catch (e2) { return []; } } // (base de datos sin imágenes: v5.40)
    },
    /** Ids de las noticias cuyo regalo ya has recogido (lo sabe el servidor; también se recuerda aquí) */
    async newsClaimed() {
      const me = this.me(), local = me.newsClaimed || [];
      if (!this.ready() || !me.registered) return local;
      try { const r = await this.rpc('news_claimed', this.auth()); return Array.from(new Set(local.concat(Array.isArray(r) ? r.map(Number) : []))); } catch (e) { return local; }
    },
    async claimNews(n) {
      const r = await this.srpc('news_claim', Object.assign(this.auth(), { p_news: n.id }));
      const me = this.me();
      if (r === 'claimed' || r === 'gone') { me.newsClaimed = Array.from(new Set((me.newsClaimed || []).concat([n.id]))).slice(-200); DK.store.save(); }
      return r === 'claimed' ? this.applyGift(n.gift) : r;
    },
    /** v5.41: ¿se puede mostrar esta imagen? (sólo https) */
    imgOk(u) { return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length <= 500; },
    /* ---------- Hablar con el equipo ---------- */
    support(text) { return this.srpc('support_send', Object.assign(this.auth(), { p_text: text })); },
    async supportThread() { const r = await this.rpc('support_fetch', this.auth()); return (Array.isArray(r) ? r : []).reverse(); },
    report(tid, reason) { return this.srpc('report_player', Object.assign(this.auth(), { p_tid: tid, p_reason: reason || '' })); },
    mute(tid, on = true) { const me = this.me(); me.muted = (me.muted || []).filter((x) => x !== tid); if (on) me.muted.push(tid); DK.store.save(); },
    /** Cuántos mensajes nuevos hay (se consulta cada pocos minutos con el perfil activo). */
    unread: 0,
    async pollInbox() {
      if (!this.enabled() || !st()) return 0;
      const me = this.me();
      try {
        const news = await this.news(), nn = news.filter((x) => +x.id > (me.newsSeen || 0)).length;
        let n = nn, list = [];
        if (this.ready() && me.registered) { list = await this.inbox(); n += list.filter((m) => +m.id > (me.inboxSeen || 0)).length; }
        if (n !== this.unread) { this.unread = n; DK.emit('online:inbox', { n, list, news }); }
        return n;
      } catch (e) { return 0; }
    },
    markSeen(list, news) {
      const me = this.me();
      me.inboxSeen = Math.max(me.inboxSeen || 0, ...(list || []).map((m) => +m.id || 0));
      me.newsSeen = Math.max(me.newsSeen || 0, ...(news || []).map((m) => +m.id || 0));
      this.unread = 0; DK.store.save(); DK.emit('online:inbox', { n: 0, list });
    },
  };

  // v5.39: firma de la partida al guardar y comprobación al cargar
  if (DK.store && DK.store.flush) {
    const flush0 = DK.store.flush.bind(DK.store);
    DK.store.flush = function () { if (this.state && this._dirty) this.state._sig = sigOf(this.state); return flush0(); };
  }
  DK.on('game:loaded', () => {
    const s = st(); if (!s) return;
    const me = DK.online.me();
    if (s._sig && s._sig !== sigOf(s)) me.tainted = 'edited';
    else if (impossible(s)) me.tainted = 'impossible';
    s._sig = sigOf(s);
    setTimeout(() => { DK.online.saveProfile().catch(() => null); DK.online.pollInbox(); }, 2500);
  });
  setInterval(() => { if (!document.hidden) DK.online.pollInbox(); }, 3 * 60000);
  // v5.39: récords de las otras tablas al terminar una expedición
  DK.on('expedition:end', (e) => {
    const s = st(), L = s && s.lastExpedition; if (!L) return;
    const build = DK.online.buildSnap(L.relics);
    if (L.depth && !(e && e.averno) && !L.averno && !(DK.averno && DK.averno.isZone(L.zone))) DK.online.submitScore('depth', L.depth | 0, build);
    if (L.kind === 'abismo' && L.abyssKills) DK.online.submitScore('abyss', L.abyssKills | 0, build);
    if (L.weekly && L.weekly.score && L.weekly.score >= DK.weekly.best()) DK.online.submitScore('weekly', L.weekly.score | 0, Object.assign({ zone: DK.weekly.def().zone }, build)); // (el equipo de la mejor partida de la semana)
    const sh = s.seasonShiny; if (sh && sh.season === seasonNow() && sh.n) DK.online.submitScore('shiny', sh.n, build);
  });
  // Al terminar una bajada en el Averno se envía el récord (si es el mejor lo guarda el servidor)
  DK.on('expedition:end', (e) => { if (!e || !e.averno) return; const s = st(), L = s && s.lastExpedition, r = L && L.averno; if (r) DK.online.submitAverno(Object.assign({ relics: L.relics || [] }, r)); });
})();
