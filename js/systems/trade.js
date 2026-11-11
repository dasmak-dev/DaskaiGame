/* =============================================================
 * systems/trade.js — v5.33: intercambio de daskai entre jugadores, sin servidor propio.
 *
 * Dos navegadores se conectan directamente (WebRTC) con PeerJS: uno crea una SALA y recibe un código corto
 * (p. ej. «4F7QK2»), el otro lo escribe. Para encontrarse usan el servidor público y gratuito de PeerJS
 * (sólo para el primer contacto; los datos van directos entre los dos). PeerJS se carga al abrir el
 * intercambio (no pesa en el arranque del juego).
 *
 * Protocolo (mensajes JSON):
 *   hello  { v, ver, name }       al conectar: versión del protocolo y nombre del jugador
 *   offer  { d }                  el daskai que ofreces (d = exportado, o null si lo quitas)
 *   lock   { h } / unlock         aceptas (h = huella de las dos ofertas) / te echas atrás
 *   commit { h }                  los dos han aceptado lo mismo: se hace el cambio
 *   bye                           cierras la sala
 * Cambiar cualquiera de las dos ofertas quita las aceptaciones. El cambio se hace en las dos partidas a la vez:
 * sale el tuyo (sin su equipo, que se queda en tu inventario) y entra el suyo con un uid nuevo.
 *
 *   DK.trade.host() / join(code)  → empieza (devuelve la sesión)
 *   DK.trade.offer(uid) · lock() · unlock() · close()
 *   DK.trade.session              → { role, code, status, me, them, done, error }
 *   DK.trade.canOffer(d)          → null o el motivo por el que no se puede ofrecer
 *   DK.trade.exportD(d) / importD(raw) → paquete para enviar / daskai saneado (o null)
 *   DK.trade.useTransport(fn)     → otro transporte (pruebas)
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const st = () => DK.store.state;
  const PROTO = 1;
  const PREFIX = 'daskai-trade-';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
  const PEER_JS = [
    'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  ];

  const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  /** Huella corta de un texto (FNV-1a). */
  /** JSON con las claves ordenadas (el mismo texto en los dos lados aunque el transporte cambie el orden). */
  const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };

  /* ---------------- Transporte PeerJS ---------------- */
  let peerLoading = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (peerLoading) return peerLoading;
    peerLoading = (async () => {
      for (const src of PEER_JS) {
        try {
          await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = ko; document.head.append(s); setTimeout(ko, 12000); });
          if (window.Peer) return window.Peer;
        } catch (e) { /* siguiente */ }
      }
      peerLoading = null;
      throw new Error('peerjs');
    })();
    return peerLoading;
  }
  /** Transporte real. h = { ready(code), open(), message(m), closed(), error(kind) } */
  function peerTransport(h) {
    let peer = null, conn = null, dead = false;
    const wire = (c) => {
      conn = c;
      c.on('open', () => h.open());
      c.on('data', (m) => h.message(m));
      c.on('close', () => { if (!dead) h.closed(); });
      c.on('error', () => { if (!dead) h.error('conn'); });
    };
    const fail = (e) => { if (dead) return; const ty = e && e.type; h.error(ty === 'peer-unavailable' ? 'notFound' : ty === 'unavailable-id' ? 'taken' : ty === 'network' || ty === 'server-error' || ty === 'socket-error' || ty === 'socket-closed' ? 'network' : ty === 'browser-incompatible' ? 'browser' : 'conn'); };
    return {
      async host(code) {
        const Peer = await loadPeer();
        peer = new Peer(PREFIX + code);
        peer.on('open', () => h.ready(code));
        peer.on('connection', (c) => { if (conn) { c.on('open', () => { c.send({ t: 'busy' }); setTimeout(() => c.close(), 300); }); return; } wire(c); });
        peer.on('error', fail);
      },
      async join(code) {
        const Peer = await loadPeer();
        peer = new Peer();
        peer.on('open', () => { h.ready(code); wire(peer.connect(PREFIX + code, { reliable: true })); });
        peer.on('error', fail);
      },
      send(m) { if (conn && conn.open) conn.send(m); },
      close() { dead = true; try { if (conn) conn.close(); } catch (e) { /* */ } try { if (peer) peer.destroy(); } catch (e) { /* */ } },
    };
  }
  /**
   * v5.37: transporte por RELÉ (Supabase): los mensajes se dejan en una tabla (trade_send) y cada uno recoge los
   * del otro cada ~1 s (trade_poll). Funciona en cualquier red (también de móvil a móvil, donde las conexiones
   * directas suelen fallar) y aguanta que uno salga un momento de la app para pasar el código: los mensajes esperan.
   */
  function relayTransport(h) {
    const me = 'p' + Math.random().toString(36).slice(2, 12);
    let room = '', role = '', peer = null, after = 0, timer = 0, dead = false, opened = false, fails = 0, since = 0;
    const post = (body) => DK.online.rpc('trade_send', { p_room: room, p_sender: me, p_body: body });
    const open = () => { if (opened) return; opened = true; h.open(); };
    const schedule = (ms) => { clearTimeout(timer); if (!dead) timer = setTimeout(poll, ms != null ? ms : document.hidden ? 4000 : opened ? 1100 : 1600); };
    const onVis = () => { if (!document.hidden && !dead) schedule(0); };
    document.addEventListener('visibilitychange', onVis);
    async function poll() {
      if (dead) return;
      try {
        const rows = await DK.online.rpc('trade_poll', { p_room: room, p_after: after });
        fails = 0;
        for (const r of Array.isArray(rows) ? rows : []) {
          after = Math.max(after, +r.id || 0);
          const b = r.body || {};
          if (r.sender === me || (b.to && b.to !== me)) continue;
          if (role === 'host' && b.k === 'join') { if (!peer) { peer = r.sender; await post({ k: 'welcome', to: peer }); open(); } else if (peer !== r.sender) post({ k: 'busy', to: r.sender }).catch(() => {}); continue; }
          if (role === 'guest' && b.k === 'welcome') { if (!peer) { peer = r.sender; open(); } continue; }
          if (b.k === 'busy') { h.message({ t: 'busy' }); continue; }
          if (!peer || r.sender !== peer) continue;
          if (b.k === 'msg') h.message(b.m);
          else if (b.k === 'close') h.closed();
        }
      } catch (e) { if (++fails > 10) { dead = true; h.error('network'); return; } }
      if (role === 'guest' && !opened && Date.now() - since > 180000) { dead = true; h.error('notFound'); return; }
      schedule();
    }
    /** ¿Está la base de datos preparada? (si no, se usa la conexión directa) */
    const probe = () => DK.online.rpc('trade_poll', { p_room: room, p_after: 2147483647 });
    return {
      relay: true,
      async host(code) { role = 'host'; room = code; await probe(); h.ready(code); schedule(0); },
      async join(code) { role = 'guest'; room = code; since = Date.now(); await probe(); h.ready(code); await post({ k: 'join' }); schedule(0); },
      send(m) { if (peer && !dead) post({ k: 'msg', to: peer, m }).catch(() => { /* reintento: el siguiente envío */ }); },
      close() { const p = peer; dead = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); if (p) post({ k: 'close', to: p }).catch(() => {}); },
    };
  }
  /** Transporte por defecto: el relé si hay base de datos (y está preparada); si no, la conexión directa. */
  const autoTransport = (h) => (DK.online && DK.online.enabled() && DK.trade.relayOk !== false ? relayTransport(h) : peerTransport(h));
  let transportFactory = autoTransport;

  /* ---------------- Exportar / importar un daskai ---------------- */
  // Lo que viaja con el daskai (lo demás es de tu partida: uid, equipo, vida, estados, marcas…)
  const KEYS = ['species', 'level', 'exp', 'nature', 'passive', 'genes', 'role', 'growth', 'natureGrowth', 'moves', 'learned', 'look', 'house2',
    'forms', 'form', 'extra', 'gname', 'nickname', 'shiny', 'variant', 'stars', 'evoBonus', 'talents', 'talentsAuto', 'tonics', 'legendary', 'legacy', 'ot'];
  function exportD(d) {
    const out = {};
    KEYS.forEach((k) => { if (d[k] !== undefined && d[k] !== null) out[k] = JSON.parse(JSON.stringify(d[k])); });
    return out;
  }
  const num = (v, lo, hi, def = lo) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
  const txt = (v, n = 24) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : undefined);
  const statObj = (o, lo, hi) => { const r = {}; D.statKeys.forEach((k) => { r[k] = num(o && o[k], lo, hi, 0); }); return r; };
  const smallJSON = (o, max = 400) => { try { const s = JSON.stringify(o); return s && s.length <= max ? JSON.parse(s) : undefined; } catch (e) { return undefined; } };
  /**
   * Daskai saneado a partir de lo recibido (o null si no vale): cada campo se comprueba contra los datos del
   * juego y se acota, para que un paquete manipulado no pueda romper la partida.
   */
  function importD(raw) {
    if (!raw || typeof raw !== 'object' || !D.species[raw.species]) return null;
    const C = DK.config, lv = Math.round(num(raw.level, 1, C.maxLevel, 1)), sp = D.species[raw.species];
    const d = DK.daskai.create(raw.species, 1, { shiny: false });
    d.level = lv; d.exp = Math.round(num(raw.exp, 0, 1e9, 0));
    if (D.natures[raw.nature]) d.nature = raw.nature;
    if (D.passives[raw.passive]) d.passive = raw.passive;
    if (D.roles && D.roles[raw.role]) d.role = raw.role;
    const G = C.genes || 0.1;
    d.genes = statObj(raw.genes, -G, G);
    d.growth = statObj(raw.growth, 0, lv * 12);
    d.natureGrowth = statObj(raw.natureGrowth, -lv * 4, lv * 4);
    const okMove = (m) => typeof m === 'string' && !!D.moves[m];
    const learned = Array.isArray(raw.learned) ? [...new Set(raw.learned.filter(okMove))].slice(0, 80) : [];
    const moves = Array.isArray(raw.moves) ? [...new Set(raw.moves.filter(okMove))].slice(0, C.maxMoves) : [];
    d.learned = learned.length ? learned : d.learned;
    d.moves = moves.length ? moves : d.learned.slice(-C.maxMoves);
    if (raw.look && typeof raw.look === 'object' && typeof raw.look.s === 'number') d.look = smallJSON(raw.look, 200) || d.look;
    if (D.houses[raw.house2] && raw.house2 !== sp.house) d.house2 = raw.house2; else delete d.house2;
    if (raw.forms != null) { d.forms = Math.round(num(raw.forms, 1, 4, 1)); d.form = Math.round(num(raw.form, 0, d.forms - 1, 0)); } else { delete d.forms; delete d.form; }
    if (raw.extra != null) d.extra = Math.round(num(raw.extra, 0, 4, 0));
    const gn = txt(raw.gname), nn = txt(raw.nickname);
    if (gn) d.gname = gn; else delete d.gname;
    if (nn) d.nickname = nn;
    if (raw.shiny === true) d.shiny = true; else delete d.shiny;
    if (raw.variant && D.endgame && D.endgame.variants[raw.variant]) d.variant = raw.variant;
    if (raw.stars) d.stars = Math.round(num(raw.stars, 0, (D.endgame && D.endgame.ascension.maxStars) || 5, 0));
    if (raw.evoBonus) d.evoBonus = statObj(raw.evoBonus, 0, 2000);
    if (raw.talents && typeof raw.talents === 'object') {
      const tl = {}; Object.entries(raw.talents).slice(0, 40).forEach(([k, v]) => { if (/^\d+$/.test(k) && D.talents && D.talents[v]) tl[k] = v; });
      d.talents = tl;
    }
    if (raw.talentsAuto) { const ta = smallJSON(raw.talentsAuto, 400); if (ta !== undefined) d.talentsAuto = ta; }
    if (raw.tonics && typeof raw.tonics === 'object') { const to = {}; D.statKeys.forEach((k) => { const v = num(raw.tonics[k], 0, 100, 0); if (v) to[k] = Math.round(v); }); d.tonics = to; }
    if (raw.legendary === true) d.legendary = true;
    if (raw.legacy) { const lg = smallJSON(raw.legacy, 400); if (lg !== undefined) d.legacy = lg; }
    // v5.37: entrenador original (si no viene, el de quien te lo da no se sabe: queda sin marcar)
    if (raw.ot && typeof raw.ot === 'object' && /^[A-Z0-9]{6}$/.test(String(raw.ot.id || ''))) d.ot = { id: String(raw.ot.id), name: txt(raw.ot.name, 20) || '?' }; else d.ot = { id: '------', name: '?' };
    d.equip = [null, null]; d.status = null;
    DK.daskai.touch(); DK.daskai.fullHeal(d);
    return d;
  }

  /* ---------------- v5.37: entrenador original (de quién es cada daskai) ----------------
   * state.trainer = { id } (6 caracteres, sale una vez por partida). Cada daskai lleva d.ot = { id, name }: quien lo
   * consiguió. Al intercambiarlo lo conserva, así se sabe de quién era. */
  DK.trainer = {
    id() { const s = st(); if (!s) return ''; s.trainer = s.trainer || {}; if (!s.trainer.id) s.trainer.id = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); return s.trainer.id; },
    name() { const s = st(); return (s && s.player && s.player.name) || '?'; },
    stamp(d) { if (d && !d.ot && st()) d.ot = { id: this.id(), name: this.name().slice(0, 20) }; return d; },
    isMine(d) { return !d || !d.ot || d.ot.id === this.id(); },
    /** v5.39: otro ID (si el elegido ya lo tenía otro jugador): tus daskai pasan al nuevo. */
    reroll() { const s = st(); if (!s) return; const old = this.id(); s.trainer.id = null; const nu = this.id(); (DK.party.all() || []).forEach((d) => { if (d.ot && d.ot.id === old) d.ot.id = nu; }); DK.store.save(); return nu; },
    label(d) { return d && d.ot ? `${d.ot.name} #${d.ot.id}` : ''; },
  };
  // los que ya tenías son tuyos
  DK.on('game:loaded', () => { (DK.party.all() || []).forEach((d) => DK.trainer.stamp(d)); });

  /* ---------------- Sesión ---------------- */
  const T = {
    session: null,
    PROTO,
    useTransport(fn) { transportFactory = fn || autoTransport; },
    relayOk: null, // false = la base de datos aún no tiene las tablas del relé → conexión directa
    cleanCode,
    /** ¿Se puede ofrecer? null = sí; si no, la clave del motivo. */
    canOffer(d) {
      if (!d) return 'trade.why.none';
      if (DK.expedition && DK.expedition.active()) return 'trade.why.expedition';
      if (d.temp) return 'trade.why.temp';
      if (d.locked) return 'trade.why.locked';
      if (DK.training && DK.training.isTraining && DK.training.isTraining(d.uid)) return 'trade.why.training';
      return null;
    },
    /** ¿Se puede abrir el intercambio ahora? */
    available() { return !!st() && !(DK.expedition && DK.expedition.active()); },
    emit() { DK.emit('trade:changed', this.session); },
    start(role, code) {
      this.close(true);
      const s = this.session = { role, code, status: 'connecting', me: { uid: null, payload: null, locked: false }, them: { name: '', payload: null, d: null, locked: false }, done: null, error: null, committed: false, got: false, tries: 0 };
      const self = this;
      const h = {
        ready() { if (self.session !== s) return; s.status = role === 'host' ? 'waiting' : 'connecting'; self.emit(); },
        open() { if (self.session !== s) return; s.status = 'open'; self.send({ t: 'hello', v: PROTO, ver: DK.version, name: (st().player && st().player.name) || '', tid: DK.trainer.id(), av: (st().player && st().player.avatar && st().player.avatar.kind === 'daskai') ? st().player.avatar.species : (DK.party.leader() || {}).species }); if (s.me.payload) self.send({ t: 'offer', d: s.me.payload }); self.emit(); },
        message(m) { if (self.session === s) self.onMessage(m); },
        closed() { if (self.session !== s || s.status === 'done') return; s.status = 'closed'; self.emit(); },
        error(kind) {
          if (self.session !== s) return;
          // el código ya estaba en uso: otro código (hasta 3 veces)
          if (kind === 'taken' && role === 'host' && s.tries < 3) { s.tries++; s.code = newCode(); try { s.tx.close(); } catch (e) { /* */ } s.tx = transportFactory(h); s.tx.host(s.code).catch(() => h.error('load')); self.emit(); return; }
          s.status = 'error'; s.error = kind; self.emit();
        },
      };
      const go = () => { s.tx = transportFactory(h); (role === 'host' ? s.tx.host(s.code) : s.tx.join(s.code)).catch(() => {
        // el relé no está preparado (falta el SQL): se prueba con la conexión directa
        if (s.tx && s.tx.relay && self.session === s) { self.relayOk = false; try { s.tx.close(); } catch (e) { /* */ } go(); return; }
        h.error('load'); }); };
      go();
      this.emit();
      return s;
    },
    host() { return this.start('host', newCode()); },
    join(code) { const c = cleanCode(code); if (c.length !== 6) return null; return this.start('guest', c); },
    send(m) { const s = this.session; if (s && s.tx) s.tx.send(m); },
    /** Huella de las dos ofertas (la del anfitrión primero: los dos calculan la misma). */
    fingerprint() {
      const s = this.session; if (!s || !s.me.payload || !s.them.payload) return null;
      // v5.38.1: JSON canónico (claves ordenadas): la base de datos del relé reordena las claves de lo que guarda y
      // la huella de cada lado salía distinta, así que «aceptar» nunca coincidía
      const a = canon(s.me.payload), b = canon(s.them.payload);
      return hash(s.role === 'host' ? a + '|' + b : b + '|' + a);
    },
    offer(uid) {
      const s = this.session; if (!s || s.status === 'done') return false;
      const d = uid ? DK.party.get(uid) : null;
      if (uid && this.canOffer(d)) return false;
      s.me.uid = d ? d.uid : null; s.me.payload = d ? exportD(d) : null;
      s.me.locked = false; s.them.locked = false; s.committed = false;
      this.send({ t: 'offer', d: s.me.payload });
      this.emit(); return true;
    },
    lock() {
      const s = this.session, h = this.fingerprint(); if (!s || !h || s.status !== 'open') return false;
      s.me.locked = h; this.send({ t: 'lock', h });
      this.tryCommit(); this.emit(); return true;
    },
    unlock() { const s = this.session; if (!s) return; s.me.locked = false; s.committed = false; this.send({ t: 'unlock' }); this.emit(); },
    tryCommit() {
      const s = this.session, h = this.fingerprint();
      if (!s || !h || s.me.locked !== h || s.them.locked !== h || s.committed) return;
      s.committed = h; this.send({ t: 'commit', h });
      if (s.got === h) this.execute();
    },
    onMessage(m) {
      const s = this.session; if (!m || typeof m !== 'object') return;
      switch (m.t) {
        case 'hello':
          s.them.name = txt(m.name, 20) || '?'; s.them.ver = txt(m.ver, 16) || '';
          s.them.tid = /^[A-Z0-9]{6}$/.test(String(m.tid || '')) ? m.tid : ''; s.them.av = D.species[m.av] ? m.av : null;
          if (m.v !== PROTO) { s.status = 'error'; s.error = 'version'; }
          break;
        case 'busy': s.status = 'error'; s.error = 'busy'; break;
        case 'offer': {
          const d = m.d ? importD(m.d) : null;
          s.them.payload = d ? m.d : null; s.them.d = d; s.them.bad = !!(m.d && !d);
          s.me.locked = false; s.them.locked = false; s.committed = false; s.got = false;
          break;
        }
        case 'lock': s.them.locked = typeof m.h === 'string' ? m.h : false; this.tryCommit(); break;
        case 'unlock': s.them.locked = false; s.committed = false; break;
        case 'commit': s.got = m.h; if (s.committed && s.committed === m.h) this.execute(); break;
        case 'bye': if (s.status !== 'done') s.status = 'closed'; break;
        default: return;
      }
      this.emit();
    },
    /** Hace el cambio en esta partida: sale el tuyo y entra el suyo. */
    execute() {
      const s = this.session; if (!s || s.status === 'done') return null;
      const mine = DK.party.get(s.me.uid), theirs = importD(s.them.payload);
      if (!mine || !theirs || this.canOffer(mine)) { s.status = 'error'; s.error = 'failed'; this.emit(); return null; }
      const P = DK.party, state = st();
      const teamAt = state.team.indexOf(mine.uid);
      // el equipo que llevaba se queda en tu inventario
      (mine.equip || []).forEach((p, slot) => { if (p) { if (typeof p === 'object') DK.gear.unequip(mine, slot); else DK.bag.add(p); } });
      P._drop(mine.uid);
      delete state.stats.usage[mine.uid];
      P.add(theirs);
      // si el tuyo estaba en el equipo, el nuevo ocupa su sitio
      const t = state.team.filter((u) => u !== theirs.uid);
      if (teamAt >= 0) t.splice(Math.min(teamAt, t.length), 0, theirs.uid);
      state.team = t.slice(0, DK.config.maxTeam);
      if (!state.team.length && P.all().length) state.team.push(P.all()[0].uid);
      if (DK.boxes && DK.boxes.sync) DK.boxes.sync();
      state.stats.trades = (state.stats.trades || 0) + 1;
      // v5.37: historial de intercambios (los 20 últimos)
      const snap = (d) => ({ species: d.species, name: DK.daskai.name(d), level: d.level, shiny: !!d.shiny });
      state.tradeLog = [{ at: Date.now(), gave: snap(mine), got: snap(theirs), with: s.them.name || '?', tid: s.them.tid || '' }].concat(state.tradeLog || []).slice(0, 20);
      s.done = { gave: DK.daskai.name(mine), got: theirs.uid }; s.status = 'done';
      DK.store.save();
      DK.emit('trade:done', { gave: mine, got: theirs });
      this.emit();
      return theirs;
    },
    close(silent) {
      const s = this.session; if (!s) return;
      try { if (s.status !== 'done') s.tx.send({ t: 'bye' }); } catch (e) { /* */ }
      setTimeout(() => { try { s.tx.close(); } catch (e) { /* */ } }, 150);
      this.session = null;
      if (!silent) this.emit();
    },
    exportD, importD,
  };
  DK.trade = T;
})();
