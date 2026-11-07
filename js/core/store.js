/* =============================================================
 * core/store.js — Estado de la partida, ranuras de guardado,
 * exportar e importar.
 *
 *   DK.store.state          → objeto con toda la partida actual
 *   DK.store.save()         → guarda la ranura activa
 *   DK.store.load(n)        → carga la ranura n (1..3)
 *   DK.store.slotMeta(n)    → resumen para la pantalla de partidas
 *   DK.store.exportSlot(n)  → descarga un .json
 *   DK.store.importFile(file, n) → promesa
 *
 * Si añades campos nuevos al estado, dales valor por defecto en
 * `migrate()` para que las partidas antiguas sigan funcionando.
 * ============================================================= */
(function () {
  const SLOT_KEY = (n) => `daskai.slot.${n}`;
  const SAVE_DELAY = 400; // ms: las peticiones de guardado se agrupan (DK.store.save)
  const LEGACY_KEY = 'daskai.save.v1';
  const SLOTS = 3;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };

  // Partida de la versión 1 → ranura 1
  if (ls.get(LEGACY_KEY) && !ls.get(SLOT_KEY(1))) { ls.set(SLOT_KEY(1), ls.get(LEGACY_KEY)); ls.del(LEGACY_KEY); }

  DK.store = {
    state: null,
    slot: null,
    slots: SLOTS,

    /** Lee la partida guardada en una ranura (sin activarla). */
    read(n) { if (n === this.slot) this.flush(); const raw = ls.get(SLOT_KEY(n)); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } },

    /** ¿Hay alguna partida guardada? */
    hasAnySave() { for (let i = 1; i <= SLOTS; i++) if (ls.get(SLOT_KEY(i))) return true; return false; },

    /** Resumen de una ranura para mostrarla. */
    slotMeta(n) {
      const s = this.read(n);
      if (!s) return { slot: n, exists: false };
      const party = s.party || [];
      const best = party.slice().sort((a, b) => b.level - a.level)[0];
      // v4.73: el líder tal cual (aspecto, dos casas, forma) para el retrato de la ranura
      const lead = party.find((d) => s.team && d.uid === s.team[0]) || best;
      let leader = null;
      try { leader = lead && DK.looks && DK.data.species[lead.species] ? { species: lead.species, look: DK.looks.of(Object.assign({}, lead, { look: lead.look && Object.assign({}, lead.look) })), shiny: !!lead.shiny } : null; } catch (e) { leader = null; }
      return {
        slot: n, exists: true, name: s.player && s.player.name, updated: s.updated || s.created,
        playTime: (s.stats && s.stats.playTime) || 0, count: party.length,
        bestSpecies: best && best.species, bestLevel: best ? best.level : 0, coins: s.coins || 0,
        zones: Object.values(s.zones || {}).filter((z) => z.unlocked).length, gameOver: !!s.gameOver, fallen: (s.graveyard || []).length,
        avatar: s.player && s.player.avatar, frame: s.player && s.player.frame, leader,
        emblems: s.emblems || 0, expeditions: (s.stats && s.stats.expeditions) || 0, bosses: (s.stats && s.stats.bossesDefeated) || 0,
        difficulty: s.difficulty || null, inExpedition: !!s.expedition,
      };
    },

    /** Activa la partida de la ranura n. */
    load(n) {
      const s = this.read(n);
      if (!s) return false;
      this.state = s; this.slot = n;
      this.migrate();
      DK.settings.set('lastSlot', n);
      DK.emit('game:loaded', { slot: n });
      return true;
    },

    /**
     * Pide guardar la partida. No escribe al momento: agrupa todas las
     * peticiones de los próximos SAVE_DELAY ms en una sola escritura
     * (un combate o un clic en el mapa pueden pedir guardar decenas de
     * veces). Se escribe seguro al cerrar la partida, al salir del juego o
     * al cambiar de pestaña/app (ver flush()).
     */
    save() {
      if (DK.daskai && DK.daskai.touch) DK.daskai.touch(); // los atributos en caché se recalculan
      if (!this.state || !this.slot) return;
      this._dirty = true;
      if (!this._timer) this._timer = setTimeout(() => this.flush(), SAVE_DELAY);
    },
    /** Escribe ya lo pendiente (si hay algo). Devuelve true si ha escrito. */
    flush() {
      clearTimeout(this._timer); this._timer = null;
      if (!this._dirty || !this.state || !this.slot) return false;
      this._dirty = false;
      this.state.updated = Date.now();
      ls.set(SLOT_KEY(this.slot), JSON.stringify(this.state));
      return true;
    },

    /** Cierra la partida activa (sin borrarla). */
    close() { this.save(); this.flush(); this.state = null; this.slot = null; },

    /** Borra una ranura. */
    deleteSlot(n) { if (this.slot === n) { clearTimeout(this._timer); this._timer = null; this._dirty = false; this.state = null; this.slot = null; } ls.del(SLOT_KEY(n)); },

    /**
     * Crea una partida nueva en la ranura indicada.
     * @param {number} n        ranura 1..3
     * @param {string} name     nombre del aventurero
     * @param {string} starterId especie inicial
     * @param {string} [difficulty] id de data/difficulties.js
     * @param {Object} [made] el inicial ya creado (pantalla de elegir: el que has visto)
     */
    newGame(n, name, starterId, difficulty, made) {
      const firstZone = Object.values(DK.data.zones)[0].id;
      this.slot = n;
      this.state = {
        version: 2, growthV: 2, created: Date.now(), updated: Date.now(),
        player: { name },
        difficulty: difficulty || DK.data.defaultDifficulty,
        party: [], team: [],
        bag: Object.assign({}, DK.config.startingBag),
        coins: DK.config.startingCoins,
        codex: {},
        zones: { [firstZone]: { unlocked: true, wins: 0 } },
      };
      this.migrate();
      const d = made && made.species === starterId ? made : DK.daskai.create(starterId, DK.config.starterLevel, { starter: true });
      DK.party.add(d);
      DK.settings.set('lastSlot', n);
      this.save(); this.flush();
      DK.emit('game:new', { slot: n });
      return d;
    },

    /** Rellena campos que falten (partidas antiguas o nuevas). */
    migrate() {
      const s = this.state;
      s.version = 2;
      s.bag = s.bag || {}; s.codex = s.codex || {}; s.zones = s.zones || {};
      // v4.47: aspecto de cada daskai → el Códice apunta las variantes y rasgos de los tuyos
      if (!s.looks && DK.looks) { s.looks = { seen: {}, traits: {} }; (s.party || []).forEach((d) => DK.looks.see(d)); }
      if (s.coins == null) s.coins = DK.config.startingCoins; // partidas de la v1 no tenían monedas
      s.bosses = s.bosses || {};
      s.favorites = s.favorites || [];
      s.graveyard = s.graveyard || [];
      s.essences = s.essences || [];      // esencias de caídos (DK.legacy)
      s.camp = s.camp || {};              // mejoras del campamento (DK.camp)
      s.runes = s.runes || {};            // runas de expedición (DK.runes)
      // Senda del aventurero (DK.pass): las partidas antiguas reciben los puntos de sus logros
      if (!s.pass) {
        const pts = DK.data.pass.points, got = s.achievements || {};
        s.pass = { xp: DK.data.achievements.filter((a) => got[a.id]).reduce((n, a) => n + (a.hidden ? pts.hidden : pts.achievement), 0), claimed: {}, extra: 0 };
      }
      s.missions = s.missions || {};
      // Final del juego (systems/endgame.js)
      s.corruption = s.corruption || { max: 0 };
      s.abyss = s.abyss || { best: 0, rewarded: 0 };
      s.tracking = s.tracking || {};
      s.cosmetics = s.cosmetics || { frames: [], titles: [] };
      // Las Mejoras «Rumbo» (v4.21) se cambiaron por runas: se devuelven sus emblemas
      const RUMBO = { rumbo_captura: [2, 3, 5], rumbo_combate: [2, 3, 5], rumbo_tesoro: [2, 3, 5], rumbo_desafio: [3, 4, 6] };
      Object.entries(RUMBO).forEach(([id, costs]) => { const lv = s.camp[id] || 0; if (lv) s.emblems = (s.emblems || 0) + costs.slice(0, lv).reduce((a, b) => a + b, 0); delete s.camp[id]; });
      s.expHistory = s.expHistory || [];  // resúmenes de expediciones (Perfil)
      // v4.69: el crecimiento por nivel bajó (≈2,9 → ≈2 de media, entre 0 y 5). Los daskai que ya tenías se
      // ajustan una vez en la misma proporción (sólo lo ganado al subir de nivel; no el equipo ni los tónicos)
      if (!s.growthV) {
        (s.party || []).forEach((d) => {
          if (!d.growth) return;
          Object.keys(d.growth).forEach((k) => { d.growth[k] = Math.max(0, Math.round(d.growth[k] * 0.72)); });
          if (d.natureGrowth) Object.keys(d.natureGrowth).forEach((k) => { d.natureGrowth[k] = Math.round(d.natureGrowth[k] * 0.72); });
          if (d.cur) d.cur._rescale = true;
        });
        s.growthV = 2;
        setTimeout(() => { (s.party || []).forEach((d) => { if (d.cur && d.cur._rescale) { delete d.cur._rescale; DK.daskai.touch(); DK.daskai.clamp && DK.daskai.clamp(d); } }); }, 0);
      }
      s.difficulty = s.difficulty || DK.data.defaultDifficulty;
      // Máximo de ataques reducido: los que sobran pasan a la reserva (siguen en learned)
      (s.party || []).forEach((d) => { if (d.moves && d.moves.length > DK.config.maxMoves) d.moves = d.moves.slice(0, DK.config.maxMoves); });
      // Recetas conocidas: partidas antiguas conocen las básicas y sus favoritas
      if (!s.recipesKnown) s.recipesKnown = [...new Set([...(DK.data.starterRecipes || []), ...s.favorites])];
      s.notifiedReady = s.notifiedReady || [];
      s.achievements = s.achievements || {};
      s.missions = s.missions || {};
      s.expedition = s.expedition || null;
      if (s.expedition && DK.expedition) { DK.expedition.ensureMap(); DK.expedition.ensureFields(); } // expediciones de versiones anteriores
      // Partidas que quedaron con todo el equipo debilitado tras una expedición (bug de la v3.7)
      if (!s.expedition && DK.expedition && s.party && s.party.length && (s.party || []).every((d) => d.cur && d.cur.hp <= 0)) setTimeout(() => { DK.expedition.afterEnd(); DK.store.save(); }, 0);
      s.stats = Object.assign({
        battles: 0, wins: 0, losses: 0, flees: 0, captures: 0, crafts: 0, itemsUsed: 0,
        damageDealt: 0, damageTaken: 0, crits: 0, expeditions: 0, bossesDefeated: 0,
        coinsEarned: 0, coinsSpent: 0, evolutions: 0, shinies: 0, released: 0, playTime: 0, usage: {},
        streak: 0, bestStreak: 0, biggestHit: 0, bestDepth: 0, defeatedHouses: {}, history: [],
      }, s.stats || {});
      // Perfil del jugador (avatar: null = el líder del equipo; ver components/avatar.js)
      s.player = Object.assign({ avatar: null, frame: 'none', title: null, motto: '' }, s.player);
      (s.party || []).forEach((d) => {
        d.learned = d.learned || d.moves.slice();
        d.equip = d.equip || [null, null];
        // Partidas antiguas: estima la parte de naturaleza de lo ya crecido (de media 1,5 de cada 3,5 puntos)
        if (!d.natureGrowth) {
          d.natureGrowth = {};
          DK.data.statKeys.forEach((k) => { d.natureGrowth[k] = DK.data.natureEffect(d.nature, k) > 0 ? Math.round(d.growth[k] * (1.5 / 3.5)) : 0; });
        }
      });
    },

    /** Descarga la ranura n como archivo .json. */
    exportSlot(n) {
      if (n === this.slot) this.flush();
      const raw = ls.get(SLOT_KEY(n));
      if (!raw) return false;
      const meta = this.slotMeta(n);
      const blob = new Blob([raw], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `daskai-${(meta.name || 'partida').replace(/[^\w-]+/g, '_')}-${DK.util.today()}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return true;
    },

    /**
     * Importa un archivo .json en la ranura n.
     * @returns {Promise<boolean>}
     */
    importFile(file, n) {
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => {
          try {
            const s = JSON.parse(r.result);
            if (!s || !Array.isArray(s.party) || !s.player) throw new Error('formato');
            ls.set(SLOT_KEY(n), JSON.stringify(s));
            resolve(true);
          } catch (e) { resolve(false); }
        };
        r.onerror = () => resolve(false);
        r.readAsText(file);
      });
    },
  };

  // Tiempo de juego: suma 10 s cada 10 s mientras haya partida y la pestaña esté visible
  setInterval(() => {
    if (DK.store.state && document.visibilityState === 'visible') { DK.store.state.stats.playTime += 10; }
  }, 10000);
  window.addEventListener('beforeunload', () => DK.store.save());
  // Nunca se pierde lo pendiente: al salir, recargar o pasar a segundo plano se guarda ya
  if (typeof window !== 'undefined' && window.addEventListener) {
    const flush = () => DK.store.flush();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
})();
