/* =============================================================
 * core/fx.js — Respuesta visual al pulsar (v4.35).
 *
 * Al pulsar algo interactivo (botones, pestañas, fichas, lugares del
 * campamento…) le pone .is-pressed un momento (css/motion.css hace saltar
 * su icono o lo aplasta). Con «Reducir animaciones» no hace nada.
 * (El anillo que salía donde pulsabas se quitó en la v4.36.)
 * ============================================================= */
(function () {
  const SEL = '.btn, .icon-btn, .dock-slot, .inv-tabs > button, .tab, .camp-spot, .camp-mon, .tile, .tr-tile, .wb-tile, .cx-card, .cx-zone, .tr-boost, .hud-profile, .exp-node, .dk-row, .item-card, .save-slot, .save-main, .save-tool';
  const reduced = () => document.documentElement.dataset.motion === 'reduced';
  document.addEventListener('pointerdown', (e) => {
    if (reduced() || e.button > 0) return;
    const el = e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    el.classList.remove('is-pressed'); void el.offsetWidth; el.classList.add('is-pressed');
    clearTimeout(el._fxT); el._fxT = setTimeout(() => el.classList.remove('is-pressed'), 420);
  }, { passive: true });
})();
