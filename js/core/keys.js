/* =============================================================
 * core/keys.js — Atajos de teclado por "capas".
 *
 * Cada pantalla registra sus atajos al pintarse; el router borra la
 * capa base al cambiar de pantalla. Los modales abren una capa nueva
 * encima, así los atajos de la pantalla no se disparan con un modal.
 *
 *   DK.keys.on('1', () => atacar())          → capa actual
 *   const off = DK.keys.on('Escape', cerrar) → off() lo elimina
 *   DK.keys.push() / DK.keys.pop()           → abrir/cerrar capa (modales)
 * ============================================================= */
(function () {
  const layers = [{}];

  /** Normaliza la tecla de un evento: 'a', '1', 'Escape', ' ' → 'Space'. */
  function norm(e) {
    if (e.key === ' ') return 'Space';
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  DK.keys = {
    /**
     * Registra un atajo en la capa superior.
     * @param {string} key  tecla ('1', 'a', 'Escape', 'Space', '?')
     * @param {Function} fn acción
     * @returns {Function} función para quitar el atajo
     */
    on(key, fn) {
      const layer = layers[layers.length - 1];
      const k = key.length === 1 ? key.toLowerCase() : key;
      (layer[k] = layer[k] || []).push(fn);
      return () => { layer[k] = (layer[k] || []).filter((f) => f !== fn); };
    },
    /** Abre una capa nueva (al abrir un modal). */
    push() { layers.push({}); },
    /** Cierra la capa superior. */
    pop() { if (layers.length > 1) layers.pop(); },
    /** Vacía la capa base (lo llama el router al cambiar de pantalla). */
    resetBase() { layers[0] = {}; },
    /** ¿Hay un modal (capa) abierto? */
    inModal() { return layers.length > 1; },
  };

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (typing && e.key !== 'Escape') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = norm(e);
    const layer = layers[layers.length - 1];
    const fns = layer[k];
    if (fns && fns.length) {
      e.preventDefault();
      fns[fns.length - 1](e);
      return;
    }
    // Esc sin manejador en la pantalla → volver atrás
    // Esc: volver; si no hay a dónde, abre el menú de pausa (dentro de una partida)
    if (k === 'Escape' && layers.length === 1 && DK.router && !DK.router.back() && DK.store && DK.store.state && document.body.dataset.nav === 'on' && DK.app.openMenu) DK.app.openMenu();
  });
})();
