/* =============================================================
 * core/settings.js — Ajustes del jugador (independientes de la partida).
 *
 *   DK.settings.get('musicVol')
 *   DK.settings.set('musicVol', 0.5)   → guarda y aplica
 *   DK.on('settings:changed', ({key, value}) => ...)
 * ============================================================= */
(function () {
  const KEY = 'daskai.settings';

  /** Valores por defecto de todos los ajustes. */
  const DEFAULTS = {
    theme: null,            // 'dark' | 'light' | null (según el sistema)
    lang: 'es',
    textSize: 'md',         // 'sm' | 'md' | 'lg' | 'xl'
    uiStyle: 'exile',       // 'exile' (Exilio: limpio + css/exile.css) | 'clean' (limpio, css/clean.css) | 'classic' (el de antes)
    styleV: 2,              // v4.36: las partidas con el estilo limpio por defecto pasan a «Exilio» una vez
    highContrast: false,
    colorblind: false,
    reduceMotion: false,
    musicVol: 0.35,
    sfxVol: 0.7,
    muted: false,
    battleSpeed: 1,         // 1 | 2 | 4
    bgFx: true,             // fondo animado de remolino (core/bgfx.js) fuera de la expedición
    pixelArt: true,         // daskai en pixel art (false = dibujo suave)
    autoBattle: false,      // los combates empiezan en modo automático
    autoPause: true,        // el automático se pausa si tu daskai baja del 30% de vida
    autoHeal: true,         // el automático usa un objeto curativo cuando tu daskai está en zona crítica
    skipAnims: false,
    showHotkeys: true,
    confirmFlee: false,
    confirmRelease: true,
    vibration: true,
    tutorials: true,
    seenTutorials: {},
    lastSlot: 1,
  };

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!raw.styleV) { if (!raw.uiStyle || raw.uiStyle === 'clean') raw.uiStyle = 'exile'; raw.styleV = 2; }
      return Object.assign({}, DEFAULTS, raw);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }

  DK.settings = {
    data: read(),
    defaults: DEFAULTS,

    /** Lee un ajuste. */
    get(k) { return this.data[k]; },

    /** Cambia un ajuste, lo guarda, lo aplica y avisa con 'settings:changed'. */
    set(k, v) {
      this.data[k] = v;
      this.save();
      this.apply();
      DK.emit('settings:changed', { key: k, value: v });
    },

    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento */ } },

    /** Restaura todos los ajustes a sus valores por defecto. */
    reset() { this.data = Object.assign({}, DEFAULTS); this.save(); this.apply(); DK.emit('settings:changed', {}); },

    /** Tema efectivo (resuelve null usando la preferencia del sistema). */
    theme() {
      if (this.data.theme) return this.data.theme;
      return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    },

    /** ¿Hay que reducir animaciones? (ajuste o preferencia del sistema) */
    reducedMotion() {
      return this.data.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    /** Aplica los ajustes visuales al documento (atributos en <html>). */
    apply() {
      const el = document.documentElement;
      el.dataset.theme = this.theme();
      // La barra del sistema (móvil / app instalada) del mismo color que el fondo del juego
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && window.getComputedStyle) { const bg = getComputedStyle(el).getPropertyValue('--bg').trim(); if (bg) meta.setAttribute('content', bg); }
      el.dataset.textsize = this.data.textSize;
      el.dataset.style = this.data.uiStyle === 'classic' ? 'classic' : 'clean';
      el.dataset.skin = this.data.uiStyle === 'exile' ? 'exile' : 'none';
      el.dataset.contrast = this.data.highContrast ? 'high' : 'normal';
      el.dataset.colorblind = this.data.colorblind ? 'on' : 'off';
      el.dataset.motion = this.reducedMotion() ? 'reduced' : 'full';
      el.dataset.hotkeys = this.data.showHotkeys ? 'on' : 'off';
      if (DK.i18n) DK.i18n.setLang(this.data.lang);
    },
  };
})();
