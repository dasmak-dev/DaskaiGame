/* =============================================================
 * systems/telemetry.js — v5.45: estadísticas anónimas para equilibrar el juego.
 *
 * Sólo se cuentan cosas (sin ID de jugador, sin nombre, sin partida): en qué zona y piso cae la gente,
 * cómo acaban las expediciones, qué runas, tipos y corrupción se usan, cómo van los jefes y los duelos.
 * Se juntan en el dispositivo y se envían de golpe (track_batch) como mucho cada 10 minutos.
 * Se puede apagar en Ajustes → «Estadísticas anónimas».
 *
 *   DK.telemetry.add(kind, key, value)   → suma 1 (y value) al contador kind/key de hoy
 *   DK.telemetry.flush()                 → envía lo pendiente
 * ============================================================= */
(function () {
  const KEY = 'daskai.tq', EVERY = 10 * 60000;
  const ls = { get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* */ } } };
  const okKey = (k) => String(k).replace(/[^\w:.-]/g, '').slice(0, 60);

  DK.telemetry = {
    on() { return DK.settings.get('telemetry') !== false && DK.online && DK.online.enabled(); },
    add(kind, key, v = 0) {
      if (!this.on() || !key) return;
      const q = ls.get(), id = kind + '|' + okKey(key);
      q.ev = q.ev || {};
      const x = (q.ev[id] = q.ev[id] || { n: 0, v: 0 });
      x.n++; x.v += Math.max(0, Math.round(+v || 0));
      ls.set(q);
    },
    async flush(force = false) {
      if (!this.on() || this._busy) return;
      const q = ls.get(); if (!q.ev || !Object.keys(q.ev).length) return;
      if (!force && Date.now() - (q.at || 0) < EVERY) return;
      const all = Object.entries(q.ev), batch = all.slice(0, 60);
      const events = [];
      batch.forEach(([id, x]) => { const [k, key] = id.split('|'); for (let n = x.n, i = 0; n > 0 && i < 4; i++) { const c = Math.min(50, n); events.push({ k, key, n: c, v: i ? 0 : x.v }); n -= c; } });
      this._busy = true;
      try {
        await DK.online.rpc('track_batch', { p_events: events.slice(0, 60) });
        const q2 = ls.get(); batch.forEach(([id]) => { if (q2.ev) delete q2.ev[id]; }); q2.at = Date.now(); ls.set(q2);
      } catch (e) { /* se reintenta más tarde */ } finally { this._busy = false; }
    },
  };

  const T = DK.telemetry, lvBucket = (n) => (n <= 0 ? '0' : n < 10 ? '1-9' : n < 25 ? '10-24' : n < 50 ? '25-49' : n < 80 ? '50-79' : '80+');
  // Expediciones: cómo acaban, en qué piso, con qué tipo, tamaño, runas y corrupción
  DK.on('expedition:snap', (L) => {
    if (!L || !L.zone) return;
    const floors = (L.cleared || []).length, res = L.outcome || '?';
    T.add('exp', L.zone + ':' + res, floors);
    T.add('kind', (L.kind || 'normal') + ':' + res);
    T.add('size', (L.size || 'small') + ':' + res);
    if (/lost/.test(res)) T.add('death', L.zone + ':' + (L.depth > 1 ? 'd' + L.depth + ':' : '') + 'f' + floors);
    (L.runesUsed || []).forEach((id) => { let b = String(id); try { b = DK.runes.parse(id).base; } catch (er) { /* */ } T.add('rune', b + ':' + res); });
    if (L.corruption) T.add('corr', 'c' + L.corruption + ':' + res);
    if (L.nightmare) T.add('nightmare', res);
    (L.fallen || []).forEach((f) => T.add('fallen', L.zone + ':' + lvBucket(f.level)));
  });
  DK.on('battle:end', (e) => { if (e && e.boss) T.add('boss', e.zone + ':' + (e.outcome === 'won' ? 'won' : e.outcome)); });
  DK.on('duel:end', (e) => T.add('duel', e.won ? 'won' : 'lost'));
  // Una vez al día: jugadores activos (sólo un contador), versión e idioma
  DK.on('game:loaded', () => {
    const q = ls.get(), d = new Date().toISOString().slice(0, 10);
    if (q.day === d) return;
    q.day = d; ls.set(q);
    T.add('active', 'day'); T.add('version', DK.version); T.add('lang', DK.i18n.lang);
    const team = DK.party.active(); if (team.length) T.add('teamlv', lvBucket(Math.max(...team.map((x) => x.level | 0))));
  });
  setInterval(() => T.flush(), 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) T.flush(true); });
})();
