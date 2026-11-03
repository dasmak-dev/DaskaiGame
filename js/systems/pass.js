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
  const S = () => { const s = st(); if (!s) return { xp: 0, claimed: {}, extra: 0 }; return s.pass || (s.pass = { xp: 0, claimed: {}, extra: 0 }); };
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
    reward(lv) { return lv <= max() ? P().levels[lv - 1] : P().after.reward; },
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
      if (lv <= max()) S().claimed[lv] = Date.now(); else S().extra = (S().extra || 0) + 1;
      DK.store.save();
      if (DK.app && DK.app.renderRes) DK.app.renderRes();
      return got;
    },
    claimAll() { return this.pending().map((lv) => this.claim(lv)).filter(Boolean); },
    has(kind, id) { return P().levels.some((r, i) => r[kind] === id && this.claimed(i + 1)); },
  };
})();
