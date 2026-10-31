/* =============================================================
 * data/moves.js — Ataques y habilidades.
 *
 *  def(id, {
 *    name, desc,
 *    kind:  'fisico' (no gasta maná) | 'magico' (gasta `mp`),
 *    house: casa del ataque (define el color y la animación),
 *    power: daño base (0 = ataque de apoyo),
 *    mp:    maná que gasta,
 *    acc:   precisión 0-100,
 *    effect: { type: 'status'|'buff'|'debuff'|'heal'|'drain', ... }
 *    priority: +1 actúa antes que los normales · -1 después (la velocidad desempata)
 *  })
 * ============================================================= */
(function () {
  const M = (DK.data.moves = {});
  const def = (id, o) => (M[id] = Object.assign({ id, acc: 100, mp: 0, power: 0, house: null }, o));
  const F = 'fisico', G = 'magico';

  // Neutrales
  def('forcejeo', { name: 'Forcejeo', kind: F, power: 20, desc: 'Ataque desesperado cuando no queda otra opción.', hidden: true });
  def('placaje', { name: 'Placaje', kind: F, power: 30, desc: 'Embiste con todo el cuerpo.' });
  def('aranazo', { priority: 1, name: 'Arañazo', kind: F, power: 35, desc: 'Araña con garras afiladas.' });
  def('picotazo', { priority: 1, name: 'Picotazo', kind: F, power: 38, desc: 'Picotea con rapidez.' });
  def('mordisco', { name: 'Mordisco', kind: F, power: 45, desc: 'Muerde con fuerza.' });
  def('tenaza', { name: 'Tenaza', kind: F, power: 52, desc: 'Atrapa al rival con sus pinzas.' });
  def('embestida', { name: 'Embestida', kind: F, power: 55, acc: 95, desc: 'Carga violenta contra el rival.' });
  def('ala_cortante', { name: 'Ala Cortante', kind: F, power: 68, acc: 95, desc: 'Corta el aire con sus alas.' });
  def('golpe_feroz', { priority: -1, name: 'Golpe Feroz', kind: F, power: 82, acc: 90, desc: 'Un golpe brutal.' });
  def('impacto_final', { priority: -1, name: 'Impacto Final', kind: F, power: 115, acc: 80, desc: 'Ataque devastador pero impreciso.' });
  def('rugido', { name: 'Rugido', kind: G, mp: 4, effect: { type: 'buff', stat: 'atk', stages: 1 }, desc: 'Ruge para aumentar su ataque físico.' });
  def('concentracion', { name: 'Concentración', kind: G, mp: 4, effect: { type: 'buff', stat: 'matk', stages: 1 }, desc: 'Aumenta su ataque mágico.' });
  def('coraza', { priority: 1, name: 'Coraza', kind: G, mp: 4, effect: { type: 'buff', stat: 'def', stages: 1 }, desc: 'Endurece el cuerpo y sube su defensa física.' });
  def('agilidad', { priority: 1, name: 'Agilidad', kind: G, mp: 5, effect: { type: 'buff', stat: 'spd', stages: 2 }, desc: 'Aumenta mucho su velocidad.' });
  def('intimidar', { name: 'Intimidar', kind: G, mp: 4, effect: { type: 'debuff', stat: 'atk', stages: 1 }, desc: 'Reduce el ataque físico del rival.' });

  // Fuego
  def('chispa', { name: 'Chispa', kind: G, house: 'fuego', power: 40, mp: 5, effect: { type: 'status', status: 'quemadura', chance: 0.1 }, desc: 'Pequeña llama que puede quemar.' });
  def('colmillo_ardiente', { name: 'Colmillo Ardiente', kind: F, house: 'fuego', power: 50, effect: { type: 'status', status: 'quemadura', chance: 0.25 }, desc: 'Muerde con colmillos en llamas.' });
  def('puno_igneo', { name: 'Puño Ígneo', kind: F, house: 'fuego', power: 66, effect: { type: 'status', status: 'quemadura', chance: 0.2 }, desc: 'Puñetazo envuelto en fuego.' });
  def('lanzallamas', { name: 'Lanzallamas', kind: G, house: 'fuego', power: 76, mp: 14, effect: { type: 'status', status: 'quemadura', chance: 0.15 }, desc: 'Chorro de fuego abrasador.' });
  def('llamarada', { priority: -1, name: 'Llamarada', kind: G, house: 'fuego', power: 100, mp: 22, effect: { type: 'status', status: 'quemadura', chance: 0.3 }, desc: 'Explosión de fuego intenso.' });
  def('infierno', { priority: -1, name: 'Infierno', kind: G, house: 'fuego', power: 130, mp: 32, acc: 90, effect: { type: 'status', status: 'quemadura', chance: 0.5 }, desc: 'Desata un mar de llamas.' });

  // Agua
  def('burbuja', { name: 'Burbuja', kind: G, house: 'agua', power: 40, mp: 5, desc: 'Lanza burbujas a presión.' });
  def('acua_cola', { name: 'Acua Cola', kind: F, house: 'agua', power: 60, desc: 'Golpe de cola cargado de agua.' });
  def('hidrochorro', { name: 'Hidrochorro', kind: G, house: 'agua', power: 76, mp: 14, desc: 'Potente chorro de agua.' });
  def('aguas_curativas', { name: 'Aguas Curativas', kind: G, house: 'agua', mp: 10, effect: { type: 'heal', pct: 0.3 }, desc: 'Recupera un 30% de su vida máxima.' });
  def('maremoto', { priority: -1, name: 'Maremoto', kind: G, house: 'agua', power: 104, mp: 22, desc: 'Una gran ola arrasa al rival.' });
  def('diluvio', { priority: -1, name: 'Diluvio', kind: G, house: 'agua', power: 130, mp: 32, acc: 90, effect: { type: 'debuff', stat: 'spd', stages: 1, chance: 0.5 }, desc: 'Lluvia torrencial que puede ralentizar.' });

  // Tierra
  def('lodo', { name: 'Lodo', kind: G, house: 'tierra', power: 40, mp: 5, effect: { type: 'debuff', stat: 'spd', stages: 1, chance: 0.4 }, desc: 'Barro que puede ralentizar.' });
  def('golpe_roca', { name: 'Golpe Roca', kind: F, house: 'tierra', power: 60, desc: 'Golpea con un puño de piedra.' });
  def('raiz_drenante', { name: 'Raíz Drenante', kind: G, house: 'tierra', power: 55, mp: 10, effect: { type: 'drain', pct: 0.5 }, desc: 'Absorbe vida: recupera el 50% del daño.' });
  def('polen_toxico', { name: 'Polen Tóxico', kind: G, house: 'tierra', mp: 8, acc: 90, effect: { type: 'status', status: 'veneno', chance: 1 }, desc: 'Envenena al rival.' });
  def('terremoto', { priority: -1, name: 'Terremoto', kind: G, house: 'tierra', power: 100, mp: 22, desc: 'Sacude el suelo con violencia.' });
  def('avalancha', { priority: -1, name: 'Avalancha', kind: F, house: 'tierra', power: 115, acc: 85, desc: 'Sepulta al rival bajo rocas.' });

  // Luz
  def('destello', { priority: 1, name: 'Destello', kind: G, house: 'luz', power: 40, mp: 5, desc: 'Ráfaga de luz cegadora.' });
  def('golpe_aureo', { name: 'Golpe Áureo', kind: F, house: 'luz', power: 60, desc: 'Golpe envuelto en luz dorada.' });
  def('rayo_luz', { name: 'Rayo de Luz', kind: G, house: 'luz', power: 76, mp: 14, desc: 'Haz de luz concentrada.' });
  def('curacion', { name: 'Curación', kind: G, house: 'luz', mp: 12, effect: { type: 'heal', pct: 0.35 }, desc: 'Recupera un 35% de su vida máxima.' });
  def('juicio', { priority: -1, name: 'Juicio', kind: G, house: 'luz', power: 100, mp: 22, desc: 'Columna de luz sagrada.' });
  def('supernova', { priority: -1, name: 'Supernova', kind: G, house: 'luz', power: 130, mp: 32, acc: 90, desc: 'Estallido de luz estelar.' });

  // Oscuridad
  def('sombra_vil', { priority: 1, name: 'Sombra Vil', kind: G, house: 'oscuridad', power: 40, mp: 5, desc: 'Ataca desde las sombras.' });
  def('colmillo_venenoso', { name: 'Colmillo Venenoso', kind: F, house: 'oscuridad', power: 50, effect: { type: 'status', status: 'veneno', chance: 0.3 }, desc: 'Muerde y puede envenenar.' });
  def('garra_umbria', { name: 'Garra Umbría', kind: F, house: 'oscuridad', power: 66, desc: 'Zarpazo de pura sombra.' });
  def('drenaje_vital', { name: 'Drenaje Vital', kind: G, house: 'oscuridad', power: 60, mp: 12, effect: { type: 'drain', pct: 0.5 }, desc: 'Roba vida: recupera el 50% del daño.' });
  def('pulso_umbrio', { name: 'Pulso Umbrío', kind: G, house: 'oscuridad', power: 76, mp: 14, effect: { type: 'debuff', stat: 'mdef', stages: 1, chance: 0.3 }, desc: 'Onda oscura que puede bajar la defensa mágica.' });
  def('eclipse', { priority: -1, name: 'Eclipse', kind: G, house: 'oscuridad', power: 130, mp: 32, acc: 90, desc: 'Apaga toda luz a su alrededor.' });
})();
