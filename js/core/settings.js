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
    uiScale: 1,             // v4.57: tamaño de toda la interfaz (0.9 | 1 | 1.1 | 1.25), con CSS zoom
    uiStyle: 'clean',       // v4.69: limpio por defecto · 'clean' (limpio, css/clean.css) | 'exile' (Exilio: limpio + css/exile.css) | 'classic' (el de antes)
    styleV: 3,              // v4.69: versión de la migración de estilo (3 = el limpio pasa a ser el de por defecto, una vez)
    highContrast: false,
    colorblind: false,
    reduceMotion: false,
    musicVol: 0.35,
    sfxVol: 0.7,
    muted: false,
    battleSpeed: 1,         // 1 | 2 | 4
    showTraits: false,      // Códice: pestaña «Rasgos» y rasgos en la ficha (v4.48, oculto por defecto)
    bgFx: true,             // fondo animado de remolino (core/bgfx.js) fuera de la expedición
    pixelArt: true,         // daskai en pixel art (false = dibujo suave)
    dock: 'big',            // v5.24: barra inferior: 'big' (iconos grandes) · 'mix' (iconos y texto) · 'classic'
    autoBattle: false,      // los combates empiezan en modo automático
    autoPause: true,        // el automático se pausa si tu daskai baja del 30% de vida
    autoHeal: true,         // el automático usa un objeto curativo cuando tu daskai está en zona crítica
    skipAnims: false,
    showHotkeys: true,
    confirmFlee: false,
    customCursor: true,     // v4.93: cursor propio del juego (false = el del sistema)
    confirmForge: true,     // v4.84: la forja pide confirmar antes de usar una piedra
    confirmRelease: true,
    vibration: true,
    tutorials: true,
    seenTutorials: {},
    lastSlot: 1,
  };

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!raw.styleV) raw.styleV = 2;
      // v4.69: el estilo limpio pasa a ser el de por defecto (una vez; luego se respeta lo que elijas)
      if (raw.styleV < 3) { if (!raw.uiStyle || raw.uiStyle === 'exile') raw.uiStyle = 'clean'; raw.styleV = 3; }
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
      const z = Number(this.data.uiScale) || 1; el.style.zoom = z === 1 ? '' : String(z);
      el.style.setProperty('--uiz', String(z)); // v5.16: las capas fijas a pantalla completa compensan el zoom (si no, no llegaban al borde)
      el.dataset.style = this.data.uiStyle === 'classic' ? 'classic' : 'clean';
      el.dataset.skin = this.data.uiStyle === 'exile' ? 'exile' : 'none';
      el.dataset.contrast = this.data.highContrast ? 'high' : 'normal';
      el.dataset.colorblind = this.data.colorblind ? 'on' : 'off';
      el.dataset.motion = this.reducedMotion() ? 'reduced' : 'full';
      el.dataset.px = this.data.pixelArt === false ? 'off' : 'on'; // v5.20: fondos en pixel art (css/pixel.css)
      el.dataset.dock = ['big', 'mix', 'classic'].includes(this.data.dock) ? this.data.dock : 'big'; // v5.24: barra inferior
      el.dataset.hotkeys = this.data.showHotkeys ? 'on' : 'off';
      el.dataset.cursor = this.data.customCursor === false ? 'native' : 'game';
      if (DK.i18n) DK.i18n.setLang(this.data.lang);
    },
  };
})();
