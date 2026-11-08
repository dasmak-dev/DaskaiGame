/* =============================================================
 * systems/gear.js — Piezas de equipamiento con rareza y afijos (v4.74).
 *
 *   DK.gear.create(base, { rarity, ilvl })   → pieza nueva (no la guarda)
 *   DK.gear.gain(base, opts)                 → la crea y la guarda (armería o botín)
 *   DK.gear.list() / home() / found()        → piezas sin equipar
 *   DK.gear.equip(d, slot, uid) / unequip(d, slot)
 *   DK.gear.forge(uid, piedra, { affix })    → usa una piedra de forja
 *   DK.gear.salvage(uid)                     → desguaza (fragmentos de forja)
 *   DK.gear.flat(p) · pct(p) · fx(p)         → lo que da una pieza
 *   DK.gear.fxOf(d)                          → efectos de combate de un daskai
 *
 * Una pieza:
 *   { uid, base, rarity, ilvl, attrs: [{ k, r }], affixes: [{ id, t, r }], nm: [i, j], v }
 *     attrs: atributos planos del pool de su base; r = tirada 0–1 (el valor se calcula)
 *     affixes: prefijos/sufijos (data/gear.js → affixes) con su tier t (1–5) y tirada r
 *     nm: nombre de las raras (dos palabras de lang → gear.rareA / rareB)
 *     v: versión (sube al forjarla; para la caché de atributos)
 *
 * Dónde están:
 *   · st.gear: la armería de casa (sin equipar)
 *   · d.equip[slot]: equipada en un daskai (la pieza entera)
 *   · e.loot.gear: lo encontrado en la expedición en curso (se puede equipar ya;
 *     al terminar va a la armería, con las mismas reglas que el resto del botín)
 * La forja y el desguace sólo se usan en casa.
 * ============================================================= */
(function () {
  const D = DK.data, U = DK.util;
  const G = () => D.gear;
  const { t } = DK;
  const st = () => DK.store.state;

  const RAR = () => G().rarities;
  const isGear = (id) => !!(D.items[id] && D.items[id].category === 'equipo');
  const randInt = (a, b, rnd = Math.random) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (arr, rnd = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  /** Pool de atributos de una base: sus atributos positivos + afines (data/gear.js → affinity). */
  /** v4.78: atributo principal de una base (el de su tipo; data/gear.js → primary). */
  const primaryOf = (base) => G().primary[G().typeOf[base]] || 'atk';
  /** Prefijos y sufijos que puede tener una base (los de la familia de su atributo principal). */
  const allowedAffixes = (base, rarity) => {
    const fam = G().affixPools[primaryOf(base)] || Object.keys(G().affixes).filter((id) => !G().affixes[id].only);
    const ex = G().typeAffix && G().typeAffix[G().typeOf[base]]; // v4.81: el exclusivo de su tipo
    let all = ex && !fam.includes(ex) ? fam.concat(ex) : fam;
    all = all.concat(resAffixes(base)); // v4.89: resistencias a casas (según el tipo)
    // v4.85: los normales, sólo los básicos (sin exclusivo)
    return rarity && RAR()[rarity] && RAR()[rarity].basicOnly ? all.filter((id) => G().basicAffixes.includes(id)) : all;
  };
  /** v4.89: resistencias que admite una base (las dagas, sólo la de su casa; las armas de ataque, ninguna). */
  const resAffixes = (base) => {
    const ty = G().typeOf[base]; if (!G().resMax || !G().resMax[ty]) return [];
    const only = (G().resHouse || {})[base];
    if (ty === 'daga' && !only) return [];
    return Object.keys(G().affixes).filter((id) => G().affixes[id].res && (!only || G().affixes[id].res === only));
  };
  /** v4.89: ¿no cabe esta resistencia? (tope de su tipo o ya tiene una de esa casa). `not`: ids que se van a quitar. */
  const resBlocked = (p, a, not = []) => {
    if (!a.res) return false;
    const mine = p.affixes.filter((x) => !not.includes(x.id) && G().affixes[x.id] && G().affixes[x.id].res);
    return mine.length >= (G().resMax[G().typeOf[p.base]] || 0) || mine.some((x) => G().affixes[x.id].res === a.res);
  };
  /** v4.85: tier máximo de un afijo según la rareza y el nivel de objeto. */
  const maxTierOf = (p) => Math.max(1, Math.min((RAR()[p.rarity] || {}).maxTier || 5, G().tiers.ilvl.filter((min) => (p.ilvl || 0) >= min).length));
  /** v4.81: peso al tirar un afijo (más si lo favorece la base; el exclusivo de su tipo, el doble). */
  const affixWeight = (a, pool) => (1 + (a.boost || []).filter((k) => pool.slice(0, 2).includes(k)).length * 1.5) * (a.only ? 2 : 1) * (a.res ? G().resWeight || 1 : 1);

  function poolOf(base) {
    const it = D.items[base], out = [primaryOf(base)]; // el principal, siempre el primero
    Object.entries(it.stats || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).forEach(([k]) => out.includes(k) || out.push(k));
    for (let i = 0; out.length < G().poolSize && i < 6; i++) out.slice().forEach((k) => (G().affinity[k] || []).forEach((x) => { if (out.length < G().poolSize && !out.includes(x)) out.push(x); }));
    ['hp', 'def', 'mdef', 'spd', 'atk', 'matk', 'mp'].forEach((k) => { if (out.length < G().poolSize && !out.includes(k)) out.push(k); });
    return out;
  }

  /** Valor de un atributo plano de una pieza (se calcula: así subir de rareza lo mejora). */
  function attrValue(p, a) {
    const it = D.items[p.base], R = RAR()[p.rarity];
    const own = it.stats && it.stats[a.k] > 0 ? Math.max(1, it.stats[a.k] / (G().units[a.k] * (G().baseTier[it.rarity] || 1))) : 1; // la base ya favorece ese atributo
    const main = a.k === primaryOf(p.base) ? G().primaryBoost : 1; // el principal pesa más
    const raw = G().units[a.k] * (G().baseTier[it.rarity] || 1) * Math.min(own, 1.6) * main * (1 + (p.ilvl || 1) / G().ilvlScale) * R.power * (G().roll[0] + (G().roll[1] - G().roll[0]) * a.r);
    // La regeneración (% por turno) no escala con el nivel del objeto: 1–3
    return a.k === 'regen' ? Math.min(3, Math.max(1, Math.round(raw / (1 + (p.ilvl || 1) / G().ilvlScale)))) : Math.max(1, Math.round(raw));
  }
  /** v4.80: rango [mín, máx] de un atributo plano con su rareza y nivel actuales. */
  const attrRange = (p, a) => [attrValue(p, Object.assign({}, a, { r: 0 })), attrValue(p, Object.assign({}, a, { r: 1 }))];
  /** Valor de un afijo (en %). */
  function affixValue(a) {
    const def = G().affixes[a.id]; if (!def) return 0;
    const [lo, hi] = def.tiers[a.t - 1];
    return Math.round(lo + (hi - lo) * a.r);
  }

  /** Tier al azar para un nivel de objeto (los altos, más raros). */
  function rollTier(ilvl, rnd = Math.random, cap = 5) {
    const T = G().tiers, w = {};
    T.ilvl.forEach((min, i) => { if ((ilvl || 0) >= min && i < cap) w[i + 1] = T.weight[i]; });
    return +U.weightedKey(w, rnd, '1');
  }
  /** Afijo nuevo de un tipo (prefix/suffix) que la pieza aún no tenga. */
  function rollAffix(p, kind, rnd = Math.random, not = []) {
    const pool = poolOf(p.base), have = p.affixes.map((a) => a.id).concat(not), w = {}, ok = allowedAffixes(p.base, p.rarity);
    Object.entries(G().affixes).forEach(([id, a]) => {
      if (a.kind !== kind || have.includes(id) || !ok.includes(id) || resBlocked(p, a, not)) return;
      w[id] = affixWeight(a, pool);
    });
    const id = Object.keys(w).length ? U.weightedKey(w, rnd) : null;
    return id ? { id, t: rollTier(p.ilvl, rnd, maxTierOf(p)), r: rnd() } : null;
  }
  const kindOf = (a) => G().affixes[a.id] && G().affixes[a.id].kind;
  const countKind = (p, kind) => p.affixes.filter((a) => kindOf(a) === kind).length;

  /** Rellena atributos hasta n (sin repetir, del pool de su base). */
  function fillAttrs(p, n, rnd = Math.random) {
    // v4.78: el atributo principal siempre está y va el primero
    const main = primaryOf(p.base);
    if (!p.attrs.some((a) => a.k === main)) p.attrs.unshift({ k: main, r: rnd() });
    const free = shuffle(poolOf(p.base).filter((k) => !p.attrs.some((a) => a.k === k)), rnd);
    while (p.attrs.length < n && free.length) p.attrs.push({ k: free.shift(), r: rnd() });
  }
  /** Añade afijos hasta n respetando el tope de prefijos y sufijos de su rareza. */
  function fillAffixes(p, n, rnd = Math.random) {
    const R = RAR()[p.rarity];
    let guard = 12;
    while (p.affixes.length < n && guard-- > 0) {
      const canP = countKind(p, 'prefix') < R.maxP, canS = countKind(p, 'suffix') < R.maxS;
      if (!canP && !canS) break;
      const kind = canP && canS ? (rnd() < 0.5 ? 'prefix' : 'suffix') : canP ? 'prefix' : 'suffix';
      const a = rollAffix(p, kind, rnd); if (a) p.affixes.push(a);
    }
  }
  /** Lleva la pieza a su rareza: atributos y afijos hasta un número al azar del rango (sin quitar). */
  function topUp(p, rnd = Math.random) {
    const R = RAR()[p.rarity];
    fillAttrs(p, Math.max(p.attrs.length, randInt(R.attrs[0], R.attrs[1], rnd)), rnd);
    fillAffixes(p, Math.max(p.affixes.length, randInt(R.affixes[0], R.affixes[1], rnd)), rnd);
    if ((p.rarity === 'raro' || p.rarity === 'legendario') && !p.nm) p.nm = [Math.floor(rnd() * 1000), Math.floor(rnd() * 1000)];
  }
  const bump = (p) => { p.v = (p.v || 0) + 1; DK.daskai.touch(); };

  /** Nivel de objeto por defecto: el nivel medio de tu equipo. */
  function defaultIlvl() {
    const team = st() ? DK.party.active() : [];
    return team.length ? Math.round(team.reduce((a, d) => a + d.level, 0) / team.length) : 5;
  }

  const api = {
    isGear,
    poolOf,
    defaultIlvl,
    attrValue, attrRange, affixValue, maxTierOf,
    /** Rareza al azar según el tipo de combate (data/gear.js → rarities.*.drop). */
    rollRarity(src = 'fight', rnd = Math.random) {
      const w = {}; Object.entries(RAR()).forEach(([id, r]) => { if (r.drop[src]) w[id] = r.drop[src]; });
      return U.weightedKey(w, rnd, 'normal');
    },
    /** Pieza nueva de una base. o: { rarity, ilvl, rnd } */
    create(base, o = {}) {
      const rnd = o.rnd || Math.random;
      const lv = (o.ilvl || defaultIlvl()) + (o.jitter === false ? 0 : randInt(-2, 2, rnd)); // v4.75: del nivel de quien lo suelta (±2)
      const p = { uid: U.uid(), base, rarity: RAR()[o.rarity] ? o.rarity : 'normal', ilvl: Math.max(1, Math.min(100, Math.round(lv))), attrs: [], affixes: [], v: 0, nn: Math.floor(rnd() * 0xffffffff) };
      topUp(p, rnd);
      return p;
    },
    /**
     * Crea una pieza y la guarda: en la expedición, en su botín (e.loot.gear);
     * en casa, en la armería. Devuelve la pieza.
     */
    gain(base, o = {}) {
      const p = this.create(base, o);
      const e = st().expedition;
      if (e && !o.home) { e.loot.gear = e.loot.gear || []; e.loot.gear.push(p); }
      else this.home().push(p);
      DK.codex && DK.codex.markItem(base);
      DK.emit('gear:gained', { p });
      return p;
    },
    /** Armería de casa (piezas sin equipar). */
    home() { const s = st(); s.gear = s.gear || []; return s.gear; },
    /** Lo encontrado en la expedición en curso. */
    found() { const e = st().expedition; return e ? ((e.loot.gear = e.loot.gear || [])) : []; },
    /** Piezas que puedes equipar ahora: en expedición, lo encontrado; en casa, la armería. */
    list() { return st().expedition ? this.found() : this.home(); },
    /** Piezas equipadas en tus daskai: [{ p, d, slot }]. */
    equipped() {
      const out = [];
      DK.party.all().forEach((d) => (d.equip || []).forEach((p, slot) => { if (p && typeof p === 'object') out.push({ p, d, slot }); }));
      return out;
    },
    /** Busca una pieza por uid: { p, where: 'home'|'found'|'equip', d, slot }. */
    find(uid) {
      let x = this.home().find((p) => p.uid === uid); if (x) return { p: x, where: 'home' };
      const e = st().expedition; x = e && (e.loot.gear || []).find((p) => p.uid === uid); if (x) return { p: x, where: 'found' };
      const q = this.equipped().find((o) => o.p.uid === uid); return q ? { p: q.p, where: 'equip', d: q.d, slot: q.slot } : null;
    },
    /** Cuántas piezas NORMALES sin equipar hay de una base (para recetas que la usan de ingrediente). */
    countBase(base) { return this.list().filter((p) => p.base === base && p.rarity === 'normal').length; },
    /** ¿Tienes (o llevas puesta) alguna pieza de esa base? */
    ownsBase(base) { return this.home().some((p) => p.base === base) || this.found().some((p) => p.base === base) || this.equipped().some((o) => o.p.base === base); },
    /** Quita n piezas normales de una base (la de menor nivel primero). */
    takeBase(base, n = 1) {
      const list = this.list(), pick = list.filter((p) => p.base === base && p.rarity === 'normal').sort((a, b) => a.ilvl - b.ilvl).slice(0, n);
      if (pick.length < n) return false;
      pick.forEach((p) => list.splice(list.indexOf(p), 1));
      return true;
    },
    remove(uid) {
      [this.home(), this.found()].forEach((l) => { const i = l.findIndex((p) => p.uid === uid); if (i >= 0) l.splice(i, 1); });
    },

    /* ---------------- Lo que da una pieza ---------------- */
    /** Atributos planos: { atk: 9, hp: 50, regen: 1 }. */
    flat(p) {
      const out = {};
      if (!p) return out;
      if (typeof p === 'string') { Object.assign(out, (D.items[p] && D.items[p].stats) || {}); return out; }
      p.attrs.forEach((a) => (out[a.k] = (out[a.k] || 0) + attrValue(p, a)));
      return out;
    },
    /** % a atributos de sus prefijos: { atk: 0.12 }. */
    pct(p) {
      const out = {};
      if (!p || typeof p !== 'object') return out;
      p.affixes.forEach((a) => { const def = G().affixes[a.id]; if (def && def.pct) out[def.pct] = (out[def.pct] || 0) + affixValue(a) / 100; });
      return out;
    },
    /** Efectos de combate de sus afijos (en tanto por uno; regen en %). */
    fx(p) {
      const out = {};
      if (!p || typeof p !== 'object') return out;
      p.affixes.forEach((a) => { const def = G().affixes[a.id]; if (def && def.fx) out[def.fx] = (out[def.fx] || 0) + (def.fx === 'regen' ? affixValue(a) : affixValue(a) / 100); });
      return out;
    },
    /** Pasiva exclusiva (sólo legendarias). */
    passive(p) { if (!p || typeof p !== 'object' || p.rarity !== 'legendario') return null; const id = p.lp && D.passives[p.lp] ? p.lp : 'leg_' + p.base; return D.passives[id] ? id : null; },
    /** Efectos de combate de un daskai (equipo + pasivas legendarias), con sus topes. */
    fxOf(d, equip = d && d.equip) {
      const out = {};
      (equip || []).forEach((p) => {
        Object.entries(this.fx(p)).forEach(([k, v]) => { if (k !== 'regen') out[k] = (out[k] || 0) + v; });
        const lp = this.passive(p); if (lp && D.passives[lp].fx) Object.entries(D.passives[lp].fx).forEach(([k, v]) => (out[k] = (out[k] || 0) + v));
      });
      Object.keys(out).forEach((k) => { if (G().caps[k] != null) out[k] = Math.min(G().caps[k], out[k]); });
      return out;
    },
    /** Clave para la caché de atributos. */
    key(p) { return !p ? '-' : typeof p === 'string' ? p : p.uid + '.' + (p.v || 0) + p.rarity; },

    /* ---------------- Nombre ---------------- */
    name(p) {
      if (!p) return '';
      if (typeof p === 'string') return D.items[p] ? D.items[p].name : p;
      const base = D.items[p.base].name;
      if (p.rarity === 'legendario') return DK.tr('passives', D.passives[this.passive(p) || 'leg_' + p.base]) || base;
      if (p.rarity === 'raro' || p.rarity === 'legendario') {
        const A = t('gear.rareA').split('|'), B = t('gear.rareB').split('|');
        return `${A[p.nm[0] % A.length]} ${B[p.nm[1] % B.length]}`;
      }
      // v4.76: cada pieza tiene su nombre propio (como los daskai): «Daga de Velmir»
      const type = this.typeName(p);
      if (p.rarity === 'magico') {
        const pre = p.affixes.find((a) => kindOf(a) === 'prefix'), suf = p.affixes.find((a) => kindOf(a) === 'suffix');
        return t('gear.magicName', { base: type, pre: pre ? t(`gear.affix.${pre.id}.name`) : '', suf: suf ? t(`gear.affix.${suf.id}.name`) : '' }).replace(/\s+/g, ' ').trim();
      }
      return t('gear.normalName', { type, name: this.properName(p) });
    },
    /** Tipo de una base o pieza (daga, corona…) y su nombre. */
    type(p) { const base = typeof p === 'string' ? p : p.base; return G().typeOf[base] || 'amuleto'; },
    typeName(p, many = false) { return t(`gear.type.${this.type(p)}.${many ? 'many' : 'one'}`); },
    /** Nombre propio de la pieza (sílabas de data/gear.js → syl), fijo para cada pieza. */
    properName(p) {
      const S = G().syl;
      let h = p.nn != null ? p.nn >>> 0 : [...String(p.uid)].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 7);
      const pick = (arr) => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return arr[h % arr.length]; };
      return pick(S.a) + pick(S.b) + pick(S.c);
    },
    /** Texto de un afijo: «+12% ataque físico». */
    affixText(a) { return t(`gear.affix.${a.id}.text`, { v: affixValue(a) }); },
    /** Rango de su tier: «(9–12)». */
    affixRange(a) { const [lo, hi] = G().affixes[a.id].tiers[a.t - 1]; return lo === hi ? `${lo}` : `${lo}–${hi}`; },
    kindOf,
    /** Precio de venta al mercader. */
    sellPrice(p) { const base = D.prices[p.base] || 100; return Math.round(base * DK.config.sellRatio * [1, 1.6, 2.6, 4][RAR()[p.rarity].order - 1]); },

    /* ---------------- Equipar ---------------- */
    /** Equipa una pieza (de la armería en casa o del botín en expedición). El que hubiera vuelve a la lista. */
    equip(d, slot, uid) {
      const list = this.list(), i = list.findIndex((p) => p.uid === uid);
      if (i < 0) return false;
      const p = list.splice(i, 1)[0];
      const old = d.equip[slot];
      if (old) this.stash(old);
      d.equip[slot] = p;
      DK.daskai.touch(); DK.daskai.clamp(d);
      DK.store.save();
      return true;
    },
    unequip(d, slot) {
      const old = d.equip[slot]; if (!old) return false;
      this.stash(old);
      d.equip[slot] = null;
      DK.daskai.touch(); DK.daskai.clamp(d);
      DK.store.save();
      return true;
    },
    /** Guarda una pieza quitada (en expedición va al botín; en casa, a la armería). */
    stash(p) {
      if (typeof p === 'string') { if (isGear(p)) this.list().push(this.create(p, { rarity: 'normal' })); return; }
      this.list().push(p);
    },
    /** Diferencias de atributos si se equipa la pieza `uid` en `slot`. */
    preview(d, slot, uid) {
      const x = this.find(uid); if (!x) return {};
      const before = DK.daskai.stats(d);
      const eq = d.equip.slice(); eq[slot] = x.p;
      const after = DK.daskai.stats(d, eq), out = {};
      [...D.statKeys, 'regen'].forEach((k) => { if (after[k] !== before[k]) out[k] = { from: before[k], to: after[k], diff: after[k] - before[k] }; });
      return out;
    },

    /* ---------------- Forja ---------------- */
    /** Piedras de forja, por grupos (en el orden de la pantalla de Forja). */
    groups: {
      rarity: ['piedra_transmutacion', 'piedra_alquimia', 'piedra_regia', 'corazon_jefe'],
      reroll: ['piedra_alteracion', 'piedra_caos', 'piedra_nucleo', 'piedra_divina', 'piedra_purga'],
      affix: ['piedra_aumento', 'piedra_exaltacion', 'piedra_cambio', 'esquirla_jefe', 'piedra_templado', 'sello_forja', 'piedra_anulacion'],
      legend: ['eco_legendario'],
    },
    get stones() { return [].concat(...Object.values(this.groups)); },
    /** Piedras que actúan sobre UN afijo elegido (o.affix). */
    targeted: ['piedra_cambio', 'esquirla_jefe', 'piedra_templado', 'sello_forja'],
    /** Piedras que añaden un afijo (o.kind: 'prefix' | 'suffix' para elegir cuál). */
    adders: ['piedra_aumento', 'piedra_exaltacion'],
    /** Huecos de afijo de la pieza: { P: [usados, máx], S: [usados, máx], total: máx } */
    slots(p) {
      const R = RAR()[p.rarity];
      return { P: [countKind(p, 'prefix'), R.maxP], S: [countKind(p, 'suffix'), R.maxS], total: R.affixes[1] };
    },
    /** ¿Cabe un afijo más? (tope total de su rareza y hueco de prefijo o sufijo) */
    hasRoom(p, kind) { const s = this.slots(p); if (p.affixes.length >= s.total) return false; return kind === 'prefix' ? s.P[0] < s.P[1] : kind === 'suffix' ? s.S[0] < s.S[1] : s.P[0] < s.P[1] || s.S[0] < s.S[1]; },
    /** La piedra que añade un afijo a esta pieza (aumento en mágicas, exaltación en raras/legendarias) o null. */
    adderFor(p) { return p.rarity === 'magico' ? 'piedra_aumento' : p.rarity === 'raro' || p.rarity === 'legendario' ? 'piedra_exaltacion' : null; },
    /**
     * Afijos que le pueden salir (para planificar): [{ id, kind, chance (0–1 entre los de su tipo), maxT, range }]
     * excluye los que ya tiene; maxT = el mejor tier que permite su nivel de objeto.
     */
    affixPool(p) {
      const pool = poolOf(p.base), have = p.affixes.map((a) => a.id), out = [];
      const maxT = maxTierOf(p);
      ['prefix', 'suffix'].forEach((kind) => {
        const ok = allowedAffixes(p.base, p.rarity);
        const list = Object.entries(G().affixes).filter(([id, a]) => a.kind === kind && !have.includes(id) && ok.includes(id) && !resBlocked(p, a))
          .map(([id, a]) => ({ id, kind, w: affixWeight(a, pool), maxT, range: a.tiers[maxT - 1], only: a.only || null }));
        const tot = list.reduce((x, y) => x + y.w, 0) || 1;
        list.forEach((x) => out.push(Object.assign(x, { chance: x.w / tot })));
      });
      return out.sort((a, b) => (a.kind === b.kind ? b.chance - a.chance : a.kind === 'prefix' ? -1 : 1));
    },
    /** Probabilidad de cada tier para su nivel de objeto: [{ t, chance }] */
    tierChances(p) {
      const T = G().tiers, cap = maxTierOf(p), w = T.ilvl.map((min, i) => ((p.ilvl || 0) >= min && i < cap ? T.weight[i] : 0)), tot = w.reduce((a, b) => a + b, 0) || 1;
      return w.map((x, i) => ({ t: i + 1, chance: x / tot })).filter((x) => x.chance > 0);
    },
    /**
     * ¿Se puede usar esa piedra en la pieza? Devuelve null si sí o el motivo.
     * Las de un afijo concreto (targeted) necesitan además o.affix (índice) para comprobarlo del todo.
     */
    cannotForge(p, stone, o = {}) {
      if (!p) return t('gear.why.none');
      if (st().expedition) return t('gear.why.inExp');
      if (DK.bag.home()[stone] == null || DK.bag.home()[stone] < 1) return t('gear.why.noStone');
      const r = p.rarity, rare = r === 'raro' || r === 'legendario', a = o.affix != null ? p.affixes[o.affix] : null;
      if (this.targeted.includes(stone)) {
        if (!p.affixes.length) return t('gear.why.noAffix');
        if (o.affix != null && !a) return t('gear.why.noAffix');
      }
      // v4.84: las piezas fabricadas llegan como mucho a mágicas (lo raro sale de las expediciones)
      if (p.cf && ['piedra_alquimia', 'piedra_regia', 'corazon_jefe'].includes(stone)) return t('gear.why.crafted');
      switch (stone) {
        case 'piedra_transmutacion': return r === 'normal' ? null : t('gear.why.needNormal');
        case 'piedra_alquimia': return r === 'normal' ? null : t('gear.why.needNormal');
        case 'piedra_regia': return r === 'magico' ? null : t('gear.why.needMagic');
        case 'corazon_jefe': return r === 'raro' ? null : t('gear.why.needRare');
        case 'piedra_alteracion': return r === 'magico' ? null : t('gear.why.needMagic');
        case 'piedra_caos': return rare ? null : t('gear.why.needRare');
        case 'piedra_divina': return null;
        case 'piedra_nucleo': return p.attrs.length ? null : t('gear.why.noMain');
        case 'piedra_purga': return r === 'magico' || r === 'raro' ? null : t('gear.why.needMagicRare');
        case 'piedra_aumento': return r !== 'magico' ? t('gear.why.needMagic') : !this.hasRoom(p, o.kind) ? t('gear.why.full') : null;
        case 'piedra_exaltacion': return !rare ? t('gear.why.needRare') : !this.hasRoom(p, o.kind) ? t('gear.why.full') : null;
        case 'piedra_cambio': return a && a.lock ? t('gear.why.locked') : null;
        case 'piedra_anulacion': return r === 'normal' ? t('gear.why.needMagicRare') : p.affixes.filter((x) => !x.lock).length < 1 || p.affixes.length < 2 ? t('gear.why.tooFew') : null;
        case 'esquirla_jefe': return a && a.lock ? t('gear.why.locked') : null;
        case 'piedra_templado': return a && a.t >= 5 ? t('gear.why.maxTier') : a && a.t >= maxTierOf(p) && maxTierOf(p) === (RAR()[p.rarity].maxTier || 5) ? t('gear.why.rarityTier', { n: maxTierOf(p) }) : a && G().tiers.ilvl[a.t] > (p.ilvl || 0) ? t('gear.why.lowIlvl', { n: G().tiers.ilvl[a.t] }) : null;
        case 'sello_forja': return a && a.lock ? t('gear.why.locked') : null;
        case 'eco_legendario': return r === 'legendario' ? null : t('gear.why.needLegend');
        default: return t('gear.why.noStone');
      }
    },
    /**
     * Usa una piedra de forja en la pieza `uid` (en casa). o.affix: índice del afijo (piedras de un afijo).
     * Un afijo sellado (lock) sobrevive a la siguiente alteración, caos o anulación (y el sello se gasta).
     * @returns {{ok, msg, p, before}} before: copia de la pieza antes (para enseñar qué cambió)
     */
    forge(uid, stone, o = {}) {
      const x = this.find(uid), p = x && x.p;
      if (p && this.targeted.includes(stone) && o.affix == null) return { ok: false, msg: t('gear.why.pickAffix') };
      const why = this.cannotForge(p, stone, o);
      if (why) return { ok: false, msg: why };
      const rnd = o.rnd || Math.random;
      const before = JSON.parse(JSON.stringify(p));
      const fromName = this.name(p);
      // Re-tirar afijos respetando el sellado: se queda y el sello se gasta
      const reroll = (range) => {
        const kept = p.affixes.filter((a) => a.lock).map((a) => { delete a.lock; return a; });
        p.affixes = kept;
        fillAffixes(p, Math.max(kept.length, randInt(range[0], range[1], rnd)), rnd);
      };
      switch (stone) {
        case 'piedra_transmutacion': p.rarity = 'magico'; topUp(p, rnd); break;
        case 'piedra_alquimia': p.rarity = 'raro'; topUp(p, rnd); break;
        case 'piedra_regia': p.rarity = 'raro'; topUp(p, rnd); break;
        case 'corazon_jefe': p.rarity = 'legendario'; topUp(p, rnd); break;
        case 'piedra_alteracion': reroll(RAR().magico.affixes); break;
        case 'piedra_caos': reroll(RAR()[p.rarity].affixes); p.nm = [Math.floor(rnd() * 1000), Math.floor(rnd() * 1000)]; break;
        case 'piedra_divina': p.attrs.forEach((a) => (a.r = rnd())); p.affixes.forEach((a) => (a.r = rnd())); break;
        // v4.80: sólo el valor del atributo principal (el primero), dentro de su rango
        case 'piedra_nucleo': { const m = p.attrs.find((a) => a.k === primaryOf(p.base)) || p.attrs[0]; m.r = rnd(); break; }
        case 'piedra_purga': p.rarity = 'normal'; p.attrs = p.attrs.slice(0, randInt(...RAR().normal.attrs, rnd)); p.affixes = p.affixes.slice(0, 1).map((a) => { delete a.lock; return a; }); delete p.nm; delete p.lp; break;
        case 'piedra_aumento': case 'piedra_exaltacion': {
          // v4.79: se puede elegir si añade un prefijo o un sufijo
          if (o.kind) { const n = rollAffix(p, o.kind, rnd); if (n) p.affixes.push(n); } else fillAffixes(p, p.affixes.length + 1, rnd);
          break;
        }
        case 'piedra_cambio': { const old = p.affixes[o.affix]; p.affixes[o.affix] = rollAffix(p, kindOf(old), rnd, [old.id]) || { id: old.id, t: rollTier(p.ilvl, rnd, maxTierOf(p)), r: rnd() }; break; }
        case 'piedra_anulacion': {
          const free = p.affixes.filter((a) => !a.lock), gone = free[Math.floor(rnd() * free.length)];
          p.affixes = p.affixes.filter((a) => a !== gone); p.affixes.forEach((a) => delete a.lock); break;
        }
        case 'esquirla_jefe': {
          const i = o.affix, old = p.affixes[i];
          // v4.79: la esquirla de jefe nunca baja el nivel del afijo
          const n = rollAffix(p, kindOf(old), rnd, [old.id]) || { id: old.id, t: rollTier(p.ilvl, rnd, maxTierOf(p)), r: rnd() };
          n.t = Math.max(n.t, old.t); p.affixes[i] = n; break;
        }
        case 'piedra_templado': p.affixes[o.affix].t++; break;
        case 'sello_forja': p.affixes.forEach((a) => delete a.lock); p.affixes[o.affix].lock = true; break;
        case 'eco_legendario': {
          const all = Object.keys(G().legendary).map((b) => 'leg_' + b).filter((id) => id !== this.passive(p));
          p.lp = all[Math.floor(rnd() * all.length)]; break;
        }
      }
      DK.bag.home()[stone]--; if (DK.bag.home()[stone] <= 0) delete DK.bag.home()[stone];
      bump(p);
      // Historial de la pieza (lo último arriba; 12 como mucho)
      p.hist = [{ s: stone, at: Date.now(), from: fromName, to: this.name(p), rar: p.rarity }].concat(p.hist || []).slice(0, 12);
      st().stats.forged = (st().stats.forged || 0) + 1;
      if (x.d) DK.daskai.clamp(x.d);
      DK.emit('gear:forged', { p, stone });
      DK.store.save();
      return { ok: true, msg: t('gear.forged.' + stone, { name: this.name(p) }), p, before };
    },
    /**
     * v4.84: qué hará una piedra ANTES de usarla (para la confirmación de la forja).
     * @returns {{keys:Set, lines:[{text, kind}], odds:[{text, chance, only}]}}  keys = filas de la ficha que cambian
     */
    forgePreview(p, stone, o = {}) {
      const keys = new Set(), lines = [], odds = [];
      const line = (k, v, kind = '') => lines.push({ text: t('gear.pv.' + k, v || {}), kind });
      const unlocked = p.affixes.map((a, i) => (a.lock ? -1 : i)).filter((i) => i >= 0);
      const allAff = () => unlocked.forEach((i) => keys.add('x' + i));
      const R = (r) => t('gear.rarity.' + r);
      const pool = (kind) => this.affixPool(p).filter((a) => !kind || a.kind === kind);
      const topOdds = (list) => { const tot = list.reduce((s, a) => s + a.w, 0) || 1; list.slice().sort((a, b) => b.w - a.w).slice(0, 4).forEach((a) => odds.push({ text: t(`gear.affix.${a.id}.text`, { v: `${a.range[0]}–${a.range[1]}` }), chance: a.w / tot, only: a.only })); };
      const a = o.affix != null ? p.affixes[o.affix] : null;
      const locked = p.affixes.some((x) => x.lock);
      switch (stone) {
        case 'piedra_transmutacion': line('rarity', { a: R('normal'), b: R('magico') }, 'good'); line('adds', { n: '1–2' }); break;
        case 'piedra_alquimia': line('rarity', { a: R('normal'), b: R('raro') }, 'good'); line('adds', { n: '2–4' }); break;
        case 'piedra_regia': line('rarity', { a: R('magico'), b: R('raro') }, 'good'); line('adds', { n: 1 }); line('moreAttrs'); break;
        case 'corazon_jefe': line('rarity', { a: R('raro'), b: R('legendario') }, 'good'); line('passive'); break;
        case 'piedra_alteracion': case 'piedra_caos': allAff(); line('rerollAll', { n: unlocked.length }, 'warn'); if (locked) line('keepsLocked'); else line('canWorse', null, 'warn'); topOdds(pool()); break;
        case 'piedra_divina': p.attrs.forEach((_, i) => keys.add('a' + i)); p.affixes.forEach((_, i) => keys.add('x' + i)); line('values', null, 'warn'); line('canWorse', null, 'warn'); break;
        case 'piedra_purga': p.affixes.forEach((_, i) => keys.add('x' + i)); line('rarity', { a: R(p.rarity), b: R('normal') }, 'warn'); line('losesAll', { n: p.affixes.length }, 'warn'); break;
        case 'piedra_aumento': case 'piedra_exaltacion': line(o.kind ? 'addsKind' : 'adds', { n: 1, kind: o.kind ? t('gear.' + o.kind).toLowerCase() : '' }, 'good'); topOdds(pool(o.kind)); break;
        case 'piedra_anulacion': allAff(); line('removes', { n: unlocked.length }, 'warn'); break;
        case 'piedra_cambio': case 'esquirla_jefe': if (a) { keys.add('x' + o.affix); line('changes', { a: this.affixText(a) }, 'warn'); if (stone === 'esquirla_jefe') line('notWorse', { n: a.t }, 'good'); topOdds(pool(kindOf(a))); } break;
        case 'piedra_templado': if (a) { keys.add('x' + o.affix); line('temper', { a: a.t, b: a.t + 1 }, 'good'); } break;
        case 'sello_forja': if (a) { keys.add('x' + o.affix); line('seal', null, 'good'); if (locked) line('sealMoves'); } break;
        case 'piedra_nucleo': {
          const i = Math.max(0, p.attrs.findIndex((x) => x.k === primaryOf(p.base))), m = p.attrs[i];
          if (m) { const [lo, hi] = attrRange(p, m); keys.add('a' + i); line('main', { v: attrValue(p, m), a: lo, b: hi }, 'warn'); line('better', { n: Math.round((1 - m.r) * 100) }); }
          break;
        }
        case 'eco_legendario': keys.add('leg'); line('passiveNew', null, 'warn'); break;
        default: break;
      }
      return { keys, lines, odds };
    },
    /**
     * v4.84: calidad de la pieza (0–100): lo cerca que están sus valores del máximo a su nivel.
     * Atributos (el principal pesa el doble) y afijos (su tier frente al mejor posible a su nivel, y su valor).
     */
    quality(p) {
      if (!p || typeof p !== 'object') return { score: 0, grade: 'D' };
      const maxT = maxTierOf(p), main = primaryOf(p.base);
      let sum = 0, w = 0;
      p.attrs.forEach((a) => { const k = a.k === main ? 2 : 1; sum += a.r * k; w += k; });
      p.affixes.forEach((a) => { const k = 1.5; sum += (Math.min(1, a.t / maxT) * 0.7 + a.r * 0.3) * k; w += k; });
      const score = Math.round((w ? sum / w : 0) * 100);
      return { score, grade: score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D' };
    },
    /** v4.84: bloquear una pieza (no se puede desguazar por error). */
    toggleLock(uid) { const x = this.find(uid); if (!x) return false; x.p.lk = !x.p.lk; if (!x.p.lk) delete x.p.lk; DK.store.save(); return !!x.p.lk; },
    /** v4.84: la piedra que re-tira todos los afijos de esta pieza (alteración / caos) o null. */
    /** v4.84: fragmentos de forja extra por fabricar una pieza ya mágica. */
    magicCost: 12,
    rerollerFor(p) { return p.rarity === 'magico' ? 'piedra_alteracion' : p.rarity === 'raro' || p.rarity === 'legendario' ? 'piedra_caos' : null; },
    /**
     * v4.84: tirar hasta conseguirlo: usa la piedra de re-tirar (alteración o caos) hasta que la pieza
     * tenga alguno de los afijos buscados o se gasten `max` piedras.
     * @returns {{ok, n, hit, msg, before}}
     */
    rollUntil(uid, ids, max, rnd) {
      const x = this.find(uid), p = x && x.p;
      if (!p || !ids || !ids.length) return { ok: false, n: 0, msg: t('gear.why.none') };
      const stone = this.rerollerFor(p);
      const has = () => p.affixes.some((a) => ids.includes(a.id));
      if (has()) return { ok: false, n: 0, hit: true, msg: t('gear.until.already') };
      const before = JSON.parse(JSON.stringify(p));
      let n = 0;
      while (n < max && !has()) { const r = this.forge(uid, stone, { rnd, quiet: true }); if (!r.ok) { if (!n) return { ok: false, n, msg: r.msg }; break; } n++; }
      const hit = has();
      return { ok: true, n, hit, before, stone, msg: t(hit ? 'gear.until.hit' : 'gear.until.miss', { n, stone: D.items[stone].name }) };
    },
    /** v4.84: desguazar en lote: piezas sueltas, sin bloquear, de las rarezas dadas. */
    salvageMany(rarities) {
      if (st().expedition) return { ok: false, n: 0, f: 0 };
      const list = this.home().filter((p) => rarities.includes(p.rarity) && !p.lk);
      let f = 0; list.forEach((p) => { const r = this.salvage(p.uid); if (r.ok) f += r.got.fragmento_forja; });
      return { ok: true, n: list.length, f };
    },
    /** Fragmentos (y a veces una piedra) que da desguazar una pieza. */
    salvageValue(p) { return { fragmento_forja: RAR()[p.rarity].salvage + Math.floor((p.ilvl || 1) / 25) }; },
    /** Desguaza una pieza sin equipar (en casa). */
    salvage(uid) {
      if (st().expedition) return { ok: false, msg: t('gear.why.inExp') };
      const i = this.home().findIndex((p) => p.uid === uid); if (i < 0) return { ok: false, msg: t('gear.why.none') };
      if (this.home()[i].lk) return { ok: false, msg: t('gear.why.lockedPiece') }; // v4.84: bloqueada
      const p = this.home().splice(i, 1)[0], got = this.salvageValue(p);
      DK.bag.addHome(got);
      DK.emit('gear:salvaged', { p });
      DK.store.save();
      return { ok: true, got, msg: t('gear.salvaged', { name: this.name(p), n: got.fragmento_forja }) };
    },

    /* ---------------- Botín ---------------- */
    /** Piedras de forja de un combate ganado en expedición (data/gear.js → drops). */
    battleDrops(src = 'fight') {
      // v4.89: el sufijo de runa «+% piedras» sube las piedras (no los fragmentos ni las raciones)
      const up = 1 + (DK.runes && DK.expedition.active() ? DK.runes.modSum('stoneFind') / 100 : 0);
      const runeOk = (id) => !(DK.runes && DK.runes.opOf(id)) || DK.runes.enabled(); // v4.90: los de runas, sólo con el Taller
      return (G().drops[src] || []).filter(([id, p]) => runeOk(id) && U.chance(id === 'fragmento_forja' || id === 'racion_viaje' ? p : p * up)).map(([id]) => id);
    },

    /* ---------------- Partidas antiguas ---------------- */
    /**
     * Convierte el equipo de antes (ids en la bolsa y en d.equip) en piezas:
     * común/raro → normal, épico → mágico, legendario → raro.
     */
    migrate(s) {
      if (!s) return;
      if (s.gearV) { if (s.gearV < 2) this.migrate2(s); return; }
      const map = { comun: 'normal', raro: 'normal', epico: 'magico', legendario: 'raro' };
      const lvl = (s.party || []).reduce((a, d) => Math.max(a, d.level || 1), 1);
      const mk = (id) => this.create(id, { rarity: map[D.items[id].rarity] || 'normal', ilvl: lvl });
      s.gear = s.gear || [];
      const bag = s.bag || {};
      Object.keys(bag).forEach((id) => { if (isGear(id)) { for (let i = 0; i < bag[id]; i++) s.gear.push(mk(id)); delete bag[id]; } });
      (s.party || []).forEach((d) => { d.equip = (d.equip || [null, null]).map((x) => (typeof x === 'string' && isGear(x) ? mk(x) : x || null)); });
      const e = s.expedition;
      if (e) {
        e.loot = e.loot || {}; e.loot.gear = e.loot.gear || [];
        [e.pack, e.packed].forEach((pk) => Object.keys(pk || {}).forEach((id) => { if (isGear(id)) { if (pk === e.pack) for (let i = 0; i < pk[id]; i++) s.gear.push(mk(id)); delete pk[id]; } }));
        Object.keys(e.loot.items || {}).forEach((id) => { if (isGear(id)) { for (let i = 0; i < e.loot.items[id]; i++) e.loot.gear.push(mk(id)); delete e.loot.items[id]; } });
      }
      s.gearV = 1;
      this.migrate2(s);
    },
    /**
     * v4.78: cada pieza lleva su atributo principal (el primero) y sólo afijos de su familia:
     * se añade el principal si faltaba (quitando el último si no cabe) y cada afijo que no
     * le toca se cambia por otro del mismo tipo (mismo tier y tirada).
     */
    migrate2(s) {
      const all = [].concat(s.gear || [], ...(s.party || []).map((d) => (d.equip || []).filter((x) => x && typeof x === 'object')), (s.expedition && s.expedition.loot && s.expedition.loot.gear) || []);
      all.forEach((p) => {
        if (!D.items[p.base]) return;
        const main = primaryOf(p.base), R = RAR()[p.rarity] || RAR().normal, i = p.attrs.findIndex((a) => a.k === main);
        if (i > 0) p.attrs.unshift(p.attrs.splice(i, 1)[0]);
        else if (i < 0) { p.attrs.unshift({ k: main, r: Math.random() }); if (p.attrs.length > R.attrs[1]) p.attrs.pop(); }
        const ok = allowedAffixes(p.base);
        p.affixes = p.affixes.map((a) => {
          if (ok.includes(a.id)) return a;
          const kind = kindOf(a), used = p.affixes.map((x) => x.id);
          const alt = ok.find((id) => G().affixes[id].kind === kind && !used.includes(id));
          return alt ? Object.assign({}, a, { id: alt }) : null;
        }).filter(Boolean);
        p.v = (p.v || 0) + 1;
      });
      s.gearV = 2;
    },
    primaryOf,
    allowedAffixes,
  };
  DK.gear = api;
})();
