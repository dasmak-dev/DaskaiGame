/* =============================================================
 * data/species.js — Especies de daskai (cargador).
 *
 * Las especies se editan en data/species.json (luego: node tools/data.js).
 *  {
 *    "name", "house", "desc",
 *    "base":     { hp, mp, atk, matk, def, mdef, spd }  atributos base de la especie,
 *    "passives": pasivas posibles (cada daskai nace con una al azar;
 *                si no se indica, puede salir cualquiera de data/basics.js),
 *    "learn":    [[nivel, ataque], ...],
 *    "drops":    [[objeto, probabilidad 0-1], ...],
 *    "exp":      experiencia que da al ser derrotado (por defecto 40),
 *    "starter":  true si se puede elegir al empezar,
 *    "sprite":   parámetros del dibujo (systems/sprites.js) o { "img": "ruta.png" },
 *    "evolves":  { "to": especie, "level": nivel }  en qué evoluciona y cuándo
 *  }
 * Una forma evolucionada lleva "from": especie previa y hereda de ella
 * casa, pasivas y ataques (más "learnExtra"), y exp + 25 si no se indican.
 *
 * Cada daskai es distinto aunque sea de la misma especie: nace con una
 * pasiva y una naturaleza al azar, unos «genes» que mueven sus atributos
 * base ±config.genes, y crece de forma aleatoria al subir de nivel
 * (systems/daskai.js).
 * ============================================================= */
(function () {
  const RAW = DK.raw.species, SP = (DK.data.species = {});
  const ALL_PASSIVES = () => Object.keys(DK.data.passives);

  function build(id, seen = []) {
    if (SP[id]) return SP[id];
    const o = RAW[id];
    if (!o) throw new Error('Especie desconocida: ' + id);
    if (seen.includes(id)) throw new Error('Evolución circular: ' + seen.concat(id).join(' → '));
    const from = o.from ? build(o.from, seen.concat(id)) : null;
    const sp = Object.assign({
      id,
      house: from ? from.house : null,
      exp: from ? from.exp + 25 : 40,
      drops: [],
      passives: from ? from.passives : ALL_PASSIVES(),
      learn: from ? from.learn.concat(o.learnExtra || []) : [],
    }, o);
    delete sp.learnExtra; delete sp.from; delete sp.evolves;
    if (from) sp.evolvedFrom = o.from;
    if (o.evolves) sp.evolve = { level: o.evolves.level, into: o.evolves.to };
    SP[id] = sp;
    return sp;
  }
  // Se construyen en el orden del archivo (es el orden del códice)
  Object.keys(RAW).forEach((id) => build(id));
  // …pero las formas evolucionadas pueden haberse construido antes: reordena
  const ordered = {};
  Object.keys(RAW).forEach((id) => (ordered[id] = SP[id]));
  DK.data.species = ordered;
})();
