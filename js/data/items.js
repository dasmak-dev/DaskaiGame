/* =============================================================
 * data/items.js — Objetos (cargador).
 *
 * Los objetos se editan en data/items.json (luego: node tools/data.js).
 *  "category": "batalla" | "mejora" | "equipo" | "pieza" (data/basics.js → categories)
 *  "rarity":   "comun" | "raro" | "epico" | "legendario"
 *  batalla → "use": { heal, healPct, mana, manaPct, cure: [estados], capture }
 *  mejora  → "use": { exp } o { levels } o { perm: atributo } (tónico) o { resetPerm }
 *  equipo  → "stats": bonificación plana de atributos (regen en %)
 *            "grants": { "move": ataque extra } o { "passive": segunda pasiva }
 *  "noShop": true → no se vende en la tienda. Precios en data/shop.js.
 * ============================================================= */
(function () {
  const I = (DK.data.items = {});
  DK.data.tonicFor = {};   // atributo → tónico que lo sube (se deduce de use.perm)
  Object.entries(DK.raw.items).forEach(([id, o]) => {
    I[id] = Object.assign({ id }, o);
    if (o.use && o.use.perm) DK.data.tonicFor[o.use.perm] = id;
  });
})();
