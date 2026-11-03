/* =============================================================
 * data/hidden.js — Objetos ocultos por ahora.
 *   Con config.captureEnabled = false los daskai sólo se consiguen en los
 *   pisos de reclutas de las expediciones, así que los cristales de vínculo
 *   (objetos con use.capture) desaparecen del juego: no caen, no se venden,
 *   no se fabrican, no salen en el inventario, el códice ni las misiones.
 *   Siguen en data/items.json: al volver a activar el vínculo reaparecen.
 *
 *   DK.data.isHidden(id) → true si el objeto está oculto.
 * ============================================================= */
(function () {
  const D = DK.data;
  const hidden = new Set(DK.config.captureEnabled ? [] : Object.values(D.items).filter((it) => it.use && it.use.capture).map((it) => it.id));
  D.hiddenItems = hidden;
  D.isHidden = (id) => hidden.has(id);
  if (!hidden.size) return;
  const keep = ([id]) => !hidden.has(id);
  Object.values(D.species).forEach((sp) => { if (sp.drops) sp.drops = sp.drops.filter(keep); });
  Object.values(D.zones).forEach((z) => { if (z.boss && z.boss.drops) z.boss.drops = z.boss.drops.filter(keep); });
  Object.values(D.secretBosses || {}).forEach((b) => { if (b.drops) b.drops = b.drops.filter(keep); });
  // Recetas que dan o usan un objeto oculto
  for (let i = D.recipes.length - 1; i >= 0; i--) { const r = D.recipes[i]; if (hidden.has(r.result) || Object.keys(r.ingredients).some((id) => hidden.has(id))) D.recipes.splice(i, 1); }
  if (D.shopStock) D.shopStock = D.shopStock.filter((id) => !hidden.has(id));
  Object.keys(DK.config.startingBag || {}).forEach((id) => { if (hidden.has(id)) delete DK.config.startingBag[id]; });
  // Logros de vincular: fuera (no se pueden conseguir)
  for (let i = D.achievements.length - 1; i >= 0; i--) if (['firstCapture', 'captures15'].includes(D.achievements[i].id)) D.achievements.splice(i, 1);
  // Misiones: fuera la de vincular; las que premiaban con un cristal dan más monedas
  const M = D.missions;
  M.templates = M.templates.filter((m) => m.type !== 'capture');
  M.templates.forEach((m) => { if (m.reward && hidden.has(m.reward.item)) { delete m.reward.item; delete m.reward.qty; m.reward.coins = Math.round(m.reward.coins * 1.5); } });
})();
