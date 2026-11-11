/* =============================================================
 * systems/cloud.js — v5.45: copia de la partida en la nube (Supabase).
 *
 * Una sola copia por partida (se sobrescribe), comprimida con gzip: una partida normal ocupa entre 3 y
 * 60 KB. Se sube sola (si la activas) al terminar una expedición y, como mucho, cada 15 minutos de juego;
 * el servidor no acepta más de una subida por minuto. Para seguir en otro dispositivo se usa el
 * «código de recuperación» (tu ID secreto): quien lo tenga puede descargar tu partida, así que no se comparte.
 *
 *   DK.cloud.on() / setOn(v)       → ¿subida automática?
 *   DK.cloud.upload({ force })     → Promise<{ok, at, bytes} | {error}>
 *   DK.cloud.info()                → Promise<{at, bytes, playtime, label} | {none}>
 *   DK.cloud.code()                → código de recuperación de esta partida
 *   DK.cloud.restore(code)         → Promise<{ state, at, label, playtime } | { error }>
 * ============================================================= */
(function () {
  const O = () => DK.online;
  const st = () => DK.store.state;
  const EVERY = 15 * 60000, MAX = 390000;

  async function gz(text) {
    if (typeof CompressionStream === 'undefined') return 'J' + btoa(unescape(encodeURIComponent(text))); // (sin compresión en navegadores muy antiguos)
    const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'G' + btoa(bin);
  }
  async function ungz(data) {
    if (!data) throw new Error('empty');
    if (data[0] === 'J') return decodeURIComponent(escape(atob(data.slice(1))));
    const bin = atob(data.slice(1)), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

  DK.cloud = {
    enabled() { return !!(O() && O().enabled() && st()); },
    rec() { const me = O().me(); me.cloud = me.cloud || { on: false, at: 0, bytes: 0 }; return me.cloud; },
    on() { return !!(this.enabled() && this.rec().on); },
    setOn(v) { this.rec().on = !!v; DK.store.save(); if (v) this.upload({ force: true }); },
    label() { const s = st(), p = (s && s.player) || {}; const top = Math.max(0, ...((s && s.party) || []).map((d) => d.level | 0)); return `${(p.name || '?').slice(0, 20)} · ${DK.t('common.lvl')} ${top}`.slice(0, 40); },
    async upload({ force = false } = {}) {
      if (!this.enabled()) return { error: 'off' };
      const R = this.rec();
      if (!force && (!R.on || Date.now() - (R.at || 0) < EVERY)) return { skipped: true };
      if (this._busy) return { error: 'busy' };
      this._busy = true;
      try {
        DK.store.flush();
        const me = O().me(), data = await gz(JSON.stringify(st()));
        if (data.length > MAX) return { error: 'big' };
        const r = await O().rpc('cloud_save', { p_id: me.id, p_secret: me.secret, p_data: data, p_version: DK.version, p_playtime: (st().stats && st().stats.playTime) | 0, p_label: this.label() });
        if (r && r.ok) { R.at = Date.now(); R.bytes = r.bytes | 0; DK.store.save(); DK.emit('cloud:saved', r); }
        return r || { error: 'offline' };
      } catch (e) { return { error: 'offline' }; } finally { this._busy = false; }
    },
    async info() { const me = O().me(); try { return await O().rpc('cloud_info', { p_id: me.id, p_secret: me.secret }); } catch (e) { return { error: 'offline' }; } },
    /** Código para recuperar la partida en otro dispositivo. */
    code() { const me = O().me(); return 'DK1-' + b64u(me.id.replace(/-/g, '') + ':' + me.secret); },
    parse(code) {
      const m = String(code || '').trim().match(/^DK1-([A-Za-z0-9_-]+)$/); if (!m) return null;
      try {
        const [hex, secret] = unb64u(m[1]).split(':');
        if (!/^[0-9a-f]{32}$/.test(hex) || !secret || secret.length < 16) return null;
        return { id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, secret };
      } catch (e) { return null; }
    },
    async restore(code) {
      const k = this.parse(code); if (!k) return { error: 'code' };
      let r; try { r = await O().rpc('cloud_load', { p_id: k.id, p_secret: k.secret }); } catch (e) { return { error: 'offline' }; }
      if (!r || r.error) return { error: (r && r.error) || 'offline' };
      try {
        const s = JSON.parse(await ungz(r.data));
        if (!s || !Array.isArray(s.party) || !s.player) return { error: 'format' };
        s.online = Object.assign(s.online || {}, { id: k.id, secret: k.secret }); // (por si la copia era anterior a tener ID)
        return { state: s, at: r.at, label: r.label, playtime: r.playtime };
      } catch (e) { return { error: 'format' }; }
    },
  };

  // Subida automática: al terminar una expedición, cada 15 min de juego y al pasar a segundo plano
  DK.on('expedition:end', () => setTimeout(() => DK.cloud.upload(), 1500));
  setInterval(() => { if (!document.hidden && DK.cloud.on()) DK.cloud.upload(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && DK.cloud.on()) DK.cloud.upload(); });
})();
