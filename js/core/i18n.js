/* =============================================================
 * core/i18n.js — Traducciones.
 *
 * Los textos de la interfaz viven en js/lang/es.js y js/lang/en.js.
 *   DK.t('battle.flee')                 → "Huir"
 *   DK.t('battle.gainExp', {name, n})   → sustituye {name} y {n}
 *
 * Los datos (casas, atributos, pasivas...) pueden traducirse en el
 * apartado `data` de cada idioma. DK.tr() busca ahí y, si no existe,
 * usa el texto original del archivo de datos.
 * ============================================================= */
(function () {
  const dicts = {};

  DK.i18n = {
    lang: 'es',
    fallback: 'es',

    /**
     * Registra (o amplía) el diccionario de un idioma.
     * @param {string} lang  código del idioma ('es', 'en'...)
     * @param {Object} dict  objeto anidado de textos
     */
    register(lang, dict) { dicts[lang] = deepMerge(dicts[lang] || {}, dict); },

    /** Idiomas disponibles: [{id, name}] */
    languages() { return Object.keys(dicts).map((id) => ({ id, name: (dicts[id].meta && dicts[id].meta.name) || id })); },

    /** Cambia el idioma activo. */
    setLang(lang) { if (dicts[lang]) this.lang = lang; document.documentElement.lang = this.lang; },

    /** Busca una clave "a.b.c" en un diccionario. */
    lookup(lang, key) {
      let cur = dicts[lang];
      for (const part of key.split('.')) { if (cur == null) return undefined; cur = cur[part]; }
      return cur;
    },

    /**
     * Traduce una clave y sustituye variables {nombre}.
     * Si la clave no existe devuelve la propia clave (fácil de detectar).
     */
    t(key, vars) {
      let s = this.lookup(this.lang, key);
      if (s == null) s = this.lookup(this.fallback, key);
      if (s == null) return key;
      if (typeof s === 'function') return s(vars || {});
      if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
      return s;
    },

    /** ¿Existe esta clave en el idioma base? (lo usan las pruebas) */
    has(key) { return this.lookup(this.fallback, key) != null; },
  };

  /**
   * Traduce un campo de un objeto de datos.
   * @param {string} kind   tipo: 'houses' | 'stats' | 'natures' | 'passives' | ...
   * @param {Object} obj    objeto de datos con `id`
   * @param {string} field  campo a traducir ('name', 'desc'...)
   */
  DK.tr = function (kind, obj, field = 'name') {
    if (!obj) return '';
    const v = DK.i18n.lookup(DK.i18n.lang, `data.${kind}.${obj.id}.${field}`);
    return v != null ? v : obj[field];
  };

  DK.t = (key, vars) => DK.i18n.t(key, vars);

  function deepMerge(a, b) {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = deepMerge(a[k] || {}, v);
      else a[k] = v;
    }
    return a;
  }
})();
