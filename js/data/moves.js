/* =============================================================
 * data/moves.js — Ataques (cargador).
 *
 * Los ataques se editan en data/moves.json (luego: node tools/data.js).
 *  {
 *    "name", "desc",
 *    "kind":  "fisico" (no gasta maná) | "magico" (gasta "mp"),
 *    "house": casa del ataque (eficacia, color y animación). Sin casa → usa la del daskai,
 *    "power": daño base (sin power = ataque de apoyo),
 *    "mp":    maná que gasta,  "acc": precisión 1-100 (por defecto 100),
 *    "effect": { "type": "status"|"buff"|"debuff"|"heal"|"drain", ... },
 *    "priority": 1 actúa antes que los normales · -1 después (la velocidad desempata)
 *  }
 * ============================================================= */
(function () {
  const M = (DK.data.moves = {});
  Object.entries(DK.raw.moves).forEach(([id, o]) => {
    M[id] = Object.assign({ id, acc: 100, mp: 0, power: 0, house: null }, o);
  });
})();
