/* =============================================================
 * data/bossPhases.js — Fases de los jefes.
 *
 * Cuando la vida del jefe baja de `at` (0..1) entra en una fase nueva.
 * Tipos (los aplica DK.battle.enterPhase en systems/battle.js):
 *   enrage  furia: +2 ataque, +2 ataque mágico y +1 velocidad
 *   regen   se cura un 25%, se quita los estados y regenera cada turno
 *   shield  escudo de 3 cargas: recibe un 65% menos de daño. Un ataque
 *           eficaz (casa fuerte contra la suya) lo rompe de golpe; los
 *           demás quitan una carga
 *   frenzy  frenesí: uno de cada dos turnos ataca dos veces
 * ============================================================= */
(function () {
  DK.data.phaseTypes = {
    enrage: { icon: 'flame' }, regen: { icon: 'regen' }, shield: { icon: 'shield' }, frenzy: { icon: 'bolt' },
  };
  DK.data.bossPhases = {
    pradera: [{ at: 0.5, type: 'enrage' }],
    bosque: [{ at: 0.5, type: 'regen' }],
    costa: [{ at: 0.6, type: 'shield' }],
    cavernas: [{ at: 0.6, type: 'shield' }, { at: 0.3, type: 'enrage' }],
    volcan: [{ at: 0.6, type: 'enrage' }, { at: 0.3, type: 'frenzy' }],
    templo: [{ at: 0.66, type: 'regen' }, { at: 0.33, type: 'shield' }],
    abismo: [{ at: 0.66, type: 'frenzy' }, { at: 0.33, type: 'shield' }],
    cumbre: [{ at: 0.75, type: 'shield' }, { at: 0.5, type: 'enrage' }, { at: 0.25, type: 'frenzy' }],
  };
})();
