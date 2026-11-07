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
  function poolOf(base) {
    const it = D.items[base], out = [];
    Object.entries(it.stats || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).forEach(([k]) => out.includes(k) || out.push(k));
    if (!out.length) out.push(it.grants && it.grants.passive ? 'hp' : 'atk');
    for (let i = 0; out.length < G().poolSize && i < 6; i++) out.slice().forEach((k) => (G().affinity[k] || []).forEach((x) => { if (out.length < G().poolSize && !out.includes(x)) out.push(x); }));
    ['hp', 'def', 'mdef', 'spd', 'atk', 'matk', 'mp'].forEach((k) => { if (out.length < G().poolSize && !out.includes(k)) out.push(k); });
    return out;
  }

  /** Valor de un atributo plano de una pieza (se calcula: así subir de rareza lo mejora). */
  function attrValue(p, a) {
    const it = D.items[p.base], R = RAR()[p.rarity];
    const own = it.stats && it.stats[a.k] > 0 ? Math.max(1, it.stats[a.k] / (G().units[a.k] * (G().baseTier[it.rarity] || 1))) : 1; // la base ya favorece ese atributo
    const raw = G().units[a.k] * (G().baseTier[it.rarity] || 1) * Math.min(own, 1.6) * (1 + (p.ilvl || 1) / G().ilvlScale) * R.power * (G().roll[0] + (G().roll[1] - G().roll[0]) * a.r);
    // La regeneración (% por turno) no escala con el nivel del objeto: 1–3
    return a.k === 'regen' ? Math.min(3, Math.max(1, Math.round(raw / (1 + (p.ilvl || 1) / G().ilvlScale)))) : Math.max(1, Math.round(raw));
  }
  /** Valor de un afijo (en %). */
  function affixValue(a) {
    const def = G().affixes[a.id]; if (!def) return 0;
    const [lo, hi] = def.tiers[a.t - 1];
    return Math.round(lo + (hi - lo) * a.r);
  }

  /** Tier al azar para un nivel de objeto (los altos, más raros). */
  function rollTier(ilvl, rnd = Math.random) {
    const T = G().tiers, w = {};
    T.ilvl.forEach((min, i) => { if ((ilvl || 0) >= min) w[i + 1] = T.weight[i]; });
    return +U.weightedKey(w, rnd, '1');
  }
  /** Afijo nuevo de un tipo (prefix/suffix) que la pieza aún no tenga. */
  function rollAffix(p, kind, rnd = Math.random, not = []) {
    const pool = poolOf(p.base), have = p.affixes.map((a) => a.id).concat(not), w = {};
    Object.entries(G().affixes).forEach(([id, a]) => {
      if (a.kind !== kind || have.includes(id)) return;
      w[id] = 1 + (a.boost || []).filter((k) => pool.slice(0, 2).includes(k)).length * 1.5;
    });
    const id = Object.keys(w).length ? U.weightedKey(w, rnd) : null;
    return id ? { id, t: rollTier(p.ilvl, rnd), r: rnd() } : null;
  }
  const kindOf = (a) => G().affixes[a.id] && G().affixes[a.id].kind;
  const countKind = (p, kind) => p.affixes.filter((a) => kindOf(a) === kind).length;

  /** Rellena atributos hasta n (sin repetir, del pool de su base). */
  function fillAttrs(p, n, rnd = Math.random) {
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
    attrValue, affixValue,
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
      reroll: ['piedra_alteracion', 'piedra_caos', 'piedra_divina', 'piedra_purga'],
      affix: ['piedra_aumento', 'piedra_exaltacion', 'piedra_anulacion', 'esquirla_jefe', 'piedra_templado', 'sello_forja'],
      legend: ['eco_legendario'],
    },
    get stones() { return [].concat(...Object.values(this.groups)); },
    /** Piedras que actúan sobre UN afijo elegido (o.affix). */
    targeted: ['esquirla_jefe', 'piedra_templado', 'sello_forja'],
    /** Huecos de afijo de la pieza: { P: [usados, máx], S: [usados, máx], total: máx } */
    slots(p) {
      const R = RAR()[p.rarity];
      return { P: [countKind(p, 'prefix'), R.maxP], S: [countKind(p, 'suffix'), R.maxS], total: R.affixes[1] };
    },
    /** ¿Cabe un afijo más? (tope total de su rareza y hueco de prefijo o sufijo) */
    hasRoom(p) { const s = this.slots(p); return p.affixes.length < s.total && (s.P[0] < s.P[1] || s.S[0] < s.S[1]); },
    /**
     * Afijos que le pueden salir (para planificar): [{ id, kind, chance (0–1 entre los de su tipo), maxT, range }]
     * excluye los que ya tiene; maxT = el mejor tier que permite su nivel de objeto.
     */
    affixPool(p) {
      const pool = poolOf(p.base), have = p.affixes.map((a) => a.id), out = [];
      const T = G().tiers, maxT = T.ilvl.filter((min) => (p.ilvl || 0) >= min).length;
      ['prefix', 'suffix'].forEach((kind) => {
        const list = Object.entries(G().affixes).filter(([id, a]) => a.kind === kind && !have.includes(id))
          .map(([id, a]) => ({ id, kind, w: 1 + (a.boost || []).filter((k) => pool.slice(0, 2).includes(k)).length * 1.5, maxT, range: a.tiers[maxT - 1] }));
        const tot = list.reduce((x, y) => x + y.w, 0) || 1;
        list.forEach((x) => out.push(Object.assign(x, { chance: x.w / tot })));
      });
      return out.sort((a, b) => (a.kind === b.kind ? b.chance - a.chance : a.kind === 'prefix' ? -1 : 1));
    },
    /** Probabilidad de cada tier para su nivel de objeto: [{ t, chance }] */
    tierChances(p) {
      const T = G().tiers, w = T.ilvl.map((min, i) => ((p.ilvl || 0) >= min ? T.weight[i] : 0)), tot = w.reduce((a, b) => a + b, 0) || 1;
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
      switch (stone) {
        case 'piedra_transmutacion': return r === 'normal' ? null : t('gear.why.needNormal');
        case 'piedra_alquimia': return r === 'normal' ? null : t('gear.why.needNormal');
        case 'piedra_regia': return r === 'magico' ? null : t('gear.why.needMagic');
        case 'corazon_jefe': return r === 'raro' ? null : t('gear.why.needRare');
        case 'piedra_alteracion': return r === 'magico' ? null : t('gear.why.needMagic');
        case 'piedra_caos': return rare ? null : t('gear.why.needRare');
        case 'piedra_divina': return null;
        case 'piedra_purga': return r === 'magico' || r === 'raro' ? null : t('gear.why.needMagicRare');
        case 'piedra_aumento': return r !== 'magico' ? t('gear.why.needMagic') : !this.hasRoom(p) ? t('gear.why.full') : null;
        case 'piedra_exaltacion': return !rare ? t('gear.why.needRare') : !this.hasRoom(p) ? t('gear.why.full') : null;
        case 'piedra_anulacion': return r === 'normal' ? t('gear.why.needMagicRare') : p.affixes.filter((x) => !x.lock).length < 1 || p.affixes.length < 2 ? t('gear.why.tooFew') : null;
        case 'esquirla_jefe': return a && a.lock ? t('gear.why.locked') : null;
        case 'piedra_templado': return a && a.t >= 5 ? t('gear.why.maxTier') : a && G().tiers.ilvl[a.t] > (p.ilvl || 0) ? t('gear.why.lowIlvl', { n: G().tiers.ilvl[a.t] }) : null;
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
        case 'piedra_purga': p.rarity = 'normal'; p.attrs = p.attrs.slice(0, randInt(...RAR().normal.attrs, rnd)); p.affixes = p.affixes.slice(0, 1).map((a) => { delete a.lock; return a; }); delete p.nm; delete p.lp; break;
        case 'piedra_aumento': case 'piedra_exaltacion': fillAffixes(p, p.affixes.length + 1, rnd); break;
        case 'piedra_anulacion': {
          const free = p.affixes.filter((a) => !a.lock), gone = free[Math.floor(rnd() * free.length)];
          p.affixes = p.affixes.filter((a) => a !== gone); p.affixes.forEach((a) => delete a.lock); break;
        }
        case 'esquirla_jefe': {
          const i = o.affix, old = p.affixes[i];
          p.affixes[i] = rollAffix(p, kindOf(old), rnd, [old.id]) || { id: old.id, t: rollTier(p.ilvl, rnd), r: rnd() }; break;
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
    /** Fragmentos (y a veces una piedra) que da desguazar una pieza. */
    salvageValue(p) { return { fragmento_forja: RAR()[p.rarity].salvage + Math.floor((p.ilvl || 1) / 25) }; },
    /** Desguaza una pieza sin equipar (en casa). */
    salvage(uid) {
      if (st().expedition) return { ok: false, msg: t('gear.why.inExp') };
      const i = this.home().findIndex((p) => p.uid === uid); if (i < 0) return { ok: false, msg: t('gear.why.none') };
      const p = this.home().splice(i, 1)[0], got = this.salvageValue(p);
      DK.bag.addHome(got);
      DK.emit('gear:salvaged', { p });
      DK.store.save();
      return { ok: true, got, msg: t('gear.salvaged', { name: this.name(p), n: got.fragmento_forja }) };
    },

    /* ---------------- Botín ---------------- */
    /** Piedras de forja de un combate ganado en expedición (data/gear.js → drops). */
    battleDrops(src = 'fight') { return (G().drops[src] || []).filter(([, p]) => U.chance(p)).map(([id]) => id); },

    /* ---------------- Partidas antiguas ---------------- */
    /**
     * Convierte el equipo de antes (ids en la bolsa y en d.equip) en piezas:
     * común/raro → normal, épico → mágico, legendario → raro.
     */
    migrate(s) {
      if (!s || s.gearV) return;
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
    },
  };
  DK.gear = api;
})();
