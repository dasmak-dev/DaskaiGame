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

  DK.online = {
    fetch: null, // (las pruebas ponen aquí un fetch falso)
    /** v5.37: llamada a una función de la base de datos (la usa el intercambio por relé) */
    rpc(name, body) { return call('rpc/' + name, { method: 'POST', body: body || {} }); },
    /** v5.34: la tabla es por temporada: al empezar una nueva queda vacía (las anteriores se guardan) */
    season() { return seasonNow(); },
    daysLeft() { return Math.max(0, Math.ceil((t0() + seasonNow() * SEA().days * DAY - Date.now()) / DAY)); },
    enabled() { const c = cfg(); return !!(c.supabaseUrl && c.supabaseKey); },
    me() {
      const s = st(); if (!s) return null;
      s.online = s.online || {};
      if (!s.online.id) { s.online.id = uuid(); s.online.secret = secret(); DK.store.save(); }
      if (s.online.publish === undefined) s.online.publish = null; // null = aún no lo has decidido
      return s.online;
    },
    /** Equipo para enseñar en la tabla: especie, nivel y si es variocolor (nada más). */
    teamSnap() { return DK.party.active().slice(0, 6).map((d) => ({ s: d.species, l: d.level, sh: d.shiny ? 1 : 0 })); },
    async submitAverno(rec) {
      if (!this.enabled() || !rec) return null;
      const me = this.me(); if (!me) return null;
      const payload = { season: seasonNow(), p_id: me.id, p_secret: me.secret, p_name: ((st().player && st().player.name) || '?').slice(0, 20), p_floors: rec.floors | 0, p_maps: rec.maps | 0, p_level: rec.level | 0, p_team: rec.team || this.teamSnap(), p_version: DK.version };
      // sólo se guarda pendiente el mejor (para enviarlo si luego decides publicar)
      if (me.publish !== true) { if (me.publish === null && (!me.pending || payload.p_floors > me.pending.p_floors)) { me.pending = payload; DK.store.save(); } return 'pending'; }
      const { season, ...body } = payload; // (la temporada la decide el servidor; aquí sólo sirve para lo pendiente)
      try { const r = await call('rpc/submit_averno', { method: 'POST', body }); me.lastSent = Date.now(); delete me.pending; DK.store.save(); return r; }
      catch (e) { me.pending = payload; DK.store.save(); return 'error'; }
    },
    async setPublish(on) {
      const me = this.me(); if (!me) return null;
      me.publish = !!on; DK.store.save();
      if (me.pending && me.pending.season !== seasonNow()) delete me.pending; // un récord de otra temporada ya no cuenta
      if (on && me.pending) { const p = me.pending; return this.submitAverno({ floors: p.p_floors, maps: p.p_maps, level: p.p_level, team: p.p_team }); }
      if (!on) { delete me.pending; DK.store.save(); }
      return null;
    },
    /** ¿Hay que preguntar si publicar? (configurado, sin decidir y con algo que enviar) */
    shouldAsk() { const me = this.enabled() ? this.me() : null; return !!(me && me.publish === null && me.pending && me.pending.season === seasonNow()); },
    /** Tabla de una temporada (por defecto, la actual). */
    async board(limit = 50, season = seasonNow()) {
      if (!this.enabled()) return [];
      const q = `select=player_id,season,name,floors,maps,level,team,version,updated_at&season=eq.${season | 0}&order=floors.desc,maps.desc,updated_at.asc&limit=${Math.max(1, Math.min(200, limit | 0))}`;
      let rows;
      try { rows = await call('averno_board?' + q); }
      catch (e) { // (base de datos aún sin temporadas: docs/ONLINE-SUPABASE.md, apartado 3) → la tabla de siempre
        if (season !== seasonNow()) throw e;
        rows = await call('averno_board?' + q.replace('player_id,season,', 'player_id,').replace(/&season=eq\.\d+/, ''));
      }
      return Array.isArray(rows) ? rows : [];
    },
  };
  // Al terminar una bajada en el Averno se envía el récord (si es el mejor lo guarda el servidor)
  DK.on('expedition:end', (e) => { if (!e || !e.averno) return; const s = st(), r = s && s.lastExpedition && s.lastExpedition.averno; if (r) DK.online.submitAverno(r); });
})();
