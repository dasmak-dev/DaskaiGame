/* =============================================================
 * data/relics.js — Reliquias de expedición.
 *
 * Bonificaciones que sólo duran la expedición en curso. Se eligen al
 * empezarla (1 de 3 entre las DESBLOQUEADAS con emblemas en el menú de
 * Mejoras: DK.camp.unlock), tras vencer a un rival de élite y en algunos
 * cofres (éstas, de todas).
 *
 *   { id, name, icon, rarity, effect: { tipo, ...valores } }
 *
 * Tipos de efecto (se aplican en systems/battle.js, systems/daskai.js
 * y systems/expedition.js a través de DK.relics):
 *   dmg       { pct }          +% de daño de tus daskai
 *   dmgHouse  { house, pct }   +% de daño si tu daskai es de esa casa
 *   defense   { pct }          -% de daño recibido
 *   crit      { add }          + probabilidad de crítico (0.05 = +5%)
 *   stat      { stat, pct }    +% a un atributo de tus daskai
 *   regen     { add }          + puntos de regeneración (% de vida por turno)
 *   mpSave    { pct }          los ataques mágicos cuestan un % menos de maná
 *   capture   { add }          + probabilidad de vínculo
 *   exp       { pct }          +% de experiencia
 *   coins     { pct }          +% de monedas
 *   winHeal   { pct }          al ganar, tu equipo recupera un % de vida
 *   loot      { add }          + objetos en cada cofre
 * v5.46 (efectos con mecánica propia, en systems/battle.js):
 *   critEvery { n }            cada n-ésimo ataque de tu equipo en un combate es crítico seguro
 *   freeEvery { n }            cada n-ésimo ataque mágico no gasta maná
 *   firstStrike { pct }        +% de daño en el primer golpe de cada combate
 *   lowHpDmg  { pct }          +% de daño con menos del 40% de vida
 *   bossDmg   { pct }          +% de daño contra jefes y mini jefes
 *   lifesteal { pct }          recuperas un % del daño que haces
 *   thorns    { pct }          devuelves un % del daño que recibes
 *   killMana  { pct }          al derrotar a un rival recuperas un % de maná
 *   killHeal  { pct }          al derrotar a un rival recuperas un % de vida
 *   survive   {}               una vez por combate, un golpe mortal te deja con 1 PV
 *   startStage { n }           empiezas cada combate con +n en ataque y ataque mágico
 *   emblems   { add }          + emblemas por cada jefe
 * Los mini jefes y los jefes sueltan una reliquia al azar de TODAS (DK.relics.drop); la corrupción la hace más rara.
 * El icono en color sale de js/data/gen/relicsPx.js (mismo id); `icon` es el de trazo de repuesto.
 * Los textos del efecto están en lang → relics.effect.<tipo>.
 * ============================================================= */
(function () {
  const R = (DK.data.relics = {});
  const def = (id, name, icon, rarity, effect) => (R[id] = { id, name, icon, rarity, effect });

  // Comunes
  def('piedra_afilada', 'Piedra de afilar', 'dagger', 'comun', { type: 'dmg', pct: 0.08 });
  def('trebol', 'Trébol de cuatro hojas', 'leaf', 'comun', { type: 'crit', add: 0.06 });
  def('bolsa_vieja', 'Bolsa remendada', 'pouch', 'comun', { type: 'coins', pct: 0.3 });
  def('libro_notas', 'Cuaderno de notas', 'tome', 'comun', { type: 'exp', pct: 0.25 });
  def('cantimplora', 'Cantimplora', 'chalice', 'comun', { type: 'winHeal', pct: 0.1 });
  def('corteza', 'Escudo de corteza', 'shield', 'comun', { type: 'defense', pct: 0.08 });

  // Raras
  def('ascua_eterna', 'Ascua eterna', 'flame', 'raro', { type: 'dmgHouse', house: 'fuego', pct: 0.2 });
  def('caracola', 'Caracola de marea', 'shell', 'raro', { type: 'dmgHouse', house: 'agua', pct: 0.2 });
  def('raiz_antigua', 'Raíz antigua', 'rune', 'raro', { type: 'dmgHouse', house: 'tierra', pct: 0.2 });
  def('prisma_solar', 'Prisma solar', 'crystal', 'raro', { type: 'dmgHouse', house: 'luz', pct: 0.2 });
  def('velo_noche', 'Velo nocturno', 'moon', 'raro', { type: 'dmgHouse', house: 'oscuridad', pct: 0.2 });
  def('pluma_rapida', 'Pluma de vencejo', 'feather', 'raro', { type: 'stat', stat: 'spd', pct: 0.15 });
  def('cristal_eco', 'Cristal de eco', 'crystal', 'raro', { type: 'mpSave', pct: 0.35 });
  def('anzuelo', 'Anzuelo de plata', 'amulet', 'raro', { type: 'capture', add: 0.15 });
  def('musgo_vivo', 'Musgo vivo', 'regen', 'raro', { type: 'regen', add: 2 });

  // Épicas
  def('colmillo_rey', 'Colmillo del rey', 'fang', 'epico', { type: 'dmg', pct: 0.2 });
  def('mapa_tesoro', 'Mapa del tesoro', 'map', 'epico', { type: 'loot', add: 2 });
  def('caliz_vida', 'Cáliz de la vida', 'chalice', 'epico', { type: 'winHeal', pct: 0.25 });
  def('egida', 'Égida de piedra', 'shieldStar', 'epico', { type: 'defense', pct: 0.18 });

  // v5.46: reliquias con mecánica propia
  def('cuerno_guerra', 'Cuerno de guerra', 'drum', 'comun', { type: 'startStage', n: 1 });
  def('daga_alba', 'Daga del alba', 'dagger', 'comun', { type: 'firstStrike', pct: 0.5 });
  def('cristal_almas', 'Cristal de almas', 'crystal', 'comun', { type: 'killMana', pct: 0.25 });
  def('ojo_cazador', 'Ojo del cazador', 'eye', 'raro', { type: 'critEvery', n: 3 });
  def('reloj_arena', 'Reloj de arena', 'clock', 'raro', { type: 'freeEvery', n: 2 });
  def('copa_carmesi', 'Copa carmesí', 'chalice', 'raro', { type: 'lifesteal', pct: 0.15 });
  def('caparazon_espinas', 'Rodela de espinas', 'shield', 'raro', { type: 'thorns', pct: 0.3 });
  def('corazon_ira', 'Corazón de la ira', 'heart', 'raro', { type: 'lowHpDmg', pct: 0.35 });
  def('festin', 'Hueso del festín', 'fang', 'raro', { type: 'killHeal', pct: 0.2 });
  def('sello_matarreyes', 'Sello del matarreyes', 'award', 'epico', { type: 'bossDmg', pct: 0.3 });
  def('ultimo_aliento', 'Relicario del último aliento', 'heart', 'epico', { type: 'survive' });
  def('corona_espinas', 'Corona de astas', 'crown', 'epico', { type: 'emblems', add: 1 });
})();
