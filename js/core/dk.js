/* =============================================================
 * core/dk.js — Espacio de nombres global y utilidades básicas.
 *
 * Todo el juego cuelga de `window.DK` para que funcione abriendo
 * index.html directamente (sin servidor ni módulos ES).
 *
 *   DK.data   → datos del juego (especies, ataques, objetos...)
 *   DK.util   → funciones de ayuda genéricas
 *   DK.on / DK.emit → bus de eventos para desacoplar sistemas
 * ============================================================= */
(function () {
  const DK = (window.DK = window.DK || {});
  DK.data = DK.data || {};
  DK.version = '4.29.0';

  DK.util = {
    /** Entero aleatorio entre min y max (ambos incluidos). */
    rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },

    /** Decimal aleatorio entre min y max. */
    randf(min, max) { return Math.random() * (max - min) + min; },

    /** Devuelve true con probabilidad p (0-1). */
    chance(p) { return Math.random() < p; },

    /** Elemento aleatorio de un array (rnd: generador con semilla, opcional). */
    pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; },

    /** Limita v al rango [a, b]. */
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

    /** Identificador único corto. */
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

    /** Promesa que se resuelve tras `ms` milisegundos. */
    sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },

    /** Copia profunda de un objeto serializable. */
    clone(o) { return JSON.parse(JSON.stringify(o)); },

    /**
     * Elige un elemento de una lista según su peso.
     * @param {Array<Object>} list  elementos con propiedad de peso
     * @param {string} key          nombre de la propiedad (por defecto 'weight')
     * @param {Function} [rnd]      generador (para resultados con semilla)
     */
    weighted(list, key = 'weight', rnd = Math.random) {
      const total = list.reduce((s, x) => s + (x[key] || 1), 0);
      let r = rnd() * total;
      for (const x of list) { r -= x[key] || 1; if (r <= 0) return x; }
      return list[list.length - 1];
    },

    /**
     * Elige una clave de un objeto { clave: peso } según su peso.
     * @param {Object<string, number>} weights
     * @param {Function} [rnd]       generador (para resultados con semilla)
     * @param {*} [fallback]         si no sale ninguna (por defecto, la última)
     */
    weightedKey(weights, rnd = Math.random, fallback) {
      const list = Object.entries(weights);
      let r = rnd() * list.reduce((a, [, w]) => a + w, 0);
      for (const [k, w] of list) if ((r -= w) < 0) return k;
      return fallback !== undefined ? fallback : list.length ? list[list.length - 1][0] : null;
    },
    /** { id: { weight } } → { id: weight } (para weightedKey). */
    weightsOf(obj, key = 'weight') { return Object.fromEntries(Object.entries(obj).map(([id, o]) => [id, o[key] || 1])); },
    /** Porcentaje entero de a sobre b (0 si b es 0): percent(30, 120) → 25. */
    percent(a, b) { return b ? Math.round((a / b) * 100) : 0; },

    /** Formatea 0.25 → "25%". */
    pct(x, digits = 0) { return (x * 100).toFixed(digits) + '%'; },

    /** Añade signo a un número: 3 → "+3". */
    signed(n) { return (n > 0 ? '+' : '') + n; },

    /** Formatea segundos como "1 h 05 min". */
    duration(sec) {
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
      return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
    },

    /**
     * Generador pseudoaleatorio con semilla (mulberry32).
     * Se usa para que las misiones diarias sean iguales todo el día.
     * @param {string} seedText texto semilla (p. ej. la fecha)
     * @returns {() => number} función que devuelve números 0-1
     */
    seeded(seedText) {
      let a = 0;
      for (let i = 0; i < seedText.length; i++) a = (Math.imul(31, a) + seedText.charCodeAt(i)) | 0;
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    /** Fecha local en formato AAAA-MM-DD. */
    today() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    /** Identificador de la semana ISO: "2026-W44". */
    week() {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      const w1 = new Date(d.getFullYear(), 0, 4);
      const n = 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
      return `${d.getFullYear()}-W${String(n).padStart(2, '0')}`;
    },
  };

  /* ---------------- Bus de eventos ----------------
   * DK.on('battle:won', fn)  → se suscribe (devuelve función para darse de baja)
   * DK.emit('battle:won', datos) → avisa a todos los suscriptores
   * Eventos que emite el juego: ver docs/GUIA-DESARROLLO.md
   */
  const listeners = {};
  DK.on = (ev, fn) => {
    (listeners[ev] = listeners[ev] || []).push(fn);
    return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); };
  };
  DK.emit = (ev, payload) => (listeners[ev] || []).forEach((f) => {
    try { f(payload); } catch (e) { console.error('Error en evento', ev, e); }
  });
})();
