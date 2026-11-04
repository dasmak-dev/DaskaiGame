/* =============================================================
 * systems/pass.js — Senda del aventurero (data/pass.js).
 *   state.pass = { xp, claimed: { nivel: fecha }, extra: n cofres cobrados }
 *
 *   DK.pass.add(n, motivo)  → suma puntos (avisa al subir de nivel)
 *   DK.pass.level()         → nivel alcanzado · progress() → {level, into, need}
 *   DK.pass.claim(lv)       → cobra el premio de un nivel · claimAll()
 *   DK.pass.has('frame'|'title', id) → premio cosmético ya cobrado
 * ============================================================= */
(function () {
  const D = DK.data;
  const P = () => D.pass;
  const st = () => DK.store.state;
  /* Temporadas (data/endgame.js → seasons): cada `days` días la senda empieza de cero
   * con premios cosméticos nuevos; lo cosmético cobrado se guarda para siempre (state.cosmetics). */
  const seasonNow = () => { const c = D.endgame.seasons, t0 = new Date(c.start + 'T00:00:00').getTime(); return Math.max(1, 1 + Math.floor((Date.now() - t0) / (c.days * 86400000))); };
  const S = () => {
    const s = st(); if (!s) return { xp: 0, claimed: {}, extra: 0, season: seasonNow() };
    const p = s.pass || (s.pass = { xp: 0, claimed: {}, extra: 0 });
    const now = seasonNow();
    if (!p.season) p.season = now;
    else if (p.season !== now) { p.season = now; p.xp = 0; p.claimed = {}; p.extra = 0; DK.emit('pass:season', { season: now }); }
    return p;
  };
  /** Id de un cosmético en una temporada (la 1ª conserva los ids de siempre). */
  const seasonId = (id, n) => (n > 1 ? id.replace('senda_', `senda${n}_`).replace(/^senda(\d\d)$/, `senda${n}_$1`) : id);
  const max = () => P().levels.length;
  /** Puntos totales para llegar al nivel n. */
  const total = (n) => { let x = 0; for (let i = 1; i <= Math.min(n, max()); i++) x += P().xpFor(i); return x + Math.max(0, n - max()) * P().after.levelXp; };

  DK.pass = {
    max,
    total,
    xp() { return S().xp; },
    /** Nivel alcanzado (puede pasar de max(): niveles extra del cofre repetible). */
    level() { let n = 0; while (total(n + 1) <= S().xp) n++; return n; },
    progress() { const lv = this.level(), base = total(lv), need = total(lv + 1) - base; return { level: lv, into: S().xp - base, need }; },
    season() { return S().season; },
    /** Días que le quedan a la temporada. */
    daysLeft() { const c = D.endgame.seasons, t0 = new Date(c.start + 'T00:00:00').getTime(), end = t0 + S().season * c.days * 86400000; return Math.max(0, Math.ceil((end - Date.now()) / 86400000)); },
    seasonId,
    reward(lv) {
      const r = lv <= max() ? P().levels[lv - 1] : P().after.reward, n = S().season;
      if (n <= 1 || !(r.frame || r.title)) return r;
      return Object.assign({}, r, r.frame ? { frame: seasonId(r.frame, n) } : null, r.title ? { title: seasonId(r.title, n) } : null);
    },
    claimed(lv) { return lv <= max() ? !!S().claimed[lv] : lv - max() <= (S().extra || 0); },
    /** Niveles alcanzados sin cobrar. */
    pending() { const out = []; for (let i = 1; i <= this.level(); i++) if (!this.claimed(i)) out.push(i); return out; },
    add(n, why) {
      if (!st() || !n) return 0;
      const before = this.level();
      S().xp += n;
      const after = this.level();
      DK.emit('pass:xp', { n, why, level: after });
      if (after > before && DK.ui && DK.ui.toast) DK.ui.toast(DK.t('pass.levelUp', { n: after }), { icon: 'award', kind: 'good' });
      DK.store.save();
      return n;
    },
    /** Da el premio de un nivel. @returns {Object|null} lo dado (para el aviso) */
    claim(lv) {
      if (lv > this.level() || this.claimed(lv)) return null;
      const r = this.reward(lv), got = Object.assign({}, r);
      if (r.coins) DK.wallet.add(r.coins, { silent: true });
      if (r.item && D.items[r.item]) DK.bag.add(r.item, r.qty || 1);
      if (r.emblems) DK.camp.addEmblems(r.emblems);
      if (r.rune) { got.runes = r.rune === 'random' ? DK.runes.roll(r.n || 1) : Array(r.n || 1).fill(r.rune); got.runes.forEach((id) => DK.runes.add(id)); }
      // Lo cosmético se queda para siempre (aunque cambie la temporada)
      const cos = st().cosmetics || (st().cosmetics = { frames: [], titles: [] });
      if (r.frame && !cos.frames.includes(r.frame)) cos.frames.push(r.frame);
      if (r.title && !cos.titles.includes(r.title)) cos.titles.push(r.title);
      if (lv <= max()) S().claimed[lv] = Date.now(); else S().extra = (S().extra || 0) + 1;
      DK.store.save();
      if (DK.app && DK.app.renderRes) DK.app.renderRes();
      return got;
    },
    claimAll() { return this.pending().map((lv) => this.claim(lv)).filter(Boolean); },
    has(kind, id) {
      const cos = (st() && st().cosmetics) || { frames: [], titles: [] };
      if ((kind === 'frame' ? cos.frames : cos.titles).includes(id)) return true;
      return S().season === 1 && P().levels.some((r, i) => r[kind] === id && this.claimed(i + 1)); // partidas de la v4.29
    },
    /** Títulos de la senda conseguidos (todas las temporadas). */
    titles() {
      const cos = (st() && st().cosmetics) || { titles: [] }, out = new Set(cos.titles);
      P().levels.forEach((r, i) => { if (r.title && S().season === 1 && this.claimed(i + 1)) out.add(r.title); });
      return [...out];
    },
    /** Nombre de un título de la senda (con su temporada). */
    titleName(id) {
      const m = String(id).match(/^senda(\d+)_(\d+)$/);
      if (!m) return DK.t(['pass', 'titles', id].join('.'));
      return DK.t('pass.titleSeason', { name: DK.t(['pass', 'titles', 'senda' + m[2]].join('.')), n: m[1] });
    },
  };
})();
