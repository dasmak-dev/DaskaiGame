/* =============================================================
 * systems/expedition.js — Expediciones (modo roguelike con mapa).
 *
 * Al empezar se genera un MAPA por pisos (al estilo de los roguelike de
 * cartas): en cada piso eliges uno de los nodos conectados con el anterior.
 *
 *   fight    combate normal
 *   elite    rival de élite: más fuerte, mejor botín
 *   event    suceso con varias opciones (data/events.js)
 *   shop     mercader con 3 ofertas rebajadas
 *   rest     descansar (curar) o entrenar (experiencia)
 *   treasure cofre con objetos y monedas
 *   recruit  daskai salvajes que quieren unirse: eliges uno (o ninguno)
 *   shrine   santuario: bendice a un daskai para que se salve de la muerte una vez
 *   cave     cueva: guarida del JEFE OCULTO de la zona (D.secretBosses) o un tesoro.
 *            Vencerlo por primera vez lo desbloquea: desde entonces puede ser
 *            el jefe final de los mapas de esa zona (node.secret)
 *   shortcut atajo: salta `shortcutSkip` pisos (node.jump) a cambio de vida
 *   boss     jefe de la zona (último piso)
 *
 * MAPAS LARGOS: `rows` pisos + hoguera + jefe. Siempre hay una hoguera a
 * mitad de camino y al menos `caveMin` cuevas. En las HOGUERAS se puede
 * volver a casa (campfireExit): te llevas el `campfireKeep` (50%) del botín
 * y TODOS los daskai reclutados. Ya no hay retirada en cualquier momento.
 *
 * EMBLEMAS: cada jefe derrotado (también los ocultos) da `emblemsPerBoss`
 * emblemas (DK.camp.addEmblems). Se gastan en las Mejoras permanentes al
 * terminar la expedición (pantalla expSummary).
 *
 * EXPEDICIONES INFINITAS: no se elige zona. Cada mapa es de una zona al
 * azar entre las desbloqueadas; cuanto más profundo vas (depth), más
 * probable es que toque una zona difícil (pickZone). Al derrotar al jefe
 * de un mapa (bossCleared) eliges:
 *   - Continuar (continueRun): nuevo mapa, nueva reliquia, más profundidad
 *   - Terminar y cobrar (complete): botín + bonificación según la profundidad
 * Si la profundidad supera el número de zonas, los rivales suben de nivel
 * (levelBonus).
 *
 * MOCHILA (e.pack): antes de salir eliges qué objetos te llevas
 * (screens/expPrepare.js, hasta packCapacity unidades). Durante la
 * expedición DK.bag trabaja sobre la mochila. Al terminar o retirarte
 * vuelve a casa lo que quede; si pierdes, la mochila se pierde.
 *
 * El botín (objetos y monedas) se guarda aparte:
 *   - si terminas tras un jefe → te lo llevas todo + bonificación
 *   - si vuelves desde una hoguera → te llevas la mitad (campfireKeep)
 *   - si pierdes → pierdes todo el botín de la expedición
 * La experiencia se conserva siempre.
 *
 * Daskai reclutados (nodo recruit o vinculados en combate durante la
 * expedición): se unen al equipo como TEMPORALES (d.temp = true).
 *   - si derrotas al jefe del mapa → se quedan contigo para siempre
 *   - si te retiras o pierdes → se van (y devuelven lo que llevaran equipado)
 *
 * Estado (DK.store.state.expedition):
 *   { zone, map: { rows: [[nodo]] }, pos: id|null, pending: id|null, cleared: [id],
 *     step, total, loot: { items, coins }, offers?, startedAt, seed,
 *     depth (mapa nº), zones: [zonas superadas], awaitingChoice, next: {zone, seed} }
 * nodo: { id: 'fila-columna', row, x (0..1), type, links: [ids del piso siguiente] }
 * ============================================================= */
(function () {
  const U = DK.util, D = DK.data;
  /** Copia ligera de una pieza para el resumen de la expedición (v4.74). */
  const gearSnap = (p) => ({ uid: p.uid, base: p.base, rarity: p.rarity, ilvl: p.ilvl, name: DK.gear.name(p) });
  const st = () => DK.store.state;
  const cfg = () => DK.config.expedition;

  /** Tipos de nodo: icono y si se resuelve con un combate. */
  /** Borra lo que guardaba el piso actual (ofertas, suceso, resultado, reclutas, regalos). */
  const clearNodeState = (e) => { delete e.offers; delete e.event; delete e.result; delete e.candidates; delete e.giftChoice; delete e.giftTaken; };
  const TYPES = {
    fight: { icon: 'swords', battle: true },
    elite: { icon: 'skull', battle: true },
    boss: { icon: 'crown', battle: true },
    event: { icon: 'question', battle: false },
    shop: { icon: 'shop', battle: false },
    rest: { icon: 'campfire', battle: false },
    treasure: { icon: 'gift', battle: false },
    recruit: { icon: 'paw', battle: false },
    shrine: { icon: 'sparkles', battle: false },
    cave: { icon: 'cave', battle: false },
    shortcut: { icon: 'shortcut', battle: false },
    aboss: { icon: 'crown', battle: true }, // v5.1: jefe de la serie del Abismo (no es el del final)
  };

  /**
   * Genera el mapa.
   * Pisos 0..rows-1 con 2-4 nodos, luego un piso de descanso y el jefe.
   * Las conexiones van al nodo "de enfrente" (y a veces al vecino) para
   * que no se crucen, y se garantiza que todo nodo tenga entrada y salida.
   */
  /**
   * v5.1: mapa del Abismo (boss rush). Una fila por jefe de la serie (DK.abyss.series) y, entre jefe y jefe,
   * una fila para elegir hoguera o mercader. El último es el jefe de la zona (tipo 'boss').
   */
  function abyssMap(zoneId, seed) {
    const rnd = U.seeded(seed), list = DK.abyss.series(zoneId), rows = [];
    list.forEach((bz, i) => {
      const last = i === list.length - 1, r = rows.length;
      rows.push([{ id: `${r}-0`, row: r, x: 0.5, type: last ? 'boss' : 'aboss', bossZone: bz, round: i, links: [] }]);
      if (!last) {
        const flip = rnd() < 0.5, a = flip ? 'shop' : 'rest', b = flip ? 'rest' : 'shop';
        rows.push([{ id: `${r + 1}-0`, row: r + 1, x: 0.36, type: a, links: [] }, { id: `${r + 1}-1`, row: r + 1, x: 0.64, type: b, links: [] }]);
      }
    });
    for (let r = 0; r < rows.length - 1; r++) rows[r].forEach((n) => { n.links = rows[r + 1].map((x) => x.id); });
    return { rows, size: 'abyss', mod: null, kind: 'abismo' };
  }

  function generate(zoneId, seed, size = 'small', mod = null, kind = 'normal', extra = {}) {
    if (kind === 'abismo' && DK.abyss) return abyssMap(zoneId, seed);
    const rnd = U.seeded(seed);
    const pick = (weights) => U.weightedKey(weights, rnd, 'fight');
    // Tamaño del mapa (config.expedition.sizes): pisos, cuevas, atajos y hogueras
    const sz = cfg().sizes[size] || cfg().sizes.small;
    const c = Object.assign({}, cfg(), { rows: extra.rows || sz.rows, caveMin: sz.caves + (extra.caves || 0), shortcuts: extra.noShortcuts ? [0, 0] : sz.shortcuts, rests: extra.noRest ? 0 : sz.rests });
    // Modificador del mapa: cambia el peso de algunos nodos (p. ej. luna llena → más mini jefes)
    const md = mod && D.mapMods[mod];
    if (md && md.weights) { c.weights = Object.assign({}, c.weights); Object.entries(md.weights).forEach(([k, m]) => { c.weights[k] = (c.weights[k] || 0) * m; }); }
    // Tipo de expedición (captura, combate…): también cambia el peso de los nodos
    const kd = cfg().kinds[kind] || cfg().kinds.normal;
    if (kd.weights) { c.weights = Object.assign({}, c.weights); Object.entries(kd.weights).forEach(([k, m]) => { c.weights[k] = (c.weights[k] || 0) * m; }); }
    /*
     * Estructura en CAMINOS (como los roguelike de cartas): hay LANES carriles
     * y 4-5 caminos que suben piso a piso; cada paso sigue recto (lo más
     * probable) o pasa al carril de al lado, nunca cruzándose con otro camino.
     * Los nodos son los carriles por los que pasa algún camino, así que de vez
     * en cuando dos caminos se juntan en el mismo nodo (y luego pueden separarse).
     */
    const LANES = 7, laneX = (l) => 0.2 + l * 0.1;
    const lanes = Array.from({ length: c.rows }, () => new Set());
    const edges = new Set();                       // `${fila}:${carril}>${carril siguiente}`
    // 3 entradas repartidas (izquierda, centro, derecha) y 1-2 caminos más que salen de ellas
    const entry = [Math.floor(rnd() * 2), 3, 5 + Math.floor(rnd() * 2)];
    const starts = entry.concat(entry[Math.floor(rnd() * 3)], rnd() < 0.6 ? [entry[Math.floor(rnd() * 3)]] : []);
    starts.forEach((start) => {
      let l = start; lanes[0].add(l);
      for (let r = 1; r < c.rows; r++) {
        const opts = [[l, 0.6], [l - 1, 0.2], [l + 1, 0.2]].filter(([nl]) => nl >= 0 && nl < LANES)
          // sin cruces: si otro camino ya va de nl a l, no se puede ir de l a nl
          .filter(([nl]) => nl === l || !edges.has(`${r - 1}:${nl}>${l}`))
          // juntarse con otro camino es posible pero menos probable
          .map(([nl, w]) => [nl, lanes[r].has(nl) && !edges.has(`${r - 1}:${l}>${nl}`) ? w * 0.45 : w]);
        let x = rnd() * opts.reduce((acc, o) => acc + o[1], 0), nl = opts[0][0];
        for (const [cand, w] of opts) { if ((x -= w) < 0) { nl = cand; break; } }
        edges.add(`${r - 1}:${l}>${nl}`); lanes[r].add(nl); l = nl;
      }
    });
    const rows = [];
    for (let r = 0; r < c.rows; r++) {
      const ls = [...lanes[r]].sort((p, q) => p - q);
      const row = [];
      ls.forEach((lane, i) => {
        let type = 'fight';
        if (r > 0) {
          const w = Object.assign({}, c.weights);
          if (r < c.eliteFrom) delete w.elite;
          if (!kd.multiRecruit && row.some((x) => x.type === 'recruit')) delete w.recruit;
          if (r < 2) { delete w.rest; delete w.cave; }
          if (row.some((x) => x.type === 'shop')) delete w.shop;
          if (row.some((x) => x.type === 'cave')) delete w.cave;
          type = pick(w);
        }
        row.push({ id: `${r}-${i}`, row: r, x: laneX(lane) + (rnd() - 0.5) * 0.06, lane, type, links: [] });
      });
      rows.push(row);
    }
    // Siempre hay ocasión de reclutar: al menos uno en los pisos 1-2 y otro en los pisos 3-5
    [[1, 2], [3, c.rows - 1]].forEach(([a, b]) => {
      if (kd.noRecruit) return; // v5.31: el Averno no tiene reclutas
      const pool = rows.slice(a, b + 1).flat();
      if (!pool.length || pool.some((n) => n.type === 'recruit')) return;
      const swap = pool.filter((n) => n.type === 'fight' || n.type === 'event');
      U.pick(swap.length ? swap : pool, rnd).type = 'recruit';
    });
    // Garantías del tipo de expedición: reclutas (captura) y mini jefes (combate, desafío)
    [['recruit', kd.minRecruits], ['treasure', kd.minTreasures], ['elite', (kd.minElites || 0) + (extra.minElites || 0)]].forEach(([type, min]) => {
      for (let k = rows.flat().filter((n) => n.type === type).length; k < (min || 0); k++) {
        const pool = rows.slice(type === 'elite' ? Math.min(c.eliteFrom, c.rows - 1) : 1).flat().filter((n) => (n.type === 'fight' || n.type === 'event') && !(type === 'recruit' && !kd.multiRecruit && rows[n.row].some((x) => x.type === 'recruit')));
        if (!pool.length) break;
        U.pick(pool, rnd).type = type;
      }
    });
    // Modificadores de las runas mágicas/raras: combates → élites, tesoros y reclutas extra
    if (extra.elitePct) rows.slice(Math.min(c.eliteFrom, c.rows - 1)).flat().forEach((n) => { if (n.type === 'fight' && rnd() < extra.elitePct) n.type = 'elite'; });
    [['treasure', extra.treasures], ['recruit', kd.noRecruit ? 0 : extra.recruits], ['shop', extra.shops], ['shrine', extra.shrines]].forEach(([type, k]) => { // v4.89: + mercaderes y santuarios
      for (let i = 0; i < (k || 0); i++) {
        const pool = rows.slice(1).flat().filter((n) => n.type === 'fight' || n.type === 'event');
        if (pool.length) U.pick(pool, rnd).type = type;
      }
    });
    // Hogueras repartidas por el camino (para descansar o volver a casa): 1, 2 o 3 según el tamaño
    for (let k = 1; k <= (c.rests || 1); k++) {
      const mid = Math.round((c.rows * k) / ((c.rests || 1) + 1));
      if (!rows[mid] || rows[mid].some((n) => n.type === 'rest')) continue;
      const sw = rows[mid].filter((n) => n.type === 'fight' || n.type === 'event');
      U.pick(sw.length ? sw : rows[mid], rnd).type = 'rest';
    }
    // Cuevas garantizadas (guarida del jefe oculto)
    for (let k = rows.flat().filter((n) => n.type === 'cave').length; k < (c.caveMin || 0); k++) {
      const pool = rows.slice(2, c.rows).flat().filter((n) => n.type === 'fight' && !rows[n.row].some((x) => x.type === 'cave'));
      if (pool.length) U.pick(pool, rnd).type = 'cave';
    }
    // Siempre hay al menos un mini jefe (élite) en el camino: da reliquia
    if (!rows.flat().some((n) => n.type === 'elite')) {
      const pool = rows.slice(c.eliteFrom).flat().filter((n) => n.type === 'fight');
      if (pool.length) U.pick(pool, rnd).type = 'elite';
    }
    // Penúltimo piso: hoguera de descanso (salvo en Pesadilla, donde puede ser un combate); último: el jefe
    rows.push([{ id: `${c.rows}-0`, row: c.rows, x: 0.5, type: DK.rules.fixedRest() && !extra.noRest ? 'rest' : (rnd() < 0.5 ? 'elite' : 'fight'), links: [] }]);
    // Runa de botín maldito: ni una hoguera en todo el mapa
    if (extra.noRest) rows.flat().forEach((n) => { if (n.type === 'rest') n.type = 'fight'; });
    // Jefe final: si ya venciste al jefe oculto de la zona, a veces es él
    const sb = D.secretBosses && D.secretBosses[zoneId];
    const secret = !!(sb && DK.world.secret(zoneId).defeated > 0 && rnd() < (c.secretFinalChance || 0));
    rows.push([{ id: `${c.rows + 1}-0`, row: c.rows + 1, x: 0.5, type: 'boss', links: [], secret }]);

    // Conexiones de los caminos (pisos normales)
    for (let r = 0; r < c.rows - 1; r++) {
      rows[r].forEach((node) => rows[r + 1].forEach((nx) => { if (edges.has(`${r}:${node.lane}>${nx.lane}`)) node.links.push(nx.id); }));
    }
    rows.flat().forEach((n) => delete n.lane);
    // Del último piso normal a la hoguera final y al jefe
    for (let r = c.rows - 1; r < rows.length - 1; r++) {
      const a = rows[r], b = rows[r + 1];
      a.forEach((node, i) => {
        const j = a.length === 1 ? Math.floor(b.length / 2) : Math.round((i * (b.length - 1)) / (a.length - 1));
        node.links.push(b[j].id);
        const k = j + (rnd() < 0.5 ? 1 : -1);
        if (b[k] && rnd() < c.branchChance && !node.links.includes(b[k].id)) node.links.push(b[k].id);
      });
      // Nodos sin entrada: conéctalos desde el más cercano del piso anterior
      b.forEach((node) => {
        if (a.some((x) => x.links.includes(node.id))) return;
        const near = a.slice().sort((p, q) => Math.abs(p.x - node.x) - Math.abs(q.x - node.x))[0];
        near.links.push(node.id);
      });
    }
    // Atajos: un nodo que salta `shortcutSkip` pisos hacia delante (línea discontinua en el mapa)
    const skip = c.shortcutSkip || 3;
    // (la Mejora «Atajos» añade más)
    const nShort = extra.noShortcuts ? 0 : (c.shortcuts || [0, 0])[0] + Math.floor(rnd() * ((c.shortcuts || [0, 0])[1] - (c.shortcuts || [0, 0])[0] + 1)) + DK.camp.value('atajo');
    for (let k = 0; k < nShort; k++) {
      const pool = rows.slice(1, c.rows - skip).flat().filter((n) => (n.type === 'fight' || n.type === 'event') && !rows.flat().some((x) => x.type === 'shortcut' && x.row === n.row));
      if (!pool.length) break;
      const n = U.pick(pool, rnd);
      const target = rows[n.row + skip].slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x))[0];
      n.type = 'shortcut'; n.jump = target.id;
    }
    // v5.5: pisos especiales (marco dorado en el mapa). Con su propio azar para no cambiar el resto del mapa.
    const sp = cfg().specials;
    if (sp) {
      const srnd = U.seeded(seed + '|special');
      rows.slice(sp.fromRow || 2, c.rows).flat().forEach((n) => {
        const r = srnd(), k = srnd();
        if (n.type === 'fight' && r < sp.fight) n.special = k < 0.5 ? 'chain' : 'swap';
        else if (n.type === 'event' && r < sp.event) n.special = 'rare';
        else if (n.type === 'shop' && r < sp.shop) n.special = k < 0.55 ? 'curio' : 'gift';
      });
    }
    return { rows, size, mod, kind };
  }

  /** Nodo por id. */
  const nodeOf = (e, id) => (e && id ? e.map.rows[+id.split('-')[0]].find((n) => n.id === id) : null);

  DK.expedition = {
    TYPES,

    /** Expedición en curso o null. */
    active() { return st() && st().expedition; },

    /**
     * Línea de tiempo de la expedición (resumen): los momentos importantes.
     * k = tipo (start, newMap, elite, boss, secret, recruit, relic, cave, shortcut,
     *     event, saved, fallen, mapCleared, emblem, campfire, cashout, lost); v = datos.
     */
    logEvent(k, v = {}) {
      const e = this.active(); if (!e) return;
      e.log = e.log || {};
      e.log.timeline = e.log.timeline || [];
      const here = e.pending || e.pos;
      e.log.timeline.push({ k, v, d: e.depth || 1, f: here ? +here.split('-')[0] + 1 : 0, at: Date.now() });
      if (e.log.timeline.length > 200) e.log.timeline.shift();
    },

    /**
     * Zona al azar para el mapa número `depth`, entre las desbloqueadas.
     * Las zonas están ordenadas de fácil a difícil; el "objetivo" avanza
     * con la profundidad y las zonas cercanas a él pesan más. Se evita
     * (sin prohibirlo) repetir la zona anterior.
     */
    pickZone(depth = 1, avoid = null, rnd = Math.random, base = null) {
      const list = DK.world.unlockedZones().filter((z) => !DK.averno.isZone(z.id)); // v5.31: el Averno no sale al azar
      if (!list.length) return Object.keys(D.zones)[0];
      // `base`: zona en la que empezó la expedición (el objetivo avanza desde ella)
      const b0 = Math.max(0, list.findIndex((z) => z.id === base));
      const target = Math.min(list.length - 1, b0 + (depth - 1) * cfg().depthZoneStep);
      const weights = list.map((z, i) => (z.id === avoid && list.length > 1 ? 0.35 : 1) / Math.pow(1 + 1.6 * Math.abs(i - target), 2));
      let r = rnd() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) if ((r -= weights[i]) < 0) return list[i].id;
      return list[list.length - 1].id;
    },
    /** Modificador de mapa al azar (o null): config.expedition.modChance y pesos de data/mapMods.js. */
    pickMod(rnd = Math.random) {
      if (rnd() >= cfg().modChance) return null;
      return U.weightedKey(U.weightsOf(D.mapMods), rnd, null);
    },
    /** Modificador del mapa actual (datos) o null. */
    mod() { const e = this.active(); return e && e.mod ? D.mapMods[e.mod] : null; },
    /** +/-% de daño para los ataques de una casa por el modificador del mapa. */
    modHouse(house) { const m = this.mod(); return m && m.houseDmg && house ? m.houseDmg[house] || 0 : 0; },

    /** Tamaño de mapa al azar según su peso (config.expedition.sizes). */
    /* ---------------- Encargos del mapa (data/quests.js) ---------------- */
    /** Encargo al azar para un mapa de ese tamaño. */
    pickQuest(size = 'small', rnd = Math.random) {
      const id = U.weightedKey(U.weightsOf(D.mapQuests || {}), rnd, null);
      if (!id) return null;
      const q = D.mapQuests[id];
      return { id, target: q.track ? (q.target[size] || q.target.small) : 0, prog: 0, failed: false, done: false, claimed: false };
    },
    /** Encargo del mapa actual con su definición, o null. */
    quest() { const e = this.active(); return e && e.quest && D.mapQuests[e.quest.id] ? Object.assign({ def: D.mapQuests[e.quest.id] }, e.quest) : null; },
    /** ¿Está cumplido (o, si es de «no hacer», sigue sin fallar)? */
    questOk(q = this.quest()) { return !!q && !q.failed && (q.def.track ? q.done : true); },
    /** Premio del encargo actual: { coins, item }. */
    questReward(q = this.quest()) {
      const e = this.active(); if (!q || !e) return null;
      const Q = cfg().quest;
      const coins = Math.round(q.def.coins * (Q.sizeMult[this.size()] || 1) * (1 + Q.depthMult * ((e.depth || 1) - 1)));
      if (!e.quest.item) { e.quest.item = this.size() === 'small' ? this.expItem() : this.tonic(); DK.store.save(); }
      return { coins, item: e.quest.item };
    },
    /** Suma progreso a un encargo de tipo `track`. */
    questTrack(kind, n = 1) {
      const e = this.active(), q = e && e.quest, def = q && D.mapQuests[q.id];
      if (!def || def.track !== kind || q.failed || q.done) return;
      q.prog = Math.min(q.target, q.prog + n);
      if (q.prog >= q.target) { q.done = true; DK.emit('quest:done', { id: q.id }); }
      else DK.emit('quest:progress', { id: q.id, prog: q.prog, target: q.target });
      DK.store.save();
    },
    /** Falla un encargo de «no hacer». */
    questFail(kind) {
      const e = this.active(), q = e && e.quest, def = q && D.mapQuests[q.id];
      if (!def || def.fail !== kind || q.failed) return;
      q.failed = true;
      DK.emit('quest:failed', { id: q.id });
      DK.store.save();
    },
    /** Cobra el encargo al superar el mapa (si se cumplió). */
    questClaim() {
      const e = this.active(), q = this.quest();
      if (!q || q.claimed || !this.questOk(q)) return null;
      const r = this.questReward(q);
      e.quest.claimed = true;
      e.loot.coins += r.coins;
      if (r.item) this.addLoot([r.item]);
      e.log.quests = (e.log.quests || 0) + 1;
      st().stats.questsDone = (st().stats.questsDone || 0) + 1;
      this.logEvent('quest', { id: q.id, coins: r.coins });
      return r;
    },

    pickSize(rnd = Math.random, kind = null) {
      const kd = kind && cfg().kinds[kind];
      if (kd && kd.sizes) { const w = {}; kd.sizes.forEach((k) => (w[k] = (cfg().sizes[k] && cfg().sizes[k].weight) || 1)); return U.weightedKey(w, rnd, kd.sizes[0]); }
      return U.weightedKey(U.weightsOf(cfg().sizes), rnd, 'small');
    },
    /* ---------------- Tipos de expedición (config.expedition.kinds) ---------------- */
    /** Datos del tipo de la expedición en curso (o del de la próxima). */
    kindDef(kind) { const e = this.active(); const k = kind || (e && e.kind) || 'normal'; return Object.assign({ id: k }, cfg().kinds[k] || cfg().kinds.normal); },
    /**
     * Probabilidad (0-1) de cada tipo de expedición al azar (su `chance`); una runa
     * de tipo lo fija (DK.runes). Los bloqueados (desafío sin haber vencido a un jefe) no salen.
     */
    kindChances() {
      const w = {};
      this.kinds().forEach((k) => { if (!k.locked) w[k.id] = (k.chance || 0); });
      const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
      return Object.fromEntries(Object.entries(w).map(([id, v]) => [id, v / tot]));
    },
    /** Tipo al azar según kindChances(). */
    pickKind(rnd = Math.random) { return U.weightedKey(this.kindChances(), rnd, 'normal'); },
    /** Tipos que se pueden elegir ahora (desafío: tras vencer a algún jefe). */
    kinds() {
      const anyBoss = Object.keys(D.zones).some((z) => DK.world.boss(z).defeated > 0);
      return Object.entries(cfg().kinds).filter(([, k]) => !k.special).map(([id, k]) => Object.assign({ id, locked: !!(k.needsBoss && !anyBoss) }, k));
    },
    /**
     * Cambia dónde y de qué tipo será la próxima expedición (Batalla y Preparar).
     * Cambiar de zona o de tipo genera otro mapa (nueva semilla).
     */
    setStart({ zone, kind } = {}) {
      const n = Object.assign({}, this.nextStart());
      if (zone && DK.world.isUnlocked(zone)) n.zone = zone;
      if (kind && cfg().kinds[kind] && !(this.kinds().find((k) => k.id === kind) || {}).locked) n.kind = kind;
      // v5.31: el Averno tiene su propio tipo; al salir de él se vuelve a uno al azar
      if (DK.averno.isZone(n.zone)) n.kind = 'averno';
      else if (n.kind === 'averno') n.kind = this.pickKind();
      const old = st().nextExpedition;
      if (old && old.zone === n.zone && (old.kind || 'normal') === (n.kind || 'normal')) return old;
      n.seed = `${n.zone}-${Date.now()}`;
      if (!old || (old.kind || 'normal') !== (n.kind || 'normal')) n.size = this.pickSize(Math.random, n.kind);
      st().nextExpedition = n; DK.store.save();
      return n;
    },
    /** Pisos totales de un tamaño (incluye la hoguera final y el jefe). */
    sizeFloors(size) { return (cfg().sizes[size] || cfg().sizes.small).rows + 2; },
    /** Emblemas que da cada jefe en un mapa de ese tamaño (pequeño 1, mediano 2, XL 3). */
    bossEmblems(size, kind) {
      size = size || this.size();
      const late = this.active() ? DK.endgame.emblems() + DK.runes.emblemBonus() : DK.endgame.emblems(st().nextExpedition || {}) + DK.runes.emblemBonus(DK.runes.slots());
      return cfg().emblemsPerBoss * ((cfg().sizes[size] || {}).emblems || 1) + (this.kindDef(kind).emblems || 0) + late;
    },
    /** Tamaño del mapa actual. */
    size() { const e = this.active(); return (e && (e.size || (e.map && e.map.size))) || 'small'; },

    /** v4.75: nivel del botín que no suelta un rival concreto (sucesos, cofres…): el medio de la zona. */
    lootLevel() { const e = this.active(); if (!e) return 1; const z = D.zones[e.zone]; return Math.round((z.levels[0] + z.levels[1]) / 2) + this.levelBonus(); },
    /** Niveles extra de los rivales según la profundidad (sólo en expedición). */
    levelBonus(depth) {
      const e = this.active();
      const d = depth || (e ? e.depth || 1 : 1);
      const over = Math.max(0, d - Object.keys(D.zones).length);
      const md = depth ? null : this.mod();
      return (d - 1) * cfg().depthLevel + over * cfg().depthLevelOver + (DK.curses ? DK.curses.effect('enemyLevels') : 0) + ((md && md.levels) || 0) + (this.kindDef(e ? e.kind : (st().nextExpedition || {}).kind).levels || 0)
        + (e ? DK.endgame.levels() : DK.endgame.levels(st().nextExpedition || {}));
    },
    /** Multiplicador de monedas al terminar tras superar `maps` mapas. */
    bonusMult(maps) { return DK.config.expeditionBonus + Math.max(0, (maps || 1) - 1) * cfg().depthCoinBonus; },
    /** Mejor profundidad alcanzada en esta partida. */
    bestDepth() { return (st() && st().stats.bestDepth) || 0; },

    /**
     * Próxima expedición (zona y semilla ya elegidas, para la vista previa).
     * Al empezar sale exactamente ese mapa.
     */
    nextStart() {
      let n = st().nextExpedition;
      // Por defecto empieza en la zona recomendada para tu equipo (se puede cambiar en el mapa del mundo: setStart)
      if (!n || !DK.world.isUnlocked(n.zone)) { const rec = DK.world.recommended(); const zone = rec ? rec.id : this.pickZone(1); const kind = (n && n.kind) || this.pickKind(); n = st().nextExpedition = { zone, kind, seed: `${zone}-${Date.now()}`, size: this.pickSize(Math.random, kind), mod: this.pickMod() }; DK.store.save(); }
      // El tipo sale al azar (y no cambia hasta que salgas); partidas antiguas: se sortea ahora
      if (!n.kind || !cfg().kinds[n.kind]) { n.kind = this.pickKind(); n.size = this.pickSize(Math.random, n.kind); DK.store.save(); }
      if (!n.size) { n.size = this.pickSize(); DK.store.save(); } // vistas previas guardadas antes de los tamaños
      if (n.mod === undefined) { n.mod = this.pickMod(); DK.store.save(); }
      // v5.0: con la Corrupción desbloqueada siempre se sale, como mínimo, con el nivel I (ya no hay «sin corrupción»)
      if (DK.corruption && !n.weekly && DK.corruption.max() > 0 && !(n.corruption > 0) && !DK.averno.isZone(n.zone)) { n.corruption = 1; DK.store.save(); }
      // v5.31: el Averno: su tipo y tamaño, sin corrupción ni pesadilla, y sólo runas de bonificación
      if (DK.averno.isZone(n.zone)) {
        if (n.kind !== 'averno' || n.size !== 'averno' || n.corruption || n.nightmare) { n.kind = 'averno'; n.size = 'averno'; n.corruption = 0; n.nightmare = null; DK.store.save(); }
        if (n.runeSlots && n.runeSlots.some((id) => DK.runes.get(id).group !== 'bonus')) { n.runeSlots = n.runeSlots.filter((id) => DK.runes.get(id).group === 'bonus'); DK.store.save(); }
      } else if (n.kind === 'averno') { n.kind = this.pickKind(); n.size = this.pickSize(Math.random, n.kind); DK.store.save(); }
      return n;
    },
    /** Mapa de la próxima expedición (vista previa en Batalla). */
    /** Lo que cambian el mapa la corrupción y las runas (élites, sin hogueras, sin atajos, cuevas). */
    mapExtra(corruption, runes) {
      return Object.assign({ noShortcuts: DK.corruption.has('noShortcuts', corruption || 0) }, DK.runes.mapExtra(runes || []));
    },
    preview() {
      const n = this.nextStart();
      const map = generate(n.zone, n.seed, n.size, n.mod, n.kind, this.mapExtra(n.corruption, DK.runes.slots()));
      return { zone: n.zone, size: n.size, mod: n.mod, kind: n.kind, map, cleared: [], pending: null, pos: null, step: 1, total: map.rows.length };
    },

    /* ---------- Mochila ---------- */

    /** Unidades que caben en la mochila al salir (config + Mejora «Equipaje»). */
    packCapacity() { return cfg().packCapacity + DK.camp.value('equipaje'); },
    /** ¿Se puede llevar este objeto? (categorías de config.expedition.packCategories) */
    canPack(id) { return !!D.items[id] && cfg().packCategories.includes(D.items[id].category); },
    /** Unidades de una selección { id: n }. */
    packSize(pack) { return Object.values(pack || {}).reduce((a, b) => a + b, 0); },
    /**
     * Mochila recomendada con lo que tienes en casa: sobre todo curación,
     * algo de maná, curas de estados, plumas de fénix y un cristal.
     */
    suggestPack() {
      const cap = this.packCapacity(), home = DK.bag.home(), out = {};
      const have = (id) => (home[id] || 0) - (out[id] || 0);
      const take = (id, n) => { const k = Math.min(n, have(id), cap - this.packSize(out)); if (k > 0) out[id] = (out[id] || 0) + k; };
      const byPower = (ids, key) => ids.filter((id) => have(id) > 0).sort((a, b) => (D.items[b].use[key] || 0) - (D.items[a].use[key] || 0));
      take('pluma_fenix', 1);
      byPower(['hiperpocion', 'superpocion', 'pocion'], 'heal').forEach((id) => take(id, Math.ceil(cap * 0.5) - this.packSize(out)));
      byPower(['supereter', 'eter'], 'mana').forEach((id) => take(id, Math.ceil(cap * 0.7) - this.packSize(out)));
      ['panacea', 'antidoto', 'balsamo'].forEach((id) => take(id, 1));
      if (DK.config.captureEnabled) take(DK.bag.home().cristal_mayor ? 'cristal_mayor' : 'cristal_vinculo', 2);
      ['elixir', 'superpocion', 'pocion', 'eter'].forEach((id) => take(id, cap));
      return out;
    },

    /**
     * Empieza una expedición nueva (profundidad 1, zona al azar).
     * @param {Object} [pack] objetos de casa que te llevas { id: n }
     */
    start(pack = {}) {
      const pct = DK.daskai.snapPct(); // v4.68: los bonus de la expedición (Vigor, reliquias) suben el máximo; la vida sube con él
      const n = this.nextStart();
      // Mochila: sólo lo que tienes, lo que se puede llevar y lo que cabe
      const home = DK.bag.home(), chosen = {};
      let room = this.packCapacity();
      Object.entries(pack).forEach(([id, q]) => {
        const k = Math.min(q, home[id] || 0, room);
        if (k > 0 && this.canPack(id)) { chosen[id] = k; room -= k; home[id] -= k; if (!home[id]) delete home[id]; }
      });
      st().lastPack = Object.assign({}, chosen); // para repetir la próxima vez
      const mapX = this.mapExtra(n.corruption, DK.runes.slots());
      const runesUsed = DK.runes.consume(n); // runas de tamaño / tipo puestas en la preparación
      st().nextExpedition = null; // la próxima vista previa será otra
      const map = generate(n.zone, n.seed, n.size, n.mod, n.kind || 'normal', mapX);
      st().expedition = {
        kind: n.kind || 'normal', startZone: n.zone,
        zone: n.zone, seed: n.seed, size: n.size, mod: n.mod || null, map, marks: { lines: [], notes: [] }, pos: null, pending: null, cleared: [], recruits: [], step: 1, total: map.rows.length,
        loot: { items: {}, coins: 0 }, startedAt: Date.now(), mapStartedAt: Date.now(),
        relics: [], relicChoice: null,
        depth: 1, zones: [], awaitingChoice: false, next: null,
        pack: chosen, packed: Object.assign({}, chosen), members: DK.party.active().map((d) => d.uid),
        log: { nodes: {}, toBag: {}, lootSpent: 0, recipes: [], kept: [], foes: [], lvStart: Object.fromEntries(DK.party.all().map((d) => [d.uid, d.level])) }, // para el resumen final (v5.9: niveles al salir y rivales)
        revivesUsed: 0, blessed: null, // salvaciones de la muerte (DK.expedition.trySave)
        quest: this.pickQuest(n.size || 'small'),
        runesUsed,
        corruption: n.kind === 'averno' ? 0 : Math.min(n.corruption || 0, DK.corruption.max()),
        // v5.31: el Averno: pisos superados en toda la bajada y el jefe que espera al final de este mapa
        avernoFloors: n.kind === 'averno' ? 0 : undefined, avernoBoss: n.kind === 'averno' ? DK.averno.pickBoss(n.seed) : undefined,
        nightmare: n.nightmare && DK.nightmare.available(n.nightmare) && n.nightmare === n.zone ? n.nightmare : null,
      };
      this.logEvent('start', { zone: n.zone, size: n.size, mod: n.mod || null, kind: n.kind || 'normal' });
      // Pactos opcionales del primer mapa (se eligen antes que la reliquia)
      DK.curses.offer();
      // Al empezar eliges una reliquia entre las DESBLOQUEADAS (DK.camp.unlock):
      // comunes; con el Cartógrafo también raras (nivel 1) y épicas (nivel 2)
      const carto = DK.camp.value('cartografo');
      const rar = carto >= 2 ? ['comun', 'raro', 'epico'] : carto ? ['comun', 'raro'] : ['comun'];
      // Reliquias grabadas: salen siempre (DK.engrave)
      DK.engrave.list().forEach((id) => { if (D.relics[id]) DK.relics.give(id); });
      st().expedition.relicChoice = DK.relics.roll(rar, 3, { unlocked: true });
      // Cartógrafo nivel 2: además una reliquia común (desbloqueada) gratis
      if (carto >= 2) { const free = DK.relics.roll(['comun'], 1, { unlocked: true })[0]; if (free) DK.relics.give(free); }
      // Provisiones (Mejoras)
      const pots = DK.camp.value('provisiones');
      if (pots) DK.bag.add('pocion', pots);
      // Recompensa por haber caído contra un jefe en la expedición anterior
      if (st().consolation) {
        const c = cfg().consolation;
        const r = DK.relics.roll(c.relic, 1)[0]; if (r) DK.relics.give(r);
        Object.entries(c.items).forEach(([id, n]) => DK.bag.add(id, n));
        st().expedition.consolation = { relic: r, items: c.items };
        st().consolation = null;
      }
      DK.store.save();
      DK.daskai.applyPct(pct);
      return st().expedition;
    },

    /**
     * Jefe del mapa derrotado. Los reclutas se quedan, se dan los premios
     * del jefe y se espera a que el jugador decida: continuar o terminar.
     * @returns {{zone, depth, kept:[{name,species}], next:{zone}, coins, mult}}
     */
    bossCleared() {
      const e = this.active(); if (!e || e.awaitingChoice) return e ? this.choiceInfo() : null;
      this.ensureFields();
      // Jefe: experiencia, un objeto raro y tónicos (y a veces un elixir de olvido)
      const TD = cfg().tonicDrops;
      const tonics = Array.from({ length: TD.boss }, () => this.tonic());
      if (U.chance(TD.elixirBoss)) tonics.push('elixir_olvido');
      this.addLoot([this.expItem(), this.expItem(), U.pick(this.zoneLoot('raro')), ...tonics].filter(Boolean), 0, { src: 'boss' });
      e.log.bossTonics = tonics;
      e.log.kept.push(...this.settleRecruits(true));
      // Recompensa de los pactos: reliquias raras o épicas
      for (let i = 0; i < DK.curses.relicReward(); i++) { const r = DK.relics.roll(['raro', 'epico'], 1)[0]; if (r) { DK.relics.give(r); e.log.curseRelics = (e.log.curseRelics || []).concat(r); } }
      e.recruits = [];
      // Récords de la zona (Mapa del mundo): mapas superados, profundidad, tamaños y el más rápido
      const pr = DK.world.progress(e.zone);
      pr.rec = pr.rec || { maps: 0, best: 0, sizes: {}, fastest: null };
      pr.rec.maps++; pr.rec.best = Math.max(pr.rec.best, e.depth || 1);
      pr.rec.sizes[this.size()] = (pr.rec.sizes[this.size()] || 0) + 1;
      if (this.size() === 'xl') st().stats.xlCleared = (st().stats.xlCleared || 0) + 1;
      const dt = Date.now() - (e.mapStartedAt || e.startedAt);
      if (!pr.rec.fastest || dt < pr.rec.fastest) pr.rec.fastest = dt;
      e.lastQuest = e.quest ? Object.assign({}, e.quest, { reward: this.questClaim() }) : null;
      e.zones.push(e.zone);
      this.logEvent('mapCleared', { zone: e.zone });
      // Corrupción: abre el nivel siguiente · Abismo: récord y premio cada N pisos
      DK.averno.checkUnlock(); // v5.31: ¿se abre el Averno?
      DK.corruption.onBoss();
      if (e.kind === 'abismo') { const ab = DK.abyss.onFloor(e.depth || 1); if (ab) e.log.abyss = (e.log.abyss || []).concat(ab); }
      e.awaitingChoice = true;
      // v5.1: en el Abismo la siguiente ronda es de la misma zona, sin clima
      const zone = e.kind === 'abismo' || e.kind === 'averno' ? (e.startZone || e.zone) : this.pickZone(e.depth + 1, e.zone, Math.random, e.startZone);
      e.next = { zone, seed: `${zone}-${Date.now()}`, size: e.kind === 'abismo' ? 'abyss' : e.kind === 'averno' ? 'averno' : this.pickSize(Math.random, e.kind), mod: e.kind === 'abismo' ? null : this.pickMod() };
      const s = st().stats;
      s.expeditions++;
      s.bestDepth = Math.max(s.bestDepth || 0, e.depth);
      DK.emit('expedition:complete', { zone: e.zone, depth: e.depth });
      DK.store.save();
      return this.choiceInfo();
    },
    /** Datos de la decisión tras el jefe (para la pantalla). */
    choiceInfo() {
      const e = this.active(); if (!e || !e.awaitingChoice) return null;
      const mult = this.bonusMult(e.zones.length);
      if (e.next && !e.next.size) e.next.size = this.pickSize();
      return { zone: e.zone, depth: e.depth, maps: e.zones.length, next: e.next, mult, coins: Math.round(e.loot.coins * mult), items: this.lootCount(), nextBonus: this.levelBonus(e.depth + 1), quest: e.lastQuest || null };
    },
    /** Continuar: siguiente mapa (más profundo) con una reliquia a elegir. */
    continueRun() {
      const e = this.active(); if (!e || !e.awaitingChoice) return null;
      const n = e.next || { zone: this.pickZone(e.depth + 1, e.zone, Math.random, e.startZone), seed: `${Date.now()}`, size: this.pickSize(Math.random, e.kind) };
      const map = generate(n.zone, n.seed, n.size || 'small', n.mod || null, e.kind || 'normal', this.mapExtra(e.corruption, e.runesUsed));
      Object.assign(e, { zone: n.zone, seed: n.seed, size: n.size || 'small', mod: n.mod || null, map, marks: { lines: [], notes: [] }, pos: null, pending: null, cleared: [], step: 1, total: map.rows.length,
        depth: e.depth + 1, awaitingChoice: false, next: null, altarUsed: false, mapStartedAt: Date.now(), quest: this.pickQuest(n.size || 'small') });
      if (e.kind === 'averno') e.avernoBoss = DK.averno.pickBoss(n.seed);
      clearNodeState(e);
      DK.codex.discoverZone(n.zone);
      this.logEvent('newMap', { zone: n.zone, size: n.size || 'small', mod: n.mod || null });
      // Pactos nuevos y reliquia nueva (mejores cuanto más profundo)
      DK.curses.offer();
      e.relicChoice = DK.relics.roll(e.depth >= 4 ? ['raro', 'epico'] : ['comun', 'raro'], 3);
      DK.emit('expedition:continue', { zone: n.zone, depth: e.depth });
      DK.store.save();
      return e;
    },

    /** Partidas antiguas: expediciones sin mapa reciben uno nuevo (se conserva el botín). */
    ensureMap() {
      const e = this.active();
      if (!e || e.map) return;
      e.seed = `${e.zone}-${Date.now()}`;
      e.map = generate(e.zone, e.seed, e.size || 'small');
      Object.assign(e, { pos: null, pending: null, cleared: [], step: 1, total: e.map.rows.length });
    },
    /** Rellena campos nuevos en expediciones guardadas con versiones anteriores. */
    ensureFields() {
      const e = this.active(); if (!e) return;
      e.relics = e.relics || [];
      e.log = e.log || { nodes: {}, toBag: {}, lootSpent: 0, recipes: [] };
      e.log.kept = e.log.kept || [];
      e.depth = e.depth || 1;
      if (e.quest === undefined && e.map) e.quest = this.pickQuest(e.size || 'small');
      e.zones = e.zones || [];
    },

    node(id) { return nodeOf(this.active(), id); },
    /** Nodo en el que está el jugador (último superado). */
    current() { const e = this.active(); return e ? nodeOf(e, e.pos) : null; },
    /** Nodo elegido pendiente de resolver (combate, evento, tienda...). */
    pendingNode() { const e = this.active(); return e ? nodeOf(e, e.pending) : null; },

    /** Ids de los nodos a los que se puede ir ahora. */
    available() {
      const e = this.active();
      if (!e || e.pending || e.curseOffer || (e.relicChoice && e.relicChoice.length)) return [];
      if (e.jumpTo) return [e.jumpTo]; // acabas de tomar un atajo
      if (!e.pos) return e.map.rows[0].map((n) => n.id);
      return nodeOf(e, e.pos).links.slice();
    },

    /** ¿El siguiente paso es el jefe? */
    isBossNext() {
      const e = this.active(); if (!e) return false;
      const p = this.pendingNode();
      if (p) return p.type === 'boss';
      return this.available().some((id) => nodeOf(e, id).type === 'boss');
    },

    /**
     * Elige un nodo del mapa.
     * @returns {Object|null} el nodo, o null si no es alcanzable
     */
    choose(id) {
      const e = this.active();
      if (!e || !this.available().includes(id)) return null;
      e.pending = id;
      delete e.jumpTo;
      const n = nodeOf(e, id);
      if (n.type === 'shop') e.offers = n.special === 'curio' ? this.specialOffers() : this.makeOffers();
      if (n.type === 'shop' && n.special === 'gift') e.giftChoice = this.specialPick(3);
      if (n.type === 'event') e.event = n.special === 'rare' ? 'special' : this.pickEvent(n);
      if (n.type === 'event' && n.special === 'rare') e.giftChoice = this.specialPick(3);
      if (n.type === 'recruit') e.candidates = this.makeCandidates(n);
      DK.store.save();
      return n;
    },

    /* ---------- Dibujos y notas del jugador sobre el mapa ----------
     * e.marks = { lines: [{ c: color, pts: [[x 0..1, y px]] }], notes: [{ x, y, text, c }] }
     * Son de cada mapa: al pasar al siguiente se empieza en blanco.
     */
    marks() { const e = this.active(); if (!e) return { lines: [], notes: [] }; e.marks = e.marks || { lines: [], notes: [] }; return e.marks; },
    addLine(line) { if (line && line.pts && line.pts.length > 1) { this.marks().lines.push(line); DK.store.save(); } },
    addNote(note) { if (note && note.text) { this.marks().notes.push(note); DK.store.save(); } },
    removeMark(kind, i) { const m = this.marks()[kind]; if (m && m[i]) { m.splice(i, 1); DK.store.save(); } },
    undoMark() { const m = this.marks(); if (m.lines.length) m.lines.pop(); else m.notes.pop(); DK.store.save(); },
    clearMarks() { const e = this.active(); if (e) { e.marks = { lines: [], notes: [] }; DK.store.save(); } },

    /* ---------- Atajos y cuevas ---------- */

    /** Toma el atajo del nodo pendiente: el equipo pierde vida y el siguiente paso es node.jump. */
    takeShortcut() {
      const e = this.active(), n = this.pendingNode();
      if (!n || n.type !== 'shortcut' || !n.jump) return null;
      const cost = cfg().shortcutHpCost;
      DK.party.active().forEach((d) => { if (DK.daskai.isFainted(d)) return; const s = DK.daskai.stats(d); d.cur.hp = Math.max(1, d.cur.hp - Math.round(s.hp * cost)); });
      const target = n.jump;
      this.completeNode();
      e.jumpTo = target;
      this.logEvent('shortcut', { n: nodeOf(e, target).row - n.row - 1 });
      e.log.shortcuts = (e.log.shortcuts || 0) + 1;
      DK.store.save();
      return { skipped: nodeOf(e, target).row - n.row - 1 };
    },

    /** Datos del jefe oculto de la zona del mapa. */
    secretBoss(zoneId) { const e = this.active(); return D.secretBosses[zoneId || (e && e.zone)] || null; },

    /**
     * Explora la cueva pendiente. Si aún no has vencido a su jefe oculto, lo
     * encuentras siempre; si ya lo venciste, a veces vuelve y a veces hay tesoro.
     * @returns {{key, fight?, items?, coins?}}
     */
    exploreCave() {
      const e = this.active(), n = this.pendingNode();
      if (!n || n.type !== 'cave' || e.result) return null;
      const sb = this.secretBoss(), rec = DK.world.secret(e.zone);
      if (sb && (!rec.defeated || U.chance(0.45))) {
        rec.found = (rec.found || 0) + 1;
        DK.codex.seeEnemy(e.zone, sb.species);
        e.result = { key: rec.defeated ? 'lairAgain' : 'lair', fight: 'secret', vars: { title: sb.title } };
        this.logEvent('cave', { title: sb.title });
      } else {
        const items = [U.pick(this.zoneLoot('raro')), U.pick(this.zoneLoot('raro')), this.expItem()];
        if (U.chance(0.3)) items.push(this.tonic());
        const coins = Math.round(D.zones[e.zone].levels[1] * U.rand(10, 16) + 40);
        this.addLoot(items, coins);
        e.result = { key: 'caveTreasure', items, coins };
        this.logEvent('caveTreasure', { coins });
      }
      DK.store.save();
      return e.result;
    },

    /** Marca como superado el nodo pendiente y avanza un piso. */
    completeNode() {
      const e = this.active(); if (!e || !e.pending) return;
      this.ensureFields();
      const ty = nodeOf(e, e.pending).type;
      e.log.nodes[ty] = (e.log.nodes[ty] || 0) + 1;
      if (e.kind === 'averno') e.avernoFloors = (e.avernoFloors || 0) + 1; // v5.31: cada piso, más duro
      e.pos = e.pending; e.cleared.push(e.pending); e.pending = null;
      e.step = nodeOf(e, e.pos).row + 2;
      clearNodeState(e);
      DK.store.save();
    },

    /** ¿Este objeto va directo a la bolsa (se puede usar ya) en vez de al botín? */
    toBag(id) { return DK.config.expedition.directToBag.includes(D.items[id] && D.items[id].category); },

    /**
     * Guarda botín. Los consumibles (pociones, éteres, objetos de mejora...)
     * van directos a la bolsa y se pueden usar ya; el resto (equipamiento,
     * piezas) y las monedas se guardan en el botín hasta terminar.
     * @returns {{bag: string[], loot: string[]}}
     */
    addLoot(items, coins = 0, o = {}) {
      const e = this.active(); if (!e) return { bag: [], loot: [], gear: [] };
      this.ensureFields();
      const out = { bag: [], loot: [], gear: [] };
      items.forEach((id) => {
        // v4.74: el equipamiento sale como una pieza con rareza (mejor de mini jefes y jefes)
        if (DK.gear.isGear(id)) { const p = DK.gear.gain(id, { rarity: DK.gear.rollRarity(o.src || 'fight'), ilvl: o.level || this.lootLevel() + (o.src === 'boss' ? 3 : 0) }); out.gear.push(p); return; }
        if (this.toBag(id)) { DK.bag.add(id); e.log.toBag[id] = (e.log.toBag[id] || 0) + 1; out.bag.push(id); }
        else { e.loot.items[id] = (e.loot.items[id] || 0) + 1; out.loot.push(id); }
      });
      const md = this.mod();
      e.loot.coins += Math.round(coins * Math.max(0.1, 1 + DK.relics.sum('coins') + DK.camp.value('mochila') + DK.curses.coinBonus() + ((md && md.coins) || 0) + (this.kindDef().coins || 0) + DK.runes.bonus('coins') + DK.runes.bonus('loot') + DK.endgame.coins()));
      return out;
    },

    /* ---------- Nodos sin combate ---------- */

    /** Objetos que puede dar la zona (drops de sus enemigos), opcionalmente filtrados por rareza mínima. */
    zoneLoot(minRarity = 'comun') {
      const e = this.active();
      const min = D.rarities[minRarity].order;
      const ids = new Set();
      D.zones[e.zone].enemies.forEach((en) => D.species[en.species].drops.forEach(([id]) => ids.add(id)));
      if (D.zones[e.zone].boss) D.zones[e.zone].boss.drops.forEach(([id]) => ids.add(id));
      const list = [...ids].filter((id) => D.items[id] && D.rarities[D.items[id].rarity].order >= min);
      return list.length ? list : [...ids];
    },

    /** Cofre: 2-3 objetos de la zona y monedas. */
    openTreasure() {
      const e = this.active();
      // Pesadilla: objetos mejores · runa de botín maldito: uno más
      const pool = this.zoneLoot(DK.nightmare.on() ? 'raro' : 'comun');
      // Expedición de tesoro (muy rara): cofres mucho mejores (config kinds.tesoro.chest)
      const kc = this.kindDef().chest || {};
      const items = Array.from({ length: U.rand(2, 3) + (kc.items || 0) + DK.relics.sum('loot') + (DK.runes.bonus('loot') > 0 ? 1 : 0) }, () => U.pick(pool));
      if (U.chance(0.35)) items.push(U.pick(this.zoneLoot('raro')));
      if (kc.rare && U.chance(kc.rare)) items.push(U.pick(this.zoneLoot('raro')));
      if (U.chance(DK.config.expItemChance)) items.push(this.expItem());
      // Tónico: más probable cuanto más profundo es el mapa
      const TD = cfg().tonicDrops;
      if (U.chance(Math.min(TD.chestMax, TD.chest + TD.chestPerDepth * ((e.depth || 1) - 1)))) items.push(this.tonic());
      const lv = D.zones[e.zone].levels[1];
      const coins = Math.round((lv * U.rand(6, 10) + 20) * (kc.coins || 1));
      const split = this.addLoot(items, coins);
      // A veces hay una reliquia (en las de tesoro, también épicas)
      const relic = U.chance(DK.config.expedition.chestRelicChance + (kc.relic || 0) + DK.runes.modSum('relicFind') / 100) ? DK.relics.give(DK.relics.roll(kc.relic ? ['comun', 'raro', 'epico'] : ['comun', 'raro'], 1)[0]) : null;
      // A veces, una runa de expedición (se guarda ya: DK.runes)
      const runes = DK.runes.drop('treasure').concat(kc.rune && U.chance(kc.rune) ? DK.runes.drop('boss') : []);
      return { items, coins, bag: split.bag, loot: split.loot, relic, runes };
    },

    /** Coste en monedas de curar del todo al equipo antes de salir (0 si no hace falta). */
    healCost(team = DK.party.active()) {
      const H = cfg().healCoins;
      const raw = team.reduce((a, d) => {
        const m = DK.daskai.stats(d), miss = (m.hp - d.cur.hp) * H.perHp + (m.mp - d.cur.mp) * H.perMp + (DK.daskai.isFainted(d) ? H.fainted : 0) + (d.status ? 20 : 0);
        return a + Math.max(0, miss) * (1 + d.level * H.perLevel);
      }, 0);
      return raw > 0 ? Math.ceil(raw / H.round) * H.round : 0;
    },
    /** Paga y cura del todo al equipo (sólo fuera de una expedición). @returns {number|false} lo pagado */
    healPaid(team = DK.party.active()) {
      if (this.active()) return false;
      const c = this.healCost(team); if (!c || !DK.wallet.spend(c)) return false;
      team.forEach((d) => DK.daskai.fullHeal(d));
      DK.store.save();
      return c;
    },

    /** Descanso: cura un % de vida y maná y los estados. */
    rest() {
      const pct = Math.min(1, cfg().restHeal + DK.camp.value('hoguera')) * (DK.corruption.has('restHalf') ? D.endgame.corruption.restMult : 1);
      this.questFail('rest');
      DK.party.active().forEach((d) => {
        const s = DK.daskai.stats(d);
        d.cur.hp = Math.min(s.hp, d.cur.hp + Math.ceil(s.hp * pct));
        d.cur.mp = Math.min(s.mp, d.cur.mp + Math.ceil(s.mp * pct));
        d.status = null;
      });
      DK.store.save();
      return { pct: Math.round(pct * 100) };
    },

    /** Entrenar en la hoguera: el daskai elegido sube SIEMPRE 1 nivel. Devuelve {d, exp, levelInfo}. */
    train(uid) {
      const d = DK.party.get(uid);
      if (!d || d.level >= DK.config.maxLevel) return null;
      const exp = Math.max(1, DK.daskai.expToNext(d) - (d.exp || 0));
      const levelInfo = DK.daskai.gainExp(d, exp);
      DK.store.save();
      return { d, exp, levelInfo };
    },

    /** Un tónico al azar (mejora permanente de un atributo). */
    tonic() { return U.pick(Object.values(D.tonicFor)); },

    /** Objeto de experiencia acorde al nivel de la zona. */
    expItem() {
      const e = this.active(), lv = e ? D.zones[e.zone].levels[1] : 10;
      const pool = lv <= 12 ? ['baya_saber', 'baya_saber', 'tonico_exp'] : lv <= 30 ? ['baya_saber', 'tonico_exp', 'tonico_exp'] : lv <= 55 ? ['tonico_exp', 'cristal_sabio'] : ['cristal_sabio', 'cristal_sabio', 'esencia_ancestral'];
      return U.pick(pool);
    },

    /**
     * Mercancía del mercader (la única tienda del juego):
     * curación y experiencia según la zona, un cristal de vínculo y
     * algunas cosas al azar, cada una con unidades limitadas.
     */
    makeOffers() {
      const e = this.active(), lv = D.zones[e.zone].levels[1];
      const price = (id) => Math.round(D.prices[id] * (1 - cfg().shopDiscount) * (DK.corruption.has('shopDouble') ? D.endgame.corruption.shopMult : 1));
      const offer = (id, stock) => ({ id, price: price(id), stock, left: stock });
      const heal = lv <= 12 ? 'pocion' : lv <= 40 ? 'superpocion' : 'hiperpocion';
      const out = [offer(heal, U.rand(3, 5)), offer(lv <= 25 ? 'eter' : 'supereter', U.rand(2, 4)), offer(this.expItem(), U.rand(1, 3))];
      if (DK.config.captureEnabled) out.push(offer(lv <= 30 ? 'cristal_vinculo' : 'cristal_mayor', U.rand(1, 2)));
      // (sin vínculo en combate no se venden cristales)
      const sellable = (id) => DK.config.captureEnabled || !(D.items[id] && D.items[id].use && D.items[id].use.capture);
      const extra = D.shopStock.filter((id) => D.prices[id] && sellable(id) && !out.some((o) => o.id === id));
      out.push(offer(U.pick(extra), U.rand(2, 4)));
      const rare = this.zoneLoot('raro').filter((id) => D.prices[id] && !out.some((o) => o.id === id));
      if (rare.length && U.chance(0.6)) out.push(offer(U.pick(rare), 1));
      // Contactos comerciales del campamento: ofertas extra
      for (let i = 0; i < DK.camp.value('comercio'); i++) {
        const more = D.shopStock.filter((id) => D.prices[id] && sellable(id) && !out.some((o) => o.id === id));
        if (more.length) out.push(offer(U.pick(more), U.rand(1, 3)));
      }
      // v4.75: piedras de forja (siempre una; a veces una regia o de alquimia)
      out.push(offer(U.pick(['piedra_transmutacion', 'piedra_alteracion', 'piedra_aumento', 'piedra_cambio', 'piedra_purga', 'fragmento_forja']), U.rand(1, 2)));
      if (U.chance(0.2)) out.push(offer(U.pick(['piedra_regia', 'piedra_alquimia', 'piedra_anulacion']), 1));
      // Muy de vez en cuando, una pluma de fénix
      if (U.chance(0.12)) out.push(offer('pluma_fenix', 1));
      return out;
    },
    /**
     * v5.5: objetos especiales (tónicos, cristales de sabio, piedras de forja raras, elixir, pluma de fénix…)
     * para los pisos especiales: el mercader de rarezas los vende y el generoso / el encuentro especial regala uno.
     */
    specialPool() { return (cfg().specialItems || []).filter((id) => D.items[id]); },
    specialPick(n = 3) { return this.specialPool().map((id) => [Math.random(), id]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]); },
    specialPrice(id) {
      const e = this.active(), lv = e ? D.zones[e.zone].levels[1] : 10, it = D.items[id];
      const base = D.prices[id] || ({ comun: 40, raro: 110, epico: 240, legendario: 520 }[it.rarity] || 150);
      return Math.round(base * 0.85 * (1 + lv / 80) * (DK.corruption && DK.corruption.has('shopDouble') ? D.endgame.corruption.shopMult : 1));
    },
    specialOffers() {
      return this.specialPick(5).map((id) => ({ id, price: this.specialPrice(id), stock: 1, left: 1, special: true })).concat(this.makeOffers().slice(0, 2));
    },
    /** Coge el regalo elegido (mercader generoso o encuentro especial). */
    takeGift(id) {
      const e = this.active();
      if (!e || !e.giftChoice || !e.giftChoice.includes(id) || e.giftTaken) return false;
      e.giftTaken = id;
      this.addLoot([id]);
      DK.store.save();
      return true;
    },

    /** Compra n unidades de una oferta. Sólo se paga con las monedas del botín de la expedición. */
    buyOffer(i, n = 1) {
      const e = this.active(); const o = e && e.offers && e.offers[i];
      if (o && o.left == null) o.left = o.sold ? 0 : 1; // ofertas guardadas en versiones anteriores
      if (!o || n < 1 || o.left < n) return false;
      const cost = o.price * n;
      if (e.loot.coins < cost) return false;
      e.loot.coins -= cost;
      this.ensureFields(); e.log.lootSpent += cost;
      o.left -= n;
      o.sold = o.left <= 0;
      DK.bag.add(o.id, n);
      DK.emit('bought', { id: o.id, n, cost: o.price * n });
      DK.store.save();
      return true;
    },

    /** Elige un suceso al azar según su peso y el piso. */
    pickEvent(node) {
      const noRec = this.kindDef().noRecruit; // v5.31: en el Averno no salen sucesos que den daskai
      const list = D.events.filter((ev) => (ev.minRow || 0) <= node.row && !(noRec && ev.recruits));
      const total = list.reduce((a, ev) => a + (ev.weight || 1), 0);
      let r = Math.random() * total;
      for (const ev of list) { if ((r -= ev.weight || 1) < 0) return ev.id; }
      return list[0].id;
    },

    /**
     * Herramientas que reciben los sucesos (data/events.js) para aplicar sus efectos.
     * Todas devuelven datos para el texto del resultado.
     */
    ctx() {
      const self = this, e = this.active(), zone = D.zones[e.zone];
      return {
        zone, level: zone.levels[1],
        team: () => DK.party.active(),
        leader: () => DK.party.aliveActive()[0] || DK.party.active()[0],
        /** Cura (pct>0) o daña (pct<0) a todo el equipo; nunca deja a nadie a 0. */
        hpAll(pct) { DK.party.active().forEach((d) => { const s = DK.daskai.stats(d); d.cur.hp = U.clamp(d.cur.hp + Math.round(s.hp * pct), 1, s.hp); }); },
        mpAll(pct) { DK.party.active().forEach((d) => { const s = DK.daskai.stats(d); d.cur.mp = U.clamp(d.cur.mp + Math.round(s.mp * pct), 0, s.mp); }); },
        loot(items, coins = 0) { self.addLoot(items, coins); },
        randomItem: (minRarity) => U.pick(self.zoneLoot(minRarity)),
        has: (id, n = 1) => DK.bag.count(id) >= n,
        take: (id, n = 1) => DK.bag.remove(id, n),
        coins: () => DK.wallet.get(),
        pay: (n) => DK.wallet.spend(n),
        exp(d, n) { return DK.daskai.gainExp(d, n); },
        chance: (p) => U.chance(p),
        /* --- Para los sucesos con personajes (NPC) --- */
        tonic: () => self.tonic(),
        /** Un objeto de equipo de la rareza dada o superior. */
        equip(minRarity = 'raro') {
          const min = D.rarities[minRarity].order;
          const list = Object.values(D.items).filter((it) => it.category === 'equipo' && D.rarities[it.rarity].order >= min && D.rarities[it.rarity].order <= min + 1 && !it.noShop);
          return U.pick(list.length ? list : Object.values(D.items).filter((it) => it.category === 'equipo')).id;
        },
        /** Da una reliquia al azar de esas rarezas. Devuelve su id o null. */
        relic(rarities) { const id = DK.relics.roll(rarities, 1)[0]; return id ? DK.relics.give(id) : null; },
        /** Un daskai de la zona se une a la expedición (temporal hasta el jefe o una hoguera). */
        recruit() {
          const d = self.makeCandidates(self.pendingNode() || { row: 1 })[0];
          d.uid = U.uid(); DK.codex.seeEnemy(e.zone, d.species); DK.looks.see(d); self.addRecruit(d);
          return DK.daskai.name(d);
        },
        /** Convierte un combate de más adelante en una cueva. → true si había sitio */
        revealCave() { return self.reveal('cave'); },
        /** Abre un atajo desde uno de los próximos pisos. → true si había sitio */
        revealShortcut() { return self.reveal('shortcut'); },
      };
    },

    /**
     * Un personaje te enseña algo del mapa: convierte un combate de los
     * próximos pisos en una cueva ('cave') o en un atajo ('shortcut').
     * Prefiere los nodos a los que se llega desde el actual.
     */
    reveal(kind) {
      const e = this.active(), here = this.pendingNode() || this.current();
      const from = here ? here.row : 0, rows = e.map.rows, lastNormal = rows.length - 3;
      const skip = cfg().shortcutSkip;
      const ok = (n) => n.type === 'fight' && n.row > from && n.row <= (kind === 'shortcut' ? lastNormal - skip : lastNormal);
      const near = here ? here.links.map((id) => nodeOf(e, id)).filter(ok) : [];
      const pool = near.length ? near : rows.flat().filter(ok).sort((a, b) => a.row - b.row).slice(0, 4);
      if (!pool.length) return false;
      const n = U.pick(pool);
      n.type = kind;
      if (kind === 'shortcut') n.jump = rows[n.row + skip].slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x))[0].id;
      DK.store.save();
      return true;
    },

    /**
     * Ejecuta una opción del suceso pendiente.
     * @returns {Object|null} {text, fight?} resultado para mostrar
     */
    resolveEvent(choiceId) {
      const e = this.active();
      const ev = e && D.events.find((x) => x.id === e.event);
      const ch = ev && ev.choices.find((c) => c.id === choiceId);
      if (!ch || e.result) return null;
      const ctx = this.ctx();
      if (ch.req && !ch.req(ctx)) return null;
      const res = ch.run(ctx) || {};
      e.result = { event: ev.id, choice: ch.id, key: res.key || 'done', vars: res.vars || {}, fight: res.fight || null };
      this.logEvent('event', { id: ev.id });
      DK.store.save();
      return e.result;
    },

    /* ---------- Reclutas ---------- */

    /**
     * Candidatos de un nodo de reclutamiento: daskai de la zona (distintos si
     * se puede), más fuertes cuanto más alto el piso.
     */
    makeCandidates(node) {
      const e = this.active(), zone = D.zones[e.zone];
      // v5.16: 2 de base, +1/+2/+3 con la mejora «Ojo de reclutador» (máx. 5) y +1 en las expediciones de captura
      const C = DK.config.expedition, n = Math.min(C.recruitChoicesMax, C.recruitChoices + DK.camp.value('eleccion')) + (this.kindDef().recruit || 0);
      const species = [];
      for (let i = 0; i < 20 && species.length < n; i++) {
        const sp = U.weighted(zone.enemies).species;
        if (!species.includes(sp) || i > 12) species.push(sp);
      }
      const lv = U.clamp(zone.levels[0] + node.row, zone.levels[0], zone.levels[1]) + DK.camp.value('reclutador') + this.levelBonus();
      return species.map((sp) => {
        // Variocolor: más probable que en combate (y aún más en una expedición de captura)
        const shiny = U.chance(cfg().recruitShinyChance + (this.kindDef().shiny || 0) + DK.endgame.shiny(sp) + DK.runes.bonus('shiny'));
        const d = DK.daskai.create(sp, U.clamp(lv + U.rand(-1, 1), 1, DK.config.maxLevel), { wild: true, shiny, dual: U.chance(DK.config.dual.recruit) });
        DK.daskai.fullHeal(d);
        return d;
      });
    },

    /** Une un daskai a la expedición como temporal (desde un nodo o tras vincularlo en combate). */
    addRecruit(d) {
      const e = this.active(); if (!e || this.kindDef().noRecruit) return; // v5.31: en el Averno no hay daskai nuevos
      e.recruits = e.recruits || [];
      d.temp = true;
      delete d.wild;
      if (!DK.party.get(d.uid)) { DK.daskai.clamp(d); DK.party.add(d); }
      if (!e.recruits.includes(d.uid)) e.recruits.push(d.uid);
      DK.store.save();
    },

    /** Elige un candidato del nodo pendiente. */
    recruit(i) {
      const e = this.active();
      const c = e && e.candidates && e.candidates[i];
      if (!c || e.result) return null;
      c.uid = U.uid();
      DK.codex.seeEnemy(e.zone, c.species);
      this.addRecruit(c);
      e.result = { key: 'exp.recruited', vars: { name: DK.daskai.name(c) }, uid: c.uid };
      this.logEvent('recruit', { name: DK.daskai.name(c), species: c.species });
      this.questTrack('capture'); // el encargo «recluta» cuenta los reclutas
      DK.store.save();
      return c;
    },

    /** Daskai temporales de la expedición en curso. */
    recruits() { const e = this.active(); return e ? (e.recruits || []).map((u) => DK.party.get(u)).filter(Boolean) : []; },

    /** Al terminar: keep=true los convierte en permanentes; si no, se van. */
    settleRecruits(keep) {
      const list = this.recruits();
      list.forEach((d) => {
        if (keep) {
          delete d.temp;
          st().stats.captures++;
          if (d.shiny) st().stats.shinies++;
          DK.emit('captured', { d });
        } else DK.party.removeTemp(d.uid);
      });
      return list.map((d) => ({ uid: d.uid, name: DK.daskai.name(d), species: d.species }));
    },

    /**
     * Entrega el botín. bonus=true al terminar tras un jefe (con el
     * multiplicador de la profundidad). Los reclutas del mapa actual
     * (sin jefe) se van; los de mapas superados ya son tuyos.
     */
    claim(bonus) {
      const e = this.active(); if (!e) return null;
      this.ensureFields();
      this.logEvent(bonus ? 'cashout' : 'retreat', { coins: Math.round(e.loot.coins * (bonus ? this.bonusMult(e.zones.length) : 1)) });
      const left = this.settleRecruits(false).map((x) => Object.assign(x, { kept: false }));
      const recruits = e.log.kept.map((x) => Object.assign({}, x, { kept: true })).concat(left);
      const mult = bonus ? this.bonusMult(e.zones.length) : 1;
      const coins = Math.round(e.loot.coins * mult);
      const pack = Object.assign({}, e.pack || {});
      const summary = { items: e.loot.items, coins, zone: e.zone, recruits, keptRecruits: bonus, mult, pack };
      const gear = (e.loot.gear || []).slice(); // v4.74: el equipo encontrado vuelve entero
      this.snapshot(bonus ? 'completed' : 'retreat', { coins, items: e.loot.items, recruits, mult, packBack: pack, gear: gear.map(gearSnap) });
      this.closeRun();
      DK.gear.home().push(...gear);
      // Ya fuera de la expedición: botín y mochila vuelven a la bolsa de casa
      DK.bag.addHome(e.loot.items);
      DK.bag.addHome(pack);
      DK.wallet.add(coins);
      this.afterEnd();
      DK.store.save();
      return summary;
    },

    /** v5.9: equipo para el resumen: los que fueron (y los reclutados), con su nivel al salir y al volver. */
    teamSnap(e) {
      const start = (e.log && e.log.lvStart) || {}, fallen = new Set((e.log.fallen || []).map((x) => x.uid).filter(Boolean));
      const uids = [...new Set([].concat(e.members || [], DK.party.active().map((d) => d.uid)))];
      return uids.map((uid) => DK.party.get(uid)).filter(Boolean).map((d) => ({
        uid: d.uid, species: d.species, look: DK.looks.of(d) || null, shiny: !!d.shiny, name: DK.daskai.name(d),
        from: start[d.uid] != null ? start[d.uid] : (d.joinLevel || d.level), to: d.level, fainted: fallen.has(d.uid) || DK.daskai.isFainted(d), recruit: start[d.uid] == null,
      })).concat((e.log.fallen || []).filter((x) => !DK.party.get(x.uid)).map((x) => ({ species: x.species, name: x.name, from: start[x.uid] || x.level, to: x.level, fallen: true, look: x.look || null })));
    },
    /**
     * Guarda el resumen de la expedición que termina (pantalla expSummary).
     * outcome: 'completed' | 'retreat' | 'lost'
     */
    snapshot(outcome, extra) {
      const e = this.active(); if (!e) return;
      this.ensureFields();
      st().lastExpedition = Object.assign({
        outcome, zone: e.zone, startedAt: e.startedAt, endedAt: Date.now(),
        depth: e.depth || 1, zones: (e.zones || []).slice(),
        map: e.map, cleared: e.cleared.slice(), pending: e.pending, step: e.step, total: e.total,
        relics: e.relics.slice(), nodes: e.log.nodes, toBag: e.log.toBag, lootSpent: e.log.lootSpent, recipes: e.log.recipes.slice(),
        fallen: (e.log.fallen || []).slice(), difficulty: DK.rules.difficulty(),
        size: e.size || 'small', mod: e.mod || null, marks: e.marks || null,
        emblems: e.log.emblems || 0, timeline: (e.log.timeline || []).slice(), secrets: (e.log.secrets || []).slice(), shortcuts: e.log.shortcuts || 0, runes: (e.log.runes || []).slice(), runesUsed: (e.runesUsed || []).slice(),
        // Desafío semanal: puntos, récord y premio (DK.weekly)
        weekly: e.weekly && DK.weekly ? DK.weekly.record(e, outcome) : null,
        // v5.9: el equipo (nivel al salir → al volver) y los rivales a los que te enfrentaste
        team: this.teamSnap(e), foes: (e.log.foes || []).slice(0, 80),
      }, extra);
      // Historial de expediciones (Perfil): las últimas config.expHistorySize
      st().expHistory = st().expHistory || [];
      st().expHistory.unshift(st().lastExpedition);
      st().expHistory.length = Math.min(st().expHistory.length, DK.config.expHistorySize);
    },

    /** Terminar y cobrar (sólo tras derrotar a un jefe). */
    complete() {
      const e = this.active(); if (!e) return null;
      if (e.kind === 'averno') return null; // v5.31: del Averno sólo se sale al caer (DK.expedition.avernoEnd)
      if (!e.awaitingChoice) this.bossCleared(); // por si se llama directamente
      const r = this.claim(true);
      DK.emit('expedition:end', { depth: r && st().lastExpedition.depth });
      return r;
    },

    /**
     * Salir: tras un jefe es «terminar y cobrar»; en una hoguera, volver a casa
     * con la mitad del botín (campfireExit). En otro sitio no se puede.
     */
    retreat() { const e = this.active(); return e && e.awaitingChoice ? this.complete() : this.canCampfireExit() ? this.campfireExit() : null; },

    /** ¿Se puede volver a casa ahora? (en una hoguera; no en Pesadilla) */
    canCampfireExit() { const n = this.pendingNode(); return !!(n && n.type === 'rest' && DK.rules.canRetreat() && !this.kindDef().noExit); },
    /** Lo que te llevarías al volver desde la hoguera (para mostrarlo antes de decidir). */
    campfirePreview() {
      const e = this.active(); if (!e) return null;
      const keep = cfg().campfireKeep;
      return { pct: Math.round(keep * 100), coins: Math.round(e.loot.coins * keep), items: Math.round(this.lootCount() * keep), recruits: this.recruits().map((d) => DK.daskai.name(d)) };
    },
    /** Reparte unidad a unidad lo que se salva (redondeando al azar). → [salvado, perdido] */
    split(obj, keep) {
      const out = {}, lost = {};
      Object.entries(obj || {}).forEach(([id, n]) => { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < keep) k++; if (k) out[id] = k; if (n - k) lost[id] = n - k; });
      return [out, lost];
    },
    /**
     * Volver a casa desde una hoguera: la mitad del botín y de lo que has
     * ganado en la mochila (lo que llevabas al salir vuelve entero) y todos
     * los daskai reclutados se quedan para siempre.
     */
    campfireExit() {
      const e = this.active(); if (!this.canCampfireExit()) return null;
      this.ensureFields();
      const keep = cfg().campfireKeep;
      this.logEvent('campfire', { coins: Math.round(e.loot.coins * keep) });
      const [keptLoot, lostLoot] = this.split(e.loot.items, keep);
      const coins = Math.round(e.loot.coins * keep);
      // Mochila: lo que llevabas al salir vuelve entero; lo ganado, a medias
      const packed = e.packed || {}, base = {}, gained = {};
      Object.entries(e.pack || {}).forEach(([id, n]) => { const b = Math.min(n, packed[id] || 0); if (b) base[id] = b; if (n - b) gained[id] = n - b; });
      const [keptGain, lostPack] = this.split(gained, keep);
      const packBack = Object.assign({}, base);
      Object.entries(keptGain).forEach(([id, n]) => (packBack[id] = (packBack[id] || 0) + n));
      const kept = this.settleRecruits(true);
      const recruits = e.log.kept.concat(kept).map((x) => Object.assign({}, x, { kept: true }));
      // v4.74: el equipo encontrado, como el botín: cada pieza se queda con la misma probabilidad
      const gearKept = [], gearLost = [];
      (e.loot.gear || []).forEach((p) => (Math.random() < keep ? gearKept : gearLost).push(p));
      this.snapshot('campfire', { coins, items: keptLoot, lostItems: lostLoot, lostCoins: e.loot.coins - coins, recruits, packBack, lostPack, keepPct: Math.round(keep * 100), gear: gearKept.map(gearSnap), lostGear: gearLost.map(gearSnap) });
      this.closeRun();
      DK.gear.home().push(...gearKept);
      this.afterEnd();
      DK.bag.addHome(keptLoot); DK.bag.addHome(packBack); DK.wallet.add(coins);
      DK.emit('expedition:end', { campfire: true });
      DK.store.save();
      return { coins, items: keptLoot, recruits: kept };
    },

    /* ---------- Salvarse de la muerte ---------- */

    /** Salvaciones que quedan en esta expedición. */
    revivesLeft() { const e = this.active(); return e ? Math.max(0, DK.rules.maxRevives() - (e.revivesUsed || 0)) : 0; },

    /**
     * Intenta salvar de la muerte a un daskai que acaba de caer.
     * Orden: bendición del santuario → pluma de fénix de la bolsa.
     * Cada salvación gasta una de las disponibles en la expedición.
     * @returns {string|null} 'blessing' | 'feather' | null (no se salva)
     */
    trySave(d) {
      const e = this.active(); if (!e) return null;
      let how = null;
      if (e.blessed === d.uid) { how = 'blessing'; e.blessed = null; }
      else if (this.revivesLeft() > 0 && DK.bag.count('pluma_fenix') > 0) { how = 'feather'; DK.bag.remove('pluma_fenix'); }
      else if (this.revivesLeft() > 0 && DK.camp.value('fenix') && !e.altarUsed) { how = 'altar'; e.altarUsed = true; }
      if (!how) return null;
      e.revivesUsed = (e.revivesUsed || 0) + 1;
      this.logEvent('saved', { name: DK.daskai.name(d), how });
      const s = DK.daskai.stats(d);
      d.cur.hp = Math.max(1, Math.ceil(s.hp * DK.config.reviveHpPct));
      d.status = null;
      DK.store.save();
      return how;
    },

    /** Santuario: bendice a un daskai (se salvará de la muerte una vez). */
    bless(uid) { const e = this.active(); if (!e) return; e.blessed = uid; e.result = { key: 'exp.blessed', vars: { name: DK.daskai.name(DK.party.get(uid)) } }; DK.store.save(); },

    /**
     * Derrota: se pierde el botín y la mochila.
     * Si caes contra el JEFE del mapa (o.boss) sólo pierdes `bossDeathLoss`
     * de todo y la próxima expedición empieza con una recompensa (consolation).
     */
    /**
     * Al caer derrotado, ¿qué vuelve de la mochila? Sólo lo que TÚ metiste al
     * salir y no has gastado (y sólo si la dificultad lo permite: keepPack).
     * Todo lo encontrado por el camino se pierde.
     * @returns {[Object, Object]} [vuelve, se pierde]
     */
    packOnDefeat() {
      const e = this.active(), packed = e.packed || {}, back = {}, lost = {};
      const keep = DK.rules.keepPack();
      Object.entries(e.pack || {}).forEach(([id, n]) => {
        const mine = keep ? Math.min(n, packed[id] || 0) : 0;
        if (mine) back[id] = mine;
        if (n - mine) lost[id] = n - mine;
      });
      return [back, lost];
    },
    fail(o = {}) {
      const e = this.active(); if (!e) return null;
      this.ensureFields();
      this.logEvent('lost', { boss: !!o.boss });
      if (e.kind === 'averno') return this.avernoEnd();
      if (o.boss) return this.failAtBoss();
      const lost = Object.assign({ recruits: this.settleRecruits(false) }, e.loot);
      const recruits = e.log.kept.map((x) => Object.assign({}, x, { kept: true })).concat(lost.recruits.map((x) => Object.assign({}, x, { kept: false })));
      const [packBack, lostPack] = this.packOnDefeat();
      this.snapshot('lost', { coins: 0, items: {}, lostItems: e.loot.items, lostCoins: e.loot.coins, recruits, packBack, lostPack, keepPack: DK.rules.keepPack(), lostGear: (e.loot.gear || []).map(gearSnap) });
      this.closeRun();
      this.afterEnd({ defeat: true });
      DK.bag.addHome(packBack);
      DK.store.save();
      lost.packBack = packBack;
      return lost;
    },

    /** v5.31: caer en el Averno es la única salida: te llevas TODO el botín (con la bonificación por jefes) y su récord. */
    avernoEnd() {
      const e = this.active(); if (!e) return null;
      const rec = DK.averno.record(e);
      const r = this.claim(true);
      if (st().lastExpedition) st().lastExpedition.averno = rec; // (el resultado es «completed»: te llevas todo)
      DK.emit('expedition:end', { depth: st().lastExpedition && st().lastExpedition.depth, averno: true });
      DK.store.save();
      return Object.assign({ averno: rec, recruits: [] }, r || {});
    },

    /** Caer contra el jefe: se salva una parte y queda una recompensa para la próxima. */
    failAtBoss() {
      const e = this.active();
      const keep = 1 - cfg().bossDeathLoss;
      // Objetos: sólo vuelve lo que metiste en la mochila (según la dificultad); el botín de objetos se pierde
      const keptLoot = {}, lostLoot = Object.assign({}, e.loot.items);
      const [keptPack, lostPack] = this.packOnDefeat();
      const coins = Math.round(e.loot.coins * keep);
      const left = this.settleRecruits(false);
      const recruits = e.log.kept.map((x) => Object.assign({}, x, { kept: true })).concat(left.map((x) => Object.assign({}, x, { kept: false })));
      this.snapshot('lostBoss', { coins, items: keptLoot, lostItems: lostLoot, lostCoins: e.loot.coins - coins, recruits, packBack: keptPack, lostPack, keepPack: DK.rules.keepPack(), lostGear: (e.loot.gear || []).map(gearSnap) });
      st().consolation = { zone: e.zone, depth: e.depth || 1 };
      this.closeRun();
      this.afterEnd({ defeat: true });
      DK.bag.addHome(keptLoot); DK.bag.addHome(keptPack); DK.wallet.add(coins);
      DK.store.save();
      return { recruits: left, kept: keptLoot, coins, boss: true };
    },

    /**
     * Al volver de una expedición (cobrar, retirarse o perder):
     *  - se ajusta la vida al máximo sin el Vigor de la expedición;
     *  - los debilitados vuelven con un poco de vida (config.lossHpPct),
     *    para que siempre se pueda empezar otra expedición;
     *  - si el equipo se ha quedado sin nadie en pie pero hay daskai sanos
     *    en la reserva, se meten en el equipo;
     *  - si no queda ningún daskai, la partida termina.
     *  - derrota en Normal (rules.defeatHeal): el equipo vuelve con al menos
     *    el 50% de vida y maná.
     */
    /** Cierra la expedición: sin su bonus, el máximo de vida baja y la vida actual con él (v4.68). */
    closeRun() { const pct = DK.daskai.snapPct(); st().expedition = null; DK.daskai.applyPct(pct); },

    afterEnd({ defeat = false } = {}) {
      const P = DK.party, s = st(), heal = defeat ? DK.rules.defeatHeal() : 0;
      P.all().forEach((d) => {
        DK.daskai.clamp(d);
        if (DK.daskai.isFainted(d)) { const m = DK.daskai.stats(d); d.cur.hp = Math.max(1, Math.ceil(m.hp * DK.config.lossHpPct)); d.status = null; }
        if (heal) { const m = DK.daskai.stats(d); d.cur.hp = Math.max(d.cur.hp, Math.ceil(m.hp * heal)); d.cur.mp = Math.max(d.cur.mp, Math.ceil(m.mp * heal)); d.status = null; }
      });
      s.team = s.team.filter((u) => P.get(u));
      if (!s.team.length) P.all().slice(0, DK.config.maxTeam).forEach((d) => s.team.push(d.uid));
      if (!P.all().length) s.gameOver = s.gameOver || { at: Date.now(), zone: null };
    },

    /** Número de objetos en el botín. */
    lootCount() { const e = this.active(); return e ? Object.values(e.loot.items).reduce((a, b) => a + b, 0) + (e.loot.gear || []).length : 0; },
  };

  /* ======================= RELIQUIAS =======================
   * Bonificaciones de la expedición en curso (data/relics.js).
   *   DK.relics.list()            → reliquias activas
   *   DK.relics.sum('dmg')        → suma de un tipo de efecto
   *   DK.relics.houseDmg('fuego') → +% de daño para esa casa
   *   DK.relics.statPct('spd')    → +% de un atributo
   */
  DK.relics = {
    list() { const e = DK.expedition.active(); return e && e.relics ? e.relics.map((id) => D.relics[id]).filter(Boolean) : []; },
    sum(type) { return this.list().filter((r) => r.effect.type === type).reduce((a, r) => a + (r.effect.pct || r.effect.add || 0), 0); },
    houseDmg(house) { return this.list().filter((r) => r.effect.type === 'dmgHouse' && r.effect.house === house).reduce((a, r) => a + r.effect.pct, 0); },
    statPct(stat) { return this.list().filter((r) => r.effect.type === 'stat' && r.effect.stat === stat).reduce((a, r) => a + r.effect.pct, 0); },
    /** n reliquias al azar de esas rarezas que aún no tengas (con unlocked: sólo las desbloqueadas). */
    roll(rarities, n, { unlocked = false } = {}) {
      const e = DK.expedition.active();
      const have = (e && e.relics) || [];
      const pool = Object.values(D.relics).filter((r) => rarities.includes(r.rarity) && !have.includes(r.id) && (!unlocked || DK.camp.isUnlocked('relic', r.id)) && (DK.config.captureEnabled || r.effect.type !== 'capture')).map((r) => r.id);
      const out = [];
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      return out;
    },
    /** Añade una reliquia a la expedición. */
    give(id) {
      const e = DK.expedition.active(); if (!e || !id) return null;
      e.relics = e.relics || [];
      if (!e.relics.includes(id)) { const pct = DK.daskai.snapPct(); e.relics.push(id); DK.daskai.applyPct(pct); } // una reliquia de +PV no deja a nadie «herido»
      DK.store.save();
      return id;
    },
    /** Ofrece elegir entre varias (tras un rival de élite). */
    offer(rarities, n = 3) { const e = DK.expedition.active(); if (!e) return; e.relicChoice = this.roll(rarities, n); DK.store.save(); },
    /** Elige la reliquia i de la oferta (o ninguna con i = null). */
    choose(i) {
      const e = DK.expedition.active(); if (!e || !e.relicChoice) return null;
      const id = i == null ? null : e.relicChoice[i];
      e.relicChoice = null;
      if (id) { this.give(id); DK.expedition.logEvent('relic', { id }); }
      DK.store.save();
      return id;
    },
  };
  // Encargo «sin objetos»: usar un objeto curativo (en combate o fuera) lo falla
  // v5.9: rivales de la expedición (para el resumen)
  DK.on('battle:end', (r) => {
    const e = DK.expedition.active(); if (!e || !r || !r.enemy) return;
    e.log = e.log || {}; e.log.foes = e.log.foes || [];
    (r.foes || [r.enemy]).forEach((x) => { if (e.log.foes.length < 120) e.log.foes.push({ species: x.species, level: x.level, shiny: !!x.shiny, look: x.look || null, boss: !!r.boss, elite: !!r.elite, won: r.outcome === 'won' || r.outcome === 'captured', captured: r.outcome === 'captured', zone: r.zone }); });
  });
  DK.on('item:used', ({ id }) => {
    const u = D.items[id] && D.items[id].use;
    if (u && !u.capture && (u.heal || u.healPct || u.mana || u.manaPct || u.cure) && DK.expedition.active()) DK.expedition.questFail('item');
  });
})();
