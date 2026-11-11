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
  let transportFactory = peerTransport;

  /* ---------------- Exportar / importar un daskai ---------------- */
  // Lo que viaja con el daskai (lo demás es de tu partida: uid, equipo, vida, estados, marcas…)
  const KEYS = ['species', 'level', 'exp', 'nature', 'passive', 'genes', 'role', 'growth', 'natureGrowth', 'moves', 'learned', 'look', 'house2',
    'forms', 'form', 'extra', 'gname', 'nickname', 'shiny', 'variant', 'stars', 'evoBonus', 'talents', 'talentsAuto', 'tonics', 'legendary', 'legacy'];
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
    d.equip = [null, null]; d.status = null;
    DK.daskai.touch(); DK.daskai.fullHeal(d);
    return d;
  }

  /* ---------------- Sesión ---------------- */
  const T = {
    session: null,
    PROTO,
    useTransport(fn) { transportFactory = fn || peerTransport; },
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
        open() { if (self.session !== s) return; s.status = 'open'; self.send({ t: 'hello', v: PROTO, ver: DK.version, name: (st().player && st().player.name) || '' }); if (s.me.payload) self.send({ t: 'offer', d: s.me.payload }); self.emit(); },
        message(m) { if (self.session === s) self.onMessage(m); },
        closed() { if (self.session !== s || s.status === 'done') return; s.status = 'closed'; self.emit(); },
        error(kind) {
          if (self.session !== s) return;
          // el código ya estaba en uso: otro código (hasta 3 veces)
          if (kind === 'taken' && role === 'host' && s.tries < 3) { s.tries++; s.code = newCode(); try { s.tx.close(); } catch (e) { /* */ } s.tx = transportFactory(h); s.tx.host(s.code).catch(() => h.error('load')); self.emit(); return; }
          s.status = 'error'; s.error = kind; self.emit();
        },
      };
      s.tx = transportFactory(h);
      (role === 'host' ? s.tx.host(code) : s.tx.join(code)).catch(() => h.error('load'));
      this.emit();
      return s;
    },
    host() { return this.start('host', newCode()); },
    join(code) { const c = cleanCode(code); if (c.length !== 6) return null; return this.start('guest', c); },
    send(m) { const s = this.session; if (s && s.tx) s.tx.send(m); },
    /** Huella de las dos ofertas (la del anfitrión primero: los dos calculan la misma). */
    fingerprint() {
      const s = this.session; if (!s || !s.me.payload || !s.them.payload) return null;
      const a = JSON.stringify(s.me.payload), b = JSON.stringify(s.them.payload);
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
