/* =============================================================
 * core/router.js — Registro de pantallas y navegación con pila.
 *
 * Crear una pantalla:
 *   DK.screens.register('miPantalla', {
 *     title: 'Título' | (params) => 'Título',
 *     icon: 'star',                 // icono de la barra superior
 *     back: true,                   // false = sin botón Volver ni Esc
 *     render(params, ctx) { return nodo; },   // obligatorio
 *     onEnter(params, ctx) {},      // tras pintarse (registra atajos aquí o en render)
 *     onLeave(params) {},           // al salir
 *     tutorial: 'clave',            // muestra DK.tutorial al entrar por primera vez
 *     music: 'menu'                 // pista de música al entrar (opcional)
 *   });
 *
 * Navegar:
 *   DK.router.go('id', params)      → avanza
 *   DK.router.back()                → vuelve
 *   DK.router.replace('id', params) → sustituye la pantalla actual
 *   DK.router.reset('id', params)   → vacía la pila y abre 'id'
 *   DK.router.guard = (id, params) → null | { id, params }   (redirigir)
 *   DK.router.refresh()             → vuelve a pintar la actual
 * ============================================================= */
(function () {
  const screens = {};
  const stack = [];

  DK.screens = {
    /** Registra una pantalla. */
    register(id, def) { screens[id] = Object.assign({ id }, def); return screens[id]; },
    get(id) { return screens[id]; },
    all() { return Object.values(screens); },
  };

  const current = () => stack[stack.length - 1];

  function leave() {
    const e = current();
    if (!e) return;
    const d = screens[e.id];
    if (d && d.onLeave) d.onLeave(e.params);
  }

  /**
   * Pinta la pantalla de la cima de la pila.
   * @param {'forward'|'back'|'none'} dir dirección de la animación
   */
  function render(dir = 'none') {
    const entry = current();
    if (!entry) return;
    const def = screens[entry.id];
    if (!def) { console.error('Pantalla no registrada:', entry.id); return; }
    if (DK.store && DK.store.state) DK.store.save();
    if (dir !== 'none') DK.ui.closeAll();
    DK.keys.resetBase();
    DK.ui.hideTip();
    const ctx = { params: entry.params, refresh: () => DK.router.refresh(), entry };
    let el;
    try { el = def.render(entry.params, ctx); } catch (err) {
      // v5.14.1: si una pantalla falla al pintarse, nunca te quedas atrapado en la anterior
      console.error('Error al pintar la pantalla', entry.id, err);
      const safe = entry.id === 'hub' ? null : (DK.expedition && DK.expedition.active() ? 'expedition' : 'hub');
      if (safe && safe !== entry.id && !render.failing) {
        render.failing = true;
        try { stack.length = 0; stack.push({ id: safe, params: {} }); render('fade'); } finally { render.failing = false; }
      }
      // v5.19.1: avisa siempre (antes, si fallaba el propio mapa de la expedición, se quedaba la pantalla vieja sin decir nada)
      if (DK.ui && DK.ui.toast && !render.failing) DK.ui.toast((DK.t ? DK.t('common.screenError') : 'Error') + ' · ' + String(err && err.message || err).slice(0, 80), { icon: 'info', kind: 'bad' });
      return;
    }
    DK.app.mount(el, def, entry, stack.length > 1 && def.back !== false, dir);
    if (def.onEnter) def.onEnter(entry.params, ctx);
    try { if (def.music && DK.audio) DK.audio.music(typeof def.music === 'function' ? def.music(entry.params) : def.music); } catch (e) { console.warn('Música:', e); }
    if (def.tutorial && DK.tutorial && dir !== 'none') DK.tutorial.maybe(def.tutorial);
    DK.emit('screen:enter', { id: entry.id, params: entry.params });
  }

  DK.router = {
    /**
     * Guardián opcional: (id, params) → null para dejar pasar, o
     * { id, params } para ir a otra pantalla. Lo usa el modo expedición
     * (screens/expedition.js) para que sólo se pueda ir al mapa, al
     * equipo y a la mochila mientras estás fuera.
     */
    guard: null,
    go(id, params = {}, opts = {}) {
      const g = this.guard && this.guard(id, params);
      if (g) { id = g.id; params = g.params || {}; }
      // Transición propia de la pantalla (p. ej. la cortinilla del combate): llama a go() de nuevo cuando toca
      const def = screens[id];
      if (def && def.transition && !opts.now) { def.transition(params, () => this.go(id, params, Object.assign({}, opts, { now: true }))); return; }
      leave();
      if (opts.reset) stack.length = 0;
      else if (opts.replace) stack.pop();
      stack.push({ id, params });
      render(opts.reset ? 'fade' : 'forward');
    },
    reset(id, params = {}) { this.go(id, params, { reset: true }); },
    replace(id, params = {}) { this.go(id, params, { replace: true }); },
    /** Vuelve a la pantalla anterior. Devuelve false si no hay a dónde volver. */
    back() {
      if (stack.length <= 1) return false;
      const d = screens[current().id];
      if (d.back === false) return false;
      leave();
      stack.pop();
      render('back');
      return true;
    },
    refresh() { render('none'); },
    current,
    depth: () => stack.length,
    /** ¿Está esta pantalla en la pila? */
    has: (id) => stack.some((e) => e.id === id),
  };
})();
