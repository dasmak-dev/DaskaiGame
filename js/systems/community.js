/* =============================================================
 * systems/community.js — v5.45: duelos y clanes (Supabase, sin servidor propio).
 *
 * DUELOS: luchas contra una copia del equipo público de otro jugador (el que sale en su perfil). El rival
 * lo maneja la máquina; sus daskai entran uno tras otro. El servidor da un «pase» de un solo uso al empezar
 * (duel_start, máx. 30 al día) y al terminar suma o resta puntos tipo Elo (duel_report). No hay botín ni
 * objetos y tu equipo vuelve como estaba. Las 5 primeras victorias del día dan unas monedas.
 *
 *   DK.duels.ok()                 → ¿puede jugar duelos? (en línea + perfil público)
 *   DK.duels.find()               → { me: {rating, wins, losses…}, rivals: [{tid, name, team, rating}] }
 *   DK.duels.start(tid, leader)   → pide el pase y abre el combate (o devuelve el error)
 *   DK.duels.board()              → clasificación de duelos
 *   DK.duels.ghost(snap)          → daskai rival a partir de la instantánea (online.snapD)
 *
 * CLANES: hasta 20 jugadores, chat propio y un contrato semanal compartido (la suma de los récords del
 * desafío semanal de sus miembros; al llegar a cada meta, cada miembro recoge su premio una vez).
 *
 *   DK.clans.info() · search(q) · create(o) · join(id) · leave() · manage(action, tid) · edit(o)
 *   DK.clans.chat(after) · say(text) · claim(tier) · TIERS · reward(tier)
 * ============================================================= */
(function () {
  const O = () => DK.online, D = DK.data;
  const st = () => DK.store.state;
  const today = () => new Date().toISOString().slice(0, 10);

  DK.duels = {
    DAILY_REWARDS: 5,
    ok() { return !!(O() && O().enabled() && O().ready()); },
    async find() { await O().saveProfile().catch(() => null); return O().rpc('duel_find', O().auth()); },
    async board() { const r = await O().rpc('duel_board', { p_limit: 50 }); return Array.isArray(r) ? r : []; },
    /** Zona de fondo para el duelo: una de las que tienes abiertas (no el Averno). */
    zone() {
      const list = DK.world.unlockedZones().filter((z) => !(DK.averno && DK.averno.isZone(z.id)));
      return (list.length ? DK.util.pick(list) : Object.values(D.zones)[0]).id;
    },
    /** Pide el pase al servidor y abre el combate. @returns {Promise<string|null>} error o null */
    async start(tid, leaderUid) {
      if (DK.expedition.active()) return 'expedition';
      const alive = DK.party.active();
      if (!alive.length) return 'noteam';
      let r;
      try { await O().saveProfile().catch(() => null); r = await O().rpc('duel_start', Object.assign(O().auth(), { p_tid: tid })); } catch (e) { return 'offline'; }
      if (!r || r.error) return (r && r.error) || 'offline';
      DK.router.go('battle', { zone: this.zone(), leaderUid: leaderUid || alive[0].uid, duel: r });
      return null;
    },
    /** Copia jugable de un daskai publicado (sin equipo ni talentos: sus atributos finales tal cual). */
    ghost(x) {
      if (!x || !D.species[x.s]) return null;
      const lv = Math.max(1, Math.min(DK.config.maxLevel, x.l | 0));
      const d = DK.daskai.create(x.s, lv, { wild: true });
      delete d.wild;
      const S = {}, cap = 50000;
      DK.data.statKeys.forEach((k) => { const v = x.st && +x.st[k]; S[k] = Math.max(1, Math.min(cap, Number.isFinite(v) && v > 0 ? Math.round(v) : 10)); });
      d.ghost = { st: S };
      if (x.nat && D.natures[x.nat]) d.nature = x.nat;
      if (x.pas && D.passives[x.pas]) d.passive = x.pas;
      const mv = (Array.isArray(x.mv) ? x.mv : []).filter((m) => D.moves[m]).slice(0, DK.config.maxMoves);
      if (mv.length) { d.moves = mv; d.learned = Array.from(new Set(d.learned.concat(mv))); }
      if (x.lk) d.look = x.lk;
      d.shiny = !!x.sh;
      if (x.h2 && D.houses[x.h2]) d.house2 = x.h2;
      if (x.fs) { d.forms = x.fs | 0; d.form = Math.max(0, Math.min(d.forms - 1, x.f | 0)); }
      if (x.v) d.variant = x.v;
      if (x.n) d.nickname = String(x.n).slice(0, 24);
      d.duelGhost = true;
      DK.daskai.touch(); DK.daskai.fullHeal(d);
      return d;
    },
    /** Premio de una victoria (sólo unas monedas, las primeras del día). */
    rewards(st0) {
      const s = st(), D0 = (s.duels = s.duels || { wins: 0, losses: 0, day: '', paid: 0 });
      if (D0.day !== today()) { D0.day = today(); D0.paid = 0; }
      const team = DK.party.active(), avg = team.reduce((a, d) => a + d.level, 0) / Math.max(1, team.length);
      const out = { exp: 0, coins: 0, drops: [], levelInfo: { levels: [], pending: [], evolveReady: false }, shared: [], duel: true };
      if (D0.paid < this.DAILY_REWARDS) { out.coins = Math.round(40 + avg * 6); D0.paid++; DK.wallet.add(out.coins, { silent: true }); } else out.capped = true;
      DK.store.save();
      return out;
    },
    /** Cierra el duelo: tu equipo vuelve como estaba, se apunta y se envía el resultado. */
    finish(st0) {
      const s = st(), D0 = (s.duels = s.duels || { wins: 0, losses: 0, day: '', paid: 0 });
      const won = st0.outcome === 'won';
      (st0.duel.saved || []).forEach((x) => { const d = DK.party.get(x.uid); if (d) { d.cur.hp = x.hp; d.cur.mp = x.mp; d.status = x.status; } });
      if (won) D0.wins++; else D0.losses++;
      st0.allyCache = DK.battle.ally(st0); st0.dead = []; st0.saved = [];
      DK.store.save();
      st0.duel.result = O().rpc('duel_report', Object.assign(O().auth(), { p_token: st0.duel.token, p_won: won })).catch(() => null);
      st0.duel.result.then((r) => { if (r && !r.error) { D0.rating = r.rating; DK.store.save(); } });
      DK.emit('duel:end', { won, tid: st0.duel.tid });
    },
    stats() { const s = st(); return (s && s.duels) || { wins: 0, losses: 0 }; },
  };

  /* ------------------------------ Clanes ------------------------------ */
  const srpc = (n, b) => O().rpc(n, Object.assign(O().auth(), b || {})).then((r) => (r == null ? 'ok' : r), () => 'error');
  DK.clans = {
    TIERS: [5000, 15000, 30000],
    ICONS: ['flag', 'shield', 'swords', 'crown', 'flame', 'leaf', 'moon', 'star', 'skull', 'gem', 'paw', 'sparkles'],
    COLORS: ['#b45309', '#b91c1c', '#7c3aed', '#2563eb', '#0f766e', '#15803d', '#be185d', '#475569'],
    /** Premio de cada meta del contrato del clan. */
    reward(tier) { return [{ coins: 400, emblems: 1 }, { coins: 900, emblems: 2, items: { superpocion: 2 } }, { coins: 1800, emblems: 4, items: { elixir: 1 } }][tier - 1]; },
    ok() { return DK.duels.ok(); },
    async info() { await O().saveProfile().catch(() => null); const r = await O().rpc('clan_info', O().auth()); this.last = r; return r; },
    async search(q) { const r = await O().rpc('clan_search', { p_q: q || '' }); return Array.isArray(r) ? r : []; },
    create(o) { return srpc('clan_create', { p_tag: String(o.tag || '').toUpperCase(), p_name: o.name, p_descr: o.descr || '', p_icon: o.icon, p_color: o.color, p_open: !!o.open }); },
    edit(o) { return srpc('clan_edit', { p_name: o.name, p_descr: o.descr || '', p_icon: o.icon, p_color: o.color, p_open: !!o.open }); },
    join(id) { return srpc('clan_join', { p_clan: id }); },
    leave() { return srpc('clan_leave'); },
    manage(action, tid) { return srpc('clan_manage', { p_action: action, p_tid: tid }); },
    async chat(after = 0) { const r = await O().rpc('clan_chat_fetch', Object.assign(O().auth(), { p_after: after | 0 })); return (Array.isArray(r) ? r : []).reverse(); },
    say(text) { return srpc('clan_chat_send', { p_text: text }); },
    async claim(tier) {
      const r = await srpc('clan_claim', { p_tier: tier });
      if (r === 'ok') {
        const g = this.reward(tier);
        if (g.coins) DK.wallet.add(g.coins);
        if (g.emblems && DK.camp && DK.camp.addEmblems) DK.camp.addEmblems(g.emblems);
        Object.entries(g.items || {}).forEach(([id, n]) => { if (D.items[id]) DK.bag.addHome ? DK.bag.addHome({ [id]: n }) : DK.bag.add(id, n); });
        DK.store.save();
      }
      return r;
    },
    seen() { const me = O().me() || {}; return me.clanSeen || 0; },
    markSeen(id) { const me = O().me(); if (me && (id | 0) > (me.clanSeen || 0)) { me.clanSeen = id | 0; DK.store.save(); } O().recount(); },
  };
})();
